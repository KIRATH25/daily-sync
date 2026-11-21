import { nextOccurrence, occurrencesInRange, occursOn, validateRecurrence, type RecurrenceRule } from '../recurrence';

describe('recurrence', () => {
  it('returns single date for non-recurring entries', () => {
    expect(occurrencesInRange('2025-11-21', null, '2025-11-01', '2025-11-30')).toEqual(['2025-11-21']);
    expect(occurrencesInRange('2025-12-21', null, '2025-11-01', '2025-11-30')).toEqual([]);
  });

  it('expands daily rules with interval', () => {
    const rule: RecurrenceRule = { freq: 'daily', interval: 2 };
    expect(occurrencesInRange('2025-11-01', rule, '2025-11-01', '2025-11-07')).toEqual([
      '2025-11-01',
      '2025-11-03',
      '2025-11-05',
      '2025-11-07',
    ]);
    // Fast-forward path lands on the right phase.
    expect(occurrencesInRange('2025-11-01', rule, '2026-01-01', '2026-01-04')).toEqual(['2026-01-02', '2026-01-04']);
  });

  it('expands weekly rules on chosen weekdays (Mon/Wed/Fri classes)', () => {
    const rule: RecurrenceRule = { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] };
    expect(occurrencesInRange('2025-11-17', rule, '2025-11-17', '2025-11-23')).toEqual([
      '2025-11-17',
      '2025-11-19',
      '2025-11-21',
    ]);
    expect(occursOn('2025-11-17', rule, '2025-11-18')).toBe(false);
  });

  it('supports bi-weekly rules', () => {
    const rule: RecurrenceRule = { freq: 'weekly', interval: 2 };
    expect(occurrencesInRange('2025-11-03', rule, '2025-11-01', '2025-12-31')).toEqual([
      '2025-11-03',
      '2025-11-17',
      '2025-12-01',
      '2025-12-15',
      '2025-12-29',
    ]);
  });

  it('skips months without the anchor day', () => {
    const rule: RecurrenceRule = { freq: 'monthly', interval: 1 };
    expect(occurrencesInRange('2025-01-31', rule, '2025-01-01', '2025-05-31')).toEqual([
      '2025-01-31',
      '2025-03-31',
      '2025-05-31',
    ]);
  });

  it('only repeats Feb 29 in leap years', () => {
    const rule: RecurrenceRule = { freq: 'yearly', interval: 1 };
    expect(occurrencesInRange('2024-02-29', rule, '2024-01-01', '2029-01-01')).toEqual(['2024-02-29', '2028-02-29']);
  });

  it('honours until and count', () => {
    expect(
      occurrencesInRange('2025-11-01', { freq: 'daily', interval: 1, until: '2025-11-03' }, '2025-11-01', '2025-11-30'),
    ).toEqual(['2025-11-01', '2025-11-02', '2025-11-03']);
    expect(
      occurrencesInRange('2025-11-01', { freq: 'daily', interval: 1, count: 2 }, '2025-11-01', '2025-11-30'),
    ).toEqual(['2025-11-01', '2025-11-02']);
    // Count is consumed by occurrences before the window too.
    expect(
      occurrencesInRange('2025-11-01', { freq: 'daily', interval: 1, count: 3 }, '2025-11-03', '2025-11-30'),
    ).toEqual(['2025-11-03']);
  });

  it('excludes exception dates', () => {
    const rule: RecurrenceRule = { freq: 'daily', interval: 1 };
    expect(occurrencesInRange('2025-11-01', rule, '2025-11-01', '2025-11-03', new Set(['2025-11-02']))).toEqual([
      '2025-11-01',
      '2025-11-03',
    ]);
  });

  it('finds next occurrence', () => {
    const rule: RecurrenceRule = { freq: 'weekly', interval: 1, byWeekday: [1] };
    expect(nextOccurrence('2025-11-03', rule, '2025-11-21')).toBe('2025-11-24');
    expect(nextOccurrence('2025-11-03', { ...rule, until: '2025-11-20' }, '2025-11-21')).toBeNull();
  });

  it('validates rules', () => {
    expect(validateRecurrence({ freq: 'daily', interval: 0 }, '2025-11-01')).toBe('recurrence.invalidInterval');
    expect(validateRecurrence({ freq: 'daily', interval: 1, until: '2025-10-01' }, '2025-11-01')).toBe(
      'recurrence.untilBeforeStart',
    );
    expect(validateRecurrence({ freq: 'monthly', interval: 1, byWeekday: [1] }, '2025-11-01')).toBe(
      'recurrence.weekdaysOnlyWeekly',
    );
    expect(validateRecurrence({ freq: 'weekly', interval: 1, byWeekday: [1, 3] }, '2025-11-01')).toBeNull();
  });
});
