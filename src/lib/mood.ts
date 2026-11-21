import type { MoodLevel } from '@/types/models';

export interface MoodOption {
  level: MoodLevel;
  emoji: string;
  /** i18n key */
  label: 'mood.level1' | 'mood.level2' | 'mood.level3' | 'mood.level4' | 'mood.level5';
}

export const MOODS: readonly MoodOption[] = [
  { level: 1, emoji: '😫', label: 'mood.level1' },
  { level: 2, emoji: '😕', label: 'mood.level2' },
  { level: 3, emoji: '😐', label: 'mood.level3' },
  { level: 4, emoji: '😌', label: 'mood.level4' },
  { level: 5, emoji: '🤩', label: 'mood.level5' },
];

export function moodEmoji(level: number | null | undefined): string | undefined {
  return MOODS.find((mood) => mood.level === level)?.emoji;
}

export const MOOD_TAGS = [
  'productive',
  'peaceful',
  'motivated',
  'grateful',
  'excited',
  'grounded',
  'tired',
  'stressed',
  'anxious',
  'social',
  'creative',
  'sick',
] as const;

export type MoodTag = (typeof MOOD_TAGS)[number];
