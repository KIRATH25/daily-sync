import type { ComponentRef, ReactNode, Ref } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useHaptics, type HapticKind } from '@/hooks/useHaptics';
import { useTheme } from '@/theme/ThemeProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far to shrink on press (0.96 default). */
  scaleTo?: number;
  haptic?: HapticKind | null;
  ref?: Ref<ComponentRef<typeof Pressable>>;
}

/**
 * The single touch primitive used across the app: a quick, subtle scale-down
 * on press with a springy release. Falls back to an opacity dip when the
 * user prefers reduced motion. Runs entirely on the UI thread.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.965,
  haptic = null,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ref,
  ...rest
}: PressableScaleProps) {
  const { reduceMotion } = useTheme();
  const { fire } = useHaptics();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 1 - pressed.value * 0.25 };
    return { transform: [{ scale: 1 - (1 - scaleTo) * pressed.value }] };
  });

  return (
    <AnimatedPressable
      ref={ref}
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: 90 });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withSpring(0, { damping: 14, stiffness: 260, mass: 0.6 });
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) fire(haptic);
        onPress?.(event);
      }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
