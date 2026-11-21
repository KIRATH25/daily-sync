import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bell, CalendarClock, Clock, Pencil, Plus, Repeat, Timer, Trash2, X } from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { AnimatedCheckbox } from '@/components/ui/Checkbox';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { IconButton } from '@/components/ui/IconButton';
import { DatePickerSheet } from '@/components/ui/Pickers';
import { ProgressBar } from '@/components/ui/Progress';
import { Pill, Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { addSubtask, deleteSubtask, deleteTask, getTask, listSubtasks, rescheduleTasks, setSubtaskDone } from '@/db/repositories/tasksRepo';
import { useClock } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useTaskActions } from '@/hooks/useTaskActions';
import { useI18n, type TKey } from '@/i18n';
import { addDays } from '@/lib/dates';
import { LIMITS, validateTitle } from '@/lib/validation';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const { t, formatDate, formatTime, formatDuration } = useI18n();
  const { preferences } = usePreferences();
  const { toast, confirm } = useFeedback();
  const today = useClock().dateKey;
  const { toggle } = useTaskActions();
  const [newSubtask, setNewSubtask] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  const query = useLiveQuery(
    async () => {
      const [task, subtasks] = await Promise.all([getTask(id), listSubtasks(id)]);
      return { task, subtasks };
    },
    ['tasks', 'task_subtasks'],
    [id],
  );
  const task = query.data?.task;
  const subtasks = query.data?.subtasks ?? [];

  const header = (
    <ScreenHeader
      actions={
        task ? (
          <IconButton icon={Pencil} label={t('common.edit')} onPress={() => router.push({ pathname: '/create', params: { type: 'task', id } })} size={42} />
        ) : null
      }
    />
  );

  if (query.loading && !query.data) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }
  if (!task) {
    return (
      <Screen header={header}>
        <EmptyState icon={X} title={t('common.notFound')} message={t('common.notFoundBody')} />
      </Screen>
    );
  }

  const done = task.completedAt != null;
  const add = async () => {
    const title = validateTitle(newSubtask);
    if (!title.ok) return;
    try {
      await addSubtask(task.id, title.value);
      setNewSubtask('');
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: t('common.deleteConfirmTitle'), message: t('tasks.deleteBody'), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    await deleteTask(task.id);
    toast(t('common.deleted'));
    router.back();
  };

  const reschedule = async (date: string) => {
    await rescheduleTasks([task.id], date);
    toast(t('tasks.rescheduled', { date: formatDate(date, 'weekdayDay') }));
  };

  const footer = (
    <View style={styles.footer}>
      <PremiumButton label={t('common.delete')} icon={Trash2} variant="danger" fullWidth={false} onPress={remove} />
      <PremiumButton label={done ? t('tasks.reopen') : t('tasks.complete')} onPress={() => toggle(task)} style={styles.flex} variant={done ? 'secondary' : 'primary'} haptic={done ? 'light' : 'success'} />
    </View>
  );

  return (
    <Screen header={header} footer={footer}>
      <View style={styles.pills}>
        <Pill label={t(`priority.${task.priority}` as TKey)} tone={task.priority === 'critical' ? 'danger' : 'accent'} />
        <Pill label={t(`category.${task.category}` as TKey)} tone="muted" />
        {done ? <Pill label={t('tasks.completedLabel')} tone="solid" /> : null}
      </View>
      <View style={styles.titleRow}>
        <AnimatedCheckbox checked={done} onToggle={() => toggle(task)} label={t(done ? 'tasks.markUndone' : 'tasks.markDone', { title: task.title })} size={30} />
        <Text variant="h1" style={styles.flex} strike={done} tone={done ? 'muted' : 'primary'}>
          {task.title}
        </Text>
      </View>
      {task.notes ? (
        <Text variant="body" tone="secondary">
          {task.notes}
        </Text>
      ) : null}

      <DSCard>
        <InfoRow icon={Clock} label={t('tasks.due')} value={task.dueDate ? `${formatDate(task.dueDate, 'full')}${task.dueMinute != null ? ` · ${formatTime(task.dueMinute)}` : ''}` : t('tasks.noDue')} />
        {task.recurrence ? <InfoRow icon={Repeat} label={t('create.repeat')} value={t(`repeat.${task.recurrence.freq}` as TKey)} /> : null}
        <InfoRow
          icon={Bell}
          label={t('create.reminders')}
          value={task.reminderOffsets.length ? task.reminderOffsets.map((offset) => (offset === 0 ? t('reminder.atTime') : t('reminder.before', { time: formatDuration(offset * 60) }))).join(', ') : t('common.none')}
        />
        {task.popupMessage ? <InfoRow icon={Bell} label={t('create.popupMessage')} value={task.popupMessage} /> : null}
      </DSCard>

      {!done ? (
        <View style={styles.chips}>
          <DSChip label={t('common.today')} icon={CalendarClock} onPress={() => reschedule(today)} size="sm" />
          <DSChip label={t('common.tomorrow')} onPress={() => reschedule(addDays(today, 1))} size="sm" />
          <DSChip label={t('create.nextWeek')} onPress={() => reschedule(addDays(today, 7))} size="sm" />
          <DSChip label={t('tasks.pickDate')} onPress={() => setRescheduling(true)} size="sm" />
          <DSChip label={t('tasks.focusOnThis')} icon={Timer} onPress={() => router.push({ pathname: '/focus', params: { taskId: task.id, label: task.title } })} size="sm" />
        </View>
      ) : null}

      <SectionHeader title={t('tasks.subtasks')} right={subtasks.length ? <Text variant="smallStrong" tone="secondary">{`${subtasks.filter((s) => s.done).length}/${subtasks.length}`}</Text> : undefined} />
      {subtasks.length > 0 ? <ProgressBar progress={subtasks.filter((s) => s.done).length / subtasks.length} /> : null}
      <DSCard padding={space.sm}>
        {subtasks.map((subtask) => (
          <View key={subtask.id} style={styles.subtask}>
            <AnimatedCheckbox checked={subtask.done} onToggle={() => setSubtaskDone(subtask.id, !subtask.done)} label={subtask.title} size={22} />
            <Text variant="body" style={styles.flex} strike={subtask.done} tone={subtask.done ? 'muted' : 'primary'}>
              {subtask.title}
            </Text>
            <IconButton icon={X} label={t('common.delete')} onPress={() => deleteSubtask(subtask.id)} variant="plain" size={34} />
          </View>
        ))}
        <View style={[styles.addSub, { backgroundColor: palette.surfaceAlt }]}>
          <Plus size={18} color={palette.textMuted} />
          <TextInput
            value={newSubtask}
            onChangeText={setNewSubtask}
            onSubmitEditing={add}
            placeholder={t('tasks.addSubtask')}
            placeholderTextColor={palette.textMuted}
            maxLength={LIMITS.title}
            returnKeyType="done"
            style={[styles.addInput, { color: palette.text, fontFamily: preferences.language === 'hi' ? fonts.hindiRegular : fonts.bodyMedium }]}
            accessibilityLabel={t('tasks.addSubtask')}
          />
        </View>
      </DSCard>
      <DatePickerSheet visible={rescheduling} value={task.dueDate ?? today} onClose={() => setRescheduling(false)} onChange={reschedule} />
    </Screen>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  const palette = usePalette();
  return (
    <View style={styles.info}>
      <Icon size={17} color={palette.accentText} />
      <View style={styles.flex}>
        <Text variant="small" tone="secondary">
          {label}
        </Text>
        <Text variant="bodyStrong">{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pills: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  titleRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  info: { flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.sm },
  subtask: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, minHeight: 50 },
  addSub: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.sm, paddingHorizontal: space.md, margin: space.xs, height: 48 },
  addInput: { flex: 1, fontSize: 15 },
  footer: { flexDirection: 'row', gap: space.sm },
});
