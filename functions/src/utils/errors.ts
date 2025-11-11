/**
 * Error Handling Utilities
 * 
 * This module provides custom error classes and error handling utilities.
 * All errors are translated to ErrorResponse format for API responses.
 */

import type { ErrorCode, ErrorResponse } from '../types/index';

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly errorCode: ErrorCode;
  public readonly statusCode: number;
  public readonly detail?: string;
  public readonly retryAfterMs?: number;
  public readonly fieldErrors?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    errorCode: ErrorCode,
    statusCode: number,
    options?: {
      detail?: string;
      retryAfterMs?: number;
      fieldErrors?: Array<{ field: string; message: string }>;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.detail = options?.detail;
    this.retryAfterMs = options?.retryAfterMs;
    this.fieldErrors = options?.fieldErrors;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Converts error to ErrorResponse format
   */
  toErrorResponse(): ErrorResponse {
    const response: ErrorResponse = {
      error: this.message,
      error_code: this.errorCode,
    };

    if (this.detail) {
      response.detail = this.detail;
    }

    if (this.retryAfterMs) {
      response.retry_after_ms = this.retryAfterMs;
    }

    if (this.fieldErrors) {
      response.field_errors = this.fieldErrors;
    }

    return response;
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, fieldErrors?: Array<{ field: string; message: string }>) {
    super(message, 'validation_error', 400, { fieldErrors });
  }
}

/**
 * Parse error (422)
 */
export class ParseError extends AppError {
  constructor(message: string, detail?: string) {
    super(message, 'parse_error', 422, { detail });
  }
}

/**
 * Dependency error (424)
 * Used when external APIs fail
 */
export class DependencyError extends AppError {
  constructor(message: string, detail?: string, retryAfterMs?: number) {
    super(message, 'dependency_failure', 424, { detail, retryAfterMs });
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  constructor(message: string, retryAfterMs?: number) {
    super(message, 'rate_limit_exceeded', 429, { retryAfterMs });
  }
}

/**
 * Internal error (500)
 */
export class InternalError extends AppError {
  constructor(message: string, detail?: string) {
    super(message, 'internal_error', 500, { detail });
  }
}

/**
 * Converts an unknown error to an ErrorResponse
 * 
 * @param error - Unknown error object
 * @returns ErrorResponse
 */
export function errorToResponse(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return error.toErrorResponse();
  }

  if (error instanceof Error) {
    return {
      error: error.message,
      error_code: 'internal_error',
      detail: 'An unexpected error occurred',
    };
  }

  return {
    error: 'Internal Server Error',
    error_code: 'internal_error',
    detail: 'An unexpected error occurred',
  };
}

