/**
 * Cache Utility Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Cache, createCache } from './cache';

describe('Cache', () => {
  describe('createCache', () => {
    it('should create a cache with specified options', () => {
      const cache = createCache<string>({
        maxSize: 10,
        ttl: 1000,
      });

      expect(cache).toBeDefined();
    });
  });

  describe('Cache class', () => {
    let cache: Cache<string>;

    beforeEach(() => {
      cache = new Cache<string>({
        maxSize: 10,
        ttl: 1000,
      });
    });

    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete keys', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should respect max size', () => {
      const smallCache = new Cache<string>({
        maxSize: 2,
        ttl: 1000,
      });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3'); // Should evict key1

      expect(smallCache.get('key1')).toBeUndefined();
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key3')).toBe('value3');
    });

    it('should get stats', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
    });

    it('should expire entries after TTL (regular get)', async () => {
      const shortCache = new Cache<string>({
        maxSize: 10,
        ttl: 100, // 100ms TTL
      });

      shortCache.set('key1', 'value1');
      expect(shortCache.get('key1')).toBe('value1');

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(shortCache.get('key1')).toBeUndefined();
    });

    describe('Stale data support', () => {
      it('should return stale data when allowed', async () => {
        const cache = new Cache<string>({
          maxSize: 10,
          ttl: 100, // 100ms fresh TTL
          staleTTL: 300, // 300ms stale TTL
        });

        cache.set('key1', 'value1');

        // Wait for fresh TTL to expire
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Regular get should return undefined
        expect(cache.get('key1')).toBeUndefined();

        // getWithStale should return stale data
        const result = cache.getWithStale('key1', true);
        expect(result).toBeDefined();
        expect(result!.value).toBe('value1');
        expect(result!.isStale).toBe(true);
        expect(result!.age).toBeGreaterThan(100);
      });

      it('should not return stale data when not allowed', async () => {
        const cache = new Cache<string>({
          maxSize: 10,
          ttl: 100,
          staleTTL: 300,
        });

        cache.set('key1', 'value1');

        // Wait for fresh TTL to expire
        await new Promise((resolve) => setTimeout(resolve, 150));

        // getWithStale with allowStale=false should return undefined
        const result = cache.getWithStale('key1', false);
        expect(result).toBeUndefined();
      });

      it('should return fresh data with isStale=false', () => {
        const cache = new Cache<string>({
          maxSize: 10,
          ttl: 1000,
        });

        cache.set('key1', 'value1');

        const result = cache.getWithStale('key1', true);
        expect(result).toBeDefined();
        expect(result!.value).toBe('value1');
        expect(result!.isStale).toBe(false);
        expect(result!.age).toBeLessThan(100);
      });

      it('should expire entries after stale TTL', async () => {
        const cache = new Cache<string>({
          maxSize: 10,
          ttl: 100,
          staleTTL: 200, // 200ms stale TTL
        });

        cache.set('key1', 'value1');

        // Wait beyond stale TTL
        await new Promise((resolve) => setTimeout(resolve, 250));

        // Even with allowStale, should return undefined
        const result = cache.getWithStale('key1', true);
        expect(result).toBeUndefined();
      });

      it('should check hasWithStale correctly', async () => {
        const cache = new Cache<string>({
          maxSize: 10,
          ttl: 100,
          staleTTL: 300,
        });

        cache.set('key1', 'value1');

        // Fresh data
        expect(cache.has('key1')).toBe(true);
        expect(cache.hasWithStale('key1')).toBe(true);

        // Wait for fresh TTL to expire
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Stale data
        expect(cache.has('key1')).toBe(false);
        expect(cache.hasWithStale('key1')).toBe(true);

        // Wait for stale TTL to expire
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Expired
        expect(cache.has('key1')).toBe(false);
        expect(cache.hasWithStale('key1')).toBe(false);
      });

      it('should delete expired entries on getWithStale', async () => {
        const cache = new Cache<string>({
          maxSize: 10,
          ttl: 100,
          staleTTL: 200,
        });

        cache.set('key1', 'value1');

        // Wait beyond stale TTL
        await new Promise((resolve) => setTimeout(resolve, 250));

        // This should delete the entry
        const result = cache.getWithStale('key1', true);
        expect(result).toBeUndefined();

        // Verify entry was deleted (check internal state via has)
        expect(cache.hasWithStale('key1')).toBe(false);
      });
    });
  });
});

