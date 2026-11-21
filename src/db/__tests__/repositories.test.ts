import { normalizeActiveDates, computeJourneyStats } from '@/lib/journey';
import { evaluateAchievements } from '@/lib/achievements';

import { setDriver } from '../driver';
import { LATEST_SCHEMA_VERSION, runMigrations } from '../migrations';
import { insertEarned, listAchievementRecords } from '../repositories/achievementsRepo';
import { listActiveDates, taskCountsByDay } from '../repositories/activityRepo';
import { eraseAllData, exportBackup, parseBackup, restoreBackup, RestoreFailure } from '../repositories/backupRepo';
import {
  createEntry,
  deleteEntry,
  duplicateEntry,
  getEntry,
  listOccurrences,
  rescheduleEntry,
  searchEntries,
  setEntryCompleted,
  skipOccurrence,
  updateEntry,
  type EntryInput,
} from '../repositories/entriesRepo';
import { createHabit, listCompletedDates, setHabitValue, toggleHabit } from '../repositories/habitsRepo';
import { getReview, listReviews, saveReview } from '../repositories/reviewsRepo';
import {
  addSubtask,
  createTask,
  deleteTask,
  getTask,
  listSubtasks,
  listTasks,
  setSubtaskDone,
  setTaskCompleted,
  updateTask,
  type TaskInput,
} from '../repositories/tasksRepo';
import { recordQuoteShown, wasQuoteShown } from '../repositories/quotesRepo';
import { createNodeDriver } from './nodeDriver';

const baseEntry: EntryInput = {
  kind: 'event',
  title: 'Macroeconomics Lecture',
  description: null,
  category: 'academics',
  color: null,
  priority: null,
  location: 'Hall 4B',
  allDay: false,
  startDate: '2025-11-17',
  startMinute: 9 * 60,
  endMinute: 10 * 60 + 30,
  recurrence: null,
  exceptionDates: [],
  reminderOffsets: [15],
  popupMessage: null,
  workoutPlanId: null,
};

const baseTask: TaskInput = {
  title: 'Finish problem set',
  notes: null,
  priority: 'high',
  category: 'academics',
  dueDate: '2025-11-21',
  dueMinute: 18 * 60,
  recurrence: null,
  reminderOffsets: [30],
  popupMessage: null,
};

let driver: ReturnType<typeof createNodeDriver>;

beforeEach(async () => {
  driver = createNodeDriver();
  setDriver(driver);
  await runMigrations(driver);
});

afterEach(() => {
  setDriver(null);
  driver.close();
});

describe('migrations', () => {
  it('sets the schema version and is idempotent', async () => {
    const version = await driver.first<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(LATEST_SCHEMA_VERSION);
    await expect(runMigrations(driver)).resolves.toBe(LATEST_SCHEMA_VERSION);
  });

  it('refuses to open a database from a newer app version', async () => {
    await driver.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    await expect(runMigrations(driver)).rejects.toThrow(/newer/);
  });

  it('enforces constraints', async () => {
    await expect(createEntry({ ...baseEntry, title: '' })).rejects.toThrow();
    await expect(createEntry({ ...baseEntry, startMinute: 600, endMinute: 540 })).rejects.toThrow();
  });
});

describe('calendar entries', () => {
  it('creates, reads, updates and deletes', async () => {
    const created = await createEntry(baseEntry);
    const loaded = await getEntry(created.id);
    expect(loaded).toMatchObject({ title: 'Macroeconomics Lecture', startMinute: 540, reminderOffsets: [15] });

    await updateEntry(created.id, { ...baseEntry, title: 'Fiscal Policy' });
    expect((await getEntry(created.id))?.title).toBe('Fiscal Policy');

    await deleteEntry(created.id);
    expect(await getEntry(created.id)).toBeNull();
  });

  it('stores all-day entries without times', async () => {
    const created = await createEntry({ ...baseEntry, allDay: true });
    const loaded = await getEntry(created.id);
    expect(loaded).toMatchObject({ allDay: true, startMinute: null, endMinute: null, startDate: '2025-11-17' });
  });

  it('expands recurring entries and tracks per-occurrence completion', async () => {
    const created = await createEntry({ ...baseEntry, recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] } });
    let week = await listOccurrences('2025-11-17', '2025-11-23');
    expect(week.map((o) => o.date)).toEqual(['2025-11-17', '2025-11-19', '2025-11-21']);

    await setEntryCompleted(created.id, '2025-11-19', true, '2025-11-19');
    week = await listOccurrences('2025-11-17', '2025-11-23');
    expect(week.map((o) => o.completed)).toEqual([false, true, false]);

    await skipOccurrence(created.id, '2025-11-21');
    week = await listOccurrences('2025-11-17', '2025-11-23');
    expect(week.map((o) => o.date)).toEqual(['2025-11-17', '2025-11-19']);
  });

  it('duplicates and reschedules preserving duration', async () => {
    const created = await createEntry(baseEntry);
    const copy = await duplicateEntry(created.id);
    expect(copy?.id).not.toBe(created.id);
    await rescheduleEntry(created.id, '2025-11-20', 14 * 60);
    expect(await getEntry(created.id)).toMatchObject({ startDate: '2025-11-20', startMinute: 840, endMinute: 930 });
  });

  it('treats search wildcards literally', async () => {
    await createEntry({ ...baseEntry, title: '100% focus' });
    await createEntry({ ...baseEntry, title: 'Other' });
    expect((await searchEntries('%')).map((e) => e.title)).toEqual(['100% focus']);
  });
});

describe('tasks', () => {
  it('handles CRUD and subtasks', async () => {
    const task = await createTask(baseTask);
    await addSubtask(task.id, 'Question 1');
    await addSubtask(task.id, 'Question 2');
    const subtasks = await listSubtasks(task.id);
    expect(subtasks.map((s) => s.title)).toEqual(['Question 1', 'Question 2']);
    const first = subtasks[0];
    if (first) await setSubtaskDone(first.id, true);
    expect(await getTask(task.id)).toMatchObject({ subtaskTotal: 2, subtaskDone: 1 });

    await updateTask(task.id, { ...baseTask, priority: 'critical' });
    expect((await getTask(task.id))?.priority).toBe('critical');

    await deleteTask(task.id);
    expect(await listTasks()).toHaveLength(0);
    expect(await listSubtasks(task.id)).toHaveLength(0);
  });

  it('spawns exactly one next instance for recurring tasks', async () => {
    const task = await createTask({ ...baseTask, recurrence: { freq: 'daily', interval: 1 } });
    await addSubtask(task.id, 'Step');
    const first = await setTaskCompleted(task.id, true, '2025-11-21');
    expect(first.nextTaskId).not.toBeNull();
    // Undo + redo must not create a duplicate.
    await setTaskCompleted(task.id, false, '2025-11-21');
    const second = await setTaskCompleted(task.id, true, '2025-11-21');
    expect(second.nextTaskId).toBe(first.nextTaskId);

    const all = await listTasks();
    expect(all).toHaveLength(2);
    const next = all.find((t) => t.id === first.nextTaskId);
    expect(next).toMatchObject({ dueDate: '2025-11-22', completedAt: null, subtaskTotal: 1, subtaskDone: 0 });
  });

  it('counts planned vs done per due day', async () => {
    const a = await createTask(baseTask);
    await createTask(baseTask);
    await setTaskCompleted(a.id, true, '2025-11-22');
    expect(await taskCountsByDay('2025-11-21', '2025-11-21')).toEqual({ '2025-11-21': { planned: 2, done: 1 } });
  });
});

describe('habits and mood', () => {
  it('stores individual daily habit logs', async () => {
    const habit = await createHabit(
      {
        title: 'Hydration',
        icon: 'droplet',
        color: null,
        targetValue: 3000,
        unit: 'ml',
        increment: 250,
        scheduleDays: [0, 1, 2, 3, 4, 5, 6],
        weeklyTarget: null,
        reminderMinute: null,
        notes: null,
      },
      '2025-11-01',
    );
    await setHabitValue(habit, '2025-11-20', 1500);
    await setHabitValue(habit, '2025-11-21', 3200);
    expect(await listCompletedDates(habit.id)).toEqual(['2025-11-21']);
    await toggleHabit(habit, '2025-11-21', true);
    expect(await listCompletedDates(habit.id)).toEqual([]);
  });

  it('allows only one mood per date while allowing edits', async () => {
    await saveReview('2025-11-21', { mood: 4, tags: ['productive', 'productive'], remark: 'Good day', gratitude: null });
    await saveReview('2025-11-21', { mood: 5, tags: ['peaceful'], remark: 'Even better', gratitude: 'Coffee' });
    const reviews = await listReviews('2025-11-01', '2025-11-30');
    expect(reviews).toHaveLength(1);
    expect(await getReview('2025-11-21')).toMatchObject({ mood: 5, tags: ['peaceful'], gratitude: 'Coffee' });
  });
});

describe('journey from real records', () => {
  it('derives active days only from qualifying activity', async () => {
    const task = await createTask(baseTask);
    await setTaskCompleted(task.id, true, '2025-11-20');
    await saveReview('2025-11-21', { mood: 3, tags: [], remark: null, gratitude: null });
    // An uncompleted task does not count.
    await createTask({ ...baseTask, dueDate: '2025-11-19' });
    const dates = await listActiveDates();
    expect(dates).toEqual(['2025-11-20', '2025-11-21']);
    expect(computeJourneyStats(dates, '2025-11-21')).toMatchObject({ activeDays: 2, currentStreak: 2 });

    const earned = evaluateAchievements(normalizeActiveDates(dates, '2025-11-21'), '2025-11-21');
    await insertEarned(earned);
    await insertEarned(earned); // second evaluation must not duplicate
    const records = await listAchievementRecords();
    expect(records.map((r) => r.achievementId)).toEqual(['first_step']);
    expect(records[0]?.earnedDate).toBe('2025-11-20');
  });
});

describe('daily quote history', () => {
  it('records once per date', async () => {
    expect(await wasQuoteShown('2025-11-21')).toBe(false);
    expect(await recordQuoteShown('2025-11-21', 'q1')).toBe(true);
    expect(await recordQuoteShown('2025-11-21', 'q2')).toBe(false);
    expect(await wasQuoteShown('2025-11-21')).toBe(true);
  });
});

describe('backup and restore', () => {
  it('round-trips data', async () => {
    const task = await createTask(baseTask);
    await addSubtask(task.id, 'Sub');
    await createEntry(baseEntry);
    await saveReview('2025-11-21', { mood: 4, tags: [], remark: 'ok', gratitude: null });

    const backup = JSON.stringify(await exportBackup());
    await eraseAllData();
    expect(await listTasks()).toHaveLength(0);

    const summary = await restoreBackup(parseBackup(backup));
    expect(summary.rows).toBeGreaterThanOrEqual(4);
    expect(await getTask(task.id)).toMatchObject({ title: 'Finish problem set', subtaskTotal: 1 });
    expect(await getReview('2025-11-21')).toMatchObject({ mood: 4 });
  });

  it('rejects foreign, malformed and newer files', () => {
    expect(() => parseBackup('not json')).toThrow(RestoreFailure);
    expect(() => parseBackup(JSON.stringify({ app: 'other', schemaVersion: 1, tables: {} }))).toThrow('restore.wrongApp');
    expect(() => parseBackup(JSON.stringify({ app: 'daily-sync', schemaVersion: 999, tables: {} }))).toThrow(
      'restore.newerVersion',
    );
  });

  it('rolls back completely on a bad row and ignores unknown columns', async () => {
    await createTask(baseTask);
    const bad = {
      app: 'daily-sync',
      schemaVersion: 1,
      exportedAt: '',
      tables: {
        tasks: [
          { id: 't1', title: 'Valid', priority: 'low', category: 'personal', created_at: 1, updated_at: 1, evil_column: 'x' },
          { id: 't2', title: '', priority: 'low', category: 'personal', created_at: 1, updated_at: 1 },
        ],
      },
    };
    await expect(restoreBackup(parseBackup(JSON.stringify(bad)))).rejects.toThrow('restore.corrupt');
    // Original data is untouched.
    const tasks = await listTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe('Finish problem set');
  });
});
