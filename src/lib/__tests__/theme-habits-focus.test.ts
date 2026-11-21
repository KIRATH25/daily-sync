import { contrastRatio } from '../color';
import { addDays } from '../dates';
import { elapsedMs, endsAt, isFinished, nextBreak, pause, remainingMs, resume, type ActiveFocus } from '../focusTimer';
import { habitConsistency, habitStreaks } from '../habits';
import { dayCompletion, peakHour, summarizePeriod } from '../analytics';
import { buildPalette, resolvePalette, THEME_PRESETS, validateCustomColors } from '@/theme/palette';

describe('theme palettes', () => {
  it('reproduce the Obsidian Gold specification', () => {
    const palette = resolvePalette({ presetId: 'obsidian_gold', appearance: 'dark' }, 'dark');
    expect(palette.background).toBe('#0C0D0F');
    expect(palette.accent).toBe('#F4D54D');
    expect(palette.surface).toBe('#151719');
  });

  it('keep text readable in every preset and scheme', () => {
    for (const preset of THEME_PRESETS) {
      for (const scheme of ['dark', 'light'] as const) {
        const palette = resolvePalette({ presetId: preset.id, appearance: scheme }, scheme);
        expect(contrastRatio(palette.text, palette.background)).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(palette.textSecondary, palette.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.onAccent, palette.accent)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(palette.accentText, palette.surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('derive readable text for arbitrary custom backgrounds', () => {
    for (const background of ['#000000', '#FFFFFF', '#7A1F3D', '#F4D54D', '#203040']) {
      const palette = buildPalette({ background, accent: '#3EA8E8' });
      expect(contrastRatio(palette.text, palette.background)).toBeGreaterThanOrEqual(7);
    }
  });

  it('reject unreadable custom surfaces', () => {
    expect(validateCustomColors({ background: '#0C0D0F', accent: '#F4D54D', surface: '#E0E0E0' })).not.toBeNull();
    expect(validateCustomColors({ background: '#0C0D0F', accent: '#F4D54D', surface: '#1A1C1F' })).toBeNull();
  });
});

describe('habit streaks', () => {
  const everyDay = [0, 1, 2, 3, 4, 5, 6];
  const today = '2025-11-21'; // Friday

  it('counts consecutive completed days and keeps today open', () => {
    const done = new Set(['2025-11-18', '2025-11-19', '2025-11-20']);
    expect(habitStreaks(everyDay, done, '2025-11-01', today)).toEqual({ current: 3, longest: 3 });
  });

  it('skips unscheduled days (Mon/Wed/Fri habit)', () => {
    const mwf = [1, 3, 5];
    const done = new Set(['2025-11-17', '2025-11-19', '2025-11-21']);
    expect(habitStreaks(mwf, done, '2025-11-17', today)).toEqual({ current: 3, longest: 3 });
  });

  it('breaks on a missed scheduled day', () => {
    const done = new Set(['2025-11-17', '2025-11-18', '2025-11-20']);
    expect(habitStreaks(everyDay, done, '2025-11-17', today)).toEqual({ current: 1, longest: 2 });
  });

  it('computes consistency over the window', () => {
    const done = new Set([addDays(today, -1), addDays(today, -2)]);
    expect(habitConsistency(everyDay, done, addDays(today, -3), today, 30)).toBeCloseTo(2 / 3);
  });
});

describe('focus timer', () => {
  const base: ActiveFocus = { mode: 'focus', plannedSeconds: 1500, startedAt: 0, pausedAt: null, pausedMs: 0, taskId: null, label: null, round: 0, notificationId: null };

  it('derives elapsed and remaining from timestamps', () => {
    expect(elapsedMs(base, 60_000)).toBe(60_000);
    expect(remainingMs(base, 60_000)).toBe(1_440_000);
    expect(isFinished(base, 1_500_000)).toBe(true);
  });

  it('excludes paused time', () => {
    const paused = pause(base, 60_000);
    expect(elapsedMs(paused, 600_000)).toBe(60_000);
    expect(endsAt(paused, 600_000)).toBeNull();
    const resumed = resume(paused, 600_000);
    expect(elapsedMs(resumed, 660_000)).toBe(120_000);
    expect(endsAt(resumed, 660_000)).toBe(660_000 + 1_380_000);
  });

  it('schedules long breaks every N rounds', () => {
    expect(nextBreak(1, 4)).toBe('short_break');
    expect(nextBreak(4, 4)).toBe('long_break');
  });
});

describe('analytics', () => {
  const day = (date: string, tasksPlanned: number, tasksDone: number, habitsPlanned: number, habitsDone: number, mood: number | null = null) => ({
    date,
    tasksPlanned,
    tasksDone,
    habitsPlanned,
    habitsDone,
    focusSeconds: 0,
    workouts: 0,
    mood,
  });

  it('returns null completion when nothing was planned', () => {
    expect(dayCompletion(day('2025-11-21', 0, 0, 0, 0))).toBeNull();
    expect(dayCompletion(day('2025-11-21', 4, 2, 4, 4))).toBe(0.75);
  });

  it('summarises a period without inventing values', () => {
    const summary = summarizePeriod([day('2025-11-20', 2, 2, 2, 1, 4), day('2025-11-21', 0, 0, 0, 0, null)]);
    expect(summary.taskRate).toBe(1);
    expect(summary.habitRate).toBe(0.5);
    expect(summary.moodAverage).toBe(4);
    expect(summary.bestDay).toEqual({ date: '2025-11-20', completion: 0.75 });
    expect(summarizePeriod([]).completion).toBeNull();
  });

  it('finds the peak hour', () => {
    expect(peakHour([9, 9, 14, 21])).toBe(9);
    expect(peakHour([])).toBeNull();
  });
});
