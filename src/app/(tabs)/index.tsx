import { useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Bell, ListChecks, Search, SlidersHorizontal, UserRound } from '@/components/ui/icons';

import {
  FitnessCard,
  GlanceCard,
  HabitWeekCard,
  JourneyCard,
  MilestoneCard,
  MoodCard,
  PendingCheckIn,
  QuoteCard,
  ScheduleCard,
  Shortcuts,
  type ScheduleItem,
} from '@/components/dashboard/DashboardCards';
import { TaskRow } from '@/components/tasks/TaskRow';
import { DSChip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, SectionHeader } from '@/components/ui/Screen';
import { DSBottomSheet } from '@/components/ui/Sheet';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { DSSwitch, SettingRow } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { listAchievementRecords } from '@/db/repositories/achievementsRepo';
import { listActiveDates } from '@/db/repositories/activityRepo';
import { listCountdowns } from '@/db/repositories/countdownsRepo';
import { listOccurrences } from '@/db/repositories/entriesRepo';
import { hydrationTotal, listSessionsInRange, getActiveSession } from '@/db/repositories/fitnessRepo';
import { listHabits, listLogs } from '@/db/repositories/habitsRepo';
import { unreadInboxCount } from '@/db/repositories/notificationsRepo';
import { getReview } from '@/db/repositories/reviewsRepo';
import { useClock } from '@/hooks/useClock';
import { useDayData } from '@/hooks/useDayData';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useTaskActions } from '@/hooks/useTaskActions';
import { useI18n, type TKey } from '@/i18n';
import { ACHIEVEMENT_COUNT } from '@/lib/achievements';
import { addDays, weekDays, weekdayOf } from '@/lib/dates';
import { isHabitDueOn } from '@/lib/habits';
import { computeJourneyStats } from '@/lib/journey';
import { wallClockToInstant } from '@/lib/timezone';
import { quoteForDate, quoteText } from '@/services/quotes';
import { DASHBOARD_MODULES, usePreferences, type DashboardModule } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

function greetingKey(minute: number): TKey {
  if (minute < 12 * 60) return 'home.greetingMorning';
  if (minute < 17 * 60) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

export default function HomeScreen() {
  const palette = usePalette();
  const { t, formatDate, formatTime } = useI18n();
  const { preferences, setPreference } = usePreferences();
  const clock = useClock();
  const today = clock.dateKey;
  const { toggle } = useTaskActions();
  const [customizing, setCustomizing] = useState(false);
  const hidden = new Set(preferences.hiddenDashboardModules);
  const show = (module: DashboardModule) => !hidden.has(module);

  const day = useDayData(today, today);

  const extras = useLiveQuery(
    async () => {
      const week = weekDays(today, preferences.weekStart);
      const [unread, countdowns, activeDates, records, habits, weekLogs, hydration, sessions, active, upcoming, yesterdayReview] =
        await Promise.all([
          unreadInboxCount(),
          listCountdowns(),
          listActiveDates(),
          listAchievementRecords(),
          listHabits(),
          listLogs(week[0] ?? today, week[6] ?? today),
          hydrationTotal(today),
          listSessionsInRange(today, today),
          getActiveSession(),
          listOccurrences(today, addDays(today, 1)),
          getReview(addDays(today, -1)),
        ]);
      return { unread, countdowns, activeDates, records, habits, weekLogs, hydration, sessions, active, upcoming, week, yesterdayReview };
    },
    [
      'inbox_items',
      'countdowns',
      'achievement_records',
      'habits',
      'habit_logs',
      'hydration_logs',
      'workout_sessions',
      'calendar_entries',
      'entry_completions',
      'tasks',
      'day_reviews',
      'journal_entries',
      'focus_sessions',
      'assignments',
      'attendance_records',
    ],
    [today, preferences.weekStart],
  );

  const derived = useMemo(() => {
    const data = day.data;
    const more = extras.data;
    if (!data || !more) return null;
    const now = clock.now;
    const tz = preferences.timeZone;

    // Next item: classes and calendar entries from now on.
    const candidates: (ScheduleItem & { at: number })[] = [];
    for (const occ of more.upcoming) {
      if (occ.completed || occ.entry.kind === 'note') continue;
      const minute = occ.entry.allDay ? null : occ.entry.startMinute;
      const at = wallClockToInstant(occ.date, minute ?? 0, tz);
      const endAt = occ.entry.endMinute != null ? wallClockToInstant(occ.date, occ.entry.endMinute, tz) : at + 30 * 60_000;
      if (occ.entry.allDay ? occ.date !== today : endAt < now) continue;
      candidates.push({
        title: occ.entry.title,
        subtitle: [occ.entry.allDay ? t('common.allDay') : formatTime(minute ?? 0), occ.date !== today ? t('common.tomorrow') : null, occ.entry.location]
          .filter(Boolean)
          .join(' · '),
        startsInMs: occ.entry.allDay ? null : at - now,
        route: `/entry/${occ.entry.id}?date=${occ.date}`,
        at: occ.entry.allDay ? now + 1 : at,
      });
    }
    for (const slot of data.classes) {
      const at = wallClockToInstant(today, slot.startMinute, tz);
      const endAt = wallClockToInstant(today, slot.endMinute, tz);
      if (endAt < now) continue;
      candidates.push({
        title: slot.subject.name,
        subtitle: [formatTime(slot.startMinute), slot.room].filter(Boolean).join(' · '),
        startsInMs: at - now,
        route: '/timetable',
        at,
      });
    }
    candidates.sort((a, b) => a.at - b.at);

    // Habit week
    const logsByKey = new Set(more.weekLogs.filter((log) => log.completed).map((log) => `${log.habitId}|${log.date}`));
    let weekPlanned = 0;
    let weekDone = 0;
    const weekRow = more.week.map((date) => {
      const due = more.habits.filter((habit) => habit.startDate <= date && isHabitDueOn(habit.scheduleDays, date, habit.paused));
      const done = due.filter((habit) => logsByKey.has(`${habit.id}|${date}`)).length;
      if (date <= today) {
        weekPlanned += date === today ? done : due.length;
        weekDone += done;
      }
      return { date, ratio: due.length === 0 || date > today ? null : done / due.length, isToday: date === today, weekday: weekdayOf(date) };
    });

    const journey = computeJourneyStats(more.activeDates, today);
    const futureCountdowns = more.countdowns.filter((c) => wallClockToInstant(c.targetDate, c.targetMinute, tz) > now);
    const milestone = futureCountdowns.find((c) => c.pinned) ?? futureCountdowns[0] ?? null;

    const workout = more.active
      ? t('home.workoutInProgress', { name: more.active.name })
      : more.sessions[0]
        ? t('home.workoutDone', { name: more.sessions[0].name, minutes: Math.round(((more.sessions[0].endedAt ?? now) - more.sessions[0].startedAt) / 60_000) })
        : null;

    const pendingMood =
      preferences.moodReminderEnabled && !data.review && clock.minute >= preferences.moodReminderMinute
        ? { date: today, isYesterday: false }
        : !more.yesterdayReview && clock.minute < 12 * 60 && journey.firstActive && journey.firstActive < today
          ? { date: addDays(today, -1), isYesterday: true }
          : null;

    const openTasks = [...data.overdue, ...data.tasks.filter((task) => task.completedAt == null && task.dueDate === today)];
    const doneToday = data.tasks.filter((task) => task.completedDate === today);
    const planned = data.tasksPlanned + data.habitsPlanned;
    const completed = data.tasksDone + data.habitsDone;

    return {
      next: candidates[0] ?? null,
      extraCount: Math.max(0, candidates.filter((c) => c.at < wallClockToInstant(addDays(today, 1), 0, tz)).length - 1),
      weekRow,
      weeklyRate: weekPlanned > 0 ? weekDone / weekPlanned : more.habits.length ? 0 : null,
      journey,
      milestone,
      milestoneTarget: milestone ? wallClockToInstant(milestone.targetDate, milestone.targetMinute, tz) : 0,
      workout,
      pendingMood,
      priorityTasks: [...openTasks.slice(0, 3), ...doneToday.slice(0, Math.max(0, 3 - openTasks.length))],
      openCount: openTasks.length,
      doneCount: doneToday.length,
      planned,
      completed,
    };
  }, [day.data, extras.data, clock.now, clock.minute, today, preferences.timeZone, preferences.moodReminderEnabled, preferences.moodReminderMinute, t, formatTime]);

  const name = preferences.userName.trim();
  const greeting = t(greetingKey(clock.minute), { name: name || t('home.friend') });

  const header = (
    <View style={styles.header}>
      <PressableScale onPress={() => router.push('/profile')} accessibilityLabel={t('tabs.profile')} style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
        {preferences.avatarUri ? (
          <Image source={{ uri: preferences.avatarUri }} style={styles.avatarImage} accessibilityIgnoresInvertColors />
        ) : (
          <UserRound size={22} color="#1A1708" />
        )}
      </PressableScale>
      <View style={styles.flex}>
        <Text variant="h3" numberOfLines={1}>
          {greeting}
        </Text>
        <Text variant="small" tone="secondary">
          {formatDate(today, 'long')}
        </Text>
      </View>
      <IconButton icon={Search} label={t('search.title')} onPress={() => router.push('/search')} />
      <IconButton icon={Bell} label={t('notifications.title')} onPress={() => router.push('/notifications')} badge={(extras.data?.unread ?? 0) > 0} />
    </View>
  );

  const loading = day.loading || extras.loading || !derived;

  return (
    <Screen header={header} withTabBar refreshing={false} onRefresh={() => { day.reload(); extras.reload(); }}>
      {loading || !derived ? (
        <LoadingState rows={4} />
      ) : (
        <Animated.View entering={FadeInDown.duration(320)} style={styles.stack}>
          {derived.pendingMood ? <PendingCheckIn date={derived.pendingMood.date} isYesterday={derived.pendingMood.isYesterday} /> : null}
          <GlanceCard
            completed={derived.completed}
            remaining={Math.max(0, derived.planned - derived.completed)}
            habitsDone={day.data?.habitsDone ?? 0}
            habitsPlanned={day.data?.habitsPlanned ?? 0}
            planned={derived.planned}
          />
          <Shortcuts />
          {show('schedule') ? <ScheduleCard next={derived.next} extraCount={derived.extraCount} /> : null}
          {show('tasks') ? (
            <View style={styles.section}>
              <SectionHeader
                title={t('home.priorityTasks')}
                right={
                  <Text variant="small" tone="secondary">
                    {t('home.taskCounts', { done: derived.doneCount, left: derived.openCount })}
                  </Text>
                }
              />
              {derived.priorityTasks.length === 0 ? (
                <EmptyState
                  compact
                  icon={ListChecks}
                  title={t('home.noTasksTitle')}
                  message={t('home.noTasksBody')}
                  actionLabel={t('tasks.add')}
                  onAction={() => router.push({ pathname: '/create', params: { type: 'task' } })}
                />
              ) : (
                derived.priorityTasks.map((task) => (
                  <TaskRow key={task.id} task={task} today={today} nowMinute={clock.minute} onToggle={toggle} compact />
                ))
              )}
              {derived.openCount + derived.doneCount > 3 ? (
                <DSChip label={t('home.seeAllTasks')} onPress={() => router.push('/tasks')} style={styles.seeAll} />
              ) : null}
            </View>
          ) : null}
          {show('countdown') && derived.milestone ? <MilestoneCard countdown={derived.milestone} targetMs={derived.milestoneTarget} /> : null}
          {show('habits') ? <HabitWeekCard days={derived.weekRow} weeklyRate={derived.weeklyRate} streak={derived.journey.currentStreak} /> : null}
          {show('mood') ? <MoodCard today={today} current={day.data?.review?.mood ?? null} /> : null}
          {show('fitness') ? (
            <FitnessCard workoutLabel={derived.workout} hydration={extras.data?.hydration ?? 0} hydrationGoal={preferences.hydrationGoalMl} />
          ) : null}
          {show('journey') ? (
            <JourneyCard
              active={derived.journey.activeDays}
              streak={derived.journey.currentStreak}
              best={derived.journey.longestStreak}
              earned={extras.data?.records.length ?? 0}
              total={ACHIEVEMENT_COUNT}
            />
          ) : null}
          {show('quote') ? <QuoteCard text={quoteText(quoteForDate(today), preferences.language)} /> : null}
          <DSChip label={t('home.customize')} icon={SlidersHorizontal} onPress={() => setCustomizing(true)} style={styles.customize} />
        </Animated.View>
      )}
      <DSBottomSheet visible={customizing} onClose={() => setCustomizing(false)} title={t('home.customize')} subtitle={t('home.customizeBody')}>
        {DASHBOARD_MODULES.map((module) => (
          <SettingRow
            key={module}
            title={t(`dashboard.${module}` as TKey)}
            right={
              <DSSwitch
                label={t(`dashboard.${module}` as TKey)}
                value={!hidden.has(module)}
                onChange={(visible) => {
                  const next = new Set(hidden);
                  if (visible) next.delete(module);
                  else next.add(module);
                  void setPreference('hiddenDashboardModules', [...next]);
                }}
              />
            }
          />
        ))}
      </DSBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.gutter, paddingVertical: space.md },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 48, height: 48 },
  stack: { gap: space.lg },
  section: { gap: space.sm },
  seeAll: { alignSelf: 'center' },
  customize: { alignSelf: 'center', marginTop: space.sm },
});
