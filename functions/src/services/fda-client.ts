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

    // Check if this is insulin (for special package size handling)
    const isInsulin = this.isInsulinProduct(result);

    // Parse package size from multiple possible sources
    let pkgSize = 0;
    
    // Special handling for insulin: calculate total units from volume
    if (isInsulin) {
      pkgSize = this.parseInsulinPackageSize(result);
    }
    
    // Standard parsing for non-insulin products
    if (pkgSize === 0) {
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
      package_description: result.package_description || (Array.isArray(result.packaging) && result.packaging.length > 0 ? result.packaging[0].description : undefined),
    };
  }

  /**
   * Check if product is insulin based on dosage form or brand name
   */
  private isInsulinProduct(result: NonNullable<FDAResponse['results']>[0]): boolean {
    const dosageForm = result.dosage_form?.toUpperCase() || '';
    const brandName = result.brand_name?.toLowerCase() || '';
    const packageDesc = result.package_description?.toLowerCase() || '';
    
    // Check for insulin keywords
    const insulinKeywords = ['insulin', 'humalog', 'novolog', 'lantus', 'levemir', 'tresiba', 'basaglar', 'toujeo', 'apidra', 'fiasp'];
    const hasInsulinKeyword = insulinKeywords.some(keyword => 
      brandName.includes(keyword) || packageDesc.includes(keyword)
    );
    
    // Check for insulin dosage forms (injection/solution for insulin)
    const isInjection = dosageForm.includes('INJECTION') || dosageForm.includes('SOLUTION');
    
    return hasInsulinKeyword || (isInjection && (brandName.includes('insulin') || packageDesc.includes('insulin')));
  }

  /**
   * Parse insulin package size from FDA data
   * For insulin, package_size should represent total units in the package
   * Typical packages:
   * - Vials: 10 mL = 1000 units (U100), 3 mL = 300 units (U100)
   * - Pens: 3 mL = 300 units (U100), 1.5 mL = 150 units (U100)
   */
  private parseInsulinPackageSize(result: NonNullable<FDAResponse['results']>[0]): number {
    const packageDesc = (result.package_description || '').toLowerCase();
    const brandName = (result.brand_name || '').toLowerCase();
    const packageSize = result.package_size || '';
    
    // Default concentration (U100 = 100 units/mL)
    let concentration = 100;
    
    // Check for concentration in name/description (U100, U200, U500)
    const concentrationMatch = (packageDesc + ' ' + brandName).match(/\b(u\d{3})\b/i);
    if (concentrationMatch) {
      const concStr = concentrationMatch[1].toLowerCase();
      if (concStr === 'u200') concentration = 200;
      else if (concStr === 'u500') concentration = 500;
      // else u100 = 100 (default)
    }
    
    // Try to extract volume from package description
    // Patterns: "10 ML", "3 ML", "1 VIAL", "1 PEN", etc.
    let volumeML = 0;
    
    // Pattern 1: Extract mL volume directly
    const mlMatch = packageDesc.match(/(\d+(?:\.\d+)?)\s*ml/i);
    if (mlMatch) {
      volumeML = parseFloat(mlMatch[1]);
    }
    
    // Pattern 2: Extract from "X VIAL" or "X PEN" and infer volume
    if (volumeML === 0) {
      const vialMatch = packageDesc.match(/(\d+)\s*vial/i);
      const penMatch = packageDesc.match(/(\d+)\s*pen/i);
      
      if (vialMatch) {
        const vialCount = parseInt(vialMatch[1], 10);
        // Standard vial is 10 mL, but could be 3 mL
        // Check if description mentions size
        const smallVialMatch = packageDesc.match(/3\s*ml|small/i);
        volumeML = vialCount * (smallVialMatch ? 3 : 10);
      } else if (penMatch) {
        const penCount = parseInt(penMatch[1], 10);
        // Standard pen is 3 mL, but could be 1.5 mL
        const smallPenMatch = packageDesc.match(/1\.5|1\s*1\/2/i);
        volumeML = penCount * (smallPenMatch ? 1.5 : 3);
      }
    }
    
    // Pattern 3: Try package_size field - might be volume in mL
    if (volumeML === 0 && packageSize) {
      const sizeMatch = packageSize.match(/(\d+(?:\.\d+)?)/);
      if (sizeMatch) {
        const sizeValue = parseFloat(sizeMatch[1]);
        // If it's a reasonable volume (1-20 mL), treat as volume
        if (sizeValue >= 1 && sizeValue <= 20) {
          volumeML = sizeValue;
        }
      }
    }
    
    // Pattern 4: Try packaging array
    if (volumeML === 0 && Array.isArray(result.packaging) && result.packaging.length > 0) {
      const firstPackage = result.packaging[0];
      if (firstPackage.description) {
        const desc = firstPackage.description.toLowerCase();
        const mlMatch = desc.match(/(\d+(?:\.\d+)?)\s*ml/i);
        if (mlMatch) {
          volumeML = parseFloat(mlMatch[1]);
        } else {
          const vialMatch = desc.match(/(\d+)\s*vial/i);
          const penMatch = desc.match(/(\d+)\s*pen/i);
          if (vialMatch) {
            volumeML = parseInt(vialMatch[1], 10) * 10; // Default to 10 mL vials
          } else if (penMatch) {
            volumeML = parseInt(penMatch[1], 10) * 3; // Default to 3 mL pens
          }
        }
      }
    }
    
    // Calculate total units: volume (mL) × concentration (units/mL)
    if (volumeML > 0) {
      const totalUnits = Math.round(volumeML * concentration);
      logInfo('Parsed insulin package size', {
        packageDesc: packageDesc.substring(0, 100),
        volumeML,
        concentration,
        totalUnits,
      });
      return totalUnits;
    }
    
    // If we can't determine volume, return 0 to fall back to standard parsing
    return 0;
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
 * Uses real APIs by default unless USE_MOCK_APIS=true is set
 */
export function createFDAClient(): FDAClient {
  const useMockApis = process.env.USE_MOCK_APIS === 'true';
  
  // Determine base URL: use mock if USE_MOCK_APIS=true, otherwise use real API
  const baseUrl = useMockApis
    ? (process.env.MOCK_FDA_URL || 'http://localhost:3001')
    : (process.env.FDA_API_URL || 'https://api.fda.gov/drug/ndc.json');
  
  return new FDAClient({
    baseUrl,
    timeout: 5000,
    maxRetries: 1,
    cacheTTL: 86400000, // 24 hours
    rateLimit: 3, // 3 req/sec
  });
}

