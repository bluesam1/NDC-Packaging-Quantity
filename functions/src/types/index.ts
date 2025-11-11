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
 * Dosage form type
 */
export type DosageFormType = 'inhaler' | 'insulin' | 'liquid' | 'solid';

/**
 * Response payload from the compute API endpoint
 * 
 * @property rxnorm - Normalized RxNorm data
 * @property computed - Calculated quantities
 * @property ndc_selection - Chosen package and alternates
 * @property flags - Warnings and status flags
 * @property reasoning - Optional detailed reasoning data showing step-by-step logic
 */
export type ComputeResponse = {
  rxnorm: { rxcui: string; name: string };
  computed: { dose_unit: string; per_day: number; total_qty: number; days_supply: number };
  ndc_selection: {
    chosen?: { ndc: string; pkg_size: number; active: boolean; overfill: number; packs: number };
    alternates: { ndc: string; pkg_size: number; active: boolean; overfill: number; packs: number }[];
  };
  flags: { inactive_ndcs: string[]; mismatch: boolean; notes?: string[]; error_code?: string | null };
  reasoning?: {
    api_calls: {
      rxnorm?: { rxcui: string | null; name: string | null; ndcs: string[]; failed: boolean };
      fda?: { ndcs: NDCPackageData[]; failed: boolean; isDirectNDC: boolean };
      execution_time_ms: number;
    };
    sig_parsing: {
      original_sig: string;
      method: 'rules' | 'ai' | 'failed';
      sub_method?: 'time-based' | 'frequency-based'; // Sub-method for rules-based parsing
      parsed: { dose_unit: string; per_day: number; quantity_per_dose: number; frequency: number } | null;
      unit_conversion?: { from: string; to: string; original: number; converted: number };
    };
    dosage_form: {
      detected: DosageFormType;
      method: string;
      matched_keywords?: string[];
    };
    quantity_calculation: {
      base_calculation: { per_day: number; days_supply: number; total_qty: number };
      rounding: {
        applied: boolean;
        rule: string;
        before: number;
        after: number;
        details?: Record<string, unknown>;
      };
      final_qty: number;
    };
    package_selection: {
      total_qty: number;
      available_ndcs: { total: number; active: number; inactive: number };
      considered_options: number;
      scoring: {
        max_packs: number;
        max_overfill: number;
        preferred_ndcs?: string[];
      };
      chosen: {
        ndc: string;
        score: number;
        score_breakdown: {
          base_score: number;
          overfill_penalty?: number;
          pack_penalty?: number;
          preferred_boost?: number;
        };
        reason: string;
      } | null;
      alternates_count: number;
    };
  };
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

/**
 * NDC Package Data from FDA API
 * 
 * @property ndc - NDC code (11 digits)
 * @property pkg_size - Package size (number of units per package)
 * @property active - Active status (true if active, false if inactive)
 * @property dosage_form - Dosage form (e.g., "TABLET", "CAPSULE", "LIQUID")
 * @property brand_name - Brand name (optional)
 */
export type NDCPackageData = {
  ndc: string;
  pkg_size: number;
  active: boolean;
  dosage_form?: string;
  brand_name?: string;
  package_description?: string; // Store package description for pen/vial detection
};

