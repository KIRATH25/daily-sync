/**
 * Milestone card export. Captures only the rendered card view (never the
 * whole screen) at an exact pixel size, then shares or saves it.
 * On web the capture is a PNG data URI shared via the Web Share API.
 */
import type { ComponentRef, RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

import { dataUriToBlob, downloadBlob, shareOrDownload } from './webFiles';

const IS_WEB = Platform.OS === 'web';

export type CaptureViewRef = RefObject<ComponentRef<typeof View> | null>;

export type ShareFormat = 'portrait' | 'story' | 'square';

export const SHARE_SIZES: Record<ShareFormat, { width: number; height: number; ratio: string }> = {
  portrait: { width: 1080, height: 1350, ratio: '4:5' },
  story: { width: 1080, height: 1920, ratio: '9:16' },
  square: { width: 1080, height: 1080, ratio: '1:1' },
};

export async function captureCard(ref: CaptureViewRef, format: ShareFormat): Promise<string> {
  if (!ref.current) throw new Error('card-not-mounted');
  const { width, height } = SHARE_SIZES[format];
  return captureRef(ref, { format: 'png', quality: 1, width, height, result: IS_WEB ? 'data-uri' : 'tmpfile' });
}

export async function shareImage(uri: string, title: string): Promise<void> {
  if (IS_WEB) {
    await shareOrDownload(dataUriToBlob(uri), 'daily-sync-card.png', title);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing-unavailable');
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
}

export type SaveResult = 'saved' | 'denied';

/** Requests write-only photo access just-in-time, only when saving. */
export async function saveImageToLibrary(uri: string): Promise<SaveResult> {
  if (IS_WEB) {
    // iOS opens the image; "Save to Photos" is in the share menu there.
    downloadBlob(dataUriToBlob(uri), 'daily-sync-card.png');
    return 'saved';
  }
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) return 'denied';
  await MediaLibrary.Asset.create(uri);
  return 'saved';
}
