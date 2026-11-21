import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ImagePlus, Trash2 } from '@/components/ui/icons';

import { CountdownHero } from '@/components/countdown/CountdownHero';
import { ColorSwatches, FormSection, ReminderPicker } from '@/components/forms/FormParts';
import { PremiumButton } from '@/components/ui/Button';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { DSInput } from '@/components/ui/Input';
import { DatePickerSheet, PickerField, TimePickerSheet } from '@/components/ui/Pickers';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { LoadingState } from '@/components/ui/States';
import { DSSwitch, SettingRow } from '@/components/ui/Switch';
import { createCountdown, getCountdown, updateCountdown, type CountdownInput } from '@/db/repositories/countdownsRepo';
import { useClock } from '@/hooks/useClock';
import { useI18n, type TKey } from '@/i18n';
import { addDays } from '@/lib/dates';
import { wallClockToInstant } from '@/lib/timezone';
import { LIMITS, validateOptionalText, validateTitle } from '@/lib/validation';
import { deleteStoredImage, pickImage } from '@/services/media';
import { usePreferences } from '@/store/preferences';
import { space } from '@/theme/tokens';
import { COUNTDOWN_STYLES } from '@/types/models';

export default function CountdownEditScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id ?? null;
  const { t, formatDate, formatTime } = useI18n();
  const { preferences } = usePreferences();
  const { toast } = useFeedback();
  const clock = useClock();
  const [loaded, setLoaded] = useState(!editingId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [createdAt, setCreatedAt] = useState(() => Date.now());
  const [form, setForm] = useState<CountdownInput>({
    title: '',
    subtitle: null,
    targetDate: addDays(clock.dateKey, 30),
    targetMinute: 18 * 60,
    style: 'digital',
    accent: null,
    backgroundUri: null,
    message: null,
    pinned: true,
    showSeconds: true,
    reminderOffsets: [10080, 1440],
  });
  const update = (patch: Partial<CountdownInput>) => setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    if (!editingId) return;
    getCountdown(editingId)
      .then((countdown) => {
        if (countdown) {
          const { id: _id, createdAt: created, updatedAt: _u, ...rest } = countdown;
          setForm(rest);
          setCreatedAt(created);
        }
      })
      .catch(() => toast(t('error.loadFailed'), { tone: 'error' }))
      .finally(() => setLoaded(true));
  }, [editingId, toast, t]);

  const save = async () => {
    const title = validateTitle(form.title);
    if (!title.ok) {
      setError(t(title.error));
      return;
    }
    const subtitle = validateOptionalText(form.subtitle, LIMITS.title);
    const message = validateOptionalText(form.message, LIMITS.popupMessage);
    if (!subtitle.ok || !message.ok) {
      toast(t('validation.tooLong'), { tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      const input = { ...form, title: title.value, subtitle: subtitle.value, message: message.value };
      if (editingId) await updateCountdown(editingId, input);
      else {
        const id = await createCountdown(input);
        router.replace(`/countdowns/${id}`);
        toast(t('countdown.created'));
        return;
      }
      toast(t('create.updated'));
      router.back();
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const chooseImage = async () => {
    try {
      const uri = await pickImage([4, 5]);
      if (uri) {
        if (form.backgroundUri) deleteStoredImage(form.backgroundUri);
        update({ backgroundUri: uri });
      }
    } catch {
      toast(t('error.imageFailed'), { tone: 'error' });
    }
  };

  const header = <ScreenHeader leading="close" title={editingId ? t('countdown.edit') : t('countdown.new')} />;
  if (!loaded) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }

  const target = wallClockToInstant(form.targetDate, form.targetMinute, preferences.timeZone);
  return (
    <Screen header={header} footer={<PremiumButton label={editingId ? t('countdown.commit') : t('countdown.create')} icon={Check} onPress={save} loading={saving} />}>
      <CountdownHero countdown={{ ...form, id: 'preview', title: form.title || t('countdown.previewTitle'), createdAt, updatedAt: createdAt }} targetMs={target} compact />
      <FormSection title={t('create.details')}>
        <DSInput label={t('create.titleLabel')} placeholder={t('countdown.titlePlaceholder')} value={form.title} onChangeText={(title) => update({ title })} maxLength={LIMITS.title} error={error} autoFocus={!editingId} />
        <DSInput label={t('countdown.subtitleLabel')} placeholder={t('countdown.subtitlePlaceholder')} value={form.subtitle ?? ''} onChangeText={(subtitle) => update({ subtitle })} maxLength={LIMITS.title} />
        <DSInput label={t('countdown.memo')} placeholder={t('countdown.memoPlaceholder')} value={form.message ?? ''} onChangeText={(message) => update({ message })} maxLength={LIMITS.popupMessage} multiline />
      </FormSection>
      <FormSection title={t('create.schedule')}>
        <View style={styles.row}>
          <PickerField label={t('create.date')} value={formatDate(form.targetDate, 'medium')} onPress={() => setPicker('date')} />
          <PickerField icon="time" label={t('create.time')} value={formatTime(form.targetMinute)} onPress={() => setPicker('time')} />
        </View>
        <SettingRow title={t('countdown.showSeconds')} right={<DSSwitch label={t('countdown.showSeconds')} value={form.showSeconds} onChange={(showSeconds) => update({ showSeconds })} />} />
        <SettingRow title={t('countdown.pinDashboard')} subtitle={t('countdown.pinDashboardSub')} right={<DSSwitch label={t('countdown.pinDashboard')} value={form.pinned} onChange={(pinned) => update({ pinned })} />} />
      </FormSection>
      <FormSection title={t('countdown.studio')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {COUNTDOWN_STYLES.map((style) => (
            <DSChip key={style} label={t(`countdownStyle.${style}` as TKey)} selected={form.style === style} onPress={() => update({ style })} />
          ))}
        </ScrollView>
        <ColorSwatches value={form.accent} onChange={(accent) => update({ accent })} label={t('countdown.accent')} />
        <View style={styles.row}>
          <PremiumButton label={form.backgroundUri ? t('countdown.swapImage') : t('countdown.addImage')} icon={ImagePlus} variant="secondary" size="md" onPress={chooseImage} style={styles.flex} />
          {form.backgroundUri ? (
            <PremiumButton
              label={t('common.remove')}
              icon={Trash2}
              variant="ghost"
              size="md"
              fullWidth={false}
              onPress={() => {
                deleteStoredImage(form.backgroundUri);
                update({ backgroundUri: null });
              }}
            />
          ) : null}
        </View>
      </FormSection>
      <FormSection title={t('countdown.reminders')}>
        <ReminderPicker value={form.reminderOffsets} onChange={(reminderOffsets) => update({ reminderOffsets })} />
      </FormSection>
      <DatePickerSheet visible={picker === 'date'} value={form.targetDate} minDate={clock.dateKey} onClose={() => setPicker(null)} onChange={(targetDate) => update({ targetDate })} />
      <TimePickerSheet visible={picker === 'time'} value={form.targetMinute} onClose={() => setPicker(null)} onChange={(targetMinute) => update({ targetMinute })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.sm },
  chips: { flexDirection: 'row', gap: space.sm },
});
