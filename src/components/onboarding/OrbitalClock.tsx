import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Stop } from 'react-native-svg';

import { withAlpha } from '@/lib/color';
import { usePalette, useTheme } from '@/theme/ThemeProvider';

/**
 * Hero illustration from the welcome reference: concentric dashed orbits,
 * planets, and a clock face whose hands show the real current time. The
 * outer orbit drifts slowly (paused when reduced motion is on).
 */
export const OrbitalClock = memo(function OrbitalClock({ size, hour, minute }: { size: number; hour: number; minute: number }) {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(360, { duration: 60_000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(spin);
  }, [reduceMotion, spin]);

  const orbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const accent = palette.accent;
  const faint = withAlpha(accent, 0.28);
  const hourAngle = ((hour % 12) + minute / 60) * 30;
  const minuteAngle = minute * 6;
  const hand = (angle: number, length: number) => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return { x2: 100 + Math.cos(radians) * length, y2: 100 + Math.sin(radians) * length };
  };

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={withAlpha(accent, 0.16)} />
            <Stop offset="1" stopColor={withAlpha(accent, 0)} />
          </RadialGradient>
        </Defs>
        <Circle cx="100" cy="100" r="99" fill="url(#halo)" />
        <Circle cx="100" cy="100" r="62" stroke={faint} strokeWidth="0.8" fill="none" />
        <G stroke={withAlpha(accent, 0.55)} strokeWidth="1.4" strokeLinecap="round" fill="none">
          <Path d="M100 44 A56 56 0 0 1 148 72" />
          <Path d="M156 100 A56 56 0 0 1 128 148" />
          <Path d="M100 156 A56 56 0 0 1 52 128" />
          <Path d="M44 100 A56 56 0 0 1 72 52" />
        </G>
        <Circle cx="100" cy="100" r="34" stroke={faint} strokeWidth="0.8" fill="none" />
        <G stroke={accent} strokeWidth="2.4" strokeLinecap="round" fill="none">
          <Path d="M100 76 A24 24 0 0 1 124 100" />
          <Path d="M100 124 A24 24 0 0 1 76 100" />
        </G>
        <Circle cx="100" cy="100" r="12" fill={palette.elevated} />
        <Line x1="100" y1="100" {...hand(hourAngle, 15)} stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <Line x1="100" y1="100" {...hand(minuteAngle, 22)} stroke={palette.text} strokeWidth="1.6" strokeLinecap="round" />
        <Circle cx="100" cy="100" r="3.6" fill={accent} />
        <Line x1="100" y1="18" x2="100" y2="24" stroke={accent} strokeWidth="1.6" />
        <Line x1="100" y1="176" x2="100" y2="182" stroke={faint} strokeWidth="1.2" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, orbitStyle]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Circle cx="100" cy="100" r="86" stroke={withAlpha(accent, 0.2)} strokeWidth="0.8" strokeDasharray="2 5" fill="none" />
          <Circle cx="100" cy="14" r="6" stroke={withAlpha(accent, 0.5)} strokeWidth="0.8" fill="none" />
          <Circle cx="100" cy="14" r="3.4" fill={accent} />
          <Circle cx="160" cy="161" r="3" fill={palette.textSecondary} />
          <Circle cx="30" cy="150" r="4.6" stroke={accent} strokeWidth="1" fill="none" />
          <Circle cx="30" cy="150" r="2" fill={accent} />
        </Svg>
      </Animated.View>
    </View>
  );
});
