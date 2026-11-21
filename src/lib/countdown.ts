/**
 * Countdown maths. Always derived from the absolute target instant and the
 * current clock — never from an accumulating interval — so values remain
 * exact after the app is backgrounded, the device sleeps, or frames drop.
 */

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isPast: boolean;
}

export function countdownParts(targetMs: number, nowMs: number): CountdownParts {
  const delta = targetMs - nowMs;
  const isPast = delta <= 0;
  const remaining = Math.abs(delta);
  // Floor towards the target so the display never shows "0 sec" early.
  const totalSeconds = isPast ? Math.floor(remaining / 1000) : Math.ceil(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs: delta,
    isPast,
  };
}

/** Fraction of the journey from creation to target that has elapsed (0–1). */
export function countdownProgress(createdMs: number, targetMs: number, nowMs: number): number {
  const span = targetMs - createdMs;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (nowMs - createdMs) / span));
}

/**
 * How often the UI must refresh to stay accurate: every second when seconds
 * are visible, otherwise at the next minute boundary.
 */
export function nextTickDelay(targetMs: number, nowMs: number, showSeconds: boolean): number {
  const unit = showSeconds ? 1000 : 60_000;
  const delta = targetMs - nowMs;
  // Counting down (ceil): the value changes when the remainder hits zero.
  if (delta > 0) return (delta % unit || unit) + 16;
  // Counting up after the target (floor): changes at the next whole unit.
  return unit - (-delta % unit) + 16;
}
