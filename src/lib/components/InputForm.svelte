<script lang="ts">
	import { Button, Input, Card } from '$lib/components';
	import ImageUpload from './ImageUpload.svelte';
	import AdvancedOptions from './AdvancedOptions.svelte';
	import {
		validateDrugInput,
		validateSig,
		validateDaysSupply,
		normalizeNDC,
		parseNDCString
	} from '$lib/utils/validation';
	import { testFormDataStore, testSubmitTriggerStore, clearTestFormData } from '$lib/stores/testControl';
	import { extractPrescriptionFromImage, getErrorMessage, ApiError } from '$lib/services/api';
	
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

	// OCR state
	let ocrLoading = $state(false);
	let ocrError = $state<string | null>(null);
	let ocrSuccessMessage = $state<string | null>(null);
	let ocrSuccessTimeout: ReturnType<typeof setTimeout> | null = $state(null);
	
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

	async function handleImageUpload(file: File) {
		ocrLoading = true;
		ocrError = null;
		ocrSuccessMessage = null;

		// Clear any existing timeout
		if (ocrSuccessTimeout) {
			clearTimeout(ocrSuccessTimeout);
			ocrSuccessTimeout = null;
		}

		// Validate file before processing
		const acceptedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
		const maxSize = 10 * 1024 * 1024; // 10MB

		if (!acceptedFormats.includes(file.type)) {
			ocrError = 'Invalid file format. Please upload JPG, PNG, or PDF files.';
			ocrLoading = false;
			return;
		}

		if (file.size > maxSize) {
			ocrError = `File size exceeds 10MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`;
			ocrLoading = false;
			return;
		}

		try {
			const result = await extractPrescriptionFromImage(file);

			// Populate form fields with extracted data
			if (result.data.drug_input) {
				drugInput = result.data.drug_input;
				validateField('drug_input', drugInput);
			}
			if (result.data.sig) {
				sig = result.data.sig;
				validateField('sig', sig);
			}
			if (result.data.days_supply !== undefined && result.data.days_supply !== null) {
				daysSupply = result.data.days_supply;
				validateField('days_supply', daysSupply);
			}

			// Build success message
			const fieldNames: Record<string, string> = {
				drug_input: 'Drug Name',
				sig: 'SIG',
				days_supply: 'Days Supply',
			};

			const foundFields = result.fields_found.map((field) => fieldNames[field] || field);
			const missingFields = ['drug_input', 'sig', 'days_supply']
				.filter((field) => !result.fields_found.includes(field))
				.map((field) => fieldNames[field] || field);

			if (foundFields.length > 0) {
				let message = `Found and populated: ${foundFields.join(', ')}`;
				if (missingFields.length > 0) {
					message += ` (${missingFields.join(', ')} not found)`;
				}
				ocrSuccessMessage = message;

				// Auto-dismiss after 8 seconds
				ocrSuccessTimeout = setTimeout(() => {
					ocrSuccessMessage = null;
					ocrSuccessTimeout = null;
				}, 8000);
			} else {
				ocrError = 'No prescription data could be extracted from the image. Please try again or enter manually.';
			}
		} catch (error) {
			if (error instanceof ApiError) {
				ocrError = getErrorMessage(error);
			} else {
				ocrError = error instanceof Error ? error.message : 'Failed to extract prescription data. Please try again.';
			}
		} finally {
			ocrLoading = false;
		}
	}

	function dismissSuccessMessage() {
		ocrSuccessMessage = null;
		if (ocrSuccessTimeout) {
			clearTimeout(ocrSuccessTimeout);
			ocrSuccessTimeout = null;
		}
	}

	// Subscribe to test form data store for programmatic test control
	import { onMount } from 'svelte';
	
	// Reactive state for test form data
	let testFormDataValue = $state<{ drug_input: string; sig: string; days_supply: number; preferred_ndcs?: string[]; quantity_unit_override?: 'tab' | 'cap' | 'mL' | 'actuation' | 'unit' } | null>(null);
	let testSubmitTriggerValue = $state(0);
	
	// Subscribe to test form data store
	let unsubscribeTestForm: (() => void) | null = null;
	let unsubscribeTestSubmit: (() => void) | null = null;
	
	// Use onMount to set up subscriptions
	onMount(() => {
		// Subscribe to test form data
		unsubscribeTestForm = testFormDataStore.subscribe((data) => {
			if (data) {
				console.log('Test form data received:', data);
				// Set form values from test data immediately
				drugInput = data.drug_input;
				sig = data.sig;
				daysSupply = data.days_supply;
				preferredNDCs = data.preferred_ndcs;
				quantityUnitOverride = data.quantity_unit_override;
				
				console.log('Form values set:', { drugInput, sig, daysSupply });
				
				// Clear validation errors
				drugInputError = null;
				sigError = null;
				daysSupplyError = null;
				
				// Mark fields as touched so validation runs
				touchedFields.add('drug_input');
				touchedFields.add('sig');
				touchedFields.add('days_supply');
				
				// Validate fields
				validateField('drug_input', drugInput);
				validateField('sig', sig);
				validateField('days_supply', daysSupply);
			}
		});
		
		// Subscribe to test submit trigger
		unsubscribeTestSubmit = testSubmitTriggerStore.subscribe((trigger) => {
			if (trigger > 0 && trigger !== testSubmitTriggerValue) {
				console.log('Test submit trigger:', trigger);
				testSubmitTriggerValue = trigger;
				// Wait for form values to update and validation to complete
				setTimeout(() => {
					// Re-validate to ensure form is valid
					validateField('drug_input', drugInput);
					validateField('sig', sig);
					validateField('days_supply', daysSupply);
					
					console.log('Form valid after validation:', isFormValid, 'Loading:', loading);
					
					// Wait another tick for validation to complete
					setTimeout(() => {
						if (isFormValid && !loading) {
							console.log('Submitting form via test trigger');
							// Trigger form submission
							const form = document.querySelector('.input-form') as HTMLFormElement;
							if (form) {
								const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
								form.dispatchEvent(submitEvent);
							}
						} else {
							console.log('Form not ready to submit:', { isFormValid, loading });
						}
					}, 100);
				}, 100);
			}
		});
		
		return () => {
			if (unsubscribeTestForm) unsubscribeTestForm();
			if (unsubscribeTestSubmit) unsubscribeTestSubmit();
			if (ocrSuccessTimeout) {
				clearTimeout(ocrSuccessTimeout);
			}
		};
	});
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
			<ImageUpload
				onUpload={handleImageUpload}
				loading={ocrLoading}
				error={ocrError}
				class="input-form__image-upload"
			/>

			{#if ocrSuccessMessage}
				<div class="input-form__success-message" role="alert">
					<span class="input-form__success-icon">✓</span>
					<span class="input-form__success-text">{ocrSuccessMessage}</span>
					<button
						type="button"
						onclick={dismissSuccessMessage}
						class="input-form__success-dismiss"
						aria-label="Dismiss success message"
					>
						✕
					</button>
				</div>
			{/if}
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
	
	.input-form__image-upload {
		margin-bottom: var(--space-4);
	}

	.input-form__success-message {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4);
		background-color: var(--success-50, #f0fdf4);
		border: 1px solid var(--success-300, #86efac);
		border-radius: var(--border-radius-md);
		color: var(--success-700, #15803d);
		font-size: var(--text-sm);
		margin-bottom: var(--space-4);
	}

	.input-form__success-icon {
		font-size: var(--text-lg);
		flex-shrink: 0;
	}

	.input-form__success-text {
		flex: 1;
	}

	.input-form__success-dismiss {
		background: none;
		border: none;
		color: var(--success-700, #15803d);
		cursor: pointer;
		padding: var(--space-1);
		font-size: var(--text-lg);
		line-height: 1;
		opacity: 0.7;
		transition: opacity 150ms ease;
		flex-shrink: 0;
	}

	.input-form__success-dismiss:hover {
		opacity: 1;
	}

	.input-form__success-dismiss:focus-visible {
		outline: 2px solid var(--success-500, #22c55e);
		outline-offset: 2px;
		border-radius: var(--border-radius-sm);
	}
	
	@media (min-width: 640px) {
		.input-form__submit {
			width: auto;
			min-width: 200px;
		}
	}
</style>

