<script lang="ts">
	import { Badge } from '$lib/components';
	import type { ComputeResponse } from '$lib/types/api';

	interface ReasoningSectionProps {
		reasoning: NonNullable<ComputeResponse['reasoning']>;
		class?: string;
	}

	let {
		reasoning,
		class: className = '',
		...restProps
	}: ReasoningSectionProps = $props();

	let apiCallsExpanded = $state(false);
	let sigParsingExpanded = $state(false);
	let dosageFormExpanded = $state(false);
	let quantityCalcExpanded = $state(false);
	let packageSelectionExpanded = $state(false);

	function formatNDC(ndc: string): string {
		if (ndc.length === 11 && !ndc.includes('-')) {
			return `${ndc.slice(0, 5)}-${ndc.slice(5, 9)}-${ndc.slice(9)}`;
		}
		return ndc;
	}

	function formatNumber(num: number, decimals = 0): string {
		return num.toFixed(decimals);
	}

	function formatPercentage(num: number): string {
		return `${(num * 100).toFixed(1)}%`;
	}
</script>

<div class="reasoning-section {className}" {...restProps} aria-label="Reasoning and calculation details">
	<h3 class="reasoning-section__title">Reasoning</h3>
	
	<div class="reasoning-section__content">
		<!-- API Calls -->
		<div class="reasoning-section__step">
			<button 
				type="button"
				class="reasoning-section__toggle"
				onclick={() => apiCallsExpanded = !apiCallsExpanded}
				aria-expanded={apiCallsExpanded}
				aria-controls="api-calls-details"
			>
				<Badge variant="info" ariaLabel="API Calls">
					API Calls
				</Badge>
				<span class="reasoning-section__toggle-icon" aria-hidden="true">
					{apiCallsExpanded ? '▼' : '▶'}
				</span>
			</button>
			{#if apiCallsExpanded}
				<div id="api-calls-details" class="reasoning-section__details">
					{#if reasoning.api_calls.rxnorm}
						<div class="reasoning-section__detail-item">
							<strong>RxNorm:</strong>
							{#if reasoning.api_calls.rxnorm.failed}
								<span class="reasoning-section__error">Failed</span>
							{:else}
								<div class="reasoning-section__nested">
									<div>RxCUI: {reasoning.api_calls.rxnorm.rxcui || 'N/A'}</div>
									<div>Name: {reasoning.api_calls.rxnorm.name || 'N/A'}</div>
									<div>NDCs found: {reasoning.api_calls.rxnorm.ndcs.length}</div>
									{#if reasoning.api_calls.rxnorm.ndcs.length > 0}
										<div class="reasoning-section__ndc-list">
											{#each reasoning.api_calls.rxnorm.ndcs.slice(0, 10) as ndc}
												<code>{formatNDC(ndc)}</code>
											{/each}
											{#if reasoning.api_calls.rxnorm.ndcs.length > 10}
												<span>... and {reasoning.api_calls.rxnorm.ndcs.length - 10} more</span>
											{/if}
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
					{#if reasoning.api_calls.fda}
						<div class="reasoning-section__detail-item">
							<strong>FDA:</strong>
							{#if reasoning.api_calls.fda.failed}
								<span class="reasoning-section__error">Failed</span>
							{:else}
								<div class="reasoning-section__nested">
									<div>Direct NDC lookup: {reasoning.api_calls.fda.isDirectNDC ? 'Yes' : 'No'}</div>
									<div>NDCs found: {reasoning.api_calls.fda.ndcs.length}</div>
									{#if reasoning.api_calls.fda.ndcs.length > 0}
										<div class="reasoning-section__ndc-list">
											{#each reasoning.api_calls.fda.ndcs.slice(0, 5) as ndc}
												<code>{formatNDC(ndc.ndc)}</code>
												<span class="reasoning-section__ndc-meta">
													({ndc.pkg_size} units, {ndc.active ? 'active' : 'inactive'})
												</span>
											{/each}
											{#if reasoning.api_calls.fda.ndcs.length > 5}
												<span>... and {reasoning.api_calls.fda.ndcs.length - 5} more</span>
											{/if}
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
					<div class="reasoning-section__detail-item">
						<strong>Execution time:</strong> {formatNumber(reasoning.api_calls.execution_time_ms)}ms
					</div>
				</div>
			{/if}
		</div>

		<!-- SIG Parsing -->
		<div class="reasoning-section__step">
			<button 
				type="button"
				class="reasoning-section__toggle"
				onclick={() => sigParsingExpanded = !sigParsingExpanded}
				aria-expanded={sigParsingExpanded}
				aria-controls="sig-parsing-details"
			>
				<Badge variant={reasoning.sig_parsing.method === 'failed' ? 'error' : reasoning.sig_parsing.method === 'ai' ? 'warning' : 'success'} ariaLabel="SIG Parsing">
					SIG Parsing ({reasoning.sig_parsing.method}{reasoning.sig_parsing.sub_method ? ` - ${reasoning.sig_parsing.sub_method}` : ''})
				</Badge>
				<span class="reasoning-section__toggle-icon" aria-hidden="true">
					{sigParsingExpanded ? '▼' : '▶'}
				</span>
			</button>
			{#if sigParsingExpanded}
				<div id="sig-parsing-details" class="reasoning-section__details">
					<div class="reasoning-section__detail-item">
						<strong>Original SIG:</strong> <code>{reasoning.sig_parsing.original_sig}</code>
					</div>
					<div class="reasoning-section__detail-item">
						<strong>Method:</strong> {reasoning.sig_parsing.method}
						{#if reasoning.sig_parsing.sub_method}
							<span class="reasoning-section__sub-method"> ({reasoning.sig_parsing.sub_method})</span>
						{/if}
					</div>
					{#if reasoning.sig_parsing.parsed}
						<div class="reasoning-section__detail-item">
							<strong>Parsed:</strong>
							<div class="reasoning-section__nested">
								<div>Dose unit: {reasoning.sig_parsing.parsed.dose_unit}</div>
								<div>Quantity per dose: {formatNumber(reasoning.sig_parsing.parsed.quantity_per_dose)}</div>
								<div>Frequency: {formatNumber(reasoning.sig_parsing.parsed.frequency)} per day</div>
								<div>Per day: {formatNumber(reasoning.sig_parsing.parsed.per_day)}</div>
							</div>
						</div>
					{:else}
						<div class="reasoning-section__detail-item">
							<span class="reasoning-section__error">Parsing failed</span>
						</div>
					{/if}
					{#if reasoning.sig_parsing.unit_conversion}
						<div class="reasoning-section__detail-item">
							<strong>Unit conversion:</strong>
							<div class="reasoning-section__nested">
								{formatNumber(reasoning.sig_parsing.unit_conversion.original)} {reasoning.sig_parsing.unit_conversion.from} → {formatNumber(reasoning.sig_parsing.unit_conversion.converted)} {reasoning.sig_parsing.unit_conversion.to}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Dosage Form -->
		<div class="reasoning-section__step">
			<button 
				type="button"
				class="reasoning-section__toggle"
				onclick={() => dosageFormExpanded = !dosageFormExpanded}
				aria-expanded={dosageFormExpanded}
				aria-controls="dosage-form-details"
			>
				<Badge variant="info" ariaLabel="Dosage Form">
					Dosage Form: {reasoning.dosage_form.detected}
				</Badge>
				<span class="reasoning-section__toggle-icon" aria-hidden="true">
					{dosageFormExpanded ? '▼' : '▶'}
				</span>
			</button>
			{#if dosageFormExpanded}
				<div id="dosage-form-details" class="reasoning-section__details">
					<div class="reasoning-section__detail-item">
						<strong>Detected:</strong> {reasoning.dosage_form.detected}
					</div>
					<div class="reasoning-section__detail-item">
						<strong>Method:</strong> {reasoning.dosage_form.method.replace(/_/g, ' ')}
					</div>
					{#if reasoning.dosage_form.matched_keywords && reasoning.dosage_form.matched_keywords.length > 0}
						<div class="reasoning-section__detail-item">
							<strong>Matched keywords:</strong>
							<div class="reasoning-section__nested">
								{reasoning.dosage_form.matched_keywords.join(', ')}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Quantity Calculation -->
		<div class="reasoning-section__step">
			<button 
				type="button"
				class="reasoning-section__toggle"
				onclick={() => quantityCalcExpanded = !quantityCalcExpanded}
				aria-expanded={quantityCalcExpanded}
				aria-controls="quantity-calc-details"
			>
				<Badge variant="info" ariaLabel="Quantity Calculation">
					Quantity Calculation
				</Badge>
				<span class="reasoning-section__toggle-icon" aria-hidden="true">
					{quantityCalcExpanded ? '▼' : '▶'}
				</span>
			</button>
			{#if quantityCalcExpanded}
				<div id="quantity-calc-details" class="reasoning-section__details">
					<div class="reasoning-section__detail-item">
						<strong>Base calculation:</strong>
						<div class="reasoning-section__nested">
							{formatNumber(reasoning.quantity_calculation.base_calculation.per_day)} per day × {formatNumber(reasoning.quantity_calculation.base_calculation.days_supply)} days = {formatNumber(reasoning.quantity_calculation.base_calculation.total_qty)}
						</div>
					</div>
					{#if reasoning.quantity_calculation.rounding.applied}
						<div class="reasoning-section__detail-item">
							<strong>Rounding:</strong>
							<div class="reasoning-section__nested">
								<div>Rule: {reasoning.quantity_calculation.rounding.rule.replace(/_/g, ' ')}</div>
								<div>{formatNumber(reasoning.quantity_calculation.rounding.before)} → {formatNumber(reasoning.quantity_calculation.rounding.after)}</div>
								{#if reasoning.quantity_calculation.rounding.details}
									<div class="reasoning-section__nested">
										{#each Object.entries(reasoning.quantity_calculation.rounding.details) as [key, value]}
											<div>{key.replace(/_/g, ' ')}: {typeof value === 'number' ? formatNumber(value) : String(value)}</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/if}
					<div class="reasoning-section__detail-item">
						<strong>Final quantity:</strong> {formatNumber(reasoning.quantity_calculation.final_qty)}
					</div>
				</div>
			{/if}
		</div>

		<!-- Package Selection -->
		<div class="reasoning-section__step">
			<button 
				type="button"
				class="reasoning-section__toggle"
				onclick={() => packageSelectionExpanded = !packageSelectionExpanded}
				aria-expanded={packageSelectionExpanded}
				aria-controls="package-selection-details"
			>
				<Badge variant="info" ariaLabel="Package Selection">
					Package Selection
				</Badge>
				<span class="reasoning-section__toggle-icon" aria-hidden="true">
					{packageSelectionExpanded ? '▼' : '▶'}
				</span>
			</button>
			{#if packageSelectionExpanded}
				<div id="package-selection-details" class="reasoning-section__details">
					<div class="reasoning-section__detail-item">
						<strong>Total quantity needed:</strong> {formatNumber(reasoning.package_selection.total_qty)}
					</div>
					<div class="reasoning-section__detail-item">
						<strong>Available NDCs:</strong>
						<div class="reasoning-section__nested">
							<div>Total: {reasoning.package_selection.available_ndcs.total}</div>
							<div>Active: {reasoning.package_selection.available_ndcs.active}</div>
							<div>Inactive: {reasoning.package_selection.available_ndcs.inactive}</div>
						</div>
					</div>
					<div class="reasoning-section__detail-item">
						<strong>Options considered:</strong> {reasoning.package_selection.considered_options}
					</div>
					<div class="reasoning-section__detail-item">
						<strong>Scoring configuration:</strong>
						<div class="reasoning-section__nested">
							<div>Max packs: {reasoning.package_selection.scoring.max_packs}</div>
							<div>Max overfill: {formatPercentage(reasoning.package_selection.scoring.max_overfill)}</div>
							{#if reasoning.package_selection.scoring.preferred_ndcs && reasoning.package_selection.scoring.preferred_ndcs.length > 0}
								<div>Preferred NDCs: {reasoning.package_selection.scoring.preferred_ndcs.map(ndc => formatNDC(ndc)).join(', ')}</div>
							{/if}
						</div>
					</div>
					{#if reasoning.package_selection.chosen}
						<div class="reasoning-section__detail-item">
							<strong>Chosen package:</strong>
							<div class="reasoning-section__nested">
								<div>NDC: <code>{formatNDC(reasoning.package_selection.chosen.ndc)}</code></div>
								<div>Score: {formatNumber(reasoning.package_selection.chosen.score)}/1000</div>
								<div>Reason: {reasoning.package_selection.chosen.reason}</div>
								<div class="reasoning-section__detail-item">
									<strong>Score breakdown:</strong>
									<div class="reasoning-section__nested">
										<div>Base score: {formatNumber(reasoning.package_selection.chosen.score_breakdown.base_score)}</div>
										{#if reasoning.package_selection.chosen.score_breakdown.overfill_penalty !== undefined}
											<div>Overfill penalty: -{formatNumber(reasoning.package_selection.chosen.score_breakdown.overfill_penalty)}</div>
										{/if}
										{#if reasoning.package_selection.chosen.score_breakdown.pack_penalty !== undefined}
											<div>Pack penalty: -{formatNumber(reasoning.package_selection.chosen.score_breakdown.pack_penalty)}</div>
										{/if}
										{#if reasoning.package_selection.chosen.score_breakdown.preferred_boost !== undefined}
											<div>Preferred boost: +{formatNumber(reasoning.package_selection.chosen.score_breakdown.preferred_boost)}</div>
										{/if}
									</div>
								</div>
							</div>
						</div>
					{:else}
						<div class="reasoning-section__detail-item">
							<span class="reasoning-section__error">No suitable package found</span>
						</div>
					{/if}
					<div class="reasoning-section__detail-item">
						<strong>Alternates:</strong> {reasoning.package_selection.alternates_count}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.reasoning-section {
		margin-top: var(--space-6);
		padding: var(--space-3);
		background-color: transparent;
		border-radius: var(--border-radius-md);
		border-left: 2px solid var(--info-300);
	}

	.reasoning-section__title {
		font-size: var(--text-base);
		font-weight: var(--font-medium);
		color: var(--text-secondary);
		margin-bottom: var(--space-3);
	}

	.reasoning-section__content {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.reasoning-section__step {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.reasoning-section__toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: none;
		border: none;
		padding: var(--space-2);
		cursor: pointer;
		width: 100%;
		text-align: left;
		transition: background-color 150ms ease;
	}

	.reasoning-section__toggle:hover {
		background-color: var(--gray-50);
		border-radius: var(--border-radius-sm);
	}

	.reasoning-section__toggle:focus-visible {
		outline: 2px solid var(--primary-500);
		outline-offset: 2px;
		border-radius: var(--border-radius-sm);
	}

	.reasoning-section__toggle-icon {
		margin-left: auto;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		pointer-events: none;
	}

	.reasoning-section__toggle :global(.badge) {
		pointer-events: none;
	}

	.reasoning-section__details {
		margin-left: var(--space-4);
		padding: var(--space-3);
		background-color: var(--bg-secondary);
		border-radius: var(--border-radius-sm);
		border-left: 2px solid var(--info-200);
	}

	.reasoning-section__detail-item {
		font-size: var(--text-sm);
		color: var(--text-primary);
		margin-bottom: var(--space-2);
		line-height: 1.6;
	}

	.reasoning-section__detail-item:last-child {
		margin-bottom: 0;
	}

	.reasoning-section__detail-item strong {
		color: var(--text-secondary);
		font-weight: var(--font-semibold);
	}

	.reasoning-section__nested {
		margin-top: var(--space-1);
		margin-left: var(--space-4);
		color: var(--text-primary);
	}

	.reasoning-section__nested div {
		margin-bottom: var(--space-1);
	}

	.reasoning-section__ndc-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}

	.reasoning-section__ndc-list code {
		font-family: monospace;
		font-size: var(--text-xs);
		background-color: var(--gray-100);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--border-radius-sm);
	}

	.reasoning-section__ndc-meta {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	.reasoning-section__error {
		color: var(--error-500);
		font-weight: var(--font-medium);
	}
</style>

