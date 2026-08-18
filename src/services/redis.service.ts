import { createClient, type RedisClientType } from 'redis';

/**
 * Optional cache. Every method degrades to a miss when Redis is unreachable,
 * so the bot keeps working on SQLite alone if the cache dies.
 */
export class CacheService {
  private client: RedisClientType | null = null;
  private ready = false;

  async connect(url: string | undefined): Promise<void> {
    if (!url) {
      console.log('[cache] REDIS_URL not set, running without cache');
      return;
    }
    try {
      this.client = createClient({
        url,
        socket: { connectTimeout: 10_000, reconnectStrategy: (n) => Math.min(n * 500, 10_000) },
      });
      // Without a listener an emitted error would crash the process.
      this.client.on('error', (err) => {
        if (this.ready) console.warn('[cache] error:', (err as Error).message);
        this.ready = false;
      });
      this.client.on('ready', () => {
        this.ready = true;
      });
      await this.client.connect();
      this.ready = true;
      console.log('[cache] Connected to Redis');
    } catch (error) {
      console.warn('[cache] Connect failed, continuing without cache:', String(error));
      this.client = null;
    }
  }

  private usable(): boolean {
    return Boolean(this.client && this.ready);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.usable()) return null;
    try {
      const raw = await this.client!.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.usable()) return;
    try {
      await this.client!.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch {
      // A cache write failure must never break the caller.
    }
  }

  async del(key: string): Promise<void> {
    if (!this.usable()) return;
    try {
      await this.client!.del(key);
    } catch {
      /* ignore */
    }
  }

  /** Read-through helper: return the cached value or compute, cache and return it. */
  async remember<T>(key: string, ttlSeconds: number, compute: () => Promise<T> | T): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Cross-process lock so two servers cannot both pay for the same expensive
   * job (a question batch, for instance). Returns false when already held.
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.usable()) return true; // no cache: assume single process, let it run
    try {
      const res = await this.client!.set(key, '1', { NX: true, EX: ttlSeconds });
      return res === 'OK';
    } catch {
      return true;
    }
  }

  async releaseLock(key: string): Promise<void> {
    await this.del(key);
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        /* ignore */
      }
    }
  }
}
