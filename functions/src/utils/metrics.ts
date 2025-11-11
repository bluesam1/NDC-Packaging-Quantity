/**
 * Metrics Collection
 * 
 * This module provides performance metrics collection and reporting.
 * Metrics are logged to Cloud Logging for analysis.
 */

import { logInfo } from './logger';

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
}

/**
 * Record a counter metric
 * 
 * @param name - Metric name
 * @param value - Counter value (default 1)
 * @param labels - Additional labels
 */
export function recordCounter(
  name: string,
  value: number = 1,
  labels: Record<string, string> = {}
): void {
  logInfo(`Metric: ${name}`, {
    metricType: MetricType.COUNTER,
    metricName: name,
    metricValue: value,
    ...labels,
  });
}

/**
 * Record a gauge metric
 * 
 * @param name - Metric name
 * @param value - Gauge value
 * @param labels - Additional labels
 */
export function recordGauge(
  name: string,
  value: number,
  labels: Record<string, string> = {}
): void {
  logInfo(`Metric: ${name}`, {
    metricType: MetricType.GAUGE,
    metricName: name,
    metricValue: value,
    ...labels,
  });
}

/**
 * Record a histogram metric (duration)
 * 
 * @param name - Metric name
 * @param value - Duration in milliseconds
 * @param labels - Additional labels
 */
export function recordHistogram(
  name: string,
  value: number,
  labels: Record<string, string> = {}
): void {
  logInfo(`Metric: ${name}`, {
    metricType: MetricType.HISTOGRAM,
    metricName: name,
    metricValue: value,
    ...labels,
  });
}

/**
 * Timer for measuring operation duration
 */
export class Timer {
  private startTime: number;
  private name: string;
  private labels: Record<string, string>;

  constructor(name: string, labels: Record<string, string> = {}) {
    this.startTime = Date.now();
    this.name = name;
    this.labels = labels;
  }

  /**
   * Stop timer and record histogram
   * 
   * @returns Duration in milliseconds
   */
  stop(): number {
    const duration = Date.now() - this.startTime;
    recordHistogram(this.name, duration, this.labels);
    return duration;
  }
}

/**
 * Create a timer for an operation
 * 
 * @param name - Metric name
 * @param labels - Additional labels
 * @returns Timer instance
 */
export function startTimer(name: string, labels: Record<string, string> = {}): Timer {
  return new Timer(name, labels);
}

/**
 * Common metric names
 */
export const METRICS = {
  // Request metrics
  REQUEST_TOTAL: 'request.total',
  REQUEST_DURATION: 'request.duration',
  REQUEST_ERROR: 'request.error',
  
  // SIG parsing metrics
  SIG_PARSE_DURATION: 'sig.parse.duration',
  SIG_PARSE_SUCCESS: 'sig.parse.success',
  SIG_PARSE_FALLBACK: 'sig.parse.fallback',
  SIG_PARSE_ERROR: 'sig.parse.error',
  
  // OpenAI metrics
  OPENAI_REQUEST_DURATION: 'openai.request.duration',
  OPENAI_TOKEN_USAGE: 'openai.token.usage',
  OPENAI_ERROR: 'openai.error',
  
  // NDC validation metrics
  NDC_VALIDATION_DURATION: 'ndc.validation.duration',
  NDC_VALIDATION_SUCCESS: 'ndc.validation.success',
  NDC_VALIDATION_ERROR: 'ndc.validation.error',
  
  // Cache metrics
  CACHE_HIT: 'cache.hit',
  CACHE_MISS: 'cache.miss',
  CACHE_ERROR: 'cache.error',
};


