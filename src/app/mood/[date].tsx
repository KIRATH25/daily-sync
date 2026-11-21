import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarCheck, Check, Pencil, Smile, Sparkles, Trash2 } from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { useFeedback } from '@/components/ui/Feedback';
import { Pill, Screen, ScreenHeader } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { deleteReview, getReview, listReviews } from '@/db/repositories/reviewsRepo';
import { useToday } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n, type TKey } from '@/i18n';
import { isDateKey, weekDays, weekdayOf } from '@/lib/dates';
import { moodEmoji } from '@/lib/mood';
import { usePreferences } from '@/store/preferences';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export default function MoodSummaryScreen() {
  const params = useLocalSearchParams<{ date: string }>();
  const today = useToday();
  const date = isDateKey(params.date) ? params.date : today;
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { t, formatDate, formatInstant, weekdayName, formatNumber } = useI18n();
  const { preferences } = usePreferences();
  const { confirm, toast } = useFeedback();
  const week = useMemo(() => weekDays(date, preferences.weekStart), [date, preferences.weekStart]);

  const query = useLiveQuery(
    async () => {
      const [review, weekReviews] = await Promise.all([getReview(date), listReviews(week[0] ?? date, week[6] ?? date)]);
      return { review, weekReviews };
    },
    ['day_reviews'],
    [date, week],
  );

  const review = query.data?.review;
  const weekReviews = query.data?.weekReviews ?? [];
  const average = weekReviews.length ? weekReviews.reduce((sum, item) => sum + item.mood, 0) / weekReviews.length : null;
  const best = weekReviews.length ? weekReviews.reduce((top, item) => (item.mood > top.mood ? item : top)) : null;

  const header = <ScreenHeader title={t('mood.summaryTitle')} />;
  if (query.loading && !query.data) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }
  if (!review) {
    return (
      <Screen header={header}>
        <EmptyState
          icon={Smile}
          title={t('mood.noneTitle')}
          message={t('mood.noneBody')}
          actionLabel={date <= today ? t('mood.logNow') : undefined}
          onAction={() => router.replace({ pathname: '/mood', params: { date } })}
        />
      </Screen>
    );
  }

  const remove = async () => {
    const ok = await confirm({ title: t('common.deleteConfirmTitle'), message: t('mood.deleteBody'), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    await deleteReview(date);
    toast(t('common.deleted'));
    router.back();
  };

  const footer = (
    <>
      <PremiumButton label={t('mood.edit')} icon={Pencil} variant="secondary" onPress={() => router.push({ pathname: '/mood', params: { date } })} />
      <PremiumButton label={t('mood.doneViewCalendar')} icon={Check} onPress={() => router.navigate('/calendar')} />
    </>
  );

  return (
    <Screen header={header} footer={footer}>
      <View style={styles.center}>
        <Pill label={t('mood.syncedPill', { date: formatDate(date, 'dayMonth') })} tone="muted" icon={CalendarCheck} />
      </View>
      <DSCard glow>
        <View style={styles.hero}>
          <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)} style={[styles.emojiWrap, { backgroundColor: palette.surfaceAlt }]}>
            <Text style={styles.emoji}>{moodEmoji(review.mood)}</Text>
            <View style={[styles.badge, { backgroundColor: palette.accent, borderColor: palette.surface }]}>
              <Check size={14} color={palette.onAccent} strokeWidth={3} />
            </View>
          </Animated.View>
          <Text variant="label" tone="accent">
            {t('mood.recorded')}
          </Text>
          <Text variant="h1" align="center">
            {t(`mood.level${review.mood}` as TKey)}
          </Text>
          <Text variant="small" tone="secondary" align="center">
            {t('mood.loggedAt', { time: formatInstant(review.updatedAt), date: formatDate(date, 'long') })}
          </Text>
          <View style={[styles.score, { backgroundColor: palette.surfaceAlt }]}>
            <Text variant="small" tone="secondary">
              {t('mood.score')}
            </Text>
            <Text variant="h3" tone="accent" latin>
              {review.mood}
            </Text>
            <Text variant="small" tone="secondary" latin>
              / 5
            </Text>
          </View>
          {review.tags.length ? (
            <View style={styles.tags}>
              {review.tags.map((tag) => (
                <Pill key={tag} label={t(`moodTag.${tag}` as TKey)} tone="accent" />
              ))}
            </View>
          ) : null}
        </View>
      </DSCard>

      {review.remark || review.gratitude ? (
        <Animated.View entering={FadeInDown.delay(80)}>
          <DSCard>
            {review.remark ? (
              <>
                <Text variant="label" tone="secondary">
                  {t('mood.noteQuestion')}
                </Text>
                <View style={[styles.quote, { borderLeftColor: palette.accent }]}>
                  <Text variant="title" style={styles.italic}>
                    “{review.remark}”
                  </Text>
                </View>
              </>
            ) : null}
            {review.gratitude ? (
              <View style={[styles.gratitude, { backgroundColor: palette.surfaceAlt }]}>
                <Sparkles size={18} color={palette.accentText} />
                <View style={styles.flex}>
                  <Text variant="label" tone="accent">
                    {t('mood.gratitudeTitle')}
                  </Text>
                  <Text variant="body">{review.gratitude}</Text>
                </View>
              </View>
            ) : null}
          </DSCard>
        </Animated.View>
      ) : null}

      <DSCard>
        <View style={styles.rowBetween}>
          <Text variant="label" tone="secondary">
            {t('mood.weekRhythm')}
          </Text>
          <Text variant="smallStrong" tone="accent">
            {`${formatDate(week[0] ?? date, 'dayMonth')} – ${formatDate(week[6] ?? date, 'dayMonth')}`}
          </Text>
        </View>
        <View style={styles.week}>
          {week.map((day) => {
            const entry = weekReviews.find((item) => item.date === day);
            const active = day === date;
            return (
              <View key={day} style={[styles.weekDay, active && { backgroundColor: palette.elevated }]}>
                <Text variant="micro" tone={active ? 'accent' : 'muted'}>
                  {weekdayName(weekdayOf(day), 'narrow')}
                </Text>
                <Text style={styles.weekEmoji}>{entry ? moodEmoji(entry.mood) : '·'}</Text>
              </View>
            );
          })}
        </View>
        {average != null && best ? (
          <View style={[styles.insight, { backgroundColor: palette.surfaceAlt }]}>
            <Sparkles size={16} color={palette.accentText} />
            <Text variant="small" tone="secondary" style={styles.flex}>
              {t('mood.weekInsight', { avg: formatNumber(average, 1), count: weekReviews.length, day: weekdayName(weekdayOf(best.date), 'long') })}
            </Text>
          </View>
        ) : null}
      </DSCard>
      <PremiumButton label={t('mood.delete')} icon={Trash2} variant="ghost" size="sm" onPress={remove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  italic: { fontStyle: 'italic' },
  center: { alignItems: 'center' },
  hero: { alignItems: 'center', gap: space.sm },
  emojiWrap: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  emoji: { fontSize: 54, lineHeight: 64 },
  badge: { position: 'absolute', right: 2, bottom: 2, width: 30, height: 30, borderRadius: 15, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  score: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, marginTop: space.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center', marginTop: space.sm },
  quote: { borderLeftWidth: 3, paddingLeft: space.md, marginTop: space.md },
  gratitude: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, marginTop: space.lg },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  week: { flexDirection: 'row', marginTop: space.md, gap: 4 },
  weekDay: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.md, gap: 6 },
  weekEmoji: { fontSize: 22, lineHeight: 28 },
  insight: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, marginTop: space.md, alignItems: 'center' },
});
