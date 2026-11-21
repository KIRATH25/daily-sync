import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { BellOff, Clock, SkipForward } from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { DSBottomSheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { readPreference, savePreference } from '@/db/repositories/preferencesRepo';
import { getReview } from '@/db/repositories/reviewsRepo';
import { useI18n } from '@/i18n';
import { MOODS } from '@/lib/mood';
import { instantToWallClock } from '@/lib/timezone';
import { moodPromptState, setForegroundMoodListener, skipMoodToday, snoozeMood } from '@/services/notifications';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const PROMPTED_KEY = 'mood.promptedDate';

/**
 * In-app evening check-in. Appears when the reminder fires while the app is
 * open, or when the app is opened after the reminder time with today's mood
 * still unlogged. Offers quick selection, Snooze (30 min), Skip today and
 * Disable. Never shown again for a day that is logged, skipped or already
 * prompted.
 */
export function MoodPrompt() {
  const palette = usePalette();
  const { t } = useI18n();
  const { preferences, setPreference } = usePreferences();
  const [visible, setVisible] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const busy = useRef(false);

  const evaluate = useCallback(
    async (force: boolean) => {
      if (!preferences.moodReminderEnabled || busy.current) return;
      busy.current = true;
      try {
        const now = Date.now();
        const clock = instantToWallClock(now, preferences.timeZone);
        if (!force && clock.minute < preferences.moodReminderMinute) return;
        if (await getReview(clock.dateKey)) return;
        const { skippedDate, snoozeUntil } = await moodPromptState(preferences.timeZone);
        if (skippedDate === clock.dateKey) return;
        if (!force && snoozeUntil && snoozeUntil > now) return;
        if (!force && (await readPreference<string>(PROMPTED_KEY)) === clock.dateKey) return;
        await savePreference(PROMPTED_KEY, clock.dateKey);
        setDate(clock.dateKey);
        setVisible(true);
      } finally {
        busy.current = false;
      }
    },
    [preferences.moodReminderEnabled, preferences.moodReminderMinute, preferences.timeZone],
  );

  useEffect(() => {
    void evaluate(false);
    setForegroundMoodListener(() => void evaluate(true));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void evaluate(false);
    });
    return () => {
      setForegroundMoodListener(null);
      subscription.remove();
    };
  }, [evaluate]);

  const close = () => setVisible(false);

  return (
    <DSBottomSheet visible={visible} onClose={close} title={t('moodPrompt.title')} subtitle={t('moodPrompt.subtitle')}>
      <View style={styles.moods}>
        {MOODS.map((mood) => (
          <PressableScale
            key={mood.level}
            onPress={() => {
              close();
              router.push({ pathname: '/mood', params: { date: date ?? '', mood: String(mood.level) } });
            }}
            haptic="selection"
            accessibilityLabel={t(mood.label)}
            style={[styles.mood, { backgroundColor: palette.surfaceAlt }]}
          >
            <Text style={styles.emoji}>{mood.emoji}</Text>
            <Text variant="micro" tone="secondary" numberOfLines={1}>
              {t(mood.label)}
            </Text>
          </PressableScale>
        ))}
      </View>
      <View style={styles.actions}>
        <PremiumButton
          label={t('mood.snooze30')}
          icon={Clock}
          variant="secondary"
          size="md"
          style={styles.flex}
          onPress={() => {
            close();
            void snoozeMood(30);
          }}
        />
        <PremiumButton
          label={t('mood.skipToday')}
          icon={SkipForward}
          variant="secondary"
          size="md"
          style={styles.flex}
          onPress={() => {
            close();
            void skipMoodToday(preferences.timeZone);
          }}
        />
      </View>
      <PremiumButton
        label={t('mood.disableReminder')}
        icon={BellOff}
        variant="ghost"
        size="sm"
        onPress={() => {
          close();
          void setPreference('moodReminderEnabled', false);
        }}
      />
    </DSBottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  moods: { flexDirection: 'row', gap: space.sm },
  mood: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.md, gap: 6 },
  emoji: { fontSize: 30, lineHeight: 38 },
  actions: { flexDirection: 'row', gap: space.sm },
});
