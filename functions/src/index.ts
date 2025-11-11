/**
 * Firebase Cloud Functions entry point
 * 
 * This file contains the Cloud Functions for the NDC Packaging & Quantity Calculator API.
 * 
 * Functions:
 * - health: Health check endpoint (GET /api/v1/health)
 * - compute: Main compute endpoint (POST /api/v1/compute)
 * 
 * Environment Variables:
 * - USE_MOCK_APIS: Set to 'true' to use mock APIs instead of real APIs (default: false)
 * - MOCK_RXNORM_URL: URL for mock RxNorm API (default: http://localhost:3001)
 * - MOCK_FDA_URL: URL for mock FDA API (default: http://localhost:3001)
 * - RXNORM_API_URL: URL for real RxNorm API (default: https://rxnav.nlm.nih.gov/REST)
 * - FDA_API_URL: URL for real FDA API (default: https://api.fda.gov/drug/ndc.json)
 */

import { onRequest } from 'firebase-functions/v2/https';
// import { defineSecret } from 'firebase-functions/params'; // Will be used in Epic 2
import cors from 'cors';
import { handleCompute } from './handlers/compute';
import { validateComputeRequestSafe } from './validation/schemas';
import { errorToResponse } from './utils/errors';
import type { ErrorResponse } from './types/index';
import { 
  generateCorrelationId, 
  logError, 
  logRequestStart, 
  logRequestEnd 
} from './utils/logger';
import { recordCounter, recordHistogram, METRICS } from './utils/metrics';

// Define secrets for API keys (will be used in Epic 2)
// const openaiApiKey = defineSecret('OPENAI_API_KEY');
// const apiKey = defineSecret('API_KEY');

// CORS configuration
// In production, allow only Firebase Hosting origin
// In development, allow localhost
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }

    // In production, check if origin matches Firebase Hosting
    if (process.env.NODE_ENV === 'production' || process.env.GCLOUD_PROJECT) {
      // Allow Firebase Hosting origin
      const allowedOrigins = [
        `https://${process.env.GCLOUD_PROJECT}.web.app`,
        `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`,
      ];
      if (allowedOrigins.some((allowed) => origin.includes(allowed))) {
        callback(null, true);
        return;
      }
    }

    // In development, allow localhost
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

// CORS middleware wrapper
const corsMiddleware = cors(corsOptions);

/**
 * Health check endpoint
 * 
 * GET /api/v1/health
 * Returns: { status: "ok", timestamp: string, version: string, service: string }
 */
export const health = onRequest(
  {
    region: 'us-central1',
  },
  (req, res) => {
    corsMiddleware(req, res, () => {
      const correlationId = generateCorrelationId();
      const startTime = Date.now();
      
      logRequestStart(correlationId, req.method, '/health', {
        userAgent: req.get('user-agent'),
      });
      
      recordCounter(METRICS.REQUEST_TOTAL, 1, {
        method: req.method,
        path: '/health',
      });
      
      if (req.method !== 'GET') {
        const duration = Date.now() - startTime;
        logRequestEnd(correlationId, req.method, '/health', 405, duration);
        recordHistogram(METRICS.REQUEST_DURATION, duration, {
          method: req.method,
          path: '/health',
          status: '405',
        });
        
        res.status(405).json({
          error: 'Method Not Allowed',
          error_code: 'validation_error',
        } as ErrorResponse);
        return;
      }

      const response = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'ndc-qty-calculator',
      };
      
      const duration = Date.now() - startTime;
      logRequestEnd(correlationId, req.method, '/health', 200, duration);
      recordHistogram(METRICS.REQUEST_DURATION, duration, {
        method: req.method,
        path: '/health',
        status: '200',
      });
      
      res.status(200).json(response);
    });
  }
);

/**
 * Compute endpoint skeleton
 * 
 * POST /api/v1/compute
 * Returns: Placeholder ComputeResponse (will be implemented in Epic 2)
 */
export const compute = onRequest(
  {
    region: 'us-central1',
    // Secrets will be added when API keys are configured
    // secrets: [openaiApiKey, apiKey],
  },
  (req, res) => {
    corsMiddleware(req, res, async () => {
      // Only allow POST requests
      if (req.method !== 'POST') {
        res.status(405).json({
          error: 'Method Not Allowed',
          error_code: 'validation_error',
        } as ErrorResponse);
        return;
      }

      // Generate correlation ID for logging
      const correlationId = generateCorrelationId();
      const startTime = Date.now();
      
      logRequestStart(correlationId, req.method, '/compute', {
        userAgent: req.get('user-agent'),
      });
      
      recordCounter(METRICS.REQUEST_TOTAL, 1, {
        method: req.method,
        path: '/compute',
      });
      
      try {
        // Parse and validate request body
        const validationResult = validateComputeRequestSafe(req.body);
        if (!validationResult.success) {
          const duration = Date.now() - startTime;
          logRequestEnd(correlationId, req.method, '/compute', 400, duration);
          recordHistogram(METRICS.REQUEST_DURATION, duration, {
            method: req.method,
            path: '/compute',
            status: '400',
          });
          recordCounter(METRICS.REQUEST_ERROR, 1, {
            method: req.method,
            path: '/compute',
            status: '400',
          });
          
          res.status(400).json({
            error: 'Invalid request',
            error_code: 'validation_error',
            field_errors: validationResult.field_errors,
          } as ErrorResponse);
          return;
        }

        // Call compute handler
        const response = await handleCompute(validationResult.data, correlationId);
        
        const duration = Date.now() - startTime;
        logRequestEnd(correlationId, req.method, '/compute', 200, duration);
        recordHistogram(METRICS.REQUEST_DURATION, duration, {
          method: req.method,
          path: '/compute',
          status: '200',
        });
        
        res.status(200).json(response);
      } catch (error: unknown) {
        const duration = Date.now() - startTime;
        
        // Error handling - convert to ErrorResponse format
        const errorResponse = errorToResponse(error);
        const statusCode = error instanceof Error && 'statusCode' in error
          ? (error as { statusCode: number }).statusCode
          : 500;
        
        logError('Request error', {
          correlationId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        
        logRequestEnd(correlationId, req.method, '/compute', statusCode, duration);
        recordHistogram(METRICS.REQUEST_DURATION, duration, {
          method: req.method,
          path: '/compute',
          status: statusCode.toString(),
        });
        recordCounter(METRICS.REQUEST_ERROR, 1, {
          method: req.method,
          path: '/compute',
          status: statusCode.toString(),
        });

        res.status(statusCode).json(errorResponse);
      }
    });
  }
);
