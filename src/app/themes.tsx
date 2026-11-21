import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, useColorScheme, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Check, RotateCcw, Save, ShieldCheck, Trash2 } from '@/components/ui/icons';

import { RadialThemeSelector } from '@/components/themes/RadialThemeSelector';
import { ThemePreview } from '@/components/themes/ThemePreview';
import { PremiumButton } from '@/components/ui/Button';
import { DSCard } from '@/components/ui/Card';
import { DSChip } from '@/components/ui/Chip';
import { useFeedback } from '@/components/ui/Feedback';
import { IconButton } from '@/components/ui/IconButton';
import { DSInput } from '@/components/ui/Input';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { DSBottomSheet } from '@/components/ui/Sheet';
import { DSSwitch, SettingRow } from '@/components/ui/Switch';
import { Text } from '@/components/ui/Text';
import { deleteCustomTheme, listCustomThemes, saveCustomTheme } from '@/db/repositories/themesRepo';
import { useHaptics } from '@/hooks/useHaptics';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useI18n, type TKey } from '@/i18n';
import { normalizeHex } from '@/lib/color';
import { getPreset, resolvePalette, THEME_PRESETS, validateCustomColors, type AppearanceMode, type ThemePresetId } from '@/theme/palette';
import { DEFAULT_PREFERENCES, usePreferences, type CardStyle, type MotionPreference, type ThemeOverrides } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';

const ACCENT_SWATCHES = ['#F4D54D', '#E8796E', '#A78BFA', '#4FBF8A', '#3EA8E8', '#F9E99C', '#F28BB8'];
type OverrideKey = keyof ThemeOverrides;

export default function ThemeStudioScreen() {
  const palette = usePalette();
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();
  const { toast, confirm } = useFeedback();
  const { fire } = useHaptics();
  const { width } = useWindowDimensions();
  const system = useColorScheme() === 'light' ? 'light' : 'dark';

  const [presetId, setPresetId] = useState<ThemePresetId>(preferences.themePresetId);
  const [appearance, setAppearance] = useState<AppearanceMode>(preferences.appearance);
  const [overrides, setOverrides] = useState<ThemeOverrides>(preferences.themeOverrides);
  const [customId, setCustomId] = useState<string | null>(preferences.activeCustomThemeId);
  const [motion, setMotion] = useState<MotionPreference>(preferences.motion);
  const [cardStyle, setCardStyle] = useState<CardStyle>(preferences.cardStyle);
  const [saveOpen, setSaveOpen] = useState(false);
  const [themeName, setThemeName] = useState('');
  const customThemes = useLiveQuery(listCustomThemes, ['custom_themes'], []);

  const presetIndex = Math.max(0, THEME_PRESETS.findIndex((preset) => preset.id === presetId));
  const candidate = useMemo(() => resolvePalette({ presetId, appearance, overrides }, system), [presetId, appearance, overrides, system]);
  const options = useMemo(() => THEME_PRESETS.map((preset) => ({ id: preset.id, color: preset.swatch, label: t(`theme.${preset.id}` as TKey) })), [t]);
  const hasOverrides = Object.values(overrides).some(Boolean);

  const choosePreset = (index: number) => {
    const preset = THEME_PRESETS[index];
    if (!preset) return;
    setPresetId(preset.id);
    setCustomId(null);
    setOverrides(DEFAULT_PREFERENCES.themeOverrides);
    if (appearance !== 'system') setAppearance(preset.preferred);
  };

  const apply = async () => {
    await setPreferences({ themePresetId: presetId, appearance, themeOverrides: overrides, activeCustomThemeId: customId, motion, cardStyle });
    fire('success');
    toast(t('themes.applied'));
    router.back();
  };

  const restore = async () => {
    const ok = await confirm({ title: t('themes.restoreTitle'), message: t('themes.restoreBody'), confirmLabel: t('themes.restore') });
    if (!ok) return;
    setPresetId(DEFAULT_PREFERENCES.themePresetId);
    setAppearance(DEFAULT_PREFERENCES.appearance);
    setOverrides(DEFAULT_PREFERENCES.themeOverrides);
    setCustomId(null);
    setMotion(DEFAULT_PREFERENCES.motion);
    setCardStyle(DEFAULT_PREFERENCES.cardStyle);
  };

  const saveCustom = async () => {
    const name = themeName.trim().slice(0, 40);
    if (!name) return;
    try {
      const id = await saveCustomTheme(customId, { name, basePreset: presetId, ...overrides });
      setCustomId(id);
      setSaveOpen(false);
      toast(t('themes.saved'));
    } catch {
      toast(t('error.saveFailed'), { tone: 'error' });
    }
  };

  const setOverride = (key: OverrideKey, value: string | null): string | null => {
    const next = { ...overrides, [key]: value };
    const base = getPreset(presetId)[candidate.scheme];
    const problem = validateCustomColors({ background: next.background ?? base.background, accent: next.accent ?? base.accent, surface: next.surface, highlight: next.highlight });
    if (problem) return t(`themes.problem.${problem}` as TKey);
    setOverrides(next);
    setCustomId(null);
    return null;
  };

  const header = <ScreenHeader leading="close" title={t('themes.title')} />;
  const footer = (
    <View style={styles.footer}>
      <IconButton icon={RotateCcw} label={t('themes.restore')} onPress={restore} size={52} />
      <PremiumButton label={t('themes.saveCustom')} icon={Save} variant="secondary" fullWidth={false} onPress={() => setSaveOpen(true)} />
      <PremiumButton label={t('themes.apply')} iconRight={ArrowRight} onPress={apply} style={styles.flex} />
    </View>
  );

  const selectorSize = Math.min(width - space.gutter * 2, 340);

  return (
    <Screen header={header} footer={footer}>
      <View style={styles.intro}>
        <Text variant="label" tone="accent">
          {t('themes.eyebrow')}
        </Text>
        <Text variant="display">{t('themes.headline')}</Text>
        <Text variant="body" tone="secondary">
          {t('themes.subtitle')}
        </Text>
      </View>
      <View style={styles.center}>
        <RadialThemeSelector
          options={options}
          index={presetIndex}
          onChange={choosePreset}
          size={selectorSize}
          centerEyebrow={t('themes.activeAura')}
          centerTitle={customId ? (customThemes.data?.find((item) => item.id === customId)?.name ?? t('themes.custom')) : t(`theme.${presetId}` as TKey)}
          centerSubtitle={hasOverrides ? t('themes.customised') : presetId === 'obsidian_gold' ? t('themes.default') : t('themes.preset')}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
        {THEME_PRESETS.map((preset, index) => (
          <DSChip key={preset.id} label={`${String(index + 1).padStart(2, '0')} ${t(`theme.${preset.id}` as TKey)}`} dot={preset.swatch} selected={presetIndex === index && !customId} onPress={() => choosePreset(index)} />
        ))}
      </ScrollView>
      {customThemes.data && customThemes.data.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
          {customThemes.data.map((theme) => (
            <PressableScale
              key={theme.id}
              onPress={() => {
                setPresetId(getPreset(theme.basePreset).id);
                setOverrides({ accent: theme.accent, background: theme.background, surface: theme.surface, highlight: theme.highlight });
                setCustomId(theme.id);
              }}
              onLongPress={async () => {
                if (await confirm({ title: t('themes.deleteCustom', { name: theme.name }), confirmLabel: t('common.delete'), destructive: true })) {
                  await deleteCustomTheme(theme.id);
                  if (customId === theme.id) setCustomId(null);
                }
              }}
              accessibilityLabel={theme.name}
              accessibilityHint={t('themes.longPressDelete')}
              style={[styles.customChip, { backgroundColor: customId === theme.id ? palette.accent : palette.surfaceAlt }]}
            >
              <View style={[styles.customDot, { backgroundColor: theme.accent ?? getPreset(theme.basePreset).swatch }]} />
              <Text variant="smallStrong" color={customId === theme.id ? palette.onAccent : palette.text}>
                {theme.name}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
      ) : null}

      <DSCard>
        <View style={styles.rowBetween}>
          <Text variant="label" tone="secondary">
            {t('themes.simulation')}
          </Text>
          <Text variant="smallStrong" tone="accent">
            {t(`appearance.${candidate.scheme}` as TKey)}
          </Text>
        </View>
        <View style={styles.spaced}>
          <ThemePreview
            palette={candidate}
            labels={{ docket: t('themes.previewDocket'), focus: t('themes.previewFocus'), tasks: t('themes.previewTasks'), sample: t('themes.previewSample'), synced: t('themes.previewSynced') }}
          />
        </View>
      </DSCard>

      <DSCard>
        <Text variant="h3">{t('themes.appearance')}</Text>
        <Segmented
          style={styles.spaced}
          options={[
            { value: 'light', label: t('appearance.light') },
            { value: 'dark', label: t('appearance.dark') },
            { value: 'system', label: t('appearance.system') },
          ]}
          value={appearance}
          onChange={setAppearance}
        />
      </DSCard>

      <DSCard>
        <View style={styles.rowBetween}>
          <Text variant="h3">{t('themes.accent')}</Text>
          <Text variant="smallStrong" tone="accent" latin>
            {candidate.accent}
          </Text>
        </View>
        <View style={[styles.swatches, styles.spaced]}>
          {ACCENT_SWATCHES.map((color) => {
            const selected = candidate.accent === color;
            return (
              <PressableScale
                key={color}
                onPress={() => setOverride('accent', color)}
                haptic="selection"
                accessibilityState={{ selected }}
                accessibilityLabel={color}
                style={[styles.swatch, { backgroundColor: color, borderColor: selected ? palette.text : 'transparent' }]}
              >
                {selected ? <Check size={16} color="#141414" strokeWidth={3} /> : null}
              </PressableScale>
            );
          })}
        </View>
        <HexField label={t('themes.hexAccent')} value={overrides.accent} onApply={(value) => setOverride('accent', value)} />
        <HexField label={t('themes.hexBackground')} value={overrides.background} onApply={(value) => setOverride('background', value)} />
        <HexField label={t('themes.hexSurface')} value={overrides.surface} onApply={(value) => setOverride('surface', value)} />
        <HexField label={t('themes.hexHighlight')} value={overrides.highlight} onApply={(value) => setOverride('highlight', value)} />
        <View style={[styles.note, { backgroundColor: palette.surfaceAlt }]}>
          <ShieldCheck size={16} color={palette.accentText} />
          <Text variant="small" tone="secondary" style={styles.flex}>
            {t('themes.contrastNote')}
          </Text>
        </View>
      </DSCard>

      <DSCard>
        <Text variant="h3">{t('themes.tactile')}</Text>
        <Text variant="label" tone="secondary" style={styles.spaced}>
          {t('themes.cardStyle')}
        </Text>
        <Segmented
          style={styles.spacedSm}
          options={[
            { value: 'border', label: t('themes.cardBorder') },
            { value: 'soft', label: t('themes.cardSoft') },
          ]}
          value={cardStyle}
          onChange={setCardStyle}
          accent
        />
        <Text variant="label" tone="secondary" style={styles.spaced}>
          {t('themes.motion')}
        </Text>
        <Segmented
          style={styles.spacedSm}
          options={[
            { value: 'full', label: t('motion.full') },
            { value: 'reduced', label: t('motion.reduced') },
            { value: 'off', label: t('motion.off') },
          ]}
          value={motion}
          onChange={setMotion}
          accent
        />
        <SettingRow
          title={t('settings.haptics')}
          subtitle={t('settings.hapticsSub')}
          right={<DSSwitch label={t('settings.haptics')} value={preferences.haptics} onChange={(haptics) => void setPreferences({ haptics })} />}
        />
      </DSCard>

      <DSBottomSheet visible={saveOpen} onClose={() => setSaveOpen(false)} title={t('themes.saveCustom')} footer={<PremiumButton label={t('common.save')} onPress={saveCustom} disabled={!themeName.trim()} />}>
        <DSInput label={t('themes.nameLabel')} placeholder={t('themes.namePlaceholder')} value={themeName} onChangeText={setThemeName} maxLength={40} autoFocus />
        {customId ? (
          <PremiumButton
            label={t('themes.deleteThis')}
            icon={Trash2}
            variant="ghost"
            size="sm"
            onPress={async () => {
              await deleteCustomTheme(customId);
              setCustomId(null);
              setSaveOpen(false);
            }}
          />
        ) : null}
      </DSBottomSheet>
    </Screen>
  );
}

/** HEX input with validation, live swatch and contrast-safe apply. */
function HexField({ label, value, onApply }: { label: string; value: string | null; onApply: (value: string | null) => string | null }) {
  const palette = usePalette();
  const { t } = useI18n();
  const [text, setText] = useState(value ?? '');
  const [error, setError] = useState<string | null>(null);
  const normalized = normalizeHex(text);

  const apply = () => {
    if (!text.trim()) {
      setError(onApply(null));
      return;
    }
    if (!normalized) {
      setError(t('validation.invalidHex'));
      return;
    }
    const problem = onApply(normalized);
    setError(problem);
    if (!problem) setText(normalized);
  };

  return (
    <View style={styles.hex}>
      <Text variant="smallStrong" tone="secondary">
        {label}
      </Text>
      <View style={styles.hexRow}>
        <View style={[styles.hexBox, { backgroundColor: palette.surfaceAlt, borderColor: error ? palette.danger : 'transparent' }]}>
          <View style={[styles.hexPreview, { backgroundColor: normalized ?? 'transparent', borderColor: palette.borderStrong }]} />
          <Text variant="bodyStrong" tone="muted" latin>
            #
          </Text>
          <TextInput
            value={text.replace(/^#/, '')}
            onChangeText={(next) => {
              setText(next.replace(/[^0-9a-fA-F]/g, '').slice(0, 6));
              setError(null);
            }}
            placeholder="F4D54D"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            onSubmitEditing={apply}
            style={[styles.hexInput, { color: palette.text, fontFamily: fonts.displaySemi }]}
            accessibilityLabel={label}
          />
        </View>
        <PremiumButton label={text.trim() ? t('common.apply') : t('common.reset')} size="sm" variant="soft" fullWidth={false} onPress={apply} />
      </View>
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { gap: space.xs },
  center: { alignItems: 'center' },
  chipScroll: { marginHorizontal: -space.gutter, flexGrow: 0 },
  chips: { gap: space.sm, paddingHorizontal: space.gutter },
  customChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, height: 36, borderRadius: radius.pill },
  customDot: { width: 10, height: 10, borderRadius: 5 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spaced: { marginTop: space.md },
  spacedSm: { marginTop: space.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, marginTop: space.md, alignItems: 'center' },
  hex: { gap: 6, marginTop: space.md },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hexBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, borderRadius: radius.sm, paddingHorizontal: space.md, borderWidth: 1.5 },
  hexPreview: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
  hexInput: { flex: 1, fontSize: 16, letterSpacing: 1 },
  footer: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
