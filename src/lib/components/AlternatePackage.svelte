<script lang="ts">
	import { Badge } from '$lib/components';
	import { showToast } from '$lib/stores/toast';
	
	interface AlternatePackageProps {
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
	}: AlternatePackageProps = $props();
	
	function formatNDC(ndc: string): string {
		if (ndc.length === 11 && !ndc.includes('-')) {
			return `${ndc.slice(0, 5)}-${ndc.slice(5, 9)}-${ndc.slice(9)}`;
		}
		return ndc;
	}
	
	function getOverfillColor(overfill: number): 'success' | 'warning' | 'error' {
		// overfill is a decimal (0.0227 = 2.27%), convert to percentage for comparison
		const overfillPercent = overfill * 100;
		if (overfillPercent === 0) return 'success';
		if (overfillPercent > 10) return 'error';
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

<div class="alternate-package {className}" {...restProps}>
	<div class="alternate-package__header">
		<div class="alternate-package__title-wrapper">
			{#if brandName || dosageForm}
				<div class="alternate-package__product-info">
					{#if brandName}
						<span class="alternate-package__brand-name">{brandName}</span>
					{/if}
					{#if dosageForm}
						<span class="alternate-package__dosage-form">{dosageForm}</span>
					{/if}
				</div>
			{/if}
			<div class="alternate-package__ndc-wrapper">
				<span class="alternate-package__ndc-label">NDC:</span>
				<button
					type="button"
					class="alternate-package__ndc"
					onclick={handleCopy}
					aria-label="Copy NDC {formatNDC(ndc)} to clipboard"
				>
					{formatNDC(ndc)}
				</button>
			</div>
		</div>
		<Badge variant={active ? 'success' : 'warning'} ariaLabel={active ? 'Status: Active' : 'Status: Inactive'}>
			{active ? 'Active' : 'Inactive'}
		</Badge>
	</div>
	
	<div class="alternate-package__details">
		<div class="alternate-package__detail">
			<span class="alternate-package__detail-label">Package Size:</span>
			<span class="alternate-package__detail-value">{packageSize}</span>
		</div>
		<div class="alternate-package__detail">
			<span class="alternate-package__detail-label">Packs:</span>
			<span class="alternate-package__detail-value">{packs}</span>
		</div>
		<div class="alternate-package__detail">
			<span class="alternate-package__detail-label">Overfill:</span>
			<span class="alternate-package__detail-value alternate-package__overfill--{getOverfillColor(overfillPct)}">
				{(overfillPct * 100).toFixed(1)}%
			</span>
		</div>
	</div>
</div>

<style>
	.alternate-package {
		background-color: var(--bg-elevated);
		border: 1px solid var(--gray-200);
		border-radius: var(--border-radius-md);
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		transition: all 150ms ease;
	}
	
	.alternate-package:hover {
		background-color: var(--gray-50);
		border-color: var(--gray-300);
		box-shadow: var(--shadow-sm);
	}
	
	.alternate-package__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	
	.alternate-package__title-wrapper {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	
	.alternate-package__product-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	
	.alternate-package__brand-name {
		font-size: var(--text-sm);
		font-weight: var(--font-semibold);
		color: var(--text-primary);
		text-transform: capitalize;
	}
	
	.alternate-package__dosage-form {
		font-size: var(--text-xs);
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	
	.alternate-package__ndc-wrapper {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	
	.alternate-package__ndc-label {
		font-size: var(--text-xs);
		font-weight: var(--font-medium);
		color: var(--text-secondary);
	}
	
	.alternate-package__ndc {
		font-family: monospace;
		font-size: var(--text-sm);
		font-weight: var(--font-semibold);
		color: var(--text-primary);
		background: none;
		border: none;
		cursor: pointer;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--border-radius-sm);
		transition: background-color 150ms ease;
	}
	
	.alternate-package__ndc:hover {
		background-color: var(--gray-100);
	}
	
	.alternate-package__ndc:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
	}
	
	.alternate-package__details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: var(--space-2);
	}
	
	.alternate-package__detail {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	
	.alternate-package__detail-label {
		font-size: var(--text-xs);
		color: var(--text-secondary);
		font-weight: var(--font-medium);
	}
	
	.alternate-package__detail-value {
		font-size: var(--text-sm);
		color: var(--text-primary);
		font-weight: var(--font-semibold);
	}
	
	.alternate-package__overfill--success {
		color: var(--success-500);
	}
	
	.alternate-package__overfill--warning {
		color: var(--warning-500);
	}
	
	.alternate-package__overfill--error {
		color: var(--error-500);
	}
</style>

