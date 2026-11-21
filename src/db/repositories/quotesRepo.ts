import type { DateKey } from '@/lib/dates';

import { notifyChange } from '../changes';
import { db } from '../driver';

export async function wasQuoteShown(date: DateKey): Promise<boolean> {
  const row = await db().first<{ shown_date: string }>('SELECT shown_date FROM daily_quote_history WHERE shown_date = ?', [
    date,
  ]);
  return row !== null;
}

/** Records the quote for the date; returns false if one was already recorded (race-safe). */
export async function recordQuoteShown(date: DateKey, quoteId: string): Promise<boolean> {
  const result = await db().run(
    'INSERT INTO daily_quote_history (shown_date, quote_id, shown_at) VALUES (?, ?, ?) ON CONFLICT(shown_date) DO NOTHING',
    [date, quoteId, Date.now()],
  );
  notifyChange('daily_quote_history');
  return result.changes > 0;
}

export async function recentQuoteIds(limit = 30): Promise<string[]> {
  const rows = await db().all<{ quote_id: string }>(
    'SELECT quote_id FROM daily_quote_history ORDER BY shown_date DESC LIMIT ?',
    [limit],
  );
  return rows.map((row) => row.quote_id);
}
