import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from '@/components/ui/icons';

import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface DSChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  count?: number;
  /** Colour dot before the label */
  dot?: string;
  size?: 'sm' | 'md';
  tone?: 'default' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export const DSChip = memo(function DSChip({
  label,
  selected,
  onPress,
  icon: Icon,
  count,
  dot,
  size = 'md',
  tone = 'default',
  style,
}: DSChipProps) {
  const palette = usePalette();
  const danger = tone === 'danger';
  const bg = selected ? (danger ? palette.danger : palette.accent) : palette.surfaceAlt;
  const fg = selected ? (danger ? '#FFFFFF' : palette.onAccent) : danger ? palette.dangerText : palette.text;
  const content = (
    <>
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      {Icon ? <Icon size={size === 'sm' ? 14 : 16} color={fg} strokeWidth={2.1} /> : null}
      <Text variant={size === 'sm' ? 'micro' : 'smallStrong'} color={fg} numberOfLines={1}>
        {label}
      </Text>
      {count != null ? (
        <View style={[styles.count, { backgroundColor: selected ? 'rgba(0,0,0,0.14)' : palette.elevated }]}>
          <Text variant="micro" color={fg} latin>
            {count}
          </Text>
        </View>
      ) : null}
    </>
  );
  const chipStyle = [
    styles.chip,
    { backgroundColor: bg, height: size === 'sm' ? 32 : 38, paddingHorizontal: size === 'sm' ? space.md - 2 : space.md + 2 },
    style,
  ];
  if (!onPress) return <View style={chipStyle}>{content}</View>;
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
      hitSlop={6}
      style={chipStyle}
    >
      {content}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    borderRadius: radius.pill,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
});
