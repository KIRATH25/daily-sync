import { createId } from '@/lib/id';
import type { CustomTheme } from '@/types/models';

import { notifyChange } from '../changes';
import { db } from '../driver';

interface ThemeRow {
  id: string;
  name: string;
  base_preset: string;
  accent: string | null;
  background: string | null;
  surface: string | null;
  highlight: string | null;
}

const mapTheme = (row: ThemeRow): CustomTheme => ({
  id: row.id,
  name: row.name,
  basePreset: row.base_preset,
  accent: row.accent,
  background: row.background,
  surface: row.surface,
  highlight: row.highlight,
});

export type CustomThemeInput = Omit<CustomTheme, 'id'>;

export async function listCustomThemes(): Promise<CustomTheme[]> {
  const rows = await db().all<ThemeRow>('SELECT * FROM custom_themes ORDER BY created_at');
  return rows.map(mapTheme);
}

export async function getCustomTheme(id: string): Promise<CustomTheme | null> {
  const row = await db().first<ThemeRow>('SELECT * FROM custom_themes WHERE id = ?', [id]);
  return row ? mapTheme(row) : null;
}

export async function saveCustomTheme(id: string | null, input: CustomThemeInput): Promise<string> {
  const now = Date.now();
  if (id) {
    await db().run(
      'UPDATE custom_themes SET name = ?, base_preset = ?, accent = ?, background = ?, surface = ?, highlight = ?, updated_at = ? WHERE id = ?',
      [input.name, input.basePreset, input.accent, input.background, input.surface, input.highlight, now, id],
    );
    notifyChange('custom_themes');
    return id;
  }
  const newId = createId('thm');
  await db().run(
    `INSERT INTO custom_themes (id, name, base_preset, accent, background, surface, highlight, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId, input.name, input.basePreset, input.accent, input.background, input.surface, input.highlight, now, now],
  );
  notifyChange('custom_themes');
  return newId;
}

export async function deleteCustomTheme(id: string): Promise<void> {
  await db().run('DELETE FROM custom_themes WHERE id = ?', [id]);
  notifyChange('custom_themes');
}
