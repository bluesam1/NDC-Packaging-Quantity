/**
 * Inhaler Configuration Utilities
 * 
 * This module provides configuration for inhaler medications,
 * including default and product-specific actuation counts per canister.
 */

/**
 * Actuation counts per canister for common inhaler products
 * Key: drug name (lowercase), Value: actuations per canister
 */
export const ACTUATION_COUNTS: Record<string, number> = {
  // Bronchodilators (Short-acting beta agonists)
  'albuterol': 200,
  'proventil': 200,
  'ventolin': 200,
  'proair': 200,
  
  // Corticosteroids (Inhaled)
  'fluticasone': 120,
  'flovent': 120,
  'qvar': 120,
  'pulmicort': 120,
  'budesonide': 120,
  
  // Combination inhalers
  'advair': 120,
  'symbicort': 120,
  'breo': 60,
  'dulera': 120,
  
  // Anticholinergics
  'atrovent': 200,
  'spiriva': 30,
  'ipratropium': 200,
  'tiotropium': 30,
  
  // Default fallback
  'default': 200,
};

/**
 * Default actuation count for inhalers
 */
export const DEFAULT_INHALER_ACTUATIONS = 200;

/**
 * Get actuation count for a specific drug
 * 
 * @param drugName - Drug name (can include brand or generic name)
 * @returns Actuations per canister
 */
export function getActuationsPerCanister(drugName: string): number {
  if (!drugName) {
    return DEFAULT_INHALER_ACTUATIONS;
  }
  
  // Normalize drug name (lowercase, trim)
  const normalizedName = drugName.toLowerCase().trim();
  
  // Check for exact match
  if (ACTUATION_COUNTS[normalizedName]) {
    return ACTUATION_COUNTS[normalizedName];
  }
  
  // Check for partial match (e.g., "albuterol sulfate" matches "albuterol")
  for (const [key, value] of Object.entries(ACTUATION_COUNTS)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return value;
    }
  }
  
  // Return default if no match found
  return DEFAULT_INHALER_ACTUATIONS;
}

/**
 * Calculate number of canisters needed
 * 
 * @param totalActuations - Total actuations needed
 * @param actuationsPerCanister - Actuations per canister
 * @returns Number of canisters (always whole canisters, rounded up)
 */
export function calculateCanistersNeeded(
  totalActuations: number,
  actuationsPerCanister: number
): number {
  if (totalActuations <= 0) {
    return 0;
  }
  
  if (actuationsPerCanister <= 0) {
    return 0;
  }
  
  // Always round up to whole canisters (no partial canisters)
  return Math.ceil(totalActuations / actuationsPerCanister);
}


