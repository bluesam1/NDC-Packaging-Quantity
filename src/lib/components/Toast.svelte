<script lang="ts">
	import type { ToastType } from '$lib/stores/toast';
	
	interface ToastProps {
		id: string;
		type: ToastType;
		message: string;
		duration?: number;
		onDismiss?: (id: string) => void;
		class?: string;
	}
	
	let {
		id,
		type,
		message,
		duration = 3000,
		onDismiss,
		class: className = '',
		...restProps
	}: ToastProps = $props();
	
	let isVisible = $state(true);
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	
	function getIcon(type: ToastType): string {
		switch (type) {
			case 'success':
				return '✓';
			case 'warning':
				return '⚠️';
			case 'error':
				return '❌';
			case 'info':
				return 'ℹ️';
			default:
				return 'ℹ️';
		}
	}
	
	function dismiss() {
		isVisible = false;
		// Wait for animation to complete before removing
		setTimeout(() => {
			if (onDismiss) {
				onDismiss(id);
			}
		}, 200);
	}
	
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			dismiss();
		}
	}
	
	// Auto-dismiss after duration
	if (duration > 0) {
		timeoutId = setTimeout(() => {
			dismiss();
		}, duration);
	}
	
	// Cleanup on unmount
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	});
</script>

{#if isVisible}
	<div
		class="toast toast--{type} {className}"
		role={type === 'error' ? 'alert' : 'status'}
		aria-live={type === 'error' ? 'assertive' : 'polite'}
		onkeydown={handleKeyDown}
		tabindex="-1"
		{...restProps}
	>
		<div class="toast__icon" aria-hidden="true">{getIcon(type)}</div>
		<div class="toast__message">{message}</div>
		<button
			type="button"
			class="toast__dismiss"
			onclick={dismiss}
			aria-label="Dismiss notification"
		>
			×
		</button>
	</div>
{/if}

<style>
	.toast {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 300px;
		max-width: 500px;
		padding: var(--space-4);
		border-radius: var(--border-radius-md);
		box-shadow: var(--shadow-lg);
		background-color: var(--bg-elevated);
		animation: slideIn 300ms ease-out;
		position: relative;
	}
	
	.toast--success {
		border-left: 4px solid var(--success-500);
	}
	
	.toast--warning {
		border-left: 4px solid var(--warning-500);
	}
	
	.toast--error {
		border-left: 4px solid var(--error-500);
	}
	
	.toast--info {
		border-left: 4px solid var(--info-500);
	}
	
	.toast__icon {
		font-size: var(--text-xl);
		flex-shrink: 0;
	}
	
	.toast__message {
		flex: 1;
		font-size: var(--text-sm);
		color: var(--text-primary);
		line-height: 1.5;
	}
	
	.toast__dismiss {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		font-size: var(--text-xl);
		color: var(--text-secondary);
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--border-radius-sm);
		transition: background-color 150ms ease, color 150ms ease;
	}
	
	.toast__dismiss:hover {
		background-color: var(--gray-100);
		color: var(--text-primary);
	}
	
	.toast__dismiss:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
	}
	
	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
	
	@media (max-width: 1023px) {
		.toast {
			min-width: auto;
			max-width: 90%;
		}
		
		@keyframes slideIn {
			from {
				transform: translateY(-100%);
				opacity: 0;
			}
			to {
				transform: translateY(0);
				opacity: 1;
			}
		}
	}
</style>





