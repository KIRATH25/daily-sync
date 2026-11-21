import { useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowUp,
  BellRing,
  BookOpen,
  CalendarDays,
  CircleCheck,
  Droplet,
  Dumbbell,
  Flag,
  Flame,
  GraduationCap,
  NotebookPen,
  Sparkles,
  Target,
  Zap,
  X,
  type LucideIcon,
} from '@/components/ui/icons';

import { useFeedback } from '@/components/ui/Feedback';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Pill } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { createEntry } from '@/db/repositories/entriesRepo';
import { addHydration } from '@/db/repositories/fitnessRepo';
import { createTask } from '@/db/repositories/tasksRepo';
import { useToday } from '@/hooks/useClock';
import { useHaptics } from '@/hooks/useHaptics';
import { useI18n, type TKey } from '@/i18n';
import { parseQuickInput } from '@/lib/quickParse';
import { LIMITS, validateTitle } from '@/lib/validation';
import { usePreferences } from '@/store/preferences';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';

interface Tile {
  icon: LucideIcon;
  title: TKey;
  subtitle: TKey;
  href: string;
  tone: 'accent' | 'soft' | 'surface' | 'cyan';
}

const TILES: Tile[] = [
  { icon: CircleCheck, title: 'quick.task', subtitle: 'quick.taskSub', href: '/create?type=task', tone: 'accent' },
  { icon: CalendarDays, title: 'quick.event', subtitle: 'quick.eventSub', href: '/create?type=event', tone: 'soft' },
  { icon: BellRing, title: 'quick.reminder', subtitle: 'quick.reminderSub', href: '/create?type=reminder', tone: 'surface' },
  { icon: Flame, title: 'quick.habit', subtitle: 'quick.habitSub', href: '/create?type=habit', tone: 'soft' },
  { icon: GraduationCap, title: 'quick.class', subtitle: 'quick.classSub', href: '/create?type=class', tone: 'cyan' },
  { icon: Dumbbell, title: 'quick.workout', subtitle: 'quick.workoutSub', href: '/create?type=workout', tone: 'surface' },
  { icon: NotebookPen, title: 'quick.note', subtitle: 'quick.noteSub', href: '/journal/new', tone: 'surface' },
  { icon: Flag, title: 'quick.milestone', subtitle: 'quick.milestoneSub', href: '/countdowns/edit', tone: 'accent' },
  { icon: Target, title: 'quick.goal', subtitle: 'quick.goalSub', href: '/create?type=goal', tone: 'soft' },
];

export default function QuickAddScreen() {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { t, formatDate, formatTime } = useI18n();
  const { preferences } = usePreferences();
  const { toast } = useFeedback();
  const { fire } = useHaptics();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const today = useToday();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const drag = useSharedValue(0);

  const parsed = useMemo(() => (text.trim() ? parseQuickInput(text, today) : null), [text, today]);
  const close = () => router.back();

  const pan = usePanGesture({
    activeOffsetY: [-1000, 10],
    onUpdate: (event) => {
      'worklet';
      drag.value = Math.max(0, event.translationY);
    },
    onDeactivate: (event) => {
      'worklet';
      if (event.translationY > 120 || event.velocityY > 900) runOnJS(close)();
      else drag.value = withSpring(0, { damping: 18 });
    },
  });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));

  const submit = async () => {
    if (!parsed) return;
    const title = validateTitle(parsed.title);
    if (!title.ok) {
      toast(t('quick.needTitle'), { tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      const reminders = parsed.minute != null ? [preferences.defaultReminderOffset] : [];
      if (parsed.kind === 'task') {
        await createTask({
          title: title.value,
          notes: null,
          priority: 'medium',
          category: 'personal',
          dueDate: parsed.dateKey,
          dueMinute: parsed.minute,
          recurrence: null,
          reminderOffsets: parsed.dateKey ? reminders : [],
          popupMessage: null,
        });
      } else {
        const start = parsed.minute ?? 9 * 60;
        await createEntry({
          kind: 'event',
          title: title.value,
          description: null,
          category: 'personal',
          color: null,
          priority: null,
          location: null,
          allDay: false,
          startDate: parsed.dateKey ?? today,
          startMinute: start,
          endMinute: Math.min(1440, start + 60),
          recurrence: null,
          exceptionDates: [],
          reminderOffsets: reminders,
          popupMessage: null,
          workoutPlanId: null,
        });
      }
      fire('success');
      toast(parsed.kind === 'task' ? t('quick.taskAdded') : t('quick.eventAdded'));
      Keyboard.dismiss();
      close();
    } catch (error) {
      console.error('Quick add failed', error);
      toast(t('error.saveFailed'), { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const presets: { icon: LucideIcon; label: string; run: () => void }[] = [
    {
      icon: Droplet,
      label: t('quick.presetWater'),
      run: async () => {
        await addHydration(today, 250);
        fire('success');
        toast(t('quick.waterLogged'));
        close();
      },
    },
    { icon: Zap, label: t('quick.presetSprint'), run: () => router.replace({ pathname: '/focus', params: { minutes: '25' } }) },
    { icon: BookOpen, label: t('quick.presetRead'), run: () => router.replace({ pathname: '/focus', params: { minutes: '20', label: t('quick.readingLabel') } }) },
  ];

  const toneStyle = (tone: Tile['tone']) => {
    switch (tone) {
      case 'accent':
        return { bg: palette.accent, fg: palette.onAccent };
      case 'soft':
        return { bg: palette.accentMuted, fg: palette.accentText };
      case 'cyan':
        return { bg: palette.tertiary, fg: '#062A33' };
      default:
        return { bg: palette.elevated, fg: palette.accentText };
    }
  };

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: palette.overlay }]}>
        <Pressable style={styles.flex} onPress={close} accessibilityRole="button" accessibilityLabel={t('common.close')} />
      </Animated.View>
      <Animated.View
        entering={reduceMotion ? FadeIn : SlideInDown.springify().damping(20).stiffness(200)}
        style={[styles.sheet, { backgroundColor: palette.surface, maxHeight: height * 0.92, paddingBottom: insets.bottom + space.md, borderColor: palette.border }, sheetStyle]}
        accessibilityViewIsModal
      >
        <GestureDetector gesture={pan}>
          <View style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: palette.borderStrong }]} />
            <View style={styles.titleRow}>
              <View style={styles.flex}>
                <View style={styles.inline}>
                  <Text variant="h2" accessibilityRole="header">
                    {t('quick.title')}
                  </Text>
                </View>
                <Text variant="small" tone="secondary">
                  {t('quick.subtitle')}
                </Text>
              </View>
              <IconButton icon={X} label={t('common.close')} onPress={close} size={40} />
            </View>
          </View>
        </GestureDetector>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.smartBox, { backgroundColor: palette.surfaceAlt, borderColor: text ? palette.accent : 'transparent' }]}>
            <Sparkles size={20} color={palette.accentText} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('quick.placeholder')}
              placeholderTextColor={palette.textMuted}
              style={[styles.smartInput, { color: palette.text, fontFamily: preferences.language === 'hi' ? fonts.hindiRegular : fonts.bodyMedium }]}
              maxLength={LIMITS.title + 40}
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel={t('quick.placeholder')}
              selectionColor={palette.accent}
              maxFontSizeMultiplier={1.3}
            />
            <IconButton icon={ArrowUp} label={t('quick.add')} onPress={submit} variant="accent" size={40} disabled={!parsed || saving} haptic="light" />
          </View>
          {parsed ? (
            <Animated.View entering={FadeIn} style={styles.preview} accessibilityLiveRegion="polite">
              <Pill label={t(parsed.kind === 'task' ? 'timeline.task' : 'timeline.event')} tone="solid" />
              <Text variant="small" tone="secondary" numberOfLines={1} style={styles.flex}>
                {[
                  parsed.title || t('quick.untitled'),
                  parsed.dateKey ? (parsed.dateKey === today ? t('common.today') : formatDate(parsed.dateKey, 'weekdayDay')) : t('quick.noDate'),
                  parsed.minute != null ? formatTime(parsed.minute) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Animated.View>
          ) : (
            <Text variant="small" tone="muted">
              {t('quick.hint')}
            </Text>
          )}

          <Text variant="label" tone="secondary">
            {t('quick.presets')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
            {presets.map((preset) => (
              <PressableScale
                key={preset.label}
                onPress={preset.run}
                haptic="light"
                accessibilityLabel={preset.label}
                style={[styles.preset, { backgroundColor: palette.surfaceAlt }]}
              >
                <preset.icon size={17} color={palette.accentText} />
                <Text variant="bodyStrong">{preset.label}</Text>
              </PressableScale>
            ))}
          </ScrollView>

          <Text variant="label" tone="secondary">
            {t('quick.categories')}
          </Text>
          <View style={styles.grid}>
            {TILES.map((tile) => {
              const tone = toneStyle(tile.tone);
              return (
                <PressableScale
                  key={tile.href}
                  onPress={() => router.replace(tile.href as never)}
                  accessibilityLabel={`${t(tile.title)}. ${t(tile.subtitle)}`}
                  scaleTo={0.95}
                  style={[styles.tile, { backgroundColor: palette.surfaceAlt }]}
                >
                  <View style={[styles.tileIcon, { backgroundColor: tone.bg }]}>
                    <tile.icon size={22} color={tone.fg} strokeWidth={2} />
                  </View>
                  <Text variant="title" numberOfLines={1}>
                    {t(tile.title)}
                  </Text>
                  <Text variant="small" tone="secondary" numberOfLines={1}>
                    {t(tile.subtitle)}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
          <Text variant="small" tone="muted" align="center">
            {t('quick.dismissHint')}
          </Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0 },
  handleArea: { paddingTop: space.sm, paddingHorizontal: space.gutter },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  content: { paddingHorizontal: space.gutter, paddingTop: space.lg, paddingBottom: space.lg, gap: space.md },
  smartBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, paddingLeft: space.md, paddingRight: 6, height: 60, borderWidth: 1.5 },
  smartInput: { flex: 1, fontSize: 15.5, height: 56 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  presets: { gap: space.sm },
  preset: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, height: 46, borderRadius: radius.pill },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: '48.6%', padding: space.lg, borderRadius: radius.lg, gap: 4 },
  tileIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
});
