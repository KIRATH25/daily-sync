/**
 * Colour parsing, mixing and WCAG contrast helpers used by the theme engine
 * and the custom HEX input in Theme Studio.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHex(value: string): boolean {
  return HEX_RE.test(value.trim());
}

/** "#abc" / "abc" / "#AABBCC" → "#AABBCC". Returns null for invalid input. */
export function normalizeHex(value: string): string | null {
  const match = HEX_RE.exec(value.trim());
  if (!match || !match[1]) return null;
  let digits = match[1];
  if (digits.length === 3) {
    digits = digits
      .split('')
      .map((char) => char + char)
      .join('');
  }
  return `#${digits.toUpperCase()}`;
}

export function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error(`Invalid colour: ${hex}`);
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function rgbToHex({ r, g, b }: RGB): string {
  return `#${[r, g, b].map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Linear blend: amount 0 → a, 1 → b. */
export function mix(a: string, b: string, amount: number): string {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex({
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  });
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function channelLuminance(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio, 1 – 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.22;
}

/** Whichever of the two candidates reads better on `background`. */
export function bestTextOn(background: string, light = '#F5F3EE', dark = '#191A1C'): string {
  return contrastRatio(background, light) >= contrastRatio(background, dark) ? light : dark;
}

/**
 * Moves `color` towards black or white until it reaches `minRatio` against
 * `background`. Used so an accent remains legible as text on any surface.
 */
export function ensureContrast(color: string, background: string, minRatio: number): string {
  if (contrastRatio(color, background) >= minRatio) return color;
  const target = isDark(background) ? '#FFFFFF' : '#000000';
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mix(color, target, step / 20);
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  return target;
}
