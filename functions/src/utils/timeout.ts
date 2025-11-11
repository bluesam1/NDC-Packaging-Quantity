/**
 * Timeout Utility
 * 
 * This module provides timeout handling for external API calls.
 */

/**
 * Create a timeout promise that rejects after specified milliseconds
 * 
 * @param ms - Timeout in milliseconds
 * @param message - Error message
 * @returns Promise that rejects with TimeoutError
 */
export function createTimeout(ms: number, message: string = 'Operation timed out'): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error: any = new Error(message);
      error.code = 'ETIMEDOUT';
      error.timeout = ms;
      reject(error);
    }, ms);
  });
}

/**
 * Wrap a promise with a timeout
 * 
 * @param promise - Promise to wrap
 * @param ms - Timeout in milliseconds
 * @param message - Error message if timeout occurs
 * @returns Promise that resolves/rejects first (operation or timeout)
 * @throws TimeoutError if operation exceeds timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string = `Operation timed out after ${ms}ms`
): Promise<T> {
  return Promise.race([promise, createTimeout(ms, message)]);
}

/**
 * Timeout constants
 */
export const TIMEOUTS = {
  EXTERNAL_API: 5000, // 5 seconds for external APIs (RxNorm, FDA, OpenAI)
  FUNCTION_TOTAL: 10000, // 10 seconds total for function execution
  DATABASE: 3000, // 3 seconds for database queries (future)
};


