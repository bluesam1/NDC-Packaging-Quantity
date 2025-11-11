import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateCorrelationId,
  logInfo,
  logWarn,
  logError,
  logRequestStart,
  logRequestEnd,
  createRequestContext,
  getRequestDuration,
} from './logger';

describe('Logger', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('generateCorrelationId', () => {
    it('should generate a UUID', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('logInfo', () => {
    it('should log info messages in JSON format', () => {
      logInfo('Test message', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(loggedData.severity).toBe('INFO');
      expect(loggedData.message).toBe('Test message');
      expect(loggedData.key).toBe('value');
      expect(loggedData.service).toBe('ndc-qty-api');
      expect(loggedData.environment).toBe('development');
      expect(loggedData.timestamp).toBeDefined();
    });
  });

  describe('logWarn', () => {
    it('should log warning messages', () => {
      logWarn('Warning message', { warning: true });

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

      expect(loggedData.severity).toBe('WARN');
      expect(loggedData.message).toBe('Warning message');
      expect(loggedData.warning).toBe(true);
    });
  });

  describe('logError', () => {
    it('should log error messages', () => {
      logError('Error message', { error: 'details' });

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(loggedData.severity).toBe('ERROR');
      expect(loggedData.message).toBe('Error message');
      expect(loggedData.error).toBe('details');
    });
  });

  describe('PHI redaction', () => {
    it('should redact drug_input', () => {
      logInfo('Test', { drug_input: 'sensitive data' });

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.drug_input).toBe('[REDACTED]');
    });

    it('should redact sig', () => {
      logInfo('Test', { sig: 'Take 1 tablet daily' });

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.sig).toBe('[REDACTED]');
    });

    it('should redact drug_name', () => {
      logInfo('Test', { drug_name: 'Aspirin' });

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.drug_name).toBe('[REDACTED]');
    });

    it('should not redact non-PHI fields', () => {
      logInfo('Test', { method: 'POST', status: 200 });

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.method).toBe('POST');
      expect(loggedData.status).toBe(200);
    });
  });

  describe('logRequestStart', () => {
    it('should log request start', () => {
      const correlationId = 'test-correlation-id';
      logRequestStart(correlationId, 'POST', '/api/calculate', { userAgent: 'test-agent' });

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(loggedData.message).toBe('Request started');
      expect(loggedData.correlationId).toBe(correlationId);
      expect(loggedData.method).toBe('POST');
      expect(loggedData.path).toBe('/api/calculate');
      expect(loggedData.userAgent).toBe('test-agent');
    });
  });

  describe('logRequestEnd', () => {
    it('should log request end', () => {
      const correlationId = 'test-correlation-id';
      logRequestEnd(correlationId, 'POST', '/api/calculate', 200, 123, { userAgent: 'test-agent' });

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(loggedData.message).toBe('Request completed');
      expect(loggedData.correlationId).toBe(correlationId);
      expect(loggedData.method).toBe('POST');
      expect(loggedData.path).toBe('/api/calculate');
      expect(loggedData.statusCode).toBe(200);
      expect(loggedData.duration).toBe(123);
    });
  });

  describe('createRequestContext', () => {
    it('should create request context', () => {
      const context = createRequestContext('GET', '/api/health');

      expect(context.method).toBe('GET');
      expect(context.path).toBe('/api/health');
      expect(context.correlationId).toBeDefined();
      expect(context.startTime).toBeDefined();
    });
  });

  describe('getRequestDuration', () => {
    it('should calculate request duration', async () => {
      const context = createRequestContext('GET', '/api/test');

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const duration = getRequestDuration(context);
      // Allow 1ms tolerance for timer precision variations
      expect(duration).toBeGreaterThanOrEqual(9);
    });
  });
});

