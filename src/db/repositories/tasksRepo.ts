/**
 * Tasks and subtasks.
 *
 * Recurring tasks use the "next instance" model common to task managers:
 * completing one instance records it as done (preserving history for streaks
 * and analytics) and creates the following instance with the next due date.
 * All instances share a `series_id`.
 */
import { addDays, type DateKey } from '@/lib/dates';
import { createId } from '@/lib/id';
import { nextOccurrence, parseRecurrence, serializeRecurrence } from '@/lib/recurrence';
import type { Category, Priority, Subtask, Task } from '@/types/models';

import { notifyChange } from '../changes';
import { db, type SQLValue } from '../driver';
import { bool, flag, isNumber, parseJsonArray, toJson } from '../json';

interface TaskRow {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  category: Category;
  due_date: string | null;
  due_minute: number | null;
  recurrence: string | null;
  reminder_offsets: string;
  popup_message: string | null;
  series_id: string | null;
  completed_at: number | null;
  completed_date: string | null;
  created_at: number;
  updated_at: number;
  subtask_total: number;
  subtask_done: number;
}

export type TaskInput = Pick<
  Task,
  'title' | 'notes' | 'priority' | 'category' | 'dueDate' | 'dueMinute' | 'recurrence' | 'reminderOffsets' | 'popupMessage'
>;

const SELECT_TASK = `
  SELECT t.*,
    (SELECT COUNT(*) FROM task_subtasks s WHERE s.task_id = t.id) AS subtask_total,
    (SELECT COUNT(*) FROM task_subtasks s WHERE s.task_id = t.id AND s.done = 1) AS subtask_done
  FROM tasks t`;

const PRIORITY_ORDER = `CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`;

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    priority: row.priority,
    category: row.category,
    dueDate: row.due_date,
    dueMinute: row.due_minute,
    recurrence: parseRecurrence(row.recurrence),
    reminderOffsets: parseJsonArray(row.reminder_offsets, isNumber),
    popupMessage: row.popup_message,
    seriesId: row.series_id,
    completedAt: row.completed_at,
    completedDate: row.completed_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subtaskTotal: row.subtask_total ?? 0,
    subtaskDone: row.subtask_done ?? 0,
  };
}

function inputParams(input: TaskInput): SQLValue[] {
  return [
    input.title,
    input.notes,
    input.priority,
    input.category,
    input.dueDate,
    input.dueDate ? input.dueMinute : null,
    serializeRecurrence(input.dueDate ? input.recurrence : null),
    toJson(input.dueDate ? input.reminderOffsets : []),
    input.popupMessage,
  ];
}

export async function getTask(id: string): Promise<Task | null> {
  const row = await db().first<TaskRow>(`${SELECT_TASK} WHERE t.id = ?`, [id]);
  return row ? mapTask(row) : null;
}

export async function listTasks(): Promise<Task[]> {
  const rows = await db().all<TaskRow>(
    `${SELECT_TASK} ORDER BY t.completed_at IS NOT NULL, t.due_date IS NULL, t.due_date, t.due_minute IS NULL, t.due_minute, ${PRIORITY_ORDER}`,
  );
  return rows.map(mapTask);
}

export async function listOpenTasksDueBy(date: DateKey): Promise<Task[]> {
  const rows = await db().all<TaskRow>(
    `${SELECT_TASK} WHERE t.completed_at IS NULL AND t.due_date IS NOT NULL AND t.due_date <= ?
     ORDER BY t.due_date, t.due_minute IS NULL, t.due_minute, ${PRIORITY_ORDER}`,
    [date],
  );
  return rows.map(mapTask);
}

/** Tasks relevant to one day: due that day, or completed that day. */
export async function listTasksForDate(date: DateKey): Promise<Task[]> {
  const rows = await db().all<TaskRow>(
    `${SELECT_TASK} WHERE t.due_date = ? OR t.completed_date = ?
     ORDER BY t.completed_at IS NOT NULL, t.due_minute IS NULL, t.due_minute, ${PRIORITY_ORDER}`,
    [date, date],
  );
  return rows.map(mapTask);
}

export async function listTasksInRange(from: DateKey, to: DateKey): Promise<Task[]> {
  const rows = await db().all<TaskRow>(
    `${SELECT_TASK} WHERE t.due_date BETWEEN ? AND ? ORDER BY t.due_date, t.due_minute`,
    [from, to],
  );
  return rows.map(mapTask);
}

export async function createTask(input: TaskInput): Promise<Task> {
  const id = createId('tsk');
  const now = Date.now();
  const seriesId = input.recurrence && input.dueDate ? id : null;
  await db().run(
    `INSERT INTO tasks (title, notes, priority, category, due_date, due_minute, recurrence, reminder_offsets,
       popup_message, id, series_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...inputParams(input), id, seriesId, now, now],
  );
  notifyChange('tasks');
  const created = await getTask(id);
  if (!created) throw new Error('Task was not saved');
  return created;
}

export async function updateTask(id: string, input: TaskInput): Promise<void> {
  await db().run(
    `UPDATE tasks SET title = ?, notes = ?, priority = ?, category = ?, due_date = ?, due_minute = ?,
       recurrence = ?, reminder_offsets = ?, popup_message = ?,
       series_id = CASE WHEN ? IS NULL THEN NULL ELSE COALESCE(series_id, id) END,
       updated_at = ? WHERE id = ?`,
    [...inputParams(input), serializeRecurrence(input.dueDate ? input.recurrence : null), Date.now(), id],
  );
  notifyChange('tasks');
}

export async function deleteTask(id: string): Promise<void> {
  await db().run('DELETE FROM tasks WHERE id = ?', [id]);
  notifyChange('tasks', 'task_subtasks');
}

export interface CompletionResult {
  nextTaskId: string | null;
}

/**
 * Marks a task done/undone. Completing a recurring task spawns the next
 * instance (once — re-completing after an undo will not create duplicates
 * because the spawned instance is looked up by series and due date).
 */
export async function setTaskCompleted(id: string, completed: boolean, today: DateKey): Promise<CompletionResult> {
  const task = await getTask(id);
  if (!task) return { nextTaskId: null };
  let nextTaskId: string | null = null;
  await db().transaction(async () => {
    await db().run('UPDATE tasks SET completed_at = ?, completed_date = ?, updated_at = ? WHERE id = ?', [
      completed ? Date.now() : null,
      completed ? today : null,
      Date.now(),
      id,
    ]);
    if (completed && task.recurrence && task.dueDate) {
      const next = nextOccurrence(task.dueDate, task.recurrence, addDays(task.dueDate, 1));
      if (next) {
        const seriesId = task.seriesId ?? task.id;
        const existing = await db().first<{ id: string }>(
          'SELECT id FROM tasks WHERE series_id = ? AND due_date = ?',
          [seriesId, next],
        );
        if (existing) {
          nextTaskId = existing.id;
        } else {
          nextTaskId = createId('tsk');
          const now = Date.now();
          await db().run(
            `INSERT INTO tasks (id, title, notes, priority, category, due_date, due_minute, recurrence,
               reminder_offsets, popup_message, series_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              nextTaskId,
              task.title,
              task.notes,
              task.priority,
              task.category,
              next,
              task.dueMinute,
              serializeRecurrence(task.recurrence),
              toJson(task.reminderOffsets),
              task.popupMessage,
              seriesId,
              now,
              now,
            ],
          );
          const subtasks = await listSubtasks(id);
          for (const subtask of subtasks) {
            await db().run(
              'INSERT INTO task_subtasks (id, task_id, title, done, position, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?)',
              [createId('sub'), nextTaskId, subtask.title, subtask.position, now, now],
            );
          }
        }
      }
    }
  });
  notifyChange('tasks', 'task_subtasks');
  return { nextTaskId };
}

export async function rescheduleTasks(ids: string[], date: DateKey, minute: number | null = null): Promise<void> {
  if (ids.length === 0) return;
  await db().transaction(async () => {
    for (const id of ids) {
      await db().run(
        'UPDATE tasks SET due_date = ?, due_minute = COALESCE(?, due_minute), updated_at = ? WHERE id = ?',
        [date, minute, Date.now(), id],
      );
    }
  });
  notifyChange('tasks');
}

export async function searchTasks(query: string, limit = 30): Promise<Task[]> {
  const like = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const rows = await db().all<TaskRow>(
    `${SELECT_TASK} WHERE t.title LIKE ? ESCAPE '\\' OR t.notes LIKE ? ESCAPE '\\' ORDER BY t.updated_at DESC LIMIT ?`,
    [like, like, limit],
  );
  return rows.map(mapTask);
}

// ── Subtasks ────────────────────────────────────────────────────────────────

interface SubtaskRow {
  id: string;
  task_id: string;
  title: string;
  done: number;
  position: number;
}

const mapSubtask = (row: SubtaskRow): Subtask => ({
  id: row.id,
  taskId: row.task_id,
  title: row.title,
  done: bool(row.done),
  position: row.position,
});

export async function listSubtasks(taskId: string): Promise<Subtask[]> {
  const rows = await db().all<SubtaskRow>('SELECT * FROM task_subtasks WHERE task_id = ? ORDER BY position, created_at', [
    taskId,
  ]);
  return rows.map(mapSubtask);
}

export async function addSubtask(taskId: string, title: string): Promise<void> {
  const now = Date.now();
  const row = await db().first<{ next: number }>(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM task_subtasks WHERE task_id = ?',
    [taskId],
  );
  await db().run(
    'INSERT INTO task_subtasks (id, task_id, title, done, position, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?)',
    [createId('sub'), taskId, title, row?.next ?? 0, now, now],
  );
  notifyChange('task_subtasks', 'tasks');
}

export async function setSubtaskDone(id: string, done: boolean): Promise<void> {
  await db().run('UPDATE task_subtasks SET done = ?, updated_at = ? WHERE id = ?', [flag(done), Date.now(), id]);
  notifyChange('task_subtasks', 'tasks');
}

export async function deleteSubtask(id: string): Promise<void> {
  await db().run('DELETE FROM task_subtasks WHERE id = ?', [id]);
  notifyChange('task_subtasks', 'tasks');
}
