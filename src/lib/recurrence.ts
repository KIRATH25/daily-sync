/**
 * Recurrence rules for calendar entries, tasks and classes.
 *
 * A deliberately small subset of RFC 5545 RRULE semantics that covers what
 * people actually set in a personal planner:
 *   - daily / weekly / monthly / yearly with an interval
 *   - weekly rules may list specific weekdays (Mon, Wed, Fri…)
 *   - optional end date (`until`, inclusive) or occurrence `count`
 *   - per-series exception dates (a single deleted occurrence)
 *
 * Monthly rules anchored on the 29th–31st skip months that lack that day,
 * and yearly rules anchored on Feb 29 only occur in leap years, matching
 * RFC 5545 behaviour (rather than silently drifting to the 28th).
 */
import {
  addDays,
  dateKeyToEpochDay,
  daysInMonth,
  diffDays,
  isDateKey,
  makeDateKey,
  parseDateKey,
  weekdayOf,
  type DateKey,
} from './dates';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  freq: RecurrenceFrequency;
  /** Every N periods. 1 = every day/week/month/year. */
  interval: number;
  /** Weekly only. 0 = Sunday … 6 = Saturday. Defaults to the start weekday. */
  byWeekday?: number[];
  /** Inclusive last date. */
  until?: DateKey | null;
  /** Total number of occurrences including the first. */
  count?: number | null;
}

export const MAX_COUNT = 1000;
const MAX_ITERATIONS = 20_000;

export function validateRecurrence(rule: RecurrenceRule, startKey: DateKey): string | null {
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(rule.freq)) return 'recurrence.invalidFrequency';
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 365) return 'recurrence.invalidInterval';
  if (rule.byWeekday) {
    if (rule.freq !== 'weekly') return 'recurrence.weekdaysOnlyWeekly';
    if (rule.byWeekday.length === 0) return 'recurrence.pickWeekday';
    if (rule.byWeekday.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return 'recurrence.invalidWeekday';
  }
  if (rule.until != null) {
    if (!isDateKey(rule.until)) return 'recurrence.invalidUntil';
    if (rule.until < startKey) return 'recurrence.untilBeforeStart';
  }
  if (rule.count != null && (!Number.isInteger(rule.count) || rule.count < 1 || rule.count > MAX_COUNT)) {
    return 'recurrence.invalidCount';
  }
  return null;
}

function weekdaysFor(rule: RecurrenceRule, startKey: DateKey): number[] {
  const days = rule.byWeekday && rule.byWeekday.length > 0 ? rule.byWeekday : [weekdayOf(startKey)];
  return [...new Set(days)].sort((a, b) => a - b);
}

/**
 * Yields occurrences in ascending order starting at `startKey`, never earlier
 * than `fromKey`. When the rule has no `count`, whole periods before `fromKey`
 * are skipped arithmetically so far-future lookups stay cheap.
 */
function* iterate(startKey: DateKey, rule: RecurrenceRule, fromKey: DateKey): Generator<DateKey> {
  const canSkip = rule.count == null;
  const start = parseDateKey(startKey);
  let emitted = 0;
  let guard = 0;

  const accept = (key: DateKey): 'yield' | 'skip' | 'stop' => {
    if (rule.until && key > rule.until) return 'stop';
    if (rule.count != null && emitted >= rule.count) return 'stop';
    emitted += 1;
    return key >= fromKey ? 'yield' : 'skip';
  };

  switch (rule.freq) {
    case 'daily': {
      let index = 0;
      if (canSkip && fromKey > startKey) {
        index = Math.ceil(diffDays(startKey, fromKey) / rule.interval);
      }
      while (guard++ < MAX_ITERATIONS) {
        const key = addDays(startKey, index * rule.interval);
        const verdict = accept(key);
        if (verdict === 'stop') return;
        if (verdict === 'yield') yield key;
        index += 1;
      }
      return;
    }
    case 'weekly': {
      const days = weekdaysFor(rule, startKey);
      // Anchor weeks on the Sunday of the start week so intervals line up.
      const anchor = addDays(startKey, -weekdayOf(startKey));
      let week = 0;
      if (canSkip && fromKey > startKey) {
        const weeksAhead = Math.floor(diffDays(anchor, fromKey) / 7);
        week = Math.max(0, Math.floor(weeksAhead / rule.interval) * rule.interval);
      }
      while (guard++ < MAX_ITERATIONS) {
        const weekStart = addDays(anchor, week * 7);
        for (const day of days) {
          const key = addDays(weekStart, day);
          if (key < startKey) continue;
          const verdict = accept(key);
          if (verdict === 'stop') return;
          if (verdict === 'yield') yield key;
        }
        week += rule.interval;
      }
      return;
    }
    case 'monthly': {
      let step = 0;
      if (canSkip && fromKey > startKey) {
        const from = parseDateKey(fromKey);
        const monthsAhead = (from.year - start.year) * 12 + (from.month - start.month);
        step = Math.max(0, Math.floor(monthsAhead / rule.interval) * rule.interval);
      }
      while (guard++ < MAX_ITERATIONS) {
        const zeroBased = start.month - 1 + step;
        const year = start.year + Math.floor(zeroBased / 12);
        const month = (zeroBased % 12) + 1;
        if (start.day <= daysInMonth(year, month)) {
          const key = makeDateKey(year, month, start.day);
          const verdict = accept(key);
          if (verdict === 'stop') return;
          if (verdict === 'yield') yield key;
        } else if (rule.until && makeDateKey(year, month, 1) > rule.until) {
          return;
        }
        step += rule.interval;
      }
      return;
    }
    case 'yearly': {
      let step = 0;
      if (canSkip && fromKey > startKey) {
        const from = parseDateKey(fromKey);
        step = Math.max(0, Math.floor((from.year - start.year) / rule.interval) * rule.interval);
      }
      while (guard++ < MAX_ITERATIONS) {
        const year = start.year + step;
        if (start.day <= daysInMonth(year, start.month)) {
          const key = makeDateKey(year, start.month, start.day);
          const verdict = accept(key);
          if (verdict === 'stop') return;
          if (verdict === 'yield') yield key;
        } else if (rule.until && makeDateKey(year, 12, 31) > rule.until) {
          return;
        }
        step += rule.interval;
      }
      return;
    }
  }
}

/** All occurrence dates within [fromKey, toKey], excluding exception dates. */
export function occurrencesInRange(
  startKey: DateKey,
  rule: RecurrenceRule | null,
  fromKey: DateKey,
  toKey: DateKey,
  exceptions: ReadonlySet<DateKey> = new Set(),
): DateKey[] {
  if (toKey < fromKey) return [];
  if (!rule) {
    return startKey >= fromKey && startKey <= toKey && !exceptions.has(startKey) ? [startKey] : [];
  }
  const result: DateKey[] = [];
  for (const key of iterate(startKey, rule, fromKey)) {
    if (key > toKey) break;
    if (!exceptions.has(key)) result.push(key);
  }
  return result;
}

export function occursOn(
  startKey: DateKey,
  rule: RecurrenceRule | null,
  dateKey: DateKey,
  exceptions: ReadonlySet<DateKey> = new Set(),
): boolean {
  return occurrencesInRange(startKey, rule, dateKey, dateKey, exceptions).length > 0;
}

/** First occurrence on or after `fromKey`, or null when the series has ended. */
export function nextOccurrence(
  startKey: DateKey,
  rule: RecurrenceRule | null,
  fromKey: DateKey,
  exceptions: ReadonlySet<DateKey> = new Set(),
): DateKey | null {
  if (!rule) return startKey >= fromKey && !exceptions.has(startKey) ? startKey : null;
  for (const key of iterate(startKey, rule, fromKey)) {
    if (!exceptions.has(key)) return key;
  }
  return null;
}

export function parseRecurrence(json: string | null | undefined): RecurrenceRule | null {
  if (!json) return null;
  try {
    const value: unknown = JSON.parse(json);
    if (!value || typeof value !== 'object') return null;
    const rule = value as Partial<RecurrenceRule>;
    if (!rule.freq || typeof rule.interval !== 'number') return null;
    return {
      freq: rule.freq,
      interval: rule.interval,
      byWeekday: Array.isArray(rule.byWeekday) ? rule.byWeekday.filter((day) => typeof day === 'number') : undefined,
      until: typeof rule.until === 'string' ? rule.until : null,
      count: typeof rule.count === 'number' ? rule.count : null,
    };
  } catch {
    return null;
  }
}

export function serializeRecurrence(rule: RecurrenceRule | null): string | null {
  return rule ? JSON.stringify(rule) : null;
}

/** Stable epoch-day ordering helper for tests and sorting. */
export function epochDay(key: DateKey): number {
  return dateKeyToEpochDay(key);
}
