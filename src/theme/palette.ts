/**
 * Theme engine.
 *
 * Every palette — the six presets and any custom theme — is produced by one
 * builder from a handful of seed colours. The builder derives surfaces,
 * borders and text, and enforces WCAG contrast so no combination of custom
 * HEX values can make important text unreadable:
 *   - primary text ≥ 7:1 on the background, secondary ≥ 4.5:1
 *   - text on accent buttons is black or white, whichever reads better
 *   - `accentText` (accent used as text) is nudged to ≥ 4.5:1
 * Custom surfaces that would break contrast are rejected by
 * `validateCustomColors` before they are ever applied.
 */
import { bestTextOn, contrastRatio, ensureContrast, isDark, mix, withAlpha } from '@/lib/color';

export type ThemePresetId = 'obsidian_gold' | 'studio_ivory' | 'violet_orbit' | 'forest' | 'ocean' | 'rose_quartz';

export interface ThemePreset {
  id: ThemePresetId;
  /** Marker colour on the radial selector */
  swatch: string;
  preferred: 'dark' | 'light';
  /** `surface` pins an exact card colour from the design spec; otherwise derived. */
  dark: { background: string; accent: string; surface?: string };
  light: { background: string; accent: string; surface?: string };
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: 'obsidian_gold',
    swatch: '#F4D54D',
    preferred: 'dark',
    dark: { background: '#0C0D0F', accent: '#F4D54D', surface: '#151719' },
    light: { background: '#F5F2EB', accent: '#E2B92B', surface: '#FFFDF9' },
  },
  {
    id: 'studio_ivory',
    swatch: '#F5F2EB',
    preferred: 'light',
    dark: { background: '#100F0E', accent: '#D9785E' },
    light: { background: '#F5F2EB', accent: '#D9785E', surface: '#FFFDF9' },
  },
  {
    id: 'violet_orbit',
    swatch: '#A78BFA',
    preferred: 'dark',
    dark: { background: '#0D0B14', accent: '#A78BFA' },
    light: { background: '#F4F2FA', accent: '#7C5CE0' },
  },
  {
    id: 'forest',
    swatch: '#4FBF8A',
    preferred: 'dark',
    dark: { background: '#0A100D', accent: '#5FCF96' },
    light: { background: '#F1F5F0', accent: '#2F9E6A' },
  },
  {
    id: 'ocean',
    swatch: '#3EA8E8',
    preferred: 'dark',
    dark: { background: '#090F15', accent: '#56B7F0' },
    light: { background: '#F0F5F8', accent: '#1F86C7' },
  },
  {
    id: 'rose_quartz',
    swatch: '#E8796E',
    preferred: 'dark',
    dark: { background: '#130D0E', accent: '#F09A92' },
    light: { background: '#F8F1EF', accent: '#D8645A' },
  },
];

export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? (THEME_PRESETS[0] as ThemePreset);
}

export interface Palette {
  scheme: 'dark' | 'light';
  background: string;
  surface: string;
  surfaceAlt: string;
  elevated: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentMuted: string;
  accentText: string;
  onAccent: string;
  highlight: string;
  onHighlight: string;
  tertiary: string;
  danger: string;
  dangerSoft: string;
  dangerText: string;
  success: string;
  warning: string;
  overlay: string;
  shadow: string;
  category: {
    academics: string;
    work: string;
    personal: string;
    fitness: string;
    mindful: string;
    social: string;
    health: string;
    finance: string;
  };
  priority: { critical: string; high: string; medium: string; low: string };
}

export interface PaletteSeeds {
  background: string;
  accent: string;
  surface?: string | null;
  highlight?: string | null;
}

export function buildPalette(seeds: PaletteSeeds): Palette {
  const dark = isDark(seeds.background);
  const background = seeds.background;
  const ink = dark ? '#F5F3EE' : '#191A1C';
  // Ratios reproduce the Obsidian Gold spec from #0C0D0F:
  // surface #151719, surfaceAlt #1D2023, elevated #25282B, border #303336.
  const baseSurface = seeds.surface ?? (dark ? mix(background, ink, 0.04) : mix(background, '#FFFFFF', 0.85));
  const surfaceAlt = dark ? mix(baseSurface, ink, 0.036) : mix(background, ink, 0.03);
  const elevated = dark ? mix(baseSurface, ink, 0.072) : mix(baseSurface, '#FFFFFF', 0.6);
  const text = ensureContrast(ink, background, 7);
  const textSecondary = ensureContrast(dark ? '#A5A7A8' : '#6E6B66', background, 4.5);
  const textMuted = ensureContrast(dark ? '#73777A' : '#8E8A84', background, 3);
  const accent = seeds.accent;
  const highlight = seeds.highlight ?? mix(accent, background, dark ? 0.78 : 0.75);
  const danger = dark ? '#F28B82' : '#C8473B';

  return {
    scheme: dark ? 'dark' : 'light',
    background,
    surface: baseSurface,
    surfaceAlt,
    elevated,
    border: dark ? mix(baseSurface, ink, 0.12) : mix(background, ink, 0.1),
    borderStrong: dark ? mix(baseSurface, ink, 0.22) : mix(background, ink, 0.2),
    text,
    textSecondary,
    textMuted,
    accent,
    accentSoft: mix(accent, '#FFFFFF', dark ? 0.45 : 0.55),
    accentMuted: withAlpha(accent, dark ? 0.16 : 0.18),
    accentText: ensureContrast(accent, baseSurface, 4.5),
    onAccent: bestTextOn(accent, '#FFFFFF', '#1A1708'),
    highlight,
    onHighlight: bestTextOn(highlight),
    tertiary: dark ? '#74E6FF' : '#0B8FAF',
    danger,
    dangerSoft: withAlpha(danger, 0.16),
    dangerText: ensureContrast(danger, baseSurface, 4.5),
    success: dark ? '#7FD6A0' : '#2E8B57',
    warning: dark ? '#F5B65C' : '#B36B00',
    overlay: dark ? 'rgba(0,0,0,0.62)' : 'rgba(25,26,28,0.38)',
    shadow: dark ? '#000000' : '#5A5245',
    category: {
      academics: ensureContrast(accent, baseSurface, 3),
      work: dark ? '#B8A5FF' : '#6B4FD8',
      personal: dark ? '#CFC27A' : '#8C7A1E',
      fitness: dark ? '#F4A3A3' : '#C2504A',
      mindful: dark ? '#74E6FF' : '#0B8FAF',
      social: dark ? '#F7B98B' : '#C06A26',
      health: dark ? '#8FE0A8' : '#2E8B57',
      finance: dark ? '#9DC4FF' : '#2F6FC4',
    },
    priority: {
      critical: danger,
      high: dark ? '#F5A35C' : '#C46A12',
      medium: ensureContrast(accent, baseSurface, 3),
      low: dark ? '#74E6FF' : '#0B8FAF',
    },
  };
}

export type AppearanceMode = 'dark' | 'light' | 'system';

export interface ThemeSelection {
  presetId: ThemePresetId;
  appearance: AppearanceMode;
  overrides?: { accent?: string | null; background?: string | null; surface?: string | null; highlight?: string | null } | null;
}

export function resolvePalette(selection: ThemeSelection, systemScheme: 'dark' | 'light'): Palette {
  const preset = getPreset(selection.presetId);
  const scheme = selection.appearance === 'system' ? systemScheme : selection.appearance;
  const base = scheme === 'dark' ? preset.dark : preset.light;
  const overrides = selection.overrides ?? {};
  return buildPalette({
    background: overrides.background ?? base.background,
    accent: overrides.accent ?? base.accent,
    // A custom background invalidates the preset's pinned surface.
    surface: overrides.surface ?? (overrides.background ? null : (base.surface ?? null)),
    highlight: overrides.highlight ?? null,
  });
}

export type CustomColorProblem = 'surfaceContrast' | 'surfaceTooClose' | null;

/** Rejects custom surface colours that would make text unreadable. */
export function validateCustomColors(seeds: PaletteSeeds): CustomColorProblem {
  if (!seeds.surface) return null;
  const text = isDark(seeds.background) ? '#F5F3EE' : '#191A1C';
  if (contrastRatio(seeds.surface, text) < 4.5) return 'surfaceContrast';
  if (isDark(seeds.surface) !== isDark(seeds.background)) return 'surfaceTooClose';
  return null;
}
