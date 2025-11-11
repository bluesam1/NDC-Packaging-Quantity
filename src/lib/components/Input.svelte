<script lang="ts">
	interface InputProps {
		type?: 'text' | 'number' | 'email' | 'tel' | 'url';
		id?: string;
		name?: string;
		label?: string;
		placeholder?: string;
		value?: string | number;
		required?: boolean;
		disabled?: boolean;
		error?: string;
		helperText?: string;
		ariaLabel?: string;
		ariaDescribedBy?: string;
		class?: string;
		oninput?: (event: Event) => void;
		onblur?: (event: Event) => void;
	}

	let {
		type = 'text',
		id,
		name,
		label,
		placeholder,
		value = $bindable(),
		required = false,
		disabled = false,
		error,
		helperText,
		ariaLabel,
		ariaDescribedBy,
		class: className = '',
		oninput,
		onblur,
		...restProps
	}: InputProps = $props();

	const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
	const errorId = error ? `${inputId}-error` : undefined;
	const helperId = helperText ? `${inputId}-helper` : undefined;
	const describedBy = [errorId, helperId, ariaDescribedBy].filter(Boolean).join(' ') || undefined;
</script>

<div class="input-wrapper {className}">
	{#if label}
		<label for={inputId} class="input-label">
			{label}
			{#if required}
				<span class="input-required" aria-label="required">*</span>
			{/if}
		</label>
	{/if}

	<input
		id={inputId}
		name={name}
		type={type}
		{placeholder}
		bind:value
		{required}
		{disabled}
		aria-label={ariaLabel || label}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy}
		aria-required={required ? 'true' : undefined}
		class="input input--{error ? 'error' : 'default'}"
		oninput={oninput}
		onblur={onblur}
		{...restProps}
	/>

	{#if error}
		<div id={errorId} class="input-error" role="alert">
			{error}
		</div>
	{/if}

	{#if helperText && !error}
		<div id={helperId} class="input-helper">
			{helperText}
		</div>
	{/if}
</div>

<style>
	.input-wrapper {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
	}

	.input-label {
		font-size: var(--text-sm);
		font-weight: var(--font-medium);
		color: var(--text-primary);
	}

	.input-required {
		color: var(--error-500);
		margin-left: var(--space-1);
	}

	.input {
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

	.input:focus {
		outline: none;
		border-color: var(--primary-500);
		box-shadow: 0 0 0 2px var(--primary-50);
	}

	.input:disabled {
		background-color: var(--gray-50);
		color: var(--text-tertiary);
		cursor: not-allowed;
		opacity: 0.6;
	}

	.input--error {
		border-color: var(--error-500);
	}

	.input--error:focus {
		border-color: var(--error-500);
		box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);
	}

	.input-error {
		font-size: var(--text-sm);
		color: var(--error-500);
		margin-top: var(--space-1);
	}

	.input-helper {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin-top: var(--space-1);
	}
</style>

