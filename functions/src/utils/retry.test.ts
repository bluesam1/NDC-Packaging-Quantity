import { describe, it, expect, vi } from 'vitest';
import { retry, isRetryableError, calculateBackoff } from './retry';

describe('Retry Utility', () => {
  describe('isRetryableError', () => {
    it('should return true for 5xx errors', () => {
      const error = { status: 500 };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 408 timeout', () => {
      const error = { status: 408 };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 429 rate limit', () => {
      const error = { status: 429 };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for 4xx errors (except 408, 429)', () => {
      const error = { status: 400 };
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return true for network errors', () => {
      const error = { code: 'ECONNABORTED' };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for timeout errors', () => {
      const error = { code: 'ETIMEDOUT' };
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = new Error('Not retryable');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff', () => {
      expect(calculateBackoff(0, 1000, 5000)).toBe(1000); // 1000 * 2^0 = 1000
      expect(calculateBackoff(1, 1000, 5000)).toBe(2000); // 1000 * 2^1 = 2000
      expect(calculateBackoff(2, 1000, 5000)).toBe(4000); // 1000 * 2^2 = 4000
    });

    it('should respect max delay', () => {
      expect(calculateBackoff(3, 1000, 5000)).toBe(5000); // 1000 * 2^3 = 8000, capped at 5000
      expect(calculateBackoff(10, 1000, 5000)).toBe(5000); // Way over max
    });
  });

  describe('retry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 500 })
        .mockResolvedValueOnce('success');
      
      const result = await retry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
      const error = { status: 400 };
      const fn = vi.fn().mockRejectedValue(error);
      
      await expect(retry(fn)).rejects.toThrowError();
      expect(fn).toHaveBeenCalledTimes(1); // Only initial attempt
    });

    it('should exhaust retries and throw last error', async () => {
      const error = { status: 500 };
      const fn = vi.fn().mockRejectedValue(error);
      
      await expect(retry(fn, { maxAttempts: 3 })).rejects.toThrowError();
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should wait between retries', async () => {
      vi.useFakeTimers();
      
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 500 })
        .mockResolvedValueOnce('success');
      
      const promise = retry(fn, { baseDelay: 1000, maxDelay: 5000 });
      
      // Wait for first attempt to fail
      await vi.runOnlyPendingTimersAsync();
      
      // Complete the retry
      await vi.runAllTimersAsync();
      
      const result = await promise;
      expect(result).toBe('success');
      
      vi.useRealTimers();
    });

    it('should respect custom retryable error checker', async () => {
      const customChecker = (error: unknown) => {
        return (error as any).customRetry === true;
      };
      
      const fn = vi.fn()
        .mockRejectedValueOnce({ customRetry: true })
        .mockResolvedValueOnce('success');
      
      const result = await retry(fn, { retryableErrors: customChecker });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});

