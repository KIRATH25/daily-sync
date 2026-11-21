/**
 * Test-only DbDriver backed by Node's built-in `node:sqlite` engine, so the
 * real repositories and migrations run unmodified in Jest.
 */
import { DatabaseSync } from 'node:sqlite';

import type { DbDriver, SQLValue } from '../driver';

export function createNodeDriver(): DbDriver & { close: () => void } {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  const args = (params?: readonly SQLValue[]) => (params ? [...params] : []);

  return {
    exec: async (sql) => {
      database.exec(sql);
    },
    run: async (sql, params) => {
      const result = database.prepare(sql).run(...args(params));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    all: async <T,>(sql: string, params?: readonly SQLValue[]) =>
      database.prepare(sql).all(...args(params)) as unknown as T[],
    first: async <T,>(sql: string, params?: readonly SQLValue[]) =>
      (database.prepare(sql).get(...args(params)) as T | undefined) ?? null,
    transaction: async (work) => {
      database.exec('BEGIN');
      try {
        await work();
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => database.close(),
  };
}
