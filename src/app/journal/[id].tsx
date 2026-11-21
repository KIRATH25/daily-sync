import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Check, LockKeyhole, Trash2 } from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { useFeedback } from '@/components/ui/Feedback';
import { DatePickerSheet } from '@/components/ui/Pickers';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { createJournalEntry, deleteJournalEntry, getJournalEntry, updateJournalEntry } from '@/db/repositories/journalRepo';
import { useToday } from '@/hooks/useClock';
import { useJournalGate } from '@/hooks/useJournalGate';
import { useI18n } from '@/i18n';
import { LIMITS, sanitizeText } from '@/lib/validation';
import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';

export default function JournalEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const palette = usePalette();
  const { t, formatDate } = useI18n();
  const { preferences } = usePreferences();
  const { toast, confirm } = useFeedback();
  const today = useToday();
  const gate = useJournalGate();
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loaded, setLoaded] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (isNew || gate.state !== 'open') return;
    getJournalEntry(id)
      .then((entry) => {
        if (entry) {
          setDate(entry.date);
          setTitle(entry.title ?? '');
          setBody(entry.body);
        }
      })
      .catch(() => toast(t('error.loadFailed'), { tone: 'error' }))
      .finally(() => setLoaded(true));
  }, [id, isNew, gate.state, toast, t]);

  const save = async () => {
    const cleanBody = sanitizeText(body);
    if (!cleanBody) {
      toast(t('journal.needBody'), { tone: 'info' });
      return;
    }
    setSaving(true);
    try {
      const cleanTitle = sanitizeText(title).slice(0, LIMITS.title) || null;
      if (isNew) await createJournalEntry(date, cleanTitle, cleanBody.slice(0, LIMITS.journal));
      else await updateJournalEntry(id, date, cleanTitle, cleanBody.slice(0, LIMITS.journal));
      toast(t('journal.saved'));
      router.back();
    } catch {
      // Never include journal content in logs.
      toast(t('error.saveFailed'), { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: t('common.deleteConfirmTitle'), message: t('journal.deleteBody'), confirmLabel: t('common.delete'), destructive: true });
    if (!ok) return;
    await deleteJournalEntry(id);
    toast(t('common.deleted'));
    router.back();
  };

  const header = <ScreenHeader leading="close" title={isNew ? t('journal.new') : t('journal.edit')} />;
  if (gate.state !== 'open') {
    return (
      <Screen header={header}>
        {gate.state === 'checking' ? <LoadingState rows={2} /> : <EmptyState icon={LockKeyhole} title={t('journal.lockedTitle')} actionLabel={t('lock.unlock')} onAction={gate.retry} />}
      </Screen>
    );
  }
  if (!loaded) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }

  const footer = (
    <View style={styles.footer}>
      {!isNew ? <PremiumButton label={t('common.delete')} icon={Trash2} variant="danger" fullWidth={false} onPress={remove} /> : null}
      <PremiumButton label={t('common.save')} icon={Check} onPress={save} loading={saving} style={styles.flex} />
    </View>
  );

  const fontFamily = preferences.language === 'hi' ? fonts.hindiRegular : fonts.bodyMedium;

  return (
    <Screen header={header} footer={footer}>
      <PressableScale onPress={() => setPicking(true)} accessibilityLabel={t('picker.pickDate')} style={[styles.date, { backgroundColor: palette.surfaceAlt }]}>
        <CalendarDays size={16} color={palette.accentText} />
        <Text variant="smallStrong">{formatDate(date, 'full')}</Text>
      </PressableScale>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t('journal.titlePlaceholder')}
        placeholderTextColor={palette.textMuted}
        maxLength={LIMITS.title}
        style={[styles.title, { color: palette.text, fontFamily: preferences.language === 'hi' ? fonts.hindiBold : fonts.displayBold }]}
        accessibilityLabel={t('journal.titlePlaceholder')}
        maxFontSizeMultiplier={1.3}
      />
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder={t('journal.bodyPlaceholder')}
        placeholderTextColor={palette.textMuted}
        multiline
        maxLength={LIMITS.journal}
        textAlignVertical="top"
        autoFocus={isNew}
        style={[styles.body, { color: palette.text, fontFamily }]}
        accessibilityLabel={t('journal.bodyPlaceholder')}
        maxFontSizeMultiplier={1.3}
      />
      <Text variant="small" tone="muted" align="right" latin>
        {body.length.toLocaleString()} / {LIMITS.journal.toLocaleString()}
      </Text>
      <DatePickerSheet visible={picking} value={date} onClose={() => setPicking(false)} onChange={setDate} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { flexDirection: 'row', gap: space.sm },
  date: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start', paddingHorizontal: space.md, height: 36, borderRadius: radius.pill },
  title: { fontSize: 26, minHeight: 48 },
  body: { fontSize: 16.5, lineHeight: 26, minHeight: 320 },
});
