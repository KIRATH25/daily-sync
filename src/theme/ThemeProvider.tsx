import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import * as SystemUI from 'expo-system-ui';

import { usePreferences, type CardStyle } from '@/store/preferences';

import { resolvePalette, type Palette } from './palette';

interface ThemeContextValue {
  palette: Palette;
  /** True when animations should be minimised (system setting or user choice). */
  reduceMotion: boolean;
  /** True only when the user turned motion off entirely. */
  motionOff: boolean;
  cardStyle: CardStyle;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const systemScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const systemReduced = useReducedMotion();

  const palette = useMemo(
    () =>
      resolvePalette(
        {
          presetId: preferences.themePresetId,
          appearance: preferences.appearance,
          overrides: preferences.themeOverrides,
        },
        systemScheme,
      ),
    [preferences.themePresetId, preferences.appearance, preferences.themeOverrides, systemScheme],
  );

  const reduceMotion = systemReduced || preferences.motion !== 'full';
  const value = useMemo(
    () => ({ palette, reduceMotion, motionOff: preferences.motion === 'off', cardStyle: preferences.cardStyle }),
    [palette, reduceMotion, preferences.motion, preferences.cardStyle],
  );

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.background).catch(() => undefined);
  }, [palette.background]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={[styles.root, { backgroundColor: palette.background }]}>
        {children}
        <ThemeCrossfade color={palette.background} disabled={reduceMotion} />
      </View>
    </ThemeContext.Provider>
  );
}

/**
 * When the background colour changes, briefly overlays the previous colour
 * and fades it out, so theme switches dissolve instead of snapping.
 */
function ThemeCrossfade({ color, disabled }: { color: string; disabled: boolean }) {
  const previous = useRef(color);
  const [fadeColor, setFadeColor] = useState<string | null>(null);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (previous.current !== color && !disabled) {
      setFadeColor(previous.current);
      opacity.value = 0.85;
      opacity.value = withTiming(0, { duration: 320 });
    }
    previous.current = color;
  }, [color, disabled, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!fadeColor) return null;
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fadeColor }, style]} />;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}

export function usePalette(): Palette {
  return useTheme().palette;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
