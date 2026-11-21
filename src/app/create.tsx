import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowRight,
  Bell,
  BellRing,
  BookOpen,
  Brain,
  CalendarDays,
  CircleCheck,
  Clock,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  GraduationCap,
  Heart,
  Leaf,
  MapPin,
  Moon,
  Music,
  NotebookPen,
  PenLine,
  Sparkles,
  Sun,
  Target,
  Trash2,
  type LucideIcon,
} from '@/components/ui/icons';

import { ColorSwatches, FormSection, RecurrencePicker, ReminderPicker, WeekdayPicker } from '@/components/forms/FormParts';
import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { DSInput } from '@/components/ui/Input';
import { DatePickerSheet, PickerField, TimePickerSheet } from '@/components/ui/Pickers';
import { PressableScale } from '@/components/ui/PressableScale';
import { Pill, Screen, ScreenHeader } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { LoadingState } from '@/components/ui/States';
import { DSSwitch, SettingRow } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { createCountdown } from '@/db/repositories/countdownsRepo';
import { createEntry, deleteEntry, getEntry, updateEntry, type EntryInput } from '@/db/repositories/entriesRepo';
import { listPlans } from '@/db/repositories/fitnessRepo';
import { createHabit, deleteHabit, getHabit, updateHabit } from '@/db/repositories/habitsRepo';
import { createTask, deleteTask, getTask, updateTask } from '@/db/repositories/tasksRepo';
import { createSlots, createSubject, deleteSlot, getSlot, listSubjects, updateSlot } from '@/db/repositories/timetableRepo';
import { useClock } from '@/hooks/useClock';
import { useHaptics } from '@/hooks/useHaptics';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n, type TKey } from '@/i18n';
import { addDays, isDateKey, weekdayOf, type DateKey } from '@/lib/dates';
import { validateRecurrence, type RecurrenceRule } from '@/lib/recurrence';
import { wallClockToInstant } from '@/lib/timezone';
import { LIMITS, validateNumber, validateOptionalText, validateReminderOffsets, validateTimeRange, validateTitle } from '@/lib/validation';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { CATEGORIES, PRIORITIES, type Category, type HabitIcon, type Priority, type SlotType } from '@/types/models';

export type CreateType = 'event' | 'task' | 'reminder' | 'habit' | 'class' | 'workout' | 'note' | 'goal';
const TYPES: { value: CreateType; icon: LucideIcon }[] = [
  { value: 'event', icon: CalendarDays },
  { value: 'task', icon: CircleCheck },
  { value: 'reminder', icon: Bell },
  { value: 'habit', icon: Flame },
  { value: 'class', icon: GraduationCap },
  { value: 'workout', icon: Dumbbell },
  { value: 'note', icon: NotebookPen },
  { value: 'goal', icon: Target },
];

const HABIT_ICONS: { value: HabitIcon; icon: LucideIcon }[] = [
  { value: 'droplet', icon: Droplet },
  { value: 'book', icon: BookOpen },
  { value: 'dumbbell', icon: Dumbbell },
  { value: 'footprints', icon: Footprints },
  { value: 'brain', icon: Brain },
  { value: 'moon', icon: Moon },
  { value: 'sun', icon: Sun },
  { value: 'leaf', icon: Leaf },
  { value: 'heart', icon: Heart },
  { value: 'pen', icon: PenLine },
  { value: 'music', icon: Music },
  { value: 'sparkles', icon: Sparkles },
];

const ENTRY_TYPES = new Set<CreateType>(['event', 'reminder', 'note', 'goal', 'workout']);

function roundUpToHalfHour(minute: number): number {
  return Math.min(23 * 60 + 30, Math.ceil((minute + 1) / 30) * 30);
}

export default function CreateScreen() {
  const params = useLocalSearchParams<{ type?: string; id?: string; date?: string }>();
  const initialType = (TYPES.find((item) => item.value === params.type)?.value ?? 'event') as CreateType;
  const editingId = typeof params.id === 'string' && params.id.length > 0 ? params.id : null;
  const palette = usePalette();
  const { t, formatDate, formatTime, formatDuration, formatRelative } = useI18n();
  const { preferences } = usePreferences();
  const { toast, confirm } = useFeedback();
  const { fire } = useHaptics();
  const clock = useClock();
  const today = clock.dateKey;

  const [type, setType] = useState<CreateType>(initialType);
  const [loaded, setLoaded] = useState(!editingId);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<'title' | 'time' | 'target' | 'subject' | 'days' | 'repeat', string>>>({});

  // Shared
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>(initialType === 'workout' ? 'fitness' : initialType === 'class' ? 'academics' : 'personal');
  const [priority, setPriority] = useState<Priority>('medium');
  const [location, setLocation] = useState('');
  const [allDay, setAllDay] = useState(initialType === 'note' || initialType === 'goal');
  const [date, setDate] = useState<DateKey>(isDateKey(params.date) ? params.date : today);
  const defaultStart = roundUpToHalfHour(clock.minute);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(Math.min(1440, defaultStart + 60));
  const [hasTime, setHasTime] = useState(initialType !== 'task');
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(null);
  const [reminders, setReminders] = useState<number[]>(initialType === 'note' ? [] : [preferences.defaultReminderOffset]);
  const [popup, setPopup] = useState('');
  const [alsoCountdown, setAlsoCountdown] = useState(false);
  // Habit
  const [habitIcon, setHabitIcon] = useState<HabitIcon>('sparkles');
  const [habitMode, setHabitMode] = useState<'check' | 'count'>('check');
  const [target, setTarget] = useState('1');
  const [unit, setUnit] = useState('');
  const [increment, setIncrement] = useState('');
  const [scheduleDays, setScheduleDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [habitReminder, setHabitReminder] = useState<number | null>(null);
  // Class
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [professor, setProfessor] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([weekdayOf(isDateKey(params.date) ? params.date : today)]);
  const [slotType, setSlotType] = useState<SlotType>('lecture');
  const [classReminder, setClassReminder] = useState<number | null>(10);
  // Workout
  const [planId, setPlanId] = useState<string | null>(null);

  const [picker, setPicker] = useState<null | 'date' | 'start' | 'end' | 'habitReminder'>(null);

  const subjects = useLiveQuery(listSubjects, ['subjects'], []);
  const plans = useLiveQuery(listPlans, ['workout_plans', 'workout_plan_exercises'], []);

  // Load the record being edited.
  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    (async () => {
      try {
        if (initialType === 'task') {
          const task = await getTask(editingId);
          if (task && !cancelled) {
            setTitle(task.title);
            setDescription(task.notes ?? '');
            setPriority(task.priority);
            setCategory(task.category);
            if (task.dueDate) setDate(task.dueDate);
            setHasTime(task.dueMinute != null);
            if (task.dueMinute != null) setStart(task.dueMinute);
            setRecurrence(task.recurrence);
            setReminders(task.reminderOffsets);
            setPopup(task.popupMessage ?? '');
          }
        } else if (initialType === 'habit') {
          const habit = await getHabit(editingId);
          if (habit && !cancelled) {
            setTitle(habit.title);
            setDescription(habit.notes ?? '');
            setColor(habit.color);
            setHabitIcon(habit.icon);
            setHabitMode(habit.unit ? 'count' : 'check');
            setTarget(String(habit.targetValue));
            setUnit(habit.unit ?? '');
            setIncrement(habit.increment ? String(habit.increment) : '');
            setScheduleDays(habit.scheduleDays);
            setHabitReminder(habit.reminderMinute);
          }
        } else if (initialType === 'class') {
          const slot = await getSlot(editingId);
          if (slot && !cancelled) {
            setSubjectId(slot.subjectId);
            setSubjectName(slot.subject.name);
            setProfessor(slot.subject.professor ?? '');
            setLocation(slot.room ?? '');
            setWeekdays([slot.weekday]);
            setStart(slot.startMinute);
            setEnd(slot.endMinute);
            setSlotType(slot.slotType);
            setClassReminder(slot.reminderOffset);
          }
        } else {
          const entry = await getEntry(editingId);
          if (entry && !cancelled) {
            setType(entry.kind);
            setTitle(entry.title);
            setDescription(entry.description ?? '');
            setColor(entry.color);
            setCategory(entry.category);
            if (entry.priority) setPriority(entry.priority);
            setLocation(entry.location ?? '');
            setAllDay(entry.allDay);
            setDate(entry.startDate);
            if (entry.startMinute != null) setStart(entry.startMinute);
            if (entry.endMinute != null) setEnd(entry.endMinute);
            setRecurrence(entry.recurrence);
            setReminders(entry.reminderOffsets);
            setPopup(entry.popupMessage ?? '');
            setPlanId(entry.workoutPlanId);
          }
        }
      } catch (error) {
        console.error('Load for edit failed', error);
        toast(t('error.loadFailed'), { tone: 'error' });
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId, initialType, toast, t]);

  const isEntry = ENTRY_TYPES.has(type);
  const usesRange = type === 'event' || type === 'workout' || type === 'class';
  const timed = type === 'class' || (type === 'task' ? hasTime : isEntry && !allDay && type !== 'note');

  const startInstant = useMemo(() => wallClockToInstant(date, timed ? start : 0, preferences.timeZone), [date, start, timed, preferences.timeZone]);

  const primaryLabel = editingId ? t('create.saveChanges') : t(`create.cta.${type}` as TKey);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (type === 'class') {
      if (!subjectId && !validateTitle(subjectName).ok) next.subject = t('validation.required');
      if (weekdays.length === 0) next.days = t('create.pickDays');
    } else {
      const titleCheck = validateTitle(title);
      if (!titleCheck.ok) next.title = t(titleCheck.error);
    }
    if (usesRange && timed && !validateTimeRange(start, end).ok) next.time = t('validation.endBeforeStart');
    if (type === 'habit' && habitMode === 'count' && !validateNumber(target, 0.1, 1_000_000).ok) next.target = t('validation.outOfRange');
    if (recurrence) {
      const problem = validateRecurrence(recurrence, date);
      if (problem) next.repeat = t(problem as TKey);
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      fire('error');
      return;
    }
    setSaving(true);
    try {
      const cleanTitle = validateTitle(title);
      const titleValue = cleanTitle.ok ? cleanTitle.value : '';
      const descriptionValue = validateOptionalText(description, LIMITS.description);
      const notes = descriptionValue.ok ? descriptionValue.value : null;
      const popupValue = validateOptionalText(popup, LIMITS.popupMessage);
      const popupMessage = popupValue.ok ? popupValue.value : null;
      const reminderValue = validateReminderOffsets(reminders);
      const offsets = reminderValue.ok ? reminderValue.value : [];

      if (type === 'task') {
        const input = {
          title: titleValue,
          notes,
          priority,
          category,
          dueDate: date,
          dueMinute: hasTime ? start : null,
          recurrence,
          reminderOffsets: offsets,
          popupMessage,
        };
        if (editingId) await updateTask(editingId, input);
        else await createTask(input);
      } else if (type === 'habit') {
        const count = habitMode === 'count';
        const targetNumber = count ? Number(target.replace(',', '.')) : 1;
        const incrementNumber = count && increment ? Number(increment.replace(',', '.')) : null;
        const input = {
          title: titleValue,
          icon: habitIcon,
          color,
          targetValue: targetNumber > 0 ? targetNumber : 1,
          unit: count ? unit.trim().slice(0, 16) || null : null,
          increment: incrementNumber && incrementNumber > 0 ? incrementNumber : null,
          scheduleDays: scheduleDays.length ? scheduleDays : [0, 1, 2, 3, 4, 5, 6],
          weeklyTarget: null,
          reminderMinute: habitReminder,
          notes,
        };
        if (editingId) await updateHabit(editingId, input);
        else await createHabit(input, today);
      } else if (type === 'class') {
        let resolvedSubject = subjectId;
        if (!resolvedSubject) {
          const subject = await createSubject({
            name: subjectName.trim().slice(0, 80),
            code: null,
            professor: professor.trim() || null,
            color,
            attendanceTarget: 75,
          });
          resolvedSubject = subject.id;
        }
        const slot = { subjectId: resolvedSubject, startMinute: start, endMinute: end, room: location.trim() || null, slotType, reminderOffset: classReminder };
        if (editingId) await updateSlot(editingId, { ...slot, weekday: weekdays[0] ?? weekdayOf(date) });
        else await createSlots(slot, weekdays);
      } else {
        const kind = type as EntryInput['kind'];
        const isAllDay = type === 'note' || type === 'goal' || allDay;
        const input: EntryInput = {
          kind,
          title: titleValue,
          description: notes,
          category,
          color,
          priority: type === 'goal' || type === 'reminder' ? priority : null,
          location: location.trim().slice(0, LIMITS.location) || null,
          allDay: isAllDay,
          startDate: date,
          startMinute: isAllDay ? null : start,
          endMinute: isAllDay || type === 'reminder' ? null : end,
          recurrence,
          exceptionDates: [],
          reminderOffsets: type === 'note' ? [] : offsets,
          popupMessage,
          workoutPlanId: type === 'workout' ? planId : null,
        };
        if (editingId) await updateEntry(editingId, input);
        else await createEntry(input);
        if (alsoCountdown && !editingId) {
          await createCountdown({
            title: titleValue,
            subtitle: null,
            targetDate: date,
            targetMinute: isAllDay ? 0 : start,
            style: 'minimal',
            accent: color,
            backgroundUri: null,
            message: popupMessage,
            pinned: true,
            showSeconds: true,
            reminderOffsets: [1440],
          });
        }
      }
      fire('success');
      toast(editingId ? t('create.updated') : t(`create.created.${type}` as TKey));
      router.back();
    } catch (error) {
      console.error('Save failed', error);
      toast(t('error.saveFailed'), { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editingId) return;
    const ok = await confirm({ title: t('common.deleteConfirmTitle'), message: t('common.deleteConfirmBody'), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    try {
      if (type === 'task') await deleteTask(editingId);
      else if (type === 'habit') await deleteHabit(editingId);
      else if (type === 'class') await deleteSlot(editingId);
      else await deleteEntry(editingId);
      toast(t('common.deleted'));
      router.back();
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    }
  };

  const header = <ScreenHeader leading="close" title={editingId ? t('create.editTitle') : t('create.title')} />;
  const footer = (
    <View style={styles.footerRow}>
      {editingId ? <PremiumButton label={t('common.delete')} icon={Trash2} variant="danger" fullWidth={false} onPress={remove} /> : null}
      <PremiumButton label={primaryLabel} iconRight={ArrowRight} onPress={save} loading={saving} style={styles.flex} />
    </View>
  );

  if (!loaded) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }

  const previewWhen = (() => {
    if (type === 'class') return weekdays.length ? t('create.classWhen', { time: `${formatTime(start)}–${formatTime(end)}` }) : '';
    if (type === 'habit') return t('create.habitWhen', { count: scheduleDays.length });
    const day = formatDate(date, 'full');
    if (!timed) return day;
    return usesRange ? `${day} · ${formatTime(start)} – ${formatTime(end)}` : `${day} · ${formatTime(start)}`;
  })();

  return (
    <Screen header={header} footer={footer}>
      {!editingId ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.types} style={styles.typesScroll}>
          {TYPES.map((item) => (
            <DSChip
              key={item.value}
              label={t(`timeline.${item.value === 'habit' ? 'habit' : item.value}` as TKey)}
              icon={item.icon}
              selected={type === item.value}
              onPress={() => {
                setType(item.value);
                setErrors({});
                if (item.value === 'note' || item.value === 'goal') setAllDay(true);
                if (item.value === 'event' || item.value === 'workout') setAllDay(false);
                if (item.value === 'workout') setCategory('fitness');
                if (item.value === 'class') setCategory('academics');
                if (item.value === 'task') setHasTime(false);
                if (item.value === 'note') setReminders([]);
              }}
            />
          ))}
        </ScrollView>
      ) : null}

      <DSCard glow>
        <View style={styles.previewTop}>
          <Pill label={`${t(`timeline.${type}` as TKey)} · ${t(`category.${category}` as TKey)}`} tone="accent" />
          {type !== 'habit' && type !== 'class' && startInstant > clock.now ? (
            <View style={styles.inline}>
              <Clock size={13} color={palette.accentText} />
              <Text variant="smallStrong" tone="accent">
                {formatRelative(startInstant - clock.now)}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="h2" numberOfLines={2} tone={(type === 'class' ? subjectName : title) ? 'primary' : 'muted'} style={styles.previewTitle}>
          {(type === 'class' ? subjectName : title) || t('create.untitled')}
        </Text>
        {previewWhen ? (
          <View style={styles.inline}>
            <CalendarDays size={14} color={palette.textSecondary} />
            <Text variant="small" tone="secondary">
              {previewWhen}
            </Text>
          </View>
        ) : null}
        {location ? (
          <View style={styles.inline}>
            <MapPin size={14} color={palette.textSecondary} />
            <Text variant="small" tone="secondary">
              {location}
            </Text>
          </View>
        ) : null}
        {reminders.length > 0 && type !== 'habit' && type !== 'class' && type !== 'note' ? (
          <View style={[styles.reminderPill, { backgroundColor: palette.surfaceAlt }]}>
            <BellRing size={13} color={palette.accentText} />
            <Text variant="smallStrong" tone="secondary">
              {t('create.remindersCount', { count: reminders.length })}
            </Text>
          </View>
        ) : null}
      </DSCard>

      <FormSection title={t('create.details')} right={<Text variant="smallStrong" tone="accent">{t('common.required')}</Text>}>
        {type === 'class' ? (
          <>
            {subjects.data && subjects.data.length > 0 && !editingId ? (
              <View style={styles.chips}>
                {subjects.data.map((subject) => (
                  <DSChip
                    key={subject.id}
                    label={subject.name}
                    selected={subjectId === subject.id}
                    onPress={() => {
                      setSubjectId(subjectId === subject.id ? null : subject.id);
                      setSubjectName(subjectId === subject.id ? '' : subject.name);
                    }}
                    size="sm"
                  />
                ))}
              </View>
            ) : null}
            {!subjectId ? (
              <>
                <DSInput label={t('create.subject')} placeholder={t('create.subjectPlaceholder')} value={subjectName} onChangeText={setSubjectName} maxLength={80} error={errors.subject} />
                <DSInput label={t('create.professor')} placeholder={t('create.professorPlaceholder')} value={professor} onChangeText={setProfessor} maxLength={60} />
              </>
            ) : null}
            <DSInput label={t('create.room')} placeholder={t('create.roomPlaceholder')} value={location} onChangeText={setLocation} maxLength={LIMITS.location} />
            <View style={styles.chips}>
              {(['lecture', 'lab', 'tutorial', 'seminar'] as SlotType[]).map((value) => (
                <DSChip key={value} label={t(`slot.${value}` as TKey)} selected={slotType === value} onPress={() => setSlotType(value)} size="sm" />
              ))}
            </View>
          </>
        ) : (
          <>
            <DSInput
              label={t('create.titleLabel')}
              placeholder={t(`create.placeholder.${type}` as TKey)}
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                if (errors.title) setErrors({ ...errors, title: undefined });
              }}
              maxLength={LIMITS.title}
              error={errors.title}
              autoFocus={!editingId}
              returnKeyType="next"
            />
            <DSInput
              label={type === 'task' ? t('create.notes') : t('create.description')}
              placeholder={t('create.descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
              maxLength={LIMITS.description}
              multiline
            />
          </>
        )}
        {type !== 'task' ? <ColorSwatches value={color} onChange={setColor} label={t('create.color')} /> : null}
      </FormSection>

      {type === 'habit' ? (
        <FormSection title={t('create.habitSetup')}>
          <View style={styles.iconGrid}>
            {HABIT_ICONS.map((item) => {
              const selected = habitIcon === item.value;
              return (
                <PressableScale
                  key={item.value}
                  onPress={() => setHabitIcon(item.value)}
                  haptic="selection"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.value}
                  style={[styles.iconCell, { backgroundColor: selected ? palette.accent : palette.surfaceAlt }]}
                >
                  <item.icon size={20} color={selected ? palette.onAccent : palette.textSecondary} />
                </PressableScale>
              );
            })}
          </View>
          <Segmented
            options={[
              { value: 'check', label: t('create.habitCheck') },
              { value: 'count', label: t('create.habitCount') },
            ]}
            value={habitMode}
            onChange={setHabitMode}
          />
          {habitMode === 'count' ? (
            <View style={styles.row}>
              <DSInput label={t('create.dailyTarget')} value={target} onChangeText={setTarget} keyboardType="decimal-pad" containerStyle={styles.flex} error={errors.target} maxLength={9} />
              <DSInput label={t('create.unit')} placeholder="ml" value={unit} onChangeText={setUnit} containerStyle={styles.flex} maxLength={16} />
              <DSInput label={t('create.step')} placeholder="250" value={increment} onChangeText={setIncrement} keyboardType="decimal-pad" containerStyle={styles.flex} maxLength={9} />
            </View>
          ) : null}
          <Text variant="smallStrong" tone="secondary">
            {t('create.scheduleDays')}
          </Text>
          <WeekdayPicker value={scheduleDays} onChange={setScheduleDays} weekStart={preferences.weekStart} />
          <SettingRow
            icon={Bell}
            title={t('create.habitReminder')}
            subtitle={habitReminder != null ? formatTime(habitReminder) : t('common.off')}
            onPress={() => setPicker('habitReminder')}
            right={<DSSwitch label={t('create.habitReminder')} value={habitReminder != null} onChange={(on) => setHabitReminder(on ? 9 * 60 : null)} />}
          />
        </FormSection>
      ) : (
        <FormSection title={t('create.schedule')} right={<Text variant="smallStrong" tone="accent" latin>{preferences.timeZone}</Text>}>
          {type === 'class' ? (
            <>
              <Text variant="smallStrong" tone="secondary">
                {editingId ? t('create.classDay') : t('create.classDays')}
              </Text>
              <WeekdayPicker value={weekdays} onChange={(days) => setWeekdays(editingId ? days.slice(-1) : days)} weekStart={preferences.weekStart} />
              {errors.days ? (
                <Text variant="small" tone="danger">
                  {errors.days}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <PickerField label={type === 'task' ? t('create.dueDate') : t('create.date')} value={formatDate(date, 'full')} onPress={() => setPicker('date')} />
              <View style={styles.chips}>
                <DSChip label={t('common.today')} selected={date === today} onPress={() => setDate(today)} size="sm" />
                <DSChip label={t('common.tomorrow')} selected={date === addDays(today, 1)} onPress={() => setDate(addDays(today, 1))} size="sm" />
                <DSChip label={t('create.nextWeek')} selected={date === addDays(today, 7)} onPress={() => setDate(addDays(today, 7))} size="sm" />
              </View>
            </>
          )}
          {type === 'event' || type === 'workout' ? (
            <SettingRow title={t('common.allDay')} right={<DSSwitch label={t('common.allDay')} value={allDay} onChange={setAllDay} />} />
          ) : null}
          {type === 'task' ? (
            <SettingRow title={t('create.addTime')} right={<DSSwitch label={t('create.addTime')} value={hasTime} onChange={setHasTime} />} />
          ) : null}
          {timed ? (
            <View style={styles.row}>
              <PickerField icon="time" label={usesRange ? t('create.start') : t('create.time')} value={formatTime(start)} onPress={() => setPicker('start')} />
              {usesRange ? <PickerField icon="time" label={t('create.end')} value={formatTime(end)} onPress={() => setPicker('end')} /> : null}
            </View>
          ) : null}
          {errors.time ? (
            <Text variant="small" tone="danger">
              {errors.time}
            </Text>
          ) : null}
          {usesRange && timed && end > start ? (
            <View style={styles.inline}>
              <Clock size={14} color={palette.textSecondary} />
              <Text variant="small" tone="secondary">
                {t('create.duration', { duration: formatDuration((end - start) * 60) })}
              </Text>
            </View>
          ) : null}
          {type !== 'class' ? (
            <>
              <Text variant="smallStrong" tone="secondary">
                {t('create.repeat')}
              </Text>
              <RecurrencePicker value={recurrence} onChange={setRecurrence} startDate={date} weekStart={preferences.weekStart} />
              {errors.repeat ? (
                <Text variant="small" tone="danger">
                  {errors.repeat}
                </Text>
              ) : null}
            </>
          ) : null}
        </FormSection>
      )}

      {type !== 'class' && type !== 'habit' ? (
        <FormSection title={t('create.organize')}>
          <Text variant="smallStrong" tone="secondary">
            {t('create.category')}
          </Text>
          <View style={styles.chips}>
            {CATEGORIES.map((value) => (
              <DSChip key={value} label={t(`category.${value}` as TKey)} dot={palette.category[value]} selected={category === value} onPress={() => setCategory(value)} size="sm" />
            ))}
          </View>
          {type === 'task' || type === 'reminder' || type === 'goal' ? (
            <>
              <Text variant="smallStrong" tone="secondary">
                {t('create.priority')}
              </Text>
              <View style={styles.chips}>
                {PRIORITIES.map((value) => (
                  <DSChip key={value} label={t(`priority.${value}` as TKey)} dot={palette.priority[value]} selected={priority === value} onPress={() => setPriority(value)} size="sm" />
                ))}
              </View>
            </>
          ) : null}
          {type === 'event' || type === 'workout' ? (
            <DSInput label={t('create.location')} placeholder={t('create.locationPlaceholder')} value={location} onChangeText={setLocation} maxLength={LIMITS.location} left={<MapPin size={16} color={palette.textMuted} />} />
          ) : null}
          {type === 'workout' && plans.data && plans.data.length > 0 ? (
            <>
              <Text variant="smallStrong" tone="secondary">
                {t('create.workoutPlan')}
              </Text>
              <View style={styles.chips}>
                {plans.data.map((plan) => (
                  <DSChip key={plan.id} label={plan.name} selected={planId === plan.id} onPress={() => setPlanId(planId === plan.id ? null : plan.id)} size="sm" />
                ))}
              </View>
            </>
          ) : null}
        </FormSection>
      ) : null}

      {type === 'class' ? (
        <FormSection title={t('create.reminders')}>
          <View style={styles.chips}>
            {[null, 0, 5, 10, 15, 30].map((value) => (
              <DSChip
                key={String(value)}
                label={value == null ? t('common.off') : value === 0 ? t('reminder.atTime') : t('reminder.before', { time: formatDuration(value * 60) })}
                selected={classReminder === value}
                onPress={() => setClassReminder(value)}
                size="sm"
              />
            ))}
          </View>
        </FormSection>
      ) : type !== 'habit' && type !== 'note' ? (
        <FormSection title={t('create.reminders')} right={<BellRing size={18} color={palette.accentText} />}>
          {type === 'task' && !hasTime ? (
            <Text variant="small" tone="muted">
              {t('create.reminderAllDayHint')}
            </Text>
          ) : null}
          <ReminderPicker value={reminders} onChange={setReminders} />
          <DSInput label={t('create.popupMessage')} placeholder={t('create.popupPlaceholder')} value={popup} onChangeText={setPopup} maxLength={LIMITS.popupMessage} />
          {(type === 'event' || type === 'goal') && !editingId ? (
            <SettingRow
              title={t('create.alsoCountdown')}
              subtitle={t('create.alsoCountdownSub')}
              right={<DSSwitch label={t('create.alsoCountdown')} value={alsoCountdown} onChange={setAlsoCountdown} />}
            />
          ) : null}
        </FormSection>
      ) : null}

      <DatePickerSheet visible={picker === 'date'} value={date} onClose={() => setPicker(null)} onChange={setDate} />
      <TimePickerSheet
        visible={picker === 'start'}
        value={start}
        onClose={() => setPicker(null)}
        onChange={(minute) => {
          const duration = Math.max(15, end - start);
          setStart(minute);
          setEnd(Math.min(1440, minute + duration));
        }}
        title={usesRange ? t('create.start') : t('create.time')}
      />
      <TimePickerSheet visible={picker === 'end'} value={Math.min(end, 1439)} onClose={() => setPicker(null)} onChange={setEnd} title={t('create.end')} />
      <TimePickerSheet visible={picker === 'habitReminder'} value={habitReminder ?? 9 * 60} onClose={() => setPicker(null)} onChange={setHabitReminder} title={t('create.habitReminder')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typesScroll: { marginHorizontal: -space.gutter, flexGrow: 0 },
  types: { gap: space.sm, paddingHorizontal: space.gutter },
  previewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  previewTitle: { marginTop: space.sm, marginBottom: space.xs },
  reminderPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, marginTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  iconCell: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  footerRow: { flexDirection: 'row', gap: space.sm },
});
