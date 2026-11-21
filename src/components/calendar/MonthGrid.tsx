import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useI18n } from '@/i18n';
import { monthGrid, parseDateKey, type DateKey, type WeekStart } from '@/lib/dates';
import { usePalette } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export interface DayMarker {
  /** Up to three category dots */
  colors: string[];
  /** Mood emoji for the day */
  mood?: string;
  /** All planned items on this day are done */
  complete?: boolean;
}

export interface MonthGridProps {
  year: number;
  month: number;
  selected: DateKey | null;
  today: DateKey;
  weekStart: WeekStart;
  onSelect: (date: DateKey) => void;
  markers?: Record<DateKey, DayMarker>;
  minDate?: DateKey;
  cellHeight?: number;
}

export const MonthGrid = memo(function MonthGrid({
  year,
  month,
  selected,
  today,
  weekStart,
  onSelect,
  markers,
  minDate,
  cellHeight = 62,
}: MonthGridProps) {
  const { weekdayName, formatDate } = useI18n();
  const palette = usePalette();
  const cells = useMemo(() => monthGrid(year, month, weekStart), [year, month, weekStart]);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => (index + weekStart) % 7), [weekStart]);

  return (
    <View>
      <View style={styles.row}>
        {weekdays.map((weekday) => (
          <View key={weekday} style={styles.headerCell}>
            <Text
              variant="micro"
              tone={weekday === 0 || weekday === 6 ? 'accent' : 'muted'}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {weekdayName(weekday, 'narrow')}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((date) => (
          <DayCell
            key={date}
            date={date}
            inMonth={parseDateKey(date).month === month}
            isToday={date === today}
            isSelected={date === selected}
            disabled={!!minDate && date < minDate}
            marker={markers?.[date]}
            onSelect={onSelect}
            height={cellHeight}
            label={formatDate(date, 'full')}
            palette={palette}
          />
        ))}
      </View>
    </View>
  );
});

interface DayCellProps {
  date: DateKey;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  disabled: boolean;
  marker?: DayMarker;
  onSelect: (date: DateKey) => void;
  height: number;
  label: string;
  palette: ReturnType<typeof usePalette>;
}

/** Calendar date cell; memoised so month navigation only re-renders changed cells. */
const DayCell = memo(function DayCell({ date, inMonth, isToday, isSelected, disabled, marker, onSelect, height, label, palette }: DayCellProps) {
  const day = parseDateKey(date).day;
  const circleBg = isSelected ? palette.accent : isToday ? palette.accentMuted : 'transparent';
  const fg = isSelected ? palette.onAccent : !inMonth ? palette.textMuted : isToday ? palette.accentText : palette.text;
  return (
    <PressableScale
      onPress={() => onSelect(date)}
      disabled={disabled}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected, disabled }}
      scaleTo={0.9}
      style={[styles.cell, { height, opacity: disabled ? 0.3 : inMonth ? 1 : 0.45 }]}
    >
      <View style={[styles.circle, { backgroundColor: circleBg }]}>
        <Text variant="bodyStrong" color={fg} latin>
          {day}
        </Text>
      </View>
      <View style={styles.markerRow}>
        {marker?.mood ? (
          <Text style={styles.mood} accessibilityElementsHidden>
            {marker.mood}
          </Text>
        ) : (
          marker?.colors.slice(0, 3).map((color, index) => <View key={index} style={[styles.dot, { backgroundColor: color }]} />)
        )}
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: space.xs },
  headerCell: { flex: 1, alignItems: 'center', paddingVertical: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingTop: 4, gap: 3 },
  circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  markerRow: { flexDirection: 'row', gap: 3, height: 14, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  mood: { fontSize: 11, lineHeight: 14 },
});
