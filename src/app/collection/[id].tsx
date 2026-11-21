import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BadgeCheck, CalendarDays, Hand, Hash, Lock, Share2, Sparkles, X } from '@/components/ui/icons';

import { AchievementCard } from '@/components/collection/AchievementCard';
import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { Pill, Screen, ScreenHeader } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { getAchievementRecord } from '@/db/repositories/achievementsRepo';
import { listActiveDates } from '@/db/repositories/activityRepo';
import { useToday } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n, type TKey } from '@/i18n';
import { ACHIEVEMENT_COUNT, achievementProgress, cardRecordCode, getAchievement } from '@/lib/achievements';
import { computeJourneyStats } from '@/lib/journey';
import { usePreferences } from '@/store/preferences';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const definition = getAchievement(id);
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { t, formatDate, formatInstant } = useI18n();
  const { preferences } = usePreferences();
  const { width } = useWindowDimensions();
  const today = useToday();
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);

  const query = useLiveQuery(
    async () => {
      const [record, dates] = await Promise.all([getAchievementRecord(id), listActiveDates()]);
      return { record, stats: computeJourneyStats(dates, today) };
    },
    ['achievement_records', 'tasks', 'habit_logs', 'day_reviews'],
    [id, today],
  );

  // Drag to tilt the card in 3D; springs back on release.
  const pan = usePanGesture({
    onUpdate: (event) => {
      'worklet';
      if (reduceMotion) return;
      tiltY.value = Math.max(-14, Math.min(14, event.translationX / 8));
      tiltX.value = Math.max(-14, Math.min(14, -event.translationY / 8));
    },
    onFinalize: () => {
      'worklet';
      tiltX.value = withSpring(0, { damping: 10 });
      tiltY.value = withSpring(0, { damping: 10 });
    },
  });
  const tiltStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateX: `${tiltX.value}deg` }, { rotateY: `${tiltY.value}deg` }],
  }));
  const glareStyle = useAnimatedStyle(() => ({
    opacity: Math.min(0.35, (Math.abs(tiltX.value) + Math.abs(tiltY.value)) / 40),
    transform: [{ translateX: tiltY.value * 6 }, { rotate: '20deg' }],
  }));

  const header = <ScreenHeader leading="close" title={t('collection.cardDetail')} />;
  if (!definition) {
    return (
      <Screen header={header}>
        <EmptyState icon={X} title={t('common.notFound')} />
      </Screen>
    );
  }
  if (!query.data) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }

  const { record, stats } = query.data;
  const progress = record ? null : achievementProgress(definition, stats);
  const cardWidth = Math.min(width * 0.74, 320);
  const name = t(`achievement.${definition.id}.name` as TKey);

  const footer = record ? (
    <>
      <PremiumButton label={t('collection.share')} icon={Share2} onPress={() => router.push(`/share/${definition.id}`)} />
      <PremiumButton label={t('collection.return')} icon={ArrowLeft} variant="ghost" size="md" onPress={() => router.back()} />
    </>
  ) : (
    <PremiumButton label={t('collection.return')} icon={ArrowLeft} variant="secondary" onPress={() => router.back()} />
  );

  return (
    <Screen header={header} footer={footer}>
      <View style={styles.topRow}>
        <Pill label={record ? t('collection.earned') : t('collection.locked')} tone={record ? 'accent' : 'muted'} icon={record ? BadgeCheck : Lock} />
        <Text variant="smallStrong" tone="secondary" latin>
          {`#${String(definition.number).padStart(3, '0')} / ${String(ACHIEVEMENT_COUNT).padStart(3, '0')}`}
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View entering={FadeIn.duration(300)} style={[styles.cardWrap, tiltStyle]}>
          <AchievementCard
            definition={definition}
            width={cardWidth}
            earned={record ? { date: record.earnedDate, recordId: record.id, value: record.milestoneValue } : null}
            holderName={record ? preferences.userName || null : null}
            progress={progress}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glareClip]}>
            <Animated.View style={[styles.glare, glareStyle]} />
          </View>
        </Animated.View>
      </GestureDetector>
      {!reduceMotion ? (
        <View style={styles.hint}>
          <Hand size={14} color={palette.textMuted} />
          <Text variant="small" tone="muted">
            {t('collection.tiltHint')}
          </Text>
        </View>
      ) : null}

      <View style={styles.rowBetween}>
        <Text variant="label" tone="secondary">
          {t('collection.dossier')}
        </Text>
        <Pill label={t(`series.${definition.series}` as TKey)} tone="accent" />
      </View>
      <DSCard>
        <View style={styles.meaning}>
          <View style={[styles.meaningIcon, { backgroundColor: palette.surfaceAlt }]}>
            <Sparkles size={18} color={palette.accentText} />
          </View>
          <View style={styles.flex}>
            <Text variant="h3">{name}</Text>
            <Text variant="body" tone="secondary" style={styles.spacedXs}>
              {t(`achievement.${definition.id}.description` as TKey)}
            </Text>
          </View>
        </View>
        <View style={[styles.requirement, { backgroundColor: palette.surfaceAlt }]}>
          <Text variant="small" tone="secondary">
            {t('collection.requirement')}
          </Text>
          <Text variant="bodyStrong">{t(`achievement.${definition.id}.requirement` as TKey)}</Text>
          {progress ? (
            <>
              <ProgressBar progress={progress.ratio} style={styles.spacedSm} />
              <Text variant="small" tone="accent">
                {t('collection.progressLong', { current: progress.current, target: progress.target })}
              </Text>
            </>
          ) : null}
        </View>
      </DSCard>

      {record ? (
        <DSCard>
          <Row icon={CalendarDays} label={t('collection.dateEarned')} value={`${formatDate(record.earnedDate, 'medium')} · ${t('collection.recordedAt', { time: formatInstant(record.earnedAt) })}`} />
          <Row icon={BadgeCheck} label={t('collection.milestone')} value={String(record.milestoneValue)} />
          <Row icon={Hash} label={t('collection.recordId')} value={cardRecordCode(definition, record.earnedDate, record.id)} selectable />
        </DSCard>
      ) : null}
    </Screen>
  );
}

function Row({ icon: Icon, label, value, selectable }: { icon: typeof Hash; label: string; value: string; selectable?: boolean }) {
  const palette = usePalette();
  return (
    <View style={styles.row}>
      <Icon size={16} color={palette.accentText} />
      <Text variant="body" tone="secondary" style={styles.flex}>
        {label}
      </Text>
      <Text variant="bodyStrong" latin selectable={selectable} style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardWrap: { alignSelf: 'center', borderRadius: 22 },
  glareClip: { overflow: 'hidden', borderRadius: 22 },
  glare: { position: 'absolute', top: -60, bottom: -60, left: '35%', width: 70, backgroundColor: 'rgba(255,255,255,0.5)' },
  hint: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  meaning: { flexDirection: 'row', gap: space.md },
  meaningIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  requirement: { padding: space.md, borderRadius: radius.md, marginTop: space.md, gap: 4 },
  spacedXs: { marginTop: 4 },
  spacedSm: { marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  value: { flexShrink: 1, textAlign: 'right' },
});
