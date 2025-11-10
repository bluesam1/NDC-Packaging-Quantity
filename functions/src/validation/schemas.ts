/**
 * Zod Validation Schemas
 * 
 * This file contains Zod validation schemas for runtime type validation.
 * All schemas match the architecture document §4 (Data Models) specifications.
 */

import { z } from 'zod';
import type { ComputeRequest, ErrorCode } from '../types/index.js';

/**
 * Validates NDC format (11 digits with optional hyphens)
 * Accepts formats: 00000-1111-22 or 00000111122
 */
const ndcFormatRegex = /^(\d{5}-\d{4}-\d{2}|\d{11})$/;

/**
 * Validates that a string is a valid NDC format
 */
const ndcStringSchema = z.string().regex(ndcFormatRegex, {
  message: 'NDC must be 11 digits in format 00000-1111-22 or 00000111122',
});

/**
 * Validation schema for ComputeRequest
 * 
 * Validates:
 * - drug_input: Required, 2-200 chars, accepts drug names or NDC format
 * - sig: Required, 3-500 chars, free text
 * - days_supply: Required, integer, 1-365
 * - preferred_ndcs: Optional, array of valid NDC format strings, max 10 NDCs
 * - quantity_unit_override: Optional, must be one of: 'tab', 'cap', 'mL', 'actuation', 'unit'
 */
export const computeRequestSchema: z.ZodType<ComputeRequest> = z.object({
  drug_input: z
    .string()
    .min(2, { message: 'drug_input must be at least 2 characters' })
    .max(200, { message: 'drug_input must be at most 200 characters' })
    .describe('Drug name (brand/generic) or NDC format (11 digits)'),

  sig: z
    .string()
    .min(3, { message: 'sig must be at least 3 characters' })
    .max(500, { message: 'sig must be at most 500 characters' })
    .describe('Prescription directions (free text)'),

  days_supply: z
    .number()
    .int({ message: 'days_supply must be an integer' })
    .min(1, { message: 'days_supply must be at least 1' })
    .max(365, { message: 'days_supply must be at most 365' })
    .describe('Days of medication supply'),

  preferred_ndcs: z
    .array(ndcStringSchema)
    .max(10, { message: 'preferred_ndcs must contain at most 10 NDCs' })
    .optional()
    .describe('Optional array of preferred NDCs for ranking bias'),

  quantity_unit_override: z
    .enum(['tab', 'cap', 'mL', 'actuation', 'unit'], {
      message: 'quantity_unit_override must be one of: tab, cap, mL, actuation, unit',
    })
    .optional()
    .describe('Optional override unit type'),
});

/**
 * Validates a ComputeRequest payload
 * 
 * @param data - The data to validate
 * @returns Validated ComputeRequest or throws ZodError
 */
export function validateComputeRequest(data: unknown): ComputeRequest {
  return computeRequestSchema.parse(data);
}

/**
 * Validates a ComputeRequest payload and returns detailed error information
 * 
 * @param data - The data to validate
 * @returns Object with success flag and either validated data or field errors
 */
export function validateComputeRequestSafe(
  data: unknown
): { success: true; data: ComputeRequest } | { success: false; field_errors: Array<{ field: string; message: string }> } {
  const result = computeRequestSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const field_errors = result.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

  return { success: false, field_errors };
}

/**
 * Error code schema for validation
 */
export const errorCodeSchema = z.enum([
  'validation_error',
  'parse_error',
  'dependency_failure',
  'internal_error',
  'rate_limit_exceeded',
]) satisfies z.ZodType<ErrorCode>;

