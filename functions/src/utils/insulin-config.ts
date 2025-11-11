/**
 * Insulin Configuration Utilities
 * 
 * This module provides configuration for insulin medications,
 * including concentration mappings (U100, U200, U500) and
 * pen/vial volume calculations.
 */

/**
 * Insulin concentration mappings (units per mL)
 * Key: concentration name, Value: units per mL
 */
export const INSULIN_CONCENTRATIONS: Record<string, number> = {
  'U100': 100,  // 1 mL = 100 units
  'U200': 200,  // 1 mL = 200 units
  'U500': 500,  // 1 mL = 500 units
  'u100': 100,  // Case-insensitive
  'u200': 200,
  'u500': 500,
};

/**
 * Default insulin concentration (U100 is most common)
 */
export const DEFAULT_INSULIN_CONCENTRATION = 100; // U100

/**
 * Standard pen volumes (in mL)
 */
export const PEN_VOLUMES: Record<string, number> = {
  'standard': 3.0,    // Most common: 3 mL pen
  'small': 1.5,       // Smaller pens
  'prefilled': 3.0,   // Pre-filled pens
};

/**
 * Standard vial volumes (in mL)
 */
export const VIAL_VOLUMES: Record<string, number> = {
  'standard': 10.0,   // Most common: 10 mL vial
  'small': 3.0,       // Smaller vials
};

/**
 * Get insulin concentration from drug name or concentration string
 * 
 * @param drugName - Drug name or concentration string (e.g., "insulin lispro U100", "U200")
 * @returns Concentration in units per mL
 */
export function getInsulinConcentration(drugName: string): number {
  if (!drugName) {
    return DEFAULT_INSULIN_CONCENTRATION;
  }
  
  // Normalize drug name (lowercase, trim)
  const normalizedName = drugName.toLowerCase().trim();
  
  // Check for explicit concentration mentions (U100, U200, U500)
  const concentrationMatch = normalizedName.match(/\b(u\d{3})\b/i);
  if (concentrationMatch) {
    const concentration = concentrationMatch[1].toLowerCase();
    if (INSULIN_CONCENTRATIONS[concentration]) {
      return INSULIN_CONCENTRATIONS[concentration];
    }
  }
  
  // Return default if no concentration specified
  return DEFAULT_INSULIN_CONCENTRATION;
}

/**
 * Convert insulin units to volume (mL) based on concentration
 * 
 * @param units - Total units needed
 * @param concentration - Concentration in units per mL (default: 100)
 * @returns Volume in mL
 */
export function unitsToVolume(units: number, concentration: number = DEFAULT_INSULIN_CONCENTRATION): number {
  if (units <= 0 || concentration <= 0) {
    return 0;
  }
  
  return units / concentration;
}

/**
 * Calculate number of pens needed
 * 
 * @param totalVolume - Total volume needed (mL)
 * @param penVolume - Volume per pen (default: 3 mL)
 * @returns Number of pens (always whole pens, rounded up)
 */
export function calculatePensNeeded(totalVolume: number, penVolume: number = PEN_VOLUMES.standard): number {
  if (totalVolume <= 0) {
    return 0;
  }
  
  if (penVolume <= 0) {
    return 0;
  }
  
  // Always round up to whole pens (no partial pens)
  return Math.ceil(totalVolume / penVolume);
}

/**
 * Calculate number of vials needed
 * 
 * @param totalVolume - Total volume needed (mL)
 * @param vialVolume - Volume per vial (default: 10 mL)
 * @returns Number of vials (always whole vials, rounded up)
 */
export function calculateVialsNeeded(totalVolume: number, vialVolume: number = VIAL_VOLUMES.standard): number {
  if (totalVolume <= 0) {
    return 0;
  }
  
  if (vialVolume <= 0) {
    return 0;
  }
  
  // Always round up to whole vials (no partial vials)
  return Math.ceil(totalVolume / vialVolume);
}

/**
 * Determine if drug name suggests pen format
 * 
 * @param drugName - Drug name
 * @returns True if pen format suggested
 */
export function isPenFormat(drugName: string): boolean {
  if (!drugName) {
    return false;
  }
  
  const normalizedName = drugName.toLowerCase();
  return normalizedName.includes('pen') || 
         normalizedName.includes('flexpen') ||
         normalizedName.includes('kwikpen') ||
         normalizedName.includes('solostar');
}

/**
 * Determine if drug name suggests vial format
 * 
 * @param drugName - Drug name
 * @returns True if vial format suggested
 */
export function isVialFormat(drugName: string): boolean {
  if (!drugName) {
    return false;
  }
  
  const normalizedName = drugName.toLowerCase();
  return normalizedName.includes('vial');
}


