import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from '@/components/ui/icons';

import { ExercisePickerSheet, Stepper } from '@/components/fitness/FitnessParts';
import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { useFeedback } from '@/components/ui/Feedback';
import { IconButton } from '@/components/ui/IconButton';
import { DSInput } from '@/components/ui/Input';
import { Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { deletePlan, getPlan, listExercises, savePlan } from '@/db/repositories/fitnessRepo';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n } from '@/i18n';
import { validateOptionalText, validateTitle, LIMITS, FITNESS_BOUNDS } from '@/lib/validation';
import { space } from '@/theme/tokens';
import type { Exercise } from '@/types/models';

interface Row {
  exercise: Exercise;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
  restSeconds: number;
}

export default function PlanEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id ?? null;
  const { t } = useI18n();
  const { toast, confirm } = useFeedback();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [picking, setPicking] = useState(false);
  const [loaded, setLoaded] = useState(!editingId);
  const [error, setError] = useState<string | null>(null);
  const library = useLiveQuery(listExercises, ['exercises'], []);

  useEffect(() => {
    if (!editingId) return;
    getPlan(editingId)
      .then((plan) => {
        if (!plan) return;
        setName(plan.name);
        setNotes(plan.notes ?? '');
        setRows(plan.exercises.map((item) => ({ exercise: item.exercise, targetSets: item.targetSets, targetReps: item.targetReps, targetWeight: item.targetWeight ?? 0, restSeconds: item.restSeconds })));
      })
      .finally(() => setLoaded(true));
  }, [editingId]);

  const update = (index: number, patch: Partial<Row>) => setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const move = (index: number, delta: number) =>
    setRows((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      const [item] = next.splice(index, 1);
      if (item) next.splice(target, 0, item);
      return next;
    });

  const save = async () => {
    const title = validateTitle(name);
    if (!title.ok) {
      setError(t(title.error));
      return;
    }
    const cleanNotes = validateOptionalText(notes, LIMITS.description);
    try {
      await savePlan(
        editingId,
        title.value.slice(0, 80),
        cleanNotes.ok ? cleanNotes.value : null,
        rows.map((row) => ({ exerciseId: row.exercise.id, targetSets: row.targetSets, targetReps: row.targetReps, targetWeight: row.targetWeight || null, restSeconds: row.restSeconds })),
      );
      toast(t('fitness.planSaved'));
      router.back();
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    }
  };

  const remove = async () => {
    if (!editingId) return;
    const ok = await confirm({ title: t('common.deleteConfirmTitle'), message: t('fitness.deletePlanBody'), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    await deletePlan(editingId);
    router.back();
  };

  const header = <ScreenHeader leading="close" title={editingId ? t('fitness.editPlan') : t('fitness.newPlan')} />;
  if (!loaded) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      footer={
        <View style={styles.footer}>
          {editingId ? <PremiumButton label={t('common.delete')} icon={Trash2} variant="danger" fullWidth={false} onPress={remove} /> : null}
          <PremiumButton label={t('common.save')} icon={Check} onPress={save} style={styles.flex} />
        </View>
      }
    >
      <DSInput label={t('fitness.planName')} placeholder={t('fitness.planPlaceholder')} value={name} onChangeText={setName} maxLength={80} error={error} />
      <DSInput label={t('create.notes')} value={notes} onChangeText={setNotes} maxLength={LIMITS.description} multiline />
      <SectionHeader title={t('fitness.exercises')} actionLabel={t('fitness.addExercise')} onAction={() => setPicking(true)} />
      {rows.length === 0 ? (
        <EmptyState compact icon={Plus} title={t('fitness.addFirst')} actionLabel={t('fitness.addExercise')} onAction={() => setPicking(true)} />
      ) : (
        rows.map((row, index) => (
          <DSCard key={`${row.exercise.id}-${index}`}>
            <View style={styles.rowHead}>
              <Text variant="title" style={styles.flex} numberOfLines={1}>
                {`${index + 1}. ${row.exercise.name}`}
              </Text>
              <IconButton icon={ArrowUp} label={t('fitness.moveUp')} onPress={() => move(index, -1)} variant="plain" size={34} disabled={index === 0} />
              <IconButton icon={ArrowDown} label={t('fitness.moveDown')} onPress={() => move(index, 1)} variant="plain" size={34} disabled={index === rows.length - 1} />
              <IconButton icon={X} label={t('common.remove')} onPress={() => setRows((list) => list.filter((_, i) => i !== index))} variant="plain" size={34} />
            </View>
            <View style={styles.steppers}>
              <Stepper label={t('fitness.sets')} value={row.targetSets} onChange={(targetSets) => update(index, { targetSets })} step={1} min={FITNESS_BOUNDS.sets.min} max={FITNESS_BOUNDS.sets.max} />
              <Stepper label={t('fitness.reps')} value={row.targetReps} onChange={(targetReps) => update(index, { targetReps })} step={1} min={0} max={100} />
            </View>
            <View style={styles.steppers}>
              <Stepper label={t('fitness.weightKg')} value={row.targetWeight} onChange={(targetWeight) => update(index, { targetWeight })} step={2.5} min={0} max={FITNESS_BOUNDS.weightKg.max} />
              <Stepper label={t('fitness.restSec')} value={row.restSeconds} onChange={(restSeconds) => update(index, { restSeconds })} step={15} min={0} max={FITNESS_BOUNDS.restSeconds.max} />
            </View>
          </DSCard>
        ))
      )}
      <ExercisePickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        exercises={library.data ?? []}
        onPick={(exercise) => {
          setRows((list) => [...list, { exercise, targetSets: 3, targetReps: 10, targetWeight: 0, restSeconds: 90 }]);
          setPicking(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { flexDirection: 'row', gap: space.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  steppers: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
});
