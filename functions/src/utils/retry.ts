/**
 * Retry Utility
 * 
 * This module provides retry logic with exponential backoff for external API calls.
 */

import { logWarn, logInfo } from './logger';

/**
 * Retry options
 */
export interface RetryOptions {
  maxAttempts: number; // Total attempts (including initial attempt)
  baseDelay: number; // Base delay in milliseconds
  maxDelay: number; // Maximum delay in milliseconds
  retryableErrors?: (error: unknown) => boolean; // Custom retryable error checker
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 2, // 1 initial + 1 retry = 2 total
  baseDelay: 1000, // 1 second
  maxDelay: 5000, // 5 seconds
};

/**
 * Check if error is retryable (5xx, timeout, network errors)
 * 
 * @param error - Error to check
 * @returns True if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Handle HTTP errors (status code)
  if (typeof error === 'object' && error !== null) {
    const statusCode = (error as any).status || (error as any).statusCode;
    if (statusCode) {
      // Retry on 5xx errors (server errors)
      if (statusCode >= 500 && statusCode < 600) {
        return true;
      }
      // Retry on 408 (Request Timeout) and 429 (Too Many Requests)
      if (statusCode === 408 || statusCode === 429) {
        return true;
      }
    }

    // Handle network/timeout errors
    const code = (error as any).code;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ENOTFOUND') {
      return true;
    }
  }

  return false;
}

/**
 * Calculate exponential backoff delay
 * 
 * @param attempt - Current attempt number (0-based)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
export function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = baseDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param options - Retry options
 * @param context - Context object for logging (should not contain PHI)
 * @returns Promise resolving to function result
 * @throws Last error if all retries fail
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  context: Record<string, unknown> = {}
): Promise<T> {
  const opts: RetryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  const retryableChecker = opts.retryableErrors || isRetryableError;
  let lastError: Error;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      const result = await fn();
      
      // Success - log retry success if not first attempt
      if (attempt > 0) {
        logInfo('Retry succeeded', {
          ...context,
          attempt: attempt + 1,
          totalAttempts: opts.maxAttempts,
        });
      }
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if should retry
      const isRetryable = retryableChecker(error);
      const hasMoreAttempts = attempt < opts.maxAttempts - 1;
      
      if (!isRetryable || !hasMoreAttempts) {
        // Don't retry - either not retryable or out of attempts
        if (attempt > 0) {
          logWarn('Retry failed after multiple attempts', {
            ...context,
            attempts: attempt + 1,
            error: lastError.message,
          });
        }
        throw lastError;
      }
      
      // Calculate backoff delay
      const delay = calculateBackoff(attempt, opts.baseDelay, opts.maxDelay);
      
      logWarn('Retrying after error', {
        ...context,
        attempt: attempt + 1,
        nextAttempt: attempt + 2,
        totalAttempts: opts.maxAttempts,
        error: lastError.message,
        retryAfterMs: delay,
      });
      
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError!;
}

/**
 * Create a retryable function wrapper
 * 
 * @param fn - Function to make retryable
 * @param options - Retry options
 * @returns Wrapped function with retry logic
 */
export function makeRetryable<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): () => Promise<T> {
  return () => retry(fn, options);
}


