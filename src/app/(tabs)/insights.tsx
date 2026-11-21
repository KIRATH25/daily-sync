import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Activity, CalendarDays, Dumbbell, Flame, ListChecks, Quote, Smile, Sparkles, Timer, Zap } from '@/components/ui/icons';

import { BarChart, LineChart, StackedBar } from '@/components/insights/Charts';
import { DSCard } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { Pill, Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToday } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n, type TKey } from '@/i18n';
import { dayCompletion, deltaPoints, type PeriodSummary } from '@/lib/analytics';
import { addDays, addMonths, endOfMonth, startOfMonth, weekDays, weekdayOf, parseDateKey } from '@/lib/dates';
import { MOODS } from '@/lib/mood';
import { loadPeriodReport } from '@/services/insights';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type Period = 'week' | 'month';

export default function InsightsScreen() {
  const palette = usePalette();
  const { t, formatPercent, formatDuration, formatDate, weekdayName, formatTime, formatNumber } = useI18n();
  const { preferences } = usePreferences();
  const today = useToday();
  const [period, setPeriod] = useState<Period>('week');

  const range = useMemo(() => {
    if (period === 'week') {
      const days = weekDays(today, preferences.weekStart);
      const from = days[0] ?? today;
      const to = days[6] ?? today;
      return { from, to, prevFrom: addDays(from, -7), prevTo: addDays(to, -7) };
    }
    const from = startOfMonth(today);
    const prev = addMonths(from, -1);
    return { from, to: endOfMonth(today), prevFrom: prev, prevTo: endOfMonth(prev) };
  }, [period, today, preferences.weekStart]);

  const report = useLiveQuery(
    () => loadPeriodReport(range.from, range.to, range.prevFrom, range.prevTo, today, preferences.timeZone),
    ['tasks', 'habits', 'habit_logs', 'focus_sessions', 'workout_sessions', 'day_reviews', 'entry_completions', 'journal_entries', 'assignments', 'attendance_records'],
    [range.from, range.to, today, preferences.timeZone],
  );

  const header = (
    <View style={styles.header}>
      <Text variant="h1" accessibilityRole="header">
        {t('insights.title')}
      </Text>
      <Text variant="body" tone="secondary">
        {t('insights.subtitle')}
      </Text>
      <Segmented<Period>
        style={styles.segment}
        options={[
          { value: 'week', label: t('insights.weekly') },
          { value: 'month', label: t('insights.monthly') },
        ]}
        value={period}
        onChange={setPeriod}
        accent
      />
    </View>
  );

  const data = report.data;
  if (!data) {
    return (
      <Screen header={header} withTabBar>
        <LoadingState rows={4} />
      </Screen>
    );
  }

  const { summary, previous } = data;
  const empty = summary.tasksPlanned + summary.habitsPlanned + summary.focusSeconds + summary.workouts === 0 && summary.moodAverage == null;
  const moodTotal = Object.values(summary.moodCounts).reduce((sum, count) => sum + count, 0);
  const habitDelta = deltaPoints(summary.habitRate, previous.habitRate);
  const taskDelta = deltaPoints(summary.taskRate, previous.taskRate);
  const activeFocusDays = Math.max(1, summary.focusDays);
  const moodColors = [palette.danger, palette.priority.high, palette.textMuted, palette.accentSoft, palette.accent];
  const chartPoints = data.days.map((day) => ({
    label: period === 'week' ? weekdayName(weekdayOf(day.date), 'short') : String(parseDateKey(day.date).day),
    value: dayCompletion(day),
    highlight: summary.bestDay?.date === day.date,
  }));

  return (
    <Screen header={header} withTabBar>
      {empty ? (
        <EmptyState icon={Sparkles} title={t('insights.emptyTitle')} message={t('insights.emptyBody')} />
      ) : (
        <>
          <View style={styles.grid}>
            <Metric icon={ListChecks} label={t('insights.tasks')} value={`${summary.tasksDone}/${summary.tasksPlanned}`} sub={summary.taskRate != null ? formatPercent(summary.taskRate) : '—'} delta={taskDelta} />
            <Metric icon={Flame} label={t('insights.habits')} value={summary.habitRate != null ? formatPercent(summary.habitRate) : '—'} sub={t('insights.habitsDone', { done: summary.habitsDone, total: summary.habitsPlanned })} delta={habitDelta} />
            <Metric icon={Timer} label={t('insights.focus')} value={formatDuration(summary.focusSeconds)} sub={t('insights.perActiveDay', { time: formatDuration(summary.focusSeconds / activeFocusDays) })} />
            <Metric icon={Dumbbell} label={t('insights.workouts')} value={String(summary.workouts)} sub={formatDuration(data.workoutSeconds)} />
            <Metric icon={Smile} label={t('insights.mood')} value={summary.moodAverage != null ? `${formatNumber(summary.moodAverage, 1)} / 5` : '—'} sub={t('insights.checkIns', { count: moodTotal })} />
            <Metric icon={Zap} label={t('insights.syncScore')} value={summary.completion != null ? formatPercent(summary.completion) : '—'} sub={t('insights.syncScoreSub')} accent />
          </View>

          <DSCard>
            <View style={styles.rowBetween}>
              <View>
                <Text variant="label" tone="secondary">
                  {t('insights.dailyProductivity')}
                </Text>
                <Text variant="h3">{t('insights.completionRate')}</Text>
              </View>
              {summary.bestDay ? <Pill label={t('insights.peak', { day: formatDate(summary.bestDay.date, 'weekdayShort'), percent: formatPercent(summary.bestDay.completion) })} tone="accent" /> : null}
            </View>
            <View style={styles.chart}>
              <LineChart points={chartPoints} />
            </View>
          </DSCard>

          <DSCard>
            <View style={styles.rowBetween}>
              <View>
                <Text variant="label" tone="secondary">
                  {t('insights.weeklyActivity')}
                </Text>
                <Text variant="h3">{t('insights.focusVolume')}</Text>
              </View>
              <Text variant="h3" tone="accent" latin>
                {formatDuration(summary.focusSeconds)}
              </Text>
            </View>
            <View style={styles.chart}>
              <BarChart
                bars={data.days.map((day) => ({
                  label: period === 'week' ? weekdayName(weekdayOf(day.date), 'narrow') : '',
                  value: day.focusSeconds,
                  highlight: day.focusSeconds > 0 && day.focusSeconds >= Math.max(...data.days.map((d) => d.focusSeconds)),
                }))}
              />
            </View>
          </DSCard>

          {data.habits.length > 0 ? (
            <DSCard>
              <View style={styles.rowBetween}>
                <View>
                  <Text variant="label" tone="secondary">
                    {t('insights.habitConsistency')}
                  </Text>
                  <Text variant="h3">{t('insights.coreRituals')}</Text>
                </View>
                {summary.habitRate != null ? (
                  <Text variant="h3" tone="accent" latin>
                    {formatPercent(summary.habitRate)}
                  </Text>
                ) : null}
              </View>
              {data.habits.map((habit) => (
                <View key={habit.id} style={styles.habit}>
                  <View style={styles.rowBetween}>
                    <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                      {habit.title}
                    </Text>
                    <Text variant="smallStrong" tone="accent" latin>
                      {formatPercent(habit.done / habit.planned)}
                    </Text>
                  </View>
                  <ProgressBar progress={habit.done / habit.planned} color={habit.color ?? palette.accent} />
                </View>
              ))}
            </DSCard>
          ) : null}

          {moodTotal > 0 ? (
            <DSCard>
              <View style={styles.rowBetween}>
                <View>
                  <Text variant="label" tone="secondary">
                    {t('insights.moodDistribution')}
                  </Text>
                  <Text variant="h3">{t('insights.emotionalBalance')}</Text>
                </View>
                <Text variant="smallStrong" tone="tertiary">
                  {t('insights.positive', { percent: formatPercent((summary.moodCounts[4] + summary.moodCounts[5]) / moodTotal) })}
                </Text>
              </View>
              <StackedBar segments={[5, 4, 3, 2, 1].map((level) => ({ value: summary.moodCounts[level as 1 | 2 | 3 | 4 | 5], color: moodColors[level - 1] ?? palette.accent }))} />
              <View style={styles.legend}>
                {[...MOODS].reverse().map((mood) => (
                  <View key={mood.level} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: moodColors[mood.level - 1] }]} />
                    <Text variant="small" tone="secondary" style={styles.flex}>
                      {t(mood.label)}
                    </Text>
                    <Text variant="smallStrong" latin>
                      {formatPercent(summary.moodCounts[mood.level] / moodTotal)}
                    </Text>
                  </View>
                ))}
              </View>
            </DSCard>
          ) : null}

          <DSCard glow>
            <View style={styles.rowBetween}>
              <View>
                <Text variant="label" tone="accent">
                  {period === 'week' ? t('insights.weeklyReport') : t('insights.monthlyReport')}
                </Text>
                <Text variant="h2">{period === 'week' ? t('insights.executiveSummary') : formatDate(range.from, 'monthYear')}</Text>
              </View>
              <CalendarDays size={20} color={palette.accentText} />
            </View>
            <View style={styles.summary}>
              <SummaryRow label={t('insights.bestDay')} value={summary.bestDay ? `${formatDate(summary.bestDay.date, 'weekdayDay')} · ${formatPercent(summary.bestDay.completion)}` : '—'} />
              <SummaryRow label={t('insights.peakHour')} value={data.peakHour != null ? `${formatTime(data.peakHour * 60)} – ${formatTime(((data.peakHour + 1) % 24) * 60)}` : '—'} />
              <View style={styles.summaryGrid}>
                <SummaryTile label={t('insights.tasksCompleted')} value={String(summary.tasksDone)} />
                <SummaryTile label={t('insights.habitsCompleted')} value={String(summary.habitsDone)} />
                <SummaryTile label={t('insights.totalFocus')} value={formatDuration(summary.focusSeconds)} />
                <SummaryTile label={t('insights.workoutSessions')} value={String(summary.workouts)} />
              </View>
              {summary.moodAverage != null ? <SummaryRow label={t('insights.moodRecap')} value={t(`mood.level${Math.round(summary.moodAverage)}` as TKey)} /> : null}
            </View>
          </DSCard>

          {period === 'month' ? (
            <DSCard>
              <View style={styles.rowBetween}>
                <Text variant="label" tone="secondary">
                  {t('insights.monthHeatmap')}
                </Text>
                <Activity size={18} color={palette.accentText} />
              </View>
              <View style={styles.heatmap}>
                {data.days.map((day) => {
                  const count = data.activity[day.date] ?? 0;
                  const max = Math.max(1, ...Object.values(data.activity));
                  return (
                    <View
                      key={day.date}
                      accessibilityLabel={`${formatDate(day.date, 'medium')}: ${count}`}
                      style={[styles.heatCell, { backgroundColor: count ? palette.accent : palette.elevated, opacity: count ? 0.3 + 0.7 * (count / max) : 1 }]}
                    />
                  );
                })}
              </View>
            </DSCard>
          ) : null}

          <InsightLine summary={summary} previous={previous} period={period} />
        </>
      )}
    </Screen>
  );
}

function InsightLine({ summary, previous, period }: { summary: PeriodSummary; previous: PeriodSummary; period: Period }) {
  const palette = usePalette();
  const { t, formatDate, formatPercent, formatDuration } = useI18n();
  // Each sentence states a fact computed from the records; no guesses.
  let text: string | null = null;
  if (summary.bestDay) text = t('insights.lineBestDay', { day: formatDate(summary.bestDay.date, 'long'), percent: formatPercent(summary.bestDay.completion) });
  if (summary.focusSeconds > 0 && previous.focusSeconds > 0) {
    const change = summary.focusSeconds - previous.focusSeconds;
    text = t(change >= 0 ? 'insights.lineFocusUp' : 'insights.lineFocusDown', { time: formatDuration(Math.abs(change)), period: t(period === 'week' ? 'insights.lastWeek' : 'insights.lastMonth') });
  }
  if (!text) return null;
  return (
    <View style={[styles.line, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Quote size={18} color={palette.accentText} />
      <Text variant="body" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

function Metric({ icon: Icon, label, value, sub, delta, accent }: { icon: typeof Flame; label: string; value: string; sub: string; delta?: number | null; accent?: boolean }) {
  const palette = usePalette();
  const { t } = useI18n();
  return (
    <DSCard style={styles.metric} padding={space.md} glow={accent}>
      <View style={styles.rowBetween}>
        <Text variant="label" tone="secondary" numberOfLines={1} style={styles.flex}>
          {label}
        </Text>
        <Icon size={16} color={palette.accentText} />
      </View>
      <Text variant="stat" latin numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="small" tone={delta != null ? (delta >= 0 ? 'success' : 'danger') : 'secondary'} numberOfLines={1}>
        {delta != null ? t('insights.delta', { delta: `${delta >= 0 ? '+' : ''}${delta}` }) : sub}
      </Text>
    </DSCard>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.summaryRow, { backgroundColor: palette.surfaceAlt }]}>
      <Text variant="small" tone="secondary">
        {label}
      </Text>
      <Text variant="bodyStrong" tone="accent">
        {value}
      </Text>
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.summaryTile, { backgroundColor: palette.surfaceAlt }]}>
      <Text variant="small" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="h3" latin>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.sm, gap: 4 },
  segment: { marginTop: space.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  metric: { width: '48.6%', gap: 4 },
  chart: { marginTop: space.md },
  habit: { gap: 6, marginTop: space.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md, rowGap: space.sm },
  legendItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: space.md },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  summary: { gap: space.sm, marginTop: space.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.md, borderRadius: radius.md, gap: space.sm },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  summaryTile: { width: '48.6%', padding: space.md, borderRadius: radius.md, gap: 2 },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: space.md },
  heatCell: { width: '12%', aspectRatio: 1, borderRadius: 5 },
  line: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, alignItems: 'flex-start' },
});
