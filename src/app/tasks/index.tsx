import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowUp, ArrowUpDown, CalendarClock, ListChecks, Search, X, Zap } from '@/components/ui/icons';

import { TaskRow } from '@/components/tasks/TaskRow';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { IconButton } from '@/components/ui/IconButton';
import { ProgressRing } from '@/components/ui/Progress';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { createTask, listTasks, rescheduleTasks } from '@/db/repositories/tasksRepo';
import { useClock } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useTaskActions } from '@/hooks/useTaskActions';
import { useI18n, type TKey } from '@/i18n';
import { LIMITS, validateTitle } from '@/lib/validation';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { PRIORITIES, type Priority, type Task } from '@/types/models';

type Tab = 'today' | 'upcoming' | 'overdue' | 'completed' | 'all';
const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default function TasksScreen() {
  const palette = usePalette();
  const { t, formatPercent } = useI18n();
  const { preferences } = usePreferences();
  const { toast } = useFeedback();
  const clock = useClock();
  const today = clock.dateKey;
  const { toggle } = useTaskActions();
  const [tab, setTab] = useState<Tab>('today');
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
  const [sortBy, setSortBy] = useState<'due' | 'priority'>('due');
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState('');
  const tasks = useLiveQuery(listTasks, ['tasks', 'task_subtasks'], []);

  const groups = useMemo(() => {
    const all = tasks.data ?? [];
    const isOverdue = (task: Task) =>
      task.completedAt == null &&
      task.dueDate != null &&
      (task.dueDate < today || (task.dueDate === today && task.dueMinute != null && task.dueMinute < clock.minute));
    return {
      today: all.filter((task) => (task.dueDate === today && task.completedAt == null && !isOverdue(task)) || (task.dueDate == null && task.completedAt == null)),
      upcoming: all.filter((task) => task.completedAt == null && task.dueDate != null && task.dueDate > today),
      overdue: all.filter(isOverdue),
      completed: all.filter((task) => task.completedAt != null).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
      all,
      dueToday: all.filter((task) => task.dueDate === today),
    };
  }, [tasks.data, today, clock.minute]);

  const visible = useMemo(() => {
    let list = groups[tab];
    if (priorityFilter) list = list.filter((task) => task.priority === priorityFilter);
    const query = search.trim().toLowerCase();
    if (query) list = list.filter((task) => task.title.toLowerCase().includes(query) || (task.notes ?? '').toLowerCase().includes(query));
    if (sortBy === 'priority' && tab !== 'completed') list = [...list].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    return list;
  }, [groups, tab, priorityFilter, search, sortBy]);

  const dueTodayDone = groups.dueToday.filter((task) => task.completedAt != null).length;
  const ratio = groups.dueToday.length ? dueTodayDone / groups.dueToday.length : 0;

  const addQuick = async () => {
    const title = validateTitle(quick);
    if (!title.ok) return;
    try {
      await createTask({ title: title.value, notes: null, priority: 'medium', category: 'personal', dueDate: today, dueMinute: null, recurrence: null, reminderOffsets: [], popupMessage: null });
      setQuick('');
      toast(t('quick.taskAdded'));
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    }
  };

  const moveOverdue = async () => {
    const ids = groups.overdue.map((task) => task.id);
    try {
      await rescheduleTasks(ids, today);
      toast(t('tasks.movedToToday', { count: ids.length }));
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    }
  };

  const tabs: { value: Tab; count: number; danger?: boolean }[] = [
    { value: 'today', count: groups.today.length },
    { value: 'upcoming', count: groups.upcoming.length },
    { value: 'overdue', count: groups.overdue.length, danger: true },
    { value: 'completed', count: groups.completed.length },
    { value: 'all', count: groups.all.length },
  ];

  const header = (
    <>
      <ScreenHeader
        title={t('tasks.title')}
        actions={
          <>
            <IconButton icon={searching ? X : Search} label={t('search.title')} onPress={() => { setSearching(!searching); setSearch(''); }} size={42} />
            <IconButton icon={ArrowUpDown} label={t('tasks.sort')} onPress={() => setSortBy(sortBy === 'due' ? 'priority' : 'due')} size={42} variant={sortBy === 'priority' ? 'soft' : 'surface'} />
          </>
        }
      />
      {searching ? (
        <View style={[styles.search, { backgroundColor: palette.surfaceAlt }]}>
          <Search size={18} color={palette.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('tasks.searchPlaceholder')}
            placeholderTextColor={palette.textMuted}
            autoFocus
            style={[styles.searchInput, { color: palette.text, fontFamily: preferences.language === 'hi' ? fonts.hindiRegular : fonts.bodyMedium }]}
            accessibilityLabel={t('tasks.searchPlaceholder')}
          />
        </View>
      ) : null}
    </>
  );

  const footer = (
    <View style={[styles.quick, { backgroundColor: palette.surfaceAlt }]}>
      <TextInput
        value={quick}
        onChangeText={setQuick}
        placeholder={t('tasks.quickPlaceholder')}
        placeholderTextColor={palette.textMuted}
        maxLength={LIMITS.title}
        returnKeyType="done"
        onSubmitEditing={addQuick}
        style={[styles.quickInput, { color: palette.text, fontFamily: preferences.language === 'hi' ? fonts.hindiRegular : fonts.bodyMedium }]}
        accessibilityLabel={t('tasks.quickPlaceholder')}
        selectionColor={palette.accent}
      />
      <IconButton icon={ArrowUp} label={t('tasks.add')} onPress={addQuick} variant="accent" size={42} disabled={!quick.trim()} haptic="light" />
    </View>
  );

  return (
    <Screen header={header} footer={footer}>
      {tasks.loading && !tasks.data ? (
        <LoadingState />
      ) : (
        <>
          <DSCard glow>
            <View style={styles.momentum}>
              <View style={styles.flex}>
                <Text variant="label" tone="secondary">
                  {t('tasks.momentum')}
                </Text>
                <View style={styles.inline}>
                  <Text variant="statLarge" latin>
                    {groups.dueToday.length ? formatPercent(ratio) : '—'}
                  </Text>
                  <Text variant="h3" tone="secondary">
                    {t('tasks.done')}
                  </Text>
                </View>
                <Text variant="small" tone="secondary">
                  {t('tasks.todayProgress', { done: dueTodayDone, total: groups.dueToday.length })}
                </Text>
              </View>
              <ProgressRing progress={ratio} size={86} stroke={8}>
                <Zap size={22} color={palette.accentText} />
              </ProgressRing>
            </View>
            <View style={styles.stats}>
              <Stat label={t('tasks.statTotal')} value={groups.all.length} />
              <Stat label={t('tasks.statClosed')} value={groups.completed.length} accent />
              <Stat label={t('tasks.statLeft')} value={groups.today.length + groups.upcoming.length} />
              <Stat label={t('tasks.statOverdue')} value={groups.overdue.length} danger={groups.overdue.length > 0} />
            </View>
            {groups.overdue.length > 0 ? (
              <PressableScale onPress={moveOverdue} accessibilityLabel={t('tasks.moveOverdue', { count: groups.overdue.length })} style={[styles.reschedule, { backgroundColor: palette.surfaceAlt }]}>
                <CalendarClock size={18} color={palette.dangerText} />
                <Text variant="bodyStrong" style={styles.flex}>
                  {t('tasks.moveOverdue', { count: groups.overdue.length })}
                </Text>
                <View style={[styles.slotBtn, { backgroundColor: palette.accent }]}>
                  <Text variant="micro" color={palette.onAccent}>
                    {t('tasks.moveNow')}
                  </Text>
                </View>
              </PressableScale>
            ) : null}
          </DSCard>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
            {tabs.map((item) => (
              <DSChip key={item.value} label={t(`tasks.tab.${item.value}` as TKey)} count={item.count} selected={tab === item.value} onPress={() => setTab(item.value)} tone={item.danger && item.count > 0 ? 'danger' : 'default'} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
            <DSChip label={t('tasks.allPriorities')} selected={priorityFilter === null} onPress={() => setPriorityFilter(null)} size="sm" />
            {PRIORITIES.map((value) => (
              <DSChip key={value} label={t(`priority.${value}` as TKey)} dot={palette.priority[value]} selected={priorityFilter === value} onPress={() => setPriorityFilter(priorityFilter === value ? null : value)} size="sm" />
            ))}
          </ScrollView>

          {visible.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title={t(search ? 'tasks.noResults' : `tasks.empty.${tab}` as TKey)}
              message={search ? undefined : t('tasks.emptyBody')}
              actionLabel={search ? undefined : t('tasks.add')}
              onAction={() => router.push({ pathname: '/create', params: { type: 'task' } })}
            />
          ) : (
            <View style={styles.list}>
              {visible.map((task) => (
                <TaskRow key={task.id} task={task} today={today} nowMinute={clock.minute} onToggle={toggle} />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, accent, danger }: { label: string; value: number; accent?: boolean; danger?: boolean }) {
  const palette = usePalette();
  return (
    <View style={[styles.stat, { backgroundColor: danger ? palette.dangerSoft : palette.surfaceAlt }]}>
      <Text variant="h2" latin tone={danger ? 'danger' : accent ? 'accent' : 'primary'}>
        {value}
      </Text>
      <Text variant="micro" tone={danger ? 'danger' : 'secondary'} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.gutter, marginBottom: space.sm, paddingHorizontal: space.md, height: 48, borderRadius: radius.md },
  searchInput: { flex: 1, fontSize: 15 },
  momentum: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  stat: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.md, gap: 2 },
  reschedule: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, marginTop: space.md },
  slotBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  chipScroll: { marginHorizontal: -space.gutter, flexGrow: 0 },
  chips: { gap: space.sm, paddingHorizontal: space.gutter },
  list: { gap: space.sm },
  quick: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.lg, paddingLeft: space.lg, paddingRight: 6, height: 56 },
  quickInput: { flex: 1, fontSize: 15, height: 52 },
});
