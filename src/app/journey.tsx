import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { ArrowRight, CalendarCheck, Flame, Share2, Trophy } from '@/components/ui/icons';

import { AchievementCard } from '@/components/collection/AchievementCard';
import { Emblem } from '@/components/collection/Emblem';
import { SERIES_STYLES } from '@/components/collection/series';
import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/Progress';
import { PressableScale } from '@/components/ui/PressableScale';
import { Pill, Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { listAchievementRecords } from '@/db/repositories/achievementsRepo';
import { activityCountsByDay, listActiveDates } from '@/db/repositories/activityRepo';
import { useToday } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n, type TKey } from '@/i18n';
import { ACHIEVEMENT_COUNT, ACHIEVEMENTS, achievementProgress, type CardSeries } from '@/lib/achievements';
import { addDays, dateRange, startOfWeek } from '@/lib/dates';
import { computeJourneyStats, streakRuns } from '@/lib/journey';
import { usePreferences } from '@/store/preferences';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const HEAT_WEEKS = 16;
type Filter = 'all' | 'earned' | 'locked' | CardSeries;

export default function JourneyScreen() {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { t, formatDate, formatNumber } = useI18n();
  const { preferences } = usePreferences();
  const { width } = useWindowDimensions();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>('all');
  const heatStart = startOfWeek(addDays(today, -(HEAT_WEEKS - 1) * 7), preferences.weekStart);

  const query = useLiveQuery(
    async () => {
      const [dates, records, counts] = await Promise.all([listActiveDates(), listAchievementRecords(), activityCountsByDay(heatStart, today)]);
      return { dates, records, counts };
    },
    ['tasks', 'entry_completions', 'habit_logs', 'day_reviews', 'journal_entries', 'workout_sessions', 'focus_sessions', 'assignments', 'attendance_records', 'achievement_records'],
    [heatStart, today],
  );

  const derived = useMemo(() => {
    if (!query.data) return null;
    const stats = computeJourneyStats(query.data.dates, today);
    const runs = streakRuns(query.data.dates.filter((date) => date <= today));
    const best = runs.reduce<(typeof runs)[number] | null>((top, run) => (!top || run.length > top.length ? run : top), null);
    const byMonth = new Map<string, number>();
    for (const date of query.data.dates) byMonth.set(date.slice(0, 7), (byMonth.get(date.slice(0, 7)) ?? 0) + 1);
    const bestMonth = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const earnedById = new Map(query.data.records.map((record) => [record.achievementId, record]));
    const latest = query.data.records[0] ?? null;
    return { stats, best, bestMonth, earnedById, latest };
  }, [query.data, today]);

  const header = <ScreenHeader title={t('journey.hub')} />;
  if (!query.data || !derived) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }

  const cardWidth = (width - space.gutter * 2 - space.sm) / 2;
  const cards = ACHIEVEMENTS.filter((definition) => {
    const earned = derived.earnedById.has(definition.id);
    if (filter === 'earned') return earned;
    if (filter === 'locked') return !earned;
    if (filter !== 'all') return definition.series === filter;
    return true;
  });
  const latestDefinition = derived.latest ? ACHIEVEMENTS.find((item) => item.id === derived.latest?.achievementId) : undefined;
  const maxCount = Math.max(1, ...Object.values(query.data.counts));
  const cells = dateRange(heatStart, addDays(heatStart, HEAT_WEEKS * 7 - 1));

  return (
    <Screen header={header}>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Text variant="display">{t('journey.title')}</Text>
          <Text variant="body" tone="secondary">
            {t('journey.subtitle')}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <StatCard icon={CalendarCheck} value={derived.stats.activeDays} label={t('journey.activeDays')} sub={t('journey.activeDaysSub')} />
        <StatCard icon={Flame} value={derived.stats.currentStreak} label={t('journey.currentStreak')} sub={derived.stats.activeToday ? t('journey.activeToday') : t('journey.keepGoing')} highlight />
        <StatCard icon={Trophy} value={derived.stats.longestStreak} label={t('journey.longestStreak')} sub={t('journey.recordHigh')} />
      </View>

      <DSCard>
        <View style={styles.rowBetween}>
          <Text variant="label" tone="secondary">
            {t('journey.heatmap', { weeks: HEAT_WEEKS })}
          </Text>
          <View style={styles.legend}>
            <Text variant="micro" tone="muted">
              {t('journey.quiet')}
            </Text>
            {[0.15, 0.45, 1].map((alpha) => (
              <View key={alpha} style={[styles.legendCell, { backgroundColor: palette.accent, opacity: alpha }]} />
            ))}
            <Text variant="micro" tone="muted">
              {t('journey.active')}
            </Text>
          </View>
        </View>
        <View style={styles.heatmap}>
          {Array.from({ length: HEAT_WEEKS }, (_, week) => (
            <View key={week} style={styles.heatCol}>
              {cells.slice(week * 7, week * 7 + 7).map((date) => {
                const count = query.data?.counts[date] ?? 0;
                return (
                  <View
                    key={date}
                    style={[
                      styles.heatCell,
                      {
                        backgroundColor: date > today ? 'transparent' : count ? palette.accent : palette.elevated,
                        opacity: date > today ? 1 : count ? 0.25 + 0.75 * (count / maxCount) : 1,
                      },
                    ]}
                    accessibilityLabel={`${formatDate(date, 'medium')}: ${count}`}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </DSCard>

      {derived.latest && latestDefinition ? (
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(300)}>
          <SectionHeader title={t('journey.latest')} right={<Pill label={formatDate(derived.latest.earnedDate, 'dayMonth')} tone="accent" />} />
          <DSCard glow onPress={() => router.push(`/collection/${latestDefinition.id}`)} accessibilityLabel={t(`achievement.${latestDefinition.id}.name` as TKey)} style={styles.spacedTop}>
            <View style={styles.latest}>
              <View style={[styles.latestArt, { backgroundColor: SERIES_STYLES[latestDefinition.series].background[1] }]}>
                <Emblem kind={latestDefinition.emblem} size={110} metal={SERIES_STYLES[latestDefinition.series].metal} glow={SERIES_STYLES[latestDefinition.series].glow} idSuffix={`latest-${latestDefinition.id}`} />
              </View>
              <View style={styles.flex}>
                <Pill label={t(`series.${latestDefinition.series}` as TKey)} tone="muted" />
                <Text variant="h3" style={styles.latestName}>
                  {t(`achievement.${latestDefinition.id}.name` as TKey)}
                </Text>
                <Text variant="small" tone="secondary" numberOfLines={3}>
                  {t(`achievement.${latestDefinition.id}.description` as TKey)}
                </Text>
              </View>
            </View>
            <View style={styles.latestActions}>
              <PremiumButton label={t('journey.inspect')} iconRight={ArrowRight} size="md" style={styles.flex} onPress={() => router.push(`/collection/${latestDefinition.id}`)} />
              <PremiumButton label={t('journey.share')} icon={Share2} size="md" variant="secondary" style={styles.flex} onPress={() => router.push(`/share/${latestDefinition.id}`)} />
            </View>
          </DSCard>
        </Animated.View>
      ) : (
        <DSCard tone="alt">
          <Text variant="title">{t('journey.firstCardTitle')}</Text>
          <Text variant="small" tone="secondary">
            {t('journey.firstCardBody')}
          </Text>
        </DSCard>
      )}

      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text variant="h2">{t('journey.vault')}</Text>
          <Text variant="small" tone="secondary">
            {t('journey.vaultSub')}
          </Text>
        </View>
        <View style={styles.alignEnd}>
          <Text variant="h3" tone="accent" latin>
            {`${derived.earnedById.size} / ${ACHIEVEMENT_COUNT}`}
          </Text>
          <Text variant="micro" tone="secondary">
            {t('journey.unlocked')}
          </Text>
        </View>
      </View>
      <ProgressBar progress={derived.earnedById.size / ACHIEVEMENT_COUNT} height={8} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
        <DSChip label={t('journey.filterAll')} count={ACHIEVEMENT_COUNT} selected={filter === 'all'} onPress={() => setFilter('all')} size="sm" />
        <DSChip label={t('journey.filterEarned')} count={derived.earnedById.size} selected={filter === 'earned'} onPress={() => setFilter('earned')} size="sm" />
        <DSChip label={t('journey.filterLocked')} count={ACHIEVEMENT_COUNT - derived.earnedById.size} selected={filter === 'locked'} onPress={() => setFilter('locked')} size="sm" />
        {(Object.keys(SERIES_STYLES) as CardSeries[]).map((series) => (
          <DSChip key={series} label={t(`series.${series}` as TKey)} selected={filter === series} onPress={() => setFilter(series)} size="sm" />
        ))}
      </ScrollView>
      <View style={styles.grid}>
        {cards.map((definition) => {
          const record = derived.earnedById.get(definition.id);
          const progress = record ? null : achievementProgress(definition, derived.stats);
          return (
            <PressableScale key={definition.id} onPress={() => router.push(`/collection/${definition.id}`)} accessibilityLabel={t(`achievement.${definition.id}.name` as TKey)} scaleTo={0.96}>
              <AchievementCard
                definition={definition}
                width={cardWidth}
                compact
                earned={record ? { date: record.earnedDate, recordId: record.id, value: record.milestoneValue } : null}
                progress={progress}
              />
              <View style={styles.cardMeta}>
                <Text variant="smallStrong" numberOfLines={1}>
                  {t(`achievement.${definition.id}.name` as TKey)}
                </Text>
                <Text variant="micro" tone={record ? 'accent' : 'muted'} numberOfLines={1}>
                  {record ? t('collection.unlockedOn', { date: formatDate(record.earnedDate, 'dayMonth') }) : progress ? t('collection.progressShort', { current: progress.current, target: progress.target }) : t('collection.locked')}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>

      <DSCard>
        <Text variant="label" tone="secondary">
          {t('journey.bests')}
        </Text>
        <View style={styles.bests}>
          <Best label={t('journey.bestRun')} value={derived.best ? t('journey.bestRunValue', { count: derived.best.length, from: formatDate(derived.best.start, 'dayMonth'), to: formatDate(derived.best.end, 'dayMonth') }) : '—'} />
          <Best label={t('journey.bestMonth')} value={derived.bestMonth ? t('journey.bestMonthValue', { month: formatDate(`${derived.bestMonth[0]}-01`, 'monthYear'), count: formatNumber(derived.bestMonth[1]) }) : '—'} />
          <Best label={t('journey.since')} value={derived.stats.firstActive ? formatDate(derived.stats.firstActive, 'medium') : '—'} />
        </View>
      </DSCard>
    </Screen>
  );
}

function StatCard({ icon: Icon, value, label, sub, highlight }: { icon: typeof Flame; value: number; label: string; sub: string; highlight?: boolean }) {
  const palette = usePalette();
  return (
    <DSCard style={styles.stat} padding={space.md} glow={highlight}>
      <Icon size={17} color={palette.accentText} />
      <Text variant="stat" latin>
        {value}
      </Text>
      <Text variant="micro" tone={highlight ? 'accent' : 'primary'} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="small" tone="secondary" numberOfLines={1}>
        {sub}
      </Text>
    </DSCard>
  );
}

function Best({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.best}>
      <Text variant="small" tone="secondary">
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alignEnd: { alignItems: 'flex-end' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, gap: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendCell: { width: 9, height: 9, borderRadius: 2 },
  heatmap: { flexDirection: 'row', gap: 3, marginTop: space.md },
  heatCol: { flex: 1, gap: 3 },
  heatCell: { aspectRatio: 1, borderRadius: 3 },
  spacedTop: { marginTop: space.sm },
  latest: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  latestArt: { width: 120, height: 140, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  latestName: { marginTop: space.sm, marginBottom: 2 },
  latestActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  chipScroll: { marginHorizontal: -space.gutter, flexGrow: 0 },
  chips: { gap: space.sm, paddingHorizontal: space.gutter },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, rowGap: space.lg },
  cardMeta: { marginTop: space.sm, gap: 2 },
  bests: { gap: space.md, marginTop: space.md },
  best: { gap: 2 },
});
