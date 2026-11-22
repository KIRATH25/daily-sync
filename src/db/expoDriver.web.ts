/**
 * Web database driver (used for the browser / iOS "Add to Home Screen" app).
 *
 * expo-sqlite's web build needs SharedArrayBuffer, which requires special
 * cross-origin-isolation headers that ordinary static hosting can't send. So on
 * web we run SQLite fully in memory with sql.js (WebAssembly, embedded inline)
 * and persist the whole database file to IndexedDB:
 *   - loaded once at startup,
 *   - saved shortly after every write (debounced),
 *   - flushed immediately when the page is hidden or closed.
 * The same schema, migrations and repositories run unchanged.
 */
import initSqlJs from 'sql.js/dist/sql-wasm-inline.js';
import type { Database, SqlValue } from 'sql.js';

import type { DbDriver, SQLValue } from './driver';

export const DATABASE_NAME = 'dailysync.db';
const IDB_NAME = 'daily-sync';
const IDB_STORE = 'files';
const SAVE_DELAY_MS = 150;

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(IDB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
  });
}

async function readSaved(idb: IDBDatabase): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const request = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(DATABASE_NAME);
    request.onsuccess = () => resolve(request.result instanceof Uint8Array ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error('Could not read saved data'));
  });
}

async function writeSaved(idb: IDBDatabase, bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(bytes, DATABASE_NAME);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not save data'));
  });
}

export async function openExpoDriver(): Promise<DbDriver> {
  const SQL = await initSqlJs();
  const idb = await openIdb();
  const saved = await readSaved(idb);
  const database: Database = saved ? new SQL.Database(saved) : new SQL.Database();
  database.exec('PRAGMA foreign_keys = ON;');

  // Ask the browser not to evict our storage under pressure (best effort).
  navigator.storage?.persist?.().catch(() => undefined);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;
  let inTransaction = false;

  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!dirty || inTransaction) return;
    dirty = false;
    try {
      await writeSaved(idb, database.export());
    } catch (error) {
      dirty = true;
      console.error('Saving data failed', error);
    }
  };
  const scheduleSave = () => {
    dirty = true;
    if (inTransaction) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), SAVE_DELAY_MS);
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush();
    });
    window.addEventListener('pagehide', () => void flush());
  }

  const bind = (params?: readonly SQLValue[]): SqlValue[] => (params ? params.map((value) => value) : []);

  const all = <T,>(sql: string, params?: readonly SQLValue[]): T[] => {
    const statement = database.prepare(sql);
    try {
      statement.bind(bind(params));
      const rows: T[] = [];
      while (statement.step()) rows.push(statement.getAsObject() as T);
      return rows;
    } finally {
      statement.free();
    }
  };

  const isWrite = (sql: string) => !/^\s*(select|pragma\s+(table_info|user_version)\s*($|\())/i.test(sql);

  return {
    exec: async (sql) => {
      database.exec(sql);
      if (isWrite(sql)) scheduleSave();
    },
    run: async (sql, params) => {
      database.run(sql, bind(params));
      const changes = database.getRowsModified();
      const row = all<{ id: number }>('SELECT last_insert_rowid() AS id')[0];
      if (isWrite(sql)) scheduleSave();
      return { changes, lastInsertRowId: row?.id ?? 0 };
    },
    all: async (sql, params) => all(sql, params),
    first: async <T,>(sql: string, params?: readonly SQLValue[]) => all<T>(sql, params)[0] ?? null,
    transaction: async (work) => {
      database.exec('BEGIN');
      inTransaction = true;
      try {
        await work();
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      } finally {
        inTransaction = false;
      }
      scheduleSave();
    },
  };
}
