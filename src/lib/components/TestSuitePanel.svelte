<script lang="ts">
	import { Button } from '$lib/components';
	import { testResults } from '$lib/stores/testResults';
	import { getTestSuites, runTestSuite, runAllTestSuites, type TestSuite } from '$lib/services/testRunner';
	import { onMount, onDestroy } from 'svelte';

	interface TestSuitePanelProps {
		isOpen: boolean;
		onClose?: () => void;
		class?: string;
	}

	let {
		isOpen,
		onClose,
		class: className = '',
		...restProps
	}: TestSuitePanelProps = $props();

	let testSuites = $state<TestSuite[]>([]);
	let loadingSuites = $state(false);
	let selectedSuiteId = $state<string | null>(null);
	
	// Subscribe to test results store reactively
	let testResultsState = $state($testResults);
	const unsubscribe = testResults.subscribe(state => {
		testResultsState = state;
	});

	// Draggable and resizable state
	let panelElement: HTMLDivElement;
	let isDragging = $state(false);
	let isResizing = $state(false);
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let initialX = $state(24); // Default left position
	let initialY = $state(24); // Default bottom position (will be calculated)
	let initialWidth = $state(500);
	let initialHeight = $state(600);
	let currentX = $state(24);
	let currentY = $state(24);
	let currentWidth = $state(500);
	let currentHeight = $state(600);
	let resizeHandle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null = null;

	onMount(async () => {
		await loadTestSuites();
		// Calculate initial Y position (bottom of screen)
		const viewportHeight = window.innerHeight;
		currentY = viewportHeight - initialHeight - 24;
		
		// Set up global mouse event listeners for dragging/resizing
		window.addEventListener('mousemove', handleDrag);
		window.addEventListener('mouseup', handleDragEnd);
	});
	
	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('mousemove', handleDrag);
			window.removeEventListener('mouseup', handleDragEnd);
		}
	});

	async function loadTestSuites() {
		loadingSuites = true;
		try {
			testSuites = await getTestSuites();
		} catch (error) {
			console.error('Failed to load test suites:', error);
		} finally {
			loadingSuites = false;
		}
	}

	async function handleRunSuite(suiteId: string) {
		if (testResultsState.isRunning) {
			return; // Don't allow running multiple suites at once
		}

		selectedSuiteId = suiteId;
		const suite = testSuites.find(s => s.id === suiteId);
		if (!suite) return;

		testResults.clearResults();
		testResults.startSuite(suiteId, suite.tests.length);

		try {
			await runTestSuite(suiteId, (result) => {
				testResults.addResult(result);
			});
		} catch (error) {
			console.error('Test suite execution failed:', error);
		} finally {
			testResults.completeSuite(suiteId, suite.name);
		}
	}

	async function handleRunAllSuites() {
		if (testResultsState.isRunning) {
			return; // Don't allow running multiple suites at once
		}

		selectedSuiteId = 'all';
		
		// Calculate total number of tests across all suites
		const totalTests = testSuites.reduce((sum, suite) => sum + suite.tests.length, 0);
		
		testResults.clearResults();
		testResults.startAllSuites(totalTests);

		try {
			await runAllTestSuites((suiteId, result) => {
				testResults.addResult(result);
			});
			
			// Mark each suite as completed
			for (const suite of testSuites) {
				testResults.completeSuite(suite.id, suite.name);
			}
		} catch (error) {
			console.error('Test execution failed:', error);
		} finally {
			testResults.completeAllSuites();
		}
	}

	function handleClose() {
		if (onClose) {
			onClose();
		}
	}


	function getSuiteResult(suiteId: string) {
		return testResultsState.suiteResults.get(suiteId);
	}

	function formatLastRun(suiteId: string): string {
		const result = getSuiteResult(suiteId);
		if (!result || !result.lastRun) return '';
		const passed = result.summary.passed;
		const total = result.results.length;
		return `Last run: ${passed}/${total} passed`;
	}

	// Drag handlers
	function handleDragStart(event: MouseEvent) {
		// Don't start drag if clicking on resize handle or close button
		if ((event.target as HTMLElement).closest('.test-suite-panel__resize-handle') ||
		    (event.target as HTMLElement).closest('.test-suite-panel__close')) {
			return;
		}
		isDragging = true;
		dragStartX = event.clientX;
		dragStartY = event.clientY;
		initialX = currentX;
		initialY = currentY;
		event.preventDefault();
	}

	function handleDrag(event: MouseEvent) {
		if (isDragging) {
			const deltaX = event.clientX - dragStartX;
			const deltaY = event.clientY - dragStartY;
			const newX = initialX + deltaX;
			const newY = initialY + deltaY;
			
			// Constrain to viewport
			const maxX = window.innerWidth - currentWidth;
			const maxY = window.innerHeight - currentHeight;
			
			currentX = Math.max(0, Math.min(newX, maxX));
			currentY = Math.max(0, Math.min(newY, maxY));
		} else if (isResizing && resizeHandle) {
			const deltaX = event.clientX - dragStartX;
			const deltaY = event.clientY - dragStartY;
			
			let newWidth = initialWidth;
			let newHeight = initialHeight;
			let newX = initialX;
			let newY = initialY;
			
			// Handle horizontal resizing
			if (resizeHandle.includes('e')) {
				newWidth = Math.max(400, Math.min(initialWidth + deltaX, window.innerWidth - initialX));
			}
			if (resizeHandle.includes('w')) {
				newWidth = Math.max(400, Math.min(initialWidth - deltaX, initialX + initialWidth));
				newX = initialX + initialWidth - newWidth;
			}
			
			// Handle vertical resizing
			if (resizeHandle.includes('s')) {
				newHeight = Math.max(300, Math.min(initialHeight + deltaY, window.innerHeight - initialY));
			}
			if (resizeHandle.includes('n')) {
				newHeight = Math.max(300, Math.min(initialHeight - deltaY, initialY + initialHeight));
				newY = initialY + initialHeight - newHeight;
			}
			
			// Constrain to viewport
			const maxX = window.innerWidth - newWidth;
			const maxY = window.innerHeight - newHeight;
			
			currentX = Math.max(0, Math.min(newX, maxX));
			currentY = Math.max(0, Math.min(newY, maxY));
			currentWidth = newWidth;
			currentHeight = newHeight;
		}
	}

	function handleDragEnd() {
		isDragging = false;
		isResizing = false;
		resizeHandle = null;
	}

	function handleResizeStart(event: MouseEvent, handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') {
		isResizing = true;
		resizeHandle = handle;
		dragStartX = event.clientX;
		dragStartY = event.clientY;
		initialX = currentX;
		initialY = currentY;
		initialWidth = currentWidth;
		initialHeight = currentHeight;
		event.preventDefault();
		event.stopPropagation();
	}


</script>

{#if isOpen}
	<div
		bind:this={panelElement}
		class="test-suite-panel {className}"
		role="dialog"
		aria-labelledby="test-suite-panel-title"
		style="left: {currentX}px; top: {currentY}px; width: {currentWidth}px; height: {currentHeight}px;"
		{...restProps}
	>
			<header 
				class="test-suite-panel__header"
				onmousedown={handleDragStart}
				style="cursor: {isDragging ? 'grabbing' : 'grab'};"
			>
				<h2 id="test-suite-panel-title" class="test-suite-panel__title">Test Suite</h2>
				<button
					class="test-suite-panel__close"
					onclick={handleClose}
					aria-label="Close test suite panel"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</header>

			<!-- Resize handles -->
			<div 
				class="test-suite-panel__resize-handle test-suite-panel__resize-handle--n"
				onmousedown={(e) => handleResizeStart(e, 'n')}
			></div>
			<div 
				class="test-suite-panel__resize-handle test-suite-panel__resize-handle--s"
				onmousedown={(e) => handleResizeStart(e, 's')}
			></div>
			<div 
				class="test-suite-panel__resize-handle test-suite-panel__resize-handle--e"
				onmousedown={(e) => handleResizeStart(e, 'e')}
			></div>
			<div 
				class="test-suite-panel__resize-handle test-suite-panel__resize-handle--w"
				onmousedown={(e) => handleResizeStart(e, 'w')}
			></div>
			<div 
				class="test-suite-panel__resize-handle test-suite-panel__resize-handle--ne"
				onmousedown={(e) => handleResizeStart(e, 'ne')}
			></div>
			<div 
				class="test-suite-panel__resize-handle test-suite-panel__resize-handle--nw"
				onmousedown={(e) => handleResizeStart(e, 'nw')}
			></div>
			<div 
				class="test-suite-panel__resize-handle test-suite-panel__resize-handle--se"
				onmousedown={(e) => handleResizeStart(e, 'se')}
			></div>
			<div 
				class="test-suite-panel__resize-handle test-suite-panel__resize-handle--sw"
				onmousedown={(e) => handleResizeStart(e, 'sw')}
			></div>

			<div class="test-suite-panel__content">
				{#if loadingSuites}
					<div class="test-suite-panel__loading">Loading test suites...</div>
				{:else if testSuites.length === 0}
					<div class="test-suite-panel__empty">No test suites available</div>
				{:else}
					<div class="test-suite-panel__suites">
						<div class="test-suite-panel__suites-header">
							<h3 class="test-suite-panel__suites-title">Select Test Suite</h3>
							<Button
								variant="primary"
								disabled={testResultsState.isRunning}
								onclick={handleRunAllSuites}
								class="test-suite-panel__run-all-button"
								ariaLabel="Run all test suites"
							>
								{testResultsState.isRunning && testResultsState.currentSuiteId === 'all' ? 'Running All...' : 'Run All Tests'}
							</Button>
						</div>
						<div class="test-suite-panel__suites-list">
							{#each testSuites as suite}
								{@const suiteResult = getSuiteResult(suite.id)}
								{@const isRunning = testResultsState.isRunning && testResultsState.currentSuiteId === suite.id}
								{@const isRunningAll = testResultsState.isRunning && testResultsState.currentSuiteId === 'all'}
								{@const isDisabled = testResultsState.isRunning && testResultsState.currentSuiteId !== suite.id && !isRunningAll}
									
								<button
									class="test-suite-panel__suite-button"
									class:test-suite-panel__suite-button--active={isRunning}
									class:test-suite-panel__suite-button--disabled={isDisabled}
									onclick={() => handleRunSuite(suite.id)}
									disabled={isDisabled}
									aria-label="Run {suite.name} test suite"
								>
									<div class="test-suite-panel__suite-info">
										<div class="test-suite-panel__suite-name">{suite.name}</div>
										<div class="test-suite-panel__suite-count">
											{suite.tests.length} {suite.tests.length === 1 ? 'test' : 'tests'}
										</div>
										{#if suiteResult && suiteResult.lastRun}
											<div class="test-suite-panel__suite-last-run">
												{formatLastRun(suite.id)}
											</div>
										{/if}
									</div>
									{#if isRunning}
										<div class="test-suite-panel__suite-spinner">⟳</div>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
{/if}

<style>
	.test-suite-panel {
		position: fixed;
		background-color: var(--bg-elevated);
		border-radius: var(--border-radius-lg);
		box-shadow: var(--shadow-xl);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		z-index: 1000;
		border: 1px solid var(--gray-200);
		user-select: none;
	}

	.test-suite-panel__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-5) var(--space-6);
		border-bottom: 1px solid var(--gray-200);
		background-color: var(--bg-primary);
		flex-shrink: 0;
	}

	.test-suite-panel__header:active {
		cursor: grabbing;
	}


	.test-suite-panel__title {
		font-size: var(--text-xl);
		font-weight: var(--font-bold);
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.02em;
	}

	.test-suite-panel__close {
		width: 32px;
		height: 32px;
		border: none;
		background: none;
		cursor: pointer;
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--border-radius-sm);
		transition: all 150ms ease;
	}

	.test-suite-panel__close:hover {
		background-color: var(--gray-100);
		color: var(--text-primary);
	}

	.test-suite-panel__close:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
	}

	.test-suite-panel__content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.test-suite-panel__loading,
	.test-suite-panel__empty {
		text-align: center;
		color: var(--text-secondary);
		padding: var(--space-8);
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.test-suite-panel__suites {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: var(--space-4);
		overflow-y: auto;
		background-color: var(--bg-secondary);
	}

	.test-suite-panel__suites-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--gray-200);
	}

	.test-suite-panel__suites-title {
		font-size: var(--text-xs);
		font-weight: var(--font-semibold);
		color: var(--text-secondary);
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.test-suite-panel__run-all-button {
		width: 100%;
	}

	.test-suite-panel__suites-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.test-suite-panel__suite-button {
		width: 100%;
		padding: var(--space-4);
		background-color: var(--bg-primary);
		border: 1px solid var(--gray-200);
		border-radius: var(--border-radius-md);
		cursor: pointer;
		text-align: left;
		display: flex;
		align-items: center;
		justify-content: space-between;
		transition: all 150ms ease;
		box-shadow: var(--shadow-sm);
	}

	.test-suite-panel__suite-button:hover:not(:disabled) {
		border-color: var(--primary-500);
		background-color: var(--bg-primary);
		box-shadow: var(--shadow-md);
		transform: translateY(-1px);
	}

	.test-suite-panel__suite-button--active {
		border-color: var(--primary-500);
		background-color: var(--primary-50);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.test-suite-panel__suite-button--disabled {
		opacity: 0.5;
		cursor: not-allowed;
		box-shadow: none;
	}

	.test-suite-panel__suite-button:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
	}

	.test-suite-panel__suite-info {
		flex: 1;
	}

	.test-suite-panel__suite-name {
		font-size: var(--text-base);
		font-weight: var(--font-semibold);
		color: var(--text-primary);
		margin-bottom: var(--space-2);
		line-height: 1.4;
	}

	.test-suite-panel__suite-count {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin-bottom: var(--space-1);
		font-weight: var(--font-medium);
	}

	.test-suite-panel__suite-last-run {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		margin-top: var(--space-1);
		padding-top: var(--space-1);
		border-top: 1px solid var(--gray-100);
	}

	.test-suite-panel__suite-spinner {
		font-size: var(--text-lg);
		animation: spin 1s linear infinite;
		color: var(--primary-500);
		flex-shrink: 0;
		margin-left: var(--space-2);
	}


	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* Resize handles */
	.test-suite-panel__resize-handle {
		position: absolute;
		background-color: transparent;
		z-index: 10;
	}

	.test-suite-panel__resize-handle--n {
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		cursor: ns-resize;
	}

	.test-suite-panel__resize-handle--s {
		bottom: 0;
		left: 0;
		right: 0;
		height: 4px;
		cursor: ns-resize;
	}

	.test-suite-panel__resize-handle--e {
		top: 0;
		right: 0;
		bottom: 0;
		width: 4px;
		cursor: ew-resize;
	}

	.test-suite-panel__resize-handle--w {
		top: 0;
		left: 0;
		bottom: 0;
		width: 4px;
		cursor: ew-resize;
	}

	.test-suite-panel__resize-handle--ne {
		top: 0;
		right: 0;
		width: 12px;
		height: 12px;
		cursor: nesw-resize;
	}

	.test-suite-panel__resize-handle--nw {
		top: 0;
		left: 0;
		width: 12px;
		height: 12px;
		cursor: nwse-resize;
	}

	.test-suite-panel__resize-handle--se {
		bottom: 0;
		right: 0;
		width: 12px;
		height: 12px;
		cursor: nwse-resize;
	}

	.test-suite-panel__resize-handle--sw {
		bottom: 0;
		left: 0;
		width: 12px;
		height: 12px;
		cursor: nesw-resize;
	}

	.test-suite-panel__resize-handle:hover {
		background-color: var(--primary-500);
		opacity: 0.3;
	}

	@media (max-width: 640px) {
		.test-suite-panel {
			width: calc(100vw - 48px) !important;
			height: calc(100vh - 100px) !important;
			left: 24px !important;
			top: 50px !important;
		}
	}
</style>

