/**
 * Quantity Calculator Service
 * 
 * This module calculates the total quantity needed based on per-day consumption and days supply.
 * Formula: total_qty = per_day × days_supply
 * 
 * Supports special rounding logic for different dosage forms:
 * - Liquids: Round to nearest 5 mL
 * - Inhalers: Round to whole canisters
 * - Insulin: Round to whole pens/vials
 * - Solids: Round to whole units
 */

import { logInfo } from '../utils/logger';
import { ValidationError } from '../utils/errors';
import { roundLiquidVolume } from '../utils/unit-conversions';
import { getActuationsPerCanister, calculateCanistersNeeded } from '../utils/inhaler-config';
import { 
  getInsulinConcentration, 
  unitsToVolume, 
  calculatePensNeeded, 
  calculateVialsNeeded,
  isPenFormat,
  isVialFormat
} from '../utils/insulin-config';
import type { ParsedSIG } from './sig-parser';
import type { DosageFormType } from './dosage-form-detector';

/**
 * Computed data structure
 */
export interface ComputedData {
  dose_unit: string; // Normalized unit (tab, cap, mL, etc.)
  per_day: number; // Quantity per day
  total_qty: number; // Total quantity needed (per_day × days_supply)
  days_supply: number; // Days of supply
}

/**
 * Supported unit types
 */
const SUPPORTED_UNITS = ['tab', 'cap', 'mL', 'actuation', 'unit'] as const;
export type SupportedUnit = typeof SUPPORTED_UNITS[number];

/**
 * Validate unit type
 */
function validateUnit(unit: string): unit is SupportedUnit {
  return SUPPORTED_UNITS.includes(unit as SupportedUnit);
}

/**
 * Normalize unit type
 */
function normalizeUnit(unit: string): string {
  const normalized = unit.toLowerCase().trim();
  
  // Normalize common variations
  const unitMap: Record<string, string> = {
    'tablet': 'tab',
    'tablets': 'tab',
    'tab': 'tab',
    'tabs': 'tab',
    'capsule': 'cap',
    'capsules': 'cap',
    'cap': 'cap',
    'caps': 'cap',
    'ml': 'mL',
    'milliliter': 'mL',
    'milliliters': 'mL',
    'millilitre': 'mL',
    'millilitres': 'mL',
  };
  
  return unitMap[normalized] || normalized;
}

/**
 * Round quantity based on unit type and dosage form
 */
function roundQuantity(
  quantity: number, 
  unit: string, 
  dosageForm: DosageFormType,
  drugName?: string
): number {
  // Handle inhalers - convert actuations to canisters
  if (dosageForm === 'inhaler' && unit === 'actuation') {
    const actuationsPerCanister = drugName ? getActuationsPerCanister(drugName) : 200;
    const canisters = calculateCanistersNeeded(quantity, actuationsPerCanister);
    const totalActuations = canisters * actuationsPerCanister;
    
    logInfo('Rounded inhaler quantity to whole canisters', {
      requestedActuations: quantity,
      actuationsPerCanister,
      canisters,
      totalActuations,
    });
    
    return totalActuations;
  }
  
  // Handle insulin - convert units to pens/vials
  if (dosageForm === 'insulin' && unit === 'unit') {
    const concentration = drugName ? getInsulinConcentration(drugName) : 100;
    const volumeML = unitsToVolume(quantity, concentration);
    
    // Determine if pen or vial format
    const isPen = drugName ? isPenFormat(drugName) : true; // Default to pen
    const isVial = drugName ? isVialFormat(drugName) : false;
    
    let containers: number;
    let volumePerContainer: number;
    
    if (isVial) {
      volumePerContainer = 10; // 10 mL vial
      containers = calculateVialsNeeded(volumeML, volumePerContainer);
    } else {
      // Default to pen
      volumePerContainer = 3; // 3 mL pen
      containers = calculatePensNeeded(volumeML, volumePerContainer);
    }
    
    const totalVolume = containers * volumePerContainer;
    const totalUnits = totalVolume * concentration;
    
    logInfo('Rounded insulin quantity to whole containers', {
      requestedUnits: quantity,
      concentration,
      volumeML,
      isPen,
      isVial,
      containers,
      volumePerContainer,
      totalUnits,
    });
    
    return totalUnits;
  }
  
  // Round to integers for tab/cap/actuation/unit
  if (unit === 'tab' || unit === 'cap' || unit === 'actuation' || unit === 'unit') {
    return Math.round(quantity);
  }
  
  // For liquids (mL), use special rounding rules
  // Round up to nearest whole mL, and for partial bottles, round up to nearest 5mL
  if (unit === 'mL') {
    return roundLiquidVolume(quantity);
  }
  
  // Default: round to 2 decimals
  return Math.round(quantity * 100) / 100;
}

/**
 * Calculate quantity based on parsed SIG and days supply
 * 
 * @param parsedSIG - Parsed SIG data from SIG parser
 * @param daysSupply - Days of medication supply (1-365)
 * @param dosageForm - Detected dosage form type
 * @param drugName - Optional drug name for dosage-specific calculations
 * @param unitOverride - Optional unit override from request
 * @returns ComputedData with calculated quantities
 * @throws ValidationError if inputs are invalid
 */
export function calculateQuantity(
  parsedSIG: ParsedSIG,
  daysSupply: number,
  dosageForm: DosageFormType,
  drugName?: string,
  unitOverride?: string
): ComputedData {
  // Validate inputs
  if (!parsedSIG || typeof parsedSIG !== 'object') {
    throw new ValidationError('Invalid parsedSIG: must be a valid ParsedSIG object');
  }

  if (typeof daysSupply !== 'number' || isNaN(daysSupply)) {
    throw new ValidationError('Invalid days_supply: must be a number');
  }

  if (daysSupply <= 0) {
    throw new ValidationError('Invalid days_supply: must be greater than 0');
  }

  if (daysSupply > 365) {
    throw new ValidationError('Invalid days_supply: must be less than or equal to 365');
  }

  if (!Number.isInteger(daysSupply)) {
    throw new ValidationError('Invalid days_supply: must be an integer');
  }

  if (parsedSIG.per_day <= 0) {
    throw new ValidationError('Invalid per_day: must be greater than 0');
  }

  if (parsedSIG.per_day > 100) {
    throw new ValidationError('Invalid per_day: must be less than or equal to 100');
  }

  // Normalize unit
  let doseUnit = unitOverride ? normalizeUnit(unitOverride) : normalizeUnit(parsedSIG.dose_unit);
  
  // Validate unit type
  if (!validateUnit(doseUnit)) {
    throw new ValidationError(`Invalid unit type: ${doseUnit}. Supported units: ${SUPPORTED_UNITS.join(', ')}`);
  }

  // Calculate total quantity
  const totalQty = parsedSIG.per_day * daysSupply;

  // Validate total quantity is reasonable
  if (totalQty <= 0) {
    throw new ValidationError('Invalid total_qty: calculation resulted in zero or negative value');
  }

  if (totalQty > 10000) {
    throw new ValidationError('Invalid total_qty: calculation resulted in value greater than 10,000');
  }

  // Round quantity based on unit type and dosage form
  const roundedTotalQty = roundQuantity(totalQty, doseUnit, dosageForm, drugName);

  logInfo('Quantity calculated successfully', {
    dose_unit: doseUnit,
    per_day: parsedSIG.per_day,
    days_supply: daysSupply,
    total_qty: roundedTotalQty,
    dosage_form: dosageForm,
  });

  return {
    dose_unit: doseUnit,
    per_day: parsedSIG.per_day,
    total_qty: roundedTotalQty,
    days_supply: daysSupply,
  };
}

