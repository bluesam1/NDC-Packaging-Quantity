/**
 * Form Validation Utilities
 * 
 * Client-side validation that matches backend validation rules.
 */

export interface ValidationError {
	field: string;
	message: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

/**
 * Validates NDC format (11 digits with optional hyphens)
 * Accepts formats: 00000-1111-22 or 00000111122
 */
const NDC_FORMAT_REGEX = /^(\d{5}-\d{4}-\d{2}|\d{11})$/;

/**
 * Normalizes NDC format (removes hyphens for consistency)
 */
export function normalizeNDC(ndc: string): string {
	return ndc.replace(/-/g, '');
}

/**
 * Validates if a string is a valid NDC format
 */
export function isValidNDCFormat(ndc: string): boolean {
	return NDC_FORMAT_REGEX.test(ndc);
}

/**
 * Validates drug_input field
 */
export function validateDrugInput(value: string): ValidationError | null {
	if (!value || value.trim().length === 0) {
		return { field: 'drug_input', message: 'Please enter a drug name or NDC' };
	}
	
	if (value.length < 2) {
		return { field: 'drug_input', message: 'Drug name or NDC must be at least 2 characters' };
	}
	
	if (value.length > 200) {
		return { field: 'drug_input', message: 'Drug name or NDC must be at most 200 characters' };
	}
	
	// If it looks like an NDC, validate the format
	const trimmed = value.trim();
	if (/^\d/.test(trimmed) && !isValidNDCFormat(trimmed)) {
		return { field: 'drug_input', message: 'NDC must be 11 digits in format 00000-1111-22 or 00000111122' };
	}
	
	return null;
}

/**
 * Validates sig field
 */
export function validateSig(value: string): ValidationError | null {
	if (!value || value.trim().length === 0) {
		return { field: 'sig', message: 'Please enter prescription directions' };
	}
	
	if (value.length < 3) {
		return { field: 'sig', message: 'Prescription directions must be at least 3 characters' };
	}
	
	if (value.length > 500) {
		return { field: 'sig', message: 'Prescription directions must be at most 500 characters' };
	}
	
	return null;
}

/**
 * Validates days_supply field
 */
export function validateDaysSupply(value: number | string): ValidationError | null {
	if (value === null || value === undefined || value === '') {
		return { field: 'days_supply', message: 'Please enter a days supply' };
	}
	
	const num = typeof value === 'string' ? parseInt(value, 10) : value;
	
	if (isNaN(num)) {
		return { field: 'days_supply', message: 'Days supply must be a valid number' };
	}
	
	if (!Number.isInteger(num)) {
		return { field: 'days_supply', message: 'Days supply must be a whole number' };
	}
	
	if (num < 1) {
		return { field: 'days_supply', message: 'Days supply must be at least 1' };
	}
	
	if (num > 365) {
		return { field: 'days_supply', message: 'Days supply must be at most 365' };
	}
	
	return null;
}

/**
 * Validates preferred_ndcs array
 */
export function validatePreferredNDCs(ndcs: string[]): ValidationError | null {
	if (!ndcs || ndcs.length === 0) {
		return null; // Optional field
	}
	
	if (ndcs.length > 10) {
		return { field: 'preferred_ndcs', message: 'You can specify at most 10 preferred NDCs' };
	}
	
	for (let i = 0; i < ndcs.length; i++) {
		const ndc = ndcs[i].trim();
		if (!isValidNDCFormat(ndc)) {
			return { 
				field: 'preferred_ndcs', 
				message: `NDC at position ${i + 1} must be 11 digits in format 00000-1111-22 or 00000111122` 
			};
		}
	}
	
	return null;
}

/**
 * Validates quantity_unit_override
 */
export function validateQuantityUnitOverride(value: string): ValidationError | null {
	if (!value || value.trim().length === 0) {
		return null; // Optional field
	}
	
	const validUnits = ['tab', 'cap', 'mL', 'actuation', 'unit'];
	if (!validUnits.includes(value)) {
		return { 
			field: 'quantity_unit_override', 
			message: `Unit must be one of: ${validUnits.join(', ')}` 
		};
	}
	
	return null;
}

/**
 * Validates max_overfill
 */
export function validateMaxOverfill(value: number | string): ValidationError | null {
	if (value === null || value === undefined || value === '') {
		return null; // Optional field, will use default
	}
	
	const num = typeof value === 'string' ? parseFloat(value) : value;
	
	if (isNaN(num)) {
		return { field: 'max_overfill', message: 'Max overfill must be a valid number' };
	}
	
	if (num < 0) {
		return { field: 'max_overfill', message: 'Max overfill must be at least 0' };
	}
	
	if (num > 100) {
		return { field: 'max_overfill', message: 'Max overfill must be at most 100' };
	}
	
	return null;
}

/**
 * Parses comma-separated NDC string into array
 */
export function parseNDCString(ndcString: string): string[] {
	if (!ndcString || ndcString.trim().length === 0) {
		return [];
	}
	
	return ndcString
		.split(',')
		.map(ndc => ndc.trim())
		.filter(ndc => ndc.length > 0);
}





