import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Fingerprint, LockKeyhole } from '@/components/ui/icons';

import { PremiumButton } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useI18n } from '@/i18n';
import { authenticate, readLockSettings } from '@/services/security';
import { usePalette } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/** Re-lock after the app has been in the background this long. */
const RELOCK_AFTER_MS = 60_000;

/**
 * Full-screen privacy lock. When App Lock is on, the app content is covered
 * on launch and after a minute in the background until the user passes
 * device authentication (biometrics or device PIN).
 */
export function AppLockGate() {
  const palette = usePalette();
  const { t } = useI18n();
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await authenticate(t('lock.prompt'), t('common.cancel'));
    prompting.current = false;
    if (ok) setLocked(false);
  }, [t]);

  useEffect(() => {
    let mounted = true;
    readLockSettings().then((settings) => {
      if (mounted && settings.appLock) {
        setLocked(true);
        void unlock();
      }
    });
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        const settings = await readLockSettings();
        if (settings.appLock && away > RELOCK_AFTER_MS) {
          setLocked(true);
          void unlock();
        }
      }
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [unlock]);

  if (!locked) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: palette.background }]} accessibilityViewIsModal>
      <View style={[styles.icon, { backgroundColor: palette.accentMuted }]}>
        <LockKeyhole size={32} color={palette.accentText} strokeWidth={1.8} />
      </View>
      <Text variant="h2" align="center">
        {t('lock.title')}
      </Text>
      <Text variant="body" tone="secondary" align="center">
        {t('lock.body')}
      </Text>
      <PremiumButton label={t('lock.unlock')} icon={Fingerprint} onPress={() => void unlock()} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md },
  icon: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  button: { marginTop: space.lg, alignSelf: 'stretch' },
});
