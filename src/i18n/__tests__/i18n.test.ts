import { ACHIEVEMENTS } from '@/lib/achievements';
import { MOOD_TAGS } from '@/lib/mood';
import { THEME_PRESETS } from '@/theme/palette';
import { CATEGORIES, COUNTDOWN_STYLES, PRIORITIES } from '@/types/models';

import { en } from '../en';
import { hi } from '../hi';
import { createFormatters, translate } from '../index';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('have identical keys', () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
  });

  it('have no empty strings', () => {
    for (const [key, value] of Object.entries(en)) expect([key, value.trim().length > 0]).toEqual([key, true]);
    for (const [key, value] of Object.entries(hi)) expect([key, value.trim().length > 0]).toEqual([key, true]);
  });

  it('use the same placeholders in English and Hindi', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect([key, placeholders(hi[key])]).toEqual([key, placeholders(en[key])]);
    }
  });

  it('cover every dynamic key family used by the UI', () => {
    const expected: string[] = [
      ...ACHIEVEMENTS.flatMap((a) => ['name', 'tagline', 'description', 'requirement', 'shareLine'].map((f) => `achievement.${a.id}.${f}`)),
      ...['obsidian', 'platinum', 'aurora', 'signature', 'legacy', 'moment'].map((s) => `series.${s}`),
      ...CATEGORIES.map((c) => `category.${c}`),
      ...PRIORITIES.map((p) => `priority.${p}`),
      ...COUNTDOWN_STYLES.map((s) => `countdownStyle.${s}`),
      ...THEME_PRESETS.map((p) => `theme.${p.id}`),
      ...MOOD_TAGS.map((tag) => `moodTag.${tag}`),
      ...[1, 2, 3, 4, 5].map((level) => `mood.level${level}`),
      ...['event', 'reminder', 'note', 'goal', 'workout', 'task', 'class', 'mood', 'habit'].map((k) => `timeline.${k}`),
      ...['event', 'task', 'reminder', 'habit', 'class', 'workout', 'note', 'goal'].flatMap((k) => [`create.cta.${k}`, `create.created.${k}`, `create.placeholder.${k}`]),
      ...['today', 'upcoming', 'overdue', 'completed', 'all'].flatMap((k) => [`tasks.tab.${k}`, `tasks.empty.${k}`]),
      ...['schedule', 'tasks', 'countdown', 'habits', 'mood', 'fitness', 'quote', 'journey'].map((k) => `dashboard.${k}`),
      ...['focus', 'short_break', 'long_break', 'stopwatch'].map((k) => `focusMode.${k}`),
      ...['pomodoro', 'custom', 'stopwatch'].map((k) => `focus.kind.${k}`),
      ...['task', 'event', 'reminder', 'habit', 'class', 'exam', 'workout', 'countdown', 'mood', 'achievement', 'system'].map((k) => `inbox.${k}`),
      ...['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body'].map((k) => `muscle.${k}`),
      ...['lecture', 'lab', 'tutorial', 'seminar'].map((k) => `slot.${k}`),
      ...['assignment', 'exam', 'quiz', 'project'].map((k) => `assignmentKind.${k}`),
      ...['present', 'absent', 'cancelled'].map((k) => `attendance.${k}`),
      ...['all', 'tasks', 'events', 'habits', 'college', 'journal', 'countdowns'].map((k) => `search.scope.${k}`),
      ...['all', 'reminders', 'tasks', 'college', 'wellbeing', 'achievements'].map((k) => `notifications.filter.${k}`),
      ...['daily', 'weekly', 'monthly', 'yearly'].map((k) => `repeat.${k}`),
      ...['light', 'dark', 'system'].map((k) => `appearance.${k}`),
      ...['granted', 'denied', 'undetermined'].map((k) => `permission.${k}`),
      ...['surfaceContrast', 'surfaceTooClose'].map((k) => `themes.problem.${k}`),
      ...['dark', 'light'].map((k) => `share.finish.${k}`),
      ...['invalidFile', 'wrongApp', 'newerVersion', 'corrupt'].map((k) => `restore.${k}`),
      'calendar.items.one',
      'calendar.items.other',
      'college.classes.one',
      'college.classes.other',
      'unit.days.one',
      'unit.days.other',
    ];
    const missing = expected.filter((key) => !(key in en));
    expect(missing).toEqual([]);
  });
});

describe('formatters', () => {
  it('interpolates parameters', () => {
    expect(translate('en', 'home.greetingMorning', { name: 'Asha' })).toBe('Good morning, Asha');
    expect(translate('hi', 'home.greetingMorning', { name: 'आशा' })).toBe('सुप्रभात, आशा');
  });

  it('pluralises', () => {
    const { tp } = createFormatters('en', '12h', 'Asia/Kolkata');
    expect(tp('calendar.items', 1)).toBe('1 item');
    expect(tp('calendar.items', 3)).toBe('3 items');
  });

  it('formats date keys without shifting the day', () => {
    const { formatDate } = createFormatters('en', '12h', 'America/Los_Angeles');
    // A date key must render as that calendar day regardless of zone.
    expect(formatDate('2025-11-21', 'medium')).toContain('21');
  });

  it('formats times in 12h and 24h', () => {
    expect(createFormatters('en', '24h', 'Asia/Kolkata').formatTime(22 * 60 + 5)).toContain('22:05');
    expect(createFormatters('en', '12h', 'Asia/Kolkata').formatTime(22 * 60 + 5)).toMatch(/10:05/);
  });

  it('formats durations', () => {
    const { formatDuration } = createFormatters('en', '12h', 'Asia/Kolkata');
    expect(formatDuration(45 * 60)).toBe('45 min');
    expect(formatDuration(90 * 60)).toBe('1 h 30 min');
    expect(formatDuration(120 * 60)).toBe('2 h');
  });
});
