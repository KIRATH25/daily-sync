import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, BookOpen, CalendarDays, Flame, GraduationCap, Hourglass, ListChecks, Search, X, type LucideIcon } from '@/components/ui/icons';

import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { Pill } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { listCountdowns } from '@/db/repositories/countdownsRepo';
import { searchEntries } from '@/db/repositories/entriesRepo';
import { listHabits } from '@/db/repositories/habitsRepo';
import { searchJournal } from '@/db/repositories/journalRepo';
import { searchTasks } from '@/db/repositories/tasksRepo';
import { listAssignments, listSubjects } from '@/db/repositories/timetableRepo';
import { useI18n, type TKey } from '@/i18n';
import { readLockSettings } from '@/services/security';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';

type Scope = 'all' | 'tasks' | 'events' | 'habits' | 'college' | 'journal' | 'countdowns';

interface Result {
  key: string;
  scope: Exclude<Scope, 'all'>;
  title: string;
  subtitle: string | null;
  route: string;
}

const SCOPE_ICON: Record<Exclude<Scope, 'all'>, LucideIcon> = {
  tasks: ListChecks,
  events: CalendarDays,
  habits: Flame,
  college: GraduationCap,
  journal: BookOpen,
  countdowns: Hourglass,
};

export default function SearchScreen() {
  const palette = usePalette();
  const { t, formatDate } = useI18n();
  const { preferences } = usePreferences();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  // Results are stored with the query they belong to, so stale results are never shown.
  const [found, setFound] = useState<{ query: string; results: Result[] } | null>(null);
  const trimmed = query.trim();
  const results = useMemo(() => (found && found.query === trimmed ? found.results : []), [found, trimmed]);
  const searching = trimmed.length >= 2 && found?.query !== trimmed;

  // Debounced search across modules. Journal content is excluded while the journal is locked.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const lower = text.toLowerCase();
      const locks = await readLockSettings();
      const [tasks, entries, habits, subjects, assignments, journal, countdowns] = await Promise.all([
        searchTasks(text),
        searchEntries(text),
        listHabits(true),
        listSubjects(),
        listAssignments(true),
        locks.journalLock ? Promise.resolve([]) : searchJournal(text),
        listCountdowns(),
      ]);
      if (cancelled) return;
      const next: Result[] = [
        ...tasks.map((task) => ({ key: `t${task.id}`, scope: 'tasks' as const, title: task.title, subtitle: task.dueDate ? formatDate(task.dueDate, 'medium') : null, route: `/tasks/${task.id}` })),
        ...entries.map((entry) => ({ key: `e${entry.id}`, scope: 'events' as const, title: entry.title, subtitle: [formatDate(entry.startDate, 'medium'), entry.location].filter(Boolean).join(' · '), route: `/entry/${entry.id}` })),
        ...habits.filter((habit) => habit.title.toLowerCase().includes(lower)).map((habit) => ({ key: `h${habit.id}`, scope: 'habits' as const, title: habit.title, subtitle: null, route: `/habits/${habit.id}` })),
        ...subjects
          .filter((subject) => subject.name.toLowerCase().includes(lower) || (subject.professor ?? '').toLowerCase().includes(lower))
          .map((subject) => ({ key: `s${subject.id}`, scope: 'college' as const, title: subject.name, subtitle: subject.professor, route: '/timetable' })),
        ...assignments.filter((item) => item.title.toLowerCase().includes(lower)).map((item) => ({ key: `a${item.id}`, scope: 'college' as const, title: item.title, subtitle: formatDate(item.dueDate, 'medium'), route: '/timetable' })),
        ...journal.map((entry) => ({ key: `j${entry.id}`, scope: 'journal' as const, title: entry.title ?? formatDate(entry.date, 'long'), subtitle: entry.body.slice(0, 90), route: `/journal/${entry.id}` })),
        ...countdowns.filter((item) => item.title.toLowerCase().includes(lower)).map((item) => ({ key: `c${item.id}`, scope: 'countdowns' as const, title: item.title, subtitle: formatDate(item.targetDate, 'medium'), route: `/countdowns/${item.id}` })),
      ];
      setFound({ query: text, results: next });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, formatDate]);

  const visible = useMemo(() => (scope === 'all' ? results : results.filter((result) => result.scope === scope)), [results, scope]);
  const counts = useMemo(() => {
    const map: Partial<Record<Scope, number>> = { all: results.length };
    for (const result of results) map[result.scope] = (map[result.scope] ?? 0) + 1;
    return map;
  }, [results]);

  return (
    <View style={[styles.root, { backgroundColor: palette.background, paddingTop: insets.top + space.sm }]}>
      <View style={styles.bar}>
        <IconButton icon={ArrowLeft} label={t('common.back')} onPress={() => router.back()} size={42} />
        <View style={[styles.input, { backgroundColor: palette.surfaceAlt, borderColor: palette.accent }]}>
          <Search size={18} color={palette.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={palette.textMuted}
            autoFocus
            returnKeyType="search"
            style={[styles.field, { color: palette.text, fontFamily: preferences.language === 'hi' ? fonts.hindiRegular : fonts.bodyMedium }]}
            accessibilityLabel={t('search.placeholder')}
            maxFontSizeMultiplier={1.3}
          />
          {query ? <IconButton icon={X} label={t('common.clear')} onPress={() => setQuery('')} variant="plain" size={34} /> : null}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipRow}>
        {(['all', 'tasks', 'events', 'habits', 'college', 'journal', 'countdowns'] as Scope[]).map((value) => (
          <DSChip key={value} label={t(`search.scope.${value}` as TKey)} count={query.trim().length >= 2 ? (counts[value] ?? 0) : undefined} selected={scope === value} onPress={() => setScope(value)} size="sm" />
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={[styles.results, { paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
        {query.trim().length < 2 ? (
          <EmptyState icon={Search} title={t('search.startTitle')} message={t('search.startBody')} />
        ) : !searching && visible.length === 0 ? (
          <EmptyState icon={Search} title={t('search.noneTitle')} message={t('search.noneBody')} />
        ) : (
          visible.map((result) => {
            const Icon = SCOPE_ICON[result.scope];
            return (
              <DSCard key={result.key} onPress={() => router.push(result.route as never)} accessibilityLabel={result.title} padding={space.md}>
                <View style={styles.result}>
                  <View style={[styles.icon, { backgroundColor: palette.surfaceAlt }]}>
                    <Icon size={18} color={palette.accentText} />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="title" numberOfLines={1}>
                      {result.title}
                    </Text>
                    {result.subtitle ? (
                      <Text variant="small" tone="secondary" numberOfLines={2}>
                        {result.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <Pill label={t(`search.scope.${result.scope}` as TKey)} tone="muted" />
                </View>
              </DSCard>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.gutter },
  input: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 50, borderRadius: radius.md, paddingLeft: space.md, borderWidth: 1.5 },
  field: { flex: 1, fontSize: 15.5, height: 48 },
  chipRow: { flexGrow: 0, marginTop: space.md },
  chips: { gap: space.sm, paddingHorizontal: space.gutter },
  results: { padding: space.gutter, gap: space.sm },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
