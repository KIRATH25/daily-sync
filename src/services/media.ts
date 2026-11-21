/**
 * Picking a photo (avatar, countdown background). Uses the system photo
 * picker, which on Android 13+ needs no storage permission, then copies the
 * image into the app sandbox so it survives the picker's cache being cleared.
 */
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

import { createId } from '@/lib/id';

export async function pickImage(aspect: [number, number]): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.82,
  });
  if (result.canceled || !result.assets[0]) return null;
  const source = new File(result.assets[0].uri);
  const folder = new Directory(Paths.document, 'images');
  if (!folder.exists) folder.create({ intermediates: true });
  const extension = (result.assets[0].uri.split('.').pop() ?? 'jpg').toLowerCase().slice(0, 4);
  const destination = new File(folder, `${createId('img')}.${extension}`);
  await source.copy(destination);
  return destination.uri;
}

/** Removes a previously stored image when it is replaced or its owner deleted. */
export function deleteStoredImage(uri: string | null | undefined): void {
  if (!uri || !uri.includes('/images/')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Missing files are fine.
  }
}
