import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import {
  Bell,
  CalendarDays,
  Camera,
  ChevronRight,
  Clock,
  DatabaseBackup,
  Fingerprint,
  Globe,
  HelpCircle,
  Languages,
  LockKeyhole,
  Moon,
  Palette as PaletteIcon,
  Pencil,
  Quote,
  ShieldCheck,
  Sparkles,
  UserRound,
  Vibrate,
} from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { useFeedback } from '@/components/ui/Feedback';
import { DSInput } from '@/components/ui/Input';
import { PressableScale } from '@/components/ui/PressableScale';
import { Pill, Screen, SectionHeader } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { DSBottomSheet } from '@/components/ui/Sheet';
import { DSSwitch, SettingRow } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { listActiveDates } from '@/db/repositories/activityRepo';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useClock } from '@/hooks/useClock';
import { useI18n, type TKey } from '@/i18n';
import { computeJourneyStats } from '@/lib/journey';
import { deviceTimeZone, isValidTimeZone, offsetMinutesAt } from '@/lib/timezone';
import { LIMITS, sanitizeText } from '@/lib/validation';
import { deleteStoredImage, pickImage } from '@/services/media';
import { authAvailability, authenticate, readLockSettings, writeLockSetting, type LockSettings } from '@/services/security';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const TIME_ZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Kathmandu',
  'Asia/Dhaka',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
];

export default function ProfileScreen() {
  const palette = usePalette();
  const { t, formatDate } = useI18n();
  const { preferences, setPreferences } = usePreferences();
  const { toast } = useFeedback();
  const clock = useClock();
  const today = clock.dateKey;
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(preferences.userName);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [locks, setLocks] = useState<LockSettings>({ appLock: false, journalLock: false });
  const journey = useLiveQuery(listActiveDates, ['tasks', 'habit_logs', 'day_reviews', 'entry_completions', 'journal_entries', 'focus_sessions', 'workout_sessions'], []);
  const stats = useMemo(() => computeJourneyStats(journey.data ?? [], today), [journey.data, today]);

  useEffect(() => {
    readLockSettings().then(setLocks);
  }, []);

  const changeAvatar = async () => {
    try {
      const uri = await pickImage([1, 1]);
      if (!uri) return;
      deleteStoredImage(preferences.avatarUri);
      await setPreferences({ avatarUri: uri });
    } catch {
      toast(t('error.imageFailed'), { tone: 'error' });
    }
  };

  const toggleLock = async (kind: keyof LockSettings, enabled: boolean) => {
    if (enabled) {
      const availability = await authAvailability();
      if (availability !== 'available') {
        toast(t(availability === 'no-hardware' ? 'security.noHardware' : 'security.notEnrolled'), { tone: 'error' });
        return;
      }
    }
    // Confirm identity both to turn a lock on (proves it works) and off.
    const ok = await authenticate(t('security.confirmPrompt'), t('common.cancel'));
    if (!ok) return;
    await writeLockSetting(kind, enabled);
    setLocks((current) => ({ ...current, [kind]: enabled }));
    toast(enabled ? t('security.enabled') : t('security.disabled'));
  };

  const offset = offsetMinutesAt(clock.now, preferences.timeZone);
  const offsetLabel = `UTC${offset >= 0 ? '+' : '−'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen header={<View style={styles.header}><Text variant="h1" accessibilityRole="header">{t('profile.title')}</Text></View>} withTabBar>
      <DSCard glow>
        <View style={styles.profileRow}>
          <PressableScale onPress={changeAvatar} accessibilityLabel={t('profile.changePhoto')} style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
            {preferences.avatarUri ? <Image source={{ uri: preferences.avatarUri }} style={styles.avatarImage} accessibilityIgnoresInvertColors /> : <UserRound size={32} color="#1A1708" />}
            <View style={[styles.camera, { backgroundColor: palette.accent, borderColor: palette.surface }]}>
              <Camera size={12} color={palette.onAccent} />
            </View>
          </PressableScale>
          <View style={styles.flex}>
            <Text variant="h2" numberOfLines={1}>
              {preferences.userName || t('profile.noName')}
            </Text>
            <Text variant="small" tone="secondary">
              {stats.firstActive ? t('profile.since', { date: formatDate(stats.firstActive, 'monthYear') }) : t('profile.welcome')}
            </Text>
          </View>
          <PressableScale onPress={() => { setName(preferences.userName); setEditingName(true); }} accessibilityLabel={t('profile.editName')} hitSlop={10} style={[styles.edit, { backgroundColor: palette.surfaceAlt }]}>
            <Pencil size={16} color={palette.text} />
          </PressableScale>
        </View>
        <View style={styles.statRow}>
          <View style={[styles.stat, { backgroundColor: palette.surfaceAlt }]}>
            <Text variant="micro" tone="secondary">
              {t('journey.activeDays')}
            </Text>
            <Text variant="h3" latin tone="accent">
              {stats.activeDays}
            </Text>
          </View>
          <View style={[styles.stat, { backgroundColor: palette.surfaceAlt }]}>
            <Text variant="micro" tone="secondary">
              {t('journey.currentStreak')}
            </Text>
            <Text variant="h3" latin>
              {stats.currentStreak}
            </Text>
          </View>
          <PressableScale onPress={() => router.push('/journey')} accessibilityLabel={t('nav.journey')} style={[styles.stat, { backgroundColor: palette.surfaceAlt }]}>
            <Text variant="micro" tone="secondary">
              {t('nav.journey')}
            </Text>
            <ChevronRight size={20} color={palette.accentText} />
          </PressableScale>
        </View>
      </DSCard>

      <SectionHeader title={t('profile.personalization')} />
      <DSCard>
        <SettingRow icon={PaletteIcon} title={t('themes.title')} subtitle={t(`theme.${preferences.themePresetId}` as TKey)} onPress={() => router.push('/themes')} right={<ChevronRight size={18} color={palette.textMuted} />} />
        <SettingRow icon={Moon} title={t('themes.appearance')} />
        <Segmented
          options={[
            { value: 'light', label: t('appearance.light') },
            { value: 'dark', label: t('appearance.dark') },
            { value: 'system', label: t('appearance.system') },
          ]}
          value={preferences.appearance}
          onChange={(appearance) => void setPreferences({ appearance })}
          accent
        />
        <SettingRow icon={Languages} title={t('settings.language')} subtitle={t('settings.languageSub')} />
        <Segmented
          options={[
            { value: 'en', label: 'English' },
            { value: 'hi', label: 'हिन्दी' },
          ]}
          value={preferences.language}
          onChange={(language) => void setPreferences({ language })}
          accent
        />
        <SettingRow icon={Sparkles} title={t('home.customize')} subtitle={t('profile.customizeSub')} onPress={() => router.navigate('/(tabs)')} right={<ChevronRight size={18} color={palette.textMuted} />} />
      </DSCard>

      <SectionHeader title={t('profile.notifications')} />
      <DSCard>
        <SettingRow icon={Bell} title={t('settings.notifications')} subtitle={t('settings.notificationsSub')} onPress={() => router.push('/settings/notifications')} right={<ChevronRight size={18} color={palette.textMuted} />} />
        <SettingRow
          icon={Quote}
          title={t('settings.dailyQuote')}
          subtitle={t('settings.dailyQuoteSub')}
          right={<DSSwitch label={t('settings.dailyQuote')} value={preferences.dailyQuoteEnabled} onChange={(dailyQuoteEnabled) => void setPreferences({ dailyQuoteEnabled })} />}
        />
      </DSCard>

      <SectionHeader title={t('profile.general')} />
      <DSCard>
        <SettingRow
          icon={CalendarDays}
          title={t('settings.weekStart')}
          right={
            <Segmented
              options={[
                { value: 1, label: t('settings.monday') },
                { value: 0, label: t('settings.sunday') },
              ]}
              value={preferences.weekStart}
              onChange={(weekStart) => void setPreferences({ weekStart })}
              size="sm"
              style={styles.smallSeg}
            />
          }
        />
        <SettingRow icon={Globe} title={t('settings.timeZone')} subtitle={`${preferences.timeZone} (${offsetLabel})`} onPress={() => setZoneOpen(true)} right={<ChevronRight size={18} color={palette.textMuted} />} />
        <SettingRow
          icon={Clock}
          title={t('settings.timeFormat')}
          right={
            <Segmented
              options={[
                { value: '12h', label: '12h' },
                { value: '24h', label: '24h' },
              ]}
              value={preferences.timeFormat}
              onChange={(timeFormat) => void setPreferences({ timeFormat })}
              size="sm"
              style={styles.smallSeg}
            />
          }
        />
        <SettingRow icon={Vibrate} title={t('settings.haptics')} subtitle={t('settings.hapticsSub')} right={<DSSwitch label={t('settings.haptics')} value={preferences.haptics} onChange={(haptics) => void setPreferences({ haptics })} />} />
      </DSCard>

      <SectionHeader title={t('profile.privacy')} />
      <DSCard>
        <SettingRow icon={LockKeyhole} title={t('security.appLock')} subtitle={t('security.appLockSub')} right={<DSSwitch label={t('security.appLock')} value={locks.appLock} onChange={(value) => void toggleLock('appLock', value)} />} />
        <SettingRow icon={Fingerprint} title={t('security.journalLock')} subtitle={t('security.journalLockSub')} right={<DSSwitch label={t('security.journalLock')} value={locks.journalLock} onChange={(value) => void toggleLock('journalLock', value)} />} />
        <SettingRow icon={DatabaseBackup} title={t('backup.title')} subtitle={t('backup.rowSub')} onPress={() => router.push('/settings/backup')} right={<ChevronRight size={18} color={palette.textMuted} />} />
        <SettingRow icon={ShieldCheck} title={t('privacy.title')} subtitle={t('privacy.rowSub')} onPress={() => router.push('/settings/privacy')} right={<ChevronRight size={18} color={palette.textMuted} />} />
      </DSCard>

      <SectionHeader title={t('profile.about')} />
      <DSCard>
        <SettingRow icon={Sparkles} title="Daily Sync" subtitle={t('profile.version', { version })} right={<Pill label={t('profile.offline')} tone="muted" />} />
        <SettingRow icon={HelpCircle} title={t('profile.help')} subtitle={t('profile.helpSub')} onPress={() => router.push('/settings/privacy')} right={<ChevronRight size={18} color={palette.textMuted} />} />
        <SettingRow icon={Bell} title={t('profile.systemSettings')} subtitle={t('profile.systemSettingsSub')} onPress={() => Linking.openSettings()} right={<ChevronRight size={18} color={palette.textMuted} />} />
      </DSCard>
      <View style={styles.footer}>
        <Text variant="label" tone="accent" latin>
          DAILY SYNC
        </Text>
        <Text variant="small" tone="muted" align="center">
          {t('profile.tagline')}
        </Text>
      </View>

      <DSBottomSheet
        visible={editingName}
        onClose={() => setEditingName(false)}
        title={t('profile.editName')}
        footer={
          <PremiumButton
            label={t('common.save')}
            onPress={() => {
              void setPreferences({ userName: sanitizeText(name).slice(0, LIMITS.name) });
              setEditingName(false);
            }}
          />
        }
      >
        <DSInput label={t('onboarding.nameLabel')} value={name} onChangeText={setName} maxLength={LIMITS.name} autoFocus autoCapitalize="words" />
      </DSBottomSheet>

      <DSBottomSheet visible={zoneOpen} onClose={() => setZoneOpen(false)} title={t('settings.timeZone')} subtitle={t('settings.timeZoneSub')}>
        {[...new Set([deviceTimeZone(), ...TIME_ZONES])].filter(isValidTimeZone).map((zone) => {
          const zoneOffset = offsetMinutesAt(clock.now, zone);
          return (
            <PressableScale
              key={zone}
              onPress={() => {
                void setPreferences({ timeZone: zone });
                setZoneOpen(false);
              }}
              accessibilityState={{ selected: preferences.timeZone === zone }}
              accessibilityLabel={zone}
              style={[styles.zone, { backgroundColor: preferences.timeZone === zone ? palette.accentMuted : palette.surfaceAlt }]}
            >
              <View style={styles.flex}>
                <Text variant="bodyStrong">{zone.replace(/_/g, ' ')}</Text>
                {zone === deviceTimeZone() ? (
                  <Text variant="small" tone="accent">
                    {t('settings.deviceZone')}
                  </Text>
                ) : null}
              </View>
              <Text variant="smallStrong" tone="secondary" latin>
                {`UTC${zoneOffset >= 0 ? '+' : '−'}${Math.floor(Math.abs(zoneOffset) / 60)}:${String(Math.abs(zoneOffset) % 60).padStart(2, '0')}`}
              </Text>
            </PressableScale>
          );
        })}
      </DSBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: space.gutter, paddingVertical: space.md },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 68, height: 68, borderRadius: 34 },
  camera: { position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  edit: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  stat: { flex: 1, padding: space.md, borderRadius: radius.md, gap: 2, justifyContent: 'space-between' },
  smallSeg: { width: 150 },
  zone: { flexDirection: 'row', alignItems: 'center', padding: space.md, borderRadius: radius.md, gap: space.sm },
  footer: { alignItems: 'center', gap: 4, marginTop: space.lg },
});
