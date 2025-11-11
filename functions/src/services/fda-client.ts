/**
 * FDA NDC Directory API Client
 * 
 * This module provides a client for interacting with the FDA NDC Directory API (openFDA).
 * Features: caching, rate limiting, retry logic, error handling, and PHI redaction.
 * FDA is the source of truth for NDC activity status and package metadata.
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { Cache } from '../utils/cache';
import { logInfo, logWarn, logError } from '../utils/logger';
import { DependencyError, RateLimitError } from '../utils/errors';
import type { NDCPackageData } from '../types/index';

/**
 * FDA API response types
 */
interface FDAResponse {
  results?: Array<{
    product_ndc?: string;
    package_ndc?: string;
    package_description?: string;
    active?: string;
    dosage_form?: string;
    brand_name?: string;
    package_size?: string;
    packaging?: Array<{
      package_ndc?: string;
      description?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  }>;
  meta?: {
    results?: {
      total?: number;
    };
  };
}

/**
 * Rate limiter for FDA API
 * Tracks request timestamps per function instance
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if a request can be made
   * 
   * @returns True if request can be made, false if rate limit exceeded
   */
  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove requests outside the time window
    this.requests = this.requests.filter((timestamp) => now - timestamp < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    this.requests.push(now);
    return true;
  }

  /**
   * Get the time until the next request can be made (in milliseconds)
   * 
   * @returns Milliseconds until next request can be made
   */
  getRetryAfterMs(): number {
    if (this.requests.length === 0) {
      return 0;
    }
    
    const now = Date.now();
    const oldestRequest = Math.min(...this.requests);
    const timeUntilWindowReset = this.windowMs - (now - oldestRequest);
    
    return Math.max(0, timeUntilWindowReset);
  }
}

/**
 * FDA API Client
 */
export class FDAClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly cache: Cache<string>;
  private readonly rateLimiter: RateLimiter;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(options?: {
    baseUrl?: string;
    timeout?: number;
    maxRetries?: number;
    cacheTTL?: number;
    rateLimit?: number;
  }) {
    this.baseUrl = options?.baseUrl || 'https://api.fda.gov/drug/ndc.json';
    this.timeout = options?.timeout || 5000;
    this.maxRetries = options?.maxRetries || 1;

    // Create cache with 24 hour TTL (86400000 ms)
    const cacheTTL = options?.cacheTTL || 86400000;
    this.cache = new Cache<string>({
      maxSize: 1000,
      ttl: cacheTTL,
    });

    // Create rate limiter (3 req/sec = 3 requests per 1000ms window)
    const rateLimit = options?.rateLimit || 3;
    this.rateLimiter = new RateLimiter(rateLimit, 1000);

    // Create Axios instance
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Make a request with retry logic
   */
  private async makeRequestWithRetry<T>(
    requestFn: () => Promise<T>,
    context: { correlationId?: string; operation: string }
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const axiosError = error as AxiosError;
        
        // Check if error is retryable (5xx or timeout)
        const isRetryable = 
          (axiosError.response?.status && axiosError.response.status >= 500) ||
          axiosError.code === 'ECONNABORTED' ||
          axiosError.code === 'ETIMEDOUT';
        
        if (!isRetryable || attempt >= this.maxRetries) {
          break;
        }
        
        // Exponential backoff: 1000ms, 2000ms max
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 2000);
        logWarn('Retrying FDA API request', {
          ...context,
          attempt: attempt + 1,
          backoffMs,
        });
        
        await this.sleep(backoffMs);
      }
    }
    
    // All retries failed
    if (lastError) {
      logError('FDA API request failed after retries', {
        ...context,
        error: lastError.message,
      });
      throw lastError;
    }
    
    throw new Error('FDA API request failed');
  }

  /**
   * Generate cache key for FDA requests
   */
  private getCacheKey(operation: string, param: string): string {
    return `fda:${operation}:${param.toLowerCase().trim()}`;
  }

  /**
   * Normalize NDC format (remove hyphens, ensure 11 digits)
   */
  private normalizeNDC(ndc: string): string {
    // Remove hyphens and spaces
    const normalized = ndc.replace(/[-\s]/g, '');
    // Ensure 11 digits
    if (normalized.length === 11) {
      return normalized;
    }
    // If 10 digits, pad with leading zero
    if (normalized.length === 10) {
      return `0${normalized}`;
    }
    return normalized;
  }

  /**
   * Parse FDA API response to NDCPackageData
   */
  private parseFDAResponse(result: NonNullable<FDAResponse['results']>[0]): NDCPackageData | null {
    if (!result) {
      return null;
    }

    // Get NDC from product_ndc or package_ndc
    const ndc = result.product_ndc || result.package_ndc;
    if (!ndc) {
      return null;
    }

    // Parse package size from multiple possible sources
    let pkgSize = 0;
    
    // 1. Try package_size field
    if (result.package_size) {
      const sizeMatch = result.package_size.match(/(\d+)/);
      if (sizeMatch) {
        pkgSize = parseInt(sizeMatch[1], 10);
      }
    }
    
    // 2. Try package_description field
    if (pkgSize === 0 && result.package_description) {
      const descMatch = result.package_description.match(/(\d+)\s*(TAB|CAP|TABLET|CAPSULE|ML|MG)/i);
      if (descMatch) {
        pkgSize = parseInt(descMatch[1], 10);
      }
    }
    
    // 3. Try packaging array (FDA API often returns package info here)
    if (pkgSize === 0 && Array.isArray(result.packaging) && result.packaging.length > 0) {
      // Use the first packaging entry
      const firstPackage = result.packaging[0];
      if (firstPackage.description) {
        // Parse from description like "100 CAPSULE in 1 BOTTLE"
        const descMatch = firstPackage.description.match(/(\d+)\s*(TAB|CAP|TABLET|CAPSULE|ML|MG|BLISTER|BOTTLE)/i);
        if (descMatch) {
          pkgSize = parseInt(descMatch[1], 10);
        }
      }
    }

    // Parse active status (FDA uses "TRUE" or "FALSE" strings)
    // If active field is missing, default to true (assume active unless explicitly marked inactive)
    // This handles cases where the real FDA API might not include the field
    const active = result.active === undefined || result.active === null || result.active === ''
      ? true // Default to active if field is missing
      : (result.active === 'TRUE' || result.active === 'true');

    return {
      ndc: this.normalizeNDC(ndc),
      pkg_size: pkgSize,
      active,
      dosage_form: result.dosage_form,
      brand_name: result.brand_name,
    };
  }

  /**
   * Lookup NDC by NDC code
   * 
   * @param ndc - NDC code (11 digits, with or without hyphens)
   * @param correlationId - Optional correlation ID for logging
   * @returns NDCPackageData or null if not found
   */
  async lookupByNDC(ndc: string, correlationId?: string): Promise<NDCPackageData | null> {
    const normalizedNDC = this.normalizeNDC(ndc);
    const context = { correlationId, operation: 'lookupByNDC', ndc: normalizedNDC };
    
    // Check cache
    const cacheKey = this.getCacheKey('lookupByNDC', normalizedNDC);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      logInfo('FDA cache hit', { ...context, cacheKey });
      // Parse cached value (stored as JSON string)
      try {
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
    
    logInfo('FDA cache miss', { ...context, cacheKey });
    
    // Check rate limit
    if (!this.rateLimiter.canMakeRequest()) {
      const retryAfterMs = this.rateLimiter.getRetryAfterMs();
      logWarn('FDA rate limit exceeded', { ...context, retryAfterMs });
      throw new RateLimitError(
        'FDA API rate limit exceeded',
        retryAfterMs
      );
    }
    
    try {
      const result = await this.makeRequestWithRetry(
        async () => {
          const response = await this.axiosInstance.get<FDAResponse>('/', {
            params: {
              search: `product_ndc:${normalizedNDC}`,
              limit: 1,
            },
          });
          
          // Parse response
          const results = response.data?.results || [];
          if (results.length === 0) {
            return null;
          }
          
          return this.parseFDAResponse(results[0]);
        },
        context
      );
      
      // Cache result (store as JSON string)
      this.cache.set(cacheKey, result ? JSON.stringify(result) : '');
      
      logInfo('FDA API call successful', { ...context, found: result !== null });
      return result;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      // Handle 4xx errors (no retry)
      if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
        logWarn('FDA API 4xx error', {
          ...context,
          status: axiosError.response.status,
        });
        // Cache null for 4xx errors to avoid repeated calls
        this.cache.set(cacheKey, '');
        return null;
      }
      
      // Handle other errors
      logError('FDA API error', {
        ...context,
        error: axiosError.message,
        status: axiosError.response?.status,
      });
      
      throw new DependencyError(
        'Failed to query FDA API',
        `FDA API error: ${axiosError.message}`,
        2000 // Retry after 2 seconds
      );
    }
  }

  /**
   * Search by brand name
   * 
   * @param name - Brand name
   * @param correlationId - Optional correlation ID for logging
   * @returns Array of NDCPackageData
   */
  async searchByBrandName(name: string, correlationId?: string): Promise<NDCPackageData[]> {
    const context = { correlationId, operation: 'searchByBrandName', brand_name: name };
    
    // Check cache
    const cacheKey = this.getCacheKey('searchByBrandName', name);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      logInfo('FDA cache hit', { ...context, cacheKey });
      // Parse cached value (stored as JSON string)
      try {
        return cached ? JSON.parse(cached) : [];
      } catch {
        return [];
      }
    }
    
    logInfo('FDA cache miss', { ...context, cacheKey });
    
    // Check rate limit
    if (!this.rateLimiter.canMakeRequest()) {
      const retryAfterMs = this.rateLimiter.getRetryAfterMs();
      logWarn('FDA rate limit exceeded', { ...context, retryAfterMs });
      throw new RateLimitError(
        'FDA API rate limit exceeded',
        retryAfterMs
      );
    }
    
    try {
      const result = await this.makeRequestWithRetry(
        async () => {
          const response = await this.axiosInstance.get<FDAResponse>('/', {
            params: {
              search: `brand_name:${name}`,
              limit: 100, // FDA API allows up to 100 results
            },
          });
          
          // Parse response
          const results = response.data?.results || [];
          const packages: NDCPackageData[] = [];
          
          for (const item of results) {
            const parsed = this.parseFDAResponse(item);
            if (parsed) {
              packages.push(parsed);
            }
          }
          
          return packages;
        },
        context
      );
      
      // Cache result (store as JSON string)
      this.cache.set(cacheKey, JSON.stringify(result));
      
      logInfo('FDA API call successful', { ...context, count: result.length });
      return result;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      // Handle 4xx errors (no retry)
      if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
        logWarn('FDA API 4xx error', {
          ...context,
          status: axiosError.response.status,
        });
        // Cache empty array for 4xx errors
        this.cache.set(cacheKey, '[]');
        return [];
      }
      
      // Handle other errors
      logError('FDA API error', {
        ...context,
        error: axiosError.message,
        status: axiosError.response?.status,
      });
      
      throw new DependencyError(
        'Failed to query FDA API',
        `FDA API error: ${axiosError.message}`,
        2000 // Retry after 2 seconds
      );
    }
  }
}

/**
 * Create a default FDA client instance
 */
export function createFDAClient(): FDAClient {
  return new FDAClient({
    baseUrl: process.env.FDA_API_URL || 'https://api.fda.gov/drug/ndc.json',
    timeout: 5000,
    maxRetries: 1,
    cacheTTL: 86400000, // 24 hours
    rateLimit: 3, // 3 req/sec
  });
}

