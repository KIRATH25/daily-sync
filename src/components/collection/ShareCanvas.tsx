import { memo, type ComponentRef, type Ref } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui/Text';
import { useI18n, type TKey } from '@/i18n';
import type { AchievementDefinition } from '@/lib/achievements';
import type { DateKey } from '@/lib/dates';
import type { ShareFormat } from '@/services/sharing';
import { fonts } from '@/theme/tokens';

import { Emblem } from './Emblem';
import { SERIES_STYLES } from './series';

/** Logical canvas sizes (dp). Captured at exactly 1080 px wide. */
export const CANVAS: Record<ShareFormat, { width: number; height: number }> = {
  portrait: { width: 360, height: 450 },
  story: { width: 360, height: 640 },
  square: { width: 360, height: 360 },
};

export interface ShareCanvasProps {
  ref?: Ref<ComponentRef<typeof View>>;
  format: ShareFormat;
  definition: AchievementDefinition;
  earnedDate: DateKey;
  value: number;
  finish: 'dark' | 'light';
  name: string | null;
  avatarUri: string | null;
  streak: number | null;
}

/**
 * The designed, shareable milestone artwork. Rendered in a fixed logical
 * size so the export is pixel-exact regardless of the device; contains only
 * the fields the user opted into.
 */
export const ShareCanvas = memo(function ShareCanvas({ ref, format, definition, earnedDate, value, finish, name, avatarUri, streak }: ShareCanvasProps) {
  const { t, formatDate, language } = useI18n();
  const series = SERIES_STYLES[definition.series];
  const size = CANVAS[format];
  const light = finish === 'light';
  const ink = light ? '#1C1B18' : series.ink;
  const muted = light ? '#6F6A5E' : series.inkMuted;
  const metal: [string, string] = light ? ['#B8902A', '#8A6A1A'] : series.metal;
  const emblemSize = format === 'square' ? 120 : format === 'story' ? 190 : 150;
  const bigNumber = format === 'square' ? 64 : 84;

  return (
    <View ref={ref} collapsable={false} style={[styles.canvas, { width: size.width, height: size.height }]}>
      <LinearGradient colors={light ? ['#FBF7EC', '#F1EBDB', '#E8E0CC'] : series.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.frame, { borderColor: `${metal[1]}66` }]} />
      <View style={[styles.content, { paddingVertical: format === 'story' ? 44 : 26 }]}>
        <View style={styles.top}>
          <Text latin style={[styles.brand, { color: ink }]}>
            DAILY SYNC
          </Text>
          <View style={[styles.datePill, { borderColor: `${metal[0]}66` }]}>
            <Text latin style={[styles.date, { color: metal[0] }]}>
              {formatDate(earnedDate, 'medium').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.middle}>
          <Emblem kind={definition.emblem} size={emblemSize} metal={metal} glow={light ? 'rgba(184,144,42,0.18)' : series.glow} idSuffix={`share-${format}`} />
          <Text latin style={{ color: metal[0], fontFamily: fonts.displayBold, fontSize: bigNumber, lineHeight: bigNumber * 1.05, letterSpacing: -2 }}>
            {value}
          </Text>
          <Text
            style={{
              color: ink,
              fontFamily: language === 'hi' ? fonts.hindiBold : fonts.displayBold,
              fontSize: 18,
              lineHeight: language === 'hi' ? 28 : 22,
              letterSpacing: language === 'hi' ? 0 : 2,
              textAlign: 'center',
            }}
            numberOfLines={2}
          >
            {language === 'hi' ? t(`achievement.${definition.id}.name` as TKey) : t(`achievement.${definition.id}.name` as TKey).toUpperCase()}
          </Text>
          {format !== 'square' ? (
            <Text style={[styles.tagline, { color: muted, fontFamily: language === 'hi' ? fonts.hindiRegular : fonts.bodyMedium }]} numberOfLines={3}>
              “{t(`achievement.${definition.id}.shareLine` as TKey)}”
            </Text>
          ) : null}
          {streak != null && streak > 0 ? (
            <View style={[styles.streak, { backgroundColor: light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)' }]}>
              <Text style={[styles.streakText, { color: ink, fontFamily: language === 'hi' ? fonts.hindiSemi : fonts.displaySemi }]}>{t('share.streakLine', { count: streak })}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bottom}>
          {name ? (
            <View style={styles.holder}>
              {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatar} /> : null}
              <View>
                <Text style={[styles.holderName, { color: ink }]} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={[styles.series, { color: muted }]}>{t(`series.${definition.series}` as TKey)}</Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.series, { color: muted }]}>{t(`series.${definition.series}` as TKey)}</Text>
          )}
          <Text latin style={[styles.footerMark, { color: muted }]}>
            {t('share.tagline')}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  canvas: { overflow: 'hidden', backgroundColor: '#0E0F10' },
  frame: { position: 'absolute', top: 12, left: 12, right: 12, bottom: 12, borderWidth: 1, borderRadius: 18 },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: fonts.displayBold, fontSize: 12, letterSpacing: 3.5 },
  datePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  date: { fontFamily: fonts.displaySemi, fontSize: 10, letterSpacing: 1 },
  middle: { alignItems: 'center', gap: 6 },
  tagline: { fontSize: 13, lineHeight: 19, textAlign: 'center', fontStyle: 'italic', paddingHorizontal: 12, marginTop: 4 },
  streak: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8 },
  streakText: { fontSize: 12.5 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  holder: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  holderName: { fontFamily: fonts.bodyBold, fontSize: 13 },
  series: { fontFamily: fonts.displayMedium, fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  footerMark: { fontFamily: fonts.displayMedium, fontSize: 9, letterSpacing: 1.4 },
});
