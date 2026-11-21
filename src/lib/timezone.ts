/**
 * Time-zone conversion between absolute instants and wall-clock values.
 *
 * Timed entries are stored as wall-clock values (date key + minute of day)
 * in the user's preferred zone, defaulting to Asia/Kolkata. An absolute
 * instant is only derived when we must interact with the outside world:
 * scheduling an OS notification, or counting down to a moment. Keeping the
 * stored value zone-independent means a 09:00 class stays a 09:00 class.
 *
 * Implemented on top of `Intl.DateTimeFormat`, which Hermes supports, so we
 * avoid shipping a full tz database.
 */
import { addDays, makeDateKey, parseDateKey, type DateKey } from './dates';

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone).format(0);
    return true;
  } catch {
    return false;
  }
}

function zonedParts(instant: number, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(instant));
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    return part ? Number(part.value) : 0;
  };
  // Some engines render midnight as "24" even with h23.
  const hour = read('hour') % 24;
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour,
    minute: read('minute'),
    second: read('second'),
  };
}

export interface WallClock {
  dateKey: DateKey;
  /** Minutes since local midnight, 0–1439. */
  minute: number;
  second: number;
}

export function instantToWallClock(instant: number, timeZone: string): WallClock {
  const parts = zonedParts(instant, timeZone);
  return {
    dateKey: makeDateKey(parts.year, parts.month, parts.day),
    minute: parts.hour * 60 + parts.minute,
    second: parts.second,
  };
}

/** Offset of `timeZone` from UTC at `instant`, in minutes (IST → +330). */
export function offsetMinutesAt(instant: number, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const truncated = instant - (((instant % 1000) + 1000) % 1000);
  return Math.round((asUtc - truncated) / 60_000);
}

/**
 * Wall-clock time in `timeZone` → absolute instant (ms).
 *
 * Uses the standard two-pass offset correction so it stays correct across
 * DST transitions in zones that have them. For a non-existent local time
 * (spring-forward gap) the result lands just after the gap.
 */
export function wallClockToInstant(dateKey: DateKey, minuteOfDay: number, timeZone: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  const naiveUtc = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  const firstOffset = offsetMinutesAt(naiveUtc, timeZone);
  let instant = naiveUtc - firstOffset * 60_000;
  const secondOffset = offsetMinutesAt(instant, timeZone);
  if (secondOffset !== firstOffset) {
    instant = naiveUtc - secondOffset * 60_000;
  }
  return instant;
}

export function todayKey(timeZone: string, now: number = Date.now()): DateKey {
  return instantToWallClock(now, timeZone).dateKey;
}

export function yesterdayKey(timeZone: string, now: number = Date.now()): DateKey {
  return addDays(todayKey(timeZone, now), -1);
}

/**
 * Next instant at which the wall clock in `timeZone` reads `minuteOfDay`,
 * strictly after `now`. Used for the daily mood reminder and habit nudges.
 */
export function nextDailyOccurrence(minuteOfDay: number, timeZone: string, now: number = Date.now()): number {
  const today = todayKey(timeZone, now);
  const candidate = wallClockToInstant(today, minuteOfDay, timeZone);
  if (candidate > now) return candidate;
  return wallClockToInstant(addDays(today, 1), minuteOfDay, timeZone);
}

/** Device zone if the runtime exposes one, otherwise the app default. */
export function deviceTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}
