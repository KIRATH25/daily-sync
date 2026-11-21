/**
 * Table-level change notifications.
 *
 * Repositories call `notifyChange` after every committed write; screens
 * subscribe through `useLiveQuery` and re-read only when a table they depend
 * on changes. This keeps every screen in sync (e.g. completing a task on Home
 * updates Calendar, Insights and My Journey) without global re-renders.
 */

export type TableName =
  | 'preferences'
  | 'calendar_entries'
  | 'entry_completions'
  | 'tasks'
  | 'task_subtasks'
  | 'habits'
  | 'habit_logs'
  | 'day_reviews'
  | 'journal_entries'
  | 'subjects'
  | 'timetable_slots'
  | 'assignments'
  | 'attendance_records'
  | 'countdowns'
  | 'exercises'
  | 'workout_plans'
  | 'workout_plan_exercises'
  | 'workout_sessions'
  | 'exercise_sets'
  | 'body_metrics'
  | 'hydration_logs'
  | 'focus_sessions'
  | 'custom_themes'
  | 'notification_records'
  | 'inbox_items'
  | 'daily_quote_history'
  | 'achievement_records';

type Listener = (tables: ReadonlySet<TableName>) => void;

const listeners = new Set<Listener>();
let pending = new Set<TableName>();
let scheduled = false;

/** Batches notifications within one tick so a transaction triggers one refresh. */
export function notifyChange(...tables: TableName[]): void {
  tables.forEach((table) => pending.add(table));
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    const changed = pending;
    pending = new Set();
    scheduled = false;
    listeners.forEach((listener) => {
      try {
        listener(changed);
      } catch (error) {
        console.error('Change listener failed', error);
      }
    });
  });
}

export function subscribeToChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Every table that holds user data, used by full refreshes (restore, reset). */
export const ALL_TABLES: TableName[] = [
  'preferences',
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
  'exercises',
  'workout_plans',
  'workout_plan_exercises',
  'workout_sessions',
  'exercise_sets',
  'body_metrics',
  'hydration_logs',
  'focus_sessions',
  'custom_themes',
  'notification_records',
  'inbox_items',
  'daily_quote_history',
  'achievement_records',
];
