<script lang="ts">
	import { Badge } from '$lib/components';
	import type { TestResult } from '$lib/stores/testResults';
	import { runTest, getTestCaseById } from '$lib/services/testRunner';
	import { testResults } from '$lib/stores/testResults';
	import { onDestroy } from 'svelte';

	interface TestLogEntryProps {
		result: TestResult;
		class?: string;
	}

	let {
		result,
		class: className = '',
		...restProps
	}: TestLogEntryProps = $props();

	let isExpanded = $state(false);
	let isRerunning = $state(false);

	// Subscribe to test results to check if tests are running
	let testResultsState = $state($testResults);
	const unsubscribe = testResults.subscribe(state => {
		testResultsState = state;
	});

	onDestroy(() => {
		unsubscribe();
	});

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	async function handleRerun(event: MouseEvent) {
		// Prevent expanding/collapsing when clicking to rerun
		event.stopPropagation();
		
		if (isRerunning || testResultsState.isRunning) {
			return; // Don't allow rerunning if already running
		}

		isRerunning = true;
		
		try {
			// Find the test case by ID
			const testCase = await getTestCaseById(result.id);
			if (!testCase) {
				console.error(`Test case not found: ${result.id}`);
				return;
			}

			// Run the test
			const newResult = await runTest(testCase, result.suiteId);
			
			// Update the result in the store
			testResults.updateResult(result.id, newResult);
		} catch (error) {
			console.error('Failed to rerun test:', error);
		} finally {
			isRerunning = false;
		}
	}

	function getStatusVariant(status: TestResult['status']): 'success' | 'error' | 'info' {
		switch (status) {
			case 'passed':
				return 'success';
			case 'failed':
				return 'error';
			case 'running':
				return 'info';
			default:
				return 'info';
		}
	}

	function getStatusIcon(status: TestResult['status']): string {
		switch (status) {
			case 'passed':
				return '✓';
			case 'failed':
				return '✗';
			case 'running':
				return '⟳';
			default:
				return '○';
		}
	}

	function formatDuration(ms?: number): string {
		if (!ms) return '-';
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}
</script>

<div
	class="test-log-entry {className}"
	class:test-log-entry--clickable={!isRerunning && !testResults.isRunning}
	data-testid="test-log-entry-{result.id}"
	{...restProps}
>
	<div class="test-log-entry__header">
		<div class="test-log-entry__status">
			<Badge variant={getStatusVariant(result.status)}>
				<span class="test-log-entry__icon">{getStatusIcon(result.status)}</span>
				<span class="test-log-entry__status-text">{result.status}</span>
			</Badge>
		</div>
		
		<div class="test-log-entry__info">
			<div class="test-log-entry__id">{result.id}</div>
			<div class="test-log-entry__name">{result.name}</div>
		</div>

		<div class="test-log-entry__actions">
			<div class="test-log-entry__duration">{formatDuration(result.duration)}</div>
			{#if !isRerunning && !testResultsState.isRunning}
				<button
					class="test-log-entry__rerun-button"
					onclick={handleRerun}
					title="Re-run this test"
					aria-label="Re-run test {result.id}"
				>
					↻
				</button>
			{:else if isRerunning}
				<div class="test-log-entry__rerun-spinner">⟳</div>
			{/if}
		</div>
	</div>

	<div class="test-log-entry__description" title={result.description}>
		{result.descriptionShort}
	</div>

	{#if result.status === 'failed' && (result.error || result.assertionFailures?.length)}
		<button
			class="test-log-entry__toggle"
			onclick={toggleExpanded}
			aria-expanded={isExpanded}
			aria-label={isExpanded ? 'Hide error details' : 'Show error details'}
		>
			{isExpanded ? '▼' : '▶'} Error Details
		</button>

		{#if isExpanded}
			<div class="test-log-entry__error-details">
				{#if result.error}
					<div class="test-log-entry__error">
						<strong>Error:</strong> {result.error}
					</div>
				{/if}
				
				{#if result.assertionFailures && result.assertionFailures.length > 0}
					<div class="test-log-entry__failures">
						<strong>Assertion Failures:</strong>
						<ul>
							{#each result.assertionFailures as failure}
								<li>{failure}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.test-log-entry {
		padding: var(--space-3);
		border-bottom: 1px solid var(--gray-200);
		background-color: var(--bg-primary);
		transition: background-color 150ms ease;
	}

	.test-log-entry:hover {
		background-color: var(--bg-secondary);
	}

	.test-log-entry__header {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}

	.test-log-entry__status {
		flex-shrink: 0;
	}

	.test-log-entry__icon {
		margin-right: var(--space-1);
	}

	.test-log-entry__status-text {
		text-transform: capitalize;
	}

	.test-log-entry__info {
		flex: 1;
		min-width: 0;
	}

	.test-log-entry__id {
		font-size: var(--text-xs);
		font-weight: var(--font-semibold);
		color: var(--text-secondary);
		font-family: monospace;
		margin-bottom: var(--space-1);
	}

	.test-log-entry__name {
		font-size: var(--text-sm);
		font-weight: var(--font-medium);
		color: var(--text-primary);
	}

	.test-log-entry__actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
	}

	.test-log-entry__duration {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	.test-log-entry__rerun-button {
		background: none;
		border: none;
		cursor: pointer;
		font-size: var(--text-lg);
		color: var(--text-secondary);
		padding: var(--space-1);
		border-radius: var(--border-radius-sm);
		transition: all 150ms ease;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		opacity: 0.6;
	}

	.test-log-entry__rerun-button:hover {
		opacity: 1;
		color: var(--primary-600);
		background-color: var(--primary-50);
	}

	.test-log-entry__rerun-button:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
	}

	.test-log-entry__rerun-spinner {
		font-size: var(--text-lg);
		color: var(--primary-500);
		animation: spin 1s linear infinite;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.test-log-entry--clickable {
		cursor: default;
	}

	.test-log-entry__description {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin-bottom: var(--space-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: help;
	}

	.test-log-entry__toggle {
		font-size: var(--text-xs);
		color: var(--primary-600);
		background: none;
		border: none;
		cursor: pointer;
		padding: var(--space-1) 0;
		text-align: left;
		transition: color 150ms ease;
	}

	.test-log-entry__toggle:hover {
		color: var(--primary-700);
		text-decoration: underline;
	}

	.test-log-entry__toggle:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
		border-radius: var(--border-radius-sm);
	}

	.test-log-entry__error-details {
		margin-top: var(--space-2);
		padding: var(--space-3);
		background-color: var(--gray-50);
		border-left: 3px solid var(--error-500);
		border-radius: var(--border-radius-sm);
	}

	.test-log-entry__error {
		font-size: var(--text-sm);
		color: var(--error-500);
		margin-bottom: var(--space-2);
	}

	.test-log-entry__failures {
		font-size: var(--text-sm);
		color: var(--text-primary);
	}

	.test-log-entry__failures ul {
		margin: var(--space-2) 0 0 var(--space-4);
		padding: 0;
		list-style-type: disc;
	}

	.test-log-entry__failures li {
		margin-bottom: var(--space-1);
	}

	/* Running state animation */
	.test-log-entry__icon {
		display: inline-block;
	}

	.test-log-entry[data-status="running"] .test-log-entry__icon {
		animation: spin 1s linear infinite;
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


