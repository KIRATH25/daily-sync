import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { instantToWallClock, type WallClock } from '@/lib/timezone';
import { usePreferences } from '@/store/preferences';

/**
 * Current wall clock in the user's zone, refreshed at each minute boundary
 * and whenever the app returns to the foreground — so "today" rolls over at
 * local midnight and countdown labels stay correct after backgrounding.
 * No timer runs while the app is in the background.
 */
export function useClock(granularity: 'minute' | 'second' = 'minute'): WallClock & { now: number } {
  const { preferences } = usePreferences();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unit = granularity === 'second' ? 1000 : 60_000;
    const schedule = () => {
      const current = Date.now();
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, unit - (current % unit) + 20);
    };
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    schedule();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(Date.now());
        stop();
        schedule();
      } else {
        stop();
      }
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [granularity]);

  return { ...instantToWallClock(now, preferences.timeZone), now };
}

export function useToday(): string {
  return useClock('minute').dateKey;
}
