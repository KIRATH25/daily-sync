import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import { CalendarPlus, ChevronLeft, ChevronRight, Filter, Search } from '@/components/ui/icons';

import { MonthGrid, type DayMarker } from '@/components/calendar/MonthGrid';
import { ActivityTimeline, buildTimeline, type TimelineKind } from '@/components/calendar/Timeline';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { DSBottomSheet } from '@/components/ui/Sheet';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { listOccurrences, setEntryCompleted } from '@/db/repositories/entriesRepo';
import { listReviews } from '@/db/repositories/reviewsRepo';
import { listTasksInRange } from '@/db/repositories/tasksRepo';
import { listSlots } from '@/db/repositories/timetableRepo';
import { useClock } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useTaskActions } from '@/hooks/useTaskActions';
import { useI18n, type TKey } from '@/i18n';
import { addDays, addMonths, dateRange, makeDateKey, monthGrid, parseDateKey, weekDays, weekdayOf, type DateKey } from '@/lib/dates';
import { moodEmoji } from '@/lib/mood';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { EntryOccurrence } from '@/types/models';

type View_ = 'month' | 'week' | 'day' | 'agenda';
const FILTERABLE: TimelineKind[] = ['event', 'task', 'class', 'reminder', 'workout', 'note', 'goal', 'mood'];

export default function CalendarScreen() {
  const palette = usePalette();
  const { t, formatDate } = useI18n();
  const { preferences } = usePreferences();
  const { toast } = useFeedback();
  const clock = useClock();
  const today = clock.dateKey;
  const { toggle: toggleTask } = useTaskActions();
  const [mode, setMode] = useState<View_>('month');
  const [selected, setSelected] = useState<DateKey>(today);
  const [cursor, setCursor] = useState<DateKey>(today);
  const [filters, setFilters] = useState<Set<TimelineKind>>(new Set(FILTERABLE));
  const [filterOpen, setFilterOpen] = useState(false);

  const { year, month } = parseDateKey(cursor);
  const range = useMemo(() => {
    if (mode === 'agenda') return { from: today, to: addDays(today, 30) };
    if (mode === 'week') {
      const days = weekDays(selected, preferences.weekStart);
      return { from: days[0] ?? selected, to: days[6] ?? selected };
    }
    if (mode === 'day') return { from: selected, to: selected };
    const grid = monthGrid(year, month, preferences.weekStart);
    return { from: grid[0] ?? cursor, to: grid[grid.length - 1] ?? cursor };
  }, [mode, today, selected, year, month, cursor, preferences.weekStart]);

  const query = useLiveQuery(
    async () => {
      const [occurrences, tasks, reviews, slots] = await Promise.all([
        listOccurrences(range.from, range.to),
        listTasksInRange(range.from, range.to),
        listReviews(range.from, range.to),
        listSlots(),
      ]);
      return { occurrences, tasks, reviews, slots };
    },
    ['calendar_entries', 'entry_completions', 'tasks', 'day_reviews', 'timetable_slots', 'subjects'],
    [range.from, range.to],
  );

  const toggleEntry = useCallback(
    (occurrence: EntryOccurrence) => {
      setEntryCompleted(occurrence.entry.id, occurrence.date, !occurrence.completed, today).catch(() =>
        toast(t('error.saveFailed'), { tone: 'error' }),
      );
    },
    [today, toast, t],
  );

  const itemsFor = useCallback(
    (date: DateKey) => {
      const data = query.data;
      if (!data) return [];
      return buildTimeline({
        date,
        occurrences: data.occurrences.filter((occ) => occ.date === date),
        tasks: data.tasks,
        classes: data.slots.filter((slot) => slot.weekday === weekdayOf(date)),
        review: data.reviews.find((review) => review.date === date) ?? null,
        palette,
        t,
        onToggleTask: toggleTask,
        onToggleEntry: toggleEntry,
      }).filter((item) => filters.has(item.kind));
    },
    [query.data, palette, t, toggleTask, toggleEntry, filters],
  );

  const markers = useMemo(() => {
    const data = query.data;
    const result: Record<DateKey, DayMarker> = {};
    if (!data) return result;
    const add = (date: DateKey, color: string) => {
      const marker = (result[date] ??= { colors: [] });
      if (!marker.colors.includes(color)) marker.colors.push(color);
    };
    if (filters.has('event') || filters.has('reminder') || filters.has('workout')) {
      for (const occ of data.occurrences) {
        if (filters.has(occ.entry.kind)) add(occ.date, occ.entry.color ?? palette.category[occ.entry.category]);
      }
    }
    if (filters.has('task')) for (const task of data.tasks) if (task.dueDate) add(task.dueDate, palette.priority[task.priority]);
    if (filters.has('class') && data.slots.length) {
      for (const date of dateRange(range.from, range.to)) {
        if (data.slots.some((slot) => slot.weekday === weekdayOf(date))) add(date, palette.category.academics);
      }
    }
    if (filters.has('mood')) {
      for (const review of data.reviews) {
        const marker = (result[review.date] ??= { colors: [] });
        marker.mood = moodEmoji(review.mood);
      }
    }
    return result;
  }, [query.data, palette, filters, range.from, range.to]);

  const selectDate = (date: DateKey) => {
    setSelected(date);
    if (parseDateKey(date).month !== month) setCursor(date);
  };

  const shift = (direction: 1 | -1) => {
    if (mode === 'month') setCursor(addMonths(cursor, direction));
    else if (mode === 'week') setSelected(addDays(selected, 7 * direction));
    else if (mode === 'day') setSelected(addDays(selected, direction));
  };

  const goToday = () => {
    setSelected(today);
    setCursor(today);
  };

  const title = mode === 'month' ? formatDate(makeDateKey(year, month, 1), 'monthYear') : mode === 'agenda' ? t('calendar.agenda') : formatDate(selected, mode === 'day' ? 'long' : 'monthYear');
  const selectedItems = itemsFor(selected);

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Segmented<View_>
          options={[
            { value: 'month', label: t('calendar.month') },
            { value: 'week', label: t('calendar.week') },
            { value: 'day', label: t('calendar.day') },
            { value: 'agenda', label: t('calendar.agenda') },
          ]}
          value={mode}
          onChange={setMode}
          accent
          size="sm"
          style={styles.flex}
        />
        <IconButton icon={Search} label={t('search.title')} onPress={() => router.push('/search')} size={40} />
        <IconButton icon={Filter} label={t('calendar.filter')} onPress={() => setFilterOpen(true)} size={40} badge={filters.size < FILTERABLE.length} />
      </View>
      <View style={styles.headerRow}>
        <Text variant="h2" style={styles.flex} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <PressableScale onPress={goToday} accessibilityLabel={t('common.today')} style={[styles.todayBtn, { backgroundColor: palette.accentMuted }]}>
          <Text variant="smallStrong" tone="accent">
            {t('common.today')}
          </Text>
        </PressableScale>
        {mode !== 'agenda' ? (
          <>
            <IconButton icon={ChevronLeft} label={t('calendar.previous')} onPress={() => shift(-1)} size={38} />
            <IconButton icon={ChevronRight} label={t('calendar.next')} onPress={() => shift(1)} size={38} />
          </>
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen header={header} withTabBar>
      {query.loading && !query.data ? (
        <LoadingState rows={3} />
      ) : mode === 'month' ? (
        <>
          <DSCard padding={space.sm}>
            <MonthGrid year={year} month={month} selected={selected} today={today} weekStart={preferences.weekStart} onSelect={selectDate} markers={markers} />
            <Legend />
          </DSCard>
          <DaySection date={selected} today={today} count={selectedItems.length} onOpen={() => router.push(`/day/${selected}`)} />
          <DayList items={selectedItems} date={selected} today={today} nowMinute={selected === today ? clock.minute : null} />
        </>
      ) : mode === 'week' ? (
        <>
          <WeekStrip days={weekDays(selected, preferences.weekStart)} selected={selected} today={today} onSelect={setSelected} markers={markers} />
          <DaySection date={selected} today={today} count={selectedItems.length} onOpen={() => router.push(`/day/${selected}`)} />
          <DayList items={selectedItems} date={selected} today={today} nowMinute={selected === today ? clock.minute : null} />
        </>
      ) : mode === 'day' ? (
        <>
          <DaySection date={selected} today={today} count={selectedItems.length} onOpen={() => router.push(`/day/${selected}`)} />
          <DayList items={selectedItems} date={selected} today={today} nowMinute={selected === today ? clock.minute : null} />
        </>
      ) : (
        <Agenda from={range.from} to={range.to} itemsFor={itemsFor} today={today} />
      )}

      <DSBottomSheet visible={filterOpen} onClose={() => setFilterOpen(false)} title={t('calendar.filter')} subtitle={t('calendar.filterBody')}>
        <View style={styles.filters}>
          {FILTERABLE.map((kind) => (
            <DSChip
              key={kind}
              label={t(`timeline.${kind}` as TKey)}
              selected={filters.has(kind)}
              onPress={() => {
                const next = new Set(filters);
                if (next.has(kind)) next.delete(kind);
                else next.add(kind);
                setFilters(next);
              }}
            />
          ))}
        </View>
        <DSChip label={t('calendar.showAll')} onPress={() => setFilters(new Set(FILTERABLE))} />
      </DSBottomSheet>
    </Screen>
  );
}

function Legend() {
  const palette = usePalette();
  const { t } = useI18n();
  const entries: [string, TKey][] = [
    [palette.category.academics, 'category.academics'],
    [palette.priority.critical, 'calendar.legendPriority'],
    [palette.category.personal, 'category.personal'],
    [palette.category.fitness, 'category.fitness'],
    [palette.category.mindful, 'category.mindful'],
  ];
  return (
    <View style={styles.legend}>
      {entries.map(([color, label]) => (
        <View key={label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: color }]} />
          <Text variant="micro" tone="secondary">
            {t(label)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function DaySection({ date, today, count, onOpen }: { date: DateKey; today: DateKey; count: number; onOpen: () => void }) {
  const { t, formatDate, tp } = useI18n();
  return (
    <PressableScale onPress={onOpen} accessibilityLabel={t('calendar.openDay')} style={styles.daySection}>
      <View style={styles.flex}>
        <Text variant="h3">{date === today ? t('calendar.todayTitle', { date: formatDate(date, 'dayMonth') }) : formatDate(date, 'long')}</Text>
        <Text variant="small" tone="secondary">
          {tp('calendar.items', count)}
        </Text>
      </View>
      <Text variant="smallStrong" tone="accent">
        {t('calendar.openDay')}
      </Text>
    </PressableScale>
  );
}

function DayList({ items, date, today, nowMinute }: { items: ReturnType<typeof buildTimeline>; date: DateKey; today: DateKey; nowMinute: number | null }) {
  const { t } = useI18n();
  if (items.length === 0) {
    return (
      <EmptyState
        compact
        icon={CalendarPlus}
        title={date < today ? t('calendar.emptyPast') : t('calendar.emptyTitle')}
        message={t('calendar.emptyBody')}
        actionLabel={t('calendar.addHere')}
        onAction={() => router.push({ pathname: '/create', params: { type: 'event', date } })}
      />
    );
  }
  return (
    <Animated.View entering={FadeIn.duration(200)} key={date}>
      <ActivityTimeline items={items} nowMinute={nowMinute} />
    </Animated.View>
  );
}

function WeekStrip({
  days,
  selected,
  today,
  onSelect,
  markers,
}: {
  days: DateKey[];
  selected: DateKey;
  today: DateKey;
  onSelect: (date: DateKey) => void;
  markers: Record<DateKey, DayMarker>;
}) {
  const palette = usePalette();
  const { weekdayName, formatDate } = useI18n();
  return (
    <View style={[styles.weekStrip, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {days.map((date) => {
        const active = date === selected;
        const marker = markers[date];
        return (
          <PressableScale
            key={date}
            onPress={() => onSelect(date)}
            haptic="selection"
            accessibilityState={{ selected: active }}
            accessibilityLabel={formatDate(date, 'full')}
            style={[styles.weekDay, active && { backgroundColor: palette.accent }]}
          >
            <Text variant="micro" color={active ? palette.onAccent : date === today ? palette.accentText : palette.textSecondary}>
              {weekdayName(weekdayOf(date), 'short')}
            </Text>
            <Text variant="h3" latin color={active ? palette.onAccent : palette.text}>
              {parseDateKey(date).day}
            </Text>
            <View style={styles.weekDots}>
              {marker?.mood ? (
                <Text style={styles.weekMood}>{marker.mood}</Text>
              ) : (
                marker?.colors.slice(0, 3).map((color, index) => <View key={index} style={[styles.weekDot, { backgroundColor: active ? palette.onAccent : color }]} />)
              )}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

function Agenda({ from, to, itemsFor, today }: { from: DateKey; to: DateKey; itemsFor: (date: DateKey) => ReturnType<typeof buildTimeline>; today: DateKey }) {
  const { t, formatDate } = useI18n();
  const days = dateRange(from, to)
    .map((date) => ({ date, items: itemsFor(date) }))
    .filter((day) => day.items.length > 0);
  if (days.length === 0) {
    return <EmptyState icon={CalendarPlus} title={t('calendar.agendaEmpty')} message={t('calendar.emptyBody')} actionLabel={t('calendar.addHere')} onAction={() => router.push('/quick-add')} />;
  }
  return (
    <View style={styles.agenda}>
      {days.map((day) => (
        <View key={day.date} style={styles.agendaDay}>
          <PressableScale onPress={() => router.push(`/day/${day.date}`)} accessibilityLabel={formatDate(day.date, 'full')}>
            <Text variant="label" tone={day.date === today ? 'accent' : 'secondary'}>
              {day.date === today ? t('calendar.todayTitle', { date: formatDate(day.date, 'dayMonth') }) : formatDate(day.date, 'long')}
            </Text>
          </PressableScale>
          <ActivityTimeline items={day.items} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: space.gutter, paddingTop: space.sm, gap: space.md, paddingBottom: space.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  todayBtn: { paddingHorizontal: space.md, height: 34, borderRadius: radius.pill, justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  daySection: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  weekStrip: { flexDirection: 'row', borderRadius: radius.lg, padding: 6, borderWidth: StyleSheet.hairlineWidth },
  weekDay: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.md, gap: 2 },
  weekDots: { flexDirection: 'row', gap: 2, height: 12, alignItems: 'center' },
  weekDot: { width: 4, height: 4, borderRadius: 2 },
  weekMood: { fontSize: 10, lineHeight: 12 },
  agenda: { gap: space.lg },
  agendaDay: { gap: space.sm },
});
