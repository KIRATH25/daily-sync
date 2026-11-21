/**
 * Minimal database driver contract used by every repository.
 *
 * Repositories depend on this interface instead of expo-sqlite directly so
 * that (a) all SQL goes through parameter binding — there is intentionally
 * no API for string-interpolated values — and (b) the exact same repository
 * code runs in unit tests against Node's built-in SQLite engine.
 */

export type SQLValue = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface DbDriver {
  /** Executes trusted, static SQL (schema/migrations only). No parameters. */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SQLValue[]): Promise<RunResult>;
  all<T>(sql: string, params?: readonly SQLValue[]): Promise<T[]>;
  first<T>(sql: string, params?: readonly SQLValue[]): Promise<T | null>;
  /** Runs `work` atomically; rolls back if it throws. */
  transaction(work: () => Promise<void>): Promise<void>;
}

let activeDriver: DbDriver | null = null;

export function setDriver(driver: DbDriver | null): void {
  activeDriver = driver;
}

export function db(): DbDriver {
  if (!activeDriver) {
    throw new Error('Database used before it was opened. Wait for AppBootstrap to finish.');
  }
  return activeDriver;
}

export function hasDriver(): boolean {
  return activeDriver !== null;
}
