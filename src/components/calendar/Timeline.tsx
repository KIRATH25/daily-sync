import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Bell, CheckCheck, Dumbbell, GraduationCap, ListChecks, MapPin, NotebookPen, Smile, Target, CalendarDays, type LucideIcon } from '@/components/ui/icons';

import { AnimatedCheckbox } from '@/components/ui/Checkbox';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useI18n, type TKey, type Formatters } from '@/i18n';
import type { DateKey } from '@/lib/dates';
import { moodEmoji } from '@/lib/mood';
import type { Palette } from '@/theme/palette';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { DayReview, EntryOccurrence, Task, TimetableSlotWithSubject } from '@/types/models';

export type TimelineKind = 'event' | 'reminder' | 'note' | 'goal' | 'workout' | 'task' | 'class' | 'mood';

export interface TimelineItem {
  key: string;
  kind: TimelineKind;
  /** Minutes since midnight; null for all-day/untimed (sorted first). */
  minute: number | null;
  endMinute: number | null;
  title: string;
  subtitle: string | null;
  color: string;
  done: boolean;
  route: string;
  /** Present when the item can be ticked off inline. */
  toggle?: () => void;
  emoji?: string;
}

const KIND_ICON: Record<TimelineKind, LucideIcon> = {
  event: CalendarDays,
  reminder: Bell,
  note: NotebookPen,
  goal: Target,
  workout: Dumbbell,
  task: ListChecks,
  class: GraduationCap,
  mood: Smile,
};

export interface BuildTimelineInput {
  date: DateKey;
  occurrences: EntryOccurrence[];
  tasks: Task[];
  classes: TimetableSlotWithSubject[];
  review: DayReview | null;
  palette: Palette;
  t: Formatters['t'];
  onToggleTask?: (task: Task) => void;
  onToggleEntry?: (occurrence: EntryOccurrence) => void;
}

/** Merges every record type for a day into one chronological list. */
export function buildTimeline({ date, occurrences, tasks, classes, review, palette, t, onToggleTask, onToggleEntry }: BuildTimelineInput): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const occurrence of occurrences) {
    const { entry } = occurrence;
    items.push({
      key: `e-${entry.id}-${occurrence.date}`,
      kind: entry.kind,
      minute: entry.allDay ? null : entry.startMinute,
      endMinute: entry.allDay ? null : entry.endMinute,
      title: entry.title,
      subtitle: entry.location ?? entry.description,
      color: entry.color ?? palette.category[entry.category],
      done: occurrence.completed,
      route: `/entry/${entry.id}?date=${occurrence.date}`,
      toggle: onToggleEntry ? () => onToggleEntry(occurrence) : undefined,
    });
  }
  for (const task of tasks) {
    if (task.dueDate !== date && task.completedDate !== date) continue;
    items.push({
      key: `t-${task.id}`,
      kind: 'task',
      minute: task.dueDate === date ? task.dueMinute : null,
      endMinute: null,
      title: task.title,
      subtitle: t(`priority.${task.priority}` as TKey),
      color: palette.priority[task.priority],
      done: task.completedAt != null,
      route: `/tasks/${task.id}`,
      toggle: onToggleTask ? () => onToggleTask(task) : undefined,
    });
  }
  for (const slot of classes) {
    items.push({
      key: `c-${slot.id}`,
      kind: 'class',
      minute: slot.startMinute,
      endMinute: slot.endMinute,
      title: slot.subject.name,
      subtitle: [slot.room, slot.subject.professor].filter(Boolean).join(' · ') || null,
      color: slot.subject.color ?? palette.category.academics,
      done: false,
      route: '/timetable',
    });
  }
  if (review) {
    items.push({
      key: `m-${date}`,
      kind: 'mood',
      minute: null,
      endMinute: null,
      title: t(`mood.level${review.mood}` as TKey),
      subtitle: review.remark,
      color: palette.category.mindful,
      done: true,
      route: `/mood/${date}`,
      emoji: moodEmoji(review.mood),
    });
  }
  return items.sort((a, b) => (a.minute ?? -1) - (b.minute ?? -1));
}

export const ActivityTimeline = memo(function ActivityTimeline({ items, nowMinute }: { items: TimelineItem[]; nowMinute?: number | null }) {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { t, formatTime } = useI18n();
  // The "now" line goes before the first timed item that starts later; -1 → at the end.
  const nowIndex = nowMinute == null ? -2 : items.findIndex((item) => item.minute != null && item.minute > nowMinute);

  return (
    <View>
      {items.map((item, index) => {
        const showNow = index === nowIndex;
        const Icon = KIND_ICON[item.kind];
        return (
          <View key={item.key}>
            {showNow && nowMinute != null ? <NowLine label={t('calendar.now', { time: formatTime(nowMinute) })} /> : null}
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(index, 8) * 30).duration(240)} style={styles.row}>
              <View style={styles.timeCol}>
                <Text variant="smallStrong" tone={item.done ? 'muted' : 'secondary'} latin numberOfLines={1}>
                  {item.minute != null ? formatTime(item.minute) : t('common.allDayShort')}
                </Text>
              </View>
              <View style={styles.rail}>
                <View style={[styles.node, { backgroundColor: item.done ? palette.accent : item.color, borderColor: palette.background }]}>
                  {item.done ? <CheckCheck size={9} color={palette.onAccent} strokeWidth={3} /> : null}
                </View>
                {index < items.length - 1 ? <View style={[styles.line, { backgroundColor: palette.border }]} /> : null}
              </View>
              <PressableScale
                onPress={() => router.push(item.route as never)}
                accessibilityLabel={`${item.title}${item.minute != null ? `, ${formatTime(item.minute)}` : ''}`}
                scaleTo={0.98}
                style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.kind, { backgroundColor: `${item.color}22` }]}>
                    <Icon size={12} color={item.color} strokeWidth={2.4} />
                    <Text variant="micro" color={item.color} numberOfLines={1}>
                      {t(`timeline.${item.kind}` as TKey)}
                    </Text>
                  </View>
                  {item.endMinute != null && item.minute != null ? (
                    <Text variant="small" tone="muted" latin>
                      {formatTime(item.minute)}–{formatTime(item.endMinute)}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.cardBody}>
                  {item.emoji ? <Text style={styles.emoji}>{item.emoji}</Text> : null}
                  <View style={styles.flex}>
                    <Text variant="title" tone={item.done && item.kind !== 'mood' ? 'muted' : 'primary'} strike={item.done && item.kind !== 'mood'} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <View style={styles.subRow}>
                        {item.kind === 'event' || item.kind === 'class' ? <MapPin size={12} color={palette.textMuted} /> : null}
                        <Text variant="small" tone="secondary" numberOfLines={2} style={styles.flex}>
                          {item.subtitle}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {item.toggle ? (
                    <AnimatedCheckbox checked={item.done} onToggle={item.toggle} label={t(item.done ? 'tasks.markUndone' : 'tasks.markDone', { title: item.title })} size={24} />
                  ) : null}
                </View>
              </PressableScale>
            </Animated.View>
          </View>
        );
      })}
      {nowIndex === -1 && nowMinute != null && items.length > 0 ? <NowLine label={t('calendar.now', { time: formatTime(nowMinute) })} /> : null}
    </View>
  );
});

function NowLine({ label }: { label: string }) {
  const palette = usePalette();
  return (
    <View style={styles.now} accessibilityLabel={label}>
      <View style={[styles.nowDot, { backgroundColor: palette.accent }]} />
      <View style={[styles.nowLine, { backgroundColor: palette.accent }]} />
      <View style={[styles.nowPill, { backgroundColor: palette.accent }]}>
        <Text variant="micro" color={palette.onAccent}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  timeCol: { width: 66, paddingTop: space.md },
  rail: { width: 22, alignItems: 'center' },
  node: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, marginTop: space.md + 1, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, marginTop: 2 },
  card: { flex: 1, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, flexShrink: 1 },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  emoji: { fontSize: 26, lineHeight: 32 },
  now: { flexDirection: 'row', alignItems: 'center', marginVertical: space.sm, marginLeft: 66 },
  nowDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 6 },
  nowLine: { flex: 1, height: 2 },
  nowPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
});
