/**
 * Error Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  ParseError,
  DependencyError,
  RateLimitError,
  InternalError,
  errorToResponse,
} from './errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with all properties', () => {
      const error = new AppError(
        'Test error',
        'validation_error',
        400,
        {
          detail: 'Test detail',
          retryAfterMs: 1000,
          fieldErrors: [{ field: 'test', message: 'Test message' }],
        }
      );

      expect(error.message).toBe('Test error');
      expect(error.errorCode).toBe('validation_error');
      expect(error.statusCode).toBe(400);
      expect(error.detail).toBe('Test detail');
      expect(error.retryAfterMs).toBe(1000);
      expect(error.fieldErrors).toEqual([{ field: 'test', message: 'Test message' }]);
    });

    it('should convert to ErrorResponse format', () => {
      const error = new AppError(
        'Test error',
        'validation_error',
        400,
        {
          detail: 'Test detail',
          fieldErrors: [{ field: 'test', message: 'Test message' }],
        }
      );

      const response = error.toErrorResponse();
      expect(response).toEqual({
        error: 'Test error',
        error_code: 'validation_error',
        detail: 'Test detail',
        field_errors: [{ field: 'test', message: 'Test message' }],
      });
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with 400 status', () => {
      const error = new ValidationError('Invalid input', [
        { field: 'test', message: 'Test message' },
      ]);

      expect(error.message).toBe('Invalid input');
      expect(error.errorCode).toBe('validation_error');
      expect(error.statusCode).toBe(400);
      expect(error.fieldErrors).toEqual([{ field: 'test', message: 'Test message' }]);
    });
  });

  describe('ParseError', () => {
    it('should create a ParseError with 422 status', () => {
      const error = new ParseError('Parse failed', 'Unable to parse SIG');

      expect(error.message).toBe('Parse failed');
      expect(error.errorCode).toBe('parse_error');
      expect(error.statusCode).toBe(422);
      expect(error.detail).toBe('Unable to parse SIG');
    });
  });

  describe('DependencyError', () => {
    it('should create a DependencyError with 424 status', () => {
      const error = new DependencyError('API failed', 'External API error', 2000);

      expect(error.message).toBe('API failed');
      expect(error.errorCode).toBe('dependency_failure');
      expect(error.statusCode).toBe(424);
      expect(error.detail).toBe('External API error');
      expect(error.retryAfterMs).toBe(2000);
    });
  });

  describe('RateLimitError', () => {
    it('should create a RateLimitError with 429 status', () => {
      const error = new RateLimitError('Rate limit exceeded', 1000);

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.errorCode).toBe('rate_limit_exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfterMs).toBe(1000);
    });
  });

  describe('InternalError', () => {
    it('should create an InternalError with 500 status', () => {
      const error = new InternalError('Internal error', 'Unexpected error');

      expect(error.message).toBe('Internal error');
      expect(error.errorCode).toBe('internal_error');
      expect(error.statusCode).toBe(500);
      expect(error.detail).toBe('Unexpected error');
    });
  });

  describe('errorToResponse', () => {
    it('should convert AppError to ErrorResponse', () => {
      const error = new ValidationError('Invalid input');
      const response = errorToResponse(error);

      expect(response.error_code).toBe('validation_error');
      expect(response.error).toBe('Invalid input');
    });

    it('should convert regular Error to ErrorResponse', () => {
      const error = new Error('Regular error');
      const response = errorToResponse(error);

      expect(response.error_code).toBe('internal_error');
      expect(response.error).toBe('Regular error');
    });

    it('should handle unknown error types', () => {
      const response = errorToResponse('string error');

      expect(response.error_code).toBe('internal_error');
      expect(response.error).toBe('Internal Server Error');
    });
  });
});

