/**
 * Journal entries. Bodies are private: never log them, and keep them out of
 * notification text and error messages.
 */
import type { DateKey } from '@/lib/dates';
import { createId } from '@/lib/id';
import type { JournalEntry } from '@/types/models';

import { notifyChange } from '../changes';
import { db } from '../driver';

interface JournalRow {
  id: string;
  entry_date: string;
  title: string | null;
  body: string;
  created_at: number;
  updated_at: number;
}

const mapJournal = (row: JournalRow): JournalEntry => ({
  id: row.id,
  date: row.entry_date,
  title: row.title,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function listJournal(limit = 200): Promise<JournalEntry[]> {
  const rows = await db().all<JournalRow>(
    'SELECT * FROM journal_entries ORDER BY entry_date DESC, created_at DESC LIMIT ?',
    [limit],
  );
  return rows.map(mapJournal);
}

export async function getJournalEntry(id: string): Promise<JournalEntry | null> {
  const row = await db().first<JournalRow>('SELECT * FROM journal_entries WHERE id = ?', [id]);
  return row ? mapJournal(row) : null;
}

export async function createJournalEntry(date: DateKey, title: string | null, body: string): Promise<string> {
  const id = createId('jrn');
  const now = Date.now();
  await db().run(
    'INSERT INTO journal_entries (id, entry_date, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, date, title, body, now, now],
  );
  notifyChange('journal_entries');
  return id;
}

export async function updateJournalEntry(id: string, date: DateKey, title: string | null, body: string): Promise<void> {
  await db().run('UPDATE journal_entries SET entry_date = ?, title = ?, body = ?, updated_at = ? WHERE id = ?', [
    date,
    title,
    body,
    Date.now(),
    id,
  ]);
  notifyChange('journal_entries');
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await db().run('DELETE FROM journal_entries WHERE id = ?', [id]);
  notifyChange('journal_entries');
}

export async function searchJournal(query: string, limit = 20): Promise<JournalEntry[]> {
  const like = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const rows = await db().all<JournalRow>(
    `SELECT * FROM journal_entries WHERE title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\'
     ORDER BY entry_date DESC LIMIT ?`,
    [like, like, limit],
  );
  return rows.map(mapJournal);
}
