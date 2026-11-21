import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { withAlpha } from '@/lib/color';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export interface ChartPoint {
  label: string;
  /** 0–1, or null when the day has no data (drawn as a gap) */
  value: number | null;
  highlight?: boolean;
}

/** Completion line chart with 0/50/100 guides; null points break the line. */
export const LineChart = memo(function LineChart({ points, height = 150 }: { points: ChartPoint[]; height?: number }) {
  const palette = usePalette();
  const width = 320;
  const left = 30;
  const top = 10;
  const bottom = 22;
  const innerW = width - left - 8;
  const innerH = height - top - bottom;
  const x = (index: number) => left + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const y = (value: number) => top + (1 - value) * innerH;

  const segments: string[] = [];
  let current = '';
  points.forEach((point, index) => {
    if (point.value == null) {
      if (current) segments.push(current);
      current = '';
      return;
    }
    current += `${current ? 'L' : 'M'} ${x(index)} ${y(point.value)} `;
  });
  if (current) segments.push(current);
  const area = segments.map((segment) => {
    const coords = segment.trim().split(/[ML]/).filter(Boolean).map((pair) => pair.trim().split(' ').map(Number));
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (!first || !last) return '';
    return `${segment} L ${last[0]} ${top + innerH} L ${first[0]} ${top + innerH} Z`;
  });

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={withAlpha(palette.accent, 0.28)} />
            <Stop offset="1" stopColor={withAlpha(palette.accent, 0)} />
          </LinearGradient>
        </Defs>
        {[0, 0.5, 1].map((guide) => (
          <Line key={guide} x1={left} x2={width - 8} y1={y(guide)} y2={y(guide)} stroke={palette.border} strokeDasharray="3 5" />
        ))}
        {area.map((d, index) => (d ? <Path key={`a${index}`} d={d} fill="url(#lineFill)" /> : null))}
        {segments.map((d, index) => (
          <Path key={`l${index}`} d={d} stroke={palette.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {points.map((point, index) =>
          point.value == null ? null : <Circle key={index} cx={x(index)} cy={y(point.value)} r={point.highlight ? 5 : 3.2} fill={point.highlight ? palette.accent : palette.surface} stroke={palette.accent} strokeWidth={2} />,
        )}
      </Svg>
      <View style={[styles.axisY, { height }]} pointerEvents="none">
        {['100%', '50%', '0%'].map((label) => (
          <Text key={label} variant="micro" tone="muted" latin>
            {label}
          </Text>
        ))}
      </View>
      {points.length <= 7 ? (
        <View style={[styles.axisX, { paddingLeft: `${(left / width) * 100}%` }]}>
          {points.map((point, index) => (
            <Text key={index} variant="micro" tone={point.highlight ? 'accent' : 'muted'} style={styles.axisLabel} numberOfLines={1}>
              {point.label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
});

export const BarChart = memo(function BarChart({ bars, height = 120 }: { bars: { label: string; value: number; highlight?: boolean }[]; height?: number }) {
  const palette = usePalette();
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <View style={[styles.bars, { height: height + 22 }]}>
      {bars.map((bar, index) => (
        <View key={index} style={styles.barCol}>
          <View style={[styles.barTrack, { height }]}>
            <View
              style={[
                styles.bar,
                { height: Math.max(bar.value > 0 ? 6 : 0, (bar.value / max) * height), backgroundColor: bar.highlight ? palette.accent : palette.elevated },
              ]}
            />
          </View>
          {bars.length <= 7 ? (
            <Text variant="micro" tone={bar.highlight ? 'accent' : 'muted'} numberOfLines={1}>
              {bar.label}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
});

export const StackedBar = memo(function StackedBar({ segments }: { segments: { value: number; color: string }[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return null;
  return (
    <View style={styles.stack}>
      {segments
        .filter((segment) => segment.value > 0)
        .map((segment, index) => (
          <View key={index} style={{ flex: segment.value / total, backgroundColor: segment.color }} />
        ))}
    </View>
  );
});

const styles = StyleSheet.create({
  axisY: { position: 'absolute', left: 0, top: 4, justifyContent: 'space-between', paddingBottom: 18 },
  axisX: { flexDirection: 'row', marginTop: -16 },
  axisLabel: { flex: 1, textAlign: 'center', textTransform: 'none' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: radius.xs },
  stack: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2, marginTop: space.md },
});
