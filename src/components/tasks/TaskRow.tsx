import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Bell, Clock, Repeat } from '@/components/ui/icons';

import { AnimatedCheckbox } from '@/components/ui/Checkbox';
import { DSCard } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { Pill } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useI18n, type TKey } from '@/i18n';
import type { DateKey } from '@/lib/dates';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import type { Task } from '@/types/models';

export interface TaskRowProps {
  task: Task;
  today: DateKey;
  nowMinute: number;
  onToggle: (task: Task) => void;
  compact?: boolean;
}

/** One task: animated checkbox, title, due status, priority and subtask progress. */
export const TaskRow = memo(function TaskRow({ task, today, nowMinute, onToggle, compact }: TaskRowProps) {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { t, formatTime, formatDate } = useI18n();
  const done = task.completedAt != null;
  const overdue =
    !done && task.dueDate != null && (task.dueDate < today || (task.dueDate === today && task.dueMinute != null && task.dueMinute < nowMinute));

  let due: string | null = null;
  if (done && task.completedAt) due = t('tasks.completedLabel');
  else if (task.dueDate) {
    const dayLabel =
      task.dueDate === today ? t('common.today') : task.dueDate < today ? formatDate(task.dueDate, 'dayMonth') : formatDate(task.dueDate, 'weekdayDay');
    due = task.dueMinute != null ? `${dayLabel}, ${formatTime(task.dueMinute)}` : dayLabel;
  }

  const priorityTone = task.priority === 'critical' ? 'danger' : task.priority === 'high' ? 'accent' : task.priority === 'medium' ? 'muted' : 'tertiary';

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200)} layout={reduceMotion ? undefined : LinearTransition.springify().damping(18)}>
      <DSCard
        onPress={() => router.push(`/tasks/${task.id}`)}
        padding={compact ? space.md + 2 : space.lg}
        accessibilityLabel={`${task.title}${due ? `, ${due}` : ''}`}
        style={done ? styles.done : undefined}
      >
        <View style={styles.row}>
          <AnimatedCheckbox checked={done} onToggle={() => onToggle(task)} label={t(done ? 'tasks.markUndone' : 'tasks.markDone', { title: task.title })} />
          <View style={styles.body}>
            {!compact ? (
              <View style={styles.pills}>
                <Pill label={t(`priority.${task.priority}` as TKey)} tone={priorityTone} />
                <Pill label={t(`category.${task.category}` as TKey)} tone="muted" />
              </View>
            ) : null}
            <Text variant="title" tone={done ? 'muted' : 'primary'} strike={done} numberOfLines={2}>
              {task.title}
            </Text>
            {due ? (
              <View style={styles.meta}>
                <Clock size={13} color={overdue ? palette.dangerText : palette.textSecondary} strokeWidth={2} />
                <Text variant="small" tone={overdue ? 'danger' : 'secondary'} numberOfLines={1}>
                  {overdue ? t('tasks.overdueLabel', { when: due }) : due}
                </Text>
                {task.recurrence ? <Repeat size={13} color={palette.textMuted} /> : null}
                {task.reminderOffsets.length > 0 && !done ? <Bell size={13} color={palette.textMuted} /> : null}
              </View>
            ) : null}
            {task.subtaskTotal > 0 && !compact ? (
              <View style={styles.subtasks}>
                <View style={styles.subRow}>
                  <Text variant="small" tone="secondary">
                    {t('tasks.subtaskProgress', { done: task.subtaskDone, total: task.subtaskTotal })}
                  </Text>
                  <Text variant="smallStrong" tone="secondary" latin>
                    {Math.round((task.subtaskDone / task.subtaskTotal) * 100)}%
                  </Text>
                </View>
                <ProgressBar progress={task.subtaskDone / task.subtaskTotal} height={5} color={overdue ? palette.danger : palette.accent} />
              </View>
            ) : null}
          </View>
          {compact ? <Pill label={t(`priority.${task.priority}` as TKey)} tone={priorityTone} /> : null}
        </View>
      </DSCard>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  body: { flex: 1, gap: 6 },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subtasks: { gap: 6, marginTop: 4 },
  subRow: { flexDirection: 'row', justifyContent: 'space-between' },
  done: { opacity: 0.7 },
});
