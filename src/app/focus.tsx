import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Coffee, Pause, Play, RotateCcw, Square, Target, Timer } from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { Pill, Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { readPreference, savePreference } from '@/db/repositories/preferencesRepo';
import { focusSecondsByDay, listFocusSessions, recordFocusSession } from '@/db/repositories/focusRepo';
import { listOpenTasksDueBy } from '@/db/repositories/tasksRepo';
import { useClock } from '@/hooks/useClock';
import { useHaptics } from '@/hooks/useHaptics';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useTicker } from '@/hooks/useTicker';
import { useI18n, type TKey } from '@/i18n';
import { formatClock } from '@/lib/format';
import { elapsedMs, endsAt, nextBreak, pause, remainingMs, resume, type ActiveFocus } from '@/lib/focusTimer';
import { todayKey } from '@/lib/timezone';
import { CHANNEL_REMINDERS } from '@/services/notifications';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import type { FocusMode } from '@/types/models';

const ACTIVE_KEY = 'focus.active';
type Kind = 'pomodoro' | 'custom' | 'stopwatch';
const CUSTOM_MINUTES = [10, 15, 20, 30, 45, 60, 90];

export default function FocusScreen() {
  const params = useLocalSearchParams<{ minutes?: string; label?: string; taskId?: string }>();
  const palette = usePalette();
  const { t, formatDuration, formatInstant, formatPercent } = useI18n();
  const { preferences } = usePreferences();
  const { toast } = useFeedback();
  const { fire } = useHaptics();
  const today = useClock().dateKey;
  const now = useTicker(1000);
  const presetMinutes = Number(params.minutes);
  const [kind, setKind] = useState<Kind>(presetMinutes > 0 ? 'custom' : 'pomodoro');
  const [customMinutes, setCustomMinutes] = useState(presetMinutes > 0 && presetMinutes <= 180 ? presetMinutes : 30);
  const [active, setActive] = useState<ActiveFocus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(params.taskId ?? null);
  const [label, setLabel] = useState<string | null>(params.label ?? null);
  const [pendingBreak, setPendingBreak] = useState<'short_break' | 'long_break' | null>(null);
  /** Focus rounds completed in the current pomodoro cycle. */
  const [round, setRound] = useState(0);
  const finishing = useRef(false);

  const stats = useLiveQuery(
    async () => {
      const [byDay, sessions, tasks] = await Promise.all([focusSecondsByDay(today, today), listFocusSessions(today, today), listOpenTasksDueBy(today)]);
      return { seconds: byDay[today] ?? 0, sessions, tasks };
    },
    ['focus_sessions', 'tasks'],
    [today],
  );

  const persist = useCallback(async (state: ActiveFocus | null) => {
    setActive(state);
    await savePreference(ACTIVE_KEY, state);
  }, []);

  const scheduleEndAlert = async (state: ActiveFocus): Promise<string | null> => {
    const end = endsAt(state, Date.now());
    if (!end) return null;
    try {
      return await Notifications.scheduleNotificationAsync({
        content: { title: t(state.mode === 'focus' ? 'focus.doneTitle' : 'focus.breakDoneTitle'), body: state.label ?? t('focus.doneBody'), data: { route: '/focus', category: 'system' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: end, channelId: CHANNEL_REMINDERS },
      });
    } catch {
      return null;
    }
  };
  const cancelAlert = async (state: ActiveFocus | null) => {
    if (state?.notificationId) await Notifications.cancelScheduledNotificationAsync(state.notificationId).catch(() => undefined);
  };

  // Restore a running/paused timer.
  useEffect(() => {
    readPreference<ActiveFocus>(ACTIVE_KEY)
      .then((state) => {
        if (state && typeof state.startedAt === 'number') {
          setActive(state);
          setRound(state.round ?? 0);
          setKind(state.mode === 'stopwatch' ? 'stopwatch' : state.plannedSeconds === preferences.focusMinutes * 60 || state.mode !== 'focus' ? 'pomodoro' : 'custom');
        }
      })
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const complete = useCallback(
    async (state: ActiveFocus, completed: boolean) => {
      if (finishing.current) return;
      finishing.current = true;
      try {
        const end = Date.now();
        const actual = Math.round((completed && state.plannedSeconds ? state.plannedSeconds * 1000 : elapsedMs(state, end)) / 1000);
        await recordFocusSession({
          mode: state.mode,
          taskId: state.taskId,
          label: state.label,
          plannedSeconds: state.plannedSeconds,
          actualSeconds: actual,
          startedAt: state.startedAt,
          endedAt: end,
          completed,
          date: todayKey(preferences.timeZone, state.startedAt),
        });
        await cancelAlert(state);
        await persist(null);
        if (completed && state.mode === 'focus' && kind === 'pomodoro') {
          const done = state.round + 1;
          setRound(done);
          setPendingBreak(nextBreak(done, preferences.roundsBeforeLongBreak));
        }
        if (completed && state.mode === 'long_break') setRound(0);
        if (completed) {
          fire('success');
          toast(state.mode === 'focus' || state.mode === 'stopwatch' ? t('focus.sessionSaved', { time: formatDuration(actual) }) : t('focus.breakOver'));
        }
      } catch {
        toast(t('error.saveFailed'), { tone: 'error' });
      } finally {
        finishing.current = false;
      }
    },
    [kind, preferences.roundsBeforeLongBreak, preferences.timeZone, persist, fire, toast, t, formatDuration],
  );

  // Complete exactly when the real clock reaches the end. If the timer already
  // ran out while the app was closed, this fires immediately on return.
  useEffect(() => {
    if (!active || active.pausedAt || active.plannedSeconds == null) return;
    const timer = setTimeout(() => void complete(active, true), remainingMs(active, Date.now()) ?? 0);
    return () => clearTimeout(timer);
  }, [active, complete]);

  const start = async (mode: FocusMode, seconds: number | null) => {
    setPendingBreak(null);
    const state: ActiveFocus = { mode, plannedSeconds: seconds, startedAt: Date.now(), pausedAt: null, pausedMs: 0, taskId: mode === 'focus' || mode === 'stopwatch' ? taskId : null, label: mode === 'focus' || mode === 'stopwatch' ? label : null, round: mode === 'long_break' ? 0 : round, notificationId: null };
    state.notificationId = await scheduleEndAlert(state);
    fire('medium');
    await persist(state);
  };

  const togglePause = async () => {
    if (!active) return;
    if (active.pausedAt) {
      const resumed = resume(active, Date.now());
      resumed.notificationId = await scheduleEndAlert(resumed);
      await persist(resumed);
    } else {
      await cancelAlert(active);
      await persist({ ...pause(active, Date.now()), notificationId: null });
    }
  };

  const goal = preferences.dailyFocusGoalMinutes * 60;
  const todaySeconds = stats.data?.seconds ?? 0;
  const elapsed = active ? elapsedMs(active, now) : 0;
  const remaining = active ? remainingMs(active, now) : null;
  const planned = active?.plannedSeconds ?? (kind === 'pomodoro' ? preferences.focusMinutes * 60 : kind === 'custom' ? customMinutes * 60 : null);
  const ringProgress = active && active.plannedSeconds ? elapsed / (active.plannedSeconds * 1000) : 0;
  const display = active ? (remaining != null ? formatClock(remaining) : formatClock(elapsed)) : planned ? formatClock(planned * 1000) : '00:00';
  const modeLabel = active ? t(`focusMode.${active.mode}` as TKey) : t(`focus.kind.${kind}` as TKey);

  const header = <ScreenHeader title={t('focus.title')} />;

  return (
    <Screen header={header}>
      {!active ? (
        <Segmented<Kind>
          options={[
            { value: 'pomodoro', label: t('focus.kind.pomodoro') },
            { value: 'custom', label: t('focus.kind.custom') },
            { value: 'stopwatch', label: t('focus.kind.stopwatch') },
          ]}
          value={kind}
          onChange={setKind}
        />
      ) : null}

      <DSCard glow>
        <View style={styles.center}>
          <Pill label={active?.pausedAt ? t('focus.paused') : modeLabel} tone={active && !active.pausedAt ? 'solid' : 'muted'} />
          <ProgressRing progress={ringProgress} size={232} stroke={12} color={active?.mode === 'short_break' || active?.mode === 'long_break' ? palette.tertiary : palette.accent}>
            <Text variant="statLarge" latin accessibilityRole="timer" accessibilityLiveRegion="none">
              {display}
            </Text>
            {active ? (
              <Text variant="small" tone="secondary">
                {t('focus.startedAt', { time: formatInstant(active.startedAt) })}
              </Text>
            ) : null}
          </ProgressRing>
          {active?.label ? (
            <Text variant="title" align="center" numberOfLines={2}>
              {active.label}
            </Text>
          ) : null}
          {kind === 'pomodoro' && round > 0 ? (
            <Text variant="small" tone="secondary">
              {t('focus.round', { done: round, total: preferences.roundsBeforeLongBreak })}
            </Text>
          ) : null}
        </View>
        <View style={styles.controls}>
          {!loaded ? null : active ? (
            <>
              <PremiumButton label={active.pausedAt ? t('focus.resume') : t('focus.pause')} icon={active.pausedAt ? Play : Pause} variant="secondary" onPress={togglePause} style={styles.flex} />
              <PremiumButton
                label={active.mode === 'stopwatch' ? t('focus.save') : t('focus.stop')}
                icon={Square}
                variant={active.mode === 'stopwatch' ? 'primary' : 'danger'}
                onPress={() => complete(active, active.mode === 'stopwatch')}
                style={styles.flex}
              />
            </>
          ) : pendingBreak ? (
            <>
              <PremiumButton
                label={t(pendingBreak === 'long_break' ? 'focus.startLongBreak' : 'focus.startShortBreak')}
                icon={Coffee}
                onPress={() => start(pendingBreak, (pendingBreak === 'long_break' ? preferences.longBreakMinutes : preferences.shortBreakMinutes) * 60)}
                style={styles.flex}
              />
              <PremiumButton label={t('focus.skipBreak')} icon={RotateCcw} variant="secondary" fullWidth={false} onPress={() => setPendingBreak(null)} />
            </>
          ) : (
            <PremiumButton label={t('focus.start')} icon={Play} onPress={() => start(kind === 'stopwatch' ? 'stopwatch' : 'focus', planned)} />
          )}
        </View>
      </DSCard>

      {!active && kind === 'custom' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
          {CUSTOM_MINUTES.map((minutes) => (
            <DSChip key={minutes} label={t('focus.minutesChip', { m: minutes })} selected={customMinutes === minutes} onPress={() => setCustomMinutes(minutes)} />
          ))}
        </ScrollView>
      ) : null}

      {!active && stats.data && stats.data.tasks.length > 0 ? (
        <>
          <SectionHeader title={t('focus.linkTask')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
            <DSChip label={t('focus.noTask')} selected={taskId === null} onPress={() => { setTaskId(null); setLabel(params.label ?? null); }} size="sm" />
            {stats.data.tasks.slice(0, 10).map((task) => (
              <DSChip key={task.id} label={task.title} selected={taskId === task.id} onPress={() => { setTaskId(task.id); setLabel(task.title); }} size="sm" />
            ))}
          </ScrollView>
        </>
      ) : null}

      <DSCard>
        <View style={styles.rowBetween}>
          <View style={styles.inline}>
            <Target size={18} color={palette.accentText} />
            <Text variant="label" tone="secondary">
              {t('focus.dailyGoal')}
            </Text>
          </View>
          <Text variant="smallStrong" tone="accent">
            {`${formatDuration(todaySeconds)} / ${formatDuration(goal)}`}
          </Text>
        </View>
        <ProgressBar progress={todaySeconds / goal} style={styles.spaced} />
        <Text variant="small" tone="secondary" style={styles.spacedSm}>
          {todaySeconds >= goal ? t('focus.goalMet') : t('focus.goalLeft', { percent: formatPercent(todaySeconds / goal) })}
        </Text>
      </DSCard>

      <SectionHeader title={t('focus.history')} />
      {(stats.data?.sessions ?? []).length === 0 ? (
        <Text variant="small" tone="muted">
          {t('focus.noHistory')}
        </Text>
      ) : (
        stats.data?.sessions.map((session) => (
          <View key={session.id} style={[styles.history, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Timer size={16} color={session.completed ? palette.accentText : palette.textMuted} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {session.label ?? t(`focusMode.${session.mode}` as TKey)}
              </Text>
              <Text variant="small" tone="secondary">
                {`${formatInstant(session.startedAt)} · ${session.completed ? t('focus.completed') : t('focus.stoppedEarly')}`}
              </Text>
            </View>
            <Text variant="bodyStrong" latin>
              {formatDuration(session.actualSeconds)}
            </Text>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  center: { alignItems: 'center', gap: space.md },
  controls: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  chipScroll: { marginHorizontal: -space.gutter, flexGrow: 0 },
  chips: { gap: space.sm, paddingHorizontal: space.gutter },
  spaced: { marginTop: space.md },
  spacedSm: { marginTop: space.sm },
  history: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
});
