/**
 * Insulin Configuration Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getInsulinConcentration,
  unitsToVolume,
  calculatePensNeeded,
  calculateVialsNeeded,
  isPenFormat,
  isVialFormat,
  DEFAULT_INSULIN_CONCENTRATION,
  PEN_VOLUMES,
  VIAL_VOLUMES,
} from './insulin-config';

describe('getInsulinConcentration', () => {
  it('should detect U100 concentration', () => {
    expect(getInsulinConcentration('insulin lispro U100')).toBe(100);
    expect(getInsulinConcentration('U100 insulin')).toBe(100);
    expect(getInsulinConcentration('u100')).toBe(100);
  });

  it('should detect U200 concentration', () => {
    expect(getInsulinConcentration('insulin lispro U200')).toBe(200);
    expect(getInsulinConcentration('U200 insulin')).toBe(200);
    expect(getInsulinConcentration('u200')).toBe(200);
  });

  it('should detect U500 concentration', () => {
    expect(getInsulinConcentration('insulin regular U500')).toBe(500);
    expect(getInsulinConcentration('U500 insulin')).toBe(500);
    expect(getInsulinConcentration('u500')).toBe(500);
  });

  it('should return default for unspecified concentration', () => {
    expect(getInsulinConcentration('insulin lispro')).toBe(DEFAULT_INSULIN_CONCENTRATION);
    expect(getInsulinConcentration('lantus')).toBe(DEFAULT_INSULIN_CONCENTRATION);
  });

  it('should be case-insensitive', () => {
    expect(getInsulinConcentration('INSULIN U100')).toBe(100);
    expect(getInsulinConcentration('Insulin u200')).toBe(200);
  });

  it('should handle empty string', () => {
    expect(getInsulinConcentration('')).toBe(DEFAULT_INSULIN_CONCENTRATION);
  });

  it('should handle null/undefined', () => {
    expect(getInsulinConcentration(null as any)).toBe(DEFAULT_INSULIN_CONCENTRATION);
    expect(getInsulinConcentration(undefined as any)).toBe(DEFAULT_INSULIN_CONCENTRATION);
  });
});

describe('unitsToVolume', () => {
  it('should convert units to mL for U100', () => {
    expect(unitsToVolume(100, 100)).toBe(1);   // 100 units ÷ 100 = 1 mL
    expect(unitsToVolume(200, 100)).toBe(2);   // 200 units ÷ 100 = 2 mL
    expect(unitsToVolume(600, 100)).toBe(6);   // 600 units ÷ 100 = 6 mL
  });

  it('should convert units to mL for U200', () => {
    expect(unitsToVolume(200, 200)).toBe(1);   // 200 units ÷ 200 = 1 mL
    expect(unitsToVolume(400, 200)).toBe(2);   // 400 units ÷ 200 = 2 mL
    expect(unitsToVolume(600, 200)).toBe(3);   // 600 units ÷ 200 = 3 mL
  });

  it('should convert units to mL for U500', () => {
    expect(unitsToVolume(500, 500)).toBe(1);   // 500 units ÷ 500 = 1 mL
    expect(unitsToVolume(1000, 500)).toBe(2);  // 1000 units ÷ 500 = 2 mL
  });

  it('should use default concentration if not specified', () => {
    expect(unitsToVolume(100)).toBe(1);        // 100 units ÷ 100 (default) = 1 mL
  });

  it('should handle zero units', () => {
    expect(unitsToVolume(0, 100)).toBe(0);
  });

  it('should handle zero concentration', () => {
    expect(unitsToVolume(100, 0)).toBe(0);
  });

  it('should handle negative values gracefully', () => {
    expect(unitsToVolume(-100, 100)).toBe(0);
    expect(unitsToVolume(100, -100)).toBe(0);
  });
});

describe('calculatePensNeeded', () => {
  it('should calculate pens for exact match (3 mL pens)', () => {
    expect(calculatePensNeeded(3, 3)).toBe(1);
    expect(calculatePensNeeded(6, 3)).toBe(2);
    expect(calculatePensNeeded(9, 3)).toBe(3);
  });

  it('should round up to whole pens', () => {
    expect(calculatePensNeeded(1, 3)).toBe(1);    // 1/3 = 0.33 → 1 pen
    expect(calculatePensNeeded(4, 3)).toBe(2);    // 4/3 = 1.33 → 2 pens
    expect(calculatePensNeeded(7, 3)).toBe(3);    // 7/3 = 2.33 → 3 pens
  });

  it('should use default pen volume if not specified', () => {
    expect(calculatePensNeeded(3)).toBe(1);       // 3 mL ÷ 3 mL (default) = 1 pen
    expect(calculatePensNeeded(6)).toBe(2);       // 6 mL ÷ 3 mL (default) = 2 pens
  });

  it('should handle 1.5 mL pens (small pens)', () => {
    expect(calculatePensNeeded(1.5, PEN_VOLUMES.small)).toBe(1);
    expect(calculatePensNeeded(3, PEN_VOLUMES.small)).toBe(2);
  });

  it('should handle zero volume', () => {
    expect(calculatePensNeeded(0, 3)).toBe(0);
  });

  it('should handle zero pen volume', () => {
    expect(calculatePensNeeded(3, 0)).toBe(0);
  });

  it('should handle negative values gracefully', () => {
    expect(calculatePensNeeded(-3, 3)).toBe(0);
    expect(calculatePensNeeded(3, -3)).toBe(0);
  });
});

describe('calculateVialsNeeded', () => {
  it('should calculate vials for exact match (10 mL vials)', () => {
    expect(calculateVialsNeeded(10, 10)).toBe(1);
    expect(calculateVialsNeeded(20, 10)).toBe(2);
    expect(calculateVialsNeeded(30, 10)).toBe(3);
  });

  it('should round up to whole vials', () => {
    expect(calculateVialsNeeded(1, 10)).toBe(1);   // 1/10 = 0.1 → 1 vial
    expect(calculateVialsNeeded(6, 10)).toBe(1);   // 6/10 = 0.6 → 1 vial
    expect(calculateVialsNeeded(15, 10)).toBe(2);  // 15/10 = 1.5 → 2 vials
  });

  it('should use default vial volume if not specified', () => {
    expect(calculateVialsNeeded(10)).toBe(1);      // 10 mL ÷ 10 mL (default) = 1 vial
    expect(calculateVialsNeeded(20)).toBe(2);      // 20 mL ÷ 10 mL (default) = 2 vials
  });

  it('should handle 3 mL vials (small vials)', () => {
    expect(calculateVialsNeeded(3, VIAL_VOLUMES.small)).toBe(1);
    expect(calculateVialsNeeded(6, VIAL_VOLUMES.small)).toBe(2);
  });

  it('should handle zero volume', () => {
    expect(calculateVialsNeeded(0, 10)).toBe(0);
  });

  it('should handle zero vial volume', () => {
    expect(calculateVialsNeeded(10, 0)).toBe(0);
  });

  it('should handle negative values gracefully', () => {
    expect(calculateVialsNeeded(-10, 10)).toBe(0);
    expect(calculateVialsNeeded(10, -10)).toBe(0);
  });
});

describe('isPenFormat', () => {
  it('should detect pen format from drug name', () => {
    expect(isPenFormat('insulin lispro pen')).toBe(true);
    expect(isPenFormat('Lantus FlexPen')).toBe(true);
    expect(isPenFormat('Humalog KwikPen')).toBe(true);
    expect(isPenFormat('Novolog SoloStar')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isPenFormat('INSULIN PEN')).toBe(true);
    expect(isPenFormat('Insulin Pen')).toBe(true);
  });

  it('should return false for non-pen formats', () => {
    expect(isPenFormat('insulin lispro vial')).toBe(false);
    expect(isPenFormat('insulin regular')).toBe(false);
  });

  it('should handle empty string', () => {
    expect(isPenFormat('')).toBe(false);
  });

  it('should handle null/undefined', () => {
    expect(isPenFormat(null as any)).toBe(false);
    expect(isPenFormat(undefined as any)).toBe(false);
  });
});

describe('isVialFormat', () => {
  it('should detect vial format from drug name', () => {
    expect(isVialFormat('insulin lispro vial')).toBe(true);
    expect(isVialFormat('Lantus vial')).toBe(true);
    expect(isVialFormat('Humalog vial')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isVialFormat('INSULIN VIAL')).toBe(true);
    expect(isVialFormat('Insulin Vial')).toBe(true);
  });

  it('should return false for non-vial formats', () => {
    expect(isVialFormat('insulin lispro pen')).toBe(false);
    expect(isVialFormat('insulin regular')).toBe(false);
  });

  it('should handle empty string', () => {
    expect(isVialFormat('')).toBe(false);
  });

  it('should handle null/undefined', () => {
    expect(isVialFormat(null as any)).toBe(false);
    expect(isVialFormat(undefined as any)).toBe(false);
  });
});


