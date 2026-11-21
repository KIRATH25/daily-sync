import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Minus, Plus, Search } from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { DSInput } from '@/components/ui/Input';
import { PressableScale } from '@/components/ui/PressableScale';
import { DSBottomSheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { createExercise } from '@/db/repositories/fitnessRepo';
import { useI18n, type TKey } from '@/i18n';
import { withAlpha } from '@/lib/color';
import { validateTitle } from '@/lib/validation';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { Exercise } from '@/types/models';

export const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body'] as const;

/** Compact −/+ stepper with a typed value; clamps to [min, max]. */
export const Stepper = memo(function Stepper({
  label,
  value,
  onChange,
  step,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step: number;
  min: number;
  max: number;
  suffix?: string;
}) {
  const palette = usePalette();
  const { formatNumber } = useI18n();
  const set = (next: number) => onChange(Math.max(min, Math.min(max, Math.round(next * 100) / 100)));
  return (
    <View style={styles.stepper}>
      <Text variant="micro" tone="secondary">
        {label}
      </Text>
      <View style={[styles.stepperBox, { backgroundColor: palette.surfaceAlt }]}>
        <PressableScale onPress={() => set(value - step)} accessibilityLabel={`${label} −`} hitSlop={6} haptic="selection" style={styles.stepBtn}>
          <Minus size={16} color={palette.text} />
        </PressableScale>
        <Text variant="h3" latin style={styles.stepValue} accessibilityLiveRegion="polite">
          {formatNumber(value)}
          {suffix ? <Text variant="small" tone="secondary">{` ${suffix}`}</Text> : null}
        </Text>
        <PressableScale onPress={() => set(value + step)} accessibilityLabel={`${label} +`} hitSlop={6} haptic="selection" style={styles.stepBtn}>
          <Plus size={16} color={palette.text} />
        </PressableScale>
      </View>
    </View>
  );
});

export function ExercisePickerSheet({
  visible,
  onClose,
  exercises,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onPick: (exercise: Exercise) => void;
}) {
  const palette = usePalette();
  const { t } = useI18n();
  const { toast } = useFeedback();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [customGroup, setCustomGroup] = useState<string>('full_body');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((exercise) => (!group || exercise.muscleGroup === group) && (!q || exercise.name.toLowerCase().includes(q)));
  }, [exercises, query, group]);

  const addCustom = async () => {
    const name = validateTitle(query);
    if (!name.ok) return;
    try {
      const exercise = await createExercise(name.value.slice(0, 80), customGroup);
      onPick(exercise);
      setQuery('');
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    }
  };

  return (
    <DSBottomSheet visible={visible} onClose={onClose} title={t('fitness.pickExercise')}>
      <DSInput placeholder={t('fitness.searchExercise')} value={query} onChangeText={setQuery} left={<Search size={16} color={palette.textMuted} />} maxLength={80} />
      <View style={styles.chips}>
        <DSChip label={t('fitness.allGroups')} selected={group === null} onPress={() => setGroup(null)} size="sm" />
        {MUSCLE_GROUPS.map((value) => (
          <DSChip key={value} label={t(`muscle.${value}` as TKey)} selected={group === value} onPress={() => setGroup(group === value ? null : value)} size="sm" />
        ))}
      </View>
      {filtered.map((exercise) => (
        <PressableScale key={exercise.id} onPress={() => onPick(exercise)} accessibilityLabel={exercise.name} style={[styles.exerciseRow, { backgroundColor: palette.surfaceAlt }]}>
          <Text variant="bodyStrong" style={styles.flex}>
            {exercise.name}
          </Text>
          <Text variant="small" tone="secondary">
            {t(`muscle.${exercise.muscleGroup}` as TKey)}
          </Text>
        </PressableScale>
      ))}
      {query.trim() && !filtered.some((exercise) => exercise.name.toLowerCase() === query.trim().toLowerCase()) ? (
        <View style={styles.custom}>
          <Text variant="smallStrong" tone="secondary">
            {t('fitness.customExercise')}
          </Text>
          <View style={styles.chips}>
            {MUSCLE_GROUPS.map((value) => (
              <DSChip key={value} label={t(`muscle.${value}` as TKey)} selected={customGroup === value} onPress={() => setCustomGroup(value)} size="sm" />
            ))}
          </View>
          <PremiumButton label={t('fitness.addCustom', { name: query.trim() })} icon={Plus} variant="soft" size="md" onPress={addCustom} />
        </View>
      ) : null}
    </DSBottomSheet>
  );
}

/** Minimal line chart for body weight; draws only real points. */
export const TrendChart = memo(function TrendChart({ values, height = 110 }: { values: number[]; height?: number }) {
  const palette = usePalette();
  if (values.length < 2) return null;
  const width = 300;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => ({
    x: (index / (values.length - 1)) * (width - 16) + 8,
    y: height - 12 - ((value - min) / span) * (height - 28),
  }));
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const area = `${line} L ${points[points.length - 1]?.x ?? 0} ${height} L ${points[0]?.x ?? 0} ${height} Z`;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={withAlpha(palette.accent, 0.3)} />
          <Stop offset="1" stopColor={withAlpha(palette.accent, 0)} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#trendFill)" />
      <Path d={line} stroke={palette.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      {points.map((point, index) => (
        <Circle key={index} cx={point.x} cy={point.y} r={index === points.length - 1 ? 4.5 : 3} fill={palette.accent} />
      ))}
    </Svg>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stepper: { flex: 1, gap: 6 },
  stepperBox: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, height: 52 },
  stepBtn: { width: 44, height: 52, alignItems: 'center', justifyContent: 'center' },
  stepValue: { flex: 1, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md },
  custom: { gap: space.sm },
});
