import type Sharp from 'sharp';

// sharp is loaded lazily so a missing native binary in some environment just
// disables the card (callers fall back to a plain embed) instead of crashing
// the whole bot at import time.
let sharpFn: typeof Sharp | null | undefined;
async function loadSharp(): Promise<typeof Sharp | null> {
  if (sharpFn !== undefined) return sharpFn;
  try {
    sharpFn = (await import('sharp')).default;
  } catch (error) {
    console.error('[wedding-card] sharp unavailable, wedding cards disabled:', error);
    sharpFn = null;
  }
  return sharpFn;
}

// A simple wedding card: [avatar] heart [avatar]. Avatars are cropped to a
// centred square (fit: cover), so a rectangular figurine photo still fits.
const AV = 220;
const GAP = 200;
const PAD = 24;
const HS = 150;
const W = PAD * 2 + AV * 2 + GAP;
const H = AV + PAD * 2;
const FELT = { r: 11, g: 59, b: 42, alpha: 1 };

async function fetchSquare(sharp: typeof Sharp, url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await sharp(buf).resize(AV, AV, { fit: 'cover' }).png().toBuffer();
  } catch {
    return null;
  }
}

function heartSvg(broken: boolean): Buffer {
  const heart =
    '<path d="M23.6,0c-3.4,0-6.3,2.7-7.6,5.6C14.7,2.7,11.8,0,8.4,0C3.8,0,0,3.8,0,8.4c0,9.4,9.5,11.9,16,21.2c6.1-9.3,16-12.1,16-21.2C32,3.8,28.2,0,23.6,0z" fill="#e0474c"/>';
  // A jagged crack in the felt colour makes the heart read as broken.
  const crack = broken
    ? '<path d="M16 3 L13 9 L18 13 L13 18 L18 23 L15.5 29.6" fill="none" stroke="#0b3b2a" stroke-width="2.4" stroke-linejoin="round"/>'
    : '';
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${HS}" height="${HS}" viewBox="0 0 32 29.6">${heart}${crack}</svg>`,
  );
}

/**
 * Compose the couple card. Returns a PNG buffer, or null when either avatar
 * cannot be loaded (the caller then falls back to a plain embed).
 */
export async function renderWeddingCard(
  url1: string | null,
  url2: string | null,
  broken = false,
): Promise<Buffer | null> {
  if (!url1 || !url2) return null;
  const sharp = await loadSharp();
  if (!sharp) return null;
  const [a, b] = await Promise.all([fetchSquare(sharp, url1), fetchSquare(sharp, url2)]);
  if (!a || !b) return null;
  return sharp({ create: { width: W, height: H, channels: 4, background: FELT } })
    .composite([
      { input: a, left: PAD, top: PAD },
      { input: b, left: PAD + AV + GAP, top: PAD },
      { input: heartSvg(broken), left: PAD + AV + Math.round((GAP - HS) / 2), top: PAD + Math.round((AV - HS) / 2) },
    ])
    .png()
    .toBuffer();
}
