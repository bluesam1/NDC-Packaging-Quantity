<script lang="ts">
	import { Card, Badge, Button } from '$lib/components';
	import QuantityDisplay from './QuantityDisplay.svelte';
	import SelectedPackage from './SelectedPackage.svelte';
	import AlternatesList from './AlternatesList.svelte';
	import FlagsSection from './FlagsSection.svelte';
	import ReasoningSection from './ReasoningSection.svelte';
	import CopyJsonButton from './CopyJsonButton.svelte';
	import type { ComputeResponse } from '$lib/types/api';
	
	interface ResultsCardProps {
		results?: ComputeResponse | null;
		loading?: boolean;
		error?: { message: string; code?: string; retryAfterMs?: number } | null;
		onCopyNdc?: (ndc: string) => void;
		onCopyJson?: () => void;
		onRetry?: () => void;
		class?: string;
	}
	
	let {
		results,
		loading = false,
		error = null,
		onCopyNdc,
		onCopyJson,
		onRetry,
		class: className = '',
		...restProps
	}: ResultsCardProps = $props();
	
	function handleCopyNdc(ndc: string) {
		if (onCopyNdc) {
			onCopyNdc(ndc);
		} else {
			// Fallback: use Clipboard API directly
			navigator.clipboard.writeText(ndc).catch(() => {
				// Silently fail if clipboard API not available
			});
		}
	}
	
	function formatNDC(ndc: string): string {
		if (ndc.length === 11 && !ndc.includes('-')) {
			return `${ndc.slice(0, 5)}-${ndc.slice(5, 9)}-${ndc.slice(9)}`;
		}
		return ndc;
	}
	
	let hasResults = $derived(
		results !== null && results !== undefined
	);
	let hasError = $derived(error !== null);
	let isEmpty = $derived(!hasResults && !loading && !hasError);
	
	// Debug: Log reasoning data
	$effect(() => {
		if (results?.reasoning) {
			console.log('Reasoning data found:', results.reasoning);
		} else if (results) {
			console.log('Results found but no reasoning:', results);
		}
	});
</script>

<Card class="results-card {className}" {...restProps}>
	<div class="results-card__header">
		<h2 class="results-card__title">Results</h2>
		{#if hasResults && results}
			<CopyJsonButton jsonData={results} onCopy={onCopyJson} />
		{/if}
	</div>
	
	<div class="results-card__content" aria-live="polite" aria-busy={loading}>
		{#if loading}
			<div class="results-card__loading">
				<div class="results-card__spinner" aria-hidden="true">⏳</div>
				<p class="results-card__loading-text">Calculating quantity and package selection...</p>
			</div>
		{:else if hasError && error}
			<div class="results-card__error" role="alert">
				<div class="results-card__error-icon" aria-hidden="true">❌</div>
				<p class="results-card__error-message">{error.message}</p>
				{#if error.code}
					<code class="results-card__error-code">{error.code}</code>
				{/if}
				{#if onRetry && error.code === 'dependency_failure'}
					<Button variant="primary" onclick={onRetry} class="results-card__retry">
						Retry
					</Button>
				{/if}
			</div>
		{:else if isEmpty}
			<div class="results-card__empty">
				<p class="results-card__empty-text">Enter drug information above and click Calculate</p>
			</div>
	{:else if hasResults && results}
		{#if results.rxnorm.name || results.ndc_selection.chosen}
			<div class="results-card__drug-name">
				{#if results.rxnorm.name}
					<h3 class="results-card__drug-name-text">{results.rxnorm.name}</h3>
				{/if}
				<div class="results-card__identifiers">
					{#if results.rxnorm.rxcui}
						<code class="results-card__identifier">RxCUI: {results.rxnorm.rxcui}</code>
					{/if}
					{#if results.ndc_selection.chosen}
						<code 
							class="results-card__identifier results-card__ndc"
							onclick={() => handleCopyNdc(results.ndc_selection.chosen!.ndc)}
							title="Click to copy NDC"
						>
							NDC: {formatNDC(results.ndc_selection.chosen.ndc)}
						</code>
					{/if}
				</div>
			</div>
		{/if}
		
		<QuantityDisplay
			quantity={results.ndc_selection.chosen 
				? results.ndc_selection.chosen.pkg_size * results.ndc_selection.chosen.packs 
				: results.computed.total_qty}
			unit={results.computed.dose_unit}
		/>
		
		{#if results.ndc_selection.chosen}
			<SelectedPackage
				ndc={results.ndc_selection.chosen.ndc}
				packageSize={results.ndc_selection.chosen.pkg_size}
				packs={results.ndc_selection.chosen.packs}
				overfillPct={results.ndc_selection.chosen.overfill}
				active={results.ndc_selection.chosen.active}
				brandName={results.ndc_selection.chosen.brand_name}
				dosageForm={results.ndc_selection.chosen.dosage_form}
				onCopyNdc={() => handleCopyNdc(results.ndc_selection.chosen!.ndc)}
			/>
		{/if}
		
		{#if results.ndc_selection.alternates && results.ndc_selection.alternates.length > 0}
			<AlternatesList
				alternates={results.ndc_selection.alternates}
				onCopyNdc={onCopyNdc || handleCopyNdc}
			/>
		{/if}
		
		{#if results.flags}
			<FlagsSection flags={results.flags} />
		{/if}
		
		{#if results.reasoning}
			<ReasoningSection reasoning={results.reasoning} />
		{/if}
		{/if}
	</div>
</Card>

<style>
	.results-card {
		width: 100%;
		position: relative;
	}
	
	.results-card__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-6);
		gap: var(--space-4);
	}

	.results-card__title {
		font-size: var(--text-2xl);
		font-weight: var(--font-semibold);
		color: var(--text-primary);
		margin: 0;
		flex: 1;
	}
	
	.results-card__content {
		min-height: 200px;
		position: relative;
	}
	
	.results-card__loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		padding: var(--space-8) 0;
	}
	
	.results-card__spinner {
		font-size: var(--text-4xl);
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
	
	.results-card__loading-text {
		font-size: var(--text-base);
		color: var(--text-secondary);
	}
	
	.results-card__error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		padding: var(--space-6) 0;
		text-align: center;
	}
	
	.results-card__error-icon {
		font-size: var(--text-3xl);
	}
	
	.results-card__error-message {
		font-size: var(--text-lg);
		color: var(--error-500);
		font-weight: var(--font-semibold);
	}
	
	.results-card__error-code {
		font-family: monospace;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		background-color: var(--gray-100);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--border-radius-sm);
	}
	
	.results-card__retry {
		margin-top: var(--space-4);
	}
	
	.results-card__empty {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-8) 0;
		text-align: center;
	}
	
	.results-card__empty-text {
		font-size: var(--text-base);
		color: var(--text-secondary);
	}
	
	.results-card__drug-name {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--gray-200);
	}
	
	.results-card__drug-name-text {
		font-size: var(--text-xl);
		font-weight: var(--font-semibold);
		color: var(--text-primary);
		text-transform: capitalize;
	}
	
	.results-card__identifiers {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}

	.results-card__identifier {
		font-family: monospace;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		background-color: var(--gray-100);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--border-radius-sm);
	}

	.results-card__ndc {
		cursor: pointer;
		transition: background-color 150ms ease, color 150ms ease;
	}

	.results-card__ndc:hover {
		background-color: var(--gray-200);
		color: var(--text-secondary);
	}

	.results-card__ndc:active {
		background-color: var(--gray-300);
	}
</style>

