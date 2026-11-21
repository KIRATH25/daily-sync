/**
 * Localisation (English / हिन्दी).
 *
 * Dictionaries are flat `key → string` maps. `en` is the source of truth and
 * `hi` is typed as `Record<TKey, string>`, so a missing Hindi translation is
 * a compile error rather than a runtime surprise. User-created content is
 * never translated.
 *
 * Date keys carry no time zone, so they are formatted in UTC; instants are
 * formatted in the user's preferred zone.
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { parseDateKey, type DateKey } from '@/lib/dates';
import { usePreferences, type Language } from '@/store/preferences';

import { en, type TKey } from './en';
import { hi } from './hi';

export type { TKey };

const dictionaries: Record<Language, Record<TKey, string>> = { en, hi };

export type TParams = Record<string, string | number>;

export function translate(language: Language, key: TKey, params?: TParams): string {
  const template = dictionaries[language][key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] !== undefined ? String(params[name]) : match,
  );
}

/** Picks `${base}.one` or `${base}.other` by count. */
export function pluralKey(base: string, count: number): TKey {
  return `${base}.${count === 1 ? 'one' : 'other'}` as TKey;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

export type DateStyle =
  | 'full' // Saturday, 21 November 2025
  | 'long' // Saturday, 21 November
  | 'medium' // 21 Nov 2025
  | 'dayMonth' // 21 Nov
  | 'weekdayDay' // Sat 21
  | 'monthYear' // November 2025
  | 'weekdayShort' // Sat
  | 'weekdayNarrow' // S
  | 'monthShort'; // Nov

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  long: { weekday: 'long', day: 'numeric', month: 'long' },
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  dayMonth: { day: 'numeric', month: 'short' },
  weekdayDay: { weekday: 'short', day: 'numeric' },
  monthYear: { month: 'long', year: 'numeric' },
  weekdayShort: { weekday: 'short' },
  weekdayNarrow: { weekday: 'narrow' },
  monthShort: { month: 'short' },
};

export interface Formatters {
  language: Language;
  locale: string;
  t: (key: TKey, params?: TParams) => string;
  tp: (base: string, count: number, params?: TParams) => string;
  formatDate: (key: DateKey, style?: DateStyle) => string;
  formatTime: (minuteOfDay: number) => string;
  formatInstant: (ms: number, withDate?: boolean) => string;
  formatNumber: (value: number, maxFractionDigits?: number) => string;
  formatPercent: (ratio: number) => string;
  formatDuration: (seconds: number) => string;
  formatRelative: (deltaMs: number) => string;
  weekdayName: (weekday: number, style?: 'short' | 'narrow' | 'long') => string;
}

function createFormatters(language: Language, timeFormat: '12h' | '24h', timeZone: string): Formatters {
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  const t = (key: TKey, params?: TParams) => translate(language, key, params);
  const tp = (base: string, count: number, params?: TParams) =>
    translate(language, pluralKey(base, count), { count, ...params });

  const formatDate = (key: DateKey, style: DateStyle = 'long') => {
    const { year, month, day } = parseDateKey(key);
    return dateFormatter(locale, { ...DATE_OPTIONS[style], timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
  };

  const formatTime = (minuteOfDay: number) => {
    const safe = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
    return dateFormatter(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: timeFormat === '24h' ? 'h23' : 'h12',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(1970, 0, 1, 0, safe)));
  };

  const formatInstant = (ms: number, withDate = false) =>
    dateFormatter(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: timeFormat === '24h' ? 'h23' : 'h12',
      timeZone,
      ...(withDate ? { day: 'numeric', month: 'short' } : {}),
    }).format(new Date(ms));

  const numberFormatters = new Map<number, Intl.NumberFormat>();
  const formatNumber = (value: number, maxFractionDigits = 1) => {
    let formatter = numberFormatters.get(maxFractionDigits);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: maxFractionDigits });
      numberFormatters.set(maxFractionDigits, formatter);
    }
    return formatter.format(value);
  };

  const formatPercent = (ratio: number) => `${formatNumber(Math.round(ratio * 100), 0)}%`;

  const formatDuration = (seconds: number) => {
    const totalMinutes = Math.max(0, Math.round(seconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return t('duration.minutes', { m: minutes });
    if (minutes === 0) return t('duration.hours', { h: hours });
    return t('duration.hoursMinutes', { h: hours, m: minutes });
  };

  const formatRelative = (deltaMs: number) => {
    const future = deltaMs >= 0;
    const minutes = Math.round(Math.abs(deltaMs) / 60_000);
    let value: string;
    if (minutes < 1) return t('relative.now');
    if (minutes < 60) value = t('duration.minutes', { m: minutes });
    else if (minutes < 60 * 24) {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      value = rest ? t('duration.hoursMinutes', { h: hours, m: rest }) : t('duration.hours', { h: hours });
    } else value = tp('unit.days', Math.round(minutes / 1440));
    return t(future ? 'relative.in' : 'relative.ago', { value });
  };

  const weekdayName = (weekday: number, style: 'short' | 'narrow' | 'long' = 'short') =>
    dateFormatter(locale, { weekday: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + weekday)));

  return {
    language,
    locale,
    t,
    tp,
    formatDate,
    formatTime,
    formatInstant,
    formatNumber,
    formatPercent,
    formatDuration,
    formatRelative,
    weekdayName,
  };
}

const I18nContext = createContext<Formatters | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const value = useMemo(
    () => createFormatters(preferences.language, preferences.timeFormat, preferences.timeZone),
    [preferences.language, preferences.timeFormat, preferences.timeZone],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Formatters {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}

/** Translator usable outside React (notifications, background work). */
export function useTranslator() {
  const { t } = useI18n();
  return useCallback((key: TKey, params?: TParams) => t(key, params), [t]);
}

export { createFormatters };
