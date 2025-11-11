<script lang="ts">
	interface ButtonProps {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		disabled?: boolean;
		loading?: boolean;
		type?: 'button' | 'submit' | 'reset';
		ariaLabel?: string;
		class?: string;
		onclick?: (event: MouseEvent) => void;
	}

	let {
		variant = 'primary',
		disabled = false,
		loading = false,
		type = 'button',
		ariaLabel,
		class: className = '',
		onclick,
		children,
		...restProps
	}: ButtonProps & { children?: any } = $props();
</script>

<button
	type={type}
	disabled={disabled || loading}
	aria-label={ariaLabel}
	aria-busy={loading}
	class="button button--{variant} {className}"
	onclick={onclick}
	{...restProps}
>
	{#if loading}
		<span class="button__spinner" aria-hidden="true">⏳</span>
		<span class="sr-only">Loading...</span>
	{/if}
	{@render children()}
</button>

<style>
	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: 44px;
		padding: var(--space-3) var(--space-6);
		border-radius: var(--border-radius-md);
		font-size: var(--text-base);
		font-weight: var(--font-medium);
		line-height: 1.5;
		cursor: pointer;
		transition: all 150ms ease;
		border: none;
	}

	.button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.button:not(:disabled):active {
		transform: scale(0.98);
	}

	/* Primary Variant */
	.button--primary {
		background-color: var(--primary-500);
		color: white;
	}

	.button--primary:hover:not(:disabled) {
		background-color: var(--primary-600);
	}

	.button--primary:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
	}

	/* Secondary Variant */
	.button--secondary {
		background-color: transparent;
		color: var(--text-primary);
		border: 1px solid var(--gray-300);
	}

	.button--secondary:hover:not(:disabled) {
		background-color: var(--gray-50);
		border-color: var(--gray-400);
	}

	/* Ghost Variant */
	.button--ghost {
		background-color: transparent;
		color: var(--text-primary);
		border: none;
	}

	.button--ghost:hover:not(:disabled) {
		background-color: var(--gray-100);
	}

	/* Danger Variant */
	.button--danger {
		background-color: var(--error-500);
		color: white;
	}

	.button--danger:hover:not(:disabled) {
		background-color: #dc2626;
	}

	/* Loading State */
	.button__spinner {
		display: inline-block;
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

	/* Screen Reader Only */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>

