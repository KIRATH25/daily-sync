import { createId } from '@/lib/id';
import type { Countdown, CountdownStyle } from '@/types/models';

import { notifyChange } from '../changes';
import { db, type SQLValue } from '../driver';
import { bool, flag, isNumber, parseJsonArray, toJson } from '../json';

interface CountdownRow {
  id: string;
  title: string;
  subtitle: string | null;
  target_date: string;
  target_minute: number;
  style: CountdownStyle;
  accent: string | null;
  background_uri: string | null;
  message: string | null;
  pinned: number;
  show_seconds: number;
  reminder_offsets: string;
  created_at: number;
  updated_at: number;
}

export type CountdownInput = Omit<Countdown, 'id' | 'createdAt' | 'updatedAt'>;

const mapCountdown = (row: CountdownRow): Countdown => ({
  id: row.id,
  title: row.title,
  subtitle: row.subtitle,
  targetDate: row.target_date,
  targetMinute: row.target_minute,
  style: row.style,
  accent: row.accent,
  backgroundUri: row.background_uri,
  message: row.message,
  pinned: bool(row.pinned),
  showSeconds: bool(row.show_seconds),
  reminderOffsets: parseJsonArray(row.reminder_offsets, isNumber),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function params(input: CountdownInput): SQLValue[] {
  return [
    input.title,
    input.subtitle,
    input.targetDate,
    input.targetMinute,
    input.style,
    input.accent,
    input.backgroundUri,
    input.message,
    flag(input.pinned),
    flag(input.showSeconds),
    toJson(input.reminderOffsets),
  ];
}

export async function listCountdowns(): Promise<Countdown[]> {
  const rows = await db().all<CountdownRow>(
    'SELECT * FROM countdowns ORDER BY pinned DESC, target_date, target_minute',
  );
  return rows.map(mapCountdown);
}

export async function getCountdown(id: string): Promise<Countdown | null> {
  const row = await db().first<CountdownRow>('SELECT * FROM countdowns WHERE id = ?', [id]);
  return row ? mapCountdown(row) : null;
}

export async function createCountdown(input: CountdownInput): Promise<string> {
  const id = createId('cdn');
  const now = Date.now();
  await db().run(
    `INSERT INTO countdowns (title, subtitle, target_date, target_minute, style, accent, background_uri, message,
       pinned, show_seconds, reminder_offsets, id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...params(input), id, now, now],
  );
  notifyChange('countdowns');
  return id;
}

export async function updateCountdown(id: string, input: CountdownInput): Promise<void> {
  await db().run(
    `UPDATE countdowns SET title = ?, subtitle = ?, target_date = ?, target_minute = ?, style = ?, accent = ?,
       background_uri = ?, message = ?, pinned = ?, show_seconds = ?, reminder_offsets = ?, updated_at = ?
     WHERE id = ?`,
    [...params(input), Date.now(), id],
  );
  notifyChange('countdowns');
}

export async function setCountdownPinned(id: string, pinned: boolean): Promise<void> {
  await db().run('UPDATE countdowns SET pinned = ?, updated_at = ? WHERE id = ?', [flag(pinned), Date.now(), id]);
  notifyChange('countdowns');
}

export async function deleteCountdown(id: string): Promise<void> {
  await db().run('DELETE FROM countdowns WHERE id = ?', [id]);
  notifyChange('countdowns');
}
