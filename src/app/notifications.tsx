import { useEffect, useMemo, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  Award,
  Bell,
  BellOff,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Dumbbell,
  Flame,
  GraduationCap,
  Hourglass,
  ListChecks,
  Moon,
  Settings2,
  Sparkles,
  Trash2,
  type LucideIcon,
} from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, ScreenHeader, SectionHeader } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { SettingRow } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { clearReadInbox, listInbox, listRecords, markAllInboxRead, markInboxRead } from '@/db/repositories/notificationsRepo';
import { useToday } from '@/hooks/useClock';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n, type TKey } from '@/i18n';
import { addDays } from '@/lib/dates';
import { todayKey } from '@/lib/timezone';
import { getPermissionState, requestPermission, syncNotifications, type PermissionState } from '@/services/notifications';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import type { InboxCategory } from '@/types/models';

const ICONS: Record<InboxCategory, LucideIcon> = {
  task: ListChecks,
  event: CalendarDays,
  reminder: Bell,
  habit: Flame,
  class: GraduationCap,
  exam: ClipboardList,
  workout: Dumbbell,
  countdown: Hourglass,
  mood: Moon,
  achievement: Award,
  system: Sparkles,
};

type Filter = 'all' | 'reminders' | 'tasks' | 'college' | 'wellbeing' | 'achievements';
const FILTERS: Record<Filter, InboxCategory[] | null> = {
  all: null,
  reminders: ['reminder', 'event', 'countdown'],
  tasks: ['task'],
  college: ['class', 'exam'],
  wellbeing: ['habit', 'mood', 'workout'],
  achievements: ['achievement', 'system'],
};

export default function NotificationsScreen() {
  const palette = usePalette();
  const { t, formatRelative, formatInstant, formatDate } = useI18n();
  const { preferences } = usePreferences();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>('all');
  const [permission, setPermission] = useState<PermissionState | null>(null);

  useEffect(() => {
    void syncNotifications();
    const check = () => getPermissionState().then(setPermission).catch(() => setPermission('undetermined'));
    check();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => subscription.remove();
  }, []);

  const query = useLiveQuery(
    async () => {
      const [items, upcoming] = await Promise.all([listInbox(150), listRecords()]);
      return { items, upcoming: upcoming.slice(0, 5) };
    },
    ['inbox_items', 'notification_records'],
    [],
  );

  const groups = useMemo(() => {
    const items = (query.data?.items ?? []).filter((item) => !FILTERS[filter] || FILTERS[filter]?.includes(item.category));
    const yesterday = addDays(today, -1);
    const sections: { key: string; title: string; items: typeof items }[] = [
      { key: 'today', title: t('common.today'), items: [] },
      { key: 'yesterday', title: t('common.yesterday'), items: [] },
      { key: 'earlier', title: t('notifications.earlier'), items: [] },
    ];
    for (const item of items) {
      const day = todayKey(preferences.timeZone, item.occurredAt);
      const target = day === today ? sections[0] : day === yesterday ? sections[1] : sections[2];
      target?.items.push(item);
    }
    return sections.filter((section) => section.items.length > 0);
  }, [query.data, filter, today, preferences.timeZone, t]);

  const unread = (query.data?.items ?? []).filter((item) => item.readAt == null).length;

  const header = (
    <ScreenHeader
      title={unread ? t('notifications.titleCount', { count: unread }) : t('notifications.title')}
      actions={
        <>
          <IconButton icon={CheckCheck} label={t('notifications.markAll')} onPress={() => markAllInboxRead()} size={42} disabled={!unread} />
          <IconButton icon={Settings2} label={t('settings.notifications')} onPress={() => router.push('/settings/notifications')} size={42} />
        </>
      }
    />
  );

  return (
    <Screen header={header}>
      {permission && permission !== 'granted' ? (
        <DSCard glow>
          <View style={styles.permission}>
            <BellOff size={22} color={palette.accentText} />
            <View style={styles.flex}>
              <Text variant="title">{t('notifications.offTitle')}</Text>
              <Text variant="small" tone="secondary">
                {permission === 'denied' ? t('notifications.offDenied') : t('notifications.offBody')}
              </Text>
            </View>
          </View>
          <PremiumButton
            label={permission === 'denied' ? t('notifications.openSettings') : t('onboarding.notifAllow')}
            size="md"
            style={styles.spaced}
            onPress={async () => {
              const state = await requestPermission();
              setPermission(state);
              if (state === 'granted') void syncNotifications();
              else if (state === 'denied') router.push('/settings/notifications');
            }}
          />
        </DSCard>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
        {(Object.keys(FILTERS) as Filter[]).map((key) => (
          <DSChip key={key} label={t(`notifications.filter.${key}` as TKey)} selected={filter === key} onPress={() => setFilter(key)} size="sm" />
        ))}
      </ScrollView>

      {query.data && query.data.upcoming.length > 0 && filter === 'all' ? (
        <DSCard tone="alt">
          <Text variant="label" tone="secondary">
            {t('notifications.comingUp')}
          </Text>
          {query.data.upcoming.map((record) => {
            const Icon = ICONS[record.category] ?? Bell;
            return (
              <View key={record.id} style={styles.upcoming}>
                <Icon size={15} color={palette.accentText} />
                <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                  {record.title}
                </Text>
                <Text variant="small" tone="secondary">
                  {todayKey(preferences.timeZone, record.fireAt) === today ? formatInstant(record.fireAt) : `${formatDate(todayKey(preferences.timeZone, record.fireAt), 'dayMonth')} · ${formatInstant(record.fireAt)}`}
                </Text>
              </View>
            );
          })}
        </DSCard>
      ) : null}

      {!query.data ? (
        <LoadingState />
      ) : groups.length === 0 ? (
        <EmptyState icon={Bell} title={t('notifications.emptyTitle')} message={t('notifications.emptyBody')} />
      ) : (
        groups.map((section) => (
          <View key={section.key} style={styles.section}>
            <SectionHeader title={section.title} />
            {section.items.map((item) => {
              const Icon = ICONS[item.category] ?? Bell;
              const isUnread = item.readAt == null;
              return (
                <PressableScale
                  key={item.id}
                  onPress={() => {
                    void markInboxRead(item.id);
                    if (item.route && item.route.startsWith('/')) router.push(item.route as never);
                  }}
                  accessibilityLabel={`${item.title}${item.body ? `. ${item.body}` : ''}`}
                  scaleTo={0.98}
                  style={[
                    styles.item,
                    { backgroundColor: palette.surface, borderColor: palette.border, borderLeftColor: isUnread ? palette.accent : palette.border, opacity: isUnread ? 1 : 0.75 },
                  ]}
                >
                  <View style={[styles.icon, { backgroundColor: palette.surfaceAlt }]}>
                    <Icon size={18} color={palette.accentText} />
                    {isUnread ? <View style={[styles.unreadDot, { backgroundColor: palette.accent, borderColor: palette.surface }]} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.rowBetween}>
                      <Text variant="micro" tone="secondary">
                        {t(`inbox.${item.category}` as TKey)}
                      </Text>
                      <Text variant="small" tone="muted">
                        {formatRelative(item.occurredAt - Date.now())}
                      </Text>
                    </View>
                    <Text variant="title" numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.body ? (
                      <Text variant="small" tone="secondary" numberOfLines={2}>
                        {item.body}
                      </Text>
                    ) : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ))
      )}
      {query.data && query.data.items.some((item) => item.readAt != null) ? (
        <PremiumButton label={t('notifications.clearRead')} icon={Trash2} variant="ghost" size="sm" onPress={() => clearReadInbox()} />
      ) : null}
      <DSCard>
        <SettingRow icon={Settings2} title={t('settings.notifications')} subtitle={t('settings.notificationsSub')} onPress={() => router.push('/settings/notifications')} />
      </DSCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  permission: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  spaced: { marginTop: space.md },
  chipScroll: { marginHorizontal: -space.gutter, flexGrow: 0 },
  chips: { gap: space.sm, paddingHorizontal: space.gutter },
  upcoming: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  section: { gap: space.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  item: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 3 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: -2, right: -2, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
});
