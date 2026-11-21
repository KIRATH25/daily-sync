import { useEffect, useState } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Per-weight imports so only the weights we use are bundled into the app.
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk/400Regular';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { NotoSansDevanagari_400Regular } from '@expo-google-fonts/noto-sans-devanagari/400Regular';
import { NotoSansDevanagari_500Medium } from '@expo-google-fonts/noto-sans-devanagari/500Medium';
import { NotoSansDevanagari_600SemiBold } from '@expo-google-fonts/noto-sans-devanagari/600SemiBold';
import { NotoSansDevanagari_700Bold } from '@expo-google-fonts/noto-sans-devanagari/700Bold';

import { AppShell } from '@/components/shell/AppShell';
import { FeedbackProvider } from '@/components/ui/Feedback';
import { I18nProvider } from '@/i18n';
import { bootstrapApp } from '@/services/bootstrap';
import { PreferencesProvider, type Preferences } from '@/store/preferences';
import { ThemeProvider } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export { ErrorBoundary } from '@/components/shell/ErrorBoundary';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_600SemiBold,
    NotoSansDevanagari_700Bold,
  });
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    bootstrapApp()
      .then(setPreferences)
      .catch((error: unknown) => {
        console.error('Startup failed', error);
        setBootError(error instanceof Error ? error.message : String(error));
      });
  }, []);

  const ready = (fontsLoaded || !!fontError) && (preferences !== null || bootError !== null);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  if (bootError || !preferences) {
    // Rendered without theme/i18n providers because they depend on the DB.
    return (
      <View style={styles.bootError}>
        <RNText style={styles.bootTitle}>Daily Sync could not start</RNText>
        <RNText style={styles.bootBody}>
          Your data has not been changed. Please close and reopen the app. If this keeps happening, update Daily Sync.
        </RNText>
        <RNText style={styles.bootDetail}>{bootError}</RNText>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <PreferencesProvider initial={preferences}>
          <ThemeProvider>
            <I18nProvider>
              <FeedbackProvider>
                <AppShell />
              </FeedbackProvider>
            </I18nProvider>
          </ThemeProvider>
        </PreferencesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bootError: { flex: 1, backgroundColor: '#0C0D0F', padding: 28, justifyContent: 'center', gap: 12 },
  bootTitle: { color: '#F5F3EE', fontSize: 22, fontWeight: '700' },
  bootBody: { color: '#A5A7A8', fontSize: 15, lineHeight: 22 },
  bootDetail: { color: '#73777A', fontSize: 12 },
});
