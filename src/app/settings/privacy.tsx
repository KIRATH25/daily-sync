import { StyleSheet, View } from 'react-native';
import { Bell, CloudOff, Database, Fingerprint, HelpCircle, Image, ShieldCheck } from '@/components/ui/icons';

import { DSCard } from '@/components/ui/Card';
import { Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useI18n, type TKey } from '@/i18n';
import { usePalette } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const POINTS: { icon: typeof Database; title: TKey; body: TKey }[] = [
  { icon: Database, title: 'privacy.localTitle', body: 'privacy.localBody' },
  { icon: CloudOff, title: 'privacy.noCloudTitle', body: 'privacy.noCloudBody' },
  { icon: Fingerprint, title: 'privacy.lockTitle', body: 'privacy.lockBody' },
  { icon: Bell, title: 'privacy.notifTitle', body: 'privacy.notifBody' },
  { icon: Image, title: 'privacy.mediaTitle', body: 'privacy.mediaBody' },
  { icon: ShieldCheck, title: 'privacy.backupTitle', body: 'privacy.backupBody' },
];

const HELP: { q: TKey; a: TKey }[] = [
  { q: 'help.q1', a: 'help.a1' },
  { q: 'help.q2', a: 'help.a2' },
  { q: 'help.q3', a: 'help.a3' },
  { q: 'help.q4', a: 'help.a4' },
  { q: 'help.q5', a: 'help.a5' },
];

export default function PrivacyScreen() {
  const palette = usePalette();
  const { t } = useI18n();
  return (
    <Screen header={<ScreenHeader large title={t('privacy.title')} subtitle={t('privacy.subtitle')} />}>
      {POINTS.map((point) => (
        <DSCard key={point.title}>
          <View style={styles.row}>
            <point.icon size={20} color={palette.accentText} />
            <View style={styles.flex}>
              <Text variant="title">{t(point.title)}</Text>
              <Text variant="small" tone="secondary" style={styles.body}>
                {t(point.body)}
              </Text>
            </View>
          </View>
        </DSCard>
      ))}
      <SectionHeader title={t('profile.help')} />
      {HELP.map((item) => (
        <DSCard key={item.q} tone="alt">
          <View style={styles.row}>
            <HelpCircle size={18} color={palette.accentText} />
            <View style={styles.flex}>
              <Text variant="title">{t(item.q)}</Text>
              <Text variant="small" tone="secondary" style={styles.body}>
                {t(item.a)}
              </Text>
            </View>
          </View>
        </DSCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.md },
  body: { marginTop: 4 },
});
