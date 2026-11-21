import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string | number> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
  size?: 'sm' | 'md';
}

/** Segmented control with a sliding selection pill. */
export function Segmented<T extends string | number>({ options, value, onChange, style, accent, size = 'md' }: SegmentedProps<T>) {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segment = options.length ? (width - 8) / options.length : 0;

  const pillStyle = useAnimatedStyle(() => ({
    width: segment,
    transform: [
      {
        translateX: reduceMotion
          ? withTiming(index * segment, { duration: 0 })
          : withSpring(index * segment, { damping: 18, stiffness: 220 }),
      },
    ],
  }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const height = size === 'sm' ? 38 : 46;

  return (
    <View
      onLayout={onLayout}
      accessibilityRole="tablist"
      style={[styles.track, { backgroundColor: palette.surfaceAlt, height }, style]}
    >
      {width > 0 ? (
        <Animated.View
          style={[
            styles.pill,
            { backgroundColor: accent ? palette.accent : palette.elevated, height: height - 8 },
            pillStyle,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            haptic={selected ? null : 'selection'}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            scaleTo={0.97}
            style={styles.option}
          >
            <Text
              variant={size === 'sm' ? 'smallStrong' : 'bodyStrong'}
              color={selected ? (accent ? palette.onAccent : palette.text) : palette.textSecondary}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 4,
  },
  pill: {
    position: 'absolute',
    top: 4,
    left: 4,
    borderRadius: radius.sm,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
