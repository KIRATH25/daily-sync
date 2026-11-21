import { memo, useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  /** 0–1 */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  accessibilityLabel?: string;
}

/** Animated circular progress drawn with SVG; animates on the UI thread. */
export const ProgressRing = memo(function ProgressRing({
  progress,
  size = 96,
  stroke = 9,
  color,
  trackColor,
  children,
  accessibilityLabel,
}: ProgressRingProps) {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const value = useSharedValue(0);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    value.value = reduceMotion ? clamped : withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion, value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.value),
  }));

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor ?? palette.elevated} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? palette.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
});

export interface ProgressBarProps {
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}

export const ProgressBar = memo(function ProgressBar({ progress, height = 6, color, trackColor, style }: ProgressBarProps) {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const value = useSharedValue(0);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    value.value = reduceMotion ? clamped : withTiming(clamped, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion, value]);

  const fill = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={[{ height, borderRadius: radius.pill, backgroundColor: trackColor ?? palette.elevated, overflow: 'hidden' }, style]}
    >
      <Animated.View style={[{ height, borderRadius: radius.pill, backgroundColor: color ?? palette.accent }, fill]} />
    </View>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
