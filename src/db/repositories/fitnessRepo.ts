/**
 * Fitness: exercise library, workout plans, live/past sessions, sets,
 * body metrics and hydration.
 *
 * A session with `ended_at IS NULL` is the active workout. Because it lives
 * in the database (not in memory) the workout resumes exactly where it was
 * after the app is closed or killed; elapsed time is derived from
 * `started_at`, never from a running timer.
 */
import type { DateKey } from '@/lib/dates';
import { createId } from '@/lib/id';
import type { BodyMetric, Exercise, ExerciseSet, WorkoutPlan, WorkoutPlanExercise, WorkoutSession } from '@/types/models';

import { notifyChange } from '../changes';
import { db } from '../driver';
import { bool } from '../json';

interface ExerciseRow {
  id: string;
  name: string;
  muscle_group: string;
  is_custom: number;
}

const mapExercise = (row: ExerciseRow): Exercise => ({
  id: row.id,
  name: row.name,
  muscleGroup: row.muscle_group,
  isCustom: bool(row.is_custom),
});

/** Built-in library, inserted once. Users can add custom exercises. */
const LIBRARY: [string, string][] = [
  ['Barbell Bench Press', 'chest'],
  ['Incline Dumbbell Press', 'chest'],
  ['Push-Up', 'chest'],
  ['Cable Fly', 'chest'],
  ['Pull-Up', 'back'],
  ['Lat Pulldown', 'back'],
  ['Barbell Row', 'back'],
  ['Seated Cable Row', 'back'],
  ['Deadlift', 'back'],
  ['Back Squat', 'legs'],
  ['Leg Press', 'legs'],
  ['Romanian Deadlift', 'legs'],
  ['Bulgarian Split Squat', 'legs'],
  ['Walking Lunge', 'legs'],
  ['Calf Raise', 'legs'],
  ['Overhead Press', 'shoulders'],
  ['Lateral Raise', 'shoulders'],
  ['Face Pull', 'shoulders'],
  ['Barbell Curl', 'arms'],
  ['Hammer Curl', 'arms'],
  ['Tricep Pushdown', 'arms'],
  ['Dips', 'arms'],
  ['Plank', 'core'],
  ['Hanging Leg Raise', 'core'],
  ['Cable Crunch', 'core'],
  ['Running', 'cardio'],
  ['Cycling', 'cardio'],
  ['Rowing Machine', 'cardio'],
  ['Jump Rope', 'cardio'],
];

export async function seedExerciseLibrary(): Promise<void> {
  const row = await db().first<{ count: number }>('SELECT COUNT(*) AS count FROM exercises WHERE is_custom = 0');
  if ((row?.count ?? 0) > 0) return;
  const now = Date.now();
  await db().transaction(async () => {
    for (const [name, group] of LIBRARY) {
      await db().run(
        `INSERT INTO exercises (id, name, muscle_group, is_custom, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)
         ON CONFLICT DO NOTHING`,
        [createId('exe'), name, group, now, now],
      );
    }
  });
  notifyChange('exercises');
}

export async function listExercises(): Promise<Exercise[]> {
  const rows = await db().all<ExerciseRow>('SELECT * FROM exercises ORDER BY muscle_group, name COLLATE NOCASE');
  return rows.map(mapExercise);
}

export async function createExercise(name: string, muscleGroup: string): Promise<Exercise> {
  const existing = await db().first<ExerciseRow>('SELECT * FROM exercises WHERE name = ? COLLATE NOCASE', [name]);
  if (existing) return mapExercise(existing);
  const id = createId('exe');
  const now = Date.now();
  await db().run(
    'INSERT INTO exercises (id, name, muscle_group, is_custom, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
    [id, name, muscleGroup, now, now],
  );
  notifyChange('exercises');
  return { id, name, muscleGroup, isCustom: true };
}

// ── Plans ───────────────────────────────────────────────────────────────────

interface PlanExerciseRow extends ExerciseRow {
  pe_id: string;
  plan_id: string;
  position: number;
  target_sets: number;
  target_reps: number;
  target_weight: number | null;
  rest_seconds: number;
}

export async function listPlans(): Promise<WorkoutPlan[]> {
  const plans = await db().all<{ id: string; name: string; notes: string | null }>(
    'SELECT id, name, notes FROM workout_plans ORDER BY position, created_at',
  );
  const items = await db().all<PlanExerciseRow>(
    `SELECT pe.id AS pe_id, pe.plan_id, pe.position, pe.target_sets, pe.target_reps, pe.target_weight, pe.rest_seconds,
            e.id, e.name, e.muscle_group, e.is_custom
     FROM workout_plan_exercises pe JOIN exercises e ON e.id = pe.exercise_id ORDER BY pe.position`,
  );
  return plans.map((plan) => ({
    ...plan,
    exercises: items
      .filter((item) => item.plan_id === plan.id)
      .map(
        (item): WorkoutPlanExercise => ({
          id: item.pe_id,
          planId: item.plan_id,
          exercise: mapExercise(item),
          position: item.position,
          targetSets: item.target_sets,
          targetReps: item.target_reps,
          targetWeight: item.target_weight,
          restSeconds: item.rest_seconds,
        }),
      ),
  }));
}

export async function getPlan(id: string): Promise<WorkoutPlan | null> {
  return (await listPlans()).find((plan) => plan.id === id) ?? null;
}

export interface PlanExerciseInput {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number | null;
  restSeconds: number;
}

export async function savePlan(
  id: string | null,
  name: string,
  notes: string | null,
  exercises: PlanExerciseInput[],
): Promise<string> {
  const planId = id ?? createId('pln');
  const now = Date.now();
  await db().transaction(async () => {
    if (id) {
      await db().run('UPDATE workout_plans SET name = ?, notes = ?, updated_at = ? WHERE id = ?', [name, notes, now, id]);
      await db().run('DELETE FROM workout_plan_exercises WHERE plan_id = ?', [id]);
    } else {
      await db().run(
        'INSERT INTO workout_plans (id, name, notes, position, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
        [planId, name, notes, now, now],
      );
    }
    for (const [position, item] of exercises.entries()) {
      await db().run(
        `INSERT INTO workout_plan_exercises (id, plan_id, exercise_id, position, target_sets, target_reps, target_weight,
           rest_seconds, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [createId('pex'), planId, item.exerciseId, position, item.targetSets, item.targetReps, item.targetWeight, item.restSeconds, now, now],
      );
    }
  });
  notifyChange('workout_plans', 'workout_plan_exercises');
  return planId;
}

export async function deletePlan(id: string): Promise<void> {
  await db().run('DELETE FROM workout_plans WHERE id = ?', [id]);
  notifyChange('workout_plans', 'workout_plan_exercises');
}

// ── Sessions & sets ─────────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  plan_id: string | null;
  name: string;
  session_date: string;
  started_at: number;
  ended_at: number | null;
  notes: string | null;
}

const mapSession = (row: SessionRow): WorkoutSession => ({
  id: row.id,
  planId: row.plan_id,
  name: row.name,
  date: row.session_date,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  notes: row.notes,
});

interface SetRow {
  id: string;
  session_id: string;
  exercise_id: string;
  set_index: number;
  reps: number;
  weight: number;
  completed_at: number | null;
}

const mapSet = (row: SetRow): ExerciseSet => ({
  id: row.id,
  sessionId: row.session_id,
  exerciseId: row.exercise_id,
  setIndex: row.set_index,
  reps: row.reps,
  weight: row.weight,
  completedAt: row.completed_at,
});

export async function getActiveSession(): Promise<WorkoutSession | null> {
  const row = await db().first<SessionRow>(
    'SELECT * FROM workout_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
  );
  return row ? mapSession(row) : null;
}

export async function getSession(id: string): Promise<WorkoutSession | null> {
  const row = await db().first<SessionRow>('SELECT * FROM workout_sessions WHERE id = ?', [id]);
  return row ? mapSession(row) : null;
}

export async function startSession(name: string, planId: string | null, date: DateKey): Promise<string> {
  const active = await getActiveSession();
  if (active) return active.id;
  const id = createId('wks');
  const now = Date.now();
  await db().run(
    `INSERT INTO workout_sessions (id, plan_id, name, session_date, started_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, planId, name, date, now, now, now],
  );
  notifyChange('workout_sessions');
  return id;
}

export async function finishSession(id: string, notes: string | null): Promise<void> {
  const now = Date.now();
  await db().run('UPDATE workout_sessions SET ended_at = ?, notes = ?, updated_at = ? WHERE id = ? AND ended_at IS NULL', [
    now,
    notes,
    now,
    id,
  ]);
  notifyChange('workout_sessions');
}

export async function discardSession(id: string): Promise<void> {
  await db().run('DELETE FROM workout_sessions WHERE id = ?', [id]);
  notifyChange('workout_sessions', 'exercise_sets');
}

export async function listSessionSets(sessionId: string): Promise<ExerciseSet[]> {
  const rows = await db().all<SetRow>('SELECT * FROM exercise_sets WHERE session_id = ? ORDER BY exercise_id, set_index', [
    sessionId,
  ]);
  return rows.map(mapSet);
}

export async function logSet(sessionId: string, exerciseId: string, reps: number, weight: number): Promise<void> {
  const next = await db().first<{ next: number }>(
    'SELECT COALESCE(MAX(set_index), 0) + 1 AS next FROM exercise_sets WHERE session_id = ? AND exercise_id = ?',
    [sessionId, exerciseId],
  );
  const now = Date.now();
  await db().run(
    `INSERT INTO exercise_sets (id, session_id, exercise_id, set_index, reps, weight, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [createId('set'), sessionId, exerciseId, next?.next ?? 1, reps, weight, now, now, now],
  );
  notifyChange('exercise_sets');
}

export async function deleteSet(id: string): Promise<void> {
  await db().run('DELETE FROM exercise_sets WHERE id = ?', [id]);
  notifyChange('exercise_sets');
}

export interface SessionSummary extends WorkoutSession {
  setCount: number;
  volume: number;
}

export async function listCompletedSessions(limit = 30): Promise<SessionSummary[]> {
  const rows = await db().all<SessionRow & { set_count: number; volume: number }>(
    `SELECT w.*, COUNT(s.id) AS set_count, COALESCE(SUM(s.reps * s.weight), 0) AS volume
     FROM workout_sessions w LEFT JOIN exercise_sets s ON s.session_id = w.id
     WHERE w.ended_at IS NOT NULL GROUP BY w.id ORDER BY w.started_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map((row) => ({ ...mapSession(row), setCount: row.set_count, volume: row.volume }));
}

export async function listSessionsInRange(from: DateKey, to: DateKey): Promise<WorkoutSession[]> {
  const rows = await db().all<SessionRow>(
    'SELECT * FROM workout_sessions WHERE ended_at IS NOT NULL AND session_date BETWEEN ? AND ? ORDER BY started_at',
    [from, to],
  );
  return rows.map(mapSession);
}

export interface PersonalRecord {
  exerciseId: string;
  name: string;
  weight: number;
  reps: number;
  date: DateKey;
}

/** Heaviest completed set per exercise (ties broken by reps, then earliest). */
export async function listPersonalRecords(): Promise<PersonalRecord[]> {
  const rows = await db().all<{ exercise_id: string; name: string; weight: number; reps: number; session_date: string }>(
    `SELECT s.exercise_id, e.name, s.weight, s.reps, w.session_date
     FROM exercise_sets s
     JOIN exercises e ON e.id = s.exercise_id
     JOIN workout_sessions w ON w.id = s.session_id
     WHERE w.ended_at IS NOT NULL AND s.weight > 0
     ORDER BY s.exercise_id, s.weight DESC, s.reps DESC, w.started_at ASC`,
  );
  const seen = new Set<string>();
  const records: PersonalRecord[] = [];
  for (const row of rows) {
    if (seen.has(row.exercise_id)) continue;
    seen.add(row.exercise_id);
    records.push({ exerciseId: row.exercise_id, name: row.name, weight: row.weight, reps: row.reps, date: row.session_date });
  }
  return records.sort((a, b) => b.weight - a.weight);
}

export async function lastSetFor(exerciseId: string): Promise<{ reps: number; weight: number } | null> {
  return db().first<{ reps: number; weight: number }>(
    'SELECT reps, weight FROM exercise_sets WHERE exercise_id = ? ORDER BY completed_at DESC LIMIT 1',
    [exerciseId],
  );
}

// ── Body metrics ────────────────────────────────────────────────────────────

interface MetricRow {
  id: string;
  metric_date: string;
  weight: number | null;
  waist: number | null;
  chest: number | null;
  arms: number | null;
  body_fat: number | null;
}

const mapMetric = (row: MetricRow): BodyMetric => ({
  id: row.id,
  date: row.metric_date,
  weight: row.weight,
  waist: row.waist,
  chest: row.chest,
  arms: row.arms,
  bodyFat: row.body_fat,
});

export type BodyMetricInput = Omit<BodyMetric, 'id'>;

export async function listBodyMetrics(limit = 90): Promise<BodyMetric[]> {
  const rows = await db().all<MetricRow>('SELECT * FROM body_metrics ORDER BY metric_date DESC, created_at DESC LIMIT ?', [
    limit,
  ]);
  return rows.map(mapMetric);
}

export async function addBodyMetric(input: BodyMetricInput): Promise<void> {
  const now = Date.now();
  await db().run(
    `INSERT INTO body_metrics (id, metric_date, weight, waist, chest, arms, body_fat, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [createId('bdy'), input.date, input.weight, input.waist, input.chest, input.arms, input.bodyFat, now, now],
  );
  notifyChange('body_metrics');
}

export async function deleteBodyMetric(id: string): Promise<void> {
  await db().run('DELETE FROM body_metrics WHERE id = ?', [id]);
  notifyChange('body_metrics');
}

// ── Hydration ───────────────────────────────────────────────────────────────

export async function addHydration(date: DateKey, amountMl: number): Promise<void> {
  await db().run('INSERT INTO hydration_logs (id, log_date, amount_ml, logged_at) VALUES (?, ?, ?, ?)', [
    createId('h2o'),
    date,
    Math.round(amountMl),
    Date.now(),
  ]);
  notifyChange('hydration_logs');
}

export async function undoLastHydration(date: DateKey): Promise<void> {
  await db().run(
    'DELETE FROM hydration_logs WHERE id = (SELECT id FROM hydration_logs WHERE log_date = ? ORDER BY logged_at DESC LIMIT 1)',
    [date],
  );
  notifyChange('hydration_logs');
}

export async function hydrationTotal(date: DateKey): Promise<number> {
  const row = await db().first<{ total: number }>(
    'SELECT COALESCE(SUM(amount_ml), 0) AS total FROM hydration_logs WHERE log_date = ?',
    [date],
  );
  return row?.total ?? 0;
}

export async function hydrationByDay(from: DateKey, to: DateKey): Promise<Record<DateKey, number>> {
  const rows = await db().all<{ log_date: string; total: number }>(
    'SELECT log_date, SUM(amount_ml) AS total FROM hydration_logs WHERE log_date BETWEEN ? AND ? GROUP BY log_date',
    [from, to],
  );
  return Object.fromEntries(rows.map((row) => [row.log_date, row.total]));
}
