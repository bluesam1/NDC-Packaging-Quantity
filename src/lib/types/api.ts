/**
 * API Type Definitions
 * 
 * Shared types for API requests and responses.
 * These match the backend types in functions/src/types/index.ts
 */

/**
 * Request payload for the compute API endpoint
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
 */
export type ComputeResponse = {
	rxnorm: { rxcui: string; name: string };
	computed: { dose_unit: string; per_day: number; total_qty: number; days_supply: number };
	ndc_selection: {
		chosen?: {
			ndc: string;
			pkg_size: number;
			active: boolean;
			overfill: number;
			packs: number;
		};
		alternates: Array<{
			ndc: string;
			pkg_size: number;
			active: boolean;
			overfill: number;
			packs: number;
		}>;
	};
	flags: {
		inactive_ndcs: string[];
		mismatch: boolean;
		notes?: string[];
		error_code?: string | null;
	};
};

/**
 * Error code union type
 */
export type ErrorCode =
	| 'validation_error'
	| 'parse_error'
	| 'dependency_failure'
	| 'internal_error'
	| 'rate_limit_exceeded';

/**
 * Standardized error response format
 */
export type ErrorResponse = {
	error: string;
	error_code: ErrorCode;
	detail?: string;
	retry_after_ms?: number;
	field_errors?: Array<{ field: string; message: string }>;
};




