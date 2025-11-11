<script lang="ts">
	import { Button } from '$lib/components';
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

<Button
	variant="secondary"
	onclick={handleCopy}
	ariaLabel="Copy JSON response to clipboard"
	class="copy-json-button {className}"
	{...restProps}
>
	{copied ? '✓ Copied!' : '📋 Copy JSON Response'}
</Button>

<style>
	.copy-json-button {
		width: 100%;
		margin-top: var(--space-4);
	}
	
	@media (min-width: 640px) {
		.copy-json-button {
			width: auto;
			min-width: 200px;
		}
	}
</style>

