import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  BookOpen,
  Brain,
  Check,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Leaf,
  Moon,
  Music,
  PauseCircle,
  PenLine,
  Plus,
  Sparkles,
  Sun,
  type LucideIcon,
} from '@/components/ui/icons';

import { DSCard } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressBar } from '@/components/ui/Progress';
import { Text } from '@/components/ui/Text';
import { useHaptics } from '@/hooks/useHaptics';
import { useI18n } from '@/i18n';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { Habit, HabitIcon } from '@/types/models';

export const HABIT_ICON_MAP: Record<HabitIcon, LucideIcon> = {
  droplet: Droplet,
  book: BookOpen,
  dumbbell: Dumbbell,
  footprints: Footprints,
  brain: Brain,
  moon: Moon,
  sun: Sun,
  leaf: Leaf,
  heart: Heart,
  pen: PenLine,
  music: Music,
  sparkles: Sparkles,
};

export interface HabitCardProps {
  habit: Habit;
  value: number;
  done: boolean;
  due: boolean;
  streak: number;
  onToggle: (habit: Habit) => void;
  onIncrement: (habit: Habit) => void;
}

export const HabitCard = memo(function HabitCard({ habit, value, done, due, streak, onToggle, onIncrement }: HabitCardProps) {
  const palette = usePalette();
  const { t, formatNumber, weekdayName } = useI18n();
  const { fire } = useHaptics();
  const Icon = HABIT_ICON_MAP[habit.icon] ?? Sparkles;
  const isCount = habit.unit != null && habit.targetValue > 1;
  const color = habit.color ?? palette.accent;
  const schedule =
    habit.scheduleDays.length === 7 ? t('habits.everyDay') : habit.scheduleDays.map((day) => weekdayName(day, 'short')).join(' · ');

  return (
    <DSCard onPress={() => router.push(`/habits/${habit.id}`)} accessibilityLabel={habit.title} style={habit.paused ? styles.paused : undefined}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: done ? color : palette.surfaceAlt }]}>
          <Icon size={22} color={done ? palette.onAccent : color} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text variant="title" numberOfLines={1} style={styles.flexShrink}>
              {habit.title}
            </Text>
            {streak > 0 ? (
              <View style={styles.streak}>
                <Flame size={13} color={palette.accentText} />
                <Text variant="micro" tone="accent" latin>
                  {t('habits.streakShort', { count: streak })}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="small" tone="secondary" numberOfLines={1}>
            {habit.paused ? t('habits.paused') : due ? schedule : t('habits.restDay')}
          </Text>
        </View>
        {habit.paused ? (
          <PauseCircle size={26} color={palette.textMuted} />
        ) : due ? (
          <PressableScale
            onPress={() => {
              fire(done ? 'light' : 'success');
              onToggle(habit);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={t(done ? 'tasks.markUndone' : 'tasks.markDone', { title: habit.title })}
            hitSlop={8}
            scaleTo={0.85}
            style={[styles.check, { backgroundColor: done ? color : 'transparent', borderColor: done ? color : palette.borderStrong }]}
          >
            <Check size={18} color={done ? palette.onAccent : palette.textMuted} strokeWidth={3} />
          </PressableScale>
        ) : null}
      </View>
      {isCount && due && !habit.paused ? (
        <View style={styles.count}>
          <View style={styles.countRow}>
            <Text variant="bodyStrong" latin>
              {formatNumber(value)} / {formatNumber(habit.targetValue)} {habit.unit}
            </Text>
            <Text variant="smallStrong" tone="accent" latin>
              {Math.round(Math.min(1, value / habit.targetValue) * 100)}%
            </Text>
          </View>
          <ProgressBar progress={value / habit.targetValue} height={7} color={color} />
          <PressableScale
            onPress={() => {
              fire('light');
              onIncrement(habit);
            }}
            accessibilityLabel={t('habits.addStep', { step: formatNumber(habit.increment ?? 1), unit: habit.unit ?? '' })}
            style={[styles.stepBtn, { backgroundColor: palette.surfaceAlt }]}
          >
            <Plus size={15} color={palette.text} />
            <Text variant="smallStrong" latin>
              {formatNumber(habit.increment ?? 1)} {habit.unit}
            </Text>
          </PressableScale>
        </View>
      ) : null}
    </DSCard>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  paused: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  check: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  count: { gap: space.sm, marginTop: space.md },
  countRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stepBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', paddingHorizontal: space.md, height: 36, borderRadius: radius.pill },
});
