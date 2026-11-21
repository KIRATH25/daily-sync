/**
 * Input validation shared by every form and by the backup importer.
 *
 * Validators return an i18n error key instead of a sentence so the same rule
 * produces a properly translated message in English and Hindi.
 */
import { normalizeHex } from './color';
import { isDateKey, type DateKey } from './dates';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: ValidationErrorKey };

export type ValidationErrorKey =
  | 'validation.required'
  | 'validation.tooLong'
  | 'validation.invalidHex'
  | 'validation.invalidDate'
  | 'validation.invalidTime'
  | 'validation.endBeforeStart'
  | 'validation.notANumber'
  | 'validation.outOfRange'
  | 'validation.tooManyReminders'
  | 'validation.pastDate';

export const LIMITS = {
  title: 120,
  description: 2000,
  journal: 20_000,
  tag: 32,
  name: 60,
  location: 120,
  popupMessage: 200,
  reminders: 5,
  /** 30 days, in minutes */
  reminderOffsetMax: 43_200,
} as const;

/** Strips control characters (keeps newlines/tabs) and trims. */
export function sanitizeText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

export function validateRequiredText(value: string, max: number): ValidationResult<string> {
  const clean = sanitizeText(value);
  if (clean.length === 0) return { ok: false, error: 'validation.required' };
  if (clean.length > max) return { ok: false, error: 'validation.tooLong' };
  return { ok: true, value: clean };
}

export function validateOptionalText(value: string | null | undefined, max: number): ValidationResult<string | null> {
  if (value == null) return { ok: true, value: null };
  const clean = sanitizeText(value);
  if (clean.length === 0) return { ok: true, value: null };
  if (clean.length > max) return { ok: false, error: 'validation.tooLong' };
  return { ok: true, value: clean };
}

export function validateTitle(value: string): ValidationResult<string> {
  return validateRequiredText(value, LIMITS.title);
}

export function validateHex(value: string): ValidationResult<string> {
  const normalized = normalizeHex(value);
  return normalized ? { ok: true, value: normalized } : { ok: false, error: 'validation.invalidHex' };
}

export function validateDateKey(value: string): ValidationResult<DateKey> {
  return isDateKey(value) ? { ok: true, value } : { ok: false, error: 'validation.invalidDate' };
}

export function validateMinute(value: number | null | undefined): ValidationResult<number> {
  if (value == null || !Number.isInteger(value) || value < 0 || value > 1439) {
    return { ok: false, error: 'validation.invalidTime' };
  }
  return { ok: true, value };
}

export function validateTimeRange(start: number, end: number): ValidationResult<{ start: number; end: number }> {
  const startResult = validateMinute(start);
  if (!startResult.ok) return startResult;
  const endResult = validateMinute(end);
  if (!endResult.ok) return endResult;
  if (end <= start) return { ok: false, error: 'validation.endBeforeStart' };
  return { ok: true, value: { start, end } };
}

export function validateDateRange(startKey: DateKey, endKey: DateKey): ValidationResult<{ start: DateKey; end: DateKey }> {
  if (!isDateKey(startKey) || !isDateKey(endKey)) return { ok: false, error: 'validation.invalidDate' };
  if (endKey < startKey) return { ok: false, error: 'validation.endBeforeStart' };
  return { ok: true, value: { start: startKey, end: endKey } };
}

/** Parses user-typed numbers ("72.5", "72,5") and checks bounds. */
export function validateNumber(raw: string | number, min: number, max: number): ValidationResult<number> {
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'));
  if (typeof raw === 'string' && raw.trim() === '') return { ok: false, error: 'validation.required' };
  if (!Number.isFinite(value)) return { ok: false, error: 'validation.notANumber' };
  if (value < min || value > max) return { ok: false, error: 'validation.outOfRange' };
  return { ok: true, value };
}

export function validateReminderOffsets(offsets: number[]): ValidationResult<number[]> {
  const unique = [...new Set(offsets)].sort((a, b) => b - a);
  if (unique.length > LIMITS.reminders) return { ok: false, error: 'validation.tooManyReminders' };
  if (unique.some((offset) => !Number.isInteger(offset) || offset < 0 || offset > LIMITS.reminderOffsetMax)) {
    return { ok: false, error: 'validation.outOfRange' };
  }
  return { ok: true, value: unique };
}

/** Sensible physical bounds for fitness inputs. */
export const FITNESS_BOUNDS = {
  weightKg: { min: 0, max: 700 },
  reps: { min: 0, max: 1000 },
  sets: { min: 1, max: 30 },
  bodyWeightKg: { min: 20, max: 400 },
  measurementCm: { min: 10, max: 300 },
  bodyFat: { min: 2, max: 75 },
  hydrationMl: { min: 10, max: 5000 },
  restSeconds: { min: 0, max: 900 },
} as const;
