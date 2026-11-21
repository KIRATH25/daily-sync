import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bell, CalendarClock, CalendarDays, Copy, Dumbbell, MapPin, MessageSquare, Pencil, Repeat, Trash2, X } from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { IconButton } from '@/components/ui/IconButton';
import { DatePickerSheet, TimePickerSheet } from '@/components/ui/Pickers';
import { Pill, Screen, ScreenHeader } from '@/components/ui/Screen';
import { DSBottomSheet } from '@/components/ui/Sheet';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { deleteEntry, duplicateEntry, getEntry, listOccurrencesOn, rescheduleEntry, setEntryCompleted, skipOccurrence } from '@/db/repositories/entriesRepo';
import { useClock } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n, type TKey } from '@/i18n';
import { isDateKey } from '@/lib/dates';
import { usePalette } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function EntryDetailScreen() {
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const { t, formatDate, formatTime, formatDuration, weekdayName } = useI18n();
  const { toast, confirm } = useFeedback();
  const today = useClock().dateKey;
  const [deleteSheet, setDeleteSheet] = useState(false);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [newDate, setNewDate] = useState<string | null>(null);

  const query = useLiveQuery(
    async () => {
      const entry = await getEntry(params.id);
      if (!entry) return { entry: null, completed: false, date: null as string | null };
      const date = isDateKey(params.date) ? params.date : entry.startDate;
      const occurrences = await listOccurrencesOn(date);
      const occurrence = occurrences.find((item) => item.entry.id === entry.id);
      return { entry, completed: occurrence?.completed ?? false, date };
    },
    ['calendar_entries', 'entry_completions'],
    [params.id, params.date],
  );

  const entry = query.data?.entry;
  const date = query.data?.date ?? today;
  const header = (
    <ScreenHeader
      actions={entry ? <IconButton icon={Pencil} label={t('common.edit')} onPress={() => router.push({ pathname: '/create', params: { type: entry.kind, id: entry.id } })} size={42} /> : null}
    />
  );

  if (query.loading && !query.data) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }
  if (!entry) {
    return (
      <Screen header={header}>
        <EmptyState icon={X} title={t('common.notFound')} message={t('common.notFoundBody')} />
      </Screen>
    );
  }

  const completed = query.data?.completed ?? false;
  const recurring = entry.recurrence != null;

  const toggleDone = async () => {
    await setEntryCompleted(entry.id, date, !completed, today);
    toast(completed ? t('entry.markedOpen') : t('entry.markedDone'));
  };

  const removeAll = async () => {
    setDeleteSheet(false);
    const ok = await confirm({ title: t('common.deleteConfirmTitle'), message: recurring ? t('entry.deleteSeriesBody') : t('common.deleteConfirmBody'), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    await deleteEntry(entry.id);
    toast(t('common.deleted'));
    router.back();
  };

  const removeOne = async () => {
    setDeleteSheet(false);
    await skipOccurrence(entry.id, date);
    toast(t('entry.occurrenceRemoved'));
    router.back();
  };

  const duplicate = async () => {
    const copy = await duplicateEntry(entry.id);
    if (copy) {
      toast(t('entry.duplicated'));
      router.replace({ pathname: '/create', params: { type: copy.kind, id: copy.id } });
    }
  };

  const applyReschedule = async (targetDate: string, minute: number | null) => {
    await rescheduleEntry(entry.id, targetDate, minute);
    toast(t('tasks.rescheduled', { date: formatDate(targetDate, 'weekdayDay') }));
    router.setParams({ date: targetDate });
  };

  const footer = (
    <View style={styles.footer}>
      <PremiumButton label={t('common.delete')} icon={Trash2} variant="danger" fullWidth={false} onPress={() => (recurring ? setDeleteSheet(true) : removeAll())} />
      {entry.kind !== 'note' ? (
        <PremiumButton label={completed ? t('entry.markOpen') : t('entry.markDone')} onPress={toggleDone} style={styles.flex} variant={completed ? 'secondary' : 'primary'} haptic={completed ? 'light' : 'success'} />
      ) : null}
    </View>
  );

  const ruleText = entry.recurrence
    ? entry.recurrence.freq === 'weekly' && entry.recurrence.byWeekday
      ? t('entry.weeklyOn', { days: entry.recurrence.byWeekday.map((day) => weekdayName(day, 'short')).join(', ') })
      : t(`repeat.${entry.recurrence.freq}` as TKey)
    : null;

  return (
    <Screen header={header} footer={footer}>
      <View style={styles.pills}>
        <Pill label={t(`timeline.${entry.kind}` as TKey)} tone="accent" />
        <Pill label={t(`category.${entry.category}` as TKey)} tone="muted" />
        {completed ? <Pill label={t('entry.done')} tone="solid" /> : null}
      </View>
      <Text variant="h1" strike={completed}>
        {entry.title}
      </Text>
      {entry.description ? (
        <Text variant="body" tone="secondary">
          {entry.description}
        </Text>
      ) : null}
      <DSCard>
        <Row icon={CalendarDays} label={t('create.date')} value={formatDate(date, 'full')} />
        {!entry.allDay && entry.startMinute != null ? (
          <Row
            icon={CalendarClock}
            label={t('create.time')}
            value={entry.endMinute != null ? `${formatTime(entry.startMinute)} – ${formatTime(entry.endMinute)} · ${formatDuration((entry.endMinute - entry.startMinute) * 60)}` : formatTime(entry.startMinute)}
          />
        ) : (
          <Row icon={CalendarClock} label={t('create.time')} value={t('common.allDay')} />
        )}
        {entry.location ? <Row icon={MapPin} label={t('create.location')} value={entry.location} /> : null}
        {ruleText ? <Row icon={Repeat} label={t('create.repeat')} value={ruleText} /> : null}
        <Row
          icon={Bell}
          label={t('create.reminders')}
          value={entry.reminderOffsets.length ? entry.reminderOffsets.map((offset) => (offset === 0 ? t('reminder.atTime') : t('reminder.before', { time: formatDuration(offset * 60) }))).join(', ') : t('common.none')}
        />
        {entry.popupMessage ? <Row icon={MessageSquare} label={t('create.popupMessage')} value={entry.popupMessage} /> : null}
      </DSCard>
      <View style={styles.chips}>
        <DSChip label={t('entry.reschedule')} icon={CalendarClock} onPress={() => setPicker('date')} size="sm" />
        <DSChip label={t('entry.duplicate')} icon={Copy} onPress={duplicate} size="sm" />
        {entry.kind === 'workout' ? <DSChip label={t('fitness.startWorkout')} icon={Dumbbell} onPress={() => router.push('/fitness')} size="sm" /> : null}
      </View>
      {recurring ? (
        <Text variant="small" tone="muted">
          {t('entry.recurringNote')}
        </Text>
      ) : null}

      <DSBottomSheet visible={deleteSheet} onClose={() => setDeleteSheet(false)} title={t('entry.deleteRecurringTitle')}>
        <PremiumButton label={t('entry.deleteThisOnly')} variant="secondary" onPress={removeOne} />
        <PremiumButton label={t('entry.deleteSeries')} variant="danger" onPress={removeAll} />
      </DSBottomSheet>
      <DatePickerSheet
        visible={picker === 'date'}
        value={date}
        onClose={() => setPicker(null)}
        onChange={(value) => {
          if (entry.allDay || entry.startMinute == null) void applyReschedule(value, null);
          else {
            setNewDate(value);
            setTimeout(() => setPicker('time'), 250);
          }
        }}
      />
      <TimePickerSheet
        visible={picker === 'time'}
        value={entry.startMinute ?? 9 * 60}
        onClose={() => setPicker(null)}
        onChange={(minute) => void applyReschedule(newDate ?? date, minute)}
      />
    </Screen>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Bell; label: string; value: string }) {
  const palette = usePalette();
  return (
    <View style={styles.row}>
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
  row: { flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.sm },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  footer: { flexDirection: 'row', gap: space.sm },
});
