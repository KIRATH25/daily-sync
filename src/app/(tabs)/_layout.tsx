import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { DSTabBar } from '@/components/shell/TabBar';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const palette = usePalette();
  const { preferences } = usePreferences();
  if (!preferences.onboardingComplete) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      tabBar={(props) => <DSTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: palette.background }, animation: 'fade' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
