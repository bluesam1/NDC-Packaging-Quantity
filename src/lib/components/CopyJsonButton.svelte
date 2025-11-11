<script lang="ts">
	import { showToast } from '$lib/stores/toast';
	
	interface CopyJsonButtonProps {
		jsonData: unknown;
		onCopy?: () => void;
		class?: string;
	}
	
	let {
		jsonData,
		onCopy,
		class: className = '',
		...restProps
	}: CopyJsonButtonProps = $props();
	
	let copied = $state(false);
	
	async function handleCopy() {
		try {
			const jsonString = JSON.stringify(jsonData, null, 2);
			await navigator.clipboard.writeText(jsonString);
			copied = true;
			
			// Show toast notification
			showToast('success', 'JSON copied to clipboard');
			
			if (onCopy) {
				onCopy();
			}
			
			// Reset copied state after 2 seconds
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (error) {
			// Show error toast
			showToast('error', 'Failed to copy JSON to clipboard');
			console.error('Failed to copy JSON:', error);
		}
	}
</script>

<button
	onclick={handleCopy}
	aria-label="Copy JSON response to clipboard"
	class="copy-json-button {className}"
	title="Copy JSON response"
	{...restProps}
>
	{copied ? '✓' : '📋'}
</button>

<style>
	.copy-json-button {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--gray-200);
		border: 1px solid var(--gray-300);
		border-radius: var(--border-radius-md);
		cursor: pointer;
		color: var(--text-secondary);
		font-size: var(--text-base);
		transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
		padding: 0;
		flex-shrink: 0;
	}

	.copy-json-button:hover {
		background-color: var(--gray-300);
		color: var(--text-primary);
		border-color: var(--gray-400);
	}

	.copy-json-button:active {
		background-color: var(--gray-400);
	}

	.copy-json-button:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
	}
</style>

