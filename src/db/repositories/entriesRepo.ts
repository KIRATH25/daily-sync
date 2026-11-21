/**
 * Calendar entries: events, reminders, notes, goals and scheduled workouts.
 *
 * Recurring entries are stored once and expanded per date range at read
 * time. Completion is tracked per occurrence date in `entry_completions`, so
 * ticking off this Monday's class does not tick off next Monday's.
 */
import { addDays, type DateKey } from '@/lib/dates';
import { createId } from '@/lib/id';
import { occurrencesInRange, parseRecurrence, serializeRecurrence } from '@/lib/recurrence';
import type { CalendarEntry, Category, EntryKind, EntryOccurrence, Priority } from '@/types/models';

import { notifyChange } from '../changes';
import { db, type SQLValue } from '../driver';
import { bool, flag, isNumber, isString, parseJsonArray, toJson } from '../json';

interface EntryRow {
  id: string;
  kind: EntryKind;
  title: string;
  description: string | null;
  category: Category;
  color: string | null;
  priority: Priority | null;
  location: string | null;
  all_day: number;
  start_date: string;
  start_minute: number | null;
  end_minute: number | null;
  recurrence: string | null;
  exception_dates: string;
  reminder_offsets: string;
  popup_message: string | null;
  workout_plan_id: string | null;
  created_at: number;
  updated_at: number;
}

export type EntryInput = Omit<CalendarEntry, 'id' | 'createdAt' | 'updatedAt'>;

function mapEntry(row: EntryRow): CalendarEntry {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    category: row.category,
    color: row.color,
    priority: row.priority,
    location: row.location,
    allDay: bool(row.all_day),
    startDate: row.start_date,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    recurrence: parseRecurrence(row.recurrence),
    exceptionDates: parseJsonArray(row.exception_dates, isString),
    reminderOffsets: parseJsonArray(row.reminder_offsets, isNumber),
    popupMessage: row.popup_message,
    workoutPlanId: row.workout_plan_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function inputParams(input: EntryInput): SQLValue[] {
  return [
    input.kind,
    input.title,
    input.description,
    input.category,
    input.color,
    input.priority,
    input.location,
    flag(input.allDay),
    input.startDate,
    input.allDay ? null : input.startMinute,
    input.allDay ? null : input.endMinute,
    serializeRecurrence(input.recurrence),
    toJson(input.exceptionDates),
    toJson(input.reminderOffsets),
    input.popupMessage,
    input.workoutPlanId,
  ];
}

export async function getEntry(id: string): Promise<CalendarEntry | null> {
  const row = await db().first<EntryRow>('SELECT * FROM calendar_entries WHERE id = ?', [id]);
  return row ? mapEntry(row) : null;
}

export async function listAllEntries(): Promise<CalendarEntry[]> {
  const rows = await db().all<EntryRow>('SELECT * FROM calendar_entries ORDER BY start_date, start_minute');
  return rows.map(mapEntry);
}

export async function createEntry(input: EntryInput): Promise<CalendarEntry> {
  const id = createId('ent');
  const now = Date.now();
  await db().run(
    `INSERT INTO calendar_entries (kind, title, description, category, color, priority, location, all_day,
       start_date, start_minute, end_minute, recurrence, exception_dates, reminder_offsets, popup_message,
       workout_plan_id, id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...inputParams(input), id, now, now],
  );
  notifyChange('calendar_entries');
  return { ...input, id, createdAt: now, updatedAt: now };
}

export async function updateEntry(id: string, input: EntryInput): Promise<void> {
  await db().run(
    `UPDATE calendar_entries SET kind = ?, title = ?, description = ?, category = ?, color = ?, priority = ?,
       location = ?, all_day = ?, start_date = ?, start_minute = ?, end_minute = ?, recurrence = ?,
       exception_dates = ?, reminder_offsets = ?, popup_message = ?, workout_plan_id = ?, updated_at = ?
     WHERE id = ?`,
    [...inputParams(input), Date.now(), id],
  );
  notifyChange('calendar_entries');
}

export async function deleteEntry(id: string): Promise<void> {
  await db().run('DELETE FROM calendar_entries WHERE id = ?', [id]);
  notifyChange('calendar_entries', 'entry_completions');
}

/** Removes one occurrence of a recurring series ("delete this event only"). */
export async function skipOccurrence(id: string, date: DateKey): Promise<void> {
  const entry = await getEntry(id);
  if (!entry) return;
  const exceptions = [...new Set([...entry.exceptionDates, date])].sort();
  await db().run('UPDATE calendar_entries SET exception_dates = ?, updated_at = ? WHERE id = ?', [
    toJson(exceptions),
    Date.now(),
    id,
  ]);
  notifyChange('calendar_entries');
}

export async function duplicateEntry(id: string): Promise<CalendarEntry | null> {
  const entry = await getEntry(id);
  if (!entry) return null;
  const { id: _id, createdAt: _created, updatedAt: _updated, ...input } = entry;
  return createEntry({ ...input, exceptionDates: [] });
}

export async function rescheduleEntry(id: string, date: DateKey, startMinute: number | null): Promise<void> {
  const entry = await getEntry(id);
  if (!entry) return;
  let endMinute = entry.endMinute;
  if (startMinute != null && entry.startMinute != null && entry.endMinute != null) {
    endMinute = Math.min(1440, startMinute + (entry.endMinute - entry.startMinute));
  }
  await db().run(
    'UPDATE calendar_entries SET start_date = ?, start_minute = ?, end_minute = ?, updated_at = ? WHERE id = ?',
    [date, entry.allDay ? null : startMinute, entry.allDay ? null : endMinute, Date.now(), id],
  );
  notifyChange('calendar_entries');
}

export async function setEntryCompleted(
  id: string,
  occurrenceDate: DateKey,
  completed: boolean,
  today: DateKey,
): Promise<void> {
  if (completed) {
    await db().run(
      `INSERT INTO entry_completions (entry_id, occurrence_date, completed_at, completed_date)
       VALUES (?, ?, ?, ?) ON CONFLICT(entry_id, occurrence_date) DO NOTHING`,
      [id, occurrenceDate, Date.now(), today],
    );
  } else {
    await db().run('DELETE FROM entry_completions WHERE entry_id = ? AND occurrence_date = ?', [id, occurrenceDate]);
  }
  notifyChange('entry_completions');
}

/** All occurrences between two dates (inclusive), sorted by date then time. */
export async function listOccurrences(from: DateKey, to: DateKey): Promise<EntryOccurrence[]> {
  const rows = await db().all<EntryRow>(
    `SELECT * FROM calendar_entries
     WHERE (recurrence IS NULL AND start_date BETWEEN ? AND ?)
        OR (recurrence IS NOT NULL AND start_date <= ?)`,
    [from, to, to],
  );
  const completions = await db().all<{ entry_id: string; occurrence_date: string }>(
    'SELECT entry_id, occurrence_date FROM entry_completions WHERE occurrence_date BETWEEN ? AND ?',
    [from, to],
  );
  const done = new Set(completions.map((row) => `${row.entry_id}|${row.occurrence_date}`));
  const result: EntryOccurrence[] = [];
  for (const row of rows) {
    const entry = mapEntry(row);
    const dates = occurrencesInRange(entry.startDate, entry.recurrence, from, to, new Set(entry.exceptionDates));
    for (const date of dates) {
      result.push({ entry, date, completed: done.has(`${entry.id}|${date}`) });
    }
  }
  return result.sort(compareOccurrences);
}

export function compareOccurrences(a: EntryOccurrence, b: EntryOccurrence): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const am = a.entry.allDay ? -1 : (a.entry.startMinute ?? -1);
  const bm = b.entry.allDay ? -1 : (b.entry.startMinute ?? -1);
  return am - bm;
}

export async function listOccurrencesOn(date: DateKey): Promise<EntryOccurrence[]> {
  return listOccurrences(date, date);
}

export async function searchEntries(query: string, limit = 30): Promise<CalendarEntry[]> {
  const like = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const rows = await db().all<EntryRow>(
    `SELECT * FROM calendar_entries
     WHERE title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\'
     ORDER BY start_date DESC LIMIT ?`,
    [like, like, like, limit],
  );
  return rows.map(mapEntry);
}

/** Next timed occurrence at or after (date, minute), looking ahead `days`. */
export async function nextUpcoming(today: DateKey, minute: number, days = 14): Promise<EntryOccurrence | null> {
  const occurrences = await listOccurrences(today, addDays(today, days));
  return (
    occurrences.find(
      (item) =>
        !item.completed &&
        item.entry.kind !== 'note' &&
        (item.date > today || item.entry.allDay || (item.entry.startMinute ?? 0) >= minute),
    ) ?? null
  );
}
