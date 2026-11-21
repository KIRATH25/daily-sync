/**
 * Reminder engine tests: the desired-schedule builder runs against a real
 * (in-memory) database, and the diff that drives the OS scheduler is
 * verified for idempotence and duplicate prevention.
 */
import { setDriver } from '@/db/driver';
import { runMigrations } from '@/db/migrations';
import { createNodeDriver } from '@/db/__tests__/nodeDriver';
import { createCountdown } from '@/db/repositories/countdownsRepo';
import { createEntry } from '@/db/repositories/entriesRepo';
import { saveReview } from '@/db/repositories/reviewsRepo';
import { createTask, setTaskCompleted } from '@/db/repositories/tasksRepo';
import { DEFAULT_PREFERENCES } from '@/store/preferences';

import { buildDesired, diffSchedule, MAX_SCHEDULED, type DesiredNotification } from '../notifications';

jest.mock('expo-notifications', () => ({}));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

const NOW = Date.UTC(2025, 10, 21, 4, 30); // 10:00 IST, Friday 21 Nov 2025
const prefs = { ...DEFAULT_PREFERENCES, onboardingComplete: true };
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

describe('buildDesired', () => {
  it('schedules task reminders at the right instant (IST)', async () => {
    const task = await createTask({ title: 'Submit lab', notes: null, priority: 'high', category: 'academics', dueDate: '2025-11-21', dueMinute: 18 * 60, recurrence: null, reminderOffsets: [30], popupMessage: null });
    const desired = (await buildDesired(prefs, NOW)).filter((item) => item.ownerType === 'task');
    expect(desired).toHaveLength(1);
    // 18:00 IST − 30 min = 17:30 IST = 12:00 UTC
    expect(desired[0]?.fireAt).toBe(Date.UTC(2025, 10, 21, 12, 0));
    expect(desired[0]?.route).toBe(`/tasks/${task.id}`);
  });

  it('skips completed tasks and reminders in the past', async () => {
    const done = await createTask({ title: 'Done', notes: null, priority: 'low', category: 'personal', dueDate: '2025-11-21', dueMinute: 20 * 60, recurrence: null, reminderOffsets: [10], popupMessage: null });
    await setTaskCompleted(done.id, true, '2025-11-21');
    await createTask({ title: 'Earlier', notes: null, priority: 'low', category: 'personal', dueDate: '2025-11-21', dueMinute: 9 * 60, recurrence: null, reminderOffsets: [0], popupMessage: null });
    const desired = (await buildDesired(prefs, NOW)).filter((item) => item.ownerType === 'task');
    expect(desired).toHaveLength(0);
  });

  it('expands recurring events within the rolling window only', async () => {
    await createEntry({
      kind: 'event', title: 'Lecture', description: null, category: 'academics', color: null, priority: null, location: 'Hall 4B',
      allDay: false, startDate: '2025-11-17', startMinute: 11 * 60, endMinute: 12 * 60,
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] }, exceptionDates: [], reminderOffsets: [15], popupMessage: null, workoutPlanId: null,
    });
    const events = (await buildDesired(prefs, NOW)).filter((item) => item.ownerType === 'entry');
    // Fri 21 → Fri 5 Dec inclusive: 21, 24, 26, 28, 1, 3, 5 = 7 occurrences
    expect(events).toHaveLength(7);
    expect(new Set(events.map((item) => item.scheduleKey)).size).toBe(7);
  });

  it('schedules the daily mood check-in at 22:00 IST and skips today once logged', async () => {
    let mood = (await buildDesired(prefs, NOW)).filter((item) => item.ownerType === 'mood');
    expect(mood[0]?.fireAt).toBe(Date.UTC(2025, 10, 21, 16, 30));
    expect(mood).toHaveLength(7);
    await saveReview('2025-11-21', { mood: 4, tags: [], remark: null, gratitude: null });
    mood = (await buildDesired(prefs, NOW)).filter((item) => item.ownerType === 'mood');
    expect(mood).toHaveLength(6);
    expect(mood[0]?.ownerId).toBe('2025-11-22');
  });

  it('respects disabled reminder types', async () => {
    await createCountdown({ title: 'Exam', subtitle: null, targetDate: '2025-12-01', targetMinute: 9 * 60, style: 'digital', accent: null, backgroundUri: null, message: null, pinned: true, showSeconds: true, reminderOffsets: [1440] });
    const on = (await buildDesired(prefs, NOW)).filter((item) => item.ownerType === 'countdown');
    expect(on).toHaveLength(2); // 1 day before + at the moment
    const off = (await buildDesired({ ...prefs, remindersCountdowns: false, moodReminderEnabled: false }, NOW)).filter((item) => item.ownerType === 'countdown');
    expect(off).toHaveLength(0);
  });

  it('caps the number of pending notifications', async () => {
    for (let index = 0; index < 20; index += 1) {
      await createEntry({
        kind: 'reminder', title: `R${index}`, description: null, category: 'personal', color: null, priority: null, location: null,
        allDay: false, startDate: '2025-11-21', startMinute: 12 * 60, endMinute: null,
        recurrence: { freq: 'daily', interval: 1 }, exceptionDates: [], reminderOffsets: [0], popupMessage: null, workoutPlanId: null,
      });
    }
    expect((await buildDesired(prefs, NOW)).length).toBe(MAX_SCHEDULED);
  });
});

describe('diffSchedule', () => {
  const desired = (key: string, title = 'T'): DesiredNotification => ({
    scheduleKey: key, ownerType: 'task', ownerId: 'x', fireAt: NOW + 60_000, title, body: null, route: null, category: 'task', channel: 'reminders',
  });
  const record = (key: string, title = 'T') => ({ ...desired(key, title), id: `os-${key}` });

  it('is idempotent: nothing to do when in sync', () => {
    expect(diffSchedule([record('a'), record('b')], [desired('a'), desired('b')])).toEqual({ toCancel: [], toAdd: [] });
  });

  it('adds new, cancels obsolete, and never duplicates', () => {
    const { toCancel, toAdd } = diffSchedule([record('a'), record('old')], [desired('a'), desired('new')]);
    expect(toCancel.map((r) => r.scheduleKey)).toEqual(['old']);
    expect(toAdd.map((d) => d.scheduleKey)).toEqual(['new']);
  });

  it('reschedules when the content of an existing reminder changed', () => {
    const { toCancel, toAdd } = diffSchedule([record('a', 'Old title')], [desired('a', 'New title')]);
    expect(toCancel).toHaveLength(1);
    expect(toAdd).toHaveLength(1);
  });
});
