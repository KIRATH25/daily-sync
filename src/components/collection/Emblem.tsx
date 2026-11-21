import { memo } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Polygon, RadialGradient, Stop } from 'react-native-svg';

import type { EmblemKind } from '@/lib/achievements';

export interface EmblemProps {
  kind: EmblemKind;
  size: number;
  metal: [string, string];
  glow: string;
  locked?: boolean;
  /** Unique per instance so multiple emblems on screen keep their gradients */
  idSuffix: string;
}

/**
 * Engraved-seal emblem: a dotted outer ring with compass ticks, a fine inner
 * ring and a central glyph, all stroked with a two-tone metallic gradient.
 * Pure vector, so it stays sharp in 1080 px exports.
 */
export const Emblem = memo(function Emblem({ kind, size, metal, glow, locked, idSuffix }: EmblemProps) {
  const metalId = `metal-${idSuffix}`;
  const glowId = `glow-${idSuffix}`;
  const stroke = locked ? '#5B5E62' : `url(#${metalId})`;
  const fill = locked ? '#3A3C40' : `url(#${metalId})`;

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id={metalId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={metal[0]} />
          <Stop offset="0.55" stopColor={metal[1]} />
          <Stop offset="1" stopColor={metal[0]} />
        </LinearGradient>
        <RadialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={locked ? 'rgba(0,0,0,0)' : glow} />
          <Stop offset="1" stopColor="rgba(0,0,0,0)" />
        </RadialGradient>
      </Defs>
      <Circle cx="100" cy="100" r="98" fill={`url(#${glowId})`} />
      {/* outer dotted ring */}
      <Circle cx="100" cy="100" r="78" stroke={stroke} strokeWidth="1.4" strokeDasharray="1.5 5" fill="none" opacity={0.85} />
      {/* compass ticks */}
      <G stroke={stroke} strokeWidth="2.2" strokeLinecap="round">
        <Line x1="100" y1="14" x2="100" y2="28" />
        <Line x1="100" y1="172" x2="100" y2="186" />
        <Line x1="14" y1="100" x2="28" y2="100" />
        <Line x1="172" y1="100" x2="186" y2="100" />
      </G>
      {/* inner rings */}
      <Circle cx="100" cy="100" r="62" stroke={stroke} strokeWidth="1.6" fill="none" />
      <Circle cx="100" cy="100" r="56" stroke={stroke} strokeWidth="0.8" fill="none" opacity={0.6} />
      <G stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <Glyph kind={locked ? 'lock' : kind} fill={fill} />
      </G>
    </Svg>
  );
});

function Glyph({ kind, fill }: { kind: EmblemKind | 'lock'; fill: string }) {
  switch (kind) {
    case 'lock':
      return (
        <>
          <Path d="M82 96 V84 a18 18 0 0 1 36 0 V96" />
          <Path d="M76 96 h48 v34 h-48 z" />
          <Circle cx="100" cy="112" r="4" fill={fill} />
        </>
      );
    case 'flag':
      return (
        <>
          <Line x1="80" y1="70" x2="80" y2="136" />
          <Path d="M80 72 C96 64 106 82 124 74 V106 C106 114 96 96 80 104" fill={fill} fillOpacity={0.18} />
        </>
      );
    case 'spark':
      return <Path d="M100 66 L108 92 L134 100 L108 108 L100 134 L92 108 L66 100 L92 92 Z" fill={fill} fillOpacity={0.22} />;
    case 'flame':
      return (
        <>
          <Path d="M100 64 C118 84 128 98 124 116 a24 24 0 0 1 -48 0 C72 100 86 92 90 76 C96 88 104 88 100 64 Z" fill={fill} fillOpacity={0.16} />
          <Path d="M100 104 C108 112 110 118 108 124 a8 8 0 0 1 -16 0 C92 116 98 112 100 104 Z" />
        </>
      );
    case 'shield':
      return (
        <>
          <Path d="M100 64 L130 76 V100 C130 120 116 132 100 138 C84 132 70 120 70 100 V76 Z" fill={fill} fillOpacity={0.14} />
          <Path d="M88 100 l8 9 l16 -19" />
        </>
      );
    case 'hexstar':
      return (
        <>
          <Polygon points="100,62 133,119 67,119" />
          <Polygon points="100,138 67,81 133,81" />
          <Circle cx="100" cy="100" r="12" fill={fill} />
        </>
      );
    case 'orbit':
      return (
        <>
          <Circle cx="100" cy="100" r="10" fill={fill} />
          <Path d="M64 100 a36 14 -30 1 0 72 0 a36 14 -30 1 0 -72 0" strokeWidth="3" />
          <Path d="M64 100 a36 14 30 1 0 72 0 a36 14 30 1 0 -72 0" strokeWidth="3" />
        </>
      );
    case 'sun':
      return (
        <>
          <Circle cx="100" cy="100" r="16" fill={fill} fillOpacity={0.3} />
          {Array.from({ length: 8 }, (_, index) => {
            const angle = (index * Math.PI) / 4;
            return (
              <Line
                key={index}
                x1={100 + Math.cos(angle) * 26}
                y1={100 + Math.sin(angle) * 26}
                x2={100 + Math.cos(angle) * 38}
                y2={100 + Math.sin(angle) * 38}
              />
            );
          })}
        </>
      );
    case 'crown':
      return (
        <>
          <Path d="M68 122 L72 82 L88 98 L100 72 L112 98 L128 82 L132 122 Z" fill={fill} fillOpacity={0.16} />
          <Line x1="68" y1="132" x2="132" y2="132" />
        </>
      );
    case 'summit':
      return (
        <>
          <Path d="M62 132 L92 80 L106 102 L116 88 L140 132 Z" fill={fill} fillOpacity={0.14} />
          <Path d="M92 80 V64 l12 5 l-12 5" />
        </>
      );
    case 'laurel':
      return (
        <>
          <Path d="M86 136 C66 122 62 96 74 70" />
          <Path d="M114 136 C134 122 138 96 126 70" />
          {[0, 1, 2, 3].map((index) => (
            <G key={index}>
              <Path d={`M${78 - index * 2} ${124 - index * 15} q-10 -2 -12 -10 q10 0 12 10`} fill={fill} fillOpacity={0.3} strokeWidth="2.4" />
              <Path d={`M${122 + index * 2} ${124 - index * 15} q10 -2 12 -10 q-10 0 -12 10`} fill={fill} fillOpacity={0.3} strokeWidth="2.4" />
            </G>
          ))}
          <Path d="M100 90 l4 9 l10 1 l-8 6 l3 10 l-9 -6 l-9 6 l3 -10 l-8 -6 l10 -1 z" fill={fill} strokeWidth="2" />
        </>
      );
    case 'phoenix':
      return (
        <>
          <Path d="M100 74 C112 84 116 98 100 120 C84 98 88 84 100 74 Z" fill={fill} fillOpacity={0.18} />
          <Path d="M100 104 C86 96 72 98 62 88 C70 106 84 114 100 116" />
          <Path d="M100 104 C114 96 128 98 138 88 C130 106 116 114 100 116" />
          <Path d="M100 120 V136" />
        </>
      );
    case 'calendar':
      return (
        <>
          <Path d="M70 78 h60 v54 h-60 z" fill={fill} fillOpacity={0.1} />
          <Line x1="70" y1="94" x2="130" y2="94" />
          <Line x1="86" y1="70" x2="86" y2="84" />
          <Line x1="114" y1="70" x2="114" y2="84" />
          <Path d="M88 114 l8 8 l16 -18" />
        </>
      );
    case 'infinity':
      return <Path d="M100 100 C88 84 66 84 66 100 C66 116 88 116 100 100 C112 84 134 84 134 100 C134 116 112 116 100 100 Z" fill={fill} fillOpacity={0.12} />;
  }
}
