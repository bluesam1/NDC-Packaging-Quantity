/**
 * Test Results Store
 * 
 * Manages test execution state, results, and progress for the testing menu UI.
 */

import { writable } from 'svelte/store';

export interface TestResult {
	id: string;
	name: string;
	status: 'running' | 'passed' | 'failed';
	duration?: number;
	error?: string;
	assertionFailures?: string[];
	description: string;
	descriptionShort: string;
	suiteId?: string;
}

export interface TestProgress {
	current: number;
	total: number;
}

export interface TestSummary {
	passed: number;
	failed: number;
	duration: number;
}

export interface TestSuiteResult {
	suiteId: string;
	suiteName: string;
	results: TestResult[];
	summary: TestSummary;
	lastRun?: Date;
}

interface TestResultsState {
	results: TestResult[];
	isRunning: boolean;
	currentSuiteId: string | null;
	progress: TestProgress;
	summary: TestSummary;
	suiteResults: Map<string, TestSuiteResult>;
}

const initialState: TestResultsState = {
	results: [],
	isRunning: false,
	currentSuiteId: null,
	progress: { current: 0, total: 0 },
	summary: { passed: 0, failed: 0, duration: 0 },
	suiteResults: new Map()
};

function createTestResultsStore() {
	const { subscribe, set, update } = writable<TestResultsState>(initialState);

	return {
		subscribe,
		
	/**
	 * Start running a test suite
	 */
	startSuite(suiteId: string, totalTests: number) {
		update(state => ({
			...state,
			isRunning: true,
			currentSuiteId: suiteId,
			results: [],
			progress: { current: 0, total: totalTests },
			summary: { passed: 0, failed: 0, duration: 0 }
		}));
	},

	/**
	 * Start running all test suites
	 */
	startAllSuites(totalTests: number) {
		update(state => ({
			...state,
			isRunning: true,
			currentSuiteId: 'all',
			results: [],
			progress: { current: 0, total: totalTests },
			summary: { passed: 0, failed: 0, duration: 0 }
		}));
	},

		/**
		 * Add a test result
		 */
		addResult(result: TestResult) {
			update(state => {
				const results = [...state.results, result];
				const passed = results.filter(r => r.status === 'passed').length;
				const failed = results.filter(r => r.status === 'failed').length;
				const duration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
				
				// Only count results from the current suite toward progress
				const currentSuiteResults = state.currentSuiteId 
					? results.filter(r => r.suiteId === state.currentSuiteId)
					: results;
				
				return {
					...state,
					results,
					progress: {
						...state.progress,
						current: currentSuiteResults.length
					},
					summary: {
						passed,
						failed,
						duration
					}
				};
			});
		},

		/**
		 * Update a test result (e.g., from 'running' to 'passed'/'failed')
		 */
		updateResult(testId: string, updates: Partial<TestResult>) {
			update(state => {
				const results = state.results.map(r => 
					r.id === testId ? { ...r, ...updates } : r
				);
				const passed = results.filter(r => r.status === 'passed').length;
				const failed = results.filter(r => r.status === 'failed').length;
				const duration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
				
				return {
					...state,
					results,
					summary: {
						passed,
						failed,
						duration
					}
				};
			});
		},

	/**
	 * Complete test suite execution
	 * Note: When running all suites, this is called for each suite but doesn't stop execution
	 */
	completeSuite(suiteId: string, suiteName: string) {
		update(state => {
			// Filter results for this specific suite
			const suiteTestResults = state.results.filter(r => r.suiteId === suiteId);
			
			// Calculate summary for this suite only
			const passed = suiteTestResults.filter(r => r.status === 'passed').length;
			const failed = suiteTestResults.filter(r => r.status === 'failed').length;
			const duration = suiteTestResults.reduce((sum, r) => sum + (r.duration || 0), 0);
			
			const suiteResult: TestSuiteResult = {
				suiteId,
				suiteName,
				results: suiteTestResults,
				summary: { passed, failed, duration },
				lastRun: new Date()
			};

			const suiteResults = new Map(state.suiteResults);
			suiteResults.set(suiteId, suiteResult);

			// Only stop running if this is a single suite run (not "all")
			const shouldStopRunning = state.currentSuiteId !== 'all';

			return {
				...state,
				isRunning: shouldStopRunning ? false : state.isRunning,
				currentSuiteId: shouldStopRunning ? null : state.currentSuiteId,
				suiteResults
			};
		});
	},

	/**
	 * Complete all suites execution
	 */
	completeAllSuites() {
		update(state => ({
			...state,
			isRunning: false,
			currentSuiteId: null
		}));
	},

		/**
		 * Clear current test results
		 */
		clearResults() {
			update(state => ({
				...state,
				results: [],
				progress: { current: 0, total: 0 },
				summary: { passed: 0, failed: 0, duration: 0 }
			}));
		},

		/**
		 * Get last run result for a suite
		 */
		getSuiteResult(suiteId: string): TestSuiteResult | undefined {
			let result: TestSuiteResult | undefined;
			update(state => {
				result = state.suiteResults.get(suiteId);
				return state;
			});
			return result;
		},

		/**
		 * Reset store to initial state
		 */
		reset() {
			set(initialState);
		}
	};
}

export const testResults = createTestResultsStore();

