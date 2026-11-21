/**
 * Bookkeeping for OS-scheduled notifications plus the in-app notification
 * centre ("inbox").
 *
 * `notification_records` mirrors what we have asked the OS to deliver. Each
 * row has a deterministic `schedule_key` (owner + fire time + slot) with a
 * UNIQUE constraint, which is what makes rescheduling idempotent: the
 * scheduler diffs desired keys against stored keys and never double-books.
 */
import { createId } from '@/lib/id';
import type { InboxCategory, InboxItem } from '@/types/models';

import { notifyChange } from '../changes';
import { db } from '../driver';

export interface NotificationRecord {
  id: string;
  ownerType: string;
  ownerId: string;
  scheduleKey: string;
  fireAt: number;
  title: string;
  body: string | null;
  route: string | null;
  category: InboxCategory;
}

interface RecordRow {
  id: string;
  owner_type: string;
  owner_id: string;
  schedule_key: string;
  fire_at: number;
  title: string;
  body: string | null;
  route: string | null;
  category: InboxCategory;
}

const mapRecord = (row: RecordRow): NotificationRecord => ({
  id: row.id,
  ownerType: row.owner_type,
  ownerId: row.owner_id,
  scheduleKey: row.schedule_key,
  fireAt: row.fire_at,
  title: row.title,
  body: row.body,
  route: row.route,
  category: row.category,
});

export async function listRecords(): Promise<NotificationRecord[]> {
  const rows = await db().all<RecordRow>('SELECT * FROM notification_records ORDER BY fire_at');
  return rows.map(mapRecord);
}

export async function insertRecord(record: NotificationRecord): Promise<void> {
  await db().run(
    `INSERT INTO notification_records (id, owner_type, owner_id, schedule_key, fire_at, title, body, route, category, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(schedule_key) DO UPDATE SET id = excluded.id, title = excluded.title, body = excluded.body,
       route = excluded.route`,
    [
      record.id,
      record.ownerType,
      record.ownerId,
      record.scheduleKey,
      record.fireAt,
      record.title,
      record.body,
      record.route,
      record.category,
      Date.now(),
    ],
  );
}

export async function deleteRecordsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db().transaction(async () => {
    for (const id of ids) {
      await db().run('DELETE FROM notification_records WHERE id = ?', [id]);
    }
  });
}

/**
 * Moves notifications whose time has passed into the inbox so the
 * notification centre reflects what was delivered while the app was closed.
 */
export async function archiveDeliveredRecords(now: number): Promise<number> {
  const due = await db().all<RecordRow>('SELECT * FROM notification_records WHERE fire_at <= ?', [now]);
  if (due.length === 0) return 0;
  await db().transaction(async () => {
    for (const row of due) {
      await db().run(
        `INSERT INTO inbox_items (id, category, title, body, route, source_key, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_key) DO NOTHING`,
        [createId('inb'), row.category, row.title, row.body, row.route, row.schedule_key, row.fire_at],
      );
      await db().run('DELETE FROM notification_records WHERE id = ?', [row.id]);
    }
  });
  notifyChange('inbox_items', 'notification_records');
  return due.length;
}

// ── Inbox ───────────────────────────────────────────────────────────────────

interface InboxRow {
  id: string;
  category: InboxCategory;
  title: string;
  body: string | null;
  route: string | null;
  occurred_at: number;
  read_at: number | null;
}

const mapInbox = (row: InboxRow): InboxItem => ({
  id: row.id,
  category: row.category,
  title: row.title,
  body: row.body,
  route: row.route,
  occurredAt: row.occurred_at,
  readAt: row.read_at,
});

export async function addInboxItem(
  category: InboxCategory,
  title: string,
  body: string | null,
  route: string | null,
  sourceKey: string | null = null,
): Promise<void> {
  await db().run(
    `INSERT INTO inbox_items (id, category, title, body, route, source_key, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(source_key) DO NOTHING`,
    [createId('inb'), category, title, body, route, sourceKey, Date.now()],
  );
  notifyChange('inbox_items');
}

export async function listInbox(limit = 100): Promise<InboxItem[]> {
  const rows = await db().all<InboxRow>('SELECT * FROM inbox_items ORDER BY occurred_at DESC LIMIT ?', [limit]);
  return rows.map(mapInbox);
}

export async function unreadInboxCount(): Promise<number> {
  const row = await db().first<{ count: number }>('SELECT COUNT(*) AS count FROM inbox_items WHERE read_at IS NULL');
  return row?.count ?? 0;
}

export async function markInboxRead(id: string): Promise<void> {
  await db().run('UPDATE inbox_items SET read_at = ? WHERE id = ? AND read_at IS NULL', [Date.now(), id]);
  notifyChange('inbox_items');
}

export async function markAllInboxRead(): Promise<void> {
  await db().run('UPDATE inbox_items SET read_at = ? WHERE read_at IS NULL', [Date.now()]);
  notifyChange('inbox_items');
}

export async function clearReadInbox(): Promise<void> {
  await db().run('DELETE FROM inbox_items WHERE read_at IS NOT NULL');
  notifyChange('inbox_items');
}
