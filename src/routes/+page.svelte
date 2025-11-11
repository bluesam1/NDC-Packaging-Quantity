<script lang="ts">
	import { InputForm, ResultsCard } from '$lib/components';
	import { computeQuantity } from '$lib/services/api';
	import { setResults, setLoading, setErrorFromApi, setError, clearResults } from '$lib/stores/results';
	import { results, loading, error } from '$lib/stores/results';
	import { showToast } from '$lib/stores/toast';
	import type { ComputeRequest } from '$lib/types/api';
	import { ApiError, getErrorMessage } from '$lib/services/api';
	
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
</script>

<div class="page">
	<div class="page__container">
		<InputForm onSubmit={handleSubmit} loading={$loading} />
		<ResultsCard
			results={$results}
			loading={$loading}
			error={$error}
			onRetry={handleRetry}
		/>
	</div>
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
	
	@media (min-width: 1024px) {
		.page__container {
			flex-direction: row;
			align-items: flex-start;
		}
	}
</style>
