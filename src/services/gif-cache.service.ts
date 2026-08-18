import type { CacheService } from './redis.service.js';
import { fetchActionGif, fetchActionGifs } from './gif.service.js';

const TTL_SECONDS = 6 * 60 * 60;
const BATCH = 15;

/**
 * Serves action GIFs from a cached pool. One upstream request covers roughly
 * fifteen interactions, which keeps nekos.best happy and drops a network
 * round trip from the common path.
 */
export class GifCache {
  constructor(private cache: CacheService) {}

  async get(category: string): Promise<string | null> {
    const key = `casino:gif:${category}`;
    const pool = await this.cache.get<string[]>(key);
    if (pool && pool.length > 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    const fresh = await fetchActionGifs(category, BATCH);
    if (fresh.length > 0) {
      await this.cache.set(key, fresh, TTL_SECONDS);
      return fresh[Math.floor(Math.random() * fresh.length)];
    }
    // Cache empty and the batch call failed: fall back to a single fetch.
    return fetchActionGif(category);
  }
}
