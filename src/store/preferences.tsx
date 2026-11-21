/**
 * Typed user preferences, persisted to the `preferences` table.
 *
 * Values are loaded once during bootstrap (behind the splash screen) and
 * written through on change. Every stored value is validated against the
 * type of its default; anything unexpected (corrupt row, restored backup from
 * an older version) silently falls back to the default.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { loadAllPreferences, savePreference } from '@/db/repositories/preferencesRepo';
import { isValidTimeZone, DEFAULT_TIME_ZONE } from '@/lib/timezone';
import type { AppearanceMode, ThemePresetId } from '@/theme/palette';
import { THEME_PRESETS } from '@/theme/palette';

export type Language = 'en' | 'hi';
export type MotionPreference = 'full' | 'reduced' | 'off';
export type CardStyle = 'border' | 'soft';

export interface ThemeOverrides {
  accent: string | null;
  background: string | null;
  surface: string | null;
  highlight: string | null;
}

export type DashboardModule = 'schedule' | 'tasks' | 'countdown' | 'habits' | 'mood' | 'fitness' | 'quote' | 'journey';
export const DASHBOARD_MODULES: DashboardModule[] = ['schedule', 'tasks', 'countdown', 'habits', 'mood', 'fitness', 'journey', 'quote'];

export interface Preferences {
  onboardingComplete: boolean;
  userName: string;
  avatarUri: string | null;
  language: Language;
  timeZone: string;
  weekStart: 0 | 1;
  timeFormat: '12h' | '24h';
  appearance: AppearanceMode;
  themePresetId: ThemePresetId;
  themeOverrides: ThemeOverrides;
  activeCustomThemeId: string | null;
  motion: MotionPreference;
  cardStyle: CardStyle;
  haptics: boolean;
  defaultReminderOffset: number;
  remindersTasks: boolean;
  remindersEvents: boolean;
  remindersClasses: boolean;
  remindersHabits: boolean;
  remindersCountdowns: boolean;
  remindersWorkouts: boolean;
  moodReminderEnabled: boolean;
  moodReminderMinute: number;
  dailyQuoteEnabled: boolean;
  hiddenDashboardModules: DashboardModule[];
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  roundsBeforeLongBreak: number;
  dailyFocusGoalMinutes: number;
  hydrationGoalMl: number;
  semesterStart: string | null;
  semesterName: string;
  shareShowName: boolean;
  shareShowAvatar: boolean;
  shareShowStreak: boolean;
  notificationsAsked: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  onboardingComplete: false,
  userName: '',
  avatarUri: null,
  language: 'en',
  timeZone: DEFAULT_TIME_ZONE,
  weekStart: 1,
  timeFormat: '12h',
  appearance: 'dark',
  themePresetId: 'obsidian_gold',
  themeOverrides: { accent: null, background: null, surface: null, highlight: null },
  activeCustomThemeId: null,
  motion: 'full',
  cardStyle: 'border',
  haptics: true,
  defaultReminderOffset: 15,
  remindersTasks: true,
  remindersEvents: true,
  remindersClasses: true,
  remindersHabits: true,
  remindersCountdowns: true,
  remindersWorkouts: true,
  moodReminderEnabled: true,
  moodReminderMinute: 22 * 60,
  dailyQuoteEnabled: true,
  hiddenDashboardModules: [],
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
  dailyFocusGoalMinutes: 120,
  hydrationGoalMl: 3000,
  semesterStart: null,
  semesterName: '',
  shareShowName: true,
  shareShowAvatar: false,
  shareShowStreak: true,
  notificationsAsked: false,
};

const ENUMS: Partial<Record<keyof Preferences, readonly unknown[]>> = {
  language: ['en', 'hi'],
  weekStart: [0, 1],
  timeFormat: ['12h', '24h'],
  appearance: ['dark', 'light', 'system'],
  themePresetId: THEME_PRESETS.map((preset) => preset.id),
  motion: ['full', 'reduced', 'off'],
  cardStyle: ['border', 'soft'],
};

function sanitize(raw: Record<string, unknown>): Preferences {
  const result: Preferences = { ...DEFAULT_PREFERENCES };
  const target = result as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_PREFERENCES) as (keyof Preferences)[]) {
    const value = raw[key];
    const fallback = DEFAULT_PREFERENCES[key];
    if (value === undefined) continue;
    const allowed = ENUMS[key];
    if (allowed) {
      if (allowed.includes(value)) target[key] = value;
      continue;
    }
    if (fallback === null) {
      if (value === null || typeof value === 'string') target[key] = value;
      continue;
    }
    if (Array.isArray(fallback)) {
      if (Array.isArray(value)) target[key] = value.filter((item) => typeof item === 'string');
      continue;
    }
    if (typeof fallback === 'object') {
      if (value && typeof value === 'object') target[key] = { ...fallback, ...(value as object) };
      continue;
    }
    if (typeof value === typeof fallback) target[key] = value;
  }
  if (!isValidTimeZone(result.timeZone)) result.timeZone = DEFAULT_TIME_ZONE;
  result.moodReminderMinute = Math.max(0, Math.min(1439, Math.round(result.moodReminderMinute)));
  return result;
}

export async function loadPreferences(): Promise<Preferences> {
  return sanitize(await loadAllPreferences());
}

interface PreferencesContextValue {
  preferences: Preferences;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => Promise<void>;
  setPreferences: (patch: Partial<Preferences>) => Promise<void>;
  replaceAll: (next: Preferences) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ initial, children }: { initial: Preferences; children: ReactNode }) {
  const [preferences, setState] = useState(initial);

  const setPreferences = useCallback(async (patch: Partial<Preferences>) => {
    setState((current) => ({ ...current, ...patch }));
    await Promise.all(Object.entries(patch).map(([key, value]) => savePreference(key, value)));
  }, []);

  const setPreference = useCallback(
    async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      await setPreferences({ [key]: value } as Partial<Preferences>);
    },
    [setPreferences],
  );

  const replaceAll = useCallback((next: Preferences) => setState(next), []);

  const value = useMemo(
    () => ({ preferences, setPreference, setPreferences, replaceAll }),
    [preferences, setPreference, setPreferences, replaceAll],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider');
  return context;
}
