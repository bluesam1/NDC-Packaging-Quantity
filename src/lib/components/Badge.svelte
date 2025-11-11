<script lang="ts">
	interface BadgeProps {
		variant?: 'success' | 'warning' | 'error' | 'info';
		ariaLabel?: string;
		class?: string;
	}

	let {
		variant = 'info',
		ariaLabel,
		class: className = '',
		children,
		...restProps
	}: BadgeProps & { children?: any } = $props();
</script>

<span
	class="badge badge--{variant} {className}"
	aria-label={ariaLabel}
	{...restProps}
>
	{@render children()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		padding: var(--space-1) var(--space-2);
		border-radius: 9999px;
		font-size: var(--text-xs);
		font-weight: var(--font-medium);
		line-height: 1.5;
	}

	.badge--success {
		background-color: rgba(16, 185, 129, 0.1);
		color: var(--success-500);
	}

	.badge--warning {
		background-color: rgba(245, 158, 11, 0.1);
		color: var(--warning-500);
	}

	.badge--error {
		background-color: rgba(239, 68, 68, 0.1);
		color: var(--error-500);
	}

	.badge--info {
		background-color: rgba(6, 182, 212, 0.1);
		color: var(--info-500);
	}
</style>

