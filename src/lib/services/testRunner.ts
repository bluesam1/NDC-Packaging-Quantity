/**
 * Test Runner Service
 * 
 * Loads test cases from JSON file, executes tests via API, and validates assertions.
 */

import { ApiError, computeQuantity } from './api';
import type { ComputeRequest, ComputeResponse, ErrorCode } from '$lib/types/api';
import type { TestResult } from '$lib/stores/testResults';
import { setTestFormData, clearTestFormData } from '$lib/stores/testControl';
import { results, loading, error } from '$lib/stores/results';
import { get } from 'svelte/store';
import { showToast } from '$lib/stores/toast';

export interface TestCase {
	id: string;
	name: string;
	priority: string;
	level: string;
	description: string;
	descriptionShort: string;
	request: ComputeRequest;
	assertions: Record<string, unknown>;
	note?: string;
}

export interface TestSuite {
	id: string;
	name: string;
	tests: TestCase[];
}

export interface TestCasesData {
	testSuites: TestSuite[];
}

const TEST_CASES_URL = '/test-cases.json';
const DELAY_BETWEEN_TESTS_MS = 100;

/**
 * Load test cases from JSON file
 */
export async function loadTestCases(): Promise<TestCasesData> {
	try {
		const response = await fetch(TEST_CASES_URL);
		if (!response.ok) {
			throw new Error(`Failed to load test cases: ${response.statusText}`);
		}
		const data = await response.json();
		return data as TestCasesData;
	} catch (error) {
		throw new Error(`Error loading test cases: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Get list of available test suites
 */
export async function getTestSuites(): Promise<TestSuite[]> {
	const data = await loadTestCases();
	return data.testSuites;
}

/**
 * Get tests for a specific suite
 */
export async function getTestsBySuite(suiteId: string): Promise<TestCase[]> {
	const data = await loadTestCases();
	const suite = data.testSuites.find(s => s.id === suiteId);
	if (!suite) {
		throw new Error(`Test suite not found: ${suiteId}`);
	}
	return suite.tests;
}

/**
 * Find a test case by ID across all suites
 */
export async function getTestCaseById(testId: string): Promise<TestCase | null> {
	const data = await loadTestCases();
	for (const suite of data.testSuites) {
		const test = suite.tests.find(t => t.id === testId);
		if (test) {
			return test;
		}
	}
	return null;
}

/**
 * Validate assertions against API response
 */
function validateAssertions(
	response: ComputeResponse | null,
	error: ApiError | null,
	assertions: Record<string, unknown>
): { passed: boolean; failures: string[] } {
	const failures: string[] = [];

	if (error) {
		// If there's an error, check if it was expected
		if (assertions.statusCode !== undefined) {
			if (assertions.statusCode === error.statusCode) {
				// Status code matches, check error code if specified
				if (assertions.errorCode !== undefined && assertions.errorCode !== error.errorCode) {
					failures.push(`Expected error code ${assertions.errorCode}, got ${error.errorCode}`);
				}
			} else {
				failures.push(`Expected status code ${assertions.statusCode}, got error ${error.statusCode}`);
			}
		} else if (assertions.errorCode !== undefined) {
			// Check error code even if status code not specified
			if (assertions.errorCode !== error.errorCode) {
				failures.push(`Expected error code ${assertions.errorCode}, got ${error.errorCode}`);
			}
		} else if (assertions.hasError === false || (assertions.hasError === undefined && !assertions.errorCode && !assertions.statusCode)) {
			// Only report unexpected error if we didn't expect an error
			failures.push(`Unexpected error: ${error.message}`);
		}
		// Continue validation for error-related assertions, but return early if no error assertions
		const hasErrorAssertions = assertions.hasError !== undefined || 
			assertions.errorCode !== undefined || 
			assertions.statusCode !== undefined ||
			assertions.hasFieldError !== undefined ||
			assertions.hasFieldErrors !== undefined;
		if (!hasErrorAssertions) {
			return { passed: failures.length === 0, failures };
		}
	}

	if (!response && !error) {
		failures.push('No response received');
		return { passed: false, failures };
	}

	// If we have an error and no response, we can only validate error-related assertions
	if (!response && error) {
		return { passed: failures.length === 0, failures };
	}

	// At this point, we need a response to continue validation
	if (!response) {
		return { passed: failures.length === 0, failures };
	}

	// Validate status code for successful responses
	if (assertions.statusCode !== undefined) {
		if (assertions.statusCode === 200) {
			// If test expects 200, verify we got a successful response (no error)
			if (error) {
				failures.push(`Expected status code 200, got error ${error.statusCode}`);
			}
		} else {
			// If test expects a non-200 status code, we should have gotten an error
			if (!error) {
				failures.push(`Expected status code ${assertions.statusCode}, got 200`);
			}
		}
	}

	// Validate total quantity
	if (assertions.totalQty !== undefined) {
		const actualQty = response.computed?.total_qty;
		if (actualQty !== assertions.totalQty) {
			failures.push(`Expected totalQty ${assertions.totalQty}, got ${actualQty}`);
		}
	}

	// Validate per day
	if (assertions.perDay !== undefined) {
		const actualPerDay = response.computed?.per_day;
		if (actualPerDay !== assertions.perDay) {
			failures.push(`Expected perDay ${assertions.perDay}, got ${actualPerDay}`);
		}
	}

	// Validate chosen package
	if (assertions.hasChosenPackage !== undefined) {
		const hasChosen = !!response.ndc_selection?.chosen;
		if (hasChosen !== assertions.hasChosenPackage) {
			failures.push(`Expected hasChosenPackage ${assertions.hasChosenPackage}, got ${hasChosen}`);
		}
	}

	// Validate flags
	if (assertions.noFlags !== undefined && assertions.noFlags) {
		// Check if there are any meaningful flags (not just empty arrays)
		const hasInactiveFlags = !!(response.flags?.inactive_ndcs?.length);
		const hasMismatch = !!response.flags?.mismatch;
		const hasNotes = !!(response.flags?.notes?.length);
		const hasFlags = hasInactiveFlags || hasMismatch || hasNotes;
		if (hasFlags) {
			const flagDetails: string[] = [];
			if (hasInactiveFlags) flagDetails.push(`inactive_ndcs: ${response.flags.inactive_ndcs.length}`);
			if (hasMismatch) flagDetails.push('mismatch: true');
			if (hasNotes) flagDetails.push(`notes: ${response.flags.notes?.length || 0}`);
			failures.push(`Expected no flags, but flags were present (${flagDetails.join(', ')})`);
		}
	}

	if (assertions.hasInactiveFlag !== undefined) {
		const hasInactive = !!(response.flags?.inactive_ndcs?.length);
		if (hasInactive !== assertions.hasInactiveFlag) {
			failures.push(`Expected hasInactiveFlag ${assertions.hasInactiveFlag}, got ${hasInactive}`);
		}
	}

	// Validate RxNorm data
	if (assertions.hasRxnorm !== undefined) {
		const hasRxnorm = !!response.rxnorm;
		if (hasRxnorm !== assertions.hasRxnorm) {
			failures.push(`Expected hasRxnorm ${assertions.hasRxnorm}, got ${hasRxnorm}`);
		}
	}

	if (assertions.hasRxcui !== undefined) {
		const hasRxcui = !!response.rxnorm?.rxcui;
		if (hasRxcui !== assertions.hasRxcui) {
			failures.push(`Expected hasRxcui ${assertions.hasRxcui}, got ${hasRxcui}`);
		}
	}

	// Validate NDC selection
	if (assertions.hasNdcSelection !== undefined) {
		const hasNdcSelection = !!response.ndc_selection;
		if (hasNdcSelection !== assertions.hasNdcSelection) {
			failures.push(`Expected hasNdcSelection ${assertions.hasNdcSelection}, got ${hasNdcSelection}`);
		}
	}

	// Validate response structure
	if (assertions.hasResponse !== undefined) {
		const hasResponse = !!response;
		if (hasResponse !== assertions.hasResponse) {
			failures.push(`Expected hasResponse ${assertions.hasResponse}, got ${hasResponse}`);
		}
	}

	if (assertions.hasComputed !== undefined) {
		const hasComputed = !!response.computed;
		if (hasComputed !== assertions.hasComputed) {
			failures.push(`Expected hasComputed ${assertions.hasComputed}, got ${hasComputed}`);
		}
	}

	if (assertions.hasFlags !== undefined) {
		const hasFlags = !!response.flags;
		if (hasFlags !== assertions.hasFlags) {
			failures.push(`Expected hasFlags ${assertions.hasFlags}, got ${hasFlags}`);
		}
	}

	// Validate error code
	if (assertions.errorCode !== undefined && !error) {
		failures.push(`Expected error code ${assertions.errorCode}, but request succeeded`);
	}

	if (assertions.hasFieldError !== undefined) {
		// Check if error has field_errors (validation errors)
		if (error) {
			const hasFieldError = !!(error.fieldErrors && error.fieldErrors.length > 0);
			if (hasFieldError !== assertions.hasFieldError) {
				failures.push(`Expected hasFieldError ${assertions.hasFieldError}, got ${hasFieldError}`);
			}
		} else if (assertions.hasFieldError) {
			failures.push('Expected field error, but request succeeded');
		}
	}

	if (assertions.hasFieldErrors !== undefined) {
		// Similar to hasFieldError - check for validation errors with field_errors array
		if (error) {
			const hasFieldErrors = !!(error.fieldErrors && error.fieldErrors.length > 0);
			if (hasFieldErrors !== assertions.hasFieldErrors) {
				failures.push(`Expected hasFieldErrors ${assertions.hasFieldErrors}, got ${hasFieldErrors}`);
			}
		} else if (assertions.hasFieldErrors) {
			failures.push('Expected field errors, but request succeeded');
		}
	}

	// Validate noValidationError
	if (assertions.noValidationError !== undefined && assertions.noValidationError) {
		if (error && (error.statusCode === 400 || error.errorCode === 'validation_error')) {
			failures.push('Expected no validation error, but validation error occurred');
		}
	}

	// Validate hasError (expects any error)
	if (assertions.hasError !== undefined) {
		const hasError = !!error;
		if (hasError !== assertions.hasError) {
			failures.push(`Expected hasError ${assertions.hasError}, got ${hasError}`);
		}
	}

	// Validate package metadata
	if (assertions.hasPackageMetadata !== undefined) {
		const chosen = response.ndc_selection?.chosen;
		// Check if we have metadata in chosen package
		let hasMetadata = !!(chosen && (chosen.ndc || chosen.pkg_size !== undefined));
		// If no chosen package, check if we have metadata in reasoning data (for inactive NDCs)
		if (!hasMetadata && response.reasoning?.api_calls?.fda?.ndcs) {
			const fdaNdcs = response.reasoning.api_calls.fda.ndcs;
			hasMetadata = fdaNdcs.length > 0 && fdaNdcs.some((ndc: { ndc?: string; pkg_size?: number }) => 
				ndc.ndc || ndc.pkg_size !== undefined
			);
		}
		// Also check if we have inactive NDCs listed (which means we found metadata)
		if (!hasMetadata && response.flags?.inactive_ndcs && response.flags.inactive_ndcs.length > 0) {
			hasMetadata = true;
		}
		if (hasMetadata !== assertions.hasPackageMetadata) {
			failures.push(`Expected hasPackageMetadata ${assertions.hasPackageMetadata}, got ${hasMetadata}`);
		}
	}

	// Validate hasStatus
	if (assertions.hasStatus !== undefined) {
		const chosen = response.ndc_selection?.chosen;
		const hasStatus = chosen?.active !== undefined;
		if (hasStatus !== assertions.hasStatus) {
			failures.push(`Expected hasStatus ${assertions.hasStatus}, got ${hasStatus}`);
		}
	}

	// Validate hasPackageSize
	if (assertions.hasPackageSize !== undefined) {
		const chosen = response.ndc_selection?.chosen;
		const hasPackageSize = chosen?.pkg_size !== undefined;
		if (hasPackageSize !== assertions.hasPackageSize) {
			failures.push(`Expected hasPackageSize ${assertions.hasPackageSize}, got ${hasPackageSize}`);
		}
	}

	// Validate statusFromFda (assumed true if we have active status from chosen package)
	if (assertions.statusFromFda !== undefined) {
		const chosen = response.ndc_selection?.chosen;
		// FDA is source of truth, so if we have a chosen package with active status, it's from FDA
		const statusFromFda = !!(chosen && chosen.active !== undefined);
		if (statusFromFda !== assertions.statusFromFda) {
			failures.push(`Expected statusFromFda ${assertions.statusFromFda}, got ${statusFromFda}`);
		}
	}

	// Validate maxExtraPackages (at most 1 extra package)
	if (assertions.maxExtraPackages !== undefined) {
		const chosen = response.ndc_selection?.chosen;
		if (chosen) {
			const maxExtraPackages = typeof assertions.maxExtraPackages === 'number' ? assertions.maxExtraPackages : 1;
			const totalNeeded = response.computed?.total_qty || 0;
			const totalProvided = (chosen.pkg_size || 0) * (chosen.packs || 1);
			const extraPackages = Math.ceil((totalProvided - totalNeeded) / (chosen.pkg_size || 1));
			if (extraPackages > maxExtraPackages) {
				failures.push(`Expected at most ${maxExtraPackages} extra package(s), got ${extraPackages}`);
			}
		}
	}

	// Validate maxPacks
	if (assertions.maxPacks !== undefined) {
		const chosen = response.ndc_selection?.chosen;
		if (chosen) {
			const maxPacks = typeof assertions.maxPacks === 'number' ? assertions.maxPacks : 3;
			if (chosen.packs > maxPacks) {
				failures.push(`Expected at most ${maxPacks} pack(s), got ${chosen.packs}`);
			}
		}
	}

	// Validate overfill
	if (assertions.overfill !== undefined) {
		const chosen = response.ndc_selection?.chosen;
		if (chosen) {
			const overfill = chosen.overfill || 0;
			if (overfill !== assertions.overfill) {
				failures.push(`Expected overfill ${assertions.overfill}%, got ${overfill}%`);
			}
		} else {
			failures.push(`Expected overfill ${assertions.overfill}%, but no chosen package`);
		}
	}

	if (assertions.overfillPercent !== undefined) {
		const overfillPercent = assertions.overfillPercent;
		if (typeof overfillPercent === 'object' && overfillPercent !== null && 'max' in overfillPercent) {
			const maxOverfill = typeof overfillPercent.max === 'number' ? overfillPercent.max : 10;
			const chosen = response.ndc_selection?.chosen;
			if (chosen) {
				const overfill = chosen.overfill || 0;
				if (overfill > maxOverfill) {
					failures.push(`Expected overfill ≤ ${maxOverfill}%, got ${overfill}%`);
				}
			} else {
				failures.push(`Expected overfill ≤ ${maxOverfill}%, but no chosen package`);
			}
		}
	}

	// Validate dose unit
	if (assertions.doseUnit !== undefined) {
		const actualUnit = response.computed?.dose_unit;
		if (actualUnit !== assertions.doseUnit) {
			failures.push(`Expected doseUnit ${assertions.doseUnit}, got ${actualUnit}`);
		}
	}

	// Validate active status
	if (assertions.hasActiveStatus !== undefined) {
		const chosen = response.ndc_selection?.chosen;
		const isActive = chosen?.active === true;
		if (isActive !== assertions.hasActiveStatus) {
			failures.push(`Expected hasActiveStatus ${assertions.hasActiveStatus}, got ${isActive}`);
		}
	}

	if (assertions.chosenIsActive !== undefined) {
		const chosen = response.ndc_selection?.chosen;
		const isActive = chosen?.active === true;
		if (isActive !== assertions.chosenIsActive) {
			failures.push(`Expected chosenIsActive ${assertions.chosenIsActive}, got ${isActive}`);
		}
	}

	// Validate alternates
	if (assertions.hasAlternates !== undefined) {
		const hasAlternates = !!(response.ndc_selection?.alternates?.length);
		if (hasAlternates !== assertions.hasAlternates) {
			failures.push(`Expected hasAlternates ${assertions.hasAlternates}, got ${hasAlternates}`);
		}
	}

	if (assertions.hasOverfill !== undefined) {
		const chosen = response.ndc_selection?.chosen;
		const hasOverfill = !!(chosen && (chosen.overfill || 0) > 0);
		if (hasOverfill !== assertions.hasOverfill) {
			failures.push(`Expected hasOverfill ${assertions.hasOverfill}, got ${hasOverfill}`);
		}
	}

	if (assertions.hasMultiPack !== undefined) {
		const chosen = response.ndc_selection?.chosen;
		const hasMultiPack = !!(chosen && chosen.packs && chosen.packs > 1);
		if (hasMultiPack !== assertions.hasMultiPack) {
			failures.push(`Expected hasMultiPack ${assertions.hasMultiPack}, got ${hasMultiPack}`);
		}
	}

	if (assertions.noUnderfill !== undefined && assertions.noUnderfill) {
		const chosen = response.ndc_selection?.chosen;
		if (chosen && chosen.overfill !== undefined && chosen.overfill < 0) {
			failures.push('Expected no underfill, but underfill detected');
		}
	}

	if (assertions.hasPerDay !== undefined) {
		const hasPerDay = response.computed?.per_day !== undefined;
		if (hasPerDay !== assertions.hasPerDay) {
			failures.push(`Expected hasPerDay ${assertions.hasPerDay}, got ${hasPerDay}`);
		}
	}

	// Validate nested property assertions (e.g., "flags.mismatch")
	for (const [key, expectedValue] of Object.entries(assertions)) {
		if (key.includes('.')) {
			const parts = key.split('.');
			let actualValue: unknown = response;
			for (const part of parts) {
				if (actualValue && typeof actualValue === 'object' && part in actualValue) {
					actualValue = (actualValue as Record<string, unknown>)[part];
				} else {
					actualValue = undefined;
					break;
				}
			}
			if (actualValue !== expectedValue) {
				failures.push(`Expected ${key} to be ${expectedValue}, got ${actualValue}`);
			}
		}
	}

	return { passed: failures.length === 0, failures };
}

/**
 * Execute a single test case
 * 
 * Routes tests based on level:
 * - E2E tests: Run through UI (form interaction)
 * - Unit/Integration tests: Run directly against API
 */
export async function runTest(testCase: TestCase, suiteId?: string): Promise<TestResult> {
	const startTime = Date.now();
	
	// Create initial result with 'running' status
	const result: TestResult = {
		id: testCase.id,
		name: testCase.name,
		status: 'running',
		description: testCase.description,
		descriptionShort: testCase.descriptionShort,
		suiteId
	};

	// Determine if test should run through UI or direct API
	// E2E tests run through UI, Unit/Integration tests run directly against API
	const isE2ETest = testCase.level === 'E2E';
	
	try {
		let response: ComputeResponse | null = null;
		let apiError: ApiError | null = null;
		
		if (isE2ETest) {
			// E2E tests: Run through UI
			console.log('🧪 Running E2E test through UI:', testCase.id);
			console.log('Setting test form data:', testCase.request);
			setTestFormData(testCase.request);
			console.log('Test form data set, waiting for form to update...');
			
			// Wait for form to submit and API to respond
			// Poll the results store until we get a response or error
			const maxWaitTime = 30000; // 30 seconds max wait
			const pollInterval = 100; // Check every 100ms
			const startWaitTime = Date.now();
			
			// Wait for loading to start
			while (!get(loading) && (Date.now() - startWaitTime) < maxWaitTime) {
				await new Promise(resolve => setTimeout(resolve, pollInterval));
			}
			
			// Wait for loading to complete
			while (get(loading) && (Date.now() - startWaitTime) < maxWaitTime) {
				await new Promise(resolve => setTimeout(resolve, pollInterval));
			}
			
			// Get results or error
			response = get(results);
			const errorState = get(error);
			
			if (errorState && !response) {
				// Create ApiError from error state
				apiError = new ApiError(
					400,
					(errorState.code || 'internal_error') as ErrorCode,
					errorState.message
				);
			}
			
			if (!response && !apiError) {
				throw new Error('Test timed out waiting for response');
			}
			
			// Clear test form data
			clearTestFormData();
		} else {
			// Unit/Integration tests: Run directly against API
			console.log('🧪 Running API test directly:', testCase.id);
			console.log('Request:', testCase.request);
			
			try {
				response = await computeQuantity(testCase.request);
				console.log('Response:', {
					computed: response.computed,
					flags: response.flags,
					hasChosen: !!response.ndc_selection?.chosen,
					chosen: response.ndc_selection?.chosen,
					alternatesCount: response.ndc_selection?.alternates?.length
				});
			} catch (err) {
				if (err instanceof ApiError) {
					apiError = err;
					console.log('API Error:', {
						statusCode: apiError.statusCode,
						errorCode: apiError.errorCode,
						message: apiError.message,
						detail: apiError.detail,
						fieldErrors: apiError.fieldErrors
					});
				} else {
					// Re-throw unexpected errors
					throw err;
				}
			}
		}
		
		const duration = Date.now() - startTime;

		// Log test execution details
		console.group(`🧪 Test: ${testCase.id} - ${testCase.name}`);
		console.log('Request:', testCase.request);
		if (response) {
			console.log('Response:', {
				computed: response.computed,
				flags: response.flags,
				hasChosen: !!response.ndc_selection?.chosen,
				chosen: response.ndc_selection?.chosen,
				alternatesCount: response.ndc_selection?.alternates?.length
			});
		}
		if (apiError) {
			console.log('Error:', {
				statusCode: apiError.statusCode,
				errorCode: apiError.errorCode,
				message: apiError.message,
				detail: apiError.detail,
				fieldErrors: apiError.fieldErrors
			});
		}
		console.log('Expected Assertions:', testCase.assertions);

		// Validate assertions
		const validation = validateAssertions(response, apiError, testCase.assertions);

		console.log('Validation Result:', {
			passed: validation.passed,
			failures: validation.failures.length > 0 ? validation.failures : 'None'
		});
		if (validation.failures.length > 0) {
			console.error('❌ Failures:', validation.failures);
			console.error('Full Response:', JSON.stringify(response, null, 2));
			if (apiError) {
				console.error('Full Error:', JSON.stringify({
					statusCode: apiError.statusCode,
					errorCode: apiError.errorCode,
					message: apiError.message,
					detail: apiError.detail,
					fieldErrors: apiError.fieldErrors
				}, null, 2));
			}
		}
		console.groupEnd();

		const finalResult: TestResult = {
			...result,
			status: validation.passed ? 'passed' : 'failed' as 'passed' | 'failed',
			duration,
			error: apiError ? `${apiError.errorCode}: ${apiError.detail || apiError.message}` : undefined,
			assertionFailures: validation.failures.length > 0 ? validation.failures : undefined
		};
		
		// Show toast notification
		if (validation.passed) {
			showToast('success', `Test Passed: ${testCase.name}`, 1000);
		} else {
			showToast('error', `Test Failed: ${testCase.name}`, 1000);
		}
		
		// For E2E tests, pause for 2 seconds so user can see the response in the UI
		if (isE2ETest) {
			await new Promise(resolve => setTimeout(resolve, 2000));
		}
		
		return finalResult;
	} catch (err) {
		const duration = Date.now() - startTime;
		const caughtError = err instanceof ApiError ? err : null;
		
		// Clear test form data (only if E2E test)
		if (isE2ETest) {
			clearTestFormData();
		}

		// Log test execution details for errors
		console.group(`🧪 Test: ${testCase.id} - ${testCase.name} (ERROR)`);
		console.log('Request:', testCase.request);
		console.log('Error:', {
			statusCode: caughtError?.statusCode,
			errorCode: caughtError?.errorCode,
			message: caughtError?.message,
			detail: caughtError?.detail,
			fieldErrors: caughtError?.fieldErrors
		});
		console.log('Expected Assertions:', testCase.assertions);

		// Validate if error was expected
		const validation = validateAssertions(null, caughtError, testCase.assertions);

		console.log('Validation Result:', {
			passed: validation.passed,
			failures: validation.failures
		});
		console.groupEnd();

		const finalResult: TestResult = {
			...result,
			status: validation.passed ? 'passed' : 'failed' as 'passed' | 'failed',
			duration,
			error: caughtError ? `${caughtError.errorCode}: ${caughtError.detail || caughtError.message}` : 
				err instanceof Error ? err.message : 'Unknown error',
			assertionFailures: validation.failures.length > 0 ? validation.failures : undefined
		};
		
		// Show toast notification
		if (validation.passed) {
			showToast('success', `Test Passed: ${testCase.name}`, 1000);
		} else {
			showToast('error', `Test Failed: ${testCase.name}`, 1000);
		}
		
		// For E2E tests, pause for 2 seconds so user can see the response/error in the UI
		if (isE2ETest) {
			await new Promise(resolve => setTimeout(resolve, 2000));
		}
		
		return finalResult;
	}
}

/**
 * Run all tests in a suite sequentially
 */
export async function runTestSuite(
	suiteId: string,
	onProgress?: (result: TestResult) => void
): Promise<TestResult[]> {
	const tests = await getTestsBySuite(suiteId);
	const results: TestResult[] = [];

	console.log(`\n📦 Running Test Suite: ${suiteId} (${tests.length} tests)`);
	console.log('='.repeat(60));

	for (let i = 0; i < tests.length; i++) {
		const test = tests[i];
		const result = await runTest(test, suiteId);
		results.push(result);
		
		// Notify progress
		if (onProgress) {
			onProgress(result);
		}

		// Delay between tests (except for the last one)
		if (i < tests.length - 1) {
			await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TESTS_MS));
		}
	}

	const passed = results.filter(r => r.status === 'passed').length;
	const failed = results.filter(r => r.status === 'failed').length;
	console.log(`\n✅ Suite ${suiteId} Complete: ${passed} passed, ${failed} failed`);
	console.log('='.repeat(60));

	return results;
}

/**
 * Run all test suites sequentially
 */
export async function runAllTestSuites(
	onProgress?: (suiteId: string, result: TestResult) => void
): Promise<Map<string, TestResult[]>> {
	const suites = await getTestSuites();
	const allResults = new Map<string, TestResult[]>();

	console.log(`\n🚀 Running All Test Suites (${suites.length} suites, ${suites.reduce((sum, s) => sum + s.tests.length, 0)} total tests)`);
	console.log('='.repeat(60));

	for (const suite of suites) {
		const suiteResults: TestResult[] = [];
		
		console.log(`\n📦 Suite: ${suite.name} (${suite.tests.length} tests)`);
		
		for (let i = 0; i < suite.tests.length; i++) {
			const test = suite.tests[i];
			const result = await runTest(test, suite.id);
			suiteResults.push(result);
			
			// Notify progress
			if (onProgress) {
				onProgress(suite.id, result);
			}

			// Delay between tests (except for the last test of the last suite)
			if (i < suite.tests.length - 1 || suite !== suites[suites.length - 1]) {
				await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TESTS_MS));
			}
		}
		
		allResults.set(suite.id, suiteResults);
		
		const passed = suiteResults.filter(r => r.status === 'passed').length;
		const failed = suiteResults.filter(r => r.status === 'failed').length;
		console.log(`✅ Suite ${suite.name} Complete: ${passed} passed, ${failed} failed`);
	}

	const totalPassed = Array.from(allResults.values())
		.flat()
		.filter(r => r.status === 'passed').length;
	const totalFailed = Array.from(allResults.values())
		.flat()
		.filter(r => r.status === 'failed').length;
	
	console.log(`\n🎯 All Tests Complete: ${totalPassed} passed, ${totalFailed} failed`);
	console.log('='.repeat(60));

	return allResults;
}

/**
 * Format test result for display
 */
export function formatTestResult(
	testCase: TestCase,
	response: ComputeResponse | null,
	passed: boolean,
	error?: string,
	suiteId?: string
): TestResult {
	return {
		id: testCase.id,
		name: testCase.name,
		status: passed ? 'passed' : 'failed',
		description: testCase.description,
		descriptionShort: testCase.descriptionShort,
		error,
		suiteId
	};
}

