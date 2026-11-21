/**
 * Illustrative product previews for onboarding (references 2 and 3). They
 * are clearly labelled as a preview and never read or imply user data.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { BookOpen, Check, Droplet, Flame } from '@/components/ui/icons';

import { DSCard } from '@/components/ui/Card';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { Pill } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useI18n } from '@/i18n';
import { withAlpha } from '@/lib/color';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export const PlanPreview = memo(function PlanPreview() {
  const palette = usePalette();
  const { t, weekdayName } = useI18n();
  const days = [1, 2, 3, 4, 5, 6, 0];
  return (
    <DSCard glow padding={space.md}>
      <View style={styles.previewTag}>
        <Pill label={t('onboarding.preview')} tone="muted" />
      </View>
      <View style={[styles.week, { backgroundColor: palette.background }]}>
        {days.map((weekday, index) => {
          const active = index === 2;
          return (
            <View key={weekday} style={[styles.day, active && { backgroundColor: palette.accent }]}>
              <Text variant="micro" color={active ? palette.onAccent : palette.textSecondary}>
                {weekdayName(weekday, 'narrow')}
              </Text>
              <Text variant="bodyStrong" latin color={active ? palette.onAccent : palette.text}>
                {14 + index}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.item, { backgroundColor: palette.surfaceAlt }]}>
        <Text variant="smallStrong" tone="secondary" latin>
          09:30
        </Text>
        <Text variant="title">{t('onboarding.sampleClass')}</Text>
      </View>
      <View style={[styles.item, { backgroundColor: palette.elevated, borderLeftColor: palette.accent, borderLeftWidth: 3 }]}>
        <View style={styles.rowBetween}>
          <Text variant="smallStrong" tone="accent" latin>
            11:15
          </Text>
          <Pill label={t('onboarding.sampleFocusLeft')} tone="solid" />
        </View>
        <Text variant="title">{t('onboarding.sampleFocus')}</Text>
        <ProgressBar progress={0.67} height={5} />
      </View>
      <View style={[styles.item, styles.rowCenter, { backgroundColor: palette.surfaceAlt }]}>
        <View style={[styles.check, { backgroundColor: palette.accent }]}>
          <Check size={14} color={palette.onAccent} strokeWidth={3} />
        </View>
        <Text variant="body" tone="muted" strike>
          {t('onboarding.sampleTask')}
        </Text>
      </View>
    </DSCard>
  );
});

export const InsightPreview = memo(function InsightPreview() {
  const palette = usePalette();
  const { t } = useI18n();
  const rows = [
    { icon: Flame, label: t('onboarding.sampleHabit1'), value: t('onboarding.sampleStreak') },
    { icon: Droplet, label: t('onboarding.sampleHabit2'), value: '2.4L / 3L' },
    { icon: BookOpen, label: t('onboarding.sampleHabit3'), value: t('onboarding.sampleDone') },
  ];
  return (
    <DSCard glow padding={space.lg}>
      <View style={styles.previewTag}>
        <Pill label={t('onboarding.preview')} tone="muted" />
      </View>
      <View style={styles.rowBetween}>
        <View>
          <Text variant="label" tone="secondary">
            {t('onboarding.sampleIndex')}
          </Text>
          <Text variant="statLarge" latin>
            86%
          </Text>
        </View>
        <ProgressRing progress={0.86} size={76} stroke={7} />
      </View>
      <View style={[styles.chart, { backgroundColor: palette.background }]}>
        <Svg width="100%" height="84" viewBox="0 0 300 84" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={withAlpha(palette.accent, 0.35)} />
              <Stop offset="1" stopColor={withAlpha(palette.accent, 0)} />
            </LinearGradient>
          </Defs>
          <Path d="M0 60 C40 48 70 54 110 50 S170 18 200 40 S250 70 300 14 L300 84 L0 84 Z" fill="url(#area)" />
          <Path d="M0 60 C40 48 70 54 110 50 S170 18 200 40 S250 70 300 14" stroke={palette.accent} strokeWidth="2.5" fill="none" />
        </Svg>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={[styles.habit, { backgroundColor: palette.surfaceAlt }]}>
          <View style={[styles.habitIcon, { backgroundColor: palette.accentMuted }]}>
            <row.icon size={15} color={palette.accentText} />
          </View>
          <Text variant="bodyStrong" style={styles.flex}>
            {row.label}
          </Text>
          <Text variant="smallStrong" tone="accent">
            {row.value}
          </Text>
        </View>
      ))}
    </DSCard>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  previewTag: { position: 'absolute', top: space.sm, right: space.sm, zIndex: 2 },
  week: { flexDirection: 'row', borderRadius: radius.md, padding: 6, marginBottom: space.sm, marginTop: space.xl },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.sm, gap: 2 },
  item: { padding: space.md, borderRadius: radius.md, gap: 4, marginTop: space.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  check: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  chart: { borderRadius: radius.md, marginVertical: space.md, paddingTop: space.sm, overflow: 'hidden' },
  habit: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, marginTop: space.sm },
  habitIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
