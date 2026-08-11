/**
 * Anime action GIFs from nekos.best (free, no API key, SFW).
 * Fail-open: any error returns null and callers send text without an image.
 */
const BASE_URL = 'https://nekos.best/api/v2';

// nekos.best rejects requests without a User-Agent (403).
const USER_AGENT = 'casino-bot/1.0.0 (https://github.com/dadadadas111/casino-bot)';

export async function fetchActionGif(category: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/${category}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.warn(`[gif] ${category}: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { results?: Array<{ url?: string }> };
    return data.results?.[0]?.url ?? null;
  } catch (error) {
    console.warn(`[gif] ${category}: ${String(error)}`);
    return null;
  }
}
