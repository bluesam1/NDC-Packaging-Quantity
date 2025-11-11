<script lang="ts">
	interface TestMenuButtonProps {
		onClick?: () => void;
		class?: string;
	}

	let {
		onClick,
		class: className = '',
		...restProps
	}: TestMenuButtonProps = $props();

	function handleClick() {
		if (onClick) {
			onClick();
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick();
		}
	}
</script>

<button
	class="test-menu-button {className}"
	onclick={handleClick}
	onkeydown={handleKeyDown}
	aria-label="Open test suite menu"
	aria-haspopup="dialog"
	{...restProps}
>
	<svg
		class="test-menu-button__icon"
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44L2.5 19.5" />
		<path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44L21.5 19.5" />
		<path d="M9 12h6" />
	</svg>
	<span class="sr-only">Open test suite menu</span>
</button>

<style>
	.test-menu-button {
		position: fixed;
		bottom: 24px;
		right: 24px;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background-color: var(--primary-500);
		color: white;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--shadow-lg);
		z-index: 1000;
		transition: all 150ms ease;
	}

	.test-menu-button:hover {
		background-color: var(--primary-600);
		transform: scale(1.05);
		box-shadow: var(--shadow-xl);
	}

	.test-menu-button:active {
		transform: scale(0.98);
	}

	.test-menu-button:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 4px;
	}

	.test-menu-button__icon {
		width: 24px;
		height: 24px;
	}

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

	@media (prefers-reduced-motion: reduce) {
		.test-menu-button {
			transition: none;
		}
	}
</style>


