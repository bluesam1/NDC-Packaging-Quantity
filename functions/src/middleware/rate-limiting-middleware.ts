/**
 * Rate Limiting Middleware
 * 
 * This middleware implements per-IP rate limiting to prevent abuse.
 * Default: 10 requests per minute per IP address.
 */

// @ts-ignore - Express types not available, but this middleware is not currently used
import { Request, Response, NextFunction } from 'express';
import { logWarn, logInfo } from '../utils/logger';
import { recordCounter } from '../utils/metrics';

/**
 * Rate limit configuration
 */
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10');

/**
 * Rate limit store (IP -> {count, resetTime})
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

/**
 * Get client IP address from request
 * 
 * @param req - Express request
 * @returns IP address
 */
function getClientIP(req: Request): string {
  // Check X-Forwarded-For header (set by proxies/load balancers)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }
  
  // Check X-Real-IP header
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }
  
  // Fallback to socket remote address
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Check if request should bypass rate limiting
 * 
 * @param req - Express request
 * @returns True if should bypass
 */
function shouldBypassRateLimit(req: Request): boolean {
  // Bypass for authenticated requests (if API key auth is enabled)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // In future: validate API key here
    // For now: bypass is disabled unless explicitly configured
    return false;
  }
  
  // Bypass for health check endpoint
  if (req.path === '/health' || req.path.endsWith('/health')) {
    return true;
  }
  
  return false;
}

/**
 * Rate limiting middleware
 * 
 * Limits requests per IP address to prevent abuse.
 * Returns 429 Too Many Requests if limit exceeded.
 */
export function rateLimitingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check if should bypass
  if (shouldBypassRateLimit(req)) {
    next();
    return;
  }
  
  const clientIP = getClientIP(req);
  const now = Date.now();
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(clientIP);
  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired entry
    entry = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
    rateLimitStore.set(clientIP, entry);
  }
  
  // Increment request count
  entry.count++;
  
  // Check if limit exceeded
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000); // seconds
    
    logWarn('Rate limit exceeded', {
      clientIP: clientIP.replace(/\d+/g, 'X'), // Anonymize IP in logs
      count: entry.count,
      limit: RATE_LIMIT_MAX_REQUESTS,
      retryAfter,
    });
    
    recordCounter('rate_limit.exceeded', 1, {
      path: req.path,
    });
    
    res.status(429).json({
      error: 'Too Many Requests',
      error_code: 'rate_limit_exceeded',
      message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
      retry_after_seconds: retryAfter,
    });
    
    res.setHeader('Retry-After', retryAfter.toString());
    return;
  }
  
  // Log rate limit status (debug)
  if (entry.count === Math.floor(RATE_LIMIT_MAX_REQUESTS * 0.8)) {
    logInfo('Rate limit approaching', {
      clientIP: clientIP.replace(/\d+/g, 'X'),
      count: entry.count,
      limit: RATE_LIMIT_MAX_REQUESTS,
    });
  }
  
  // Add rate limit headers to response
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
  res.setHeader('X-RateLimit-Remaining', (RATE_LIMIT_MAX_REQUESTS - entry.count).toString());
  res.setHeader('X-RateLimit-Reset', entry.resetTime.toString());
  
  next();
}

/**
 * Security headers middleware
 * 
 * Adds security-related HTTP headers to all responses.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Enforce HTTPS (in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  next();
}


