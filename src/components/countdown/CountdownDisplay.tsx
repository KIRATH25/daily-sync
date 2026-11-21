import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { useTicker } from '@/hooks/useTicker';
import { useI18n } from '@/i18n';
import { countdownParts } from '@/lib/countdown';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export interface CountdownDisplayProps {
  targetMs: number;
  showSeconds?: boolean;
  size?: 'md' | 'lg';
  accent?: string;
  variant?: 'tiles' | 'inline';
}

/**
 * Live days/hours/minutes/seconds tiles. Always computed from the target
 * instant and the real clock; ticks only while visible.
 */
export const CountdownDisplay = memo(function CountdownDisplay({
  targetMs,
  showSeconds = true,
  size = 'md',
  accent,
  variant = 'tiles',
}: CountdownDisplayProps) {
  const now = useTicker(showSeconds ? 1000 : 30_000);
  const { t, formatNumber } = useI18n();
  const palette = usePalette();
  const parts = countdownParts(targetMs, now);

  if (parts.isPast) {
    return (
      <View style={[styles.past, { backgroundColor: palette.accentMuted }]}>
        <Text variant="title" tone="accent">
          {t('countdown.arrived')}
        </Text>
      </View>
    );
  }

  const units: { value: number; label: string; highlight?: boolean }[] = [
    { value: parts.days, label: t('countdown.days') },
    { value: parts.hours, label: t('countdown.hours') },
    { value: parts.minutes, label: t('countdown.minutes') },
  ];
  if (showSeconds) units.push({ value: parts.seconds, label: t('countdown.seconds'), highlight: true });

  if (variant === 'inline') {
    return (
      <Text variant="bodyStrong" latin>
        {units.map((unit) => `${String(unit.value).padStart(2, '0')}${unit.label.charAt(0).toLowerCase()}`).join(' ')}
      </Text>
    );
  }

  return (
    <View
      style={styles.row}
      accessibilityRole="timer"
      accessibilityLabel={t('countdown.a11y', { d: parts.days, h: parts.hours, m: parts.minutes })}
    >
      {units.map((unit) => (
        <View
          key={unit.label}
          style={[
            styles.tile,
            {
              backgroundColor: unit.highlight ? palette.accentMuted : palette.surfaceAlt,
              paddingVertical: size === 'lg' ? space.md + 2 : space.md,
            },
          ]}
        >
          <AnimatedDigits value={unit.value} large={size === 'lg'} color={unit.highlight ? accent ?? palette.accentText : palette.text} pad={unit.label !== t('countdown.days')} format={formatNumber} />
          <Text variant="micro" tone="secondary">
            {unit.label}
          </Text>
        </View>
      ))}
    </View>
  );
});

function AnimatedDigits({ value, large, color, pad }: { value: number; large: boolean; color: string; pad: boolean; format: (v: number) => string }) {
  const { reduceMotion } = useTheme();
  const text = pad ? String(value).padStart(2, '0') : String(value);
  return (
    <View style={styles.digits}>
      <Animated.View
        key={text}
        entering={reduceMotion ? undefined : FadeIn.duration(220)}
        exiting={reduceMotion ? undefined : FadeOut.duration(120)}
        layout={reduceMotion ? undefined : LinearTransition}
      >
        <Text variant={large ? 'stat' : 'h2'} latin color={color}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, alignItems: 'center', borderRadius: radius.md, gap: 2 },
  digits: { minHeight: 32, justifyContent: 'center' },
  past: { padding: space.lg, borderRadius: radius.md, alignItems: 'center' },
});
