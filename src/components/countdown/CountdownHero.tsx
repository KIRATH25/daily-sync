import { memo } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays } from '@/components/ui/icons';

import { ProgressRing } from '@/components/ui/Progress';
import { Text } from '@/components/ui/Text';
import { useTicker } from '@/hooks/useTicker';
import { useI18n } from '@/i18n';
import { withAlpha } from '@/lib/color';
import { countdownParts, countdownProgress } from '@/lib/countdown';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { Countdown } from '@/types/models';

import { CountdownDisplay } from './CountdownDisplay';

export interface CountdownHeroProps {
  countdown: Countdown;
  targetMs: number;
  compact?: boolean;
}

/** Signature countdown card rendered in the selected visual style. */
export const CountdownHero = memo(function CountdownHero({ countdown, targetMs, compact }: CountdownHeroProps) {
  const palette = usePalette();
  const { t, formatDate, formatTime, formatPercent } = useI18n();
  const now = useTicker(compact ? 30_000 : 1000);
  const accent = countdown.accent ?? palette.accent;
  const parts = countdownParts(targetMs, now);
  const progress = countdownProgress(countdown.createdAt, targetMs, now);
  const style = countdown.style;
  const dark = style === 'cinematic' || style === 'aurora' || !!countdown.backgroundUri;
  const ink = dark ? '#F5F3EE' : palette.text;
  const muted = dark ? 'rgba(245,243,238,0.72)' : palette.textSecondary;

  const header = (
    <View style={styles.header}>
      {countdown.subtitle ? (
        <View style={[styles.subtitle, { backgroundColor: dark ? 'rgba(255,255,255,0.12)' : palette.surfaceAlt }]}>
          <Text variant="small" color={muted} numberOfLines={1}>
            {countdown.subtitle}
          </Text>
        </View>
      ) : null}
      <Text variant={style === 'editorial' ? 'display' : 'h1'} color={ink} align="center" numberOfLines={2}>
        {style === 'editorial' ? countdown.title : countdown.title.toUpperCase()}
      </Text>
      <View style={styles.inline}>
        <CalendarDays size={13} color={accent} />
        <Text variant="small" color={muted}>
          {`${formatDate(countdown.targetDate, 'full')} · ${formatTime(countdown.targetMinute)}`}
        </Text>
      </View>
    </View>
  );

  const body =
    style === 'minimal' || style === 'editorial' ? (
      <View style={styles.center}>
        <Text variant="statLarge" latin color={accent} style={style === 'editorial' ? styles.editorialNumber : styles.minimalNumber}>
          {parts.isPast ? '0' : String(parts.days)}
        </Text>
        <Text variant="label" color={muted}>
          {parts.isPast ? t('countdown.arrived') : t('countdown.daysToGo')}
        </Text>
        {!compact ? (
          <Text variant="title" color={ink} latin style={styles.hms}>
            {`${String(parts.hours).padStart(2, '0')} : ${String(parts.minutes).padStart(2, '0')}${countdown.showSeconds ? ` : ${String(parts.seconds).padStart(2, '0')}` : ''}`}
          </Text>
        ) : null}
      </View>
    ) : style === 'custom' || style === 'aurora' ? (
      <View style={styles.center}>
        <ProgressRing progress={progress} size={compact ? 120 : 190} stroke={compact ? 8 : 10} color={accent} trackColor={dark ? 'rgba(255,255,255,0.12)' : palette.elevated}>
          <Text variant={compact ? 'h2' : 'statLarge'} latin color={accent}>
            {formatPercent(progress)}
          </Text>
          <Text variant="micro" color={muted}>
            {t('countdown.journey')}
          </Text>
        </ProgressRing>
        {!compact ? (
          <View style={styles.tiles}>
            <CountdownDisplay targetMs={targetMs} showSeconds={countdown.showSeconds} accent={accent} />
          </View>
        ) : null}
      </View>
    ) : (
      <View style={styles.tiles}>
        <CountdownDisplay targetMs={targetMs} showSeconds={countdown.showSeconds && !compact} size={compact ? 'md' : 'lg'} accent={accent} />
      </View>
    );

  const content = (
    <View style={[styles.content, { padding: compact ? space.lg : space.xl }]}>
      {header}
      {body}
    </View>
  );

  const shell = [styles.card, { borderColor: dark ? 'rgba(255,255,255,0.08)' : palette.border }];

  if (countdown.backgroundUri) {
    return (
      <View style={shell}>
        <ImageBackground source={{ uri: countdown.backgroundUri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        <LinearGradient colors={['rgba(8,8,10,0.35)', 'rgba(8,8,10,0.82)']} style={StyleSheet.absoluteFill} />
        {content}
      </View>
    );
  }
  if (style === 'aurora') {
    return (
      <View style={shell}>
        <LinearGradient colors={['#0E2A33', '#1A1238', '#0B0B12']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={[withAlpha('#74E6FF', 0.28), 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }} style={StyleSheet.absoluteFill} />
        {content}
      </View>
    );
  }
  if (style === 'cinematic') {
    return (
      <View style={shell}>
        <LinearGradient colors={['#1B1A15', '#0B0B0C']} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={[withAlpha(accent, 0.25), 'rgba(0,0,0,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.7 }} style={StyleSheet.absoluteFill} />
        {content}
      </View>
    );
  }
  return (
    <View style={[shell, { backgroundColor: palette.surface }]}>
      <LinearGradient colors={[withAlpha(accent, 0.14), withAlpha(accent, 0)]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 0.9 }} style={StyleSheet.absoluteFill} />
      {content}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  content: { gap: space.lg },
  header: { alignItems: 'center', gap: space.sm },
  subtitle: { paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill, maxWidth: '100%' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  center: { alignItems: 'center', gap: space.sm },
  minimalNumber: { fontSize: 72, lineHeight: 78 },
  editorialNumber: { fontSize: 96, lineHeight: 100, letterSpacing: -4 },
  hms: { letterSpacing: 2 },
  tiles: { alignSelf: 'stretch', marginTop: space.sm },
});
