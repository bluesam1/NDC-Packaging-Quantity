<script lang="ts">
	import calculatorIcon from '$lib/assets/favicon.svg';
</script>

<header class="header">
	<div class="header__container">
		<div class="header__brand">
			<img src={calculatorIcon} alt="" class="header__icon" aria-hidden="true" />
			<h1 class="header__title">
				<span class="header__title-acronym">NPQC</span>
				<span class="header__title-full">NDC Packaging & Quantity Calculator</span>
			</h1>
		</div>
	</div>
</header>

<style>
	.header {
		position: sticky;
		top: 0;
		z-index: 100;
		background-color: var(--bg-primary);
		border-bottom: 1px solid var(--gray-200);
		box-shadow: var(--shadow-sm);
		height: 64px;
		display: flex;
		align-items: center;
	}

	.header__container {
		max-width: var(--container-max-width);
		width: 100%;
		margin: 0 auto;
		padding: 0 var(--space-4);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header__brand {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.header__icon {
		width: 32px;
		height: 32px;
		flex-shrink: 0;
	}

	.header__title {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		margin: 0;
		font-size: var(--text-xl);
		font-weight: var(--font-semibold);
		color: var(--text-primary);
		line-height: 1.2;
	}

	.header__title-acronym {
		font-size: var(--text-2xl);
		font-weight: var(--font-bold);
		color: var(--primary-600);
		letter-spacing: -0.5px;
	}

	.header__title-full {
		font-size: var(--text-base);
		font-weight: var(--font-medium);
		color: var(--text-secondary);
		display: none;
	}

	@media (min-width: 640px) {
		.header__title-full {
			display: inline;
		}
		
		.header__icon {
			width: 36px;
			height: 36px;
		}
	}

	@media (min-width: 768px) {
		.header__title {
			font-size: var(--text-2xl);
		}
		
		.header__title-acronym {
			font-size: var(--text-3xl);
		}
		
		.header__title-full {
			font-size: var(--text-lg);
		}
	}
</style>

