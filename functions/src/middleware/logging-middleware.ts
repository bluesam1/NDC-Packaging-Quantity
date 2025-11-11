/**
 * Logging Middleware
 * 
 * This middleware provides automatic request/response logging with correlation IDs.
 */

// @ts-ignore - Express types not available, but this middleware is not currently used
import { Request, Response, NextFunction } from 'express';
import { 
  createRequestContext, 
  getRequestDuration, 
  logRequestStart, 
  logRequestEnd,
  logError 
} from '../utils/logger';
import { recordCounter, recordHistogram, METRICS } from '../utils/metrics';

/**
 * Express middleware for request logging and correlation IDs
 * 
 * Automatically logs request start/end and adds correlation ID to request object
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Create request context with correlation ID
  const requestContext = createRequestContext(req.method, req.path);
  
  // Attach correlation ID to request for downstream use
  (req as any).correlationId = requestContext.correlationId;
  
  // Log request start
  logRequestStart(requestContext.correlationId, req.method, req.path, {
    userAgent: req.get('user-agent'),
  });
  
  // Record request metric
  recordCounter(METRICS.REQUEST_TOTAL, 1, {
    method: req.method,
    path: req.path,
  });
  
  // Capture response finish event
  const originalSend = res.send;
  res.send = function(data: any): Response {
    // Calculate duration
    const duration = getRequestDuration(requestContext);
    
    // Log request end
    logRequestEnd(
      requestContext.correlationId,
      req.method,
      req.path,
      res.statusCode,
      duration,
      {
        userAgent: req.get('user-agent'),
      }
    );
    
    // Record duration metric
    recordHistogram(METRICS.REQUEST_DURATION, duration, {
      method: req.method,
      path: req.path,
      status: res.statusCode.toString(),
    });
    
    // Record error metric if error status
    if (res.statusCode >= 400) {
      recordCounter(METRICS.REQUEST_ERROR, 1, {
        method: req.method,
        path: req.path,
        status: res.statusCode.toString(),
      });
    }
    
    // Call original send
    return originalSend.call(this, data);
  };
  
  // Handle errors
  res.on('error', (error: Error) => {
    logError('Response error', {
      correlationId: requestContext.correlationId,
      method: req.method,
      path: req.path,
      error: error.message,
      stack: error.stack,
    });
  });
  
  next();
}

/**
 * Extract correlation ID from request
 * 
 * @param req - Express request
 * @returns Correlation ID or undefined
 */
export function getCorrelationId(req: Request): string | undefined {
  return (req as any).correlationId;
}


