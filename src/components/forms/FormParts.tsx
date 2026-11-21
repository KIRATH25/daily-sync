import { memo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, Plus } from '@/components/ui/icons';

import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { DatePickerSheet } from '@/components/ui/Pickers';
import { PressableScale } from '@/components/ui/PressableScale';
import { DSBottomSheet } from '@/components/ui/Sheet';
import { PremiumButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { useI18n } from '@/i18n';
import { weekdayOf, type DateKey } from '@/lib/dates';
import type { RecurrenceRule } from '@/lib/recurrence';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export function FormSection({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <DSCard>
      <View style={styles.sectionHead}>
        <Text variant="label" tone="secondary" accessibilityRole="header" style={styles.flex}>
          {title}
        </Text>
        {right}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </DSCard>
  );
}

export const SWATCHES = ['#F4D54D', '#F4A3A3', '#CFC27A', '#74E6FF', '#B8A5FF', '#8FE0A8', '#F7B98B', '#9DC4FF'];

export const ColorSwatches = memo(function ColorSwatches({ value, onChange, label }: { value: string | null; onChange: (color: string | null) => void; label: string }) {
  const palette = usePalette();
  return (
    <View style={styles.swatchRow}>
      <Text variant="smallStrong" tone="secondary" style={styles.flex}>
        {label}
      </Text>
      <View style={styles.swatches}>
        {SWATCHES.map((color) => {
          const selected = value === color;
          return (
            <PressableScale
              key={color}
              onPress={() => onChange(selected ? null : color)}
              haptic="selection"
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={color}
              hitSlop={4}
              scaleTo={0.85}
              style={[styles.swatch, { backgroundColor: color, borderColor: selected ? palette.text : 'transparent' }]}
            >
              {selected ? <Check size={14} color="#141414" strokeWidth={3} /> : null}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
});

export const WeekdayPicker = memo(function WeekdayPicker({ value, onChange, weekStart }: { value: number[]; onChange: (days: number[]) => void; weekStart: 0 | 1 }) {
  const palette = usePalette();
  const { weekdayName } = useI18n();
  const order = Array.from({ length: 7 }, (_, index) => (index + weekStart) % 7);
  return (
    <View style={styles.weekdays}>
      {order.map((day) => {
        const selected = value.includes(day);
        return (
          <PressableScale
            key={day}
            onPress={() => onChange(selected ? value.filter((d) => d !== day) : [...value, day].sort())}
            haptic="selection"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={weekdayName(day, 'long')}
            scaleTo={0.88}
            style={[styles.weekday, { backgroundColor: selected ? palette.accent : palette.surfaceAlt }]}
          >
            <Text variant="smallStrong" color={selected ? palette.onAccent : palette.textSecondary}>
              {weekdayName(day, 'narrow')}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
});

const REMINDER_PRESETS = [0, 5, 10, 15, 30, 60, 120, 1440];

/** Multi-select reminder offsets (minutes before), max 5, with a custom option. */
export const ReminderPicker = memo(function ReminderPicker({ value, onChange }: { value: number[]; onChange: (offsets: number[]) => void }) {
  const { t, formatDuration } = useI18n();
  const [customOpen, setCustomOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState(45);
  const [customUnit, setCustomUnit] = useState<'m' | 'h' | 'd'>('m');
  const options = [...new Set([...REMINDER_PRESETS, ...value])].sort((a, b) => a - b);
  const label = (offset: number) => (offset === 0 ? t('reminder.atTime') : t('reminder.before', { time: formatDuration(offset * 60) }));

  const toggle = (offset: number) => {
    if (value.includes(offset)) onChange(value.filter((item) => item !== offset));
    else if (value.length < 5) onChange([...value, offset].sort((a, b) => b - a));
  };

  return (
    <View style={styles.chips}>
      {options.map((offset) => (
        <DSChip key={offset} label={label(offset)} selected={value.includes(offset)} onPress={() => toggle(offset)} size="sm" />
      ))}
      <DSChip label={t('reminder.custom')} icon={Plus} onPress={() => setCustomOpen(true)} size="sm" />
      <DSBottomSheet
        visible={customOpen}
        onClose={() => setCustomOpen(false)}
        title={t('reminder.customTitle')}
        footer={
          <PremiumButton
            label={t('reminder.add', { time: label(customAmount * (customUnit === 'm' ? 1 : customUnit === 'h' ? 60 : 1440)) })}
            onPress={() => {
              const minutes = customAmount * (customUnit === 'm' ? 1 : customUnit === 'h' ? 60 : 1440);
              if (minutes <= 43_200 && !value.includes(minutes) && value.length < 5) onChange([...value, minutes].sort((a, b) => b - a));
              setCustomOpen(false);
            }}
          />
        }
      >
        <Segmented
          options={[
            { value: 'm', label: t('reminder.minutes') },
            { value: 'h', label: t('reminder.hours') },
            { value: 'd', label: t('reminder.days') },
          ]}
          value={customUnit}
          onChange={setCustomUnit}
        />
        <View style={styles.chips}>
          {(customUnit === 'm' ? [1, 2, 3, 20, 45, 90] : customUnit === 'h' ? [2, 3, 4, 6, 12, 18] : [2, 3, 5, 7, 14, 30]).map((amount) => (
            <DSChip key={amount} label={String(amount)} selected={customAmount === amount} onPress={() => setCustomAmount(amount)} />
          ))}
        </View>
      </DSBottomSheet>
    </View>
  );
});

type RepeatChoice = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom';

function choiceFromRule(rule: RecurrenceRule | null): RepeatChoice {
  if (!rule) return 'none';
  if (rule.freq === 'weekly') {
    const days = rule.byWeekday ?? [];
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'weekdays';
    if (days.length > 1) return 'custom';
    return 'weekly';
  }
  return rule.freq;
}

/** Repeat selector with weekday picking and an optional end date. */
export function RecurrencePicker({
  value,
  onChange,
  startDate,
  weekStart,
}: {
  value: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
  startDate: DateKey;
  weekStart: 0 | 1;
}) {
  const { t, weekdayName, formatDate } = useI18n();
  const [pickingEnd, setPickingEnd] = useState(false);
  const choice = choiceFromRule(value);
  const until = value?.until ?? null;

  const select = (next: RepeatChoice) => {
    const base = { interval: 1, until };
    switch (next) {
      case 'none':
        return onChange(null);
      case 'daily':
        return onChange({ freq: 'daily', ...base });
      case 'weekdays':
        return onChange({ freq: 'weekly', byWeekday: [1, 2, 3, 4, 5], ...base });
      case 'weekly':
        return onChange({ freq: 'weekly', byWeekday: [weekdayOf(startDate)], ...base });
      case 'monthly':
        return onChange({ freq: 'monthly', ...base });
      case 'yearly':
        return onChange({ freq: 'yearly', ...base });
      case 'custom':
        return onChange({ freq: 'weekly', byWeekday: [...new Set([weekdayOf(startDate), (weekdayOf(startDate) + 2) % 7])].sort(), ...base });
    }
  };

  const options: { value: RepeatChoice; label: string }[] = [
    { value: 'none', label: t('repeat.none') },
    { value: 'daily', label: t('repeat.daily') },
    { value: 'weekdays', label: t('repeat.weekdays') },
    { value: 'weekly', label: t('repeat.weeklyOn', { day: weekdayName(weekdayOf(startDate), 'short') }) },
    { value: 'monthly', label: t('repeat.monthly') },
    { value: 'yearly', label: t('repeat.yearly') },
    { value: 'custom', label: t('repeat.custom') },
  ];

  return (
    <View style={styles.repeat}>
      <View style={styles.chips}>
        {options.map((option) => (
          <DSChip key={option.value} label={option.label} selected={choice === option.value} onPress={() => select(option.value)} size="sm" />
        ))}
      </View>
      {choice === 'custom' && value ? (
        <WeekdayPicker
          value={value.byWeekday ?? []}
          weekStart={weekStart}
          onChange={(days) => onChange({ ...value, byWeekday: days.length ? days : [weekdayOf(startDate)] })}
        />
      ) : null}
      {value ? (
        <View style={styles.chips}>
          <DSChip label={until ? t('repeat.until', { date: formatDate(until, 'medium') }) : t('repeat.forever')} selected={!!until} onPress={() => setPickingEnd(true)} size="sm" />
          {until ? <DSChip label={t('repeat.clearEnd')} onPress={() => onChange({ ...value, until: null })} size="sm" /> : null}
        </View>
      ) : null}
      <DatePickerSheet
        visible={pickingEnd}
        value={until ?? startDate}
        minDate={startDate}
        title={t('repeat.endTitle')}
        onClose={() => setPickingEnd(false)}
        onChange={(date) => value && onChange({ ...value, until: date })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sectionBody: { gap: space.md, marginTop: space.md },
  swatchRow: { gap: space.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  weekdays: { flexDirection: 'row', gap: 6 },
  weekday: { flex: 1, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  repeat: { gap: space.md },
});
