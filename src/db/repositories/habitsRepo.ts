import type { DateKey } from '@/lib/dates';
import { createId } from '@/lib/id';
import type { Habit, HabitIcon, HabitLog } from '@/types/models';

import { notifyChange } from '../changes';
import { db, type SQLValue } from '../driver';
import { bool, flag, isNumber, parseJsonArray, toJson } from '../json';

interface HabitRow {
  id: string;
  title: string;
  icon: HabitIcon;
  color: string | null;
  target_value: number;
  unit: string | null;
  increment: number | null;
  schedule_days: string;
  weekly_target: number | null;
  reminder_minute: number | null;
  notes: string | null;
  paused: number;
  archived: number;
  position: number;
  start_date: string;
  created_at: number;
  updated_at: number;
}

interface LogRow {
  habit_id: string;
  log_date: string;
  value: number;
  completed: number;
  note: string | null;
}

export type HabitInput = Pick<
  Habit,
  'title' | 'icon' | 'color' | 'targetValue' | 'unit' | 'increment' | 'scheduleDays' | 'weeklyTarget' | 'reminderMinute' | 'notes'
>;

function mapHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    color: row.color,
    targetValue: row.target_value,
    unit: row.unit,
    increment: row.increment,
    scheduleDays: parseJsonArray(row.schedule_days, isNumber),
    weeklyTarget: row.weekly_target,
    reminderMinute: row.reminder_minute,
    notes: row.notes,
    paused: bool(row.paused),
    archived: bool(row.archived),
    position: row.position,
    startDate: row.start_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const mapLog = (row: LogRow): HabitLog => ({
  habitId: row.habit_id,
  date: row.log_date,
  value: row.value,
  completed: bool(row.completed),
  note: row.note,
});

function inputParams(input: HabitInput): SQLValue[] {
  return [
    input.title,
    input.icon,
    input.color,
    input.targetValue,
    input.unit,
    input.increment,
    toJson([...new Set(input.scheduleDays)].sort()),
    input.weeklyTarget,
    input.reminderMinute,
    input.notes,
  ];
}

export async function listHabits(includeArchived = false): Promise<Habit[]> {
  const rows = await db().all<HabitRow>(
    `SELECT * FROM habits ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY position, created_at`,
  );
  return rows.map(mapHabit);
}

export async function getHabit(id: string): Promise<Habit | null> {
  const row = await db().first<HabitRow>('SELECT * FROM habits WHERE id = ?', [id]);
  return row ? mapHabit(row) : null;
}

export async function createHabit(input: HabitInput, startDate: DateKey): Promise<Habit> {
  const id = createId('hab');
  const now = Date.now();
  const position = await db().first<{ next: number }>('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM habits');
  await db().run(
    `INSERT INTO habits (title, icon, color, target_value, unit, increment, schedule_days, weekly_target,
       reminder_minute, notes, id, position, start_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...inputParams(input), id, position?.next ?? 0, startDate, now, now],
  );
  notifyChange('habits');
  const habit = await getHabit(id);
  if (!habit) throw new Error('Habit was not saved');
  return habit;
}

export async function updateHabit(id: string, input: HabitInput): Promise<void> {
  await db().run(
    `UPDATE habits SET title = ?, icon = ?, color = ?, target_value = ?, unit = ?, increment = ?,
       schedule_days = ?, weekly_target = ?, reminder_minute = ?, notes = ?, updated_at = ? WHERE id = ?`,
    [...inputParams(input), Date.now(), id],
  );
  notifyChange('habits');
}

export async function setHabitPaused(id: string, paused: boolean): Promise<void> {
  await db().run('UPDATE habits SET paused = ?, updated_at = ? WHERE id = ?', [flag(paused), Date.now(), id]);
  notifyChange('habits');
}

export async function setHabitArchived(id: string, archived: boolean): Promise<void> {
  await db().run('UPDATE habits SET archived = ?, updated_at = ? WHERE id = ?', [flag(archived), Date.now(), id]);
  notifyChange('habits');
}

export async function deleteHabit(id: string): Promise<void> {
  await db().run('DELETE FROM habits WHERE id = ?', [id]);
  notifyChange('habits', 'habit_logs');
}

export async function listLogs(from: DateKey, to: DateKey, habitId?: string): Promise<HabitLog[]> {
  const rows = habitId
    ? await db().all<LogRow>('SELECT * FROM habit_logs WHERE habit_id = ? AND log_date BETWEEN ? AND ?', [habitId, from, to])
    : await db().all<LogRow>('SELECT * FROM habit_logs WHERE log_date BETWEEN ? AND ?', [from, to]);
  return rows.map(mapLog);
}

export async function listCompletedDates(habitId: string): Promise<DateKey[]> {
  const rows = await db().all<{ log_date: string }>(
    'SELECT log_date FROM habit_logs WHERE habit_id = ? AND completed = 1 ORDER BY log_date',
    [habitId],
  );
  return rows.map((row) => row.log_date);
}

/** Every completed (habit, date) pair, for streak computation across habits. */
export async function listCompletedPairs(): Promise<{ habitId: string; date: DateKey }[]> {
  const rows = await db().all<{ habit_id: string; log_date: string }>(
    'SELECT habit_id, log_date FROM habit_logs WHERE completed = 1 ORDER BY log_date',
  );
  return rows.map((row) => ({ habitId: row.habit_id, date: row.log_date }));
}

/** Records today's value. `completed` is fixed at log time against the current target. */
export async function setHabitValue(habit: Habit, date: DateKey, value: number): Promise<void> {
  const safe = Math.max(0, Math.min(value, habit.targetValue * 100));
  const now = Date.now();
  if (safe === 0) {
    await db().run('DELETE FROM habit_logs WHERE habit_id = ? AND log_date = ?', [habit.id, date]);
  } else {
    await db().run(
      `INSERT INTO habit_logs (habit_id, log_date, value, completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(habit_id, log_date) DO UPDATE SET value = excluded.value, completed = excluded.completed,
         updated_at = excluded.updated_at`,
      [habit.id, date, safe, flag(safe >= habit.targetValue), now, now],
    );
  }
  notifyChange('habit_logs');
}

export async function toggleHabit(habit: Habit, date: DateKey, currentlyDone: boolean): Promise<void> {
  await setHabitValue(habit, date, currentlyDone ? 0 : habit.targetValue);
}

export async function incrementHabit(habit: Habit, date: DateKey, currentValue: number): Promise<void> {
  const step = habit.increment ?? 1;
  await setHabitValue(habit, date, currentValue + step);
}
