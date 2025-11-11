import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  recordCounter,
  recordGauge,
  recordHistogram,
  startTimer,
  METRICS,
} from './metrics';

describe('Metrics', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('recordCounter', () => {
    it('should record counter metric', () => {
      recordCounter('test.counter', 5, { label: 'value' });

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(loggedData.message).toBe('Metric: test.counter');
      expect(loggedData.metricType).toBe('counter');
      expect(loggedData.metricName).toBe('test.counter');
      expect(loggedData.metricValue).toBe(5);
      expect(loggedData.label).toBe('value');
    });

    it('should default to value 1', () => {
      recordCounter('test.counter');

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.metricValue).toBe(1);
    });
  });

  describe('recordGauge', () => {
    it('should record gauge metric', () => {
      recordGauge('test.gauge', 42, { status: 'active' });

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(loggedData.message).toBe('Metric: test.gauge');
      expect(loggedData.metricType).toBe('gauge');
      expect(loggedData.metricName).toBe('test.gauge');
      expect(loggedData.metricValue).toBe(42);
      expect(loggedData.status).toBe('active');
    });
  });

  describe('recordHistogram', () => {
    it('should record histogram metric', () => {
      recordHistogram('test.duration', 123.45, { operation: 'test' });

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(loggedData.message).toBe('Metric: test.duration');
      expect(loggedData.metricType).toBe('histogram');
      expect(loggedData.metricName).toBe('test.duration');
      expect(loggedData.metricValue).toBe(123.45);
      expect(loggedData.operation).toBe('test');
    });
  });

  describe('Timer', () => {
    it('should measure duration and record histogram', async () => {
      const timer = startTimer('test.operation', { label: 'test' });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const duration = timer.stop();

      expect(duration).toBeGreaterThanOrEqual(10);
      expect(consoleLogSpy).toHaveBeenCalledOnce();

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.metricName).toBe('test.operation');
      expect(loggedData.metricType).toBe('histogram');
      expect(loggedData.metricValue).toBeGreaterThanOrEqual(10);
      expect(loggedData.label).toBe('test');
    });
  });

  describe('METRICS constants', () => {
    it('should have request metrics', () => {
      expect(METRICS.REQUEST_TOTAL).toBe('request.total');
      expect(METRICS.REQUEST_DURATION).toBe('request.duration');
      expect(METRICS.REQUEST_ERROR).toBe('request.error');
    });

    it('should have SIG parsing metrics', () => {
      expect(METRICS.SIG_PARSE_DURATION).toBe('sig.parse.duration');
      expect(METRICS.SIG_PARSE_SUCCESS).toBe('sig.parse.success');
      expect(METRICS.SIG_PARSE_FALLBACK).toBe('sig.parse.fallback');
    });

    it('should have OpenAI metrics', () => {
      expect(METRICS.OPENAI_REQUEST_DURATION).toBe('openai.request.duration');
      expect(METRICS.OPENAI_TOKEN_USAGE).toBe('openai.token.usage');
    });

    it('should have cache metrics', () => {
      expect(METRICS.CACHE_HIT).toBe('cache.hit');
      expect(METRICS.CACHE_MISS).toBe('cache.miss');
    });
  });
});


