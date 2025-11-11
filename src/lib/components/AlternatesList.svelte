<script lang="ts">
	import { Badge } from '$lib/components';
	import AlternatePackage from './AlternatePackage.svelte';
	
	interface AlternatePackageData {
		ndc: string;
		pkg_size: number;
		packs: number;
		overfill: number;
		active: boolean;
		brand_name?: string;
		dosage_form?: string;
	}
	
	interface AlternatesListProps {
		alternates: AlternatePackageData[];
		onCopyNdc?: (ndc: string) => void;
		class?: string;
	}
	
	let {
		alternates = [],
		onCopyNdc,
		class: className = '',
		...restProps
	}: AlternatesListProps = $props();
	
	let isExpanded = $state(false);
	
	function toggleExpanded() {
		isExpanded = !isExpanded;
	}
	
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleExpanded();
		} else if (event.key === 'Escape' && isExpanded) {
			isExpanded = false;
		}
	}
	
	function handleCopyNdc(ndc: string) {
		if (onCopyNdc) {
			onCopyNdc(ndc);
		} else {
			navigator.clipboard.writeText(ndc).catch(() => {});
		}
	}
	
	let hasAlternates = $derived(alternates.length > 0);
</script>

{#if hasAlternates}
	<div class="alternates-list {className}" {...restProps}>
		<button
			type="button"
			class="alternates-list__toggle"
			onclick={toggleExpanded}
			onkeydown={handleKeyDown}
			aria-expanded={isExpanded}
			aria-controls="alternates-list-content"
			aria-label="Alternate Packages ({alternates.length})"
		>
			<span class="alternates-list__toggle-text">
				Alternate Packages
				<Badge variant="info" class="alternates-list__count">{alternates.length}</Badge>
			</span>
			<span class="alternates-list__chevron" class:expanded={isExpanded} aria-hidden="true">▼</span>
		</button>
		
		{#if isExpanded}
			<div id="alternates-list-content" class="alternates-list__content">
				{#each alternates as alternate (alternate.ndc)}
					<div
						aria-label="Alternate package: NDC {alternate.ndc}, {alternate.pkg_size} per package, {alternate.packs} pack(s), {(alternate.overfill * 100).toFixed(1)}% overfill"
					>
					<AlternatePackage
						ndc={alternate.ndc}
						packageSize={alternate.pkg_size}
						packs={alternate.packs}
						overfillPct={alternate.overfill}
						active={alternate.active}
						brandName={alternate.brand_name}
						dosageForm={alternate.dosage_form}
						onCopyNdc={() => handleCopyNdc(alternate.ndc)}
					/>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.alternates-list {
		width: 100%;
		margin-top: var(--space-4);
	}
	
	.alternates-list__toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: var(--space-3) var(--space-4);
		background-color: transparent;
		border: 1px solid var(--gray-300);
		border-radius: var(--border-radius-md);
		cursor: pointer;
		transition: all 150ms ease;
		font-size: var(--text-base);
		color: var(--text-primary);
	}
	
	.alternates-list__toggle:hover {
		background-color: var(--gray-50);
		border-color: var(--gray-400);
	}
	
	.alternates-list__toggle:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
	}
	
	.alternates-list__toggle-text {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: var(--font-medium);
	}
	
	.alternates-list__count {
		margin-left: var(--space-2);
	}
	
	.alternates-list__chevron {
		transition: transform 300ms ease-in-out;
		font-size: var(--text-sm);
	}
	
	.alternates-list__chevron.expanded {
		transform: rotate(180deg);
	}
	
	.alternates-list__content {
		margin-top: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		animation: slideDown 300ms ease-in-out;
	}
	
	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>

