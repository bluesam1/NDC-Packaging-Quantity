/**
 * Structured Logger
 * 
 * This module provides structured logging utilities for Cloud Logging.
 * All logs are in JSON format and PHI is automatically redacted.
 * Supports correlation IDs, sampling, and metrics collection.
 */

import { v4 as uuidv4 } from 'uuid';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Environment configuration
 */
const ENVIRONMENT = process.env.ENVIRONMENT || 'development';
const SERVICE_NAME = process.env.SERVICE_NAME || 'ndc-qty-api';
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const SAMPLING_RATE = parseFloat(process.env.SAMPLING_RATE || '1.0'); // Default 100% in dev

interface LogContext {
  correlationId?: string;
  service?: string;
  environment?: string;
  version?: string;
  userAgent?: string;
  [key: string]: unknown;
}

/**
 * Request context for tracking requests
 */
interface RequestContext {
  correlationId: string;
  method: string;
  path: string;
  startTime: number;
}

/**
 * Redacts PHI from log context
 * 
 * @param context - Log context object
 * @returns Redacted context object
 */
function redactPHI(context: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...context };
  const phiFields = ['drug_input', 'sig', 'drug_name', 'name'];
  
  for (const field of phiFields) {
    if (field in redacted && redacted[field] !== undefined) {
      redacted[field] = '[REDACTED]';
    }
  }
  
  return redacted;
}

/**
 * Generate a correlation ID
 * 
 * @returns UUID correlation ID
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Check if log should be sampled
 * 
 * @param level - Log level (errors always logged)
 * @returns True if should log
 */
function shouldSample(level: LogLevel): boolean {
  // Always log errors regardless of sampling
  if (level === 'ERROR') {
    return true;
  }
  
  // Apply sampling rate for other levels
  return Math.random() < SAMPLING_RATE;
}

/**
 * Check if log level should be logged
 * 
 * @param level - Log level to check
 * @returns True if should log
 */
function shouldLog(level: LogLevel): boolean {
  const levels: Record<LogLevel, number> = {
    'DEBUG': 0,
    'INFO': 1,
    'WARN': 2,
    'ERROR': 3,
  };
  
  return levels[level] >= levels[LOG_LEVEL as LogLevel];
}

/**
 * Logs a message with structured JSON format
 * 
 * @param level - Log level
 * @param message - Log message
 * @param context - Additional context (PHI will be redacted)
 */
function log(level: LogLevel, message: string, context: LogContext = {}): void {
  // Check if log level is enabled
  if (!shouldLog(level)) {
    return;
  }
  
  // Check if should sample (errors always logged)
  if (!shouldSample(level)) {
    return;
  }
  
  const redactedContext = redactPHI(context as Record<string, unknown>);
  
  const logEntry = {
    severity: level,
    message,
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
    ...redactedContext,
  };
  
  // Use console methods for Cloud Logging compatibility
  // Cloud Logging will automatically parse JSON from console output
  const logMethod = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  logMethod(JSON.stringify(logEntry));
}

/**
 * Logs a debug message
 * 
 * @param message - Log message
 * @param context - Additional context
 */
export function logDebug(message: string, context: LogContext = {}): void {
  log('DEBUG', message, context);
}

/**
 * Logs an info message
 * 
 * @param message - Log message
 * @param context - Additional context
 */
export function logInfo(message: string, context: LogContext = {}): void {
  log('INFO', message, context);
}

/**
 * Logs a warning message
 * 
 * @param message - Log message
 * @param context - Additional context
 */
export function logWarn(message: string, context: LogContext = {}): void {
  log('WARN', message, context);
}

/**
 * Logs an error message
 * 
 * @param message - Log message
 * @param context - Additional context
 */
export function logError(message: string, context: LogContext = {}): void {
  log('ERROR', message, context);
}

/**
 * Log request start
 * 
 * @param correlationId - Correlation ID
 * @param method - HTTP method
 * @param path - Request path
 * @param context - Additional context
 */
export function logRequestStart(
  correlationId: string,
  method: string,
  path: string,
  context: LogContext = {}
): void {
  logInfo('Request started', {
    correlationId,
    method,
    path,
    ...context,
  });
}

/**
 * Log request end
 * 
 * @param correlationId - Correlation ID
 * @param method - HTTP method
 * @param path - Request path
 * @param statusCode - HTTP status code
 * @param duration - Duration in milliseconds
 * @param context - Additional context
 */
export function logRequestEnd(
  correlationId: string,
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  context: LogContext = {}
): void {
  logInfo('Request completed', {
    correlationId,
    method,
    path,
    statusCode,
    duration,
    ...context,
  });
}

/**
 * Create request context for tracking
 * 
 * @param method - HTTP method
 * @param path - Request path
 * @returns Request context
 */
export function createRequestContext(method: string, path: string): RequestContext {
  return {
    correlationId: generateCorrelationId(),
    method,
    path,
    startTime: Date.now(),
  };
}

/**
 * Get request duration
 * 
 * @param requestContext - Request context
 * @returns Duration in milliseconds
 */
export function getRequestDuration(requestContext: RequestContext): number {
  return Date.now() - requestContext.startTime;
}

