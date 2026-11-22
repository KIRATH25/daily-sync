/**
 * Browser helpers for the web build: sharing / saving generated files.
 * Only called when Platform.OS === 'web'.
 */

export function dataUriToBlob(dataUri: string): Blob {
  const [header, base64 = ''] = dataUri.split(',');
  const mime = /data:([^;]+)/.exec(header ?? '')?.[1] ?? 'application/octet-stream';
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index);
  return new Blob([buffer], { type: mime });
}

/** Triggers a download (desktop) or opens the file preview (iOS Safari, where the user can Save/Share). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Opens the native share sheet with a file when supported; otherwise downloads it. */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared';
      // e.g. NotAllowedError when the tap's user activation expired — fall back.
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}
