import { describe, it, expect, vi } from 'vitest';
import { withTimeout, createTimeout, TIMEOUTS } from './timeout';

describe('Timeout Utility', () => {
  describe('withTimeout', () => {
    it('should resolve if promise completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000);
      
      expect(result).toBe('success');
    });

    it('should reject if timeout occurs first', async () => {
      vi.useFakeTimers();
      
      const promise = new Promise((resolve) => setTimeout(() => resolve('late'), 2000));
      const timeoutPromise = withTimeout(promise, 1000);
      
      // Advance time to trigger timeout
      vi.advanceTimersByTime(1000);
      
      await expect(timeoutPromise).rejects.toThrow('Operation timed out after 1000ms');
      
      vi.useRealTimers();
    });

    it('should use custom error message', async () => {
      vi.useFakeTimers();
      
      const promise = new Promise((resolve) => setTimeout(() => resolve('late'), 2000));
      const timeoutPromise = withTimeout(promise, 1000, 'Custom timeout message');
      
      vi.advanceTimersByTime(1000);
      
      await expect(timeoutPromise).rejects.toThrow('Custom timeout message');
      
      vi.useRealTimers();
    });

    it('should include timeout code in error', async () => {
      vi.useFakeTimers();
      
      const promise = new Promise((resolve) => setTimeout(() => resolve('late'), 2000));
      const timeoutPromise = withTimeout(promise, 1000);
      
      vi.advanceTimersByTime(1000);
      
      try {
        await timeoutPromise;
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.code).toBe('ETIMEDOUT');
        expect(error.timeout).toBe(1000);
      }
      
      vi.useRealTimers();
    });
  });

  describe('createTimeout', () => {
    it('should create a timeout promise', async () => {
      vi.useFakeTimers();
      
      const timeout = createTimeout(1000, 'Test timeout');
      
      vi.advanceTimersByTime(1000);
      
      await expect(timeout).rejects.toThrow('Test timeout');
      
      vi.useRealTimers();
    });
  });

  describe('TIMEOUTS constants', () => {
    it('should have correct timeout values', () => {
      expect(TIMEOUTS.EXTERNAL_API).toBe(5000);
      expect(TIMEOUTS.FUNCTION_TOTAL).toBe(10000);
      expect(TIMEOUTS.DATABASE).toBe(3000);
    });
  });
});


