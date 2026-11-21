import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Quote as QuoteIcon } from '@/components/ui/icons';

import { ProgressBar } from '@/components/ui/Progress';
import { Text } from '@/components/ui/Text';
import { recentQuoteIds, recordQuoteShown, wasQuoteShown } from '@/db/repositories/quotesRepo';
import { useI18n } from '@/i18n';
import { todayKey } from '@/lib/timezone';
import { quoteForDate, quoteText, type Quote } from '@/services/quotes';
import { usePreferences } from '@/store/preferences';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const DISPLAY_MS = 5500;

/**
 * Shows one motivational quote on the first open of each local day. The
 * shown date is persisted (with a unique key, so it can never show twice),
 * it auto-dismisses after ~5.5 s and any tap dismisses it immediately.
 */
export function DailyQuoteOverlay() {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { preferences } = usePreferences();
  const { t, formatDate } = useI18n();
  const insets = useSafeAreaInsets();
  const [quote, setQuote] = useState<{ quote: Quote; date: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (!preferences.dailyQuoteEnabled || checking.current) return;
    checking.current = true;
    try {
      const date = todayKey(preferences.timeZone);
      if (await wasQuoteShown(date)) return;
      const chosen = quoteForDate(date, await recentQuoteIds(30));
      if (await recordQuoteShown(date, chosen.id)) {
        setElapsed(0);
        setQuote({ quote: chosen, date });
      }
    } catch (error) {
      console.warn('Daily quote unavailable', error);
    } finally {
      checking.current = false;
    }
  }, [preferences.dailyQuoteEnabled, preferences.timeZone]);

  useEffect(() => {
    // Let the first screen paint before checking, keeping startup snappy.
    const initial = setTimeout(() => void check(), 400);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      clearTimeout(initial);
      subscription.remove();
    };
  }, [check]);

  useEffect(() => {
    if (!quote) return;
    const started = Date.now();
    const timer = setInterval(() => {
      const passed = Date.now() - started;
      setElapsed(passed);
      if (passed >= DISPLAY_MS) setQuote(null);
    }, 250);
    return () => clearInterval(timer);
  }, [quote]);

  if (!quote) return null;

  return (
    <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(260)} style={[StyleSheet.absoluteFill, styles.root]}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: palette.overlay }]}
        onPress={() => setQuote(null)}
        accessibilityRole="button"
        accessibilityLabel={t('quote.dismiss')}
      />
      <Animated.View
        entering={reduceMotion ? FadeIn : FadeInDown.springify().damping(16).delay(80)}
        style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border, marginTop: insets.top }]}
        pointerEvents="box-none"
      >
        <Pressable onPress={() => setQuote(null)} accessibilityRole="button" accessibilityLabel={t('quote.dismiss')} style={styles.inner}>
          <View style={[styles.icon, { backgroundColor: palette.accentMuted }]}>
            <QuoteIcon size={20} color={palette.accentText} strokeWidth={2.2} />
          </View>
          <Text variant="label" tone="accent">
            {t('quote.eyebrow', { date: formatDate(quote.date, 'dayMonth') })}
          </Text>
          <Text variant="h2" style={styles.quote} accessibilityLiveRegion="polite">
            {quoteText(quote.quote, preferences.language)}
          </Text>
          <Text variant="small" tone="muted">
            {t('quote.attribution')}
          </Text>
          <ProgressBar progress={Math.min(1, elapsed / DISPLAY_MS)} height={3} style={styles.progress} />
          <Text variant="small" tone="muted" align="center">
            {t('quote.tapToContinue')}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { justifyContent: 'center', paddingHorizontal: space.xl, zIndex: 50 },
  card: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  inner: { padding: space.xxl, gap: space.md },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quote: { fontStyle: 'italic' },
  progress: { marginTop: space.sm },
});
