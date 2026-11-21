import type { CardSeries } from '@/lib/achievements';

export interface SeriesStyle {
  /** Card body gradient, top-left → bottom-right */
  background: [string, string, string];
  /** Metallic highlight → shadow, used for emblem strokes and type */
  metal: [string, string];
  /** Text colour for the title on this card */
  ink: string;
  /** Muted text on card */
  inkMuted: string;
  glow: string;
  code: string;
}

/**
 * Material identity of each collection series. Cards are always rendered on
 * their own dark "stock" regardless of app theme, like a physical card.
 */
export const SERIES_STYLES: Record<CardSeries, SeriesStyle> = {
  obsidian: {
    background: ['#1E1C14', '#121213', '#0B0B0C'],
    metal: ['#F7DE6A', '#B38A24'],
    ink: '#F5EBC4',
    inkMuted: '#A99D74',
    glow: 'rgba(244,213,77,0.20)',
    code: 'OBS',
  },
  platinum: {
    background: ['#22262B', '#15171A', '#0D0E10'],
    metal: ['#F1F3F6', '#8E98A3'],
    ink: '#EEF1F4',
    inkMuted: '#98A1AB',
    glow: 'rgba(220,228,236,0.16)',
    code: 'PLT',
  },
  aurora: {
    background: ['#102029', '#120F22', '#0A0A12'],
    metal: ['#86ECFF', '#A78BFA'],
    ink: '#E4F8FF',
    inkMuted: '#8FA9C2',
    glow: 'rgba(116,230,255,0.20)',
    code: 'AUR',
  },
  signature: {
    background: ['#2A230E', '#16130A', '#0C0B08'],
    metal: ['#FBEFB1', '#D9AE2E'],
    ink: '#FFF6D6',
    inkMuted: '#BDAA6E',
    glow: 'rgba(249,233,156,0.22)',
    code: 'SIG',
  },
  legacy: {
    background: ['#2B1D12', '#17110C', '#0D0A08'],
    metal: ['#F0C08E', '#9C6B3C'],
    ink: '#F8E4CF',
    inkMuted: '#B08E70',
    glow: 'rgba(231,176,122,0.20)',
    code: 'LGC',
  },
  moment: {
    background: ['#241A1D', '#151316', '#0C0B0D'],
    metal: ['#F6C6B4', '#C98270'],
    ink: '#FBE7DF',
    inkMuted: '#B6948B',
    glow: 'rgba(242,184,162,0.20)',
    code: 'MOM',
  },
};
