/**
 * Versioned schema migrations, tracked with SQLite's `PRAGMA user_version`.
 *
 * Rules for future changes:
 *   - Never edit a migration that has shipped; append a new one.
 *   - Each migration runs inside a transaction together with the version
 *     bump, so a crash mid-migration leaves the previous version intact.
 *
 * Conventions: TEXT ids, `*_date` columns are local `YYYY-MM-DD` date keys,
 * `*_minute` columns are minutes since local midnight, `*_at` columns are
 * epoch milliseconds. JSON arrays are stored as TEXT.
 */
import type { DbDriver } from './driver';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

const PRIORITY_CHECK = "CHECK (priority IN ('critical','high','medium','low'))";

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
CREATE TABLE preferences (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  muscle_group TEXT NOT NULL DEFAULT 'full_body',
  is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_exercises_name ON exercises(name COLLATE NOCASE);

CREATE TABLE workout_plans (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE workout_plan_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  target_sets INTEGER NOT NULL DEFAULT 3 CHECK (target_sets BETWEEN 1 AND 30),
  target_reps INTEGER NOT NULL DEFAULT 10 CHECK (target_reps BETWEEN 0 AND 1000),
  target_weight REAL CHECK (target_weight IS NULL OR target_weight BETWEEN 0 AND 700),
  rest_seconds INTEGER NOT NULL DEFAULT 90 CHECK (rest_seconds BETWEEN 0 AND 900),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_plan_exercises_plan ON workout_plan_exercises(plan_id, position);

CREATE TABLE calendar_entries (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('event','reminder','note','goal','workout')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description TEXT,
  category TEXT NOT NULL DEFAULT 'personal',
  color TEXT,
  priority TEXT ${PRIORITY_CHECK},
  location TEXT,
  all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0,1)),
  start_date TEXT NOT NULL,
  start_minute INTEGER CHECK (start_minute IS NULL OR start_minute BETWEEN 0 AND 1439),
  end_minute INTEGER CHECK (end_minute IS NULL OR end_minute BETWEEN 1 AND 1440),
  recurrence TEXT,
  exception_dates TEXT NOT NULL DEFAULT '[]',
  reminder_offsets TEXT NOT NULL DEFAULT '[]',
  popup_message TEXT,
  workout_plan_id TEXT REFERENCES workout_plans(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (end_minute IS NULL OR start_minute IS NULL OR end_minute > start_minute)
);
CREATE INDEX idx_entries_start ON calendar_entries(start_date);
CREATE INDEX idx_entries_recurring ON calendar_entries(start_date) WHERE recurrence IS NOT NULL;

CREATE TABLE entry_completions (
  entry_id TEXT NOT NULL REFERENCES calendar_entries(id) ON DELETE CASCADE,
  occurrence_date TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  completed_date TEXT NOT NULL,
  PRIMARY KEY (entry_id, occurrence_date)
);
CREATE INDEX idx_entry_completions_date ON entry_completions(completed_date);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  notes TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' ${PRIORITY_CHECK},
  category TEXT NOT NULL DEFAULT 'personal',
  due_date TEXT,
  due_minute INTEGER CHECK (due_minute IS NULL OR due_minute BETWEEN 0 AND 1439),
  recurrence TEXT,
  reminder_offsets TEXT NOT NULL DEFAULT '[]',
  popup_message TEXT,
  series_id TEXT,
  completed_at INTEGER,
  completed_date TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (due_minute IS NULL OR due_date IS NOT NULL)
);
CREATE INDEX idx_tasks_due ON tasks(due_date, due_minute);
CREATE INDEX idx_tasks_completed ON tasks(completed_date);

CREATE TABLE task_subtasks (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1)),
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_subtasks_task ON task_subtasks(task_id, position);

CREATE TABLE habits (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  icon TEXT NOT NULL DEFAULT 'sparkles',
  color TEXT,
  target_value REAL NOT NULL DEFAULT 1 CHECK (target_value > 0),
  unit TEXT,
  increment REAL CHECK (increment IS NULL OR increment > 0),
  schedule_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  weekly_target INTEGER CHECK (weekly_target IS NULL OR weekly_target BETWEEN 1 AND 7),
  reminder_minute INTEGER CHECK (reminder_minute IS NULL OR reminder_minute BETWEEN 0 AND 1439),
  notes TEXT,
  paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0,1)),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  position INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE habit_logs (
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0 CHECK (value >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (habit_id, log_date)
);
CREATE INDEX idx_habit_logs_date ON habit_logs(log_date);

CREATE TABLE day_reviews (
  review_date TEXT PRIMARY KEY NOT NULL,
  mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
  tags TEXT NOT NULL DEFAULT '[]',
  remark TEXT,
  gratitude TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  entry_date TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_journal_date ON journal_entries(entry_date);

CREATE TABLE subjects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  code TEXT,
  professor TEXT,
  color TEXT,
  attendance_target INTEGER NOT NULL DEFAULT 75 CHECK (attendance_target BETWEEN 0 AND 100),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE timetable_slots (
  id TEXT PRIMARY KEY NOT NULL,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute INTEGER NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  room TEXT,
  slot_type TEXT NOT NULL DEFAULT 'lecture' CHECK (slot_type IN ('lecture','lab','tutorial','seminar')),
  reminder_offset INTEGER CHECK (reminder_offset IS NULL OR reminder_offset BETWEEN 0 AND 240),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (end_minute > start_minute)
);
CREATE INDEX idx_slots_weekday ON timetable_slots(weekday, start_minute);

CREATE TABLE assignments (
  id TEXT PRIMARY KEY NOT NULL,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'assignment' CHECK (kind IN ('assignment','exam','quiz','project')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  notes TEXT,
  due_date TEXT NOT NULL,
  due_minute INTEGER CHECK (due_minute IS NULL OR due_minute BETWEEN 0 AND 1439),
  reminder_offsets TEXT NOT NULL DEFAULT '[]',
  completed_at INTEGER,
  completed_date TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_assignments_due ON assignments(due_date);

CREATE TABLE attendance_records (
  slot_id TEXT NOT NULL REFERENCES timetable_slots(id) ON DELETE CASCADE,
  class_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','cancelled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (slot_id, class_date)
);
CREATE INDEX idx_attendance_date ON attendance_records(class_date);

CREATE TABLE countdowns (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  subtitle TEXT,
  target_date TEXT NOT NULL,
  target_minute INTEGER NOT NULL DEFAULT 0 CHECK (target_minute BETWEEN 0 AND 1439),
  style TEXT NOT NULL DEFAULT 'minimal' CHECK (style IN ('minimal','digital','cinematic','editorial','aurora','custom')),
  accent TEXT,
  background_uri TEXT,
  message TEXT,
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
  show_seconds INTEGER NOT NULL DEFAULT 1 CHECK (show_seconds IN (0,1)),
  reminder_offsets TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE workout_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT REFERENCES workout_plans(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  session_date TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX idx_sessions_date ON workout_sessions(session_date);
CREATE INDEX idx_sessions_active ON workout_sessions(ended_at) WHERE ended_at IS NULL;

CREATE TABLE exercise_sets (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_index INTEGER NOT NULL,
  reps INTEGER NOT NULL CHECK (reps BETWEEN 0 AND 1000),
  weight REAL NOT NULL DEFAULT 0 CHECK (weight BETWEEN 0 AND 700),
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_sets_session ON exercise_sets(session_id, exercise_id, set_index);
CREATE INDEX idx_sets_exercise ON exercise_sets(exercise_id);

CREATE TABLE body_metrics (
  id TEXT PRIMARY KEY NOT NULL,
  metric_date TEXT NOT NULL,
  weight REAL CHECK (weight IS NULL OR weight BETWEEN 20 AND 400),
  waist REAL,
  chest REAL,
  arms REAL,
  body_fat REAL CHECK (body_fat IS NULL OR body_fat BETWEEN 2 AND 75),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_body_date ON body_metrics(metric_date);

CREATE TABLE hydration_logs (
  id TEXT PRIMARY KEY NOT NULL,
  log_date TEXT NOT NULL,
  amount_ml INTEGER NOT NULL CHECK (amount_ml BETWEEN 1 AND 5000),
  logged_at INTEGER NOT NULL
);
CREATE INDEX idx_hydration_date ON hydration_logs(log_date);

CREATE TABLE focus_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('focus','short_break','long_break','stopwatch')),
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  label TEXT,
  planned_seconds INTEGER,
  actual_seconds INTEGER NOT NULL CHECK (actual_seconds >= 0),
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  session_date TEXT NOT NULL
);
CREATE INDEX idx_focus_date ON focus_sessions(session_date);

CREATE TABLE custom_themes (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  base_preset TEXT NOT NULL,
  accent TEXT,
  background TEXT,
  surface TEXT,
  highlight TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE notification_records (
  id TEXT PRIMARY KEY NOT NULL,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  schedule_key TEXT NOT NULL UNIQUE,
  fire_at INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  route TEXT,
  category TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_notif_owner ON notification_records(owner_type, owner_id);
CREATE INDEX idx_notif_fire ON notification_records(fire_at);

CREATE TABLE inbox_items (
  id TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  route TEXT,
  source_key TEXT UNIQUE,
  occurred_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX idx_inbox_time ON inbox_items(occurred_at);

CREATE TABLE daily_quote_history (
  shown_date TEXT PRIMARY KEY NOT NULL,
  quote_id TEXT NOT NULL,
  shown_at INTEGER NOT NULL
);

CREATE TABLE achievement_records (
  id TEXT PRIMARY KEY NOT NULL,
  achievement_id TEXT NOT NULL UNIQUE,
  earned_date TEXT NOT NULL,
  milestone_value INTEGER NOT NULL,
  earned_at INTEGER NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0 CHECK (seen IN (0,1))
);
`,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

export async function runMigrations(driver: DbDriver): Promise<number> {
  const row = await driver.first<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema v${current} is newer than this app (v${LATEST_SCHEMA_VERSION}). Update Daily Sync to continue.`,
    );
  }
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await driver.transaction(async () => {
      await driver.exec(migration.sql);
      // PRAGMA cannot be parameterised; version is a trusted integer literal.
      await driver.exec(`PRAGMA user_version = ${Math.trunc(migration.version)}`);
    });
  }
  return LATEST_SCHEMA_VERSION;
}
