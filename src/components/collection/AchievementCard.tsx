import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui/Text';
import { useI18n, type TKey } from '@/i18n';
import { ACHIEVEMENT_COUNT, cardRecordCode, type AchievementDefinition } from '@/lib/achievements';
import type { DateKey } from '@/lib/dates';
import { fonts } from '@/theme/tokens';

import { Emblem } from './Emblem';
import { SERIES_STYLES } from './series';

export interface AchievementCardProps {
  definition: AchievementDefinition;
  width: number;
  earned?: { date: DateKey; recordId: string; value: number } | null;
  holderName?: string | null;
  progress?: { current: number; target: number } | null;
  style?: StyleProp<ViewStyle>;
  /** Compact grid tile: hides the footer details */
  compact?: boolean;
}

export const CARD_RATIO = 1.42;

/**
 * Collectible milestone card. Printed on its own dark stock with a metallic
 * series palette, fine inner frame, engraved emblem and record code.
 * Locked cards are rendered desaturated with the unlock requirement — never
 * styled to look earned.
 */
export const AchievementCard = memo(function AchievementCard({
  definition,
  width,
  earned,
  holderName,
  progress,
  style,
  compact,
}: AchievementCardProps) {
  const { t, formatDate, language } = useI18n();
  const series = SERIES_STYLES[definition.series];
  const height = width * CARD_RATIO;
  const scale = width / 300;
  const locked = !earned;
  const name = t(`achievement.${definition.id}.name` as TKey);
  const tagline = t(`achievement.${definition.id}.tagline` as TKey);
  const metal: [string, string] = locked ? ['#6B6E72', '#45484C'] : series.metal;
  const ink = locked ? '#8B8E92' : series.ink;
  const muted = locked ? '#5F6266' : series.inkMuted;
  const pad = 16 * scale;

  return (
    <View
      style={[styles.card, { width, height, borderRadius: 22 * scale }, style]}
      accessibilityLabel={`${name}. ${locked ? t('collection.locked') : t('collection.earnedOn', { date: formatDate(earned.date, 'medium') })}`}
    >
      <LinearGradient
        colors={locked ? ['#1A1B1D', '#141516', '#0E0F10'] : series.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* sheen */}
      {!locked ? (
        <LinearGradient
          colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.04)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {/* fine inner frame */}
      <View
        style={[
          styles.frame,
          { top: 8 * scale, left: 8 * scale, right: 8 * scale, bottom: 8 * scale, borderRadius: 16 * scale, borderColor: locked ? '#2A2C2F' : `${metal[1]}55` },
        ]}
      />
      <View style={[styles.content, { padding: pad + 4 * scale }]}>
        <View style={styles.topRow}>
          <View>
            <Text latin style={[styles.brand, { color: ink, fontSize: 10 * scale, letterSpacing: 3 * scale }]}>
              DAILY SYNC
            </Text>
            <Text style={[styles.series, { color: muted, fontSize: 8.5 * scale, letterSpacing: 1.6 * scale }]}>
              {t(`series.${definition.series}` as TKey)}
            </Text>
          </View>
          <Text latin style={[styles.number, { color: muted, fontSize: 10 * scale }]}>
            #{String(definition.number).padStart(2, '0')}/{ACHIEVEMENT_COUNT}
          </Text>
        </View>

        <View style={styles.emblemWrap}>
          <Emblem kind={definition.emblem} size={width * 0.6} metal={metal} glow={series.glow} locked={locked} idSuffix={`${definition.id}-${Math.round(width)}`} />
        </View>

        <View style={styles.titleBlock}>
          <Text
            style={[
              styles.title,
              {
                color: ink,
                fontSize: (language === 'hi' ? 19 : 20) * scale,
                lineHeight: (language === 'hi' ? 30 : 24) * scale,
                fontFamily: language === 'hi' ? fonts.hindiBold : fonts.displayBold,
                letterSpacing: language === 'hi' ? 0 : 1.2 * scale,
                textShadowColor: locked ? 'transparent' : 'rgba(0,0,0,0.6)',
              },
            ]}
            numberOfLines={2}
            align="center"
          >
            {language === 'hi' ? name : name.toUpperCase()}
          </Text>
          <View style={[styles.tagline, { borderColor: `${metal[0]}44`, paddingHorizontal: 10 * scale, paddingVertical: 4 * scale, borderRadius: 999 }]}>
            <Text style={{ color: locked ? muted : metal[0], fontSize: 9.5 * scale, lineHeight: 14 * scale, fontFamily: language === 'hi' ? fonts.hindiSemi : fonts.displaySemi, letterSpacing: language === 'hi' ? 0 : 0.8 * scale }} numberOfLines={1}>
              {locked && progress ? t('collection.progressShort', { current: progress.current, target: progress.target }) : tagline}
            </Text>
          </View>
        </View>

        {!compact ? (
          <View style={styles.footer}>
            {locked ? (
              <View style={[styles.lockBar, { backgroundColor: '#25272A' }]}>
                <View style={{ width: `${progress ? Math.round((progress.current / progress.target) * 100) : 0}%`, height: '100%', backgroundColor: '#6B6E72', borderRadius: 4 }} />
              </View>
            ) : (
              <>
                <View style={styles.footerRow}>
                  <Text latin style={[styles.code, { color: ink, fontSize: 9 * scale }]}>
                    {cardRecordCode(definition, earned.date, earned.recordId)}
                  </Text>
                  <Text style={[styles.code, { color: ink, fontSize: 9 * scale }]}>{formatDate(earned.date, 'medium')}</Text>
                </View>
                {holderName ? (
                  <Text style={[styles.holder, { color: metal[0], fontSize: 8.5 * scale }]} numberOfLines={1}>
                    {t('collection.issuedTo', { name: holderName })}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    backgroundColor: '#0E0F10',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  frame: { position: 'absolute', borderWidth: 1 },
  content: { flex: 1, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { fontFamily: fonts.displayBold },
  series: { fontFamily: fonts.displayMedium, textTransform: 'uppercase', marginTop: 2 },
  number: { fontFamily: fonts.displaySemi },
  emblemWrap: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  titleBlock: { alignItems: 'center', gap: 8 },
  title: { textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  tagline: { borderWidth: 1 },
  footer: { marginTop: 10, gap: 4 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  code: { fontFamily: fonts.displayMedium, letterSpacing: 0.6 },
  holder: { fontFamily: fonts.displaySemi, letterSpacing: 0.8, textAlign: 'right' },
  lockBar: { height: 5, borderRadius: 4, overflow: 'hidden' },
});
