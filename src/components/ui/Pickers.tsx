/**
 * On-brand date and time pickers presented in bottom sheets, plus the form
 * fields that open them. Built from our own components so they match the
 * theme in both light and dark mode.
 */
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from '@/components/ui/icons';

import { MonthGrid } from '@/components/calendar/MonthGrid';
import { useToday } from '@/hooks/useClock';
import { useI18n } from '@/i18n';
import { addMonths, makeDateKey, parseDateKey, type DateKey } from '@/lib/dates';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { PremiumButton } from './Button';
import { IconButton } from './IconButton';
import { PressableScale } from './PressableScale';
import { Segmented } from './Segmented';
import { DSBottomSheet } from './Sheet';
import { Text } from './Text';

interface DatePickerProps {
  visible: boolean;
  value: DateKey;
  onClose: () => void;
  onChange: (date: DateKey) => void;
  title?: string;
  minDate?: DateKey;
}

export function DatePickerSheet(props: DatePickerProps) {
  const { t } = useI18n();
  return (
    <DSBottomSheet visible={props.visible} onClose={props.onClose} title={props.title ?? t('picker.pickDate')}>
      {/* Remounting on open resets the visible month to the current value. */}
      {props.visible ? <DatePickerBody {...props} /> : null}
    </DSBottomSheet>
  );
}

function DatePickerBody({ value, onClose, onChange, minDate }: DatePickerProps) {
  const { t, formatDate } = useI18n();
  const { preferences } = usePreferences();
  const today = useToday();
  const [cursor, setCursor] = useState(value);
  const { year, month } = parseDateKey(cursor);

  return (
    <>
      <View style={styles.monthNav}>
        <IconButton icon={ChevronLeft} label={t('calendar.previousMonth')} onPress={() => setCursor(addMonths(cursor, -1))} size={40} />
        <Text variant="h3" latin={false}>
          {formatDate(makeDateKey(year, month, 1), 'monthYear')}
        </Text>
        <IconButton icon={ChevronRight} label={t('calendar.nextMonth')} onPress={() => setCursor(addMonths(cursor, 1))} size={40} />
      </View>
      <MonthGrid
        year={year}
        month={month}
        selected={value}
        today={today}
        weekStart={preferences.weekStart}
        minDate={minDate}
        cellHeight={52}
        onSelect={(date) => {
          onChange(date);
          onClose();
        }}
      />
    </>
  );
}

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function TimePickerSheet({
  visible,
  value,
  onClose,
  onChange,
  title,
}: {
  visible: boolean;
  value: number;
  onClose: () => void;
  onChange: (minute: number) => void;
  title?: string;
}) {
  const { t, formatTime } = useI18n();
  const { preferences } = usePreferences();
  const palette = usePalette();
  const [hour24, setHour24] = useState(Math.floor(value / 60));
  const [minute, setMinute] = useState(value % 60);
  // Reset to the current value each time the sheet opens (state adjusted
  // during render — React's recommended alternative to a syncing effect).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setHour24(Math.floor(value / 60));
      setMinute(value % 60);
    }
  }

  const is24 = preferences.timeFormat === '24h';
  const pm = hour24 >= 12;
  const hours = is24 ? Array.from({ length: 24 }, (_, index) => index) : HOURS_12;
  const minuteOptions = useMemo(() => (MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b)), [minute]);
  const selectHour = (hour: number) => {
    if (is24) setHour24(hour);
    else setHour24((hour % 12) + (pm ? 12 : 0));
  };
  const displayHour = is24 ? hour24 : hour24 % 12 === 0 ? 12 : hour24 % 12;

  return (
    <DSBottomSheet
      visible={visible}
      onClose={onClose}
      title={title ?? t('picker.pickTime')}
      footer={
        <PremiumButton
          label={t('picker.setTime', { time: formatTime(hour24 * 60 + minute) })}
          onPress={() => {
            onChange(hour24 * 60 + minute);
            onClose();
          }}
        />
      }
    >
      <View style={[styles.timePreview, { backgroundColor: palette.surfaceAlt }]}>
        <Text variant="statLarge" latin accessibilityLiveRegion="polite">
          {formatTime(hour24 * 60 + minute)}
        </Text>
      </View>
      {!is24 ? (
        <Segmented
          options={[
            { value: 'am', label: t('picker.am') },
            { value: 'pm', label: t('picker.pm') },
          ]}
          value={pm ? 'pm' : 'am'}
          onChange={(next) => setHour24((hour24 % 12) + (next === 'pm' ? 12 : 0))}
        />
      ) : null}
      <Text variant="label" tone="secondary">
        {t('picker.hour')}
      </Text>
      <View style={styles.grid}>
        {hours.map((hour) => (
          <ChoiceCell key={hour} label={String(hour).padStart(is24 ? 2 : 1, '0')} selected={hour === displayHour} onPress={() => selectHour(hour)} />
        ))}
      </View>
      <Text variant="label" tone="secondary">
        {t('picker.minute')}
      </Text>
      <View style={styles.grid}>
        {minuteOptions.map((option) => (
          <ChoiceCell key={option} label={`:${String(option).padStart(2, '0')}`} selected={option === minute} onPress={() => setMinute(option)} />
        ))}
      </View>
    </DSBottomSheet>
  );
}

const ChoiceCell = memo(function ChoiceCell({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const palette = usePalette();
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      scaleTo={0.9}
      style={[styles.choice, { backgroundColor: selected ? palette.accent : palette.surfaceAlt }]}
    >
      <Text variant="bodyStrong" latin color={selected ? palette.onAccent : palette.text}>
        {label}
      </Text>
    </PressableScale>
  );
});

export interface PickerFieldProps {
  label: string;
  value: string;
  onPress: () => void;
  icon?: 'date' | 'time';
  placeholder?: boolean;
}

/** Tappable field showing the current date/time value. */
export const PickerField = memo(function PickerField({ label, value, onPress, icon = 'date', placeholder }: PickerFieldProps) {
  const palette = usePalette();
  const Icon = icon === 'date' ? CalendarDays : Clock;
  return (
    <View style={styles.field}>
      <Text variant="smallStrong" tone="secondary">
        {label}
      </Text>
      <PressableScale
        onPress={onPress}
        accessibilityLabel={`${label}: ${value}`}
        scaleTo={0.98}
        style={[styles.fieldBox, { backgroundColor: palette.surfaceAlt }]}
      >
        <Icon size={18} color={palette.accentText} strokeWidth={2} />
        <Text variant="bodyStrong" tone={placeholder ? 'muted' : 'primary'} style={styles.flex} numberOfLines={1}>
          {value}
        </Text>
      </PressableScale>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timePreview: { alignItems: 'center', paddingVertical: space.lg, borderRadius: radius.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  choice: { width: '22.5%', height: 46, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, gap: space.xs + 2 },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    height: 52,
    borderRadius: radius.sm + 2,
    paddingHorizontal: space.md + 2,
  },
});
