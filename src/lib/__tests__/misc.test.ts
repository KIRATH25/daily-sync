import { contrastRatio, ensureContrast, isValidHex, mix, normalizeHex } from '../color';
import { countdownParts, countdownProgress, nextTickDelay } from '../countdown';
import { parseQuickInput } from '../quickParse';
import { validateHex, validateNumber, validateReminderOffsets, validateTimeRange, validateTitle } from '../validation';

describe('hex colours', () => {
  it('validates and normalises', () => {
    expect(isValidHex('#F4D54D')).toBe(true);
    expect(isValidHex('f4d54d')).toBe(true);
    expect(isValidHex('#FFF')).toBe(true);
    expect(isValidHex('#F4D54')).toBe(false);
    expect(isValidHex('#GGGGGG')).toBe(false);
    expect(isValidHex('red')).toBe(false);
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex(' f4d54d ')).toBe('#F4D54D');
    expect(validateHex('nope')).toEqual({ ok: false, error: 'validation.invalidHex' });
  });

  it('computes WCAG contrast and repairs low contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#F4D54D', '#0C0D0F')).toBeGreaterThan(10);
    const fixed = ensureContrast('#F4D54D', '#F5F2EB', 4.5);
    expect(contrastRatio(fixed, '#F5F2EB')).toBeGreaterThanOrEqual(4.5);
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('countdown', () => {
  const target = Date.UTC(2026, 4, 1, 13, 30);

  it('breaks down remaining time', () => {
    const now = target - (2 * 86_400 + 3 * 3600 + 4 * 60 + 5) * 1000;
    expect(countdownParts(target, now)).toMatchObject({ days: 2, hours: 3, minutes: 4, seconds: 5, isPast: false });
  });

  it('rounds partial seconds up while counting down', () => {
    expect(countdownParts(target, target - 1500).seconds).toBe(2);
    expect(countdownParts(target, target - 1).seconds).toBe(1);
  });

  it('reports past targets', () => {
    expect(countdownParts(target, target + 61_000)).toMatchObject({ minutes: 1, seconds: 1, isPast: true });
  });

  it('computes progress and tick delays', () => {
    expect(countdownProgress(0, 100, 50)).toBe(0.5);
    expect(countdownProgress(0, 100, 200)).toBe(1);
    expect(nextTickDelay(target, target - 1500, true)).toBe(516);
    expect(nextTickDelay(target, target + 200, true)).toBe(816);
  });
});

describe('validation', () => {
  it('validates titles', () => {
    expect(validateTitle('   ')).toEqual({ ok: false, error: 'validation.required' });
    expect(validateTitle('  Gym  ')).toEqual({ ok: true, value: 'Gym' });
    expect(validateTitle('x'.repeat(121))).toEqual({ ok: false, error: 'validation.tooLong' });
  });

  it('validates numbers and ranges', () => {
    expect(validateNumber('72,5', 20, 400)).toEqual({ ok: true, value: 72.5 });
    expect(validateNumber('abc', 0, 10)).toEqual({ ok: false, error: 'validation.notANumber' });
    expect(validateNumber('900', 0, 700)).toEqual({ ok: false, error: 'validation.outOfRange' });
    expect(validateTimeRange(600, 540)).toEqual({ ok: false, error: 'validation.endBeforeStart' });
  });

  it('dedupes reminder offsets and caps them', () => {
    expect(validateReminderOffsets([30, 10, 30])).toEqual({ ok: true, value: [30, 10] });
    expect(validateReminderOffsets([1, 2, 3, 4, 5, 6])).toEqual({ ok: false, error: 'validation.tooManyReminders' });
  });
});

describe('quick parse', () => {
  const today = '2025-11-21'; // Friday

  it('parses due tasks with time', () => {
    expect(parseQuickInput('Physics lab due 11pm', today)).toEqual({
      kind: 'task',
      title: 'Physics lab',
      dateKey: today,
      minute: 23 * 60,
    });
  });

  it('parses timed events', () => {
    expect(parseQuickInput('Gym 6pm', today)).toEqual({ kind: 'event', title: 'Gym', dateKey: today, minute: 18 * 60 });
    expect(parseQuickInput('Call mom tomorrow at 9:30am', today)).toEqual({
      kind: 'event',
      title: 'Call mom',
      dateKey: '2025-11-22',
      minute: 570,
    });
  });

  it('parses weekdays and plain tasks', () => {
    expect(parseQuickInput('Submit essay due monday', today)).toMatchObject({ kind: 'task', dateKey: '2025-11-24' });
    expect(parseQuickInput('Review friday', today)).toMatchObject({ dateKey: '2025-11-28' });
    expect(parseQuickInput('Buy milk', today)).toEqual({ kind: 'task', title: 'Buy milk', dateKey: null, minute: null });
  });
});
