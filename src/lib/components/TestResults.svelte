<script lang="ts">
	import { Card, Badge } from '$lib/components';
	import TestLogEntry from './TestLogEntry.svelte';
	import { testResults } from '$lib/stores/testResults';
	import { getTestSuites, runTestSuite, type TestSuite } from '$lib/services/testRunner';
	import type { TestResult } from '$lib/stores/testResults';

	interface TestResultsProps {
		class?: string;
	}

	let {
		class: className = '',
		...restProps
	}: TestResultsProps = $props();

	// Subscribe to test results store reactively
	let testResultsState = $state($testResults);
	const unsubscribe = testResults.subscribe(state => {
		testResultsState = state;
	});

	// Load test suites to get suite names
	let testSuites = $state<TestSuite[]>([]);
	
	async function loadTestSuites() {
		try {
			testSuites = await getTestSuites();
		} catch (error) {
			console.error('Failed to load test suites:', error);
		}
	}

	// Load suites on mount
	loadTestSuites();

	// Group results by suite
	function groupResultsBySuite(results: TestResult[]): Map<string, { suiteName: string; results: TestResult[] }> {
		const grouped = new Map<string, { suiteName: string; results: TestResult[] }>();
		
		for (const result of results) {
			const suiteId = result.suiteId || 'unknown';
			const suite = testSuites.find(s => s.id === suiteId);
			const suiteName = suite?.name || suiteId;
			
			if (!grouped.has(suiteId)) {
				grouped.set(suiteId, { suiteName, results: [] });
			}
			grouped.get(suiteId)!.results.push(result);
		}
		
		return grouped;
	}

	// Calculate suite summary
	function getSuiteSummary(results: TestResult[]): { passed: number; failed: number; total: number } {
		const passed = results.filter(r => r.status === 'passed').length;
		const failed = results.filter(r => r.status === 'failed').length;
		return { passed, failed, total: results.length };
	}

	// Track expanded state for each suite
	let expandedSuites = $state<Set<string>>(new Set());
	
	// Track which suite is being re-run
	let rerunningSuiteId = $state<string | null>(null);
	
	function toggleSuite(suiteId: string) {
		if (expandedSuites.has(suiteId)) {
			expandedSuites.delete(suiteId);
		} else {
			expandedSuites.add(suiteId);
		}
		expandedSuites = new Set(expandedSuites); // Trigger reactivity
	}

	async function handleRerunSuite(event: MouseEvent, suiteId: string) {
		// Prevent expanding/collapsing when clicking re-run
		event.stopPropagation();
		
		if (testResultsState.isRunning || rerunningSuiteId) {
			return; // Don't allow running if already running
		}

		const suite = testSuites.find(s => s.id === suiteId);
		if (!suite) return;

		rerunningSuiteId = suiteId;
		
		// Remove old results for this suite (keep results from other suites)
		const filteredResults = testResultsState.results.filter(r => r.suiteId !== suiteId);
		
		// Clear and start the suite with correct total
		testResults.clearResults();
		testResults.startSuite(suiteId, suite.tests.length);
		
		// Restore results from other suites (these won't count toward current progress
		// because addResult only counts results from the current suite)
		filteredResults.forEach(r => {
			testResults.addResult(r);
		});

		try {
			await runTestSuite(suiteId, (result) => {
				testResults.addResult(result);
			});
		} catch (error) {
			console.error('Test suite execution failed:', error);
		} finally {
			testResults.completeSuite(suiteId, suite.name);
			rerunningSuiteId = null;
		}
	}
</script>

{#if testResultsState.results.length > 0 || testResultsState.isRunning}
	<Card class="test-results {className}" {...restProps}>
		<div class="test-results__header">
			<h3 class="test-results__title">Test Results</h3>
			<div class="test-results__summary">
				<div class="test-results__summary-item">
					<span class="test-results__summary-label">Passed:</span>
					<Badge variant="success">{testResultsState.summary.passed}</Badge>
				</div>
				<div class="test-results__summary-item">
					<span class="test-results__summary-label">Failed:</span>
					<Badge variant="error">{testResultsState.summary.failed}</Badge>
				</div>
				<div class="test-results__summary-item">
					<span class="test-results__summary-label">Duration:</span>
					<span class="test-results__summary-value">
						{(testResultsState.summary.duration / 1000).toFixed(2)}s
					</span>
				</div>
				{#if testResultsState.progress.total > 0}
					<div class="test-results__summary-item">
						<span class="test-results__summary-label">Progress:</span>
						<span class="test-results__summary-value">
							{testResultsState.progress.current} / {testResultsState.progress.total}
						</span>
					</div>
				{/if}
			</div>
		</div>

		{#if testResultsState.isRunning}
			<div class="test-results__running">
				<div class="test-results__running-spinner">⟳</div>
				<div class="test-results__running-text">
					Running tests... ({testResultsState.progress.current} / {testResultsState.progress.total})
				</div>
			</div>
		{:else}
			{@const groupedResults = groupResultsBySuite(testResultsState.results)}
			{#if groupedResults.size > 0}
				<div class="test-results__suites">
					{#each Array.from(groupedResults.entries()) as [suiteId, { suiteName, results }]}
						{@const summary = getSuiteSummary(results)}
						{@const isExpanded = expandedSuites.has(suiteId)}
						{@const isRerunning = rerunningSuiteId === suiteId}
						{@const canRerun = !testResultsState.isRunning && !rerunningSuiteId}
						<div class="test-results__suite">
							<div class="test-results__suite-header-wrapper">
								<button
									class="test-results__suite-header"
									onclick={() => toggleSuite(suiteId)}
									aria-expanded={isExpanded}
									aria-label={isExpanded ? `Collapse ${suiteName}` : `Expand ${suiteName}`}
									disabled={isRerunning}
								>
									<span class="test-results__suite-icon">{isExpanded ? '▼' : '▶'}</span>
									<span class="test-results__suite-name">{suiteName}</span>
									<div class="test-results__suite-summary">
										<Badge variant={summary.failed > 0 ? 'error' : 'success'}>
											{summary.passed} passed, {summary.failed} failed
										</Badge>
										<span class="test-results__suite-count">({summary.total} total)</span>
									</div>
								</button>
								{#if canRerun || isRerunning}
									<button
										class="test-results__suite-rerun"
										onclick={(e) => handleRerunSuite(e, suiteId)}
										disabled={isRerunning}
										title="Re-run this test suite"
										aria-label="Re-run {suiteName} test suite"
									>
										{#if isRerunning}
											<span class="test-results__suite-rerun-spinner">⟳</span>
										{:else}
											↻
										{/if}
									</button>
								{/if}
							</div>
							{#if isExpanded}
								<div class="test-results__suite-content">
									<div class="test-results__log-entries">
										{#each results as result}
											<TestLogEntry result={result} />
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="test-results__empty">No test results to display</div>
			{/if}
		{/if}
	</Card>
{/if}

<style>
	.test-results {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.test-results__header {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.test-results__title {
		font-size: var(--text-lg);
		font-weight: var(--font-semibold);
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.test-results__summary {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		padding: var(--space-4);
		background-color: var(--bg-secondary);
		border-radius: var(--border-radius-md);
		border: 1px solid var(--gray-200);
	}

	.test-results__summary-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.test-results__summary-label {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		font-weight: var(--font-medium);
	}

	.test-results__summary-value {
		font-size: var(--text-sm);
		color: var(--text-primary);
		font-weight: var(--font-semibold);
	}

	.test-results__running {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-8);
		color: var(--text-secondary);
	}

	.test-results__running-spinner {
		font-size: var(--text-4xl);
		animation: spin 1s linear infinite;
		color: var(--primary-500);
		margin-bottom: var(--space-4);
	}

	.test-results__running-text {
		font-size: var(--text-base);
	}

	.test-results__suites {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.test-results__suite {
		border: 1px solid var(--gray-200);
		border-radius: var(--border-radius-md);
		background-color: var(--bg-primary);
		overflow: hidden;
	}

	.test-results__suite-header-wrapper {
		display: flex;
		align-items: stretch;
		background-color: var(--bg-secondary);
	}

	.test-results__suite-header {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background-color: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background-color 150ms ease;
	}

	.test-results__suite-header:hover:not(:disabled) {
		background-color: var(--gray-100);
	}

	.test-results__suite-header:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.test-results__suite-header:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: -2px;
	}

	.test-results__suite-rerun {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-2) var(--space-3);
		background-color: transparent;
		border: none;
		border-left: 1px solid var(--gray-200);
		cursor: pointer;
		color: var(--text-secondary);
		font-size: var(--text-lg);
		transition: background-color 150ms ease, color 150ms ease;
		flex-shrink: 0;
	}

	.test-results__suite-rerun:hover:not(:disabled) {
		background-color: var(--gray-100);
		color: var(--primary-600);
	}

	.test-results__suite-rerun:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.test-results__suite-rerun:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: -2px;
	}

	.test-results__suite-rerun-spinner {
		display: inline-block;
		animation: spin 1s linear infinite;
	}

	.test-results__suite-icon {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		flex-shrink: 0;
		width: 1em;
		text-align: center;
	}

	.test-results__suite-name {
		font-size: var(--text-base);
		font-weight: var(--font-semibold);
		color: var(--text-primary);
		flex: 1;
	}

	.test-results__suite-summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
	}

	.test-results__suite-count {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.test-results__suite-content {
		border-top: 1px solid var(--gray-200);
		background-color: var(--bg-primary);
	}

	.test-results__log-entries {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		max-height: 500px;
	}

	.test-results__empty {
		padding: var(--space-8);
		text-align: center;
		color: var(--text-secondary);
		font-size: var(--text-base);
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>

