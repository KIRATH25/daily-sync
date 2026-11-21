/**
 * Calendar-date arithmetic on plain `YYYY-MM-DD` keys.
 *
 * Daily Sync stores calendar days as date keys rather than timestamps. A date
 * key has no time zone: "2025-11-21" is the same calendar day for every user,
 * which is exactly what all-day events, mood check-ins, habit logs and streaks
 * need. Converting such a value to a UTC instant (the classic bug) would make
 * an entry jump to the previous day for users west of UTC, so all arithmetic
 * here is done on the Y/M/D components via `Date.UTC`, which never observes
 * daylight-saving or local offsets.
 */

export type DateKey = string;

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export interface DateParts {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string') return false;
  const match = DATE_KEY_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseDateKey(key: DateKey): DateParts {
  const match = DATE_KEY_RE.exec(key);
  if (!match) throw new Error(`Invalid date key: ${key}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function makeDateKey(year: number, month: number, day: number): DateKey {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Milliseconds at UTC midnight of the key. Only meaningful for arithmetic. */
export function dateKeyToEpochDay(key: DateKey): number {
  const { year, month, day } = parseDateKey(key);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function epochDayToDateKey(epochDay: number): DateKey {
  const date = new Date(epochDay * DAY_MS);
  return makeDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(key: DateKey, days: number): DateKey {
  return epochDayToDateKey(dateKeyToEpochDay(key) + days);
}

/** Adds months, clamping the day to the target month's length (Jan 31 + 1 → Feb 28/29). */
export function addMonths(key: DateKey, months: number): DateKey {
  const { year, month, day } = parseDateKey(key);
  const zeroBased = month - 1 + months;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonth = (((zeroBased % 12) + 12) % 12) + 1;
  return makeDateKey(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: DateKey, to: DateKey): number {
  return dateKeyToEpochDay(to) - dateKeyToEpochDay(from);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(key: DateKey): number {
  // 1970-01-01 was a Thursday (4).
  return (((dateKeyToEpochDay(key) + 4) % 7) + 7) % 7;
}

export type WeekStart = 0 | 1;

export function startOfWeek(key: DateKey, weekStart: WeekStart): DateKey {
  const offset = (weekdayOf(key) - weekStart + 7) % 7;
  return addDays(key, -offset);
}

export function weekDays(key: DateKey, weekStart: WeekStart): DateKey[] {
  const start = startOfWeek(key, weekStart);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function startOfMonth(key: DateKey): DateKey {
  const { year, month } = parseDateKey(key);
  return makeDateKey(year, month, 1);
}

export function endOfMonth(key: DateKey): DateKey {
  const { year, month } = parseDateKey(key);
  return makeDateKey(year, month, daysInMonth(year, month));
}

/**
 * Cells for a month view: always whole weeks, starting on the configured
 * first weekday. Returns 35 or 42 keys including leading/trailing days.
 */
export function monthGrid(year: number, month: number, weekStart: WeekStart): DateKey[] {
  const first = makeDateKey(year, month, 1);
  const gridStart = startOfWeek(first, weekStart);
  const last = makeDateKey(year, month, daysInMonth(year, month));
  const total = diffDays(gridStart, last) + 1;
  const cells = Math.ceil(total / 7) * 7;
  return Array.from({ length: cells }, (_, index) => addDays(gridStart, index));
}

export function compareDateKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDateKey(a: DateKey, b: DateKey): DateKey {
  return a <= b ? a : b;
}

export function maxDateKey(a: DateKey, b: DateKey): DateKey {
  return a >= b ? a : b;
}

export function isSameMonth(a: DateKey, b: DateKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function dateRange(from: DateKey, to: DateKey): DateKey[] {
  const length = diffDays(from, to) + 1;
  if (length <= 0) return [];
  return Array.from({ length }, (_, index) => addDays(from, index));
}

/** Minutes since local midnight → "HH:MM" (24h). */
export function minuteToHHMM(minute: number): string {
  const safe = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function hhmmToMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
