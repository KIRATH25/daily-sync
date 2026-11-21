import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from '@/components/ui/icons';

import type { HapticKind } from '@/hooks/useHaptics';
import { usePalette } from '@/theme/ThemeProvider';

import { PressableScale } from './PressableScale';

export interface IconButtonProps {
  icon: LucideIcon;
  /** Required: icon-only buttons must be announced by screen readers. */
  label: string;
  onPress: () => void;
  variant?: 'surface' | 'plain' | 'accent' | 'soft';
  size?: number;
  badge?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: HapticKind | null;
}

export const IconButton = memo(function IconButton({
  icon: Icon,
  label,
  onPress,
  variant = 'surface',
  size = 44,
  badge,
  disabled,
  style,
  haptic = null,
}: IconButtonProps) {
  const palette = usePalette();
  const bg =
    variant === 'surface'
      ? palette.surfaceAlt
      : variant === 'accent'
        ? palette.accent
        : variant === 'soft'
          ? palette.accentMuted
          : 'transparent';
  const fg = variant === 'accent' ? palette.onAccent : variant === 'soft' ? palette.accentText : palette.text;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      accessibilityLabel={label}
      hitSlop={size < 44 ? (44 - size) / 2 : 0}
      scaleTo={0.9}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      <Icon size={Math.round(size * 0.45)} color={fg} strokeWidth={2} />
      {badge ? <View style={[styles.badge, { backgroundColor: palette.accent, borderColor: palette.background }]} /> : null}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});
