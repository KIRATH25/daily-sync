import { useEffect, useState } from 'react';

import { useI18n } from '@/i18n';
import { authenticate, readLockSettings } from '@/services/security';

/** Session unlock lasts a few minutes so moving between journal screens doesn't re-prompt. */
const UNLOCK_WINDOW_MS = 5 * 60_000;
let unlockedAt = 0;

export type GateState = 'checking' | 'locked' | 'open';

export function useJournalGate(): { state: GateState; retry: () => void } {
  const { t } = useI18n();
  const [state, setState] = useState<GateState>(() => (Date.now() - unlockedAt < UNLOCK_WINDOW_MS ? 'open' : 'checking'));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (state === 'open') return;
    let active = true;
    (async () => {
      const settings = await readLockSettings();
      if (!settings.journalLock) {
        if (active) setState('open');
        return;
      }
      const ok = await authenticate(t('journal.unlockPrompt'), t('common.cancel'));
      if (!active) return;
      if (ok) unlockedAt = Date.now();
      setState(ok ? 'open' : 'locked');
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return { state, retry: () => { setState('checking'); setAttempt((value) => value + 1); } };
}
