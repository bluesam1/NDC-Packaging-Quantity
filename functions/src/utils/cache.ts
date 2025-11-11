/**
 * LRU Cache Wrapper with Stale Data Support
 * 
 * This module provides a reusable LRU cache wrapper for in-memory caching.
 * Used by RxNorm client, FDA client, and other services that need caching.
 * Supports stale data retrieval for degraded mode (up to 48 hours old).
 */

import { LRUCache } from 'lru-cache';
import { logDebug } from './logger';

export interface CacheOptions {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  staleTTL?: number; // Maximum age for stale data (default: 48 hours)
}

/**
 * Cache entry with timestamp metadata
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number; // Cached at (ms since epoch)
}

/**
 * Result from cache get with stale data info
 */
export interface CacheGetResult<T> {
  value: T;
  isStale: boolean;
  age: number; // Age in milliseconds
}

/**
 * Default stale TTL (48 hours in milliseconds)
 */
const DEFAULT_STALE_TTL = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Creates a new LRU cache instance with the specified options
 * 
 * @param options - Cache configuration options
 * @returns LRU cache instance for cache entries
 */
export function createCache<T extends {}>(options: CacheOptions): LRUCache<string, CacheEntry<T>> {
  // Note: We disable TTL on LRU cache and handle it manually to support stale data
  return new LRUCache<string, CacheEntry<T>>({
    max: options.maxSize,
    // Don't set TTL - we handle expiration manually to support stale data
  });
}

/**
 * Cache wrapper class for type-safe caching with stale data support
 */
export class Cache<T extends {}> {
  private cache: LRUCache<string, CacheEntry<T>>;
  private ttl: number;
  private staleTTL: number;

  constructor(options: CacheOptions) {
    this.cache = createCache<T>(options);
    this.ttl = options.ttl;
    this.staleTTL = options.staleTTL || DEFAULT_STALE_TTL;
  }

  /**
   * Get a value from the cache (fresh data only)
   * 
   * @param key - Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    const age = Date.now() - entry.timestamp;
    
    // Check if entry is fresh
    if (age <= this.ttl) {
      return entry.value;
    }

    // Entry is stale but not yet expired - don't return it in normal get
    return undefined;
  }

  /**
   * Get a value from the cache, allowing stale data
   * 
   * @param key - Cache key
   * @param allowStale - Whether to allow stale data (default: false)
   * @returns Cache result with stale info, or undefined if not found
   */
  getWithStale(key: string, allowStale: boolean = false): CacheGetResult<T> | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    const age = Date.now() - entry.timestamp;
    
    // Check if entry is completely expired (beyond stale TTL)
    if (age > this.staleTTL) {
      // Remove expired entry
      this.cache.delete(key);
      return undefined;
    }

    // Check if entry is fresh
    const isStale = age > this.ttl;
    
    // Return stale data only if allowed
    if (isStale && !allowStale) {
      return undefined;
    }

    logDebug('Cache entry retrieved', {
      key: '[REDACTED]', // Don't log cache keys (may contain PHI)
      age,
      isStale,
      allowStale,
    });

    return {
      value: entry.value,
      isStale,
      age,
    };
  }

  /**
   * Set a value in the cache
   * 
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: string, value: T): void {
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
    };
    this.cache.set(key, entry);
  }

  /**
   * Check if a key exists in the cache (fresh data only)
   * 
   * @param key - Cache key
   * @returns True if key exists and is fresh, false otherwise
   */
  has(key: string): boolean {
    const result = this.getWithStale(key, false);
    return result !== undefined && !result.isStale;
  }

  /**
   * Check if a key exists in the cache (including stale data)
   * 
   * @param key - Cache key
   * @returns True if key exists (fresh or stale), false otherwise
   */
  hasWithStale(key: string): boolean {
    const result = this.getWithStale(key, true);
    return result !== undefined;
  }

  /**
   * Delete a key from the cache
   * 
   * @param key - Cache key
   * @returns True if key was deleted, false if it didn't exist
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics object
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
    };
  }
}

