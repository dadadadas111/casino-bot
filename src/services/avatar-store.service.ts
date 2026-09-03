import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

/**
 * Figurine avatars, stored on disk and served by the web server. Kept behind
 * this small surface (isSupportedImage / storeAvatarFromUrl / avatarFilePath /
 * deleteAvatar) so a future R2 backend can drop in without touching callers.
 */

const DIR = env.AVATAR_DIR;
export const AVATAR_MAX_BYTES = 3 * 1024 * 1024; // 3 MB

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/** True when Discord reports a content type we accept for an avatar. */
export function isSupportedImage(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  return (contentType.split(';')[0].trim() || '') in EXT_BY_TYPE;
}

/**
 * Download the attachment at `url` and store it as this user's avatar. Returns
 * a public URL (with a cache-busting query so Discord refetches after a change)
 * or throws on an unsupported type, a failed download, or an oversize file.
 */
export async function storeAvatarFromUrl(
  userId: string,
  url: string,
  contentType: string,
): Promise<string> {
  const ext = EXT_BY_TYPE[contentType.split(';')[0].trim()];
  if (!ext) throw new Error('unsupported image type');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > AVATAR_MAX_BYTES) throw new Error('image too large');

  fs.mkdirSync(DIR, { recursive: true });
  // Drop any previous avatar of a different extension so only one file remains.
  for (const e of new Set(Object.values(EXT_BY_TYPE))) {
    if (e === ext) continue;
    const stale = path.join(DIR, `${userId}.${e}`);
    if (fs.existsSync(stale)) fs.rmSync(stale);
  }
  fs.writeFileSync(path.join(DIR, `${userId}.${ext}`), buf);

  const base = env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  return `${base}/avatar/${userId}.${ext}?v=${Date.now()}`;
}

/** Resolve a request path segment to a file on disk, or null if it is unsafe. */
export function avatarFilePath(fileName: string): string | null {
  if (!/^\d{1,32}\.(png|jpg|gif|webp)$/.test(fileName)) return null;
  return path.join(DIR, fileName);
}

export function contentTypeFor(fileName: string): string {
  const ext = fileName.split('.').pop();
  return ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
}

export function deleteAvatar(userId: string): void {
  for (const e of new Set(Object.values(EXT_BY_TYPE))) {
    const p = path.join(DIR, `${userId}.${e}`);
    try {
      if (fs.existsSync(p)) fs.rmSync(p);
    } catch {
      /* best effort */
    }
  }
}
