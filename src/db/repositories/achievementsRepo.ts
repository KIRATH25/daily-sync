import type { EarnedAchievement } from '@/lib/achievements';
import type { DateKey } from '@/lib/dates';
import { createId } from '@/lib/id';
import type { AchievementRecord } from '@/types/models';

import { notifyChange } from '../changes';
import { db } from '../driver';
import { bool } from '../json';

interface RecordRow {
  id: string;
  achievement_id: string;
  earned_date: string;
  milestone_value: number;
  earned_at: number;
  seen: number;
}

const mapRecord = (row: RecordRow): AchievementRecord => ({
  id: row.id,
  achievementId: row.achievement_id,
  earnedDate: row.earned_date,
  milestoneValue: row.milestone_value,
  earnedAt: row.earned_at,
  seen: bool(row.seen),
});

export async function listAchievementRecords(): Promise<AchievementRecord[]> {
  const rows = await db().all<RecordRow>('SELECT * FROM achievement_records ORDER BY earned_date DESC, earned_at DESC');
  return rows.map(mapRecord);
}

export async function getAchievementRecord(achievementId: string): Promise<AchievementRecord | null> {
  const row = await db().first<RecordRow>('SELECT * FROM achievement_records WHERE achievement_id = ?', [achievementId]);
  return row ? mapRecord(row) : null;
}

/** Persists newly earned cards; existing ones are never overwritten or revoked. */
export async function insertEarned(earned: EarnedAchievement[]): Promise<AchievementRecord[]> {
  if (earned.length === 0) return [];
  const existing = new Set((await listAchievementRecords()).map((record) => record.achievementId));
  const fresh = earned.filter((item) => !existing.has(item.id));
  if (fresh.length === 0) return [];
  const now = Date.now();
  const inserted: AchievementRecord[] = [];
  await db().transaction(async () => {
    for (const item of fresh) {
      const id = createId('ach');
      await db().run(
        `INSERT INTO achievement_records (id, achievement_id, earned_date, milestone_value, earned_at, seen)
         VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT(achievement_id) DO NOTHING`,
        [id, item.id, item.earnedDate, item.value, now],
      );
      inserted.push({ id, achievementId: item.id, earnedDate: item.earnedDate as DateKey, milestoneValue: item.value, earnedAt: now, seen: false });
    }
  });
  notifyChange('achievement_records');
  return inserted;
}

export async function markAchievementsSeen(): Promise<void> {
  await db().run('UPDATE achievement_records SET seen = 1 WHERE seen = 0');
  notifyChange('achievement_records');
}
