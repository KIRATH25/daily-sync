import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Archive, Bell, Flame, Pause, Pencil, Play, Trash2, Trophy, TrendingUp, X } from '@/components/ui/icons';

import { HABIT_ICON_MAP } from '@/components/habits/HabitCard';
import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { useFeedback } from '@/components/ui/Feedback';
import { IconButton } from '@/components/ui/IconButton';
import { Pill, Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  deleteHabit,
  getHabit,
  incrementHabit,
  listCompletedDates,
  listLogs,
  setHabitArchived,
  setHabitPaused,
  toggleHabit,
} from '@/db/repositories/habitsRepo';
import { useToday } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n } from '@/i18n';
import { addDays, dateRange, startOfWeek } from '@/lib/dates';
import { habitConsistency, habitStreaks, isHabitDueOn } from '@/lib/habits';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const WEEKS = 12;

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const { t, formatPercent, formatTime, formatNumber, formatDate, weekdayName } = useI18n();
  const { preferences } = usePreferences();
  const { toast, confirm } = useFeedback();
  const today = useToday();
  const from = startOfWeek(addDays(today, -(WEEKS - 1) * 7), preferences.weekStart);

  const query = useLiveQuery(
    async () => {
      const [habit, completed, logs] = await Promise.all([getHabit(id), listCompletedDates(id), listLogs(from, today, id)]);
      return { habit, completed: new Set(completed), logs };
    },
    ['habits', 'habit_logs'],
    [id, from, today],
  );

  const habit = query.data?.habit;
  const derived = useMemo(() => {
    if (!habit || !query.data) return null;
    const streaks = habitStreaks(habit.scheduleDays, query.data.completed, habit.startDate, today);
    const consistency = habitConsistency(habit.scheduleDays, query.data.completed, habit.startDate, today, 30);
    const todayLog = query.data.logs.find((log) => log.date === today);
    return { streaks, consistency, todayLog, total: query.data.completed.size };
  }, [habit, query.data, today]);

  const header = (
    <ScreenHeader
      actions={habit ? <IconButton icon={Pencil} label={t('common.edit')} onPress={() => router.push({ pathname: '/create', params: { type: 'habit', id } })} size={42} /> : null}
    />
  );

  if (query.loading && !query.data) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }
  if (!habit || !derived) {
    return (
      <Screen header={header}>
        <EmptyState icon={X} title={t('common.notFound')} message={t('common.notFoundBody')} />
      </Screen>
    );
  }

  const Icon = HABIT_ICON_MAP[habit.icon];
  const color = habit.color ?? palette.accent;
  const due = isHabitDueOn(habit.scheduleDays, today, habit.paused);
  const done = derived.todayLog?.completed ?? false;
  const isCount = habit.unit != null && habit.targetValue > 1;
  const cells = dateRange(from, addDays(from, WEEKS * 7 - 1));

  const remove = async () => {
    const ok = await confirm({ title: t('common.deleteConfirmTitle'), message: t('habits.deleteBody'), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    await deleteHabit(habit.id);
    toast(t('common.deleted'));
    router.back();
  };

  const footer = due ? (
    <PremiumButton
      label={isCount ? t('habits.addStep', { step: formatNumber(habit.increment ?? 1), unit: habit.unit ?? '' }) : done ? t('habits.undoToday') : t('habits.completeToday')}
      variant={done && !isCount ? 'secondary' : 'primary'}
      haptic={done ? 'light' : 'success'}
      onPress={() => (isCount ? incrementHabit(habit, today, derived.todayLog?.value ?? 0) : toggleHabit(habit, today, done))}
    />
  ) : undefined;

  return (
    <Screen header={header} footer={footer}>
      <View style={styles.titleRow}>
        <View style={[styles.icon, { backgroundColor: color }]}>
          <Icon size={26} color={palette.onAccent} />
        </View>
        <View style={styles.flex}>
          <Text variant="h1">{habit.title}</Text>
          <Text variant="small" tone="secondary">
            {habit.scheduleDays.length === 7 ? t('habits.everyDay') : habit.scheduleDays.map((day) => weekdayName(day, 'short')).join(' · ')}
          </Text>
        </View>
      </View>
      <View style={styles.pills}>
        {habit.paused ? <Pill label={t('habits.paused')} tone="muted" /> : null}
        {isCount ? <Pill label={t('habits.targetLabel', { target: formatNumber(habit.targetValue), unit: habit.unit ?? '' })} tone="accent" /> : null}
        {habit.reminderMinute != null ? <Pill label={formatTime(habit.reminderMinute)} tone="muted" icon={Bell} /> : null}
        {isCount && derived.todayLog ? <Pill label={t('habits.todayValue', { value: formatNumber(derived.todayLog.value), unit: habit.unit ?? '' })} tone="solid" /> : null}
      </View>

      <View style={styles.stats}>
        <Stat icon={Flame} label={t('habits.currentStreak')} value={String(derived.streaks.current)} />
        <Stat icon={Trophy} label={t('habits.longestStreak')} value={String(derived.streaks.longest)} />
        <Stat icon={TrendingUp} label={t('habits.consistency30')} value={formatPercent(derived.consistency)} />
      </View>

      <DSCard>
        <SectionHeader title={t('habits.heatmap', { weeks: WEEKS })} right={<Text variant="small" tone="secondary">{t('habits.totalDone', { count: derived.total })}</Text>} />
        <View style={styles.heatmap}>
          {Array.from({ length: WEEKS }, (_, week) => (
            <View key={week} style={styles.heatCol}>
              {cells.slice(week * 7, week * 7 + 7).map((date) => {
                const completed = query.data?.completed.has(date) ?? false;
                const scheduled = isHabitDueOn(habit.scheduleDays, date, false) && date >= habit.startDate;
                return (
                  <View
                    key={date}
                    accessibilityLabel={`${formatDate(date, 'medium')}: ${completed ? t('entry.done') : '—'}`}
                    style={[
                      styles.heatCell,
                      {
                        backgroundColor: date > today ? 'transparent' : completed ? color : scheduled ? palette.elevated : palette.surfaceAlt,
                        borderColor: date === today ? palette.accent : 'transparent',
                      },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </DSCard>

      {habit.notes ? (
        <DSCard>
          <Text variant="label" tone="secondary">
            {t('create.notes')}
          </Text>
          <Text variant="body" style={styles.notes}>
            {habit.notes}
          </Text>
        </DSCard>
      ) : null}

      <View style={styles.actions}>
        <PremiumButton
          label={habit.paused ? t('habits.resume') : t('habits.pause')}
          icon={habit.paused ? Play : Pause}
          variant="secondary"
          size="md"
          style={styles.flex}
          onPress={() => setHabitPaused(habit.id, !habit.paused)}
        />
        <PremiumButton
          label={t('habits.archive')}
          icon={Archive}
          variant="secondary"
          size="md"
          style={styles.flex}
          onPress={async () => {
            await setHabitArchived(habit.id, true);
            toast(t('habits.archived'));
            router.back();
          }}
        />
      </View>
      <PremiumButton label={t('common.delete')} icon={Trash2} variant="danger" size="md" onPress={remove} />
    </Screen>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: string }) {
  const palette = usePalette();
  return (
    <DSCard style={styles.stat} padding={space.md}>
      <Icon size={16} color={palette.accentText} />
      <Text variant="stat" latin>
        {value}
      </Text>
      <Text variant="micro" tone="secondary" numberOfLines={2}>
        {label}
      </Text>
    </DSCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, gap: 4 },
  heatmap: { flexDirection: 'row', gap: 4, marginTop: space.md },
  heatCol: { flex: 1, gap: 4 },
  heatCell: { aspectRatio: 1, borderRadius: radius.xs - 3, borderWidth: 1.5 },
  notes: { marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
});
