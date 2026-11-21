import { useMemo } from 'react';
import * as Haptics from 'expo-haptics';

import { usePreferences } from '@/store/preferences';

export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'warning' | 'error';

/**
 * Haptics that respect the user's setting. Used sparingly: selection changes,
 * completions and destructive confirmations — never on every tap.
 */
export function useHaptics() {
  const { preferences } = usePreferences();
  const enabled = preferences.haptics;
  return useMemo(() => {
    const fire = (kind: HapticKind) => {
      if (!enabled) return;
      const run = (): Promise<void> => {
        switch (kind) {
          case 'selection':
            return Haptics.selectionAsync();
          case 'light':
            return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          case 'medium':
            return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          case 'success':
            return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          case 'warning':
            return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          case 'error':
            return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      };
      run().catch(() => undefined);
    };
    return { fire, enabled };
  }, [enabled]);
}
