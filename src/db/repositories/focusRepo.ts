import type { DateKey } from '@/lib/dates';
import { createId } from '@/lib/id';
import type { FocusMode, FocusSession } from '@/types/models';

import { notifyChange } from '../changes';
import { db } from '../driver';
import { bool, flag } from '../json';

interface FocusRow {
  id: string;
  mode: FocusMode;
  task_id: string | null;
  label: string | null;
  planned_seconds: number | null;
  actual_seconds: number;
  started_at: number;
  ended_at: number;
  completed: number;
  session_date: string;
}

const mapFocus = (row: FocusRow): FocusSession => ({
  id: row.id,
  mode: row.mode,
  taskId: row.task_id,
  label: row.label,
  plannedSeconds: row.planned_seconds,
  actualSeconds: row.actual_seconds,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  completed: bool(row.completed),
  date: row.session_date,
});

export type FocusSessionInput = Omit<FocusSession, 'id'>;

export async function recordFocusSession(input: FocusSessionInput): Promise<void> {
  if (input.actualSeconds < 1) return;
  await db().run(
    `INSERT INTO focus_sessions (id, mode, task_id, label, planned_seconds, actual_seconds, started_at, ended_at,
       completed, session_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createId('fcs'),
      input.mode,
      input.taskId,
      input.label,
      input.plannedSeconds,
      Math.round(input.actualSeconds),
      input.startedAt,
      input.endedAt,
      flag(input.completed),
      input.date,
    ],
  );
  notifyChange('focus_sessions');
}

export async function listFocusSessions(from: DateKey, to: DateKey): Promise<FocusSession[]> {
  const rows = await db().all<FocusRow>(
    'SELECT * FROM focus_sessions WHERE session_date BETWEEN ? AND ? ORDER BY started_at DESC',
    [from, to],
  );
  return rows.map(mapFocus);
}

/** Seconds of focus (not breaks) per day. */
export async function focusSecondsByDay(from: DateKey, to: DateKey): Promise<Record<DateKey, number>> {
  const rows = await db().all<{ session_date: string; total: number }>(
    `SELECT session_date, SUM(actual_seconds) AS total FROM focus_sessions
     WHERE mode IN ('focus','stopwatch') AND session_date BETWEEN ? AND ? GROUP BY session_date`,
    [from, to],
  );
  return Object.fromEntries(rows.map((row) => [row.session_date, row.total]));
}

export async function deleteFocusSession(id: string): Promise<void> {
  await db().run('DELETE FROM focus_sessions WHERE id = ?', [id]);
  notifyChange('focus_sessions');
}
