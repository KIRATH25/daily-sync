import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AlertTriangle, DatabaseBackup, Download, FileUp, ShieldAlert, Trash2 } from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { useFeedback } from '@/components/ui/Feedback';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { eraseAllData, RestoreFailure } from '@/db/repositories/backupRepo';
import { useToday } from '@/hooks/useClock';
import { useI18n } from '@/i18n';
import { pickAndRestoreBackup, shareBackupFile } from '@/services/backup';
import { syncNotifications } from '@/services/notifications';
import { DEFAULT_PREFERENCES, loadPreferences, usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { writeLockSetting } from '@/services/security';

export default function BackupScreen() {
  const palette = usePalette();
  const { t } = useI18n();
  const { replaceAll } = usePreferences();
  const { toast, confirm } = useFeedback();
  const today = useToday();
  const [busy, setBusy] = useState<'export' | 'restore' | 'erase' | null>(null);

  const exportData = async () => {
    setBusy('export');
    try {
      await shareBackupFile(today);
    } catch {
      toast(t('backup.exportFailed'), { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    const ok = await confirm({ title: t('backup.restoreConfirmTitle'), message: t('backup.restoreConfirmBody'), confirmLabel: t('backup.restore'), destructive: true });
    if (!ok) return;
    setBusy('restore');
    try {
      const result = await pickAndRestoreBackup();
      if (result.status === 'restored') {
        replaceAll({ ...(await loadPreferences()), onboardingComplete: true });
        toast(t('backup.restored', { count: result.summary.rows }));
      }
    } catch (error) {
      toast(t(error instanceof RestoreFailure ? error.code : 'restore.corrupt'), { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const erase = async () => {
    const ok = await confirm({ title: t('backup.eraseTitle'), message: t('backup.eraseBody'), confirmLabel: t('backup.erase'), destructive: true });
    if (!ok) return;
    const sure = await confirm({ title: t('backup.eraseFinalTitle'), message: t('backup.eraseFinalBody'), confirmLabel: t('backup.eraseFinal'), destructive: true });
    if (!sure) return;
    setBusy('erase');
    try {
      await eraseAllData();
      await writeLockSetting('appLock', false);
      await writeLockSetting('journalLock', false);
      await syncNotifications();
      replaceAll(DEFAULT_PREFERENCES);
      router.replace('/onboarding');
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen header={<ScreenHeader large title={t('backup.title')} subtitle={t('backup.subtitle')} />}>
      <DSCard glow>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: palette.accentMuted }]}>
            <Download size={20} color={palette.accentText} />
          </View>
          <View style={styles.flex}>
            <Text variant="h3">{t('backup.export')}</Text>
            <Text variant="small" tone="secondary">
              {t('backup.exportBody')}
            </Text>
          </View>
        </View>
        <View style={[styles.warning, { backgroundColor: palette.surfaceAlt }]}>
          <ShieldAlert size={16} color={palette.warning} />
          <Text variant="small" tone="secondary" style={styles.flex}>
            {t('backup.privateWarning')}
          </Text>
        </View>
        <PremiumButton label={t('backup.export')} icon={DatabaseBackup} onPress={exportData} loading={busy === 'export'} disabled={busy !== null} style={styles.spaced} />
      </DSCard>

      <DSCard>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: palette.surfaceAlt }]}>
            <FileUp size={20} color={palette.accentText} />
          </View>
          <View style={styles.flex}>
            <Text variant="h3">{t('backup.restore')}</Text>
            <Text variant="small" tone="secondary">
              {t('backup.restoreBody')}
            </Text>
          </View>
        </View>
        <PremiumButton label={t('backup.chooseFile')} icon={FileUp} variant="secondary" onPress={restore} loading={busy === 'restore'} disabled={busy !== null} style={styles.spaced} />
      </DSCard>

      <DSCard>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: palette.dangerSoft }]}>
            <AlertTriangle size={20} color={palette.dangerText} />
          </View>
          <View style={styles.flex}>
            <Text variant="h3">{t('backup.erase')}</Text>
            <Text variant="small" tone="secondary">
              {t('backup.eraseRow')}
            </Text>
          </View>
        </View>
        <PremiumButton label={t('backup.erase')} icon={Trash2} variant="danger" onPress={erase} loading={busy === 'erase'} disabled={busy !== null} style={styles.spaced} />
      </DSCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  warning: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, marginTop: space.md, alignItems: 'center' },
  spaced: { marginTop: space.md },
});
