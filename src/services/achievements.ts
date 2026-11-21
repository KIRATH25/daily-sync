/**
 * Evaluates the achievement catalogue against real activity history and
 * persists newly earned cards. Called after qualifying writes (debounced)
 * and on launch. Newly unlocked cards are announced once via the inbox and
 * the in-app reveal.
 */
import { subscribeToChanges, type TableName } from '@/db/changes';
import { insertEarned } from '@/db/repositories/achievementsRepo';
import { listActiveDates } from '@/db/repositories/activityRepo';
import { addInboxItem } from '@/db/repositories/notificationsRepo';
import { createFormatters, type TKey } from '@/i18n';
import { evaluateAchievements, getAchievement } from '@/lib/achievements';
import { normalizeActiveDates } from '@/lib/journey';
import { todayKey } from '@/lib/timezone';
import { loadPreferences } from '@/store/preferences';
import type { AchievementRecord } from '@/types/models';

type UnlockListener = (records: AchievementRecord[]) => void;
const unlockListeners = new Set<UnlockListener>();

export function onAchievementsUnlocked(listener: UnlockListener): () => void {
  unlockListeners.add(listener);
  return () => {
    unlockListeners.delete(listener);
  };
}

let running: Promise<AchievementRecord[]> | null = null;

export function evaluateAndStoreAchievements(): Promise<AchievementRecord[]> {
  if (running) return running;
  running = (async () => {
    const prefs = await loadPreferences();
    const today = todayKey(prefs.timeZone);
    const dates = normalizeActiveDates(await listActiveDates(), today);
    const inserted = await insertEarned(evaluateAchievements(dates, today));
    if (inserted.length > 0) {
      const { t } = createFormatters(prefs.language, prefs.timeFormat, prefs.timeZone);
      for (const record of inserted) {
        const definition = getAchievement(record.achievementId);
        if (!definition) continue;
        await addInboxItem(
          'achievement',
          t('achievements.unlockedTitle', { name: t(`achievement.${definition.id}.name` as TKey) }),
          t(`achievement.${definition.id}.description` as TKey),
          `/collection/${definition.id}`,
          `achievement:${definition.id}`,
        );
      }
      unlockListeners.forEach((listener) => listener(inserted));
    }
    return inserted;
  })().finally(() => {
    running = null;
  });
  return running;
}

const QUALIFYING_TABLES: TableName[] = [
  'tasks',
  'entry_completions',
  'habit_logs',
  'day_reviews',
  'journal_entries',
  'workout_sessions',
  'focus_sessions',
  'assignments',
  'attendance_records',
];

export function watchForAchievementChanges(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const watched = new Set<TableName>(QUALIFYING_TABLES);
  const unsubscribe = subscribeToChanges((changed) => {
    if (![...changed].some((table) => watched.has(table))) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      evaluateAndStoreAchievements().catch((error: unknown) => console.error('Achievement evaluation failed', error));
    }, 800);
  });
  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
