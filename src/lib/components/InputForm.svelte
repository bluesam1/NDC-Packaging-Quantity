<script lang="ts">
	import { Button, Input, Card } from '$lib/components';
	import AdvancedOptions from './AdvancedOptions.svelte';
	import {
		validateDrugInput,
		validateSig,
		validateDaysSupply,
		normalizeNDC,
		parseNDCString
	} from '$lib/utils/validation';
	
	// Import type from backend (we'll create a shared types file or duplicate for now)
	export type ComputeRequest = {
		drug_input: string;
		sig: string;
		days_supply: number;
		preferred_ndcs?: string[];
		quantity_unit_override?: 'tab' | 'cap' | 'mL' | 'actuation' | 'unit';
	};
	
	interface InputFormProps {
		onSubmit?: (data: ComputeRequest) => void;
		loading?: boolean;
		class?: string;
	}
	
	let {
		onSubmit,
		loading = false,
		class: className = '',
		...restProps
	}: InputFormProps = $props();
	
	// Form state
	let drugInput = $state('');
	let sig = $state('');
	let daysSupply = $state<number | string>(30);
	let preferredNDCs = $state<string[] | undefined>(undefined);
	let quantityUnitOverride = $state<'tab' | 'cap' | 'mL' | 'actuation' | 'unit' | undefined>(undefined);
	let maxOverfill = $state<number | undefined>(10);
	
	// Validation state
	let drugInputError = $state<string | null>(null);
	let sigError = $state<string | null>(null);
	let daysSupplyError = $state<string | null>(null);
	let touchedFields = $state<Set<string>>(new Set());
	
	// Check if form is valid
	let isFormValid = $derived(
		!drugInputError && 
		!sigError && 
		!daysSupplyError && 
		drugInput.trim().length > 0 && 
		sig.trim().length > 0 && 
		daysSupply !== null && 
		daysSupply !== undefined && 
		daysSupply !== ''
	);
	
	function validateField(field: string, value: string | number) {
		let error: { field: string; message: string } | null = null;
		
		switch (field) {
			case 'drug_input':
				error = validateDrugInput(value as string);
				drugInputError = error?.message || null;
				break;
			case 'sig':
				error = validateSig(value as string);
				sigError = error?.message || null;
				break;
			case 'days_supply':
				error = validateDaysSupply(value);
				daysSupplyError = error?.message || null;
				break;
		}
		
		return error === null;
	}
	
	function handleBlur(field: string, value: string | number) {
		touchedFields.add(field);
		validateField(field, value);
	}
	
	function handleDrugInputChange(value: string) {
		drugInput = value;
		if (touchedFields.has('drug_input')) {
			validateField('drug_input', value);
		}
	}
	
	function handleSigChange(value: string) {
		sig = value;
		if (touchedFields.has('sig')) {
			validateField('sig', value);
		}
	}
	
	function handleDaysSupplyChange(value: string | number) {
		daysSupply = value;
		if (touchedFields.has('days_supply')) {
			validateField('days_supply', value);
		}
	}
	
	function handleSubmit(event: Event) {
		event.preventDefault();
		
		// Mark all fields as touched
		touchedFields.add('drug_input');
		touchedFields.add('sig');
		touchedFields.add('days_supply');
		
		// Validate all fields
		const drugInputValid = validateField('drug_input', drugInput);
		const sigValid = validateField('sig', sig);
		const daysSupplyValid = validateField('days_supply', daysSupply);
		
		if (!drugInputValid || !sigValid || !daysSupplyValid) {
			return;
		}
		
		// Prepare request data
		const request: ComputeRequest = {
			drug_input: drugInput.trim(),
			sig: sig.trim(),
			days_supply: typeof daysSupply === 'string' ? parseInt(daysSupply, 10) : daysSupply,
		};
		
		// Add optional fields if present
		if (preferredNDCs && preferredNDCs.length > 0) {
			request.preferred_ndcs = preferredNDCs.map(ndc => normalizeNDC(ndc));
		}
		
		if (quantityUnitOverride) {
			request.quantity_unit_override = quantityUnitOverride;
		}
		
		// Emit submit event
		if (onSubmit) {
			onSubmit(request);
		}
	}
	
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && isFormValid && !loading) {
			handleSubmit(event);
		}
	}
</script>

<form
	class="input-form {className}"
	onsubmit={handleSubmit}
	onkeydown={handleKeyDown}
	{...restProps}
>
	<Card>
		<h2 class="input-form__title">Calculate Quantity</h2>
		
		<div class="input-form__fields">
			<Input
				label="Drug Name or NDC"
				placeholder="e.g., amoxicillin 500 mg cap or 00000-1111-22"
				bind:value={drugInput}
				required={true}
				error={drugInputError || undefined}
				onblur={() => handleBlur('drug_input', drugInput)}
				oninput={(e) => handleDrugInputChange((e.target as HTMLInputElement).value)}
			/>
			
			<Input
				label="SIG (Directions)"
				placeholder="e.g., 1 cap PO BID"
				bind:value={sig}
				required={true}
				error={sigError || undefined}
				helperText="Enter the prescription directions as written"
				onblur={() => handleBlur('sig', sig)}
				oninput={(e) => handleSigChange((e.target as HTMLInputElement).value)}
			/>
			
			<Input
				type="number"
				label="Days Supply"
				placeholder="30"
				bind:value={daysSupply}
				required={true}
				error={daysSupplyError || undefined}
				onblur={() => handleBlur('days_supply', daysSupply)}
				oninput={(e) => {
					const val = (e.target as HTMLInputElement).value;
					handleDaysSupplyChange(val === '' ? '' : parseInt(val, 10));
				}}
			/>
			
			<AdvancedOptions
				bind:preferredNDCs
				bind:quantityUnitOverride
				bind:maxOverfill
			/>
			
			<Button
				type="submit"
				variant="primary"
				disabled={!isFormValid || loading}
				loading={loading}
				ariaLabel={loading ? 'Calculating...' : 'Calculate quantity'}
				class="input-form__submit"
			>
				{loading ? 'Calculating...' : 'Calculate'}
			</Button>
		</div>
	</Card>
</form>

<style>
	.input-form {
		width: 100%;
	}
	
	.input-form__title {
		font-size: var(--text-2xl);
		font-weight: var(--font-semibold);
		color: var(--text-primary);
		margin-bottom: var(--space-6);
	}
	
	.input-form__fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	
	.input-form__submit {
		width: 100%;
		margin-top: var(--space-4);
	}
	
	@media (min-width: 640px) {
		.input-form__submit {
			width: auto;
			min-width: 200px;
		}
	}
</style>

