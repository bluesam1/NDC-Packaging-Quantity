<script lang="ts">
	import { Badge } from '$lib/components';
	import { showToast } from '$lib/stores/toast';
	
	interface SelectedPackageProps {
		ndc: string;
		packageSize: number;
		packs: number;
		overfillPct: number;
		active: boolean;
		brandName?: string;
		dosageForm?: string;
		onCopyNdc?: () => void;
		class?: string;
	}
	
	let {
		ndc,
		packageSize,
		packs,
		overfillPct,
		active,
		brandName,
		dosageForm,
		onCopyNdc,
		class: className = '',
		...restProps
	}: SelectedPackageProps = $props();
	
	function formatNDC(ndc: string): string {
		// Format NDC with hyphens if it's 11 digits without hyphens
		if (ndc.length === 11 && !ndc.includes('-')) {
			return `${ndc.slice(0, 5)}-${ndc.slice(5, 9)}-${ndc.slice(9)}`;
		}
		return ndc;
	}
	
	function getOverfillColor(overfill: number): 'success' | 'warning' | 'error' {
		if (overfill === 0) return 'success';
		if (overfill > 10) return 'error';
		return 'warning';
	}
	
	async function handleCopy() {
		try {
			const formattedNDC = formatNDC(ndc);
			await navigator.clipboard.writeText(formattedNDC);
			
			// Show toast notification
			showToast('success', `NDC ${formattedNDC} copied to clipboard`);
			
			if (onCopyNdc) {
				onCopyNdc();
			}
		} catch (error) {
			// Show error toast
			showToast('error', 'Failed to copy NDC to clipboard');
		}
	}
</script>

<div class="selected-package {className}" {...restProps}>
	<div class="selected-package__header">
		<div class="selected-package__title-wrapper">
			{#if brandName || dosageForm}
				<div class="selected-package__product-info">
					{#if brandName}
						<span class="selected-package__brand-name">{brandName}</span>
					{/if}
					{#if dosageForm}
						<span class="selected-package__dosage-form">{dosageForm}</span>
					{/if}
				</div>
			{/if}
			<div class="selected-package__ndc-wrapper">
				<span class="selected-package__ndc-label">NDC:</span>
				<button
					type="button"
					class="selected-package__ndc"
					onclick={handleCopy}
					aria-label="Copy NDC {formatNDC(ndc)} to clipboard"
				>
					{formatNDC(ndc)}
				</button>
			</div>
		</div>
		<Badge variant={active ? 'success' : 'warning'} ariaLabel={active ? 'Status: Active' : 'Status: Inactive'}>
			{active ? '✓ Active' : 'Inactive'}
		</Badge>
	</div>
	
	<div class="selected-package__details">
		<div class="selected-package__detail">
			<span class="selected-package__detail-label">Package Size:</span>
			<span class="selected-package__detail-value">{packageSize}</span>
		</div>
		<div class="selected-package__detail">
			<span class="selected-package__detail-label">Packs:</span>
			<span class="selected-package__detail-value">{packs}</span>
		</div>
		<div class="selected-package__detail">
			<span class="selected-package__detail-label">Overfill:</span>
			<span class="selected-package__detail-value selected-package__overfill--{getOverfillColor(overfillPct)}">
				{overfillPct.toFixed(1)}%
			</span>
		</div>
	</div>
</div>

<style>
	.selected-package {
		background-color: var(--bg-secondary);
		border: 2px solid var(--primary-500);
		border-radius: var(--border-radius-md);
		padding: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	
	.selected-package__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	
	.selected-package__title-wrapper {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	
	.selected-package__product-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	
	.selected-package__brand-name {
		font-size: var(--text-base);
		font-weight: var(--font-semibold);
		color: var(--text-primary);
		text-transform: capitalize;
	}
	
	.selected-package__dosage-form {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	
	.selected-package__ndc-wrapper {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	
	.selected-package__ndc-label {
		font-size: var(--text-sm);
		font-weight: var(--font-medium);
		color: var(--text-secondary);
	}
	
	.selected-package__ndc {
		font-family: monospace;
		font-size: var(--text-base);
		font-weight: var(--font-semibold);
		color: var(--text-primary);
		background: none;
		border: none;
		cursor: pointer;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--border-radius-sm);
		transition: background-color 150ms ease;
	}
	
	.selected-package__ndc:hover {
		background-color: var(--gray-100);
	}
	
	.selected-package__ndc:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
	}
	
	.selected-package__details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: var(--space-3);
	}
	
	.selected-package__detail {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	
	.selected-package__detail-label {
		font-size: var(--text-xs);
		color: var(--text-secondary);
		font-weight: var(--font-medium);
	}
	
	.selected-package__detail-value {
		font-size: var(--text-base);
		color: var(--text-primary);
		font-weight: var(--font-semibold);
	}
	
	.selected-package__overfill--success {
		color: var(--success-500);
	}
	
	.selected-package__overfill--warning {
		color: var(--warning-500);
	}
	
	.selected-package__overfill--error {
		color: var(--error-500);
	}
	
	@media (min-width: 640px) {
		.selected-package__details {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>

