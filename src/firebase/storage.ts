import * as FileSystem from 'expo-file-system/legacy';
import { deleteObject, getDownloadURL, ref } from 'firebase/storage';
import { ensureSignedIn, storage } from './index';
import { firebaseConfig } from './config';

const TYPES: Record<string, string> = {
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  caf: 'audio/x-caf',
  mp3: 'audio/mpeg',
};

function contentTypeFor(uri: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Upload one file from the phone to the family's folder in Firebase Storage and return its web address.
 * The file is streamed straight from disk, so a long video never has to fit in memory.
 */
export async function uploadFile(p: {
  familyId: string;
  /** Path inside the family folder, e.g. "videos/abc.mov". */
  name: string;
  localUri: string;
  onProgress?: (fraction: number) => void;
}): Promise<string> {
  const user = await ensureSignedIn();
  const token = await user.getIdToken();
  const path = `families/${p.familyId}/${p.name}`;
  const url = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o?name=${encodeURIComponent(path)}`;

  const task = FileSystem.createUploadTask(
    url,
    p.localUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      headers: { Authorization: `Firebase ${token}`, 'Content-Type': contentTypeFor(p.localUri) },
    },
    (d) => {
      if (d.totalBytesExpectedToSend > 0) p.onProgress?.(d.totalBytesSent / d.totalBytesExpectedToSend);
    },
  );
  const res = await task.uploadAsync();
  if (!res || res.status < 200 || res.status >= 300) {
    throw new Error(`Upload failed (${res?.status ?? 'no response'}): ${res?.body?.slice(0, 200) ?? ''}`);
  }
  p.onProgress?.(1);
  return getDownloadURL(ref(storage, path));
}

/** Remove files from Storage by their web address. Best effort: a file that is already gone is fine. */
export async function deleteByUrl(urls: (string | undefined)[]): Promise<void> {
  await Promise.all(
    urls
      .filter((u): u is string => !!u && u.startsWith('http'))
      .map((u) => deleteObject(ref(storage, u)).catch((e) => console.warn('Could not delete a file', (e as { code?: string })?.code ?? e))),
  );
}
