import { memo } from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { usePreferences } from '@/store/preferences';
import type { Palette } from '@/theme/palette';
import { usePalette } from '@/theme/ThemeProvider';
import { textStyleFor, type TextVariant } from '@/theme/tokens';

export type TextTone = 'primary' | 'secondary' | 'muted' | 'accent' | 'onAccent' | 'danger' | 'success' | 'tertiary';

function toneColor(palette: Palette, tone: TextTone): string {
  switch (tone) {
    case 'primary':
      return palette.text;
    case 'secondary':
      return palette.textSecondary;
    case 'muted':
      return palette.textMuted;
    case 'accent':
      return palette.accentText;
    case 'onAccent':
      return palette.onAccent;
    case 'danger':
      return palette.dangerText;
    case 'success':
      return palette.success;
    case 'tertiary':
      return palette.tertiary;
  }
}

export interface DSTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /** Explicit colour, overrides tone */
  color?: string;
  align?: TextStyle['textAlign'];
  /** Force Latin display font (numbers, brand) even in Hindi */
  latin?: boolean;
  strike?: boolean;
}

/**
 * Typography primitive. Picks Manrope / Space Grotesk / Noto Sans Devanagari
 * from the variant and current language, caps font scaling at 1.35× so
 * system-wide large text stays readable without breaking layouts.
 */
export const Text = memo(function Text({
  variant = 'body',
  tone = 'primary',
  color,
  align,
  latin,
  strike,
  style,
  maxFontSizeMultiplier = 1.35,
  ...rest
}: DSTextProps) {
  const palette = usePalette();
  const { preferences } = usePreferences();
  const base = textStyleFor(variant, latin ? 'en' : preferences.language);
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        base,
        { color: color ?? toneColor(palette, tone) },
        align ? { textAlign: align } : null,
        strike ? { textDecorationLine: 'line-through' } : null,
        style,
      ]}
      {...rest}
    />
  );
});
