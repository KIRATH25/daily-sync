import { memo, type ReactNode } from 'react';
import { KeyboardAvoidingView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
// Gesture Handler's ScrollView coordinates with nested pans (theme dial, card tilt).
import { RefreshControl, ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, X } from '@/components/ui/icons';

import { useI18n } from '@/i18n';
import { usePalette } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

import { IconButton } from './IconButton';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export const TAB_BAR_SPACE = 104;

export interface ScreenProps {
  children: ReactNode;
  header?: ReactNode;
  /** Pinned bottom area (primary action), kept above keyboard and nav bar. */
  footer?: ReactNode;
  scroll?: boolean;
  /** Extra bottom padding for screens under the tab bar. */
  withTabBar?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** Standard page shell: safe areas, background, scrolling and keyboard handling. */
export function Screen({ children, header, footer, scroll = true, withTabBar, contentStyle, refreshing, onRefresh }: ScreenProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const bottomPad = (withTabBar ? TAB_BAR_SPACE : footer ? space.lg : space.xxxl) + (withTabBar ? insets.bottom : 0);

  return (
    // Edge-to-edge Android (mandatory since SDK 54) no longer resizes the
    // window for the keyboard, so padding is applied on both platforms.
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: palette.background }]} behavior="padding">
      <View style={{ paddingTop: insets.top }}>{header}</View>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={palette.accent} colors={[palette.accent]} progressBackgroundColor={palette.surface} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, space.md) + space.xs, backgroundColor: palette.background, borderTopColor: palette.border },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  /** 'back' (arrow), 'close' (X) or none */
  leading?: 'back' | 'close' | 'none';
  onLeadingPress?: () => void;
  actions?: ReactNode;
  large?: boolean;
}

export const ScreenHeader = memo(function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  leading = 'back',
  onLeadingPress,
  actions,
  large,
}: ScreenHeaderProps) {
  const { t } = useI18n();
  const goBack = onLeadingPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {leading !== 'none' ? (
          <IconButton
            icon={leading === 'close' ? X : ArrowLeft}
            label={leading === 'close' ? t('common.close') : t('common.back')}
            onPress={goBack}
            variant="surface"
            size={42}
          />
        ) : null}
        <View style={styles.headerTitle}>
          {!large && title ? (
            <Text variant="h3" numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
        </View>
        <View style={styles.actions}>{actions}</View>
      </View>
      {large && (title || eyebrow) ? (
        <View style={styles.large}>
          {eyebrow ? (
            <View style={styles.eyebrowRow}>
              <EyebrowDot />
              <Text variant="label" tone="accent">
                {eyebrow}
              </Text>
            </View>
          ) : null}
          {title ? (
            <Text variant="h1" accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text variant="body" tone="secondary">
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

function EyebrowDot() {
  const palette = usePalette();
  return <View style={[styles.dot, { backgroundColor: palette.accent }]} />;
}

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const SectionHeader = memo(function SectionHeader({ title, actionLabel, onAction, right, style }: SectionHeaderProps) {
  return (
    <View style={[styles.section, style]}>
      <Text variant="label" tone="secondary" accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {right}
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} hitSlop={12} accessibilityLabel={actionLabel}>
          <Text variant="smallStrong" tone="accent">
            {actionLabel}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
});

export function Pill({ label, tone = 'accent', icon: Icon }: { label: string; tone?: 'accent' | 'muted' | 'danger' | 'tertiary' | 'solid'; icon?: import('@/components/ui/icons').LucideIcon }) {
  const palette = usePalette();
  const map = {
    accent: { bg: palette.accentMuted, fg: palette.accentText },
    solid: { bg: palette.accent, fg: palette.onAccent },
    muted: { bg: palette.elevated, fg: palette.textSecondary },
    danger: { bg: palette.dangerSoft, fg: palette.dangerText },
    tertiary: { bg: 'rgba(116,230,255,0.14)', fg: palette.tertiary },
  } as const;
  const { bg, fg } = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {Icon ? <Icon size={12} color={fg} strokeWidth={2.4} /> : null}
      <Text variant="micro" color={fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: space.gutter, gap: space.lg, paddingTop: space.sm },
  footer: {
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  header: { paddingHorizontal: space.gutter, paddingTop: space.sm, paddingBottom: space.sm, gap: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  headerTitle: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  large: { gap: space.xs },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 28 },
  sectionTitle: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
});
