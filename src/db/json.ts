/** Defensive JSON column helpers: malformed data degrades to a safe default. */

export function parseJsonArray<T>(value: string | null | undefined, guard: (item: unknown) => item is T): T[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}

export const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const isString = (value: unknown): value is string => typeof value === 'string';

export function toJson(value: unknown): string {
  return JSON.stringify(value);
}

export function bool(value: number | null | undefined): boolean {
  return value === 1;
}

export function flag(value: boolean): number {
  return value ? 1 : 0;
}
