import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { evaluateAndStoreAchievements, watchForAchievementChanges } from '@/services/achievements';
import {
  ACTION_SNOOZE,
  configureNotifications,
  snoozeMood,
  syncNotifications,
  useNotificationResponse,
  watchForReminderChanges,
} from '@/services/notifications';
import { usePreferences } from '@/store/preferences';
import { usePalette, useTheme } from '@/theme/ThemeProvider';

import { AchievementReveal } from './AchievementReveal';
import { AppLockGate } from './AppLockGate';
import { DailyQuoteOverlay } from './DailyQuoteOverlay';
import { MoodPrompt } from './MoodPrompt';

/** Only internal, absolute app routes may be opened from notification data. */
function safeRoute(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('://')) return null;
  return value.length < 200 ? value : null;
}

export function AppShell() {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { preferences } = usePreferences();
  const onboarded = preferences.onboardingComplete;
  const response = useNotificationResponse();
  const handledResponse = useRef<string | null>(null);

  // Background services: reminders + achievements, refreshed on foreground.
  useEffect(() => {
    if (!onboarded) return;
    let active = true;
    configureNotifications(preferences.language)
      .catch((error: unknown) => console.warn('Notification setup failed', error))
      .finally(() => {
        if (active) void syncNotifications();
      });
    evaluateAndStoreAchievements().catch((error: unknown) => console.error('Achievements failed', error));
    const stopReminders = watchForReminderChanges();
    const stopAchievements = watchForAchievementChanges();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncNotifications();
        evaluateAndStoreAchievements().catch(() => undefined);
      }
    });
    return () => {
      active = false;
      stopReminders();
      stopAchievements();
      subscription.remove();
    };
  }, [onboarded, preferences.language]);

  // Notification taps and actions.
  useEffect(() => {
    if (!response || !onboarded) return;
    const id = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handledResponse.current === id) return;
    handledResponse.current = id;
    if (response.actionIdentifier === ACTION_SNOOZE) {
      void snoozeMood(30);
      return;
    }
    const route = safeRoute(response.notification.request.content.data?.route);
    if (route) {
      // Defer one frame so the navigator is mounted on cold start.
      requestAnimationFrame(() => router.push(route as never));
    }
  }, [response, onboarded]);

  const slide = reduceMotion ? 'fade' : 'slide_from_right';

  return (
    <>
      <StatusBar style={palette.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
          animation: slide,
          animationDuration: 280,
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen
          name="quick-add"
          options={{
            presentation: 'transparentModal',
            animation: reduceMotion ? 'fade' : 'fade_from_bottom',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="create" options={{ animation: reduceMotion ? 'fade' : 'slide_from_bottom' }} />
        <Stack.Screen name="mood/index" options={{ animation: reduceMotion ? 'fade' : 'slide_from_bottom' }} />
        <Stack.Screen name="share/[id]" options={{ animation: reduceMotion ? 'fade' : 'slide_from_bottom' }} />
        <Stack.Screen name="collection/[id]" options={{ animation: 'fade' }} />
      </Stack>
      {onboarded ? (
        <>
          <DailyQuoteOverlay />
          <MoodPrompt />
          <AchievementReveal />
          <AppLockGate />
        </>
      ) : null}
    </>
  );
}
