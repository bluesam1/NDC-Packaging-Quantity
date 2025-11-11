/**
 * Unit Conversion Utilities
 * 
 * This module provides conversion utilities for liquid medication volumes.
 * All conversions normalize to mL as the canonical unit.
 */

/**
 * Conversion factors to mL
 */
export const LIQUID_CONVERSIONS: Record<string, number> = {
  'ml': 1,
  'mL': 1,
  'milliliter': 1,
  'milliliters': 1,
  'millilitre': 1,
  'millilitres': 1,
  'teaspoon': 5,
  'teaspoons': 5,
  'tsp': 5,
  'tablespoon': 15,
  'tablespoons': 15,
  'tbsp': 15,
  'oz': 30,
  'ounce': 30,
  'ounces': 30,
};

/**
 * Convert liquid volume to mL
 * 
 * @param value - Numeric value to convert
 * @param unit - Source unit (e.g., "teaspoon", "tsp", "tablespoon", "oz")
 * @returns Volume in mL
 */
export function convertToML(value: number, unit: string): number {
  const normalizedUnit = unit.toLowerCase().trim();
  const conversionFactor = LIQUID_CONVERSIONS[normalizedUnit];
  
  if (!conversionFactor) {
    throw new Error(`Unknown unit: ${unit}`);
  }
  
  return value * conversionFactor;
}

/**
 * Round liquid volume to nearest 5mL for partial bottles
 * 
 * @param volume - Volume in mL
 * @returns Rounded volume
 */
export function roundLiquidVolume(volume: number): number {
  // Round up to nearest whole mL first
  const wholeML = Math.ceil(volume);
  
  // For values >= 5mL, round up to nearest 5mL
  if (wholeML >= 5) {
    return Math.ceil(wholeML / 5) * 5;
  }
  
  // For small volumes (< 5mL), just return whole mL
  return wholeML;
}

/**
 * Normalize liquid unit names to mL
 * 
 * @param unit - Unit string to normalize
 * @returns Normalized unit or null if not a liquid unit
 */
export function normalizeLiquidUnit(unit: string): string | null {
  const normalizedUnit = unit.toLowerCase().trim();
  
  if (LIQUID_CONVERSIONS[normalizedUnit] !== undefined) {
    return 'mL';
  }
  
  return null;
}

/**
 * Check if a unit is a liquid unit
 * 
 * @param unit - Unit string to check
 * @returns True if unit is a liquid unit
 */
export function isLiquidUnit(unit: string): boolean {
  const normalizedUnit = unit.toLowerCase().trim();
  return LIQUID_CONVERSIONS[normalizedUnit] !== undefined;
}


