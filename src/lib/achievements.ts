/**
 * SYNC COLLECTION achievement catalogue and unlock engine.
 *
 * Every rule is evaluated against the sorted list of ACTIVE DAYS (see
 * `journey.ts`) — never against a number shown on screen — and reports the
 * exact date the milestone was reached. Evaluation is deterministic and
 * replayable: running it over the same history always yields the same cards
 * and the same earned dates. Once earned, a card is persisted and is never
 * revoked, even if the underlying records are later deleted.
 *
 * Unlock conditions:
 *   first_step       1 active day
 *   warming_up       3-day streak
 *   seven_strong     7-day streak
 *   two_weeks        14-day streak
 *   consistent_one   30 active days in total
 *   unstoppable      30-day streak
 *   half_century     50 active days in total
 *   century_club     100 active days in total
 *   dedicated        200 active days in total
 *   year_of_growth   365 active days in total
 *   comeback_story   a run of ≥ 3 consecutive active days that starts after
 *                    a break of ≥ 7 inactive days (with activity before it)
 *   perfect_month    every day of a complete calendar month was active
 *   personal_best    a streak beats a previous best streak of ≥ 3 days
 */
import { addDays, daysInMonth, diffDays, makeDateKey, parseDateKey, type DateKey } from './dates';
import { streakRuns } from './journey';

export type CardSeries = 'obsidian' | 'platinum' | 'aurora' | 'signature' | 'legacy' | 'moment';

export type EmblemKind = 'flag' | 'flame' | 'spark' | 'shield' | 'hexstar' | 'orbit' | 'crown' | 'laurel' | 'sun' | 'phoenix' | 'calendar' | 'summit' | 'infinity';

export type AchievementId =
  | 'first_step'
  | 'warming_up'
  | 'seven_strong'
  | 'two_weeks'
  | 'consistent_one'
  | 'unstoppable'
  | 'half_century'
  | 'century_club'
  | 'dedicated'
  | 'year_of_growth'
  | 'comeback_story'
  | 'perfect_month'
  | 'personal_best';

export type AchievementMetric = 'total' | 'streak' | 'special';

export interface AchievementDefinition {
  id: AchievementId;
  /** Position in the collection, 1-based. */
  number: number;
  series: CardSeries;
  emblem: EmblemKind;
  metric: AchievementMetric;
  /** Target for total/streak metrics; informational for special ones. */
  target: number;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 'first_step', number: 1, series: 'signature', emblem: 'flag', metric: 'total', target: 1 },
  { id: 'warming_up', number: 2, series: 'moment', emblem: 'spark', metric: 'streak', target: 3 },
  { id: 'seven_strong', number: 3, series: 'obsidian', emblem: 'flame', metric: 'streak', target: 7 },
  { id: 'two_weeks', number: 4, series: 'platinum', emblem: 'shield', metric: 'streak', target: 14 },
  { id: 'consistent_one', number: 5, series: 'obsidian', emblem: 'hexstar', metric: 'total', target: 30 },
  { id: 'unstoppable', number: 6, series: 'aurora', emblem: 'orbit', metric: 'streak', target: 30 },
  { id: 'half_century', number: 7, series: 'aurora', emblem: 'sun', metric: 'total', target: 50 },
  { id: 'century_club', number: 8, series: 'legacy', emblem: 'crown', metric: 'total', target: 100 },
  { id: 'dedicated', number: 9, series: 'platinum', emblem: 'summit', metric: 'total', target: 200 },
  { id: 'year_of_growth', number: 10, series: 'legacy', emblem: 'laurel', metric: 'total', target: 365 },
  { id: 'comeback_story', number: 11, series: 'moment', emblem: 'phoenix', metric: 'special', target: 3 },
  { id: 'perfect_month', number: 12, series: 'signature', emblem: 'calendar', metric: 'special', target: 1 },
  { id: 'personal_best', number: 13, series: 'moment', emblem: 'infinity', metric: 'special', target: 1 },
];

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

export function getAchievement(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((definition) => definition.id === id);
}

export interface EarnedAchievement {
  id: AchievementId;
  earnedDate: DateKey;
  /** The milestone number shown on the card (days, streak length…). */
  value: number;
}

const COMEBACK_GAP_DAYS = 7;
const COMEBACK_RUN = 3;
const PERSONAL_BEST_MIN_PREVIOUS = 3;

/** Date on which the n-th active day happened. */
function nthActiveDate(sorted: readonly DateKey[], n: number): DateKey | null {
  return sorted[n - 1] ?? null;
}

/** Date on which a run first reached `length` consecutive days. */
function firstStreakReaching(sorted: readonly DateKey[], length: number): DateKey | null {
  for (const run of streakRuns(sorted)) {
    if (run.length >= length) return addDays(run.start, length - 1);
  }
  return null;
}

function comebackDate(sorted: readonly DateKey[]): DateKey | null {
  const runs = streakRuns(sorted);
  for (let index = 1; index < runs.length; index += 1) {
    const previous = runs[index - 1];
    const run = runs[index];
    if (!previous || !run) continue;
    const gap = diffDays(previous.end, run.start) - 1;
    if (gap >= COMEBACK_GAP_DAYS && run.length >= COMEBACK_RUN) {
      return addDays(run.start, COMEBACK_RUN - 1);
    }
  }
  return null;
}

/** First calendar month (fully in the past or ending today) with every day active. */
function perfectMonthDate(sorted: readonly DateKey[], today: DateKey): DateKey | null {
  const active = new Set(sorted);
  const months = new Set(sorted.map((date) => date.slice(0, 7)));
  for (const month of [...months].sort()) {
    const { year, month: monthNumber } = parseDateKey(`${month}-01`);
    const length = daysInMonth(year, monthNumber);
    const last = makeDateKey(year, monthNumber, length);
    if (last > today) continue;
    let complete = true;
    for (let day = 1; day <= length; day += 1) {
      if (!active.has(makeDateKey(year, monthNumber, day))) {
        complete = false;
        break;
      }
    }
    if (complete) return last;
  }
  return null;
}

/** Day a streak first exceeded an earlier best of at least 3 days. */
function personalBestDate(sorted: readonly DateKey[]): { date: DateKey; value: number } | null {
  let best = 0;
  for (const run of streakRuns(sorted)) {
    if (best >= PERSONAL_BEST_MIN_PREVIOUS && run.length > best) {
      return { date: addDays(run.start, best), value: best + 1 };
    }
    best = Math.max(best, run.length);
  }
  return null;
}

/**
 * Evaluates the full catalogue. `sortedActiveDates` must be sorted,
 * de-duplicated and contain no dates after `today`
 * (use `normalizeActiveDates`).
 */
export function evaluateAchievements(sortedActiveDates: readonly DateKey[], today: DateKey): EarnedAchievement[] {
  const earned: EarnedAchievement[] = [];
  for (const definition of ACHIEVEMENTS) {
    if (definition.metric === 'total') {
      const date = nthActiveDate(sortedActiveDates, definition.target);
      if (date) earned.push({ id: definition.id, earnedDate: date, value: definition.target });
    } else if (definition.metric === 'streak') {
      const date = firstStreakReaching(sortedActiveDates, definition.target);
      if (date) earned.push({ id: definition.id, earnedDate: date, value: definition.target });
    } else if (definition.id === 'comeback_story') {
      const date = comebackDate(sortedActiveDates);
      if (date) earned.push({ id: definition.id, earnedDate: date, value: COMEBACK_RUN });
    } else if (definition.id === 'perfect_month') {
      const date = perfectMonthDate(sortedActiveDates, today);
      if (date) earned.push({ id: definition.id, earnedDate: date, value: parseDateKey(date).day });
    } else if (definition.id === 'personal_best') {
      const result = personalBestDate(sortedActiveDates);
      if (result) earned.push({ id: definition.id, earnedDate: result.date, value: result.value });
    }
  }
  return earned;
}

export interface AchievementProgress {
  current: number;
  target: number;
  ratio: number;
}

/** Progress towards a locked card, for the "28 / 50 days" bar. */
export function achievementProgress(
  definition: AchievementDefinition,
  stats: { activeDays: number; currentStreak: number; longestStreak: number },
): AchievementProgress | null {
  if (definition.metric === 'special') return null;
  const current = definition.metric === 'total' ? stats.activeDays : Math.max(stats.currentStreak, stats.longestStreak);
  const clamped = Math.min(current, definition.target);
  return { current: clamped, target: definition.target, ratio: clamped / definition.target };
}

/** Human-readable record id, e.g. DS-OBS-2025-005-7F4D. */
export function cardRecordCode(definition: AchievementDefinition, earnedDate: DateKey, recordId: string): string {
  const seriesCode = definition.series.slice(0, 3).toUpperCase();
  const year = earnedDate.slice(0, 4);
  const suffix = recordId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase().padStart(4, '0');
  return `DS-${seriesCode}-${year}-${String(definition.number).padStart(3, '0')}-${suffix}`;
}
