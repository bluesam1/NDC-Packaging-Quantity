<script lang="ts">
	import { Input, Button } from '$lib/components';
	import { parseNDCString, validatePreferredNDCs, validateQuantityUnitOverride, validateMaxOverfill } from '$lib/utils/validation';
	
	interface AdvancedOptionsProps {
		preferredNDCs?: string[];
		quantityUnitOverride?: 'tab' | 'cap' | 'mL' | 'actuation' | 'unit';
		maxOverfill?: number;
		class?: string;
	}
	
	let {
		preferredNDCs = $bindable(),
		quantityUnitOverride = $bindable(),
		maxOverfill: maxOverfillProp = $bindable(10),
		class: className = '',
		...restProps
	}: AdvancedOptionsProps = $props();
	
	let maxOverfill = $state(maxOverfillProp);
	
	let isExpanded = $state(false);
	let preferredNDCsString = $state(preferredNDCs?.join(', ') || '');
	let preferredNDCsError = $state<string | null>(null);
	let maxOverfillError = $state<string | null>(null);
	
	const unitOptions: Array<{ value: 'tab' | 'cap' | 'mL' | 'actuation' | 'unit'; label: string }> = [
		{ value: 'tab', label: 'Tablet (tab)' },
		{ value: 'cap', label: 'Capsule (cap)' },
		{ value: 'mL', label: 'Milliliter (mL)' },
		{ value: 'actuation', label: 'Actuation' },
		{ value: 'unit', label: 'Unit' },
	];
	
	function toggleExpanded() {
		isExpanded = !isExpanded;
	}
	
	function handlePreferredNDCsChange(value: string) {
		preferredNDCsString = value;
		const ndcs = parseNDCString(value);
		const error = validatePreferredNDCs(ndcs);
		preferredNDCsError = error?.message || null;
		if (!error) {
			preferredNDCs = ndcs.length > 0 ? ndcs : undefined;
		}
	}
	
	function handleMaxOverfillChange(value: string | number) {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		const newValue = isNaN(num) ? undefined : num;
		maxOverfill = newValue ?? 10;
		maxOverfillProp = newValue ?? 10;
		const error = validateMaxOverfill(value);
		maxOverfillError = error?.message || null;
	}
	
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleExpanded();
		} else if (event.key === 'Escape' && isExpanded) {
			isExpanded = false;
		}
	}
</script>

<div class="advanced-options {className}" {...restProps}>
	<button
		type="button"
		class="advanced-options__toggle"
		onclick={toggleExpanded}
		onkeydown={handleKeyDown}
		aria-expanded={isExpanded}
		aria-controls="advanced-options-content"
	>
		<span class="advanced-options__toggle-text">Advanced Options</span>
		<span class="advanced-options__chevron" class:expanded={isExpanded} aria-hidden="true">▼</span>
	</button>
	
	{#if isExpanded}
		<div id="advanced-options-content" class="advanced-options__content">
			<Input
				label="Preferred NDCs"
				placeholder="e.g., 00000-1111-22, 00000-2222-33"
				helperText="Enter up to 10 NDCs separated by commas"
				bind:value={preferredNDCsString}
				oninput={(e) => handlePreferredNDCsChange((e.target as HTMLInputElement).value)}
				error={preferredNDCsError || undefined}
			/>
			
			<div class="advanced-options__field">
				<label for="quantity-unit-override" class="input-label">
					Quantity Unit Override
				</label>
				<select
					id="quantity-unit-override"
					bind:value={quantityUnitOverride}
					class="input"
				>
					<option value="">Default (auto-detect)</option>
					{#each unitOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
			
			<Input
				type="number"
				label="Max Overfill (%)"
				placeholder="10"
				helperText="Maximum allowed overfill percentage (0-100)"
				bind:value={maxOverfill}
				oninput={(e) => {
					const val = (e.target as HTMLInputElement).value;
					handleMaxOverfillChange(val === '' ? '' : parseFloat(val));
				}}
				error={maxOverfillError || undefined}
			/>
		</div>
	{/if}
</div>

<style>
	.advanced-options {
		width: 100%;
	}
	
	.advanced-options__toggle {
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
	
	.advanced-options__toggle:hover {
		background-color: var(--gray-50);
		border-color: var(--gray-400);
	}
	
	.advanced-options__toggle:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
	}
	
	.advanced-options__toggle-text {
		font-weight: var(--font-medium);
	}
	
	.advanced-options__chevron {
		transition: transform 300ms ease-in-out;
		font-size: var(--text-sm);
	}
	
	.advanced-options__chevron.expanded {
		transform: rotate(180deg);
	}
	
	.advanced-options__content {
		margin-top: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
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
	
	.advanced-options__field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	
	.advanced-options__field select {
		min-height: 44px;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--gray-300);
		border-radius: var(--border-radius-md);
		font-size: var(--text-base);
		color: var(--text-primary);
		background-color: var(--bg-primary);
		transition: border-color 150ms ease, box-shadow 150ms ease;
		width: 100%;
	}
	
	.advanced-options__field select:focus {
		outline: none;
		border-color: var(--primary-500);
		box-shadow: 0 0 0 2px var(--primary-50);
	}
</style>

