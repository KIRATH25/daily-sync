/**
 * Full-fidelity JSON backup and restore.
 *
 * Restore is defensive because backup files are untrusted input:
 *   - the envelope, app id and schema version are checked first;
 *   - only known tables are touched, in foreign-key order;
 *   - only columns that exist in the live schema are inserted, values must be
 *     primitives, and everything goes through bound parameters;
 *   - the whole import runs in one transaction — a bad row rolls back
 *     everything and leaves the current data untouched.
 *
 * OS notification bookkeeping is device-specific and is not exported; the
 * reminder scheduler rebuilds it after a restore.
 */
import { ALL_TABLES, notifyChange, type TableName } from '../changes';
import { db, type SQLValue } from '../driver';
import { LATEST_SCHEMA_VERSION } from '../migrations';

export const BACKUP_APP_ID = 'daily-sync';
export const MAX_BACKUP_BYTES = 30 * 1024 * 1024;

/** Parent tables before children so foreign keys resolve on insert. */
const TABLE_ORDER: TableName[] = [
  'preferences',
  'exercises',
  'workout_plans',
  'workout_plan_exercises',
  'calendar_entries',
  'entry_completions',
  'tasks',
  'task_subtasks',
  'habits',
  'habit_logs',
  'day_reviews',
  'journal_entries',
  'subjects',
  'timetable_slots',
  'assignments',
  'attendance_records',
  'countdowns',
  'workout_sessions',
  'exercise_sets',
  'body_metrics',
  'hydration_logs',
  'focus_sessions',
  'custom_themes',
  'inbox_items',
  'daily_quote_history',
  'achievement_records',
];

const EXCLUDED: TableName[] = ['notification_records'];

export interface BackupEnvelope {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  tables: Partial<Record<TableName, Record<string, SQLValue>[]>>;
}

export async function exportBackup(): Promise<BackupEnvelope> {
  const tables: BackupEnvelope['tables'] = {};
  for (const table of TABLE_ORDER) {
    tables[table] = await db().all<Record<string, SQLValue>>(`SELECT * FROM ${table}`);
  }
  return { app: BACKUP_APP_ID, schemaVersion: LATEST_SCHEMA_VERSION, exportedAt: new Date().toISOString(), tables };
}

export type RestoreError = 'restore.invalidFile' | 'restore.wrongApp' | 'restore.newerVersion' | 'restore.corrupt';

export class RestoreFailure extends Error {
  constructor(public readonly code: RestoreError) {
    super(code);
  }
}

function isPrimitive(value: unknown): value is SQLValue {
  return value === null || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
}

export function parseBackup(text: string): BackupEnvelope {
  if (text.length > MAX_BACKUP_BYTES) throw new RestoreFailure('restore.invalidFile');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RestoreFailure('restore.invalidFile');
  }
  if (!parsed || typeof parsed !== 'object') throw new RestoreFailure('restore.invalidFile');
  const envelope = parsed as Partial<BackupEnvelope>;
  if (envelope.app !== BACKUP_APP_ID) throw new RestoreFailure('restore.wrongApp');
  if (typeof envelope.schemaVersion !== 'number' || !envelope.tables || typeof envelope.tables !== 'object') {
    throw new RestoreFailure('restore.invalidFile');
  }
  if (envelope.schemaVersion > LATEST_SCHEMA_VERSION) throw new RestoreFailure('restore.newerVersion');
  return envelope as BackupEnvelope;
}

export interface RestoreSummary {
  rows: number;
}

export async function restoreBackup(envelope: BackupEnvelope): Promise<RestoreSummary> {
  let rows = 0;
  const columnsByTable = new Map<TableName, Set<string>>();
  for (const table of TABLE_ORDER) {
    const info = await db().all<{ name: string }>(`PRAGMA table_info(${table})`);
    columnsByTable.set(table, new Set(info.map((column) => column.name)));
  }

  try {
    await db().transaction(async () => {
      // Delete children first, then insert parents first.
      for (const table of [...TABLE_ORDER, ...EXCLUDED].reverse()) {
        await db().run(`DELETE FROM ${table}`);
      }
      for (const table of TABLE_ORDER) {
        const records = envelope.tables[table];
        if (!records) continue;
        if (!Array.isArray(records)) throw new RestoreFailure('restore.corrupt');
        const allowed = columnsByTable.get(table) ?? new Set<string>();
        for (const record of records) {
          if (!record || typeof record !== 'object') throw new RestoreFailure('restore.corrupt');
          const columns = Object.keys(record).filter((column) => allowed.has(column));
          if (columns.length === 0) continue;
          const values = columns.map((column) => record[column]);
          if (!values.every(isPrimitive)) throw new RestoreFailure('restore.corrupt');
          // Column names come from the live schema whitelist, never from the file.
          await db().run(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
            values,
          );
          rows += 1;
        }
      }
    });
  } catch (error) {
    if (error instanceof RestoreFailure) throw error;
    throw new RestoreFailure('restore.corrupt');
  }
  notifyChange(...ALL_TABLES);
  return { rows };
}

/** Erases all user data (Settings → Reset). */
export async function eraseAllData(): Promise<void> {
  await db().transaction(async () => {
    for (const table of [...TABLE_ORDER, ...EXCLUDED].reverse()) {
      await db().run(`DELETE FROM ${table}`);
    }
  });
  notifyChange(...ALL_TABLES);
}
