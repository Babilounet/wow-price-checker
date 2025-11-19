import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

class CacheService {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.client.on('error', (error) => {
      logger.error('Redis connection error', { error });
    });
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const effectiveTtl = ttl || config.REDIS_TTL;

      await this.client.setex(key, effectiveTtl, serialized);
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error });
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      return false;
    }
  }

  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      await this.client.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error('Cache delete pattern error', { pattern, error });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error });
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async getTTL(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Cache getTTL error', { key, error });
      return -1;
    }
  }

  /**
   * Flush all cache
   */
  async flush(): Promise<boolean> {
    try {
      await this.client.flushdb();
      logger.warn('Cache flushed');
      return true;
    } catch (error) {
      logger.error('Cache flush error', { error });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbsize();

      return {
        dbSize,
        info,
      };
    } catch (error) {
      logger.error('Cache stats error', { error });
      return null;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.client.quit();
  }
}

export const cacheService = new CacheService();

// Cache key generators
export const CacheKeys = {
  auctions: (realmId: number) => `auctions:${realmId}`,
  item: (itemId: number) => `item:${itemId}`,
  itemMedia: (itemId: number) => `item:${itemId}:media`,
  priceStats: (realmId: number, itemId: number) => `price:${realmId}:${itemId}`,
  connectedRealm: (realmId: number) => `realm:${realmId}`,
};
