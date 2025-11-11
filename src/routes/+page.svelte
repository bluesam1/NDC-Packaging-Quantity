<script lang="ts">
	import { InputForm, ResultsCard, TestMenuButton, TestSuitePanel, TestResults } from '$lib/components';
	import { computeQuantity } from '$lib/services/api';
	import { setResults, setLoading, setErrorFromApi, setError, clearResults } from '$lib/stores/results';
	import { results, loading, error } from '$lib/stores/results';
	import { showToast } from '$lib/stores/toast';
	import type { ComputeRequest } from '$lib/types/api';
	import { ApiError, getErrorMessage } from '$lib/services/api';

	let isTestPanelOpen = $state(false);
	
	async function handleSubmit(request: ComputeRequest) {
		// Clear previous results and errors
		clearResults();
		setLoading(true);
		
		try {
			const response = await computeQuantity(request);
			setResults(response);
			setLoading(false);
		} catch (err) {
			setLoading(false);
			
			if (err instanceof ApiError) {
				setErrorFromApi(err);
				
				// Show error toast
				const errorMessage = getErrorMessage(err);
				showToast('error', errorMessage);
			} else {
				// Unknown error
				setError({
					message: 'An unexpected error occurred. Please try again.',
				});
				showToast('error', 'An unexpected error occurred');
			}
		}
	}
	
	function handleRetry() {
		// Retry logic would be handled by the API client
		// For now, just clear error and let user resubmit
		clearResults();
	}

	function handleTestMenuClick() {
		isTestPanelOpen = true;
	}

	function handleTestPanelClose() {
		isTestPanelOpen = false;
	}
</script>

<div class="page">
	<div class="page__container">
		<div class="page__left">
			<InputForm onSubmit={handleSubmit} loading={$loading} />
			<TestResults />
		</div>
		
		<ResultsCard
			results={$results}
			loading={$loading}
			error={$error}
			onRetry={handleRetry}
		/>
	</div>
	
	<TestMenuButton onClick={handleTestMenuClick} />
	<TestSuitePanel isOpen={isTestPanelOpen} onClose={handleTestPanelClose} />
</div>

<style>
	.page {
		min-height: 100vh;
		padding: var(--space-6) var(--space-4);
		background-color: var(--bg-primary);
	}
	
	.page__container {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}
	
	.page__left {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}
	
	@media (min-width: 1024px) {
		.page__container {
			flex-direction: row;
			align-items: flex-start;
		}
		
		.page__left {
			flex: 0 0 50%;
			max-width: 50%;
			min-width: 0;
		}
		
		.page__container > :global(.results-card) {
			flex: 0 0 50%;
			max-width: 50%;
			min-width: 0;
		}
	}
</style>
