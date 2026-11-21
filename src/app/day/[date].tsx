import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bell, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Flame, ListChecks, NotebookPen, Timer } from '@/components/ui/icons';

import { ActivityTimeline, buildTimeline } from '@/components/calendar/Timeline';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { IconButton } from '@/components/ui/IconButton';
import { DatePickerSheet } from '@/components/ui/Pickers';
import { PressableScale } from '@/components/ui/PressableScale';
import { Pill, Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { setEntryCompleted } from '@/db/repositories/entriesRepo';
import { focusSecondsByDay } from '@/db/repositories/focusRepo';
import { useClock } from '@/hooks/useClock';
import { useDayData } from '@/hooks/useDayData';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useTaskActions } from '@/hooks/useTaskActions';
import { useI18n, type TKey } from '@/i18n';
import { dayCompletion } from '@/lib/analytics';
import { addDays, isDateKey } from '@/lib/dates';
import { MOODS, moodEmoji } from '@/lib/mood';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { EntryOccurrence } from '@/types/models';

export default function DayScreen() {
  const params = useLocalSearchParams<{ date: string }>();
  const clock = useClock();
  const today = clock.dateKey;
  const date = isDateKey(params.date) ? params.date : today;
  const palette = usePalette();
  const { t, formatDate, formatDuration, formatPercent } = useI18n();
  const { toast } = useFeedback();
  const { toggle } = useTaskActions();
  const [picking, setPicking] = useState(false);
  const day = useDayData(date, today);
  const focus = useLiveQuery(() => focusSecondsByDay(date, date), ['focus_sessions'], [date]);

  const toggleEntry = useCallback(
    (occurrence: EntryOccurrence) => {
      setEntryCompleted(occurrence.entry.id, occurrence.date, !occurrence.completed, today).catch(() => toast(t('error.saveFailed'), { tone: 'error' }));
    },
    [today, toast, t],
  );

  const items = useMemo(() => {
    if (!day.data) return [];
    return buildTimeline({
      date,
      occurrences: day.data.occurrences,
      tasks: day.data.tasks,
      classes: day.data.classes,
      review: day.data.review,
      palette,
      t,
      onToggleTask: toggle,
      onToggleEntry: toggleEntry,
    });
  }, [day.data, date, palette, t, toggle, toggleEntry]);

  const go = (target: string) => router.setParams({ date: target });
  const data = day.data;
  const completion = data ? dayCompletion(data) : null;
  const review = data?.review ?? null;

  const header = (
    <ScreenHeader
      actions={
        <>
          <IconButton icon={ChevronLeft} label={t('calendar.previousDay')} onPress={() => go(addDays(date, -1))} size={40} />
          <IconButton icon={ChevronRight} label={t('calendar.nextDay')} onPress={() => go(addDays(date, 1))} size={40} />
        </>
      }
    />
  );

  return (
    <Screen header={header}>
      <PressableScale onPress={() => setPicking(true)} accessibilityLabel={t('picker.pickDate')} style={styles.titleRow}>
        <Text variant="h1" accessibilityRole="header">
          {formatDate(date, 'long')}
        </Text>
        <CalendarDays size={20} color={palette.textSecondary} />
      </PressableScale>
      <View style={styles.pills}>
        {review ? <Pill label={`${moodEmoji(review.mood)} ${t(`mood.level${review.mood}` as TKey)}`} tone="accent" /> : null}
        {completion != null ? <Pill label={t('day.completed', { percent: formatPercent(completion) })} tone="muted" /> : null}
        {date === today ? <Pill label={t('common.today')} tone="solid" /> : null}
      </View>

      {!data ? (
        <LoadingState />
      ) : (
        <>
          <DSCard glow>
            <Text variant="label" tone="secondary">
              {t('day.summary')}
            </Text>
            <View style={styles.tiles}>
              <Tile icon={ListChecks} label={t('day.tasks')} value={`${data.tasksDone}/${data.tasksPlanned}`} />
              <Tile icon={Timer} label={t('day.focus')} value={formatDuration(focus.data?.[date] ?? 0)} accent />
              <Tile icon={Flame} label={t('day.habits')} value={`${data.habitsDone}/${data.habitsPlanned}`} />
              <Tile icon={CalendarDays} label={t('day.blocks')} value={String(data.occurrences.length + data.classes.length)} />
            </View>
            {review?.remark ? (
              <PressableScale onPress={() => router.push(`/mood/${date}`)} accessibilityLabel={t('day.reflection')} style={[styles.reflection, { backgroundColor: palette.surfaceAlt }]}>
                <NotebookPen size={16} color={palette.accentText} />
                <Text variant="small" tone="secondary" numberOfLines={2} style={styles.flex}>
                  “{review.remark}”
                </Text>
              </PressableScale>
            ) : null}
          </DSCard>

          <SectionHeader title={t('day.timeline')} />
          {items.length === 0 ? (
            <EmptyState
              compact
              icon={CalendarPlus}
              title={t('calendar.emptyTitle')}
              message={t('calendar.emptyBody')}
              actionLabel={t('calendar.addHere')}
              onAction={() => router.push({ pathname: '/create', params: { type: 'event', date } })}
            />
          ) : (
            <ActivityTimeline items={items} nowMinute={date === today ? clock.minute : null} />
          )}

          {date <= today ? (
            <DSCard>
              <View style={styles.moodHeader}>
                <Text variant="title">{date === today ? t('day.moodQuestionToday') : t('day.moodQuestionPast')}</Text>
                {review ? (
                  <Text variant="smallStrong" tone="accent">
                    {t('day.moodRecorded')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.moods}>
                {MOODS.map((mood) => {
                  const selected = review?.mood === mood.level;
                  return (
                    <PressableScale
                      key={mood.level}
                      onPress={() => router.push({ pathname: '/mood', params: { date, mood: String(mood.level) } })}
                      haptic="selection"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t(mood.label)}
                      style={[styles.mood, { backgroundColor: selected ? palette.accentMuted : 'transparent' }]}
                    >
                      <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                      <Text variant="micro" color={selected ? palette.accentText : palette.textSecondary} numberOfLines={1}>
                        {t(mood.label)}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </DSCard>
          ) : null}

          <View style={styles.quick}>
            <DSChip label={t('timeline.task')} icon={ListChecks} onPress={() => router.push({ pathname: '/create', params: { type: 'task', date } })} />
            <DSChip label={t('timeline.event')} icon={CalendarDays} onPress={() => router.push({ pathname: '/create', params: { type: 'event', date } })} />
            <DSChip label={t('timeline.reminder')} icon={Bell} onPress={() => router.push({ pathname: '/create', params: { type: 'reminder', date } })} />
            <DSChip label={t('timeline.note')} icon={NotebookPen} selected onPress={() => router.push({ pathname: '/create', params: { type: 'note', date } })} />
          </View>
        </>
      )}
      <DatePickerSheet visible={picking} value={date} onClose={() => setPicking(false)} onChange={go} />
    </Screen>
  );
}

function Tile({ icon: Icon, label, value, accent }: { icon: typeof ListChecks; label: string; value: string; accent?: boolean }) {
  const palette = usePalette();
  return (
    <View style={[styles.tile, { backgroundColor: palette.surfaceAlt }]}>
      <View style={styles.tileTop}>
        <Text variant="small" tone="secondary">
          {label}
        </Text>
        <Icon size={15} color={palette.accentText} />
      </View>
      <Text variant="stat" latin tone={accent ? 'accent' : 'primary'} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pills: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  tile: { width: '48.5%', padding: space.md, borderRadius: radius.md, gap: 4 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reflection: { flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.md, borderRadius: radius.md, marginTop: space.md },
  moodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  moods: { flexDirection: 'row', marginTop: space.md },
  mood: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.md, gap: 4 },
  moodEmoji: { fontSize: 28, lineHeight: 36 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
});
