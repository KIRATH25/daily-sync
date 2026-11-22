import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowRight, BellRing, CalendarCheck, Flame, Smile, Timer } from '@/components/ui/icons';

import { InsightPreview, PlanPreview } from '@/components/onboarding/Previews';
import { OrbitalClock } from '@/components/onboarding/OrbitalClock';
import { PremiumButton } from '@/components/ui/Button';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { DSInput } from '@/components/ui/Input';
import { PressableScale } from '@/components/ui/PressableScale';
import { Pill } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { useClock } from '@/hooks/useClock';
import { useI18n } from '@/i18n';
import { LIMITS, sanitizeText } from '@/lib/validation';
import { pickAndRestoreBackup } from '@/services/backup';
import { NOTIFICATIONS_SUPPORTED, requestPermission } from '@/services/notifications';
import { loadPreferences, usePreferences, type Language } from '@/store/preferences';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { RestoreFailure } from '@/db/repositories/backupRepo';

const STEPS = 4;

export default function OnboardingScreen() {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { t, formatTime } = useI18n();
  const { preferences, setPreferences, replaceAll } = usePreferences();
  const { toast } = useFeedback();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const clock = useClock();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(preferences.userName);
  const [notifState, setNotifState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [busy, setBusy] = useState(false);

  const setLanguage = (language: Language) => void setPreferences({ language });

  const finish = async () => {
    setBusy(true);
    try {
      await setPreferences({ userName: sanitizeText(name).slice(0, LIMITS.name), onboardingComplete: true, notificationsAsked: true });
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Onboarding save failed', error);
      toast(t('error.saveFailed'), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    try {
      const result = await pickAndRestoreBackup();
      if (result.status === 'cancelled') return;
      const restored = await loadPreferences();
      replaceAll({ ...restored, onboardingComplete: true });
      await setPreferences({ onboardingComplete: true });
      toast(t('backup.restored', { count: result.summary.rows }));
      router.replace('/(tabs)');
    } catch (error) {
      toast(t(error instanceof RestoreFailure ? error.code : 'restore.corrupt'), { tone: 'error' });
    }
  };

  const askNotifications = async () => {
    const state = await requestPermission();
    setNotifState(state === 'granted' ? 'granted' : 'denied');
  };

  const enter = reduceMotion ? FadeIn : FadeInRight.springify().damping(18);
  const clockSize = Math.min(width - 80, 300);

  return (
    <View style={[styles.root, { backgroundColor: palette.background, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.top}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: palette.surfaceAlt }]}>
            <CalendarCheck size={22} color={palette.accent} strokeWidth={2} />
          </View>
          <View>
            <Text variant="label" tone="accent" latin>
              DAILY SYNC
            </Text>
            <Text variant="small" tone="secondary">
              {step === 0 ? t('onboarding.tagline') : t('onboarding.step', { step, total: STEPS - 1 })}
            </Text>
          </View>
        </View>
        {step === 0 ? (
          <View style={[styles.lang, { backgroundColor: palette.surfaceAlt }]}>
            {(['en', 'hi'] as const).map((language) => (
              <PressableScale
                key={language}
                onPress={() => setLanguage(language)}
                haptic="selection"
                accessibilityRole="button"
                accessibilityState={{ selected: preferences.language === language }}
                accessibilityLabel={language === 'en' ? 'English' : 'हिन्दी'}
                style={[styles.langOption, preferences.language === language && { backgroundColor: palette.accent }]}
              >
                <Text variant="smallStrong" latin={language === 'en'} color={preferences.language === language ? palette.onAccent : palette.text}>
                  {language === 'en' ? 'EN' : 'हि'}
                </Text>
              </PressableScale>
            ))}
          </View>
        ) : step < STEPS - 1 ? (
          <PressableScale onPress={() => setStep(STEPS - 1)} accessibilityLabel={t('common.skip')} style={[styles.skip, { backgroundColor: palette.surfaceAlt }]}>
            <Text variant="smallStrong">{t('common.skip')}</Text>
          </PressableScale>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View key={step} entering={enter} exiting={FadeOut.duration(120)} style={styles.stepBody}>
          {step === 0 ? (
            <>
              <View style={styles.center}>
                <OrbitalClock size={clockSize} hour={Math.floor(clock.minute / 60)} minute={clock.minute % 60} />
                <Pill label={t('onboarding.nowLabel', { time: formatTime(clock.minute) })} tone="muted" />
              </View>
              <View style={styles.headline}>
                <Text variant="display" align="center">
                  {t('onboarding.welcomeTitle1')}
                </Text>
                <Text variant="display" align="center" tone="accent">
                  {t('onboarding.welcomeTitle2')}
                </Text>
                <Text variant="body" tone="secondary" align="center">
                  {t('onboarding.welcomeBody')}
                </Text>
              </View>
              <View style={styles.chips}>
                <DSChip label={t('onboarding.chipTime')} icon={Timer} />
                <DSChip label={t('onboarding.chipHabits')} icon={Flame} />
                <DSChip label={t('onboarding.chipMood')} icon={Smile} />
              </View>
            </>
          ) : step === 1 ? (
            <>
              <PlanPreview />
              <StepCopy eyebrow={t('onboarding.planEyebrow')} title={t('onboarding.planTitle')} body={t('onboarding.planBody')} />
            </>
          ) : step === 2 ? (
            <>
              <InsightPreview />
              <StepCopy eyebrow={t('onboarding.insightEyebrow')} title={t('onboarding.insightTitle')} body={t('onboarding.insightBody')} />
            </>
          ) : (
            <View style={styles.personal}>
              <StepCopy eyebrow={t('onboarding.personalEyebrow')} title={t('onboarding.personalTitle')} body={t('onboarding.personalBody')} />
              <DSInput
                label={t('onboarding.nameLabel')}
                placeholder={t('onboarding.namePlaceholder')}
                value={name}
                onChangeText={setName}
                maxLength={LIMITS.name}
                autoCapitalize="words"
                returnKeyType="done"
                size="lg"
              />
              <View style={styles.field}>
                <Text variant="smallStrong" tone="secondary">
                  {t('settings.language')}
                </Text>
                <Segmented
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'hi', label: 'हिन्दी' },
                  ]}
                  value={preferences.language}
                  onChange={setLanguage}
                />
              </View>
              <View style={[styles.notifCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={[styles.notifIcon, { backgroundColor: palette.accentMuted }]}>
                  <BellRing size={20} color={palette.accentText} />
                </View>
                <View style={styles.flex}>
                  <Text variant="title">{t('onboarding.notifTitle')}</Text>
                  <Text variant="small" tone="secondary">
                    {!NOTIFICATIONS_SUPPORTED
                      ? t('web.notifBody')
                      : notifState === 'granted'
                      ? t('onboarding.notifGranted')
                      : notifState === 'denied'
                        ? t('onboarding.notifDenied')
                        : t('onboarding.notifBody')}
                  </Text>
                </View>
              </View>
              {notifState === 'idle' && NOTIFICATIONS_SUPPORTED ? (
                <PremiumButton label={t('onboarding.notifAllow')} icon={BellRing} variant="secondary" onPress={askNotifications} />
              ) : null}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots} accessibilityLabel={t('onboarding.step', { step: step + 1, total: STEPS })}>
          {Array.from({ length: STEPS }, (_, index) => (
            <View
              key={index}
              style={[styles.dot, { backgroundColor: index === step ? palette.accent : palette.elevated, width: index === step ? 34 : 8 }]}
            />
          ))}
        </View>
        {step < STEPS - 1 ? (
          <PremiumButton
            label={step === 0 ? t('onboarding.getStarted') : step === 2 ? t('onboarding.startJourney') : t('common.continue')}
            iconRight={ArrowRight}
            onPress={() => setStep(step + 1)}
          />
        ) : (
          <PremiumButton label={t('onboarding.enter')} iconRight={ArrowRight} onPress={finish} loading={busy} />
        )}
        <View style={styles.secondaryRow}>
          {step === 0 ? (
            <PremiumButton label={t('onboarding.restore')} variant="ghost" size="md" onPress={restore} />
          ) : (
            <PremiumButton label={t('common.back')} variant="ghost" size="md" fullWidth={false} onPress={() => setStep(step - 1)} />
          )}
        </View>
      </View>
    </View>
  );
}

function StepCopy({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  const palette = usePalette();
  return (
    <View style={styles.copy}>
      <View style={styles.eyebrow}>
        <View style={[styles.eyebrowDot, { backgroundColor: palette.accent }]} />
        <Text variant="label" tone="accent">
          {eyebrow}
        </Text>
      </View>
      <Text variant="display">{title}</Text>
      <Text variant="body" tone="secondary">
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.gutter },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logo: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lang: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, gap: 2 },
  langOption: { minWidth: 46, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  skip: { paddingHorizontal: space.lg, height: 38, borderRadius: radius.pill, justifyContent: 'center' },
  scroll: { flexGrow: 1, paddingHorizontal: space.gutter, paddingVertical: space.lg },
  stepBody: { gap: space.xl, flex: 1 },
  center: { alignItems: 'center', gap: space.md },
  headline: { gap: space.xs, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  copy: { gap: space.sm },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3 },
  personal: { gap: space.lg },
  field: { gap: space.xs + 2 },
  notifCard: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  notifIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bottom: { paddingHorizontal: space.gutter, gap: space.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  secondaryRow: { alignItems: 'center' },
});
