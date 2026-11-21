import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Check, CircleSlash, ClipboardList, GraduationCap, MapPin, Plus, Settings2, Trash2, X } from '@/components/ui/icons';

import { ReminderPicker } from '@/components/forms/FormParts';
import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { AnimatedCheckbox } from '@/components/ui/Checkbox';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { IconButton } from '@/components/ui/IconButton';
import { DSInput } from '@/components/ui/Input';
import { DatePickerSheet, PickerField, TimePickerSheet } from '@/components/ui/Pickers';
import { ProgressBar } from '@/components/ui/Progress';
import { PressableScale } from '@/components/ui/PressableScale';
import { Pill, Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { DSBottomSheet } from '@/components/ui/Sheet';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  attendanceForDate,
  attendanceSummary,
  createAssignment,
  deleteAssignment,
  listAssignments,
  listSlots,
  listSubjects,
  setAssignmentCompleted,
  setAttendance,
} from '@/db/repositories/timetableRepo';
import { useClock } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n, type TKey } from '@/i18n';
import { addDays, diffDays, parseDateKey, weekDays, weekdayOf, type DateKey } from '@/lib/dates';
import { wallClockToInstant } from '@/lib/timezone';
import { LIMITS, validateTitle } from '@/lib/validation';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { AssignmentKind, AttendanceStatus } from '@/types/models';

export default function TimetableScreen() {
  const palette = usePalette();
  const { t, formatTime, formatDate, formatRelative, weekdayName, formatPercent, tp } = useI18n();
  const { preferences, setPreferences } = usePreferences();
  const { toast, confirm } = useFeedback();
  const clock = useClock();
  const today = clock.dateKey;
  const [selected, setSelected] = useState<DateKey>(today);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [semesterOpen, setSemesterOpen] = useState(false);

  const query = useLiveQuery(
    async () => {
      const [slots, assignments, summary, attendance, subjects] = await Promise.all([
        listSlots(),
        listAssignments(false),
        attendanceSummary(),
        attendanceForDate(selected),
        listSubjects(),
      ]);
      return { slots, assignments, summary, attendance, subjects };
    },
    ['timetable_slots', 'subjects', 'assignments', 'attendance_records'],
    [selected],
  );

  const week = useMemo(() => weekDays(selected, preferences.weekStart), [selected, preferences.weekStart]);
  const data = query.data;
  const daySlots = useMemo(() => (data ? data.slots.filter((slot) => slot.weekday === weekdayOf(selected)) : []), [data, selected]);

  const nextClass = useMemo(() => {
    if (!data) return null;
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(today, offset);
      const slots = data.slots.filter((slot) => slot.weekday === weekdayOf(date));
      const upcoming = slots.find((slot) => offset > 0 || slot.endMinute > clock.minute);
      if (upcoming) return { slot: upcoming, date, at: wallClockToInstant(date, upcoming.startMinute, preferences.timeZone) };
    }
    return null;
  }, [data, today, clock.minute, preferences.timeZone]);

  const exams = (data?.assignments ?? []).filter((item) => item.kind === 'exam' || item.kind === 'quiz').slice(0, 2);
  const recorded = (data?.summary ?? []).filter((item) => item.ratio != null);
  const overall = recorded.length ? recorded.reduce((sum, item) => sum + item.present, 0) / Math.max(1, recorded.reduce((sum, item) => sum + item.present + item.absent, 0)) : null;
  const semesterWeek = preferences.semesterStart && preferences.semesterStart <= today ? Math.floor(diffDays(preferences.semesterStart, today) / 7) + 1 : null;

  const mark = async (slotId: string, status: AttendanceStatus | null) => {
    try {
      await setAttendance(slotId, selected, status);
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    }
  };

  const header = (
    <ScreenHeader
      large
      title={t('college.title')}
      eyebrow={preferences.semesterName ? (semesterWeek ? t('college.semesterWeek', { name: preferences.semesterName, week: semesterWeek }) : preferences.semesterName) : undefined}
      actions={
        <>
          <IconButton icon={Settings2} label={t('college.semester')} onPress={() => setSemesterOpen(true)} size={42} />
          <IconButton icon={Plus} label={t('college.addClass')} onPress={() => router.push({ pathname: '/create', params: { type: 'class' } })} variant="accent" size={42} />
        </>
      }
    />
  );

  return (
    <Screen header={header}>
      <View style={[styles.week, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        {week.map((date) => {
          const active = date === selected;
          const hasClass = data?.slots.some((slot) => slot.weekday === weekdayOf(date));
          return (
            <PressableScale
              key={date}
              onPress={() => setSelected(date)}
              haptic="selection"
              accessibilityState={{ selected: active }}
              accessibilityLabel={formatDate(date, 'full')}
              style={[styles.weekDay, active && { backgroundColor: palette.accent }]}
            >
              <Text variant="micro" color={active ? palette.onAccent : date === today ? palette.accentText : palette.textSecondary}>
                {weekdayName(weekdayOf(date), 'short')}
              </Text>
              <Text variant="h3" latin color={active ? palette.onAccent : palette.text}>
                {parseDateKey(date).day}
              </Text>
              <View style={[styles.dot, { backgroundColor: hasClass ? (active ? palette.onAccent : palette.tertiary) : 'transparent' }]} />
            </PressableScale>
          );
        })}
      </View>

      {!data ? (
        <LoadingState />
      ) : data.slots.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={t('college.emptyTitle')}
          message={t('college.emptyBody')}
          actionLabel={t('college.addClass')}
          onAction={() => router.push({ pathname: '/create', params: { type: 'class' } })}
        />
      ) : (
        <>
          {nextClass ? (
            <DSCard glow>
              <View style={styles.rowBetween}>
                <Pill label={t('college.nextClass')} tone="accent" />
                <Pill label={nextClass.at <= clock.now ? t('home.happeningNow') : formatRelative(nextClass.at - clock.now)} tone="solid" />
              </View>
              <Text variant="h2" style={styles.nextTitle}>
                {nextClass.slot.subject.name}
              </Text>
              <View style={styles.inline}>
                <Text variant="bodyStrong" tone="accent" latin>
                  {`${formatTime(nextClass.slot.startMinute)} – ${formatTime(nextClass.slot.endMinute)}`}
                </Text>
                {nextClass.date !== today ? (
                  <Text variant="small" tone="secondary">
                    {formatDate(nextClass.date, 'weekdayDay')}
                  </Text>
                ) : null}
                {nextClass.slot.room ? (
                  <View style={styles.inline}>
                    <MapPin size={14} color={palette.textSecondary} />
                    <Text variant="small" tone="secondary">
                      {nextClass.slot.room}
                    </Text>
                  </View>
                ) : null}
              </View>
            </DSCard>
          ) : null}

          <SectionHeader title={t('college.dailyTimeline')} right={<Text variant="small" tone="secondary">{tp('college.classes', daySlots.length)}</Text>} />
          {daySlots.length === 0 ? (
            <Text variant="body" tone="secondary">
              {t('college.noClassesDay')}
            </Text>
          ) : (
            daySlots.map((slot) => {
              const status = data.attendance[slot.id];
              const finished = selected < today || (selected === today && slot.endMinute <= clock.minute);
              const live = selected === today && slot.startMinute <= clock.minute && slot.endMinute > clock.minute;
              const color = slot.subject.color ?? palette.tertiary;
              return (
                <View key={slot.id} style={styles.slotRow}>
                  <View style={styles.slotTime}>
                    <Text variant="bodyStrong" latin tone={live ? 'accent' : 'primary'}>
                      {formatTime(slot.startMinute)}
                    </Text>
                    <Text variant="small" tone="muted" latin>
                      {formatTime(slot.endMinute)}
                    </Text>
                  </View>
                  <DSCard
                    style={styles.flex}
                    padding={space.md}
                    accentEdge={live ? palette.accent : undefined}
                    onPress={() => router.push({ pathname: '/create', params: { type: 'class', id: slot.id } })}
                    accessibilityLabel={slot.subject.name}
                  >
                    <View style={styles.rowBetween}>
                      <View style={styles.inlineShrink}>
                        <View style={[styles.subjectDot, { backgroundColor: color }]} />
                        <Text variant="title" numberOfLines={1} strike={status === 'cancelled'} style={styles.flexShrink}>
                          {slot.subject.name}
                        </Text>
                      </View>
                      {live ? <Pill label={t('college.live')} tone="solid" /> : status ? <Pill label={t(`attendance.${status}` as TKey)} tone={status === 'present' ? 'accent' : 'muted'} /> : <Pill label={t(`slot.${slot.slotType}` as TKey)} tone="muted" />}
                    </View>
                    <Text variant="small" tone="secondary" numberOfLines={1}>
                      {[slot.room, slot.subject.professor].filter(Boolean).join(' · ') || t(`slot.${slot.slotType}` as TKey)}
                    </Text>
                    {finished || live ? (
                      <View style={styles.attendance}>
                        <DSChip label={t('attendance.present')} icon={Check} selected={status === 'present'} onPress={() => mark(slot.id, status === 'present' ? null : 'present')} size="sm" />
                        <DSChip label={t('attendance.absent')} icon={X} selected={status === 'absent'} onPress={() => mark(slot.id, status === 'absent' ? null : 'absent')} size="sm" />
                        <DSChip label={t('attendance.cancelled')} icon={CircleSlash} selected={status === 'cancelled'} onPress={() => mark(slot.id, status === 'cancelled' ? null : 'cancelled')} size="sm" />
                      </View>
                    ) : null}
                  </DSCard>
                </View>
              );
            })
          )}
        </>
      )}

      {data && exams.length > 0 ? (
        <View style={styles.examRow}>
          {exams.map((exam) => {
            const days = diffDays(today, exam.dueDate);
            return (
              <DSCard key={exam.id} style={styles.flex}>
                <Text variant="label" tone="secondary">
                  {t(`assignmentKind.${exam.kind}` as TKey)}
                </Text>
                <Text variant="statLarge" latin tone={days <= 7 ? 'accent' : 'primary'}>
                  {String(Math.max(0, days)).padStart(2, '0')}
                </Text>
                <Text variant="label" tone="secondary">
                  {days === 0 ? t('college.today') : t('college.daysLeft')}
                </Text>
                <Text variant="small" numberOfLines={1}>
                  {exam.subjectName ?? exam.title}
                </Text>
              </DSCard>
            );
          })}
        </View>
      ) : null}

      {data ? (
        <DSCard>
          <View style={styles.rowBetween}>
            <Text variant="label" tone="secondary">
              {t('college.deadlines')}
            </Text>
            <PressableScale onPress={() => setAssignmentOpen(true)} accessibilityLabel={t('college.addDeadline')} hitSlop={10}>
              <Text variant="smallStrong" tone="accent">
                {t('college.addDeadline')}
              </Text>
            </PressableScale>
          </View>
          {data.assignments.length === 0 ? (
            <Text variant="small" tone="muted" style={styles.spacer}>
              {t('college.noDeadlines')}
            </Text>
          ) : (
            data.assignments.map((item) => {
              const days = diffDays(today, item.dueDate);
              return (
                <View key={item.id} style={[styles.deadline, { backgroundColor: palette.surfaceAlt }]}>
                  <AnimatedCheckbox checked={false} onToggle={() => setAssignmentCompleted(item.id, true, today).then(() => toast(t('college.deadlineDone')))} label={t('tasks.markDone', { title: item.title })} size={22} />
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text variant="small" tone={days <= 1 ? 'danger' : 'secondary'}>
                      {[item.subjectName, days < 0 ? t('college.overdue') : days === 0 ? t('college.dueToday') : days === 1 ? t('college.dueTomorrow') : t('college.dueIn', { count: days }), item.dueMinute != null ? formatTime(item.dueMinute) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <IconButton
                    icon={Trash2}
                    label={t('common.delete')}
                    variant="plain"
                    size={36}
                    onPress={async () => {
                      if (await confirm({ title: t('common.deleteConfirmTitle'), confirmLabel: t('common.delete'), destructive: true })) await deleteAssignment(item.id);
                    }}
                  />
                </View>
              );
            })
          )}
        </DSCard>
      ) : null}

      {data && data.summary.length > 0 ? (
        <DSCard>
          <View style={styles.rowBetween}>
            <View>
              <Text variant="label" tone="secondary">
                {t('college.attendance')}
              </Text>
              <Text variant="h3">{overall == null ? t('college.noAttendance') : t('college.overall', { percent: formatPercent(overall) })}</Text>
            </View>
            {overall != null ? <Pill label={overall >= 0.75 ? t('college.safe') : t('college.atRisk')} tone={overall >= 0.75 ? 'tertiary' : 'danger'} /> : null}
          </View>
          {overall != null ? <ProgressBar progress={overall} style={styles.spacer} /> : null}
          <View style={styles.subjects}>
            {data.summary.map((item) => (
              <View key={item.subjectId} style={[styles.subjectCell, { backgroundColor: palette.surfaceAlt }]}>
                <Text variant="h3" latin tone={item.ratio != null && item.ratio * 100 < item.target ? 'danger' : 'accent'}>
                  {item.ratio == null ? '—' : formatPercent(item.ratio)}
                </Text>
                <Text variant="small" tone="secondary" numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
            ))}
          </View>
        </DSCard>
      ) : null}

      <PremiumButton label={t('college.addClass')} icon={Plus} onPress={() => router.push({ pathname: '/create', params: { type: 'class' } })} />
      <AssignmentSheet visible={assignmentOpen} onClose={() => setAssignmentOpen(false)} subjects={data?.subjects ?? []} today={today} />
      <SemesterSheet
        visible={semesterOpen}
        onClose={() => setSemesterOpen(false)}
        name={preferences.semesterName}
        start={preferences.semesterStart}
        today={today}
        onSave={(semesterName, semesterStart) => {
          void setPreferences({ semesterName, semesterStart });
          setSemesterOpen(false);
        }}
      />
    </Screen>
  );
}

function AssignmentSheet({ visible, onClose, subjects, today }: { visible: boolean; onClose: () => void; subjects: { id: string; name: string }[]; today: DateKey }) {
  const { t, formatDate, formatTime } = useI18n();
  const { toast } = useFeedback();
  const [kind, setKind] = useState<AssignmentKind>('assignment');
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [due, setDue] = useState(addDays(today, 3));
  const [minute, setMinute] = useState<number>(23 * 60 + 59);
  const [reminders, setReminders] = useState<number[]>([1440, 60]);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const check = validateTitle(title);
    if (!check.ok) {
      setError(t(check.error));
      return;
    }
    try {
      await createAssignment({ subjectId, kind, title: check.value, notes: null, dueDate: due, dueMinute: minute, reminderOffsets: reminders });
      toast(t('college.deadlineAdded'));
      setTitle('');
      setError(null);
      onClose();
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    }
  };

  return (
    <DSBottomSheet visible={visible} onClose={onClose} title={t('college.addDeadline')} footer={<PremiumButton label={t('common.save')} icon={ClipboardList} onPress={save} />}>
      <View style={styles.chipsWrap}>
        {(['assignment', 'project', 'exam', 'quiz'] as AssignmentKind[]).map((value) => (
          <DSChip key={value} label={t(`assignmentKind.${value}` as TKey)} selected={kind === value} onPress={() => setKind(value)} size="sm" />
        ))}
      </View>
      <DSInput label={t('create.titleLabel')} placeholder={t('college.deadlinePlaceholder')} value={title} onChangeText={setTitle} maxLength={LIMITS.title} error={error} />
      {subjects.length ? (
        <View style={styles.chipsWrap}>
          {subjects.map((subject) => (
            <DSChip key={subject.id} label={subject.name} selected={subjectId === subject.id} onPress={() => setSubjectId(subjectId === subject.id ? null : subject.id)} size="sm" />
          ))}
        </View>
      ) : null}
      <View style={styles.inlineGap}>
        <PickerField label={t('create.dueDate')} value={formatDate(due, 'medium')} onPress={() => setPicker('date')} />
        <PickerField icon="time" label={t('create.time')} value={formatTime(minute)} onPress={() => setPicker('time')} />
      </View>
      <ReminderPicker value={reminders} onChange={setReminders} />
      <DatePickerSheet visible={picker === 'date'} value={due} minDate={today} onClose={() => setPicker(null)} onChange={setDue} />
      <TimePickerSheet visible={picker === 'time'} value={minute} onClose={() => setPicker(null)} onChange={setMinute} />
    </DSBottomSheet>
  );
}

function SemesterSheet({ visible, onClose, name, start, today, onSave }: { visible: boolean; onClose: () => void; name: string; start: string | null; today: DateKey; onSave: (name: string, start: string | null) => void }) {
  const { t, formatDate } = useI18n();
  const [value, setValue] = useState(name);
  const [date, setDate] = useState<string | null>(start);
  const [picking, setPicking] = useState(false);
  return (
    <DSBottomSheet visible={visible} onClose={onClose} title={t('college.semester')} footer={<PremiumButton label={t('common.save')} onPress={() => onSave(value.trim().slice(0, 40), date)} />}>
      <DSInput label={t('college.semesterName')} placeholder={t('college.semesterPlaceholder')} value={value} onChangeText={setValue} maxLength={40} />
      <PickerField label={t('college.semesterStart')} value={date ? formatDate(date, 'medium') : t('common.none')} placeholder={!date} onPress={() => setPicking(true)} />
      <DatePickerSheet visible={picking} value={date ?? today} onClose={() => setPicking(false)} onChange={setDate} />
    </DSBottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  inlineShrink: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  inlineGap: { flexDirection: 'row', gap: space.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  week: { flexDirection: 'row', borderRadius: radius.lg, padding: 6, borderWidth: StyleSheet.hairlineWidth },
  weekDay: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.md, gap: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  nextTitle: { marginVertical: space.sm },
  slotRow: { flexDirection: 'row', gap: space.md },
  slotTime: { width: 64, paddingTop: space.md },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },
  attendance: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm },
  examRow: { flexDirection: 'row', gap: space.sm },
  deadline: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.md, paddingVertical: space.xs, borderRadius: radius.md, marginTop: space.sm },
  spacer: { marginTop: space.md },
  subjects: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  subjectCell: { width: '31.5%', padding: space.md, borderRadius: radius.md, alignItems: 'center', gap: 2 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
