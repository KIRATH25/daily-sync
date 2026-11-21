import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Hourglass, Pin, Plus } from '@/components/ui/icons';

import { CountdownHero } from '@/components/countdown/CountdownHero';
import { PremiumButton } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { listCountdowns } from '@/db/repositories/countdownsRepo';
import { useClock } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n } from '@/i18n';
import { wallClockToInstant } from '@/lib/timezone';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function CountdownsScreen() {
  const palette = usePalette();
  const { t } = useI18n();
  const { preferences } = usePreferences();
  const clock = useClock();
  const query = useLiveQuery(listCountdowns, ['countdowns'], []);
  const all = (query.data ?? []).map((countdown) => ({ countdown, target: wallClockToInstant(countdown.targetDate, countdown.targetMinute, preferences.timeZone) }));
  const upcoming = all.filter((item) => item.target > clock.now);
  const past = all.filter((item) => item.target <= clock.now);

  const header = <ScreenHeader large eyebrow={t('countdown.eyebrow')} title={t('countdown.title')} subtitle={t('countdown.subtitle')} />;
  return (
    <Screen header={header} footer={<PremiumButton label={t('countdown.new')} icon={Plus} onPress={() => router.push('/countdowns/edit')} />}>
      {query.loading && !query.data ? (
        <LoadingState />
      ) : all.length === 0 ? (
        <EmptyState icon={Hourglass} title={t('countdown.emptyTitle')} message={t('countdown.emptyBody')} />
      ) : (
        <>
          {upcoming.map(({ countdown, target }) => (
            <PressableScale key={countdown.id} onPress={() => router.push(`/countdowns/${countdown.id}`)} accessibilityLabel={countdown.title} scaleTo={0.98}>
              <CountdownHero countdown={countdown} targetMs={target} compact />
              {countdown.pinned ? (
                <View style={[styles.pin, { backgroundColor: palette.accent }]}>
                  <Pin size={13} color={palette.onAccent} />
                </View>
              ) : null}
            </PressableScale>
          ))}
          {past.length > 0 ? (
            <>
              <SectionHeader title={t('countdown.past')} />
              {past.map(({ countdown, target }) => (
                <PressableScale key={countdown.id} onPress={() => router.push(`/countdowns/${countdown.id}`)} accessibilityLabel={countdown.title} style={styles.past}>
                  <CountdownHero countdown={countdown} targetMs={target} compact />
                </PressableScale>
              ))}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pin: { position: 'absolute', top: space.md, right: space.md, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  past: { opacity: 0.6 },
});
