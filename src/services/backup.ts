/**
 * Backup export (JSON file via the share sheet) and restore (document
 * picker). The file contains all personal data, including journal entries,
 * so the UI warns users to store it somewhere private.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { exportBackup, MAX_BACKUP_BYTES, parseBackup, restoreBackup, RestoreFailure, type RestoreSummary } from '@/db/repositories/backupRepo';

import { syncNotifications } from './notifications';
import { shareOrDownload } from './webFiles';

export async function shareBackupFile(date: string): Promise<void> {
  const envelope = await exportBackup();
  if (Platform.OS === 'web') {
    const blob = new Blob([JSON.stringify(envelope)], { type: 'application/json' });
    await shareOrDownload(blob, `daily-sync-backup-${date}.json`, 'Daily Sync backup');
    return;
  }
  const file = new File(Paths.cache, `daily-sync-backup-${date}.json`);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(envelope));
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing-unavailable');
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Daily Sync backup', UTI: 'public.json' });
  } finally {
    // The backup holds private data; do not leave a copy in the cache.
    setTimeout(() => {
      try {
        if (file.exists) file.delete();
      } catch {
        // best effort
      }
    }, 60_000);
  }
}

export type PickResult = { status: 'cancelled' } | { status: 'restored'; summary: RestoreSummary };

export async function pickAndRestoreBackup(): Promise<PickResult> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
  const asset = result.assets[0];
  if (asset.size != null && asset.size > MAX_BACKUP_BYTES) throw new RestoreFailure('restore.invalidFile');
  if (Platform.OS === 'web') {
    if (!asset.file) throw new RestoreFailure('restore.invalidFile');
    const summary = await restoreBackup(parseBackup(await asset.file.text()));
    return { status: 'restored', summary };
  }
  const file = new File(asset.uri);
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new RestoreFailure('restore.invalidFile');
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      // cached copy only
    }
  }
  const summary = await restoreBackup(parseBackup(text));
  await syncNotifications();
  return { status: 'restored', summary };
}
