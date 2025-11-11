<script lang="ts">
	import { toastStore, dismissToast } from '$lib/stores/toast';
	import Toast from './Toast.svelte';
	
	let toasts = $state<Array<{ id: string; type: 'success' | 'warning' | 'error' | 'info'; message: string; duration?: number }>>([]);
	
	// Subscribe to toast store
	toastStore.subscribe((value) => {
		toasts = value;
	});
</script>

{#if toasts.length > 0}
	<div class="toast-container" aria-live="polite" aria-label="Notifications">
		{#each toasts as toast (toast.id)}
			<Toast
				id={toast.id}
				type={toast.type}
				message={toast.message}
				duration={toast.duration}
				onDismiss={dismissToast}
			/>
		{/each}
	</div>
{/if}

<style>
	.toast-container {
		position: fixed;
		top: var(--space-4);
		right: var(--space-4);
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		pointer-events: none;
	}
	
	.toast-container > :global(*) {
		pointer-events: auto;
	}
	
	@media (max-width: 1023px) {
		.toast-container {
			top: var(--space-4);
			right: auto;
			left: 50%;
			transform: translateX(-50%);
		}
	}
</style>





