/**
 * Radial theme selector.
 *
 * Behaviour:
 *   - Six theme markers sit on a circular orbit (top = index 0, clockwise).
 *   - Dragging anywhere on the dial moves the selection handle along the
 *     orbit to the finger's angle; crossing into a new marker's sector
 *     selects it (with a selection haptic). Releasing snaps the handle onto
 *     the selected marker along the shortest path.
 *   - Tapping a marker selects it directly and animates the handle there.
 *   - All angle maths runs on the UI thread (Reanimated worklets); JS is
 *     only notified when the selected index changes.
 * Angles are radians measured clockwise from 12 o'clock, normalised to [0, 2π).
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useHaptics } from '@/hooks/useHaptics';
import { withAlpha } from '@/lib/color';
import { usePalette, useTheme } from '@/theme/ThemeProvider';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const TWO_PI = Math.PI * 2;

export interface RadialOption {
  id: string;
  color: string;
  label: string;
}

export interface RadialThemeSelectorProps {
  options: readonly RadialOption[];
  index: number;
  onChange: (index: number) => void;
  size: number;
  centerTitle: string;
  centerEyebrow: string;
  centerSubtitle: string;
}

function normalize(angle: number): number {
  'worklet';
  const value = angle % TWO_PI;
  return value < 0 ? value + TWO_PI : value;
}

export const RadialThemeSelector = memo(function RadialThemeSelector({
  options,
  index,
  onChange,
  size,
  centerTitle,
  centerEyebrow,
  centerSubtitle,
}: RadialThemeSelectorProps) {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { fire } = useHaptics();
  const count = options.length;
  const step = TWO_PI / count;
  const center = size / 2;
  const radius = size / 2 - 34;
  const angle = useSharedValue(index * step);
  const activeIndex = useSharedValue(index);
  const dragging = useSharedValue(0);

  // Keep the handle in sync when the selection changes from outside (chips, presets).
  useEffect(() => {
    activeIndex.value = index;
    if (dragging.value) return;
    const target = index * step;
    const delta = ((target - angle.value + Math.PI * 3) % TWO_PI) - Math.PI;
    angle.value = reduceMotion ? target : withSpring(angle.value + delta, { damping: 16, stiffness: 140 });
  }, [index, step, reduceMotion, angle, activeIndex, dragging]);

  const select = (next: number) => {
    fire('selection');
    onChange(next);
  };

  const pan = usePanGesture({
    minDistance: 6,
    // Only an actual drag moves the handle, so a plain tap on a marker is
    // handled by the marker itself without the handle jumping around.
    onActivate: (event) => {
      'worklet';
      dragging.value = 1;
      const touch = normalize(Math.atan2(event.x - center, center - event.y));
      const delta = ((touch - normalize(angle.value) + Math.PI * 3) % TWO_PI) - Math.PI;
      angle.value = withTiming(angle.value + delta, { duration: 90 });
    },
    onUpdate: (event) => {
      'worklet';
      const touch = normalize(Math.atan2(event.x - center, center - event.y));
      // Follow the finger continuously (unwrap across the 12 o'clock seam).
      const delta = ((touch - normalize(angle.value) + Math.PI * 3) % TWO_PI) - Math.PI;
      angle.value = angle.value + delta;
      const nearest = Math.round(normalize(angle.value) / step) % count;
      if (nearest !== activeIndex.value) {
        activeIndex.value = nearest;
        runOnJS(select)(nearest);
      }
    },
    onFinalize: () => {
      'worklet';
      if (!dragging.value) return;
      dragging.value = 0;
      const target = activeIndex.value * step;
      const delta = ((target - normalize(angle.value) + Math.PI * 3) % TWO_PI) - Math.PI;
      angle.value = withSpring(angle.value + delta, { damping: 15, stiffness: 160 });
    },
  });

  const handleStyle = useAnimatedStyle(() => {
    const a = angle.value;
    return {
      transform: [
        { translateX: center + Math.sin(a) * radius - 26 },
        { translateY: center - Math.cos(a) * radius - 26 },
        { scale: withSpring(dragging.value ? 1.12 : 1, { damping: 14 }) },
      ],
    };
  });

  // Accent arc from 12 o'clock to the handle.
  const arcProps = useAnimatedProps(() => {
    const a = normalize(angle.value);
    const sweep = a < 0.001 ? 0.001 : a;
    const x = center + Math.sin(sweep) * radius;
    const y = center - Math.cos(sweep) * radius;
    const large = sweep > Math.PI ? 1 : 0;
    return { d: `M ${center} ${center - radius} A ${radius} ${radius} 0 ${large} 1 ${x} ${y}` };
  });

  const selected = options[index];

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: size, height: size }} accessibilityRole="adjustable" accessibilityLabel={selected?.label}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={center} cy={center} r={radius + 22} stroke={withAlpha(palette.text, 0.05)} strokeWidth={1} fill="none" />
          <Circle cx={center} cy={center} r={radius} stroke={palette.border} strokeWidth={1.5} strokeDasharray="2 6" fill="none" />
          <AnimatedPath animatedProps={arcProps} stroke={selected?.color ?? palette.accent} strokeWidth={3} strokeLinecap="round" fill="none" />
          {[0, 90, 180, 270].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <Path
                key={deg}
                d={`M ${center + Math.sin(rad) * (radius + 26)} ${center - Math.cos(rad) * (radius + 26)} L ${center + Math.sin(rad) * (radius + 32)} ${center - Math.cos(rad) * (radius + 32)}`}
                stroke={palette.textMuted}
                strokeWidth={1.5}
              />
            );
          })}
        </Svg>

        {/* centre disc */}
        <View
          style={[
            styles.center,
            { width: radius * 1.25, height: radius * 1.25, borderRadius: radius, left: center - radius * 0.625, top: center - radius * 0.625, backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          pointerEvents="none"
        >
          <Text variant="micro" tone="accent">
            {centerEyebrow}
          </Text>
          <Text variant="h2" align="center" numberOfLines={2}>
            {centerTitle}
          </Text>
          <View style={styles.subRow}>
            <View style={[styles.subDot, { backgroundColor: selected?.color ?? palette.accent }]} />
            <Text variant="small" tone="secondary" numberOfLines={1}>
              {centerSubtitle}
            </Text>
          </View>
        </View>

        {/* selection handle (halo) */}
        <Animated.View pointerEvents="none" style={[styles.handle, { borderColor: selected?.color ?? palette.accent, backgroundColor: withAlpha(selected?.color ?? palette.accent, 0.18) }, handleStyle]} />

        {/* markers */}
        {options.map((option, markerIndex) => {
          const a = markerIndex * step;
          const x = center + Math.sin(a) * radius;
          const y = center - Math.cos(a) * radius;
          const active = markerIndex === index;
          return (
            <PressableScale
              key={option.id}
              onPress={() => {
                if (!active) select(markerIndex);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              hitSlop={8}
              scaleTo={0.85}
              style={[styles.marker, { left: x - 19, top: y - 19, backgroundColor: palette.elevated, borderColor: active ? option.color : palette.borderStrong }]}
            >
              <View style={[styles.markerDot, { backgroundColor: option.color, borderColor: withAlpha('#000000', 0.25) }]} />
            </PressableScale>
          );
        })}
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, gap: 4, padding: 10 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subDot: { width: 6, height: 6, borderRadius: 3 },
  handle: { position: 'absolute', left: 0, top: 0, width: 52, height: 52, borderRadius: 26, borderWidth: 2 },
  marker: { position: 'absolute', width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  markerDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1 },
});
