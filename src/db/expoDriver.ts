import * as SQLite from 'expo-sqlite';

import type { DbDriver, SQLValue } from './driver';

export const DATABASE_NAME = 'dailysync.db';

/**
 * Opens the app database inside the application sandbox and adapts it to the
 * `DbDriver` contract. The file is not encrypted: it is protected by Android's
 * per-app storage isolation, and private areas are additionally gated by
 * device authentication in the UI (see services/security).
 */
export async function openExpoDriver(): Promise<DbDriver> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const bind = (params?: readonly SQLValue[]): SQLValue[] => (params ? [...params] : []);

  return {
    exec: (sql) => database.execAsync(sql),
    run: async (sql, params) => {
      const result = await database.runAsync(sql, bind(params));
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
    },
    all: <T,>(sql: string, params?: readonly SQLValue[]) => database.getAllAsync<T>(sql, bind(params)),
    first: <T,>(sql: string, params?: readonly SQLValue[]) => database.getFirstAsync<T>(sql, bind(params)),
    transaction: (work) => database.withTransactionAsync(work),
  };
}
