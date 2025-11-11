/**
 * Results Store
 * 
 * Global state management for API results, loading, and error states.
 */

import { writable, derived } from 'svelte/store';
import type { ComputeResponse, ErrorResponse } from '$lib/types/api';
import type { ApiError } from '$lib/services/api';

export interface ResultsState {
	results: ComputeResponse | null;
	loading: boolean;
	error: {
		message: string;
		code?: string;
		retryAfterMs?: number;
	} | null;
}

// Create writable stores
const results = writable<ComputeResponse | null>(null);
const loading = writable<boolean>(false);
const error = writable<ResultsState['error']>(null);

/**
 * Set results data
 */
export function setResults(data: ComputeResponse | null): void {
	results.set(data);
}

/**
 * Set loading state
 */
export function setLoading(value: boolean): void {
	loading.set(value);
}

/**
 * Set error state
 */
export function setError(errorData: ResultsState['error']): void {
	error.set(errorData);
}

/**
 * Clear all state
 */
export function clearResults(): void {
	results.set(null);
	loading.set(false);
	error.set(null);
}

/**
 * Set error from ApiError
 */
export function setErrorFromApi(apiError: ApiError): void {
	setError({
		message: apiError.detail || apiError.message,
		code: apiError.errorCode,
		retryAfterMs: apiError.retryAfterMs,
	});
}

// Derived stores
export const hasResults = derived(results, ($results) => $results !== null);
export const hasError = derived(error, ($error) => $error !== null);

// Export stores for subscription
export { results, loading, error };




