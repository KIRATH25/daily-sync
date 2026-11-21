import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';

/**
 * Returns `Date.now()` refreshed every `intervalMs`, aligned to the wall
 * clock — but only while the screen is focused and the app is in the
 * foreground. No timer runs for hidden screens, which keeps battery use low;
 * values are always recomputed from the real clock, so they are exact the
 * moment the screen becomes visible again.
 */
export function useTicker(intervalMs = 1000, enabled = true): number {
  const focused = useIsFocused();
  const [now, setNow] = useState(() => Date.now());
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!enabled || !focused || !appActive) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      timer = setTimeout(tick, intervalMs - (current % intervalMs) + 10);
    };
    // Refresh immediately on (re)activation, then align to the wall clock.
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [enabled, focused, appActive, intervalMs]);

  return now;
}
