import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, CalendarCheck, Heart, NotebookPen } from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { DSInput } from '@/components/ui/Input';
import { PressableScale } from '@/components/ui/PressableScale';
import { Pill, Screen, ScreenHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { getReview, saveReview } from '@/db/repositories/reviewsRepo';
import { useToday } from '@/hooks/useClock';
import { useHaptics } from '@/hooks/useHaptics';
import { useI18n, type TKey } from '@/i18n';
import { isDateKey } from '@/lib/dates';
import { MOOD_TAGS, MOODS } from '@/lib/mood';
import { LIMITS, validateOptionalText } from '@/lib/validation';
import { skipMoodToday } from '@/services/notifications';
import { usePreferences } from '@/store/preferences';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { MoodLevel } from '@/types/models';

export default function MoodCheckInScreen() {
  const params = useLocalSearchParams<{ date?: string; mood?: string }>();
  const palette = usePalette();
  const { t, formatDate } = useI18n();
  const { preferences } = usePreferences();
  const { toast } = useFeedback();
  const { fire } = useHaptics();
  const today = useToday();
  // Reflections are for today or the past only.
  const date = isDateKey(params.date) && params.date <= today ? params.date : today;
  const preset = Number(params.mood);
  const [mood, setMood] = useState<MoodLevel | null>(preset >= 1 && preset <= 5 ? (preset as MoodLevel) : null);
  const [tags, setTags] = useState<string[]>([]);
  const [remark, setRemark] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let active = true;
    getReview(date)
      .then((review) => {
        if (!active || !review) return;
        setEditing(true);
        if (!(preset >= 1 && preset <= 5)) setMood(review.mood);
        setTags(review.tags);
        setRemark(review.remark ?? '');
        setGratitude(review.gratitude ?? '');
      })
      .catch(() => toast(t('error.loadFailed'), { tone: 'error' }));
    return () => {
      active = false;
    };
  }, [date, preset, toast, t]);

  const save = async () => {
    if (!mood) {
      toast(t('mood.pickFirst'), { tone: 'info' });
      return;
    }
    const remarkValue = validateOptionalText(remark, LIMITS.description);
    const gratitudeValue = validateOptionalText(gratitude, LIMITS.popupMessage * 2);
    if (!remarkValue.ok || !gratitudeValue.ok) {
      toast(t('validation.tooLong'), { tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      await saveReview(date, { mood, tags, remark: remarkValue.value, gratitude: gratitudeValue.value });
      fire('success');
      router.replace(`/mood/${date}`);
    } catch (error) {
      console.error('Mood save failed', error);
      toast(t('error.saveFailed'), { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    if (date === today && !editing) await skipMoodToday(preferences.timeZone);
    router.back();
  };

  const selected = MOODS.find((option) => option.level === mood);
  const header = <ScreenHeader leading="close" title={editing ? t('mood.editTitle') : t('mood.title')} />;
  const footer = (
    <View style={styles.footer}>
      <PremiumButton label={editing ? t('common.cancel') : t('common.skip')} variant="ghost" fullWidth={false} onPress={skip} />
      <PremiumButton label={t('mood.save')} iconRight={ArrowRight} onPress={save} loading={saving} disabled={!mood} style={styles.flex} />
    </View>
  );

  return (
    <Screen header={header} footer={footer}>
      <View style={styles.center}>
        <Pill label={t('mood.datePill', { date: formatDate(date, 'long') })} tone="muted" />
        <Text variant="display" align="center">
          {date === today ? t('mood.question') : t('mood.questionPast')}
        </Text>
        <Text variant="body" tone="secondary" align="center">
          {t('mood.subtitle')}
        </Text>
      </View>

      <View style={styles.rowBetween}>
        <Text variant="label" tone="secondary">
          {t('mood.feltState')}
        </Text>
        {selected ? (
          <Animated.View entering={FadeIn}>
            <Text variant="smallStrong" tone="accent">
              {t('mood.levelOf', { level: selected.level, label: t(selected.label) })}
            </Text>
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.moods}>
        {MOODS.map((option) => (
          <MoodOption key={option.level} emoji={option.emoji} label={t(option.label)} selected={mood === option.level} onPress={() => setMood(option.level)} />
        ))}
      </View>

      <View style={styles.rowBetween}>
        <Text variant="label" tone="secondary">
          {t('mood.factors')}
        </Text>
        <Text variant="small" tone="muted">
          {t('mood.factorsHint')}
        </Text>
      </View>
      <View style={styles.tags}>
        {MOOD_TAGS.map((tag) => (
          <DSChip
            key={tag}
            label={t(`moodTag.${tag}` as TKey)}
            selected={tags.includes(tag)}
            onPress={() => setTags(tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag])}
            size="sm"
          />
        ))}
      </View>

      <DSCard>
        <View style={styles.cardHead}>
          <NotebookPen size={17} color={palette.accentText} />
          <Text variant="label" tone="secondary">
            {t('mood.noteTitle')}
          </Text>
        </View>
        <DSInput label={t('mood.noteQuestion')} placeholder={t('mood.notePlaceholder')} value={remark} onChangeText={setRemark} multiline maxLength={LIMITS.description} showCount />
      </DSCard>
      <DSCard>
        <View style={styles.cardHead}>
          <Heart size={17} color={palette.accentText} />
          <Text variant="label" tone="secondary">
            {t('mood.gratitudeTitle')}
          </Text>
        </View>
        <DSInput label={t('mood.gratitudeQuestion')} placeholder={t('mood.gratitudePlaceholder')} value={gratitude} onChangeText={setGratitude} maxLength={LIMITS.popupMessage * 2} />
      </DSCard>
      <View style={[styles.synced, { backgroundColor: palette.surface }]}>
        <CalendarCheck size={18} color={palette.accentText} />
        <Text variant="small" tone="secondary" style={styles.flex}>
          {t('mood.syncNote', { date: formatDate(date, 'dayMonth') })}
        </Text>
      </View>
    </Screen>
  );
}

function MoodOption({ emoji, label, selected, onPress }: { emoji: string; label: string; selected: boolean; onPress: () => void }) {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (selected && !reduceMotion) scale.value = withSequence(withTiming(1.12, { duration: 120 }), withSpring(1, { damping: 9 }));
  }, [selected, reduceMotion, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.mood, { backgroundColor: selected ? palette.accentMuted : palette.surface, borderColor: selected ? palette.accent : palette.border }]}
    >
      <Animated.View style={style}>
        <Text style={styles.emoji}>{emoji}</Text>
      </Animated.View>
      <Text variant="micro" color={selected ? palette.accentText : palette.textSecondary} numberOfLines={1} style={styles.moodLabel}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: space.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  moods: { flexDirection: 'row', gap: space.sm },
  mood: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.md, borderWidth: 1.5, gap: 6 },
  emoji: { fontSize: 30, lineHeight: 38 },
  moodLabel: { textTransform: 'none', letterSpacing: 0 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  synced: { flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.lg, borderRadius: radius.md },
  footer: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
