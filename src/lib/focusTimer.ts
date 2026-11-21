/**
 * Focus timer state machine. The timer is defined entirely by timestamps —
 * start, optional pause start, accumulated paused time — and elapsed time is
 * always computed from the real clock. No interval or animation frame is
 * ever used as the source of truth, so the timer stays exact across app
 * restarts, backgrounding and device sleep.
 */
import type { FocusMode } from '@/types/models';

export interface ActiveFocus {
  mode: FocusMode;
  /** null for the stopwatch */
  plannedSeconds: number | null;
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
  taskId: string | null;
  label: string | null;
  /** Completed focus rounds in the current pomodoro cycle */
  round: number;
  notificationId: string | null;
}

export function elapsedMs(state: ActiveFocus, now: number): number {
  const end = state.pausedAt ?? now;
  return Math.max(0, end - state.startedAt - state.pausedMs);
}

export function remainingMs(state: ActiveFocus, now: number): number | null {
  if (state.plannedSeconds == null) return null;
  return Math.max(0, state.plannedSeconds * 1000 - elapsedMs(state, now));
}

export function isFinished(state: ActiveFocus, now: number): boolean {
  const remaining = remainingMs(state, now);
  return remaining !== null && remaining <= 0;
}

export function pause(state: ActiveFocus, now: number): ActiveFocus {
  return state.pausedAt ? state : { ...state, pausedAt: now };
}

export function resume(state: ActiveFocus, now: number): ActiveFocus {
  if (!state.pausedAt) return state;
  return { ...state, pausedMs: state.pausedMs + (now - state.pausedAt), pausedAt: null };
}

/** Instant at which a running countdown will finish, or null. */
export function endsAt(state: ActiveFocus, now: number): number | null {
  const remaining = remainingMs(state, now);
  if (remaining == null || state.pausedAt) return null;
  return now + remaining;
}

/** What follows a finished focus round in a pomodoro cycle. */
export function nextBreak(round: number, roundsBeforeLong: number): 'short_break' | 'long_break' {
  return round > 0 && round % roundsBeforeLong === 0 ? 'long_break' : 'short_break';
}
