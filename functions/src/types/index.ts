/**
 * API Contract Type Definitions
 * 
 * This file contains TypeScript type definitions for the compute API contract.
 * All types match the architecture document §4 (Data Models) specifications.
 */

/**
 * Request payload for the compute API endpoint
 * 
 * @property drug_input - Drug name (brand/generic) or NDC format (11 digits), 2-200 chars
 * @property sig - Prescription directions (free text), 3-500 chars
 * @property days_supply - Days of medication supply, 1-365
 * @property preferred_ndcs - Optional array of preferred NDCs for ranking bias, max 10 NDCs
 * @property quantity_unit_override - Optional override unit type
 */
export type ComputeRequest = {
  drug_input: string;
  sig: string;
  days_supply: number;
  preferred_ndcs?: string[];
  quantity_unit_override?: 'tab' | 'cap' | 'mL' | 'actuation' | 'unit';
};

/**
 * Response payload from the compute API endpoint
 * 
 * @property rxnorm - Normalized RxNorm data
 * @property computed - Calculated quantities
 * @property ndc_selection - Chosen package and alternates
 * @property flags - Warnings and status flags
 */
export type ComputeResponse = {
  rxnorm: { rxcui: string; name: string };
  computed: { dose_unit: string; per_day: number; total_qty: number; days_supply: number };
  ndc_selection: {
    chosen?: { ndc: string; pkg_size: number; active: boolean; overfill: number; packs: number };
    alternates: { ndc: string; pkg_size: number; active: boolean; overfill: number; packs: number }[];
  };
  flags: { inactive_ndcs: string[]; mismatch: boolean; notes?: string[]; error_code?: string | null };
};

/**
 * Error code union type
 * 
 * - validation_error: Invalid input (400)
 * - parse_error: Unparseable SIG (422)
 * - dependency_failure: External API failure (424)
 * - internal_error: Internal server error (500)
 * - rate_limit_exceeded: Rate limit exceeded (429)
 */
export type ErrorCode =
  | 'validation_error'
  | 'parse_error'
  | 'dependency_failure'
  | 'internal_error'
  | 'rate_limit_exceeded';

/**
 * Standardized error response format
 * 
 * @property error - Human-readable error message
 * @property error_code - Machine-readable error code
 * @property detail - Optional additional context or guidance
 * @property retry_after_ms - Optional retry delay in milliseconds (for 424 errors)
 * @property field_errors - Optional field-level validation errors
 */
export type ErrorResponse = {
  error: string;
  error_code: ErrorCode;
  detail?: string;
  retry_after_ms?: number;
  field_errors?: Array<{ field: string; message: string }>;
};

