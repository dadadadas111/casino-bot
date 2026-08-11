/**
 * Anime action GIFs from nekos.best (free, no API key, SFW).
 * Fail-open: any error returns null and callers send text without an image.
 */
const BASE_URL = 'https://nekos.best/api/v2';

export async function fetchActionGif(category: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/${category}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: Array<{ url?: string }> };
    return data.results?.[0]?.url ?? null;
  } catch {
    return null;
  }
}
