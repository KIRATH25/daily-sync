import { notifyChange } from '../changes';
import { db } from '../driver';

/** Raw key/value access. Typed defaults and validation live in store/preferences. */
export async function loadAllPreferences(): Promise<Record<string, unknown>> {
  const rows = await db().all<{ key: string; value: string }>('SELECT key, value FROM preferences');
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value);
    } catch {
      // A corrupt value falls back to its default rather than crashing boot.
    }
  }
  return result;
}

export async function savePreference(key: string, value: unknown): Promise<void> {
  await db().run(
    `INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), Date.now()],
  );
  notifyChange('preferences');
}

export async function readPreference<T>(key: string): Promise<T | null> {
  const row = await db().first<{ value: string }>('SELECT value FROM preferences WHERE key = ?', [key]);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}
