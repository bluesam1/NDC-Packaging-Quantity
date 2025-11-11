/**
 * RxNorm API Client
 * 
 * This module provides a client for interacting with the RxNorm API.
 * Features: caching, rate limiting, retry logic, error handling, and PHI redaction.
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { Cache } from '../utils/cache';
import { logInfo, logWarn, logError } from '../utils/logger';
import { DependencyError, RateLimitError } from '../utils/errors';

/**
 * RxNorm API response types
 */
interface RxNormResponse {
  idGroup?: {
    rxnormId?: string[];
  };
}

interface RxNormNDCResponse {
  ndcGroup?: {
    ndcList?: {
      ndc?: string[];
    };
  };
}

interface RxNormApproximateResponse {
  approximateGroup?: {
    candidate?: Array<{
      rxcui?: string;
      score?: string;
    }>;
  };
}

/**
 * Rate limiter for RxNorm API
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
 * RxNorm API Client
 */
export class RxNormClient {
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
    this.baseUrl = options?.baseUrl || 'https://rxnav.nlm.nih.gov/REST/';
    this.timeout = options?.timeout || 5000;
    this.maxRetries = options?.maxRetries || 1;

    // Create cache with 1 hour TTL (3600000 ms)
    const cacheTTL = options?.cacheTTL || 3600000;
    this.cache = new Cache<string>({
      maxSize: 1000,
      ttl: cacheTTL,
    });

    // Create rate limiter (10 req/sec = 10 requests per 1000ms window)
    const rateLimit = options?.rateLimit || 10;
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
        logWarn('Retrying RxNorm API request', {
          ...context,
          attempt: attempt + 1,
          backoffMs,
        });
        
        await this.sleep(backoffMs);
      }
    }
    
    // All retries failed
    if (lastError) {
      logError('RxNorm API request failed after retries', {
        ...context,
        error: lastError.message,
      });
      throw lastError;
    }
    
    throw new Error('RxNorm API request failed');
  }

  /**
   * Generate cache key for RxNorm requests
   */
  private getCacheKey(operation: string, param: string): string {
    return `rxnorm:${operation}:${param.toLowerCase().trim()}`;
  }

  /**
   * Find RxCUI by drug name string
   * 
   * @param name - Drug name (brand or generic)
   * @param correlationId - Optional correlation ID for logging
   * @returns RxCUI string or null if not found
   */
  async findRxcuiByString(name: string, correlationId?: string): Promise<string | null> {
    const context = { correlationId, operation: 'findRxcuiByString', drug_name: name };
    
    // Check cache
    const cacheKey = this.getCacheKey('findRxcuiByString', name);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      logInfo('RxNorm cache hit', { ...context, cacheKey });
      return cached || null;
    }
    
    logInfo('RxNorm cache miss', { ...context, cacheKey });
    
    // Check rate limit
    if (!this.rateLimiter.canMakeRequest()) {
      const retryAfterMs = this.rateLimiter.getRetryAfterMs();
      logWarn('RxNorm rate limit exceeded', { ...context, retryAfterMs });
      throw new RateLimitError(
        'RxNorm API rate limit exceeded',
        retryAfterMs
      );
    }
    
    try {
      const result = await this.makeRequestWithRetry(
        async () => {
          const response = await this.axiosInstance.get<RxNormResponse>(
            'findRxcuiByString',
            {
              params: { name },
            }
          );
          
          // Parse response
          const rxcui = response.data?.idGroup?.rxnormId?.[0];
          return rxcui || null;
        },
        context
      );
      
      // Cache result (cache null values too to avoid repeated API calls)
      this.cache.set(cacheKey, result || '');
      
      logInfo('RxNorm API call successful', { ...context, rxcui: result || null });
      return result;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      // Handle 4xx errors (no retry)
      if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
        logWarn('RxNorm API 4xx error', {
          ...context,
          status: axiosError.response.status,
        });
        // Cache null for 4xx errors to avoid repeated calls
        this.cache.set(cacheKey, '');
        return null;
      }
      
      // Handle other errors
      logError('RxNorm API error', {
        ...context,
        error: axiosError.message,
        status: axiosError.response?.status,
      });
      
      throw new DependencyError(
        'Failed to query RxNorm API',
        `RxNorm API error: ${axiosError.message}`,
        2000 // Retry after 2 seconds
      );
    }
  }

  /**
   * Get NDCs by RxCUI
   * 
   * @param rxcui - RxCUI identifier
   * @param correlationId - Optional correlation ID for logging
   * @returns Array of NDC strings
   */
  async getNdcsByRxcui(rxcui: string, correlationId?: string): Promise<string[]> {
    const context = { correlationId, operation: 'getNdcsByRxcui', rxcui };
    
    // Check cache
    const cacheKey = this.getCacheKey('getNdcsByRxcui', rxcui);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      logInfo('RxNorm cache hit', { ...context, cacheKey });
      // Parse cached value (stored as comma-separated string)
      return cached ? cached.split(',') : [];
    }
    
    logInfo('RxNorm cache miss', { ...context, cacheKey });
    
    // Check rate limit
    if (!this.rateLimiter.canMakeRequest()) {
      const retryAfterMs = this.rateLimiter.getRetryAfterMs();
      logWarn('RxNorm rate limit exceeded', { ...context, retryAfterMs });
      throw new RateLimitError(
        'RxNorm API rate limit exceeded',
        retryAfterMs
      );
    }
    
    try {
      const result = await this.makeRequestWithRetry(
        async () => {
          const response = await this.axiosInstance.get<RxNormNDCResponse>(
            `rxcui/${rxcui}/ndcs`,
          );
          
          // Parse response
          const ndcs = response.data?.ndcGroup?.ndcList?.ndc || [];
          return ndcs;
        },
        context
      );
      
      // Cache result (store as comma-separated string)
      this.cache.set(cacheKey, result.join(','));
      
      logInfo('RxNorm API call successful', { ...context, ndcCount: result.length });
      return result;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      // Handle 4xx errors (no retry)
      if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
        logWarn('RxNorm API 4xx error', {
          ...context,
          status: axiosError.response.status,
        });
        // Cache empty array for 4xx errors
        this.cache.set(cacheKey, '');
        return [];
      }
      
      // Handle other errors
      logError('RxNorm API error', {
        ...context,
        error: axiosError.message,
        status: axiosError.response?.status,
      });
      
      throw new DependencyError(
        'Failed to query RxNorm API',
        `RxNorm API error: ${axiosError.message}`,
        2000 // Retry after 2 seconds
      );
    }
  }

  /**
   * Approximate term matching (fallback)
   * 
   * @param term - Drug name term
   * @param correlationId - Optional correlation ID for logging
   * @returns RxCUI string or null if not found
   */
  async approximateTerm(term: string, correlationId?: string): Promise<string | null> {
    const context = { correlationId, operation: 'approximateTerm', term };
    
    // Check cache
    const cacheKey = this.getCacheKey('approximateTerm', term);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      logInfo('RxNorm cache hit', { ...context, cacheKey });
      return cached || null;
    }
    
    logInfo('RxNorm cache miss', { ...context, cacheKey });
    
    // Check rate limit
    if (!this.rateLimiter.canMakeRequest()) {
      const retryAfterMs = this.rateLimiter.getRetryAfterMs();
      logWarn('RxNorm rate limit exceeded', { ...context, retryAfterMs });
      throw new RateLimitError(
        'RxNorm API rate limit exceeded',
        retryAfterMs
      );
    }
    
    try {
      const result = await this.makeRequestWithRetry(
        async () => {
          const response = await this.axiosInstance.get<RxNormApproximateResponse>(
            'approximateTerm',
            {
              params: { term },
            }
          );
          
          // Parse response - get the highest scoring candidate
          const candidates = response.data?.approximateGroup?.candidate || [];
          if (candidates.length === 0) {
            return null;
          }
          
          // Sort by score (descending) and return top candidate's RxCUI
          const sorted = candidates.sort((a, b) => {
            const scoreA = parseFloat(a.score || '0');
            const scoreB = parseFloat(b.score || '0');
            return scoreB - scoreA;
          });
          
          return sorted[0]?.rxcui || null;
        },
        context
      );
      
      // Cache result
      this.cache.set(cacheKey, result || '');
      
      logInfo('RxNorm API call successful', { ...context, rxcui: result || null });
      return result;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      // Handle 4xx errors (no retry)
      if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
        logWarn('RxNorm API 4xx error', {
          ...context,
          status: axiosError.response.status,
        });
        // Cache null for 4xx errors
        this.cache.set(cacheKey, '');
        return null;
      }
      
      // Handle other errors
      logError('RxNorm API error', {
        ...context,
        error: axiosError.message,
        status: axiosError.response?.status,
      });
      
      throw new DependencyError(
        'Failed to query RxNorm API',
        `RxNorm API error: ${axiosError.message}`,
        2000 // Retry after 2 seconds
      );
    }
  }
}

/**
 * Create a default RxNorm client instance
 * Uses real APIs by default unless USE_MOCK_APIS=true is set
 */
export function createRxNormClient(): RxNormClient {
  const useMockApis = process.env.USE_MOCK_APIS === 'true';
  
  // Determine base URL: use mock if USE_MOCK_APIS=true, otherwise use real API
  const baseUrl = useMockApis
    ? (process.env.MOCK_RXNORM_URL || 'http://localhost:3001')
    : (process.env.RXNORM_API_URL || 'https://rxnav.nlm.nih.gov/REST/');
  
  return new RxNormClient({
    baseUrl,
    timeout: 5000,
    maxRetries: 1,
    cacheTTL: 3600000, // 1 hour
    rateLimit: 10, // 10 req/sec
  });
}

