<script lang="ts">
	interface QuantityDisplayProps {
		quantity: number;
		unit: string;
		class?: string;
	}
	
	let {
		quantity,
		unit,
		class: className = '',
		...restProps
	}: QuantityDisplayProps = $props();
</script>

<div class="quantity-display {className}" {...restProps}>
	<div class="quantity-display__number">{quantity}</div>
	<div class="quantity-display__unit">{unit}</div>
</div>

<style>
	.quantity-display {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-6) 0;
		animation: fadeIn 300ms ease-out;
	}
	
	.quantity-display__number {
		font-size: var(--text-5xl);
		font-weight: var(--font-bold);
		color: var(--primary-600);
		line-height: 1;
	}
	
	.quantity-display__unit {
		font-size: var(--text-2xl);
		color: var(--text-secondary);
		font-weight: var(--font-medium);
	}
	
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>




