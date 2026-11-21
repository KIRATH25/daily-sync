/**
 * Device-authentication gates for the app and the journal.
 *
 * The lock flags live in SecureStore (hardware-backed keystore) rather than
 * in SQLite, so restoring a backup or editing the database file cannot turn
 * the lock off. Note: this protects access through the app UI; the SQLite
 * file itself is protected by Android's app sandbox, not by encryption.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const APP_LOCK_KEY = 'ds.appLock';
const JOURNAL_LOCK_KEY = 'ds.journalLock';

export interface LockSettings {
  appLock: boolean;
  journalLock: boolean;
}

export async function readLockSettings(): Promise<LockSettings> {
  try {
    const [app, journal] = await Promise.all([SecureStore.getItemAsync(APP_LOCK_KEY), SecureStore.getItemAsync(JOURNAL_LOCK_KEY)]);
    return { appLock: app === '1', journalLock: journal === '1' };
  } catch {
    return { appLock: false, journalLock: false };
  }
}

export async function writeLockSetting(kind: keyof LockSettings, enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(kind === 'appLock' ? APP_LOCK_KEY : JOURNAL_LOCK_KEY, enabled ? '1' : '0');
}

export type AuthAvailability = 'available' | 'no-hardware' | 'not-enrolled';

export async function authAvailability(): Promise<AuthAvailability> {
  const [hardware, enrolled, level] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
  ]);
  // A device PIN/pattern also counts: users without biometrics can still lock.
  if (level !== LocalAuthentication.SecurityLevel.NONE) return 'available';
  if (!hardware) return 'no-hardware';
  return enrolled ? 'available' : 'not-enrolled';
}

export async function authenticate(prompt: string, cancelLabel: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      cancelLabel,
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
