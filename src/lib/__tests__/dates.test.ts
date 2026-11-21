import {
  addDays,
  addMonths,
  diffDays,
  isDateKey,
  monthGrid,
  startOfWeek,
  weekdayOf,
  minuteToHHMM,
  hhmmToMinute,
} from '../dates';
import { instantToWallClock, nextDailyOccurrence, offsetMinutesAt, todayKey, wallClockToInstant } from '../timezone';

describe('date keys', () => {
  it('validates real calendar dates only', () => {
    expect(isDateKey('2024-02-29')).toBe(true);
    expect(isDateKey('2025-02-29')).toBe(false);
    expect(isDateKey('2025-13-01')).toBe(false);
    expect(isDateKey('2025-1-01')).toBe(false);
    expect(isDateKey(20250101)).toBe(false);
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
    expect(addDays('2025-11-21', 0)).toBe('2025-11-21');
  });

  it('clamps when adding months', () => {
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2025-11-15', 2)).toBe('2026-01-15');
    expect(addMonths('2025-01-15', -1)).toBe('2024-12-15');
  });

  it('computes weekday and differences', () => {
    expect(weekdayOf('2025-11-21')).toBe(5); // Friday
    expect(weekdayOf('1970-01-01')).toBe(4);
    expect(diffDays('2025-11-01', '2025-11-21')).toBe(20);
    expect(diffDays('2025-11-21', '2025-11-01')).toBe(-20);
  });

  it('respects week-start preference', () => {
    expect(startOfWeek('2025-11-21', 1)).toBe('2025-11-17');
    expect(startOfWeek('2025-11-21', 0)).toBe('2025-11-16');
    expect(startOfWeek('2025-11-17', 1)).toBe('2025-11-17');
  });

  it('builds whole-week month grids', () => {
    const grid = monthGrid(2025, 11, 1);
    expect(grid.length % 7).toBe(0);
    expect(grid[0]).toBe('2025-10-27');
    expect(grid).toContain('2025-11-30');
    expect(grid.length).toBe(35);
  });

  it('converts minutes and HH:MM', () => {
    expect(minuteToHHMM(0)).toBe('00:00');
    expect(minuteToHHMM(1439)).toBe('23:59');
    expect(hhmmToMinute('09:30')).toBe(570);
    expect(hhmmToMinute('24:00')).toBeNull();
  });
});

describe('time zones', () => {
  const IST = 'Asia/Kolkata';

  it('maps instants to IST wall clock including midnight boundaries', () => {
    // 2025-11-21T18:29:59Z is 23:59:59 IST, one second later is the next day.
    expect(instantToWallClock(Date.UTC(2025, 10, 21, 18, 29, 59), IST)).toEqual({
      dateKey: '2025-11-21',
      minute: 23 * 60 + 59,
      second: 59,
    });
    expect(instantToWallClock(Date.UTC(2025, 10, 21, 18, 30, 0), IST).dateKey).toBe('2025-11-22');
    expect(todayKey(IST, Date.UTC(2025, 10, 21, 18, 30, 0))).toBe('2025-11-22');
  });

  it('converts wall clock to instants and round-trips', () => {
    const instant = wallClockToInstant('2025-11-21', 22 * 60, IST);
    expect(instant).toBe(Date.UTC(2025, 10, 21, 16, 30));
    expect(instantToWallClock(instant, IST)).toEqual({ dateKey: '2025-11-21', minute: 1320, second: 0 });
    expect(offsetMinutesAt(instant, IST)).toBe(330);
  });

  it('handles DST zones', () => {
    // New York switched to EST on 2025-11-02.
    const before = wallClockToInstant('2025-11-01', 9 * 60, 'America/New_York');
    const after = wallClockToInstant('2025-11-03', 9 * 60, 'America/New_York');
    expect(before).toBe(Date.UTC(2025, 10, 1, 13));
    expect(after).toBe(Date.UTC(2025, 10, 3, 14));
  });

  it('finds the next daily occurrence strictly after now', () => {
    const at2159 = Date.UTC(2025, 10, 21, 16, 29); // 21:59 IST
    expect(nextDailyOccurrence(22 * 60, IST, at2159)).toBe(Date.UTC(2025, 10, 21, 16, 30));
    const at2200 = Date.UTC(2025, 10, 21, 16, 30);
    expect(nextDailyOccurrence(22 * 60, IST, at2200)).toBe(Date.UTC(2025, 10, 22, 16, 30));
  });
});
