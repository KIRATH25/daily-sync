import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Flame, Plus, Target, TrendingUp } from '@/components/ui/icons';

import { HabitCard } from '@/components/habits/HabitCard';
import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { useFeedback } from '@/components/ui/Feedback';
import { ProgressBar } from '@/components/ui/Progress';
import { Pill, Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { incrementHabit, listCompletedPairs, listHabits, listLogs, toggleHabit } from '@/db/repositories/habitsRepo';
import { useToday } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n } from '@/i18n';
import { parseDateKey, weekDays, weekdayOf } from '@/lib/dates';
import { habitStreaks, isHabitDueOn } from '@/lib/habits';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { Habit } from '@/types/models';

export default function HabitsScreen() {
  const palette = usePalette();
  const { t, formatPercent, weekdayName } = useI18n();
  const { preferences } = usePreferences();
  const { toast } = useFeedback();
  const today = useToday();
  const week = useMemo(() => weekDays(today, preferences.weekStart), [today, preferences.weekStart]);

  const query = useLiveQuery(
    async () => {
      const [habits, pairs, weekLogs] = await Promise.all([listHabits(), listCompletedPairs(), listLogs(week[0] ?? today, week[6] ?? today)]);
      return { habits, pairs, weekLogs };
    },
    ['habits', 'habit_logs'],
    [today, week],
  );

  const stats = useMemo(() => {
    const data = query.data;
    if (!data) return null;
    const byHabit = new Map<string, Set<string>>();
    for (const pair of data.pairs) {
      let set = byHabit.get(pair.habitId);
      if (!set) byHabit.set(pair.habitId, (set = new Set()));
      set.add(pair.date);
    }
    const streaks = new Map(data.habits.map((habit) => [habit.id, habitStreaks(habit.scheduleDays, byHabit.get(habit.id) ?? new Set(), habit.startDate, today)]));
    const todayLogs = new Map(data.weekLogs.filter((log) => log.date === today).map((log) => [log.habitId, log]));
    const dueToday = data.habits.filter((habit) => habit.startDate <= today && isHabitDueOn(habit.scheduleDays, today, habit.paused));
    const doneToday = dueToday.filter((habit) => todayLogs.get(habit.id)?.completed).length;
    const doneSet = new Set(data.weekLogs.filter((log) => log.completed).map((log) => `${log.habitId}|${log.date}`));
    let weekPlanned = 0;
    let weekDone = 0;
    const rhythm = week.map((date) => {
      const due = data.habits.filter((habit) => habit.startDate <= date && isHabitDueOn(habit.scheduleDays, date, habit.paused));
      const done = due.filter((habit) => doneSet.has(`${habit.id}|${date}`)).length;
      if (date < today) {
        weekPlanned += due.length;
        weekDone += done;
      } else if (date === today) {
        weekPlanned += done;
        weekDone += done;
      }
      return { date, due: due.length, done };
    });
    const bestStreak = Math.max(0, ...[...streaks.values()].map((streak) => streak.current));
    return { streaks, todayLogs, dueToday, doneToday, rhythm, weekRate: weekPlanned ? weekDone / weekPlanned : null, bestStreak };
  }, [query.data, today, week]);

  const onToggle = useCallback(
    (habit: Habit) => {
      const done = stats?.todayLogs.get(habit.id)?.completed ?? false;
      toggleHabit(habit, today, done).catch(() => toast(t('error.saveFailed'), { tone: 'error' }));
    },
    [stats, today, toast, t],
  );
  const onIncrement = useCallback(
    (habit: Habit) => {
      incrementHabit(habit, today, stats?.todayLogs.get(habit.id)?.value ?? 0).catch(() => toast(t('error.saveFailed'), { tone: 'error' }));
    },
    [stats, today, toast, t],
  );

  const habits = query.data?.habits ?? [];
  const header = <ScreenHeader large eyebrow={t('habits.eyebrow')} title={t('habits.title')} subtitle={t('habits.subtitle')} />;
  const footer = <PremiumButton label={t('habits.create')} icon={Plus} onPress={() => router.push({ pathname: '/create', params: { type: 'habit' } })} />;

  return (
    <Screen header={header} footer={footer}>
      {!stats ? (
        <LoadingState />
      ) : habits.length === 0 ? (
        <EmptyState icon={Flame} title={t('habits.emptyTitle')} message={t('habits.emptyBody')} />
      ) : (
        <>
          <View style={styles.grid}>
            <StatCard icon={Flame} label={t('habits.activeStreak')} value={String(stats.bestStreak)} unit={t('habits.days')} glow />
            <StatCard icon={TrendingUp} label={t('habits.weeklyMet')} value={stats.weekRate == null ? '—' : String(Math.round(stats.weekRate * 100))} unit="%" />
            <DSCard style={styles.cell}>
              <View style={styles.cellTop}>
                <Text variant="label" tone="secondary">
                  {t('habits.today')}
                </Text>
                <Target size={16} color={palette.accentText} />
              </View>
              <Text variant="stat" latin>
                {stats.doneToday}
                <Text variant="h3" tone="secondary" latin>{` / ${stats.dueToday.length}`}</Text>
              </Text>
              <ProgressBar progress={stats.dueToday.length ? stats.doneToday / stats.dueToday.length : 0} />
            </DSCard>
            <StatCard icon={Plus} label={t('habits.active')} value={String(habits.filter((habit) => !habit.paused).length)} unit={t('habits.routines')} />
          </View>

          <DSCard>
            <View style={styles.rhythmHead}>
              <Text variant="label" tone="secondary">
                {t('habits.weeklyRhythm')}
              </Text>
              {stats.weekRate != null ? <Pill label={formatPercent(stats.weekRate)} tone="accent" /> : null}
            </View>
            <View style={styles.rhythm}>
              {stats.rhythm.map((day) => {
                const ratio = day.due ? day.done / day.due : 0;
                const isToday = day.date === today;
                const future = day.date > today;
                return (
                  <View key={day.date} style={styles.rhythmDay}>
                    <Text variant="micro" tone={isToday ? 'accent' : 'muted'}>
                      {weekdayName(weekdayOf(day.date), 'narrow')}
                    </Text>
                    <View
                      style={[
                        styles.rhythmBlock,
                        {
                          backgroundColor: future || day.due === 0 ? palette.surfaceAlt : ratio >= 1 ? palette.accent : ratio > 0 ? palette.accentMuted : palette.elevated,
                          borderColor: isToday ? palette.accent : 'transparent',
                        },
                      ]}
                    >
                      <Text variant="smallStrong" latin color={ratio >= 1 && !future ? palette.onAccent : palette.text}>
                        {future || day.due === 0 ? '–' : day.done}
                      </Text>
                    </View>
                    <Text variant="micro" tone="muted" latin>
                      {parseDateKey(day.date).day}
                    </Text>
                  </View>
                );
              })}
            </View>
          </DSCard>

          <SectionHeader title={t('habits.protocols')} />
          <View style={styles.list}>
            {habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                value={stats.todayLogs.get(habit.id)?.value ?? 0}
                done={stats.todayLogs.get(habit.id)?.completed ?? false}
                due={habit.startDate <= today && isHabitDueOn(habit.scheduleDays, today, false)}
                streak={stats.streaks.get(habit.id)?.current ?? 0}
                onToggle={onToggle}
                onIncrement={onIncrement}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function StatCard({ icon: Icon, label, value, unit, glow }: { icon: typeof Flame; label: string; value: string; unit: string; glow?: boolean }) {
  const palette = usePalette();
  return (
    <DSCard style={styles.cell} glow={glow}>
      <View style={styles.cellTop}>
        <Text variant="label" tone="secondary" numberOfLines={1} style={styles.flex}>
          {label}
        </Text>
        <Icon size={16} color={palette.accentText} />
      </View>
      <Text variant="stat" latin>
        {value}
        <Text variant="small" tone="secondary">{` ${unit}`}</Text>
      </Text>
    </DSCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: '48.6%', gap: space.sm },
  cellTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.xs },
  rhythmHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rhythm: { flexDirection: 'row', gap: 6, marginTop: space.md },
  rhythmDay: { flex: 1, alignItems: 'center', gap: 6 },
  rhythmBlock: { width: '100%', aspectRatio: 0.9, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  list: { gap: space.sm },
});
