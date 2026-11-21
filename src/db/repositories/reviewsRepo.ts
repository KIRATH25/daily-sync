/**
 * Daily mood check-ins. `review_date` is the primary key, which enforces
 * exactly one primary rating per local calendar date at the database level;
 * saving again for the same date updates (edits) that rating.
 */
import type { DateKey } from '@/lib/dates';
import type { DayReview, MoodLevel } from '@/types/models';

import { notifyChange } from '../changes';
import { db } from '../driver';
import { isString, parseJsonArray, toJson } from '../json';

interface ReviewRow {
  review_date: string;
  mood: number;
  tags: string;
  remark: string | null;
  gratitude: string | null;
  created_at: number;
  updated_at: number;
}

export type ReviewInput = Pick<DayReview, 'mood' | 'tags' | 'remark' | 'gratitude'>;

function clampMood(value: number): MoodLevel {
  return Math.max(1, Math.min(5, Math.round(value))) as MoodLevel;
}

const mapReview = (row: ReviewRow): DayReview => ({
  date: row.review_date,
  mood: clampMood(row.mood),
  tags: parseJsonArray(row.tags, isString),
  remark: row.remark,
  gratitude: row.gratitude,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function getReview(date: DateKey): Promise<DayReview | null> {
  const row = await db().first<ReviewRow>('SELECT * FROM day_reviews WHERE review_date = ?', [date]);
  return row ? mapReview(row) : null;
}

export async function listReviews(from: DateKey, to: DateKey): Promise<DayReview[]> {
  const rows = await db().all<ReviewRow>(
    'SELECT * FROM day_reviews WHERE review_date BETWEEN ? AND ? ORDER BY review_date',
    [from, to],
  );
  return rows.map(mapReview);
}

export async function listRecentReviews(limit = 60): Promise<DayReview[]> {
  const rows = await db().all<ReviewRow>('SELECT * FROM day_reviews ORDER BY review_date DESC LIMIT ?', [limit]);
  return rows.map(mapReview);
}

export async function saveReview(date: DateKey, input: ReviewInput): Promise<void> {
  const now = Date.now();
  await db().run(
    `INSERT INTO day_reviews (review_date, mood, tags, remark, gratitude, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(review_date) DO UPDATE SET mood = excluded.mood, tags = excluded.tags, remark = excluded.remark,
       gratitude = excluded.gratitude, updated_at = excluded.updated_at`,
    [date, clampMood(input.mood), toJson([...new Set(input.tags)]), input.remark, input.gratitude, now, now],
  );
  notifyChange('day_reviews');
}

export async function deleteReview(date: DateKey): Promise<void> {
  await db().run('DELETE FROM day_reviews WHERE review_date = ?', [date]);
  notifyChange('day_reviews');
}
