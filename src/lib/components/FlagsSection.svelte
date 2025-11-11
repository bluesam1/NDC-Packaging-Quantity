<script lang="ts">
	import { Badge } from '$lib/components';
	
	interface FlagsSectionProps {
		flags: {
			inactive_ndcs?: string[];
			mismatch?: boolean;
			notes?: string[];
		};
		class?: string;
	}
	
	let {
		flags,
		class: className = '',
		...restProps
	}: FlagsSectionProps = $props();
	
	let inactiveNdcsExpanded = $state(false);
	
	function formatNDC(ndc: string): string {
		if (ndc.length === 11 && !ndc.includes('-')) {
			return `${ndc.slice(0, 5)}-${ndc.slice(5, 9)}-${ndc.slice(9)}`;
		}
		return ndc;
	}
	
	function toggleInactiveNdcs() {
		inactiveNdcsExpanded = !inactiveNdcsExpanded;
	}
	
	// Separate critical warnings from regular notes
	let criticalWarnings = $derived(
		flags.notes?.filter(note => 
			note.includes('No active NDCs available') || 
			note.includes('No suitable package found')
		) || []
	);
	
	let regularNotes = $derived(
		flags.notes?.filter(note => 
			!note.includes('No active NDCs available') && 
			!note.includes('No suitable package found')
		) || []
	);

	let hasFlags = $derived(
		(flags.inactive_ndcs && flags.inactive_ndcs.length > 0) ||
		flags.mismatch === true ||
		criticalWarnings.length > 0 ||
		regularNotes.length > 0
	);
</script>

{#if hasFlags}
	<div class="flags-section {className}" {...restProps} aria-label="Flags and warnings">
		<h3 class="flags-section__title">Flags & Warnings</h3>
		
		<div class="flags-section__content">
			{#if flags.inactive_ndcs && flags.inactive_ndcs.length > 0}
				<div class="flags-section__flag" role="alert">
					<button 
						type="button"
						class="flags-section__toggle"
						onclick={toggleInactiveNdcs}
						aria-expanded={inactiveNdcsExpanded}
						aria-controls="inactive-ndcs-list"
					>
						<Badge variant="warning" ariaLabel="Warning: Inactive NDCs">
							⚠️ Inactive NDCs ({flags.inactive_ndcs.length})
						</Badge>
						<span class="flags-section__toggle-icon" aria-hidden="true">
							{inactiveNdcsExpanded ? '▼' : '▶'}
						</span>
					</button>
					{#if inactiveNdcsExpanded}
						<ul 
							id="inactive-ndcs-list"
							class="flags-section__list" 
							aria-label="List of inactive NDCs"
						>
							{#each flags.inactive_ndcs as ndc}
								<li class="flags-section__list-item">
									<code class="flags-section__ndc">{formatNDC(ndc)}</code>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
			
		{#if flags.mismatch}
			<div class="flags-section__flag">
				<Badge variant="info" ariaLabel="Info: NDC data sources differ">
					ℹ️ Data Source Variance
				</Badge>
				<p class="flags-section__message">
					RxNorm and FDA returned different NDC lists. This is normal and does not affect the calculation.
				</p>
			</div>
		{/if}
		
		{#if criticalWarnings.length > 0}
			{#each criticalWarnings as warning}
				<div class="flags-section__flag flags-section__flag--error" role="alert">
					<Badge variant="error" ariaLabel="Error: Critical warning">
						❌ {warning}
					</Badge>
				</div>
			{/each}
		{/if}
			
		{#if regularNotes.length > 0}
			<div class="flags-section__flag">
				<Badge variant="info" ariaLabel="Info: Notes">
					ℹ️ Notes
				</Badge>
				<ul class="flags-section__list" aria-label="List of notes">
					{#each regularNotes as note}
						<li class="flags-section__list-item">{note}</li>
					{/each}
				</ul>
			</div>
		{/if}
		</div>
	</div>
{/if}

<style>
	.flags-section {
		margin-top: var(--space-6);
		padding: var(--space-3);
		background-color: transparent;
		border-radius: var(--border-radius-md);
		border-left: 2px solid var(--warning-300);
	}
	
	.flags-section__title {
		font-size: var(--text-base);
		font-weight: var(--font-medium);
		color: var(--text-secondary);
		margin-bottom: var(--space-3);
	}
	
	.flags-section__toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: none;
		border: none;
		padding: var(--space-2);
		cursor: pointer;
		width: 100%;
		text-align: left;
		transition: background-color 150ms ease;
	}
	
	.flags-section__toggle:hover {
		background-color: var(--gray-50);
		border-radius: var(--border-radius-sm);
	}
	
	.flags-section__toggle:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
		border-radius: var(--border-radius-sm);
	}
	
	.flags-section__toggle-icon {
		margin-left: auto;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		pointer-events: none;
	}
	
	.flags-section__toggle :global(.badge) {
		pointer-events: none;
	}
	
	.flags-section__content {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	
	.flags-section__flag {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	
	.flags-section__flag--error {
		background-color: var(--error-50);
		padding: var(--space-3);
		border-radius: var(--border-radius-md);
		border-left: 3px solid var(--error-500);
		margin-top: var(--space-2);
	}
	
	.flags-section__message {
		font-size: var(--text-sm);
		color: var(--text-primary);
		margin-top: var(--space-2);
	}
	
	.flags-section__list {
		margin-top: var(--space-2);
		margin-left: var(--space-4);
		list-style-type: disc;
	}
	
	.flags-section__list-item {
		font-size: var(--text-sm);
		color: var(--text-primary);
		margin-top: var(--space-1);
	}
	
	.flags-section__ndc {
		font-family: monospace;
		font-size: var(--text-sm);
		background-color: var(--gray-100);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--border-radius-sm);
	}
</style>

