import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { LucideIcon } from '@/components/ui/icons';

import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface DSSwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Custom switch matching the reference: accent track, dark knob. */
export const DSSwitch = memo(function DSSwitch({ value, onChange, label, disabled }: DSSwitchProps) {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const progress = useDerivedValue(() =>
    reduceMotion ? withTiming(value ? 1 : 0, { duration: 0 }) : withSpring(value ? 1 : 0, { damping: 16, stiffness: 240 }),
  );

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [palette.elevated, palette.accent]),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 22 }],
    backgroundColor: interpolateColor(progress.value, [0, 1], [palette.textMuted, palette.scheme === 'dark' ? '#1A1708' : '#FFFFFF']),
  }));

  return (
    <PressableScale
      onPress={() => onChange(!value)}
      disabled={disabled}
      haptic="selection"
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={label}
      hitSlop={10}
      scaleTo={0.94}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </PressableScale>
  );
});

export interface SettingRowProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
}

/** List row used in settings-style screens. */
export const SettingRow = memo(function SettingRow({ icon: Icon, title, subtitle, right, onPress, danger }: SettingRowProps) {
  const palette = usePalette();
  const body = (
    <View style={styles.row}>
      {Icon ? (
        <View style={[styles.iconWrap, { backgroundColor: palette.surfaceAlt }]}>
          <Icon size={18} color={danger ? palette.dangerText : palette.accentText} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text variant="bodyStrong" tone={danger ? 'danger' : 'primary'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={title} accessibilityHint={subtitle} scaleTo={0.985}>
      {body}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  track: {
    width: 52,
    height: 30,
    borderRadius: radius.pill,
    padding: 4,
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingVertical: space.sm,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
});
