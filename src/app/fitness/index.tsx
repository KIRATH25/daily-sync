import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Activity, Droplet, Dumbbell, Flame, Hourglass, Play, Plus, Scale, Trophy, Undo2 } from '@/components/ui/icons';

import { TrendChart } from '@/components/fitness/FitnessParts';
import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { DSInput } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/Progress';
import { PressableScale } from '@/components/ui/PressableScale';
import { Pill, Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { DSBottomSheet } from '@/components/ui/Sheet';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  addBodyMetric,
  addHydration,
  getActiveSession,
  hydrationTotal,
  listBodyMetrics,
  listCompletedSessions,
  listPersonalRecords,
  listPlans,
  listSessionsInRange,
  startSession,
  undoLastHydration,
} from '@/db/repositories/fitnessRepo';
import { useClock } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useTicker } from '@/hooks/useTicker';
import { useI18n } from '@/i18n';
import { addDays, weekDays } from '@/lib/dates';
import { formatClock } from '@/lib/format';
import { FITNESS_BOUNDS, validateNumber } from '@/lib/validation';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export default function FitnessScreen() {
  const palette = usePalette();
  const { t, formatDuration, formatNumber, formatDate } = useI18n();
  const { preferences } = usePreferences();
  const { toast } = useFeedback();
  const today = useClock().dateKey;
  const [metricsOpen, setMetricsOpen] = useState(false);
  const week = useMemo(() => weekDays(today, preferences.weekStart), [today, preferences.weekStart]);

  const query = useLiveQuery(
    async () => {
      const [active, plans, history, weekSessions, metrics, records, hydration] = await Promise.all([
        getActiveSession(),
        listPlans(),
        listCompletedSessions(20),
        listSessionsInRange(week[0] ?? today, week[6] ?? today),
        listBodyMetrics(30),
        listPersonalRecords(),
        hydrationTotal(today),
      ]);
      return { active, plans, history, weekSessions, metrics, records, hydration };
    },
    ['workout_sessions', 'workout_plans', 'workout_plan_exercises', 'exercise_sets', 'body_metrics', 'hydration_logs', 'exercises'],
    [today, week],
  );

  const data = query.data;
  const derived = useMemo(() => {
    if (!data) return null;
    const weekSeconds = data.weekSessions.reduce((sum, session) => sum + ((session.endedAt ?? session.startedAt) - session.startedAt) / 1000, 0);
    const weights = data.metrics.filter((metric) => metric.weight != null).reverse();
    const latestWeight = weights[weights.length - 1] ?? null;
    const monthAgo = addDays(today, -30);
    const baseline = weights.find((metric) => metric.date >= monthAgo) ?? weights[0] ?? null;
    const latestMeasure = data.metrics.find((metric) => metric.waist != null || metric.chest != null || metric.arms != null || metric.bodyFat != null) ?? null;
    // Consecutive days (ending today or yesterday) with a finished workout.
    const days = new Set(data.history.map((session) => session.date));
    let streak = 0;
    let cursor = days.has(today) ? today : addDays(today, -1);
    while (days.has(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return { weekSeconds, weights, latestWeight, delta: latestWeight && baseline && latestWeight !== baseline ? (latestWeight.weight ?? 0) - (baseline.weight ?? 0) : null, latestMeasure, streak };
  }, [data, today]);

  const start = async (planId: string | null, name: string) => {
    try {
      await startSession(name, planId, today);
      router.push('/fitness/session');
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    }
  };

  const header = <ScreenHeader large eyebrow={t('fitness.eyebrow')} title={t('fitness.title')} subtitle={t('fitness.subtitle')} />;
  const footer = data?.active ? (
    <PremiumButton label={t('fitness.resume')} icon={Play} onPress={() => router.push('/fitness/session')} />
  ) : (
    <PremiumButton label={t('fitness.startEmpty')} icon={Dumbbell} onPress={() => start(null, t('fitness.quickWorkout'))} />
  );

  if (!data || !derived) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen header={header} footer={footer}>
      <View style={styles.grid}>
        <Stat icon={Flame} label={t('fitness.streak')} value={String(derived.streak)} unit={t('habits.days')} />
        <Stat icon={Hourglass} label={t('fitness.weekVolume')} value={formatDuration(derived.weekSeconds)} sub={t('fitness.sessions', { count: data.weekSessions.length })} />
        <Stat
          icon={Scale}
          label={t('fitness.bodyMass')}
          value={derived.latestWeight?.weight != null ? formatNumber(derived.latestWeight.weight) : '—'}
          unit={derived.latestWeight ? 'kg' : undefined}
          sub={derived.delta != null ? t('fitness.monthDelta', { delta: `${derived.delta > 0 ? '+' : ''}${formatNumber(derived.delta)}` }) : undefined}
        />
        <Stat icon={Activity} label={t('fitness.totalSessions')} value={String(data.history.length)} sub={t('fitness.recent')} />
      </View>

      {data.active ? <LiveChamber name={data.active.name} startedAt={data.active.startedAt} /> : null}

      <SectionHeader title={t('fitness.plans')} actionLabel={t('fitness.newPlan')} onAction={() => router.push('/fitness/plan')} />
      {data.plans.length === 0 ? (
        <EmptyState compact icon={Dumbbell} title={t('fitness.noPlans')} message={t('fitness.noPlansBody')} actionLabel={t('fitness.newPlan')} onAction={() => router.push('/fitness/plan')} />
      ) : (
        data.plans.map((plan) => (
          <DSCard key={plan.id} onPress={() => router.push({ pathname: '/fitness/plan', params: { id: plan.id } })} accessibilityLabel={plan.name}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text variant="h3">{plan.name}</Text>
                <Text variant="small" tone="secondary" numberOfLines={1}>
                  {plan.exercises.length ? plan.exercises.map((item) => item.exercise.name).join(' · ') : t('fitness.noExercises')}
                </Text>
              </View>
              {!data.active ? <PremiumButton label={t('fitness.start')} icon={Play} size="sm" fullWidth={false} onPress={() => start(plan.id, plan.name)} /> : null}
            </View>
          </DSCard>
        ))
      )}

      <DSCard>
        <View style={styles.rowBetween}>
          <View>
            <Text variant="label" tone="secondary">
              {t('fitness.bodyComposition')}
            </Text>
            <Text variant="statLarge" latin>
              {derived.latestWeight?.weight != null ? formatNumber(derived.latestWeight.weight) : '—'}
              <Text variant="h3" tone="secondary">{derived.latestWeight ? ' kg' : ''}</Text>
            </Text>
          </View>
          <PremiumButton label={t('fitness.logMetrics')} icon={Plus} size="sm" variant="soft" fullWidth={false} onPress={() => setMetricsOpen(true)} />
        </View>
        {derived.weights.length >= 2 ? (
          <View style={styles.spaced}>
            <TrendChart values={derived.weights.map((metric) => metric.weight ?? 0)} />
            <View style={styles.rowBetween}>
              <Text variant="micro" tone="muted">
                {formatDate(derived.weights[0]?.date ?? today, 'dayMonth')}
              </Text>
              <Text variant="micro" tone="muted">
                {formatDate(derived.weights[derived.weights.length - 1]?.date ?? today, 'dayMonth')}
              </Text>
            </View>
          </View>
        ) : (
          <Text variant="small" tone="muted" style={styles.spaced}>
            {t('fitness.trendHint')}
          </Text>
        )}
        {derived.latestMeasure ? (
          <View style={styles.measures}>
            <Measure label={t('fitness.waist')} value={derived.latestMeasure.waist} unit="cm" />
            <Measure label={t('fitness.chest')} value={derived.latestMeasure.chest} unit="cm" />
            <Measure label={t('fitness.arms')} value={derived.latestMeasure.arms} unit="cm" />
            <Measure label={t('fitness.bodyFat')} value={derived.latestMeasure.bodyFat} unit="%" accent />
          </View>
        ) : null}
      </DSCard>

      <DSCard>
        <View style={styles.rowBetween}>
          <View style={styles.inline}>
            <Droplet size={20} color={palette.tertiary} />
            <View>
              <Text variant="h3" latin>
                {`${formatNumber(data.hydration)} / ${formatNumber(preferences.hydrationGoalMl)} ml`}
              </Text>
              <Text variant="micro" tone="secondary">
                {t('fitness.hydration')}
              </Text>
            </View>
          </View>
          <PressableScale onPress={() => undoLastHydration(today)} accessibilityLabel={t('common.undo')} hitSlop={10} style={[styles.undo, { backgroundColor: palette.surfaceAlt }]}>
            <Undo2 size={16} color={palette.textSecondary} />
          </PressableScale>
        </View>
        <ProgressBar progress={data.hydration / preferences.hydrationGoalMl} color={palette.tertiary} height={8} style={styles.spaced} />
        <View style={[styles.inline, styles.spaced]}>
          {[250, 500, 750].map((amount) => (
            <DSChip key={amount} label={`+${amount} ml`} onPress={() => addHydration(today, amount)} />
          ))}
        </View>
      </DSCard>

      {data.records.length > 0 ? (
        <DSCard>
          <View style={styles.inline}>
            <Trophy size={18} color={palette.accentText} />
            <Text variant="label" tone="secondary">
              {t('fitness.records')}
            </Text>
          </View>
          {data.records.slice(0, 6).map((record) => (
            <View key={record.exerciseId} style={styles.recordRow}>
              <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                {record.name}
              </Text>
              <Text variant="bodyStrong" tone="accent" latin>
                {`${formatNumber(record.weight)} kg × ${record.reps}`}
              </Text>
            </View>
          ))}
        </DSCard>
      ) : null}

      <SectionHeader title={t('fitness.history')} />
      {data.history.length === 0 ? (
        <Text variant="small" tone="muted">
          {t('fitness.noHistory')}
        </Text>
      ) : (
        data.history.slice(0, 10).map((session) => (
          <View key={session.id} style={[styles.history, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={[styles.historyDot, { backgroundColor: palette.accent }]} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{session.name}</Text>
              <Text variant="small" tone="secondary">
                {t('fitness.historyLine', { sets: session.setCount, volume: formatNumber(Math.round(session.volume)) })}
              </Text>
            </View>
            <View style={styles.alignEnd}>
              <Text variant="smallStrong">{formatDuration(((session.endedAt ?? session.startedAt) - session.startedAt) / 1000)}</Text>
              <Text variant="micro" tone="muted">
                {formatDate(session.date, 'dayMonth')}
              </Text>
            </View>
          </View>
        ))
      )}
      <MetricsSheet visible={metricsOpen} onClose={() => setMetricsOpen(false)} today={today} lastWeight={derived.latestWeight?.weight ?? null} />
    </Screen>
  );
}

/** Isolated so the per-second tick re-renders only this card. */
function LiveChamber({ name, startedAt }: { name: string; startedAt: number }) {
  const { t } = useI18n();
  const now = useTicker(1000);
  return (
    <DSCard glow onPress={() => router.push('/fitness/session')} accessibilityLabel={t('fitness.resume')}>
      <View style={styles.rowBetween}>
        <Pill label={t('fitness.live')} tone="solid" />
        <Text variant="h3" latin tone="accent">
          {formatClock(now - startedAt)}
        </Text>
      </View>
      <Text variant="h2" style={styles.spaced}>
        {name}
      </Text>
      <Text variant="small" tone="secondary">
        {t('fitness.resumeHint')}
      </Text>
    </DSCard>
  );
}

function Stat({ icon: Icon, label, value, unit, sub }: { icon: typeof Flame; label: string; value: string; unit?: string; sub?: string }) {
  const palette = usePalette();
  return (
    <DSCard style={styles.cell}>
      <View style={styles.rowBetween}>
        <Text variant="label" tone="secondary" numberOfLines={1} style={styles.flex}>
          {label}
        </Text>
        <Icon size={16} color={palette.accentText} />
      </View>
      <Text variant="stat" latin numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text variant="small" tone="secondary">{` ${unit}`}</Text> : null}
      </Text>
      {sub ? (
        <Text variant="small" tone="secondary" numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </DSCard>
  );
}

function Measure({ label, value, unit, accent }: { label: string; value: number | null; unit: string; accent?: boolean }) {
  const palette = usePalette();
  const { formatNumber } = useI18n();
  return (
    <View style={[styles.measure, { backgroundColor: palette.surfaceAlt }]}>
      <Text variant="micro" tone="secondary">
        {label}
      </Text>
      <Text variant="bodyStrong" latin tone={accent ? 'accent' : 'primary'}>
        {value != null ? `${formatNumber(value)}${unit === '%' ? '%' : ''}` : '—'}
      </Text>
    </View>
  );
}

function MetricsSheet({ visible, onClose, today, lastWeight }: { visible: boolean; onClose: () => void; today: string; lastWeight: number | null }) {
  const { t } = useI18n();
  const { toast } = useFeedback();
  const [weight, setWeight] = useState(lastWeight ? String(lastWeight) : '');
  const [waist, setWaist] = useState('');
  const [chest, setChest] = useState('');
  const [arms, setArms] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const parse = (raw: string, bounds: { min: number; max: number }, key: string, next: Record<string, string>): number | null => {
    if (!raw.trim()) return null;
    const result = validateNumber(raw, bounds.min, bounds.max);
    if (!result.ok) {
      next[key] = t(result.error);
      return null;
    }
    return result.value;
  };

  const save = async () => {
    const next: Record<string, string> = {};
    const values = {
      weight: parse(weight, FITNESS_BOUNDS.bodyWeightKg, 'weight', next),
      waist: parse(waist, FITNESS_BOUNDS.measurementCm, 'waist', next),
      chest: parse(chest, FITNESS_BOUNDS.measurementCm, 'chest', next),
      arms: parse(arms, FITNESS_BOUNDS.measurementCm, 'arms', next),
      bodyFat: parse(bodyFat, FITNESS_BOUNDS.bodyFat, 'bodyFat', next),
    };
    setErrors(next);
    if (Object.keys(next).length) return;
    if (Object.values(values).every((value) => value == null)) {
      toast(t('fitness.metricsEmpty'), { tone: 'info' });
      return;
    }
    try {
      await addBodyMetric({ date: today, ...values });
      toast(t('fitness.metricsSaved'));
      onClose();
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    }
  };

  return (
    <DSBottomSheet visible={visible} onClose={onClose} title={t('fitness.logMetrics')} subtitle={t('fitness.metricsSub')} footer={<PremiumButton label={t('common.save')} onPress={save} />}>
      <DSInput label={t('fitness.weightKg')} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" error={errors.weight} maxLength={6} />
      <View style={styles.inline}>
        <DSInput label={t('fitness.waistCm')} value={waist} onChangeText={setWaist} keyboardType="decimal-pad" error={errors.waist} containerStyle={styles.flex} maxLength={6} />
        <DSInput label={t('fitness.chestCm')} value={chest} onChangeText={setChest} keyboardType="decimal-pad" error={errors.chest} containerStyle={styles.flex} maxLength={6} />
      </View>
      <View style={styles.inline}>
        <DSInput label={t('fitness.armsCm')} value={arms} onChangeText={setArms} keyboardType="decimal-pad" error={errors.arms} containerStyle={styles.flex} maxLength={6} />
        <DSInput label={t('fitness.bodyFatPct')} value={bodyFat} onChangeText={setBodyFat} keyboardType="decimal-pad" error={errors.bodyFat} containerStyle={styles.flex} maxLength={5} />
      </View>
    </DSBottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alignEnd: { alignItems: 'flex-end' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: '48.6%', gap: 6 },
  spaced: { marginTop: space.md },
  measures: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  measure: { flex: 1, padding: space.sm, borderRadius: radius.sm, alignItems: 'center', gap: 2 },
  undo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  recordRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, gap: space.sm },
  history: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
});
