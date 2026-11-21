import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { BookOpen, LockKeyhole, Plus, Search } from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { listJournal } from '@/db/repositories/journalRepo';
import { useJournalGate } from '@/hooks/useJournalGate';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n } from '@/i18n';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';

export default function JournalScreen() {
  const palette = usePalette();
  const { t, formatDate } = useI18n();
  const { preferences } = usePreferences();
  const gate = useJournalGate();
  const [search, setSearch] = useState('');
  const entries = useLiveQuery(() => (gate.state === 'open' ? listJournal() : Promise.resolve([])), ['journal_entries'], [gate.state]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = entries.data ?? [];
    if (!query) return list;
    return list.filter((entry) => entry.body.toLowerCase().includes(query) || (entry.title ?? '').toLowerCase().includes(query));
  }, [entries.data, search]);

  const header = <ScreenHeader large eyebrow={t('journal.eyebrow')} title={t('journal.title')} subtitle={t('journal.subtitle')} />;

  if (gate.state !== 'open') {
    return (
      <Screen header={header}>
        {gate.state === 'checking' ? (
          <LoadingState rows={2} />
        ) : (
          <EmptyState icon={LockKeyhole} title={t('journal.lockedTitle')} message={t('journal.lockedBody')} actionLabel={t('lock.unlock')} onAction={gate.retry} />
        )}
      </Screen>
    );
  }

  return (
    <Screen header={header} footer={<PremiumButton label={t('journal.new')} icon={Plus} onPress={() => router.push('/journal/new')} />}>
      <View style={[styles.search, { backgroundColor: palette.surfaceAlt }]}>
        <Search size={18} color={palette.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('journal.search')}
          placeholderTextColor={palette.textMuted}
          style={[styles.searchInput, { color: palette.text, fontFamily: preferences.language === 'hi' ? fonts.hindiRegular : fonts.bodyMedium }]}
          accessibilityLabel={t('journal.search')}
        />
      </View>
      {entries.loading && !entries.data ? (
        <LoadingState />
      ) : visible.length === 0 ? (
        <EmptyState icon={BookOpen} title={search ? t('tasks.noResults') : t('journal.emptyTitle')} message={search ? undefined : t('journal.emptyBody')} />
      ) : (
        visible.map((entry) => (
          <DSCard key={entry.id} onPress={() => router.push(`/journal/${entry.id}`)} accessibilityLabel={entry.title ?? formatDate(entry.date, 'long')}>
            <Text variant="label" tone="accent">
              {formatDate(entry.date, 'long')}
            </Text>
            {entry.title ? (
              <Text variant="h3" style={styles.title} numberOfLines={1}>
                {entry.title}
              </Text>
            ) : null}
            <Text variant="body" tone="secondary" numberOfLines={3} style={styles.body}>
              {entry.body}
            </Text>
          </DSCard>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 50, borderRadius: radius.md },
  searchInput: { flex: 1, fontSize: 15 },
  title: { marginTop: space.xs },
  body: { marginTop: space.xs },
});
