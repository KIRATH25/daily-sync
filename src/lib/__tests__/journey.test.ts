import { addDays, dateRange } from '../dates';
import { ACHIEVEMENTS, achievementProgress, cardRecordCode, evaluateAchievements, getAchievement } from '../achievements';
import { computeJourneyStats, normalizeActiveDates, streakRuns } from '../journey';

const TODAY = '2025-11-21';

describe('journey stats', () => {
  it('is zero with no activity', () => {
    expect(computeJourneyStats([], TODAY)).toEqual({
      activeDays: 0,
      currentStreak: 0,
      longestStreak: 0,
      firstActive: null,
      lastActive: null,
      activeToday: false,
    });
  });

  it('counts unique days and ignores duplicates and future dates', () => {
    const stats = computeJourneyStats(['2025-11-20', '2025-11-20', '2025-11-21', '2025-11-25'], TODAY);
    expect(stats.activeDays).toBe(2);
    expect(stats.currentStreak).toBe(2);
    expect(stats.activeToday).toBe(true);
  });

  it('keeps the streak alive until today is over', () => {
    const stats = computeJourneyStats(['2025-11-18', '2025-11-19', '2025-11-20'], TODAY);
    expect(stats.currentStreak).toBe(3);
    expect(stats.activeToday).toBe(false);
  });

  it('resets the streak after a missed day', () => {
    const stats = computeJourneyStats(['2025-11-17', '2025-11-18', '2025-11-19'], TODAY);
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(3);
  });

  it('finds the longest historical run', () => {
    const dates = [...dateRange('2025-09-01', '2025-09-10'), ...dateRange('2025-11-19', '2025-11-21')];
    const stats = computeJourneyStats(dates, TODAY);
    expect(stats.longestStreak).toBe(10);
    expect(stats.currentStreak).toBe(3);
    expect(stats.activeDays).toBe(13);
  });

  it('builds runs across month boundaries', () => {
    expect(streakRuns(['2025-10-30', '2025-10-31', '2025-11-01'])).toEqual([
      { start: '2025-10-30', end: '2025-11-01', length: 3 },
    ]);
  });
});

describe('achievements', () => {
  const earnedIds = (dates: string[], today = TODAY) =>
    evaluateAchievements(normalizeActiveDates(dates, today), today).map((item) => item.id);

  it('has unique ids and sequential numbers', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    ACHIEVEMENTS.forEach((a, index) => expect(a.number).toBe(index + 1));
  });

  it('unlocks nothing without activity', () => {
    expect(evaluateAchievements([], TODAY)).toEqual([]);
  });

  it('unlocks The First Step on the first active day with that date', () => {
    const result = evaluateAchievements(['2025-11-10'], TODAY);
    expect(result).toEqual([{ id: 'first_step', earnedDate: '2025-11-10', value: 1 }]);
  });

  it('unlocks streak cards on the day the streak is reached', () => {
    const dates = dateRange('2025-11-01', '2025-11-07');
    const result = evaluateAchievements(dates, TODAY);
    expect(result.find((a) => a.id === 'warming_up')?.earnedDate).toBe('2025-11-03');
    expect(result.find((a) => a.id === 'seven_strong')?.earnedDate).toBe('2025-11-07');
    expect(result.find((a) => a.id === 'two_weeks')).toBeUndefined();
  });

  it('does not treat scattered days as a streak', () => {
    const scattered = ['2025-11-01', '2025-11-03', '2025-11-05', '2025-11-07', '2025-11-09', '2025-11-11', '2025-11-13'];
    expect(earnedIds(scattered)).toEqual(['first_step']);
  });

  it('unlocks total-day cards on the n-th active day', () => {
    const dates = Array.from({ length: 30 }, (_, i) => addDays('2025-01-01', i * 2));
    const result = evaluateAchievements(dates, TODAY);
    expect(result.find((a) => a.id === 'consistent_one')?.earnedDate).toBe(dates[29]);
    expect(result.find((a) => a.id === 'unstoppable')).toBeUndefined();
  });

  it('detects a comeback after a 7+ day break', () => {
    const dates = ['2025-10-01', '2025-10-02', ...dateRange('2025-10-10', '2025-10-12')];
    const result = evaluateAchievements(dates, TODAY);
    expect(result.find((a) => a.id === 'comeback_story')?.earnedDate).toBe('2025-10-12');
    // A 6-day break is not a comeback.
    expect(earnedIds(['2025-10-01', ...dateRange('2025-10-08', '2025-10-10')])).not.toContain('comeback_story');
  });

  it('requires every day of a finished month for Perfect Month', () => {
    expect(earnedIds(dateRange('2025-02-01', '2025-02-28'))).toContain('perfect_month');
    expect(earnedIds(dateRange('2025-02-02', '2025-02-28'))).not.toContain('perfect_month');
    // The current month cannot be perfect before it ends.
    expect(earnedIds(dateRange('2025-11-01', '2025-11-21'))).not.toContain('perfect_month');
  });

  it('awards New Personal Best when a 3+ day record is beaten', () => {
    const dates = [...dateRange('2025-10-01', '2025-10-03'), ...dateRange('2025-10-10', '2025-10-13')];
    const best = evaluateAchievements(dates, TODAY).find((a) => a.id === 'personal_best');
    expect(best).toEqual({ id: 'personal_best', earnedDate: '2025-10-13', value: 4 });
    expect(earnedIds([...dateRange('2025-10-01', '2025-10-02'), ...dateRange('2025-10-10', '2025-10-14')])).not.toContain(
      'personal_best',
    );
  });

  it('reports progress for locked cards', () => {
    const half = getAchievement('half_century');
    expect(half && achievementProgress(half, { activeDays: 28, currentStreak: 2, longestStreak: 5 })).toEqual({
      current: 28,
      target: 50,
      ratio: 0.56,
    });
  });

  it('formats record codes', () => {
    const def = getAchievement('consistent_one');
    expect(def && cardRecordCode(def, '2025-11-20', 'm1abc_7f4d')).toBe('DS-OBS-2025-005-7F4D');
  });
});
