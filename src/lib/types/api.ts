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
 * Dosage form type
 */
export type DosageFormType = 'inhaler' | 'insulin' | 'liquid' | 'solid';

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
	reasoning?: {
		api_calls: {
			rxnorm?: { rxcui: string | null; name: string | null; ndcs: string[]; failed: boolean };
			fda?: { ndcs: Array<{ ndc: string; pkg_size: number; active: boolean; dosage_form?: string; brand_name?: string }>; failed: boolean; isDirectNDC: boolean };
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





