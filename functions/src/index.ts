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
import type { ComputeResponse, ErrorResponse } from './types/index.js';

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
      if (req.method !== 'GET') {
        res.status(405).json({
          error: 'Method Not Allowed',
          error_code: 'validation_error',
        } as ErrorResponse);
        return;
      }

      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'ndc-qty-calculator',
      });
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

      try {
        // TODO: Parse and validate request body (will use validation from Story 1.2)
        // TODO: Call RxNorm + FDA APIs
        // TODO: Run selection logic
        // For now, return placeholder response
        const placeholderResponse: ComputeResponse = {
          rxnorm: {
            rxcui: '12345',
            name: 'placeholder',
          },
          computed: {
            dose_unit: 'cap',
            per_day: 2,
            total_qty: 60,
            days_supply: 30,
          },
          ndc_selection: {
            chosen: {
              ndc: '00000-1111-22',
              pkg_size: 60,
              active: true,
              overfill: 0,
              packs: 1,
            },
            alternates: [],
          },
          flags: {
            inactive_ndcs: [],
            mismatch: false,
            notes: [],
          },
        };

        res.status(200).json(placeholderResponse);
      } catch (error: unknown) {
        // Error handling
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        const errorResponse: ErrorResponse = {
          error: errorMessage,
          error_code: 'internal_error',
          detail: 'An unexpected error occurred while processing the request',
        };

        res.status(500).json(errorResponse);
      }
    });
  }
);
