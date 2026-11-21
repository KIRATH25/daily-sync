import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Home, Plus, Sparkles, UserRound, type LucideIcon } from '@/components/ui/icons';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useI18n, type TKey } from '@/i18n';
import { usePalette } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const TABS: Record<string, { icon: LucideIcon; label: TKey }> = {
  index: { icon: Home, label: 'tabs.home' },
  calendar: { icon: CalendarDays, label: 'tabs.calendar' },
  insights: { icon: Sparkles, label: 'tabs.insights' },
  profile: { icon: UserRound, label: 'tabs.profile' },
};

/**
 * Bottom navigation matching the references: four destinations with a
 * raised accent "+" in the centre that opens Quick Create (a sheet, not a
 * dead tab).
 */
export function DSTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const routes = state.routes.filter((route) => TABS[route.name]);
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  const renderTab = (route: (typeof routes)[number]) => {
    const config = TABS[route.name];
    if (!config) return null;
    const focused = state.routes[state.index]?.key === route.key;
    return (
      <TabButton
        key={route.key}
        icon={config.icon}
        label={t(config.label)}
        focused={focused}
        onPress={() => {
          if (!focused) navigateToTab(route.key);
        }}
      />
    );
  };

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: palette.surface, borderTopColor: palette.border },
      ]}
    >
      {left.map(renderTab)}
      <View style={styles.centerSlot}>
        <PressableScale
          onPress={() => router.push('/quick-add')}
          haptic="medium"
          accessibilityLabel={t('tabs.quickAdd')}
          accessibilityHint={t('tabs.quickAddHint')}
          scaleTo={0.9}
          style={[styles.fab, { backgroundColor: palette.accent, shadowColor: palette.accent, borderColor: palette.background }]}
        >
          <Plus size={28} color={palette.onAccent} strokeWidth={2.4} />
        </PressableScale>
      </View>
      {right.map(renderTab)}
    </View>
  );
}

const TabButton = memo(function TabButton({
  icon: Icon,
  label,
  focused,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  focused: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  const color = focused ? palette.accentText : palette.textSecondary;
  return (
    <PressableScale
      onPress={onPress}
      haptic={focused ? null : 'selection'}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      scaleTo={0.9}
      style={styles.tab}
    >
      <Icon size={23} color={color} strokeWidth={focused ? 2.3 : 1.9} />
      <Text variant="micro" color={color} numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 10,
    paddingHorizontal: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, minHeight: 50, justifyContent: 'center' },
  label: { textTransform: 'none', letterSpacing: 0.3 },
  centerSlot: { flex: 1, alignItems: 'center' },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
    borderWidth: 5,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
