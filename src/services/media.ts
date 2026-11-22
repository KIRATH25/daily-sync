/**
 * Picking a photo (avatar, countdown background).
 *
 * Native: uses the system photo picker (no storage permission on Android 13+)
 * and copies the image into the app sandbox so it survives cache clearing.
 * Web: there is no file system, so the image is stored as a compact data URI.
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

import { createId } from '@/lib/id';

const IS_WEB = Platform.OS === 'web';

export async function pickImage(aspect: [number, number]): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !IS_WEB,
    aspect,
    quality: IS_WEB ? 0.6 : 0.82,
    base64: IS_WEB,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  if (IS_WEB) {
    // Blob URLs die on reload; a data URI persists with the rest of the data.
    return asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : null;
  }
  const source = new File(asset.uri);
  const folder = new Directory(Paths.document, 'images');
  if (!folder.exists) folder.create({ intermediates: true });
  const extension = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase().slice(0, 4);
  const destination = new File(folder, `${createId('img')}.${extension}`);
  await source.copy(destination);
  return destination.uri;
}

/** Removes a previously stored image when it is replaced or its owner deleted. */
export function deleteStoredImage(uri: string | null | undefined): void {
  if (IS_WEB || !uri || !uri.includes('/images/')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Missing files are fine.
  }
}
