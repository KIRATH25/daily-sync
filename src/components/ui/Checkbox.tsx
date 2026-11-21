import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { usePalette, useTheme } from '@/theme/ThemeProvider';

import { PressableScale } from './PressableScale';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LENGTH = 22;

export interface AnimatedCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  size?: number;
  color?: string;
}

/**
 * Completion checkbox: the box fills, the tick draws itself and the whole
 * control does a small celebratory bounce. Success haptic on completion.
 */
export const AnimatedCheckbox = memo(function AnimatedCheckbox({ checked, onToggle, label, size = 26, color }: AnimatedCheckboxProps) {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const progress = useSharedValue(checked ? 1 : 0);
  const bounce = useSharedValue(1);
  const fill = color ?? palette.accent;

  useEffect(() => {
    progress.value = reduceMotion ? (checked ? 1 : 0) : withTiming(checked ? 1 : 0, { duration: 260 });
    if (checked && !reduceMotion) {
      bounce.value = withSequence(withTiming(1.18, { duration: 120 }), withSpring(1, { damping: 8, stiffness: 260 }));
    }
  }, [checked, reduceMotion, progress, bounce]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [palette.elevated, fill]),
    borderColor: interpolateColor(progress.value, [0, 1], [palette.borderStrong, fill]),
    transform: [{ scale: bounce.value }],
  }));

  const tickProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LENGTH * (1 - progress.value),
  }));

  return (
    <PressableScale
      onPress={onToggle}
      haptic={checked ? 'light' : 'success'}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={12}
      scaleTo={0.88}
    >
      <Animated.View style={[styles.box, { width: size, height: size, borderRadius: size * 0.32 }, boxStyle]}>
        <Svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24">
          <AnimatedPath
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke={palette.onAccent}
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={CHECK_LENGTH}
            animatedProps={tickProps}
          />
        </Svg>
      </Animated.View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  box: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
