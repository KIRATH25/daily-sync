import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { withAlpha } from '@/lib/color';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { PressableScale } from './PressableScale';

export interface DSCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Warm accent glow in the top-left, as on hero cards in the references. */
  glow?: boolean;
  tone?: 'surface' | 'alt' | 'elevated' | 'accent';
  padding?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  /** Coloured left rule for "active/now" items. */
  accentEdge?: string;
}

export const DSCard = memo(function DSCard({
  children,
  style,
  glow,
  tone = 'surface',
  padding = space.lg,
  onPress,
  onLongPress,
  accessibilityLabel,
  accentEdge,
}: DSCardProps) {
  const { palette, cardStyle } = useTheme();
  const bg =
    tone === 'alt'
      ? palette.surfaceAlt
      : tone === 'elevated'
        ? palette.elevated
        : tone === 'accent'
          ? palette.accentMuted
          : palette.surface;

  const content = (
    <>
      {glow ? (
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(palette.accent, palette.scheme === 'dark' ? 0.13 : 0.12), withAlpha(palette.accent, 0)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {accentEdge ? <View style={[styles.edge, { backgroundColor: accentEdge }]} /> : null}
      {children}
    </>
  );

  const cardStyles: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: bg,
      padding,
      borderColor: cardStyle === 'border' ? palette.border : 'transparent',
      borderWidth: cardStyle === 'border' ? StyleSheet.hairlineWidth * 2 : 0,
    },
    cardStyle === 'soft' && [styles.soft, { shadowColor: palette.shadow }],
    accentEdge ? { paddingLeft: padding + 4 } : null,
    style,
  ];

  if (onPress || onLongPress) {
    return (
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={accessibilityLabel}
        scaleTo={0.98}
        style={cardStyles}
      >
        {content}
      </PressableScale>
    );
  }
  return (
    <View style={cardStyles} accessibilityLabel={accessibilityLabel}>
      {content}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  soft: {
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  edge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
});
