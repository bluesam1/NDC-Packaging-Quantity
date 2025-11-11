/**
 * Dosage Form Detector Service
 * 
 * This module detects the dosage form type of a drug based on:
 * - Drug name keywords
 * - FDA dosage_form field
 * - Parsed SIG dose_unit
 * 
 * Dosage forms:
 * - inhaler: MDI/HFA inhalers (measured in puffs/actuations)
 * - insulin: Insulin products (measured in units)
 * - liquid: Oral liquids (measured in mL)
 * - solid: Tablets/capsules (default)
 */

import { logInfo } from '../utils/logger';
import type { NDCPackageData } from '../types/index';

export type DosageFormType = 'inhaler' | 'insulin' | 'liquid' | 'solid';

/**
 * Inhaler keywords in drug names
 */
const INHALER_KEYWORDS = [
  'hfa',
  'inhaler',
  'aerosol',
  'inhalation',
  'mdi',
  'diskus',
  'ellipta',
  'turbuhaler',
  'handihaler',
];

/**
 * Inhaler dosage forms from FDA
 */
const INHALER_DOSAGE_FORMS = [
  'AEROSOL',
  'AEROSOL, METERED',
  'AEROSOL, POWDER',
  'SPRAY, METERED',
];

/**
 * Insulin keywords in drug names
 */
const INSULIN_KEYWORDS = [
  'insulin',
  'humalog',
  'novolog',
  'lantus',
  'levemir',
  'tresiba',
  'basaglar',
  'toujeo',
  'apidra',
  'fiasp',
];

/**
 * Liquid dosage forms from FDA
 */
const LIQUID_DOSAGE_FORMS = [
  'SOLUTION',
  'SUSPENSION',
  'SYRUP',
  'ELIXIR',
  'LIQUID',
  'SOLUTION/DROPS',
  'SUSPENSION/DROPS',
];

/**
 * Detect dosage form type based on drug information
 * 
 * @param drugName - Drug name or NDC input
 * @param ndcs - Available NDC package data
 * @param doseUnit - Dose unit from parsed SIG
 * @returns Detected dosage form type
 */
export function detectDosageForm(
  drugName: string,
  ndcs: NDCPackageData[],
  doseUnit: string
): DosageFormType {
  const normalizedName = drugName.toLowerCase().trim();
  const normalizedUnit = doseUnit.toLowerCase().trim();

  // Check dose unit first (most reliable)
  if (normalizedUnit === 'actuation') {
    logInfo('Detected inhaler from dose unit', { doseUnit });
    return 'inhaler';
  }

  if (normalizedUnit === 'unit') {
    // Check if it's insulin
    if (INSULIN_KEYWORDS.some(keyword => normalizedName.includes(keyword))) {
      logInfo('Detected insulin from dose unit and drug name', { drugName: '[REDACTED]' });
      return 'insulin';
    }
  }

  if (normalizedUnit === 'ml') {
    logInfo('Detected liquid from dose unit', { doseUnit });
    return 'liquid';
  }

  // Check drug name for inhaler keywords
  if (INHALER_KEYWORDS.some(keyword => normalizedName.includes(keyword))) {
    logInfo('Detected inhaler from drug name', { drugName: '[REDACTED]' });
    return 'inhaler';
  }

  // Check drug name for insulin keywords
  if (INSULIN_KEYWORDS.some(keyword => normalizedName.includes(keyword))) {
    logInfo('Detected insulin from drug name', { drugName: '[REDACTED]' });
    return 'insulin';
  }

  // Check FDA dosage forms
  const dosageForms = ndcs
    .map(ndc => ndc.dosage_form?.toUpperCase())
    .filter(Boolean);

  if (dosageForms.some(form => INHALER_DOSAGE_FORMS.includes(form!))) {
    logInfo('Detected inhaler from FDA dosage form', { dosageForms });
    return 'inhaler';
  }

  if (dosageForms.some(form => LIQUID_DOSAGE_FORMS.includes(form!))) {
    logInfo('Detected liquid from FDA dosage form', { dosageForms });
    return 'liquid';
  }

  // Default to solid (tablets/capsules)
  logInfo('Defaulted to solid dosage form', { drugName: '[REDACTED]', doseUnit });
  return 'solid';
}

