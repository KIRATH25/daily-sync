/**
 * Layout, radius and type tokens. Colours come from the palette; these
 * values are shared by every theme so the product keeps one rhythm.
 */
import type { TextStyle } from 'react-native';

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  gutter: 18,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/** Minimum touch target (Material guideline) */
export const TOUCH_TARGET = 48;

export const fonts = {
  displayBold: 'SpaceGrotesk_700Bold',
  displaySemi: 'SpaceGrotesk_600SemiBold',
  displayMedium: 'SpaceGrotesk_500Medium',
  displayRegular: 'SpaceGrotesk_400Regular',
  bodyRegular: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  bodyExtraBold: 'Manrope_800ExtraBold',
  hindiRegular: 'NotoSansDevanagari_400Regular',
  hindiMedium: 'NotoSansDevanagari_500Medium',
  hindiSemi: 'NotoSansDevanagari_600SemiBold',
  hindiBold: 'NotoSansDevanagari_700Bold',
} as const;

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'title'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'smallStrong'
  | 'label'
  | 'micro'
  | 'stat'
  | 'statLarge';

interface VariantSpec {
  latin: string;
  hindi: string;
  size: number;
  lineHeight: number;
  letterSpacing?: number;
  uppercase?: boolean;
}

export const typeScale: Record<TextVariant, VariantSpec> = {
  display: { latin: fonts.displayBold, hindi: fonts.hindiBold, size: 34, lineHeight: 40, letterSpacing: -0.6 },
  h1: { latin: fonts.displayBold, hindi: fonts.hindiBold, size: 28, lineHeight: 34, letterSpacing: -0.4 },
  h2: { latin: fonts.displaySemi, hindi: fonts.hindiSemi, size: 22, lineHeight: 28, letterSpacing: -0.2 },
  h3: { latin: fonts.displaySemi, hindi: fonts.hindiSemi, size: 18, lineHeight: 24 },
  title: { latin: fonts.bodyBold, hindi: fonts.hindiSemi, size: 16, lineHeight: 22 },
  body: { latin: fonts.bodyMedium, hindi: fonts.hindiRegular, size: 15, lineHeight: 22 },
  bodyStrong: { latin: fonts.bodySemi, hindi: fonts.hindiMedium, size: 15, lineHeight: 22 },
  small: { latin: fonts.bodyMedium, hindi: fonts.hindiRegular, size: 13, lineHeight: 18 },
  smallStrong: { latin: fonts.bodyBold, hindi: fonts.hindiSemi, size: 13, lineHeight: 18 },
  label: { latin: fonts.displaySemi, hindi: fonts.hindiSemi, size: 11.5, lineHeight: 16, letterSpacing: 1.3, uppercase: true },
  micro: { latin: fonts.displayMedium, hindi: fonts.hindiMedium, size: 10.5, lineHeight: 14, letterSpacing: 0.8, uppercase: true },
  stat: { latin: fonts.displayBold, hindi: fonts.displayBold, size: 26, lineHeight: 30, letterSpacing: -0.5 },
  statLarge: { latin: fonts.displayBold, hindi: fonts.displayBold, size: 48, lineHeight: 52, letterSpacing: -1.5 },
};

export function textStyleFor(variant: TextVariant, language: 'en' | 'hi'): TextStyle {
  const spec = typeScale[variant];
  const hindi = language === 'hi';
  return {
    fontFamily: hindi ? spec.hindi : spec.latin,
    fontSize: spec.size,
    // Devanagari needs extra vertical room for matras above and below.
    lineHeight: hindi && spec.hindi !== spec.latin ? Math.round(spec.lineHeight * 1.18) : spec.lineHeight,
    letterSpacing: hindi ? 0 : spec.letterSpacing,
    textTransform: spec.uppercase && !hindi ? 'uppercase' : 'none',
  };
}
