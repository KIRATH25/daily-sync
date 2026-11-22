/**
 * Reminder engine.
 *
 * Design:
 *   - Every reminder is a one-shot DATE trigger at an absolute instant that
 *     we compute from the stored wall-clock time in the user's zone. This is
 *     correct even if the device zone differs from the preferred zone and
 *     avoids per-platform repeat-trigger quirks.
 *   - Recurring items keep a rolling window (next 14 days) scheduled; the
 *     window is topped up on every launch/foreground and after data changes.
 *   - `sync()` builds the *desired* set, diffs it against what we recorded
 *     as scheduled (`notification_records`, keyed by a deterministic
 *     schedule key), cancels obsolete ones and schedules only what is
 *     missing. Running it any number of times never creates duplicates.
 *   - At most `MAX_SCHEDULED` notifications are pending at once (soonest
 *     first), staying under OS limits.
 *
 * Delivery precision: Android may defer alarms on some devices, and without
 * the exact-alarm permission (denied by default on Android 14+) delivery can
 * be minutes late. We never promise to-the-second delivery; Settings shows
 * the permission state and lets the user grant it. With notifications denied
 * entirely, the app still shows pending check-ins and overdue states in-app.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { subscribeToChanges, type TableName } from '@/db/changes';
import { listOccurrences } from '@/db/repositories/entriesRepo';
import { listHabits, listLogs } from '@/db/repositories/habitsRepo';
import {
  archiveDeliveredRecords,
  deleteRecordsByIds,
  insertRecord,
  listRecords,
  type NotificationRecord,
} from '@/db/repositories/notificationsRepo';
import { getReview } from '@/db/repositories/reviewsRepo';
import { listCountdowns } from '@/db/repositories/countdownsRepo';
import { listOpenTasksDueBy } from '@/db/repositories/tasksRepo';
import { listAssignments, listSlots } from '@/db/repositories/timetableRepo';
import { readPreference, savePreference } from '@/db/repositories/preferencesRepo';
import { createFormatters } from '@/i18n';
import { addDays, dateRange, weekdayOf } from '@/lib/dates';
import { isHabitDueOn } from '@/lib/habits';
import { todayKey, wallClockToInstant } from '@/lib/timezone';
import { loadPreferences, type Preferences } from '@/store/preferences';
import type { InboxCategory } from '@/types/models';

export const WINDOW_DAYS = 14;
export const MAX_SCHEDULED = 60;
const MOOD_SNOOZE_KEY = 'mood.snoozeUntil';
const MOOD_SKIP_KEY = 'mood.skippedDate';

/**
 * OS-scheduled local notifications exist only in the native apps. A web app
 * (including an iOS Home Screen web app) cannot schedule reminders that fire
 * while it is closed, so on web every OS call below is a no-op and the app
 * relies on in-app prompts instead.
 */
export const NOTIFICATIONS_SUPPORTED = Platform.OS !== 'web';

/** Last notification tap; always null on web. */
export const useNotificationResponse: () => Notifications.NotificationResponse | null | undefined = NOTIFICATIONS_SUPPORTED
  ? Notifications.useLastNotificationResponse
  : () => null;

export const CHANNEL_REMINDERS = 'reminders';
export const CHANNEL_CHECKINS = 'checkins';
export const CATEGORY_MOOD = 'mood_checkin';
export const ACTION_SNOOZE = 'snooze';

export interface DesiredNotification {
  scheduleKey: string;
  ownerType: string;
  ownerId: string;
  fireAt: number;
  title: string;
  body: string | null;
  route: string | null;
  category: InboxCategory;
  channel: string;
}

// ── Setup ───────────────────────────────────────────────────────────────────

let foregroundMoodListener: (() => void) | null = null;

/** Lets the root layout show the mood modal instead of a banner in-app. */
export function setForegroundMoodListener(listener: (() => void) | null): void {
  foregroundMoodListener = listener;
}

export async function configureNotifications(language: Preferences['language']): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const category = notification.request.content.data?.category;
      if (category === 'mood' && foregroundMoodListener) {
        foregroundMoodListener();
        return { shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false };
      }
      return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
    },
  });

  const { t } = createFormatters(language, '12h', 'UTC');
  await ensureChannels(language);
  await Notifications.setNotificationCategoryAsync(CATEGORY_MOOD, [
    { identifier: ACTION_SNOOZE, buttonTitle: t('mood.snooze30'), options: { opensAppToForeground: false } },
  ]).catch(() => undefined);
}

/**
 * Android channels must exist before the Android 13+ permission prompt can be
 * shown, and before anything is scheduled. Idempotent.
 */
async function ensureChannels(language: Preferences['language']): Promise<void> {
  if (Platform.OS !== 'android') return;
  const { t } = createFormatters(language, '12h', 'UTC');
  {
    // AndroidImportance is a runtime enum re-exported via `export *`, which the
    // import/namespace rule cannot follow.
    await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
      name: t('notif.channelReminders'),
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#F4D54D',
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_CHECKINS, {
      name: t('notif.channelCheckins'),
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#F4D54D',
    });
  }
}

// ── Permissions ─────────────────────────────────────────────────────────────

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  if (!NOTIFICATIONS_SUPPORTED) return 'denied';
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return 'granted';
  return settings.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<PermissionState> {
  if (!NOTIFICATIONS_SUPPORTED) return 'denied';
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  await ensureChannels((await loadPreferences()).language).catch(() => undefined);
  const result = await Notifications.requestPermissionsAsync();
  return result.granted ? 'granted' : result.canAskAgain ? 'undetermined' : 'denied';
}

export async function getExactAlarmState(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function requestExactAlarm(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// ── Desired schedule ────────────────────────────────────────────────────────

const DEFAULT_ALL_DAY_MINUTE = 9 * 60;

export async function buildDesired(prefs: Preferences, now: number): Promise<DesiredNotification[]> {
  const fmt = createFormatters(prefs.language, prefs.timeFormat, prefs.timeZone);
  const { t } = fmt;
  const tz = prefs.timeZone;
  const today = todayKey(tz, now);
  const end = addDays(today, WINDOW_DAYS);
  const desired: DesiredNotification[] = [];
  const at = (date: string, minute: number) => wallClockToInstant(date, minute, tz);

  const offsetLabel = (offset: number) =>
    offset === 0 ? t('notif.now') : t('notif.inTime', { time: fmt.formatDuration(offset * 60) });

  if (prefs.remindersTasks) {
    const tasks = await listOpenTasksDueBy(end);
    for (const task of tasks) {
      if (!task.dueDate || task.dueDate < today) continue;
      const dueMinute = task.dueMinute ?? DEFAULT_ALL_DAY_MINUTE;
      for (const offset of task.reminderOffsets) {
        desired.push({
          scheduleKey: `task:${task.id}:${task.dueDate}:${dueMinute}:${offset}`,
          ownerType: 'task',
          ownerId: task.id,
          fireAt: at(task.dueDate, dueMinute) - offset * 60_000,
          title: task.title,
          body: task.popupMessage ?? t('notif.taskDue', { when: offsetLabel(offset) }),
          route: `/tasks/${task.id}`,
          category: 'task',
          channel: CHANNEL_REMINDERS,
        });
      }
    }
  }

  if (prefs.remindersEvents || prefs.remindersWorkouts) {
    const occurrences = await listOccurrences(today, end);
    for (const { entry, date, completed } of occurrences) {
      if (completed || entry.reminderOffsets.length === 0) continue;
      const isWorkout = entry.kind === 'workout';
      if (isWorkout ? !prefs.remindersWorkouts : !prefs.remindersEvents) continue;
      const startMinute = entry.allDay ? DEFAULT_ALL_DAY_MINUTE : (entry.startMinute ?? DEFAULT_ALL_DAY_MINUTE);
      for (const offset of entry.reminderOffsets) {
        desired.push({
          scheduleKey: `entry:${entry.id}:${date}:${startMinute}:${offset}`,
          ownerType: 'entry',
          ownerId: entry.id,
          fireAt: at(date, startMinute) - offset * 60_000,
          title: entry.title,
          body:
            entry.popupMessage ??
            (entry.location
              ? t('notif.eventStartsAt', { when: offsetLabel(offset), place: entry.location })
              : t('notif.eventStarts', { when: offsetLabel(offset) })),
          route: `/entry/${entry.id}?date=${date}`,
          category: isWorkout ? 'workout' : entry.kind === 'reminder' ? 'reminder' : 'event',
          channel: CHANNEL_REMINDERS,
        });
      }
    }
  }

  if (prefs.remindersClasses) {
    const slots = await listSlots();
    for (const date of dateRange(today, end)) {
      const weekday = weekdayOf(date);
      for (const slot of slots) {
        if (slot.weekday !== weekday || slot.reminderOffset == null) continue;
        desired.push({
          scheduleKey: `class:${slot.id}:${date}:${slot.startMinute}:${slot.reminderOffset}`,
          ownerType: 'class',
          ownerId: slot.id,
          fireAt: at(date, slot.startMinute) - slot.reminderOffset * 60_000,
          title: slot.subject.name,
          body: slot.room
            ? t('notif.classStartsAt', { when: offsetLabel(slot.reminderOffset), place: slot.room })
            : t('notif.classStarts', { when: offsetLabel(slot.reminderOffset) }),
          route: '/timetable',
          category: 'class',
          channel: CHANNEL_REMINDERS,
        });
      }
    }
    const assignments = await listAssignments(false);
    for (const item of assignments) {
      if (item.dueDate < today || item.dueDate > end) continue;
      const minute = item.dueMinute ?? DEFAULT_ALL_DAY_MINUTE;
      for (const offset of item.reminderOffsets) {
        desired.push({
          scheduleKey: `assignment:${item.id}:${item.dueDate}:${minute}:${offset}`,
          ownerType: 'assignment',
          ownerId: item.id,
          fireAt: at(item.dueDate, minute) - offset * 60_000,
          title: item.title,
          body: t(item.kind === 'exam' || item.kind === 'quiz' ? 'notif.examSoon' : 'notif.assignmentDue', {
            when: offsetLabel(offset),
          }),
          route: '/timetable',
          category: item.kind === 'exam' || item.kind === 'quiz' ? 'exam' : 'task',
          channel: CHANNEL_REMINDERS,
        });
      }
    }
  }

  if (prefs.remindersHabits) {
    const habits = (await listHabits()).filter((habit) => habit.reminderMinute != null && !habit.paused);
    if (habits.length > 0) {
      const todayLogs = await listLogs(today, today);
      const doneToday = new Set(todayLogs.filter((log) => log.completed).map((log) => log.habitId));
      for (const habit of habits) {
        for (const date of dateRange(today, addDays(today, 6))) {
          if (!isHabitDueOn(habit.scheduleDays, date, habit.paused)) continue;
          if (date === today && doneToday.has(habit.id)) continue;
          const minute = habit.reminderMinute ?? DEFAULT_ALL_DAY_MINUTE;
          desired.push({
            scheduleKey: `habit:${habit.id}:${date}:${minute}`,
            ownerType: 'habit',
            ownerId: habit.id,
            fireAt: at(date, minute),
            title: habit.title,
            body: t('notif.habitNudge'),
            route: `/habits/${habit.id}`,
            category: 'habit',
            channel: CHANNEL_REMINDERS,
          });
        }
      }
    }
  }

  if (prefs.remindersCountdowns) {
    const countdowns = await listCountdowns();
    for (const countdown of countdowns) {
      const target = at(countdown.targetDate, countdown.targetMinute);
      for (const offset of [...new Set([...countdown.reminderOffsets, 0])]) {
        desired.push({
          scheduleKey: `countdown:${countdown.id}:${target}:${offset}`,
          ownerType: 'countdown',
          ownerId: countdown.id,
          fireAt: target - offset * 60_000,
          title: countdown.title,
          body: countdown.message ?? (offset === 0 ? t('notif.countdownNow') : t('notif.countdownSoon', { when: offsetLabel(offset) })),
          route: `/countdowns/${countdown.id}`,
          category: 'countdown',
          channel: CHANNEL_REMINDERS,
        });
      }
    }
  }

  if (prefs.moodReminderEnabled) {
    const reviewedToday = (await getReview(today)) !== null;
    const skipped = await readPreference<string>(MOOD_SKIP_KEY);
    const snoozeUntil = await readPreference<number>(MOOD_SNOOZE_KEY);
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(today, offset);
      if (offset === 0 && (reviewedToday || skipped === today)) continue;
      desired.push({
        scheduleKey: `mood:${date}:${prefs.moodReminderMinute}`,
        ownerType: 'mood',
        ownerId: date,
        fireAt: at(date, prefs.moodReminderMinute),
        title: t('notif.moodTitle'),
        body: t('notif.moodBody'),
        route: `/mood?date=${date}`,
        category: 'mood',
        channel: CHANNEL_CHECKINS,
      });
    }
    if (snoozeUntil && snoozeUntil > now && !reviewedToday) {
      desired.push({
        scheduleKey: `mood-snooze:${snoozeUntil}`,
        ownerType: 'mood',
        ownerId: today,
        fireAt: snoozeUntil,
        title: t('notif.moodTitle'),
        body: t('notif.moodSnoozedBody'),
        route: `/mood?date=${today}`,
        category: 'mood',
        channel: CHANNEL_CHECKINS,
      });
    }
  }

  return desired
    .filter((item) => item.fireAt > now + 5_000)
    .sort((a, b) => a.fireAt - b.fireAt)
    .slice(0, MAX_SCHEDULED);
}

// ── Sync ────────────────────────────────────────────────────────────────────

export interface ScheduleDiff {
  toCancel: NotificationRecord[];
  toAdd: DesiredNotification[];
}

/** Pure diff, exported for tests. Changed content counts as cancel + add. */
export function diffSchedule(existing: readonly NotificationRecord[], desired: readonly DesiredNotification[]): ScheduleDiff {
  const desiredByKey = new Map(desired.map((item) => [item.scheduleKey, item]));
  const existingByKey = new Map(existing.map((record) => [record.scheduleKey, record]));
  const toCancel: NotificationRecord[] = [];
  const toAdd: DesiredNotification[] = [];
  for (const record of existing) {
    const wanted = desiredByKey.get(record.scheduleKey);
    if (!wanted || wanted.title !== record.title || wanted.body !== record.body || wanted.route !== record.route) {
      toCancel.push(record);
    }
  }
  const cancelled = new Set(toCancel.map((record) => record.scheduleKey));
  for (const item of desired) {
    if (!existingByKey.has(item.scheduleKey) || cancelled.has(item.scheduleKey)) toAdd.push(item);
  }
  return { toCancel, toAdd };
}

let syncChain: Promise<void> = Promise.resolve();

/** Serialised so overlapping triggers cannot double-schedule. */
export function syncNotifications(): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return Promise.resolve();
  syncChain = syncChain.then(runSync).catch((error: unknown) => {
    console.error('Reminder sync failed', error);
  });
  return syncChain;
}

async function runSync(): Promise<void> {
  const now = Date.now();
  await archiveDeliveredRecords(now);
  const prefs = await loadPreferences();
  const permission = await getPermissionState();

  let existing = await listRecords();
  if (permission !== 'granted') {
    // Without permission nothing can be delivered; clear our bookkeeping so a
    // later grant reschedules everything from scratch.
    for (const record of existing) {
      await Notifications.cancelScheduledNotificationAsync(record.id).catch(() => undefined);
    }
    await deleteRecordsByIds(existing.map((record) => record.id));
    return;
  }

  // Drop records the OS no longer has (e.g. cleared by the system).
  const osRequests = await Notifications.getAllScheduledNotificationsAsync();
  const osIds = new Set(osRequests.map((request) => request.identifier));
  // Only notifications created by this scheduler carry a scheduleKey; others
  // (focus-timer end alert, test notification) must never be touched here.
  const schedulerOwned = new Set(
    osRequests.filter((request) => typeof request.content.data?.scheduleKey === 'string').map((request) => request.identifier),
  );
  const vanished = existing.filter((record) => !osIds.has(record.id));
  if (vanished.length > 0) {
    await deleteRecordsByIds(vanished.map((record) => record.id));
    existing = existing.filter((record) => osIds.has(record.id));
  }

  const desired = await buildDesired(prefs, now);
  const { toCancel, toAdd } = diffSchedule(existing, desired);

  for (const record of toCancel) {
    await Notifications.cancelScheduledNotificationAsync(record.id).catch(() => undefined);
  }
  await deleteRecordsByIds(toCancel.map((record) => record.id));

  for (const item of toAdd) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.body ?? undefined,
          data: { route: item.route, category: item.category, scheduleKey: item.scheduleKey },
          sound: true,
          categoryIdentifier: item.category === 'mood' ? CATEGORY_MOOD : undefined,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.fireAt,
          channelId: item.channel,
        },
      });
      await insertRecord({ ...item, id });
    } catch (error) {
      console.warn('Could not schedule a reminder', error instanceof Error ? error.message : 'unknown');
    }
  }

  // Orphans: scheduler notifications we have no record of (e.g. a crash mid-sync).
  const recorded = new Set((await listRecords()).map((record) => record.id));
  for (const id of schedulerOwned) {
    if (!recorded.has(id) && !toCancel.some((record) => record.id === id)) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
    }
  }
}

const WATCHED: TableName[] = [
  'tasks',
  'calendar_entries',
  'entry_completions',
  'habits',
  'habit_logs',
  'timetable_slots',
  'subjects',
  'assignments',
  'countdowns',
  'day_reviews',
  'preferences',
];

/** Re-syncs (debounced) whenever reminder-relevant data changes. */
export function watchForReminderChanges(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const watched = new Set<TableName>(WATCHED);
  const unsubscribe = subscribeToChanges((changed) => {
    if (![...changed].some((table) => watched.has(table))) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void syncNotifications();
    }, 1200);
  });
  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}

// ── Mood helpers ────────────────────────────────────────────────────────────

export async function snoozeMood(minutes: number): Promise<void> {
  await savePreference(MOOD_SNOOZE_KEY, Date.now() + minutes * 60_000);
  await syncNotifications();
}

export async function skipMoodToday(timeZone: string): Promise<void> {
  await savePreference(MOOD_SKIP_KEY, todayKey(timeZone));
  await syncNotifications();
}

export async function moodPromptState(timeZone: string): Promise<{ skippedDate: string | null; snoozeUntil: number | null }> {
  return {
    skippedDate: await readPreference<string>(MOOD_SKIP_KEY),
    snoozeUntil: await readPreference<number>(MOOD_SNOOZE_KEY),
  };
}

/** Fires a test notification in ~5 seconds so users can verify delivery. */
export async function sendTestNotification(title: string, body: string): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { route: '/notifications', category: 'system' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_REMINDERS },
  });
}
