import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Check, Plus, Square, Timer, Trash2, X } from '@/components/ui/icons';

import { ExercisePickerSheet, Stepper } from '@/components/fitness/FitnessParts';
import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { IconButton } from '@/components/ui/IconButton';
import { DSInput } from '@/components/ui/Input';
import { ProgressRing } from '@/components/ui/Progress';
import { Pill, Screen, ScreenHeader } from '@/components/ui/Screen';
import { DSBottomSheet } from '@/components/ui/Sheet';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { readPreference, savePreference } from '@/db/repositories/preferencesRepo';
import {
  deleteSet,
  discardSession,
  finishSession,
  getActiveSession,
  getPlan,
  lastSetFor,
  listExercises,
  listSessionSets,
  logSet,
} from '@/db/repositories/fitnessRepo';
import { useHaptics } from '@/hooks/useHaptics';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useTicker } from '@/hooks/useTicker';
import { useI18n } from '@/i18n';
import { FITNESS_BOUNDS, LIMITS, validateOptionalText } from '@/lib/validation';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { formatClock } from '@/lib/format';
import type { Exercise } from '@/types/models';

const REST_KEY = 'fitness.restEndsAt';

export default function WorkoutSessionScreen() {
  const palette = usePalette();
  const { t, formatNumber } = useI18n();
  const { toast, confirm } = useFeedback();
  const { fire } = useHaptics();
  const now = useTicker(1000);
  const [extra, setExtra] = useState<Exercise[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(20);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [notes, setNotes] = useState('');

  const query = useLiveQuery(
    async () => {
      const session = await getActiveSession();
      if (!session) return { session: null, plan: null, sets: [], library: await listExercises() };
      const [plan, sets, library] = await Promise.all([session.planId ? getPlan(session.planId) : Promise.resolve(null), listSessionSets(session.id), listExercises()]);
      return { session, plan, sets, library };
    },
    ['workout_sessions', 'exercise_sets', 'exercises', 'workout_plans', 'workout_plan_exercises'],
    [],
  );

  // Restore an in-progress rest timer after the app was closed.
  useEffect(() => {
    readPreference<number>(REST_KEY).then((value) => {
      if (value && value > Date.now()) setRestEndsAt(value);
    });
  }, []);

  const data = query.data;
  const exercises = useMemo(() => {
    if (!data) return [] as { exercise: Exercise; targetSets: number; targetReps: number; targetWeight: number | null; rest: number }[];
    const list = (data.plan?.exercises ?? []).map((item) => ({ exercise: item.exercise, targetSets: item.targetSets, targetReps: item.targetReps, targetWeight: item.targetWeight, rest: item.restSeconds }));
    const seen = new Set(list.map((item) => item.exercise.id));
    const logged = new Set(data.sets.map((set) => set.exerciseId));
    for (const exercise of [...data.library.filter((item) => logged.has(item.id)), ...extra]) {
      if (seen.has(exercise.id)) continue;
      seen.add(exercise.id);
      list.push({ exercise, targetSets: 3, targetReps: 10, targetWeight: null, rest: 90 });
    }
    return list;
  }, [data, extra]);

  const current = exercises.find((item) => item.exercise.id === currentId) ?? exercises[0] ?? null;
  const currentSets = (data?.sets ?? []).filter((set) => set.exerciseId === current?.exercise.id);

  // Prefill from the last time this exercise was done, else the plan target.
  useEffect(() => {
    if (!current) return;
    let active = true;
    lastSetFor(current.exercise.id).then((last) => {
      if (!active) return;
      setReps(last?.reps ?? current.targetReps);
      setWeight(last?.weight ?? current.targetWeight ?? 20);
    });
    return () => {
      active = false;
    };
  }, [current?.exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const restRemaining = restEndsAt ? Math.max(0, restEndsAt - now) : 0;
  // End the rest exactly at its deadline (computed from the stored timestamp).
  useEffect(() => {
    if (!restEndsAt) return;
    const timer = setTimeout(() => {
      fire('success');
      setRestEndsAt(null);
      void savePreference(REST_KEY, null);
    }, Math.max(0, restEndsAt - Date.now()));
    return () => clearTimeout(timer);
  }, [restEndsAt, fire]);

  const header = <ScreenHeader title={data?.session?.name ?? t('fitness.workout')} actions={data?.session ? <Pill label={formatClock(now - data.session.startedAt)} tone="solid" icon={Timer} /> : null} />;

  if (!data) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }
  if (!data.session) {
    return (
      <Screen header={header}>
        <EmptyState icon={Square} title={t('fitness.noActive')} message={t('fitness.noActiveBody')} actionLabel={t('common.back')} onAction={() => router.back()} />
      </Screen>
    );
  }
  const session = data.session;

  const log = async () => {
    if (!current) return;
    try {
      await logSet(session.id, current.exercise.id, Math.round(reps), weight);
      fire('success');
      const ends = Date.now() + current.rest * 1000;
      setRestEndsAt(current.rest > 0 ? ends : null);
      await savePreference(REST_KEY, current.rest > 0 ? ends : null);
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    }
  };

  const finish = async () => {
    const clean = validateOptionalText(notes, LIMITS.description);
    try {
      await finishSession(session.id, clean.ok ? clean.value : null);
      await savePreference(REST_KEY, null);
      toast(t('fitness.finished'));
      setFinishing(false);
      router.back();
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    }
  };

  const discard = async () => {
    const ok = await confirm({ title: t('fitness.discardTitle'), message: t('fitness.discardBody'), confirmLabel: t('fitness.discard'), destructive: true });
    if (!ok) return;
    await discardSession(session.id);
    await savePreference(REST_KEY, null);
    router.back();
  };

  const footer = (
    <View style={styles.footer}>
      <IconButton icon={Trash2} label={t('fitness.discard')} onPress={discard} size={52} />
      <PremiumButton label={t('fitness.finish')} icon={Check} variant="secondary" style={styles.flex} onPress={() => setFinishing(true)} />
    </View>
  );

  return (
    <Screen header={header} footer={footer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
        {exercises.map((item) => {
          const done = (data.sets ?? []).filter((set) => set.exerciseId === item.exercise.id).length;
          return (
            <DSChip
              key={item.exercise.id}
              label={item.exercise.name}
              count={done}
              selected={current?.exercise.id === item.exercise.id}
              onPress={() => setCurrentId(item.exercise.id)}
            />
          );
        })}
        <DSChip label={t('fitness.addExercise')} icon={Plus} onPress={() => setPicking(true)} />
      </ScrollView>

      {!current ? (
        <EmptyState icon={Plus} title={t('fitness.addFirst')} message={t('fitness.addFirstBody')} actionLabel={t('fitness.addExercise')} onAction={() => setPicking(true)} />
      ) : (
        <>
          <DSCard glow>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text variant="label" tone="secondary">
                  {t('fitness.currentFocus')}
                </Text>
                <Text variant="h2">{current.exercise.name}</Text>
                <Text variant="small" tone="accent">
                  {t('fitness.setOf', { current: currentSets.length + 1, total: Math.max(current.targetSets, currentSets.length + 1) })}
                  {current.targetWeight ? ` · ${t('fitness.target', { reps: current.targetReps, weight: formatNumber(current.targetWeight) })}` : ''}
                </Text>
              </View>
              {restEndsAt ? (
                <ProgressRing progress={restRemaining / (current.rest * 1000)} size={74} stroke={6}>
                  <Text variant="smallStrong" latin>
                    {formatClock(restRemaining)}
                  </Text>
                  <Text variant="micro" tone="secondary">
                    {t('fitness.rest')}
                  </Text>
                </ProgressRing>
              ) : null}
            </View>
            <View style={styles.sets}>
              {currentSets.map((set) => (
                <View key={set.id} style={[styles.set, { backgroundColor: palette.accentMuted }]}>
                  <Text variant="micro" tone="accent">
                    {t('fitness.setN', { n: set.setIndex })}
                  </Text>
                  <Text variant="bodyStrong" latin>
                    {`${formatNumber(set.weight)} × ${set.reps}`}
                  </Text>
                  <IconButton icon={X} label={t('common.delete')} onPress={() => deleteSet(set.id)} variant="plain" size={28} />
                </View>
              ))}
            </View>
            <View style={styles.steppers}>
              <Stepper label={t('fitness.weightKg')} value={weight} onChange={setWeight} step={2.5} min={FITNESS_BOUNDS.weightKg.min} max={FITNESS_BOUNDS.weightKg.max} />
              <Stepper label={t('fitness.reps')} value={reps} onChange={setReps} step={1} min={0} max={FITNESS_BOUNDS.reps.max} />
            </View>
            <View style={styles.actions}>
              <PremiumButton label={t('fitness.logSet')} icon={Check} onPress={log} style={styles.flex} haptic={null} />
              {restEndsAt ? (
                <PremiumButton
                  label={t('fitness.skipRest')}
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => {
                    setRestEndsAt(null);
                    void savePreference(REST_KEY, null);
                  }}
                />
              ) : null}
            </View>
          </DSCard>
          {current.rest > 0 ? (
            <Text variant="small" tone="muted" align="center">
              {t('fitness.restInfo', { seconds: current.rest })}
            </Text>
          ) : null}
        </>
      )}

      <ExercisePickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        exercises={data.library}
        onPick={(exercise) => {
          setExtra((list) => (list.some((item) => item.id === exercise.id) ? list : [...list, exercise]));
          setCurrentId(exercise.id);
          setPicking(false);
        }}
      />
      <DSBottomSheet visible={finishing} onClose={() => setFinishing(false)} title={t('fitness.finishTitle')} subtitle={t('fitness.finishSub', { sets: data.sets.length, time: formatClock(now - session.startedAt) })} footer={<PremiumButton label={t('fitness.finish')} icon={Check} onPress={finish} />}>
        <DSInput label={t('fitness.notes')} placeholder={t('fitness.notesPlaceholder')} value={notes} onChangeText={setNotes} multiline maxLength={LIMITS.description} />
      </DSBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  chipScroll: { marginHorizontal: -space.gutter, flexGrow: 0 },
  chips: { gap: space.sm, paddingHorizontal: space.gutter },
  sets: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  set: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: space.md, borderRadius: radius.md },
  steppers: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  footer: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
