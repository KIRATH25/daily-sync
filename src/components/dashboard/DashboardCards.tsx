import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowRight,
  BookOpen,
  Dumbbell,
  Flame,
  GraduationCap,
  Hourglass,
  ListChecks,
  Moon,
  Quote as QuoteIcon,
  Timer,
  Trophy,
  type LucideIcon,
} from '@/components/ui/icons';

import { CountdownDisplay } from '@/components/countdown/CountdownDisplay';
import { DSCard } from '@/components/ui/Card';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { PressableScale } from '@/components/ui/PressableScale';
import { Pill, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useI18n, type TKey } from '@/i18n';
import type { DateKey } from '@/lib/dates';
import { MOODS } from '@/lib/mood';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { Countdown, MoodLevel } from '@/types/models';

// ── Day at a glance ─────────────────────────────────────────────────────────

export const GlanceCard = memo(function GlanceCard({
  completed,
  remaining,
  habitsDone,
  habitsPlanned,
  planned,
}: {
  completed: number;
  remaining: number;
  habitsDone: number;
  habitsPlanned: number;
  planned: number;
}) {
  const palette = usePalette();
  const { t, formatPercent } = useI18n();
  const ratio = planned > 0 ? completed / planned : 0;
  const status: TKey = planned === 0 ? 'home.statusEmpty' : ratio >= 1 ? 'home.statusDone' : ratio >= 0.5 ? 'home.statusOnTrack' : 'home.statusStarted';
  const rows = [
    { label: t('home.completed'), value: String(completed) },
    { label: t('home.remaining'), value: String(remaining) },
    { label: t('home.habits'), value: `${habitsDone}/${habitsPlanned}` },
  ];
  return (
    <DSCard glow>
      <View style={styles.rowBetween}>
        <Text variant="label" tone="secondary">
          {t('home.glance')}
        </Text>
        <Pill label={t(status)} tone={ratio >= 0.5 ? 'accent' : 'muted'} />
      </View>
      <View style={styles.glanceBody}>
        <ProgressRing progress={ratio} size={118} stroke={11} accessibilityLabel={t('home.completionA11y', { percent: formatPercent(ratio) })}>
          <Text variant="stat" latin>
            {planned === 0 ? '—' : formatPercent(ratio)}
          </Text>
        </ProgressRing>
        <View style={styles.glanceRows}>
          {rows.map((row) => (
            <View key={row.label} style={[styles.glanceRow, { backgroundColor: palette.surfaceAlt }]}>
              <Text variant="body" tone="secondary">
                {row.label}
              </Text>
              <Text variant="title" tone="accent" latin>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </DSCard>
  );
});

// ── Shortcuts ───────────────────────────────────────────────────────────────

const SHORTCUTS: { icon: LucideIcon; label: TKey; href: string }[] = [
  { icon: ListChecks, label: 'nav.tasks', href: '/tasks' },
  { icon: Flame, label: 'nav.habits', href: '/habits' },
  { icon: GraduationCap, label: 'nav.college', href: '/timetable' },
  { icon: Dumbbell, label: 'nav.fitness', href: '/fitness' },
  { icon: Timer, label: 'nav.focus', href: '/focus' },
  { icon: BookOpen, label: 'nav.journal', href: '/journal' },
  { icon: Hourglass, label: 'nav.countdowns', href: '/countdowns' },
  { icon: Trophy, label: 'nav.journey', href: '/journey' },
];

export const Shortcuts = memo(function Shortcuts() {
  const palette = usePalette();
  const { t } = useI18n();
  return (
    <View style={styles.shortcuts}>
      {SHORTCUTS.map((item) => (
        <PressableScale
          key={item.href}
          onPress={() => router.push(item.href as never)}
          accessibilityLabel={t(item.label)}
          style={styles.shortcut}
          scaleTo={0.92}
        >
          <View style={[styles.shortcutIcon, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <item.icon size={21} color={palette.accentText} strokeWidth={1.9} />
          </View>
          <Text variant="micro" tone="secondary" numberOfLines={1} style={styles.shortcutLabel}>
            {t(item.label)}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
});

// ── Schedule ────────────────────────────────────────────────────────────────

export interface ScheduleItem {
  title: string;
  subtitle: string;
  startsInMs: number | null;
  route: string;
  allDay?: boolean;
}

export const ScheduleCard = memo(function ScheduleCard({ next, extraCount }: { next: ScheduleItem | null; extraCount: number }) {
  const palette = usePalette();
  const { t, formatRelative } = useI18n();
  return (
    <DSCard>
      <SectionHeader title={t('home.schedule')} actionLabel={t('home.viewCalendar')} onAction={() => router.push('/calendar')} />
      {next ? (
        <PressableScale
          onPress={() => router.push(next.route as never)}
          accessibilityLabel={`${next.title}, ${next.subtitle}`}
          style={[styles.nextItem, { backgroundColor: palette.surfaceAlt, borderLeftColor: palette.accent }]}
        >
          <View style={styles.flex}>
            <Text variant="title" numberOfLines={1}>
              {next.title}
            </Text>
            <Text variant="small" tone="secondary" numberOfLines={1}>
              {next.subtitle}
            </Text>
          </View>
          {next.startsInMs != null ? (
            <Pill label={next.startsInMs <= 0 ? t('home.happeningNow') : formatRelative(next.startsInMs)} tone="accent" />
          ) : null}
        </PressableScale>
      ) : (
        <Text variant="body" tone="secondary" style={styles.emptyLine}>
          {t('home.nothingScheduled')}
        </Text>
      )}
      {extraCount > 0 ? (
        <Text variant="small" tone="muted" style={styles.extra}>
          {t('home.moreToday', { count: extraCount })}
        </Text>
      ) : null}
    </DSCard>
  );
});

// ── Milestone countdown ─────────────────────────────────────────────────────

export const MilestoneCard = memo(function MilestoneCard({ countdown, targetMs }: { countdown: Countdown; targetMs: number }) {
  const { t } = useI18n();
  return (
    <DSCard glow onPress={() => router.push(`/countdowns/${countdown.id}`)} accessibilityLabel={countdown.title}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text variant="label" tone="accent">
            {t('home.milestone')}
          </Text>
          <Text variant="h2" numberOfLines={1}>
            {countdown.title}
          </Text>
        </View>
        <Text variant="smallStrong" tone="secondary">
          {t('common.viewAll')}
        </Text>
      </View>
      <View style={styles.spacer} />
      <CountdownDisplay targetMs={targetMs} showSeconds={countdown.showSeconds} />
    </DSCard>
  );
});

// ── Habit week ──────────────────────────────────────────────────────────────

export const HabitWeekCard = memo(function HabitWeekCard({
  days,
  weeklyRate,
  streak,
}: {
  days: { date: DateKey; ratio: number | null; isToday: boolean; weekday: number }[];
  weeklyRate: number | null;
  streak: number;
}) {
  const palette = usePalette();
  const { t, weekdayName, formatPercent } = useI18n();
  return (
    <DSCard onPress={() => router.push('/habits')} accessibilityLabel={t('home.habitConsistency')}>
      <View style={styles.rowBetween}>
        <View>
          <Text variant="label" tone="secondary">
            {t('home.habitConsistency')}
          </Text>
          <Text variant="small" tone="secondary">
            {weeklyRate == null ? t('home.noHabitsYet') : t('home.weeklyCompletion', { percent: formatPercent(weeklyRate) })}
          </Text>
        </View>
        {streak > 0 ? <Pill label={t('home.streakDays', { count: streak })} tone="accent" icon={Flame} /> : null}
      </View>
      <View style={styles.week}>
        {days.map((day) => {
          const fill =
            day.ratio == null ? palette.elevated : day.ratio >= 1 ? palette.accent : day.ratio > 0 ? palette.accentMuted : palette.elevated;
          return (
            <View key={day.date} style={styles.weekDay}>
              <Text variant="micro" tone={day.isToday ? 'accent' : 'muted'}>
                {weekdayName(day.weekday, 'narrow')}
              </Text>
              <View
                style={[styles.weekBlock, { backgroundColor: fill, borderColor: day.isToday ? palette.accent : 'transparent' }]}
                accessibilityLabel={day.ratio == null ? undefined : formatPercent(day.ratio)}
              />
            </View>
          );
        })}
      </View>
    </DSCard>
  );
});

// ── Mood ────────────────────────────────────────────────────────────────────

export const MoodCard = memo(function MoodCard({ today, current }: { today: DateKey; current: MoodLevel | null }) {
  const palette = usePalette();
  const { t } = useI18n();
  return (
    <DSCard>
      <View style={styles.rowBetween}>
        <Text variant="label" tone="secondary">
          {current ? t('home.moodLogged') : t('home.moodQuestion')}
        </Text>
        {current ? (
          <PressableScale onPress={() => router.push(`/mood/${today}`)} accessibilityLabel={t('common.view')} hitSlop={10}>
            <Text variant="smallStrong" tone="accent">
              {t('common.view')}
            </Text>
          </PressableScale>
        ) : null}
      </View>
      <View style={styles.moods}>
        {MOODS.map((mood) => {
          const selected = current === mood.level;
          return (
            <PressableScale
              key={mood.level}
              onPress={() => router.push({ pathname: '/mood', params: { date: today, mood: String(mood.level) } })}
              haptic="selection"
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(mood.label)}
              scaleTo={0.88}
              style={[styles.mood, { backgroundColor: selected ? palette.accentMuted : palette.surfaceAlt, borderColor: selected ? palette.accent : 'transparent' }]}
            >
              <Text style={styles.moodEmoji}>{mood.emoji}</Text>
            </PressableScale>
          );
        })}
      </View>
    </DSCard>
  );
});

// ── Fitness ─────────────────────────────────────────────────────────────────

export const FitnessCard = memo(function FitnessCard({
  workoutLabel,
  hydration,
  hydrationGoal,
}: {
  workoutLabel: string | null;
  hydration: number;
  hydrationGoal: number;
}) {
  const palette = usePalette();
  const { t, formatNumber } = useI18n();
  return (
    <DSCard onPress={() => router.push('/fitness')} accessibilityLabel={t('nav.fitness')}>
      <View style={styles.fitRow}>
        <View style={[styles.fitIcon, { backgroundColor: palette.accentMuted }]}>
          <Dumbbell size={20} color={palette.accentText} />
        </View>
        <View style={styles.flex}>
          <Text variant="title" numberOfLines={1}>
            {workoutLabel ?? t('home.noWorkoutToday')}
          </Text>
          <Text variant="small" tone="secondary">
            {t('home.hydration', { amount: formatNumber(hydration / 1000, 1), goal: formatNumber(hydrationGoal / 1000, 1) })}
          </Text>
        </View>
        <Text variant="title" tone="accent" latin>
          {Math.round(Math.min(1, hydration / Math.max(1, hydrationGoal)) * 100)}%
        </Text>
      </View>
      <ProgressBar progress={hydration / Math.max(1, hydrationGoal)} height={8} style={styles.spacerTop} color={palette.tertiary} />
    </DSCard>
  );
});

// ── Journey ─────────────────────────────────────────────────────────────────

export const JourneyCard = memo(function JourneyCard({ active, streak, best, earned, total }: { active: number; streak: number; best: number; earned: number; total: number }) {
  const palette = usePalette();
  const { t } = useI18n();
  const stats = [
    { label: t('journey.activeDays'), value: active },
    { label: t('journey.currentStreak'), value: streak },
    { label: t('journey.longestStreak'), value: best },
  ];
  return (
    <DSCard glow onPress={() => router.push('/journey')} accessibilityLabel={t('nav.journey')}>
      <View style={styles.rowBetween}>
        <Text variant="label" tone="accent">
          {t('home.journey')}
        </Text>
        <View style={styles.inline}>
          <Text variant="smallStrong" tone="secondary">
            {t('home.cardsEarned', { earned, total })}
          </Text>
          <ArrowRight size={16} color={palette.textSecondary} />
        </View>
      </View>
      <View style={styles.journeyStats}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.journeyStat, { backgroundColor: palette.surfaceAlt }]}>
            <Text variant="stat" latin>
              {stat.value}
            </Text>
            <Text variant="micro" tone="secondary" numberOfLines={2}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
    </DSCard>
  );
});

// ── Quote ───────────────────────────────────────────────────────────────────

export const QuoteCard = memo(function QuoteCard({ text }: { text: string }) {
  const palette = usePalette();
  const { t } = useI18n();
  return (
    <DSCard tone="alt">
      <QuoteIcon size={20} color={palette.accentText} />
      <Text variant="title" align="center" style={styles.quote}>
        {text}
      </Text>
      <Text variant="micro" tone="muted" align="center">
        {t('quote.attribution')}
      </Text>
    </DSCard>
  );
});

// ── Pending check-in ────────────────────────────────────────────────────────

export const PendingCheckIn = memo(function PendingCheckIn({ date, isYesterday }: { date: DateKey; isYesterday: boolean }) {
  const palette = usePalette();
  const { t } = useI18n();
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/mood', params: { date } })}
      accessibilityLabel={isYesterday ? t('home.pendingYesterday') : t('home.pendingTonight')}
      style={[styles.pending, { backgroundColor: palette.accentMuted, borderColor: palette.accent }]}
    >
      <Moon size={20} color={palette.accentText} />
      <View style={styles.flex}>
        <Text variant="title">{isYesterday ? t('home.pendingYesterday') : t('home.pendingTonight')}</Text>
        <Text variant="small" tone="secondary">
          {t('home.pendingBody')}
        </Text>
      </View>
      <ArrowRight size={18} color={palette.accentText} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  spacer: { height: space.md },
  spacerTop: { marginTop: space.md },
  glanceBody: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.md },
  glanceRows: { flex: 1, gap: space.sm },
  glanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.sm + 2, borderRadius: radius.sm },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  shortcut: { width: '25%', alignItems: 'center', gap: 6 },
  shortcutIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  shortcutLabel: { textTransform: 'none', letterSpacing: 0.2 },
  nextItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderLeftWidth: 3, marginTop: space.sm },
  emptyLine: { marginTop: space.sm },
  extra: { marginTop: space.sm },
  week: { flexDirection: 'row', gap: 6, marginTop: space.md },
  weekDay: { flex: 1, alignItems: 'center', gap: 6 },
  weekBlock: { width: '100%', height: 34, borderRadius: 10, borderWidth: 1.5 },
  moods: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md, gap: space.sm },
  mood: { flex: 1, aspectRatio: 1, maxWidth: 62, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  moodEmoji: { fontSize: 26, lineHeight: 34 },
  fitRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  fitIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  journeyStats: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  journeyStat: { flex: 1, padding: space.md, borderRadius: radius.md, gap: 2 },
  quote: { fontStyle: 'italic', marginVertical: space.sm },
  pending: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
});
