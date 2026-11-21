import { useEffect, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Sparkles } from '@/components/ui/icons';

import { AchievementCard } from '@/components/collection/AchievementCard';
import { PremiumButton } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { markAchievementsSeen } from '@/db/repositories/achievementsRepo';
import { useHaptics } from '@/hooks/useHaptics';
import { useI18n } from '@/i18n';
import { getAchievement } from '@/lib/achievements';
import { onAchievementsUnlocked } from '@/services/achievements';
import { usePreferences } from '@/store/preferences';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import type { AchievementRecord } from '@/types/models';

/**
 * Memorable but quick unlock moment: the card flips up from the back with a
 * light sweep and a success haptic. Multiple unlocks queue one after another.
 */
export function AchievementReveal() {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { preferences } = usePreferences();
  const { t } = useI18n();
  const { fire } = useHaptics();
  const { width } = useWindowDimensions();
  const [queue, setQueue] = useState<AchievementRecord[]>([]);
  const current = queue[0];
  const definition = current ? getAchievement(current.achievementId) : undefined;

  const rotate = useSharedValue(90);
  const scale = useSharedValue(0.8);
  const sweep = useSharedValue(-1);

  useEffect(() => onAchievementsUnlocked((records) => setQueue((existing) => [...existing, ...records])), []);

  useEffect(() => {
    if (!current) return;
    fire('success');
    if (reduceMotion) {
      rotate.value = 0;
      scale.value = 1;
      return;
    }
    rotate.value = 90;
    scale.value = 0.82;
    sweep.value = -1;
    rotate.value = withTiming(0, { duration: 620, easing: Easing.out(Easing.back(1.4)) });
    scale.value = withSequence(withTiming(1.04, { duration: 520 }), withSpring(1, { damping: 12 }));
    sweep.value = withDelay(520, withTiming(1.4, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
  }, [current, reduceMotion, fire, rotate, scale, sweep]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${rotate.value}deg` }, { scale: scale.value }],
  }));
  const cardWidth = Math.min(width * 0.68, 300);
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * cardWidth }, { rotate: '18deg' }],
  }));

  const next = (open: boolean) => {
    const record = current;
    setQueue((existing) => existing.slice(1));
    if (queue.length <= 1) void markAchievementsSeen();
    if (open && record) router.push(`/collection/${record.achievementId}`);
  };

  if (!current || !definition) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => next(false)} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: 'rgba(5,5,6,0.92)' }]}>
        <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
          <Sparkles size={18} color={palette.accent} />
          <Text variant="label" color={palette.accent}>
            {t('achievements.newCard')}
          </Text>
        </Animated.View>
        <Animated.View style={[cardStyle, styles.cardWrap]}>
          <AchievementCard
            definition={definition}
            width={cardWidth}
            earned={{ date: current.earnedDate, recordId: current.id, value: current.milestoneValue }}
            holderName={preferences.userName || null}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.sweepClip]}>
            <Animated.View style={[styles.sweep, sweepStyle]} />
          </View>
        </Animated.View>
        <Text variant="body" color="#C9C7C0" align="center" style={styles.message}>
          {t('achievements.unlockedBody')}
        </Text>
        <View style={styles.actions}>
          <PremiumButton label={t('achievements.viewCard')} onPress={() => next(true)} />
          <PremiumButton label={t('common.later')} variant="ghost" onPress={() => next(false)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardWrap: { borderRadius: 22 },
  sweepClip: { overflow: 'hidden', borderRadius: 22 },
  sweep: { position: 'absolute', top: -40, bottom: -40, width: 60, backgroundColor: 'rgba(255,255,255,0.16)' },
  message: { maxWidth: 320 },
  actions: { alignSelf: 'stretch', gap: space.xs },
});
