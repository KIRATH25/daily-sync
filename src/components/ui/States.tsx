import { memo, useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';
import type { LucideIcon } from '@/components/ui/icons';

import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { PremiumButton } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const EmptyState = memo(function EmptyState({ icon: Icon, title, message, actionLabel, onAction, compact, style }: EmptyStateProps) {
  const palette = usePalette();
  return (
    <Animated.View entering={FadeIn.duration(260)} style={[styles.empty, compact && styles.emptyCompact, style]}>
      <View style={[styles.emptyIcon, { backgroundColor: palette.accentMuted, borderColor: palette.border }]}>
        <Icon size={compact ? 20 : 26} color={palette.accentText} strokeWidth={1.8} />
      </View>
      <Text variant={compact ? 'title' : 'h3'} align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="small" tone="secondary" align="center" style={styles.emptyMessage}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <PremiumButton label={actionLabel} onPress={onAction} size="sm" variant="soft" fullWidth={false} style={styles.emptyAction} />
      ) : null}
    </Animated.View>
  );
});

/** Shimmering placeholder block. Stops animating when unmounted. */
export const Skeleton = memo(function Skeleton({ height = 18, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    if (!reduceMotion) pulse.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[{ height, width, borderRadius: radius.xs, backgroundColor: palette.elevated }, animated, style]} />;
});

export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.loading} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.loadingRow}>
          <Skeleton height={14} width="40%" />
          <Skeleton height={52} />
        </View>
      ))}
    </View>
  );
}

export function ErrorState({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  const palette = usePalette();
  return (
    <View style={[styles.error, { backgroundColor: palette.dangerSoft }]} accessibilityLiveRegion="polite">
      <Text variant="smallStrong" tone="danger">
        {message}
      </Text>
      {onRetry && retryLabel ? <PremiumButton label={retryLabel} onPress={onRetry} size="sm" variant="secondary" fullWidth={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl, gap: space.sm },
  emptyCompact: { paddingVertical: space.xl },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyMessage: { maxWidth: 300 },
  emptyAction: { marginTop: space.sm },
  loading: { gap: space.lg, paddingVertical: space.md },
  loadingRow: { gap: space.sm },
  error: { padding: space.lg, borderRadius: radius.md, gap: space.md },
});
