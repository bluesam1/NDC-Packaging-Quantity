/**
 * API Client Service
 * 
 * Handles communication with the backend Cloud Function API.
 */

import type { ComputeRequest, ComputeResponse, ErrorResponse, ErrorCode } from '$lib/types/api';

const REQUEST_TIMEOUT_MS = 10000; // 10 seconds
const OCR_REQUEST_TIMEOUT_MS = 60000; // 60 seconds for OCR (image processing can take longer)
const MAX_RETRIES = 1;

/**
 * Custom API Error class
 */
export class ApiError extends Error {
	constructor(
		public statusCode: number,
		public errorCode: ErrorCode,
		public detail?: string,
		public retryAfterMs?: number,
		public fieldErrors?: Array<{ field: string; message: string }>
	) {
		super(detail || 'An error occurred');
		this.name = 'ApiError';
	}
}

/**
 * Get API base URL from environment variable
 */
function getApiUrl(): string {
	// In production builds, ALWAYS use relative URLs regardless of VITE_API_URL
	// This ensures Firebase Hosting rewrites work correctly
	// Vite sets MODE to 'production' during build, and DEV is false in production builds
	const isProduction = import.meta.env.MODE === 'production' || import.meta.env.PROD || !import.meta.env.DEV;
	
	if (isProduction) {
		// Production: Use relative URLs (Firebase Hosting rewrites handle routing)
		// Ignore VITE_API_URL even if set, to prevent localhost from being baked into the build
		return '';
	}
	
	// Development: Check for explicit VITE_API_URL first
	const apiUrl = import.meta.env.VITE_API_URL;
	if (apiUrl) {
		return apiUrl;
	}
	
	// Default to local development if no URL is set
	const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ndc-calculator';
	return `http://localhost:5001/${projectId}/us-central1`;
}

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
	validation_error: 'Please check your input and try again.',
	parse_error: 'Unable to parse prescription directions. Please verify the SIG.',
	dependency_failure: 'External service unavailable. Please try again.',
	internal_error: 'An error occurred. Please try again later.',
	rate_limit_exceeded: 'Too many requests. Please wait a moment.',
};

/**
 * Parse error response from API
 */
async function parseErrorResponse(response: Response): Promise<ErrorResponse> {
	try {
		const data = await response.json();
		return data as ErrorResponse;
	} catch {
		// If response is not JSON, create a generic error
		return {
			error: response.statusText || 'An error occurred',
			error_code: response.status >= 500 ? 'internal_error' : 'validation_error',
		};
	}
}

/**
 * Create AbortController with timeout
 */
function createTimeoutController(): { controller: AbortController; timeoutId: NodeJS.Timeout } {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	return { controller, timeoutId };
}

/**
 * Compute quantity using the API
 * 
 * @param request - Compute request payload
 * @param retryCount - Current retry attempt (internal use)
 * @returns Promise resolving to ComputeResponse
 * @throws ApiError if request fails
 */
export async function computeQuantity(
	request: ComputeRequest,
	retryCount = 0
): Promise<ComputeResponse> {
	const apiUrl = getApiUrl();
	// In emulator, functions are directly accessible without /api/v1 prefix
	// Check if we're using the functions emulator (port 5001) vs hosting emulator (port 5000)
	const isFunctionsEmulator = apiUrl.includes(':5001');
	// Construct endpoint: if apiUrl is empty (production), use relative path
	// Otherwise, prepend the apiUrl
	const endpoint = isFunctionsEmulator 
		? `${apiUrl}/compute` 
		: apiUrl 
			? `${apiUrl}/api/v1/compute`
			: `/api/v1/compute`;
	
	const { controller, timeoutId } = createTimeoutController();
	
	try {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(request),
			signal: controller.signal,
		});
		
		// Clear timeout if request completes successfully
		clearTimeout(timeoutId);
		
		if (!response.ok) {
			const errorResponse = await parseErrorResponse(response);
			
			// Retry on dependency_failure (424) if we haven't exceeded max retries
			if (
				errorResponse.error_code === 'dependency_failure' &&
				retryCount < MAX_RETRIES
			) {
				const retryAfter = errorResponse.retry_after_ms || 1000;
				await new Promise((resolve) => setTimeout(resolve, retryAfter));
				return computeQuantity(request, retryCount + 1);
			}
			
			throw new ApiError(
				response.status,
				errorResponse.error_code,
				errorResponse.detail || errorResponse.error,
				errorResponse.retry_after_ms,
				errorResponse.field_errors
			);
		}
		
		const data = await response.json();
		return data as ComputeResponse;
	} catch (error) {
		// Clear timeout on error
		clearTimeout(timeoutId);
		if (error instanceof ApiError) {
			throw error;
		}
		
		if (error instanceof Error && error.name === 'AbortError') {
			throw new ApiError(
				408,
				'internal_error',
				'Request timed out. Please try again.',
				undefined
			);
		}
		
		if (error instanceof TypeError && error.message.includes('fetch')) {
			throw new ApiError(
				0,
				'dependency_failure',
				'Network error. Please check your connection and try again.',
				undefined
			);
		}
		
		throw new ApiError(
			500,
			'internal_error',
			error instanceof Error ? error.message : 'An unexpected error occurred',
			undefined
		);
	}
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: ApiError): string {
	return ERROR_MESSAGES[error.errorCode] || error.detail || error.message;
}

/**
 * Extract prescription data from image using OCR
 * 
 * @param imageFile - Image file to extract data from
 * @returns Promise resolving to extracted prescription data with field detection metadata
 * @throws ApiError if request fails
 */
export async function extractPrescriptionFromImage(
	imageFile: File
): Promise<{
	data: Partial<ComputeRequest>;
	fields_found: string[];
}> {
	const apiUrl = getApiUrl();
	const isFunctionsEmulator = apiUrl.includes(':5001');
	// Construct endpoint: if apiUrl is empty (production), use relative path
	// Otherwise, prepend the apiUrl
	const endpoint = isFunctionsEmulator 
		? `${apiUrl}/extractPrescription` 
		: apiUrl 
			? `${apiUrl}/api/v1/extract-prescription`
			: `/api/v1/extract-prescription`;
	
	// Use longer timeout for OCR requests
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), OCR_REQUEST_TIMEOUT_MS);
	
	try {
		// Convert file to base64
		const base64 = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				resolve(result);
			};
			reader.onerror = reject;
			reader.readAsDataURL(imageFile);
		});

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ image: base64 }),
			signal: controller.signal,
		});
		
		clearTimeout(timeoutId);
		
		if (!response.ok) {
			const errorResponse = await parseErrorResponse(response);
			
			throw new ApiError(
				response.status,
				errorResponse.error_code,
				errorResponse.detail || errorResponse.error,
				errorResponse.retry_after_ms,
				errorResponse.field_errors
			);
		}
		
		const data = await response.json();
		return data as {
			data: Partial<ComputeRequest>;
			fields_found: string[];
		};
	} catch (error) {
		clearTimeout(timeoutId);
		if (error instanceof ApiError) {
			throw error;
		}
		
		if (error instanceof Error && error.name === 'AbortError') {
			throw new ApiError(
				408,
				'internal_error',
				'Request timed out. Please try again.',
				undefined
			);
		}
		
		if (error instanceof TypeError && error.message.includes('fetch')) {
			throw new ApiError(
				0,
				'dependency_failure',
				'Network error. Please check your connection and try again.',
				undefined
			);
		}
		
		throw new ApiError(
			500,
			'internal_error',
			error instanceof Error ? error.message : 'An unexpected error occurred',
			undefined
		);
	}
}

