/**
 * In-memory TTL Cache with in-flight request deduplication.
 * Greatly reduces database network egress on high-frequency read endpoints
 * (such as mobile standings, public combis, schedule, and CMS sponsors).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private inFlight = new Map<string, Promise<any>>();

  /**
   * Get an item from memory cache, or compute and cache it if absent/expired.
   * Concurrent requests for the same key await the same single promise (thundering herd protection).
   *
   * @param key Unique cache key
   * @param ttlSeconds Time-to-live in seconds (e.g. 5, 10, 60)
   * @param fetcher Async function to fetch fresh data if cache missed
   */
  async getOrSet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (entry && entry.expiresAt > now) {
      return entry.value;
    }

    // If already fetching this key, await the in-flight promise
    if (this.inFlight.has(key)) {
      try {
        return await this.inFlight.get(key)!;
      } catch {
        // If in-flight failed, fall through to fetch fresh
      }
    }

    const fetchPromise = (async () => {
      try {
        const freshValue = await fetcher();
        this.cache.set(key, {
          value: freshValue,
          expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
        });
        return freshValue;
      } catch (err) {
        // If an existing stale cache entry exists, return it to keep site online
        if (entry) {
          return entry.value;
        }
        throw err;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Invalidate a single key or keys matching a prefix.
   */
  invalidate(keyOrPrefix?: string) {
    if (!keyOrPrefix) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const memoryCache = new MemoryCache();
