import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { usePreferences } from '@/store/preferences';
import { usePalette } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';

import { Text } from './Text';

export interface DSInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  hint?: string;
  showCount?: boolean;
  left?: ReactNode;
  right?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  size?: 'md' | 'lg';
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function DSInput({
  label,
  error,
  hint,
  showCount,
  left,
  right,
  containerStyle,
  multiline,
  maxLength,
  value,
  size = 'md',
  onFocus,
  onBlur,
  ref,
  ...rest
}: DSInputProps) {
  const palette = usePalette();
  const { preferences } = usePreferences();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? palette.danger : focused ? palette.accent : 'transparent';

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text variant="smallStrong" tone="secondary">
            {label}
          </Text>
          {showCount && maxLength ? (
            <Text variant="small" tone="muted" latin>
              {(value ?? '').length}/{maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: palette.surfaceAlt,
            borderColor,
            minHeight: multiline ? 104 : size === 'lg' ? 58 : 52,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        {left}
        <TextInput
          ref={ref}
          value={value}
          multiline={multiline}
          maxLength={maxLength}
          placeholderTextColor={palette.textMuted}
          selectionColor={palette.accent}
          cursorColor={palette.accent}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          maxFontSizeMultiplier={1.35}
          accessibilityLabel={label ?? rest.placeholder}
          accessibilityHint={error ?? hint}
          style={[
            styles.input,
            {
              color: palette.text,
              fontFamily: preferences.language === 'hi' ? fonts.hindiRegular : fonts.bodyMedium,
              textAlignVertical: multiline ? 'top' : 'center',
              paddingVertical: multiline ? space.md : 0,
              fontSize: size === 'lg' ? 17 : 15.5,
            },
          ]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <Text variant="small" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.xs + 2 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  field: {
    flexDirection: 'row',
    borderRadius: radius.sm + 2,
    borderWidth: 1.5,
    paddingHorizontal: space.md + 2,
    gap: space.sm,
  },
  input: {
    flex: 1,
    minHeight: 48,
  },
});
