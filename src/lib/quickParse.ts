/**
 * Lightweight, offline parser for the Quick Create box.
 *
 * Understands an optional date word, an optional time and the keyword "due":
 *   "Physics lab due 11pm"     → task due today 23:00
 *   "Gym 6pm"                  → event today 18:00 (60 min)
 *   "Call mom tomorrow 9:30am" → event tomorrow 09:30
 *   "Submit essay due friday"  → task due next Friday (no time)
 *   "Buy milk"                 → task without a date
 *
 * Everything recognised is removed from the title. The result is shown as a
 * preview before saving, so nothing is created on a guess.
 */
import { addDays, weekdayOf, type DateKey } from './dates';

export type QuickKind = 'task' | 'event';

export interface QuickParseResult {
  kind: QuickKind;
  title: string;
  dateKey: DateKey | null;
  minute: number | null;
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

const TIME_RE = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i;
const DATE_RE = /\b(today|tonight|tomorrow|tmrw|(?:next\s+)?(?:sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?))\b/i;
const DUE_RE = /\bdue\b/i;

export function parseQuickInput(input: string, today: DateKey): QuickParseResult {
  let text = ` ${input.trim()} `;
  let minute: number | null = null;
  let dateKey: DateKey | null = null;

  const time = TIME_RE.exec(text);
  if (time) {
    if (time[1]) {
      let hours = Number(time[1]);
      const minutes = Number(time[2] ?? 0);
      const meridiem = (time[3] ?? '').toLowerCase();
      if (hours >= 1 && hours <= 12 && minutes <= 59) {
        if (meridiem === 'pm' && hours !== 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;
        minute = hours * 60 + minutes;
      }
    } else if (time[4] && time[5]) {
      minute = Number(time[4]) * 60 + Number(time[5]);
    }
    if (minute != null) text = text.replace(time[0], ' ');
  }

  const date = DATE_RE.exec(text);
  if (date && date[1]) {
    // "friday" and "next friday" both mean the coming Friday; naming
    // today's weekday means one week from today.
    const word = date[1].toLowerCase().replace(/^next\s+/, '');
    if (word === 'today' || word === 'tonight') {
      dateKey = today;
      if (word === 'tonight' && minute == null) minute = 20 * 60;
    } else if (word === 'tomorrow' || word === 'tmrw') {
      dateKey = addDays(today, 1);
    } else {
      const target = WEEKDAYS[word];
      if (target != null) {
        const delta = (target - weekdayOf(today) + 7) % 7 || 7;
        dateKey = addDays(today, delta);
      }
    }
    text = text.replace(date[0], ' ');
  }

  const isDue = DUE_RE.test(text);
  if (isDue) text = text.replace(DUE_RE, ' ');

  if (minute != null && dateKey == null) dateKey = today;

  const title = text.replace(/\s+/g, ' ').replace(/\s+(?:at|on|by)$/i, '').trim();
  const kind: QuickKind = isDue || minute == null ? 'task' : 'event';
  return { kind, title, dateKey, minute };
}
