/**
 * Package Selector Service
 * 
 * This module provides a multi-pack selection algorithm for choosing optimal NDC packages.
 * Uses a greedy approach to select packages that minimize overfill while meeting quantity requirements.
 */

import { logInfo, logWarn } from '../utils/logger';
import type { NDCPackageData } from '../types/index';

/**
 * Package selection configuration
 */
export interface SelectionConfig {
  maxPacks?: number; // Default: 3
  maxOverfill?: number; // Default: 0.10 (10%)
  preferredNdcs?: string[]; // Optional preferred NDCs for ranking bias
}

/**
 * Package option with scoring information
 */
interface PackageOption {
  ndc: string;
  pkg_size: number;
  active: boolean;
  overfill: number; // Percentage overfill
  packs: number; // Number of packs
  score: number; // Calculated score for ranking
  brand_name?: string; // Brand name (if available)
  dosage_form?: string; // Dosage form (e.g., "CAPSULE", "TABLET")
}

/**
 * Package selection result
 */
export interface PackageSelection {
  chosen?: {
    ndc: string;
    pkg_size: number;
    active: boolean;
    overfill: number;
    packs: number;
    brand_name?: string;
    dosage_form?: string;
  };
  alternates: Array<{
    ndc: string;
    pkg_size: number;
    active: boolean;
    overfill: number;
    packs: number;
    brand_name?: string;
    dosage_form?: string;
  }>;
}

/**
 * Default configuration values
 */
const DEFAULT_MAX_PACKS = 3;
const DEFAULT_MAX_OVERFILL = 0.10; // 10%

/**
 * Calculate overfill percentage
 * Returns negative for underfill (not enough), positive for overfill (too much)
 */
function calculateOverfill(totalQty: number, packageQty: number): number {
  if (totalQty <= 0) {
    return 0;
  }
  return (packageQty - totalQty) / totalQty;
}

/**
 * Score a package option based on ranking rules
 */
function scorePackage(
  option: PackageOption,
  totalQty: number,
  maxOverfill: number,
  preferredNdcs?: string[]
): number {
  let score = 0;

  // Underfill (negative overfill) - reject (score = 0)
  // Never underfill by default
  if (option.overfill < 0) {
    return 0;
  }
  // Exact match (overfill = 0) - highest priority (score = 1000)
  else if (option.overfill === 0) {
    score = 1000;
  }
  // Minimal overfill (0 < overfill ≤ maxOverfill) - next priority
  else if (option.overfill > 0 && option.overfill <= maxOverfill) {
    // Score decreases as overfill increases
    // Scale: 1000 points for 0% overfill, 0 points for maxOverfill
    score = 1000 * (1 - option.overfill / maxOverfill);
  }
  // Over overfill limit - reject (score = 0)
  else {
    return 0;
  }

  // Apply pack count penalty (prefer fewer packs)
  // Penalty: -10 points per pack above 1
  score -= (option.packs - 1) * 10;

  // Apply preferred NDC boost (within same score tier)
  if (preferredNdcs && preferredNdcs.includes(option.ndc)) {
    score += 50; // Boost preferred NDCs
  }

  return score;
}

/**
 * Generate all possible package combinations for an NDC
 */
function generateCombinations(
  ndc: NDCPackageData,
  totalQty: number,
  maxPacks: number
): PackageOption[] {
  const combinations: PackageOption[] = [];

  // Try 1-pack, 2-pack, 3-pack combinations
  for (let packs = 1; packs <= maxPacks; packs++) {
    const packageQty = ndc.pkg_size * packs;
    const overfill = calculateOverfill(totalQty, packageQty);

    combinations.push({
      ndc: ndc.ndc,
      pkg_size: ndc.pkg_size,
      active: ndc.active,
      overfill,
      packs,
      score: 0, // Will be calculated later
      brand_name: ndc.brand_name,
      dosage_form: ndc.dosage_form,
    });
  }

  return combinations;
}

/**
 * Select optimal package combination based on quantity and ranking rules
 * 
 * @param ndcs - Array of NDC package data
 * @param totalQty - Total quantity needed
 * @param config - Selection configuration
 * @returns PackageSelection with chosen package and alternates
 */
export function selectPackages(
  ndcs: NDCPackageData[],
  totalQty: number,
  config: SelectionConfig = {}
): PackageSelection {
  const maxPacks = config.maxPacks ?? DEFAULT_MAX_PACKS;
  const maxOverfill = config.maxOverfill ?? DEFAULT_MAX_OVERFILL;
  const preferredNdcs = config.preferredNdcs || [];

  logInfo('Starting package selection', {
    totalQty,
    ndcCount: ndcs.length,
    maxPacks,
    maxOverfill,
    preferredNdcsCount: preferredNdcs.length,
  });

  // Pre-filter NDCs by active status (FDA as source of truth)
  const activeNdcs = ndcs.filter((ndc) => ndc.active);
  const inactiveNdcs = ndcs.filter((ndc) => !ndc.active).map((ndc) => ndc.ndc);

  if (activeNdcs.length === 0) {
    logWarn('No active NDCs found', { totalQty, inactiveNdcs });
    return {
      chosen: undefined,
      alternates: [],
    };
  }

  // Generate all possible combinations
  const allOptions: PackageOption[] = [];

  for (const ndc of activeNdcs) {
    const combinations = generateCombinations(ndc, totalQty, maxPacks);
    allOptions.push(...combinations);
  }

  // Score and filter options
  const validOptions: PackageOption[] = [];

  for (const option of allOptions) {
    // Enforce MAX_PACKS constraint
    if (option.packs > maxPacks) {
      continue;
    }

    // Enforce OVERFILL_MAX constraint
    if (option.overfill > maxOverfill) {
      continue;
    }

    // Score the option
    option.score = scorePackage(option, totalQty, maxOverfill, preferredNdcs);

    // Only include options with positive scores
    if (option.score > 0) {
      validOptions.push(option);
    }
  }

  // Sort by score (highest first)
  validOptions.sort((a, b) => b.score - a.score);

  if (validOptions.length === 0) {
    logWarn('No suitable package found', {
      totalQty,
      activeNdcsCount: activeNdcs.length,
      maxPacks,
      maxOverfill,
    });
    return {
      chosen: undefined,
      alternates: [],
    };
  }

  // Select best match as chosen
  const chosen = validOptions[0];
  const chosenPackage = {
    ndc: chosen.ndc,
    pkg_size: chosen.pkg_size,
    active: chosen.active,
    overfill: chosen.overfill,
    packs: chosen.packs,
    brand_name: chosen.brand_name,
    dosage_form: chosen.dosage_form,
  };

  // Select next 10 as alternates
  const alternates = validOptions
    .slice(1, 11) // Next 10 options
    .map((option) => ({
      ndc: option.ndc,
      pkg_size: option.pkg_size,
      active: option.active,
      overfill: option.overfill,
      packs: option.packs,
      brand_name: option.brand_name,
      dosage_form: option.dosage_form,
    }));

  logInfo('Package selection completed', {
    totalQty,
    chosen: chosenPackage,
    alternatesCount: alternates.length,
    inactiveNdcsCount: inactiveNdcs.length,
  });

  return {
    chosen: chosenPackage,
    alternates,
  };
}

