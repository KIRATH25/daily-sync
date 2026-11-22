import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { AlarmClock, Bell, BellRing, CalendarDays, Dumbbell, Flame, GraduationCap, Hourglass, ListChecks, Moon, Send, Timer } from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { TimePickerSheet } from '@/components/ui/Pickers';
import { Pill, Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { DSSwitch, SettingRow } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { useI18n } from '@/i18n';
import {
  getExactAlarmState,
  getPermissionState,
  NOTIFICATIONS_SUPPORTED,
  requestExactAlarm,
  requestPermission,
  sendTestNotification,
  syncNotifications,
  type PermissionState,
} from '@/services/notifications';
import { usePreferences, type Preferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type ToggleKey = 'remindersTasks' | 'remindersEvents' | 'remindersClasses' | 'remindersHabits' | 'remindersCountdowns' | 'remindersWorkouts';

export default function NotificationSettingsScreen() {
  const palette = usePalette();
  const { t, formatTime, formatDuration } = useI18n();
  const { preferences, setPreferences } = usePreferences();
  const { toast } = useFeedback();
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [exact, setExact] = useState<boolean | null>(null);
  const [pickingMood, setPickingMood] = useState(false);
  const isExpoGo = Constants.appOwnership === 'expo';

  const refresh = useCallback(() => {
    getPermissionState().then(setPermission).catch(() => setPermission('undetermined'));
    getExactAlarmState().then(setExact).catch(() => setExact(false));
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => subscription.remove();
  }, [refresh]);

  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    void setPreferences({ [key]: value } as Partial<Preferences>);
  };

  const toggles: { key: ToggleKey; icon: typeof Bell; title: string }[] = [
    { key: 'remindersTasks', icon: ListChecks, title: t('settings.taskReminders') },
    { key: 'remindersEvents', icon: CalendarDays, title: t('settings.eventReminders') },
    { key: 'remindersClasses', icon: GraduationCap, title: t('settings.classReminders') },
    { key: 'remindersHabits', icon: Flame, title: t('settings.habitReminders') },
    { key: 'remindersCountdowns', icon: Hourglass, title: t('settings.countdownReminders') },
    { key: 'remindersWorkouts', icon: Dumbbell, title: t('settings.workoutReminders') },
  ];

  if (!NOTIFICATIONS_SUPPORTED) {
    // Web app: no OS reminders, but the evening check-in still appears in-app.
    return (
      <Screen header={<ScreenHeader title={t('settings.notifications')} />}>
        <DSCard glow>
          <View style={styles.inline}>
            <BellRing size={20} color={palette.accentText} />
            <Text variant="title">{t('web.notifTitle')}</Text>
          </View>
          <Text variant="small" tone="secondary" style={styles.spaced}>
            {t('web.notifBody')}
          </Text>
        </DSCard>
        <SectionHeader title={t('settings.eveningReflection')} />
        <DSCard>
          <SettingRow
            icon={Moon}
            title={t('settings.moodReminder')}
            subtitle={preferences.moodReminderEnabled ? t('settings.moodReminderAt', { time: formatTime(preferences.moodReminderMinute) }) : t('common.off')}
            onPress={() => setPickingMood(true)}
            right={<DSSwitch label={t('settings.moodReminder')} value={preferences.moodReminderEnabled} onChange={(value) => set('moodReminderEnabled', value)} />}
          />
        </DSCard>
        <TimePickerSheet visible={pickingMood} value={preferences.moodReminderMinute} onClose={() => setPickingMood(false)} onChange={(value) => set('moodReminderMinute', value)} title={t('settings.moodReminder')} />
      </Screen>
    );
  }

  return (
    <Screen header={<ScreenHeader title={t('settings.notifications')} />}>
      <DSCard glow>
        <View style={styles.rowBetween}>
          <View style={styles.inline}>
            <BellRing size={20} color={palette.accentText} />
            <Text variant="title">{t('settings.permission')}</Text>
          </View>
          {permission ? <Pill label={t(`permission.${permission}`)} tone={permission === 'granted' ? 'accent' : 'danger'} /> : null}
        </View>
        <Text variant="small" tone="secondary" style={styles.spaced}>
          {permission === 'granted' ? t('settings.permissionGranted') : permission === 'denied' ? t('settings.permissionDenied') : t('settings.permissionAsk')}
        </Text>
        {permission === 'granted' ? (
          <PremiumButton
            label={t('settings.sendTest')}
            icon={Send}
            variant="secondary"
            size="md"
            style={styles.spaced}
            onPress={async () => {
              await sendTestNotification(t('settings.testTitle'), t('settings.testBody'));
              toast(t('settings.testSent'));
            }}
          />
        ) : (
          <PremiumButton
            label={permission === 'denied' ? t('notifications.openSettings') : t('onboarding.notifAllow')}
            size="md"
            style={styles.spaced}
            onPress={async () => {
              if (permission === 'denied') {
                await Linking.openSettings();
                return;
              }
              const state = await requestPermission();
              setPermission(state);
              if (state === 'granted') void syncNotifications();
            }}
          />
        )}
      </DSCard>

      {Platform.OS === 'android' ? (
        <DSCard>
          <View style={styles.rowBetween}>
            <View style={styles.inline}>
              <AlarmClock size={20} color={palette.accentText} />
              <Text variant="title">{t('settings.exactAlarms')}</Text>
            </View>
            {exact != null ? <Pill label={exact ? t('settings.exactOn') : t('settings.exactOff')} tone={exact ? 'accent' : 'muted'} /> : null}
          </View>
          <Text variant="small" tone="secondary" style={styles.spaced}>
            {exact ? t('settings.exactOnBody') : t('settings.exactOffBody')}
          </Text>
          {!exact ? (
            <PremiumButton
              label={t('settings.allowExact')}
              variant="secondary"
              size="md"
              style={styles.spaced}
              onPress={async () => {
                const granted = await requestExactAlarm();
                setExact(granted);
                if (!granted) toast(isExpoGo ? t('settings.exactExpoGo') : t('settings.exactNotGranted'), { tone: 'info' });
                else void syncNotifications();
              }}
            />
          ) : null}
        </DSCard>
      ) : null}

      <SectionHeader title={t('settings.eveningReflection')} />
      <DSCard>
        <SettingRow
          icon={Moon}
          title={t('settings.moodReminder')}
          subtitle={preferences.moodReminderEnabled ? t('settings.moodReminderAt', { time: formatTime(preferences.moodReminderMinute) }) : t('common.off')}
          onPress={() => setPickingMood(true)}
          right={<DSSwitch label={t('settings.moodReminder')} value={preferences.moodReminderEnabled} onChange={(value) => set('moodReminderEnabled', value)} />}
        />
      </DSCard>

      <SectionHeader title={t('settings.reminderTypes')} />
      <DSCard>
        {toggles.map((toggle) => (
          <SettingRow key={toggle.key} icon={toggle.icon} title={toggle.title} right={<DSSwitch label={toggle.title} value={preferences[toggle.key]} onChange={(value) => set(toggle.key, value)} />} />
        ))}
      </DSCard>

      <SectionHeader title={t('settings.defaultLead')} />
      <DSCard>
        <View style={styles.inline}>
          <Timer size={18} color={palette.accentText} />
          <Text variant="small" tone="secondary" style={styles.flex}>
            {t('settings.defaultLeadSub')}
          </Text>
        </View>
        <View style={[styles.chips, styles.spaced]}>
          {[0, 5, 10, 15, 30, 60].map((value) => (
            <DSChip
              key={value}
              label={value === 0 ? t('reminder.atTime') : formatDuration(value * 60)}
              selected={preferences.defaultReminderOffset === value}
              onPress={() => set('defaultReminderOffset', value)}
              size="sm"
            />
          ))}
        </View>
      </DSCard>

      <View style={[styles.note, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Bell size={16} color={palette.textMuted} />
        <Text variant="small" tone="muted" style={styles.flex}>
          {t('settings.deliveryNote')}
        </Text>
      </View>
      <TimePickerSheet visible={pickingMood} value={preferences.moodReminderMinute} onClose={() => setPickingMood(false)} onChange={(value) => set('moodReminderMinute', value)} title={t('settings.moodReminder')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  spaced: { marginTop: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  note: { flexDirection: 'row', gap: space.sm, padding: space.lg, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
});
