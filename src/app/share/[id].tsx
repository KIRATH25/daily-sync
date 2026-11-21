import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Download, Moon, Share2, Sun, X } from '@/components/ui/icons';

import { CANVAS, ShareCanvas } from '@/components/collection/ShareCanvas';
import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { useFeedback } from '@/components/ui/Feedback';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { DSSwitch, SettingRow } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { getAchievementRecord } from '@/db/repositories/achievementsRepo';
import { listActiveDates } from '@/db/repositories/activityRepo';
import { useToday } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n, type TKey } from '@/i18n';
import { getAchievement } from '@/lib/achievements';
import { computeJourneyStats } from '@/lib/journey';
import { captureCard, saveImageToLibrary, SHARE_SIZES, shareImage, type ShareFormat } from '@/services/sharing';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export default function ShareStudioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const definition = getAchievement(id);
  const palette = usePalette();
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();
  const { toast } = useFeedback();
  const { width } = useWindowDimensions();
  const today = useToday();
  const [format, setFormat] = useState<ShareFormat>('portrait');
  const [finish, setFinish] = useState<'dark' | 'light'>('dark');
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const canvasRef = useRef<ComponentRef<typeof View>>(null);

  const query = useLiveQuery(
    async () => {
      const [record, dates] = await Promise.all([getAchievementRecord(id), listActiveDates()]);
      return { record, streak: computeJourneyStats(dates, today).longestStreak };
    },
    ['achievement_records'],
    [id, today],
  );

  const header = <ScreenHeader leading="close" title={t('share.title')} />;
  if (!definition) {
    return (
      <Screen header={header}>
        <EmptyState icon={X} title={t('common.notFound')} />
      </Screen>
    );
  }
  if (!query.data) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }
  const record = query.data.record;
  if (!record) {
    return (
      <Screen header={header}>
        <EmptyState icon={X} title={t('share.lockedTitle')} message={t('share.lockedBody')} />
      </Screen>
    );
  }

  const canvas = CANVAS[format];
  const available = width - space.gutter * 2 - space.lg * 2;
  const scale = Math.min(available / canvas.width, (format === 'story' ? 460 : 400) / canvas.height);
  const name = preferences.shareShowName && preferences.userName.trim() ? preferences.userName.trim() : null;

  const run = async (kind: 'share' | 'save') => {
    setBusy(kind);
    try {
      const uri = await captureCard(canvasRef, format);
      if (kind === 'share') await shareImage(uri, t('share.title'));
      else {
        const result = await saveImageToLibrary(uri);
        toast(result === 'saved' ? t('share.saved') : t('share.permissionDenied'), { tone: result === 'saved' ? 'success' : 'error' });
      }
    } catch (error) {
      console.warn('Card export failed', error instanceof Error ? error.message : 'unknown');
      toast(t('share.failed'), { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const footer = (
    <View style={styles.footer}>
      <PremiumButton label={t('share.save')} icon={Download} variant="secondary" fullWidth={false} onPress={() => run('save')} loading={busy === 'save'} disabled={busy !== null} />
      <PremiumButton label={t('share.shareNow')} icon={Share2} onPress={() => run('share')} loading={busy === 'share'} disabled={busy !== null} style={styles.flex} />
    </View>
  );

  return (
    <Screen header={header} footer={footer}>
      <Text variant="body" tone="secondary">
        {t('share.subtitle')}
      </Text>
      <Segmented<ShareFormat>
        options={[
          { value: 'portrait', label: t('share.portrait') },
          { value: 'story', label: t('share.story') },
          { value: 'square', label: t('share.square') },
        ]}
        value={format}
        onChange={setFormat}
      />
      <View style={[styles.stage, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={{ width: canvas.width * scale, height: canvas.height * scale, borderRadius: 18 * scale, overflow: 'hidden' }}>
          <View style={{ width: canvas.width, height: canvas.height, transform: [{ scale }], transformOrigin: 'top left' }}>
            <ShareCanvas
              ref={canvasRef}
              format={format}
              definition={definition}
              earnedDate={record.earnedDate}
              value={record.milestoneValue}
              finish={finish}
              name={name}
              avatarUri={preferences.shareShowAvatar ? preferences.avatarUri : null}
              streak={preferences.shareShowStreak ? query.data.streak : null}
            />
          </View>
        </View>
        <Text variant="micro" tone="muted" style={styles.dims} latin>
          {`${SHARE_SIZES[format].width} × ${SHARE_SIZES[format].height} · ${SHARE_SIZES[format].ratio}`}
        </Text>
      </View>

      <DSCard>
        <Text variant="h3">{t('share.personalize')}</Text>
        <SettingRow
          icon={finish === 'dark' ? Moon : Sun}
          title={t('share.finish')}
          subtitle={t(`share.finish.${finish}` as TKey)}
          right={<Segmented options={[{ value: 'dark', label: t('appearance.dark') }, { value: 'light', label: t('appearance.light') }]} value={finish} onChange={setFinish} size="sm" style={styles.finish} />}
        />
        <SettingRow
          title={t('share.showName')}
          subtitle={preferences.userName ? t('share.showNameSub') : t('share.noName')}
          right={<DSSwitch label={t('share.showName')} value={preferences.shareShowName} onChange={(shareShowName) => void setPreferences({ shareShowName })} disabled={!preferences.userName} />}
        />
        <SettingRow
          title={t('share.showAvatar')}
          subtitle={preferences.avatarUri ? t('share.showAvatarSub') : t('share.noAvatar')}
          right={<DSSwitch label={t('share.showAvatar')} value={preferences.shareShowAvatar} onChange={(shareShowAvatar) => void setPreferences({ shareShowAvatar })} disabled={!preferences.avatarUri} />}
        />
        <SettingRow
          title={t('share.showStreak')}
          subtitle={t('share.showStreakSub', { count: query.data.streak })}
          right={<DSSwitch label={t('share.showStreak')} value={preferences.shareShowStreak} onChange={(shareShowStreak) => void setPreferences({ shareShowStreak })} />}
        />
      </DSCard>
      <Text variant="small" tone="muted" align="center">
        {t('share.privacyNote')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stage: { alignItems: 'center', paddingVertical: space.xl, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space.md },
  dims: { marginTop: space.xs },
  finish: { width: 150 },
  footer: { flexDirection: 'row', gap: space.sm },
});
