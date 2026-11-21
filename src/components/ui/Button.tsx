import { memo } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from '@/components/ui/icons';

import type { HapticKind } from '@/hooks/useHaptics';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'soft';
export type ButtonSize = 'lg' | 'md' | 'sm';

export interface PremiumButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: HapticKind | null;
  accessibilityHint?: string;
  fullWidth?: boolean;
}

const HEIGHT: Record<ButtonSize, number> = { lg: 56, md: 48, sm: 38 };

export const PremiumButton = memo(function PremiumButton({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  iconRight: IconRight,
  loading,
  disabled,
  style,
  haptic = 'light',
  accessibilityHint,
  fullWidth = true,
}: PremiumButtonProps) {
  const palette = usePalette();

  const colors: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: palette.accent, fg: palette.onAccent },
    secondary: { bg: palette.surfaceAlt, fg: palette.text },
    outline: { bg: 'transparent', fg: palette.text, border: palette.borderStrong },
    ghost: { bg: 'transparent', fg: palette.textSecondary },
    danger: { bg: palette.dangerSoft, fg: palette.dangerText },
    soft: { bg: palette.accentMuted, fg: palette.accentText },
  };
  const { bg, fg, border } = colors[variant];
  const iconSize = size === 'sm' ? 16 : 19;
  const isDisabled = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      haptic={haptic}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={[
        styles.base,
        {
          height: HEIGHT[size],
          backgroundColor: bg,
          borderColor: border ?? 'transparent',
          borderWidth: border ? 1 : 0,
          paddingHorizontal: size === 'sm' ? space.md : space.xl,
          borderRadius: size === 'lg' ? radius.md + 2 : radius.sm,
          opacity: isDisabled && !loading ? 0.45 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        variant === 'primary' && styles.primaryGlow,
        variant === 'primary' && { shadowColor: palette.accent },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {Icon ? <Icon size={iconSize} color={fg} strokeWidth={2.2} /> : null}
          <Text variant={size === 'sm' ? 'smallStrong' : 'title'} color={fg} numberOfLines={1}>
            {label}
          </Text>
          {IconRight ? <IconRight size={iconSize} color={fg} strokeWidth={2.2} /> : null}
        </View>
      )}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  primaryGlow: {
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
