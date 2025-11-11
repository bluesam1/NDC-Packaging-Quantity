<script lang="ts">
	interface CardProps {
		class?: string;
	}

	let { class: className = '', children, ...restProps }: CardProps & { children?: any } = $props();
</script>

<div class="card {className}" {...restProps}>
	{@render children()}
</div>

<style>
	.card {
		background-color: var(--bg-elevated);
		border-radius: var(--border-radius-lg);
		padding: var(--space-6);
		box-shadow: var(--shadow-md);
		transition: box-shadow 200ms ease;
	}

	.card:hover {
		box-shadow: var(--shadow-lg);
	}
</style>

