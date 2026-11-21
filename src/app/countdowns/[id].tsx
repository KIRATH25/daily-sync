import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { Bell, Check, Lock, Palette as PaletteIcon, Pencil, Pin, PinOff, Quote, Trash2, X } from '@/components/ui/icons';

import { CountdownHero } from '@/components/countdown/CountdownHero';
import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { deleteCountdown, getCountdown, setCountdownPinned, updateCountdown } from '@/db/repositories/countdownsRepo';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n, type TKey } from '@/i18n';
import { wallClockToInstant } from '@/lib/timezone';
import { deleteStoredImage } from '@/services/media';
import { usePreferences } from '@/store/preferences';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { COUNTDOWN_STYLES, type CountdownStyle } from '@/types/models';
import { SWATCHES } from '@/components/forms/FormParts';

export default function CountdownDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { t, formatDuration } = useI18n();
  const { preferences } = usePreferences();
  const { toast, confirm } = useFeedback();
  const query = useLiveQuery(() => getCountdown(id), ['countdowns'], [id]);
  const countdown = query.data;

  const header = (
    <ScreenHeader
      actions={
        countdown ? (
          <>
            <IconButton
              icon={countdown.pinned ? PinOff : Pin}
              label={countdown.pinned ? t('countdown.unpin') : t('countdown.pin')}
              variant={countdown.pinned ? 'soft' : 'surface'}
              size={42}
              onPress={async () => {
                await setCountdownPinned(countdown.id, !countdown.pinned);
                toast(countdown.pinned ? t('countdown.unpinned') : t('countdown.pinned'));
              }}
            />
            <IconButton icon={Pencil} label={t('common.edit')} size={42} onPress={() => router.push({ pathname: '/countdowns/edit', params: { id: countdown.id } })} />
          </>
        ) : null
      }
    />
  );

  if (query.loading && countdown === undefined) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }
  if (!countdown) {
    return (
      <Screen header={header}>
        <EmptyState icon={X} title={t('common.notFound')} message={t('common.notFoundBody')} />
      </Screen>
    );
  }

  const target = wallClockToInstant(countdown.targetDate, countdown.targetMinute, preferences.timeZone);
  const quickUpdate = (patch: Partial<typeof countdown>) => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = { ...countdown, ...patch };
    updateCountdown(countdown.id, rest).catch(() => toast(t('error.saveFailed'), { tone: 'error' }));
  };

  const remove = async () => {
    const ok = await confirm({ title: t('common.deleteConfirmTitle'), message: t('countdown.deleteBody'), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    deleteStoredImage(countdown.backgroundUri);
    await deleteCountdown(countdown.id);
    toast(t('common.deleted'));
    router.back();
  };

  return (
    <Screen header={header} footer={<PremiumButton label={t('common.delete')} icon={Trash2} variant="danger" onPress={remove} />}>
      <Animated.View entering={reduceMotion ? undefined : FadeInUp.springify().damping(16)}>
        <CountdownHero countdown={countdown} targetMs={target} />
      </Animated.View>

      {countdown.message ? (
        <DSCard>
          <View style={styles.memo}>
            <View style={[styles.memoIcon, { backgroundColor: palette.accentMuted }]}>
              <Quote size={16} color={palette.accentText} />
            </View>
            <View style={styles.flex}>
              <View style={styles.memoHead}>
                <Text variant="label" tone="accent">
                  {t('countdown.memo')}
                </Text>
                <View style={styles.inline}>
                  <Lock size={12} color={palette.textMuted} />
                  <Text variant="micro" tone="muted">
                    {t('countdown.private')}
                  </Text>
                </View>
              </View>
              <Text variant="title" style={styles.italic}>
                “{countdown.message}”
              </Text>
            </View>
          </View>
        </DSCard>
      ) : null}

      <DSCard>
        <View style={styles.sectionHead}>
          <PaletteIcon size={18} color={palette.accentText} />
          <Text variant="h3" style={styles.flex}>
            {t('countdown.studio')}
          </Text>
        </View>
        <Text variant="label" tone="secondary" style={styles.spaced}>
          {t('countdown.presentation')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {COUNTDOWN_STYLES.map((style: CountdownStyle) => (
            <DSChip key={style} label={t(`countdownStyle.${style}` as TKey)} selected={countdown.style === style} onPress={() => quickUpdate({ style })} />
          ))}
        </ScrollView>
        <Text variant="label" tone="secondary" style={styles.spaced}>
          {t('countdown.accent')}
        </Text>
        <View style={styles.swatches}>
          {SWATCHES.map((color) => {
            const selected = (countdown.accent ?? palette.accent) === color;
            return (
              <PressableScale
                key={color}
                onPress={() => quickUpdate({ accent: color })}
                haptic="selection"
                accessibilityState={{ selected }}
                accessibilityLabel={color}
                style={[styles.swatch, { backgroundColor: color, borderColor: selected ? palette.text : 'transparent' }]}
              >
                {selected ? <Check size={16} color="#141414" strokeWidth={3} /> : null}
              </PressableScale>
            );
          })}
        </View>
      </DSCard>

      <DSCard>
        <View style={styles.sectionHead}>
          <Bell size={18} color={palette.accentText} />
          <Text variant="h3" style={styles.flex}>
            {t('countdown.reminders')}
          </Text>
          <Text variant="smallStrong" tone="accent">
            {t('countdown.activeAlerts', { count: countdown.reminderOffsets.length + 1 })}
          </Text>
        </View>
        <View style={[styles.chips, styles.spaced]}>
          {[...countdown.reminderOffsets].sort((a, b) => b - a).map((offset) => (
            <DSChip key={offset} label={t('reminder.before', { time: formatDuration(offset * 60) })} icon={Check} selected size="sm" />
          ))}
          <DSChip label={t('reminder.atTime')} icon={Check} selected size="sm" />
        </View>
        <Text variant="small" tone="muted" style={styles.spaced}>
          {t('countdown.remindersHint')}
        </Text>
      </DSCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  italic: { fontStyle: 'italic' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memo: { flexDirection: 'row', gap: space.md },
  memoIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  memoHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  spaced: { marginTop: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  swatch: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
});
