/**
 * Unit Conversion Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  convertToML,
  roundLiquidVolume,
  normalizeLiquidUnit,
  isLiquidUnit,
} from './unit-conversions';

describe('convertToML', () => {
  it('should convert teaspoons to mL', () => {
    expect(convertToML(1, 'teaspoon')).toBe(5);
    expect(convertToML(2, 'teaspoons')).toBe(10);
    expect(convertToML(1, 'tsp')).toBe(5);
  });

  it('should convert tablespoons to mL', () => {
    expect(convertToML(1, 'tablespoon')).toBe(15);
    expect(convertToML(2, 'tablespoons')).toBe(30);
    expect(convertToML(1, 'tbsp')).toBe(15);
  });

  it('should convert ounces to mL', () => {
    expect(convertToML(1, 'oz')).toBe(30);
    expect(convertToML(2, 'ounce')).toBe(60);
    expect(convertToML(3, 'ounces')).toBe(90);
  });

  it('should handle mL as identity conversion', () => {
    expect(convertToML(5, 'ml')).toBe(5);
    expect(convertToML(10, 'mL')).toBe(10);
    expect(convertToML(15, 'milliliter')).toBe(15);
    expect(convertToML(20, 'milliliters')).toBe(20);
  });

  it('should throw error for unknown units', () => {
    expect(() => convertToML(1, 'gallon')).toThrow('Unknown unit: gallon');
    expect(() => convertToML(1, 'liter')).toThrow('Unknown unit: liter');
  });

  it('should be case-insensitive', () => {
    expect(convertToML(1, 'TEASPOON')).toBe(5);
    expect(convertToML(1, 'Tablespoon')).toBe(15);
    expect(convertToML(1, 'OZ')).toBe(30);
  });

  it('should handle whitespace', () => {
    expect(convertToML(1, '  teaspoon  ')).toBe(5);
    expect(convertToML(1, ' tablespoon ')).toBe(15);
  });
});

describe('roundLiquidVolume', () => {
  it('should round up to nearest 5mL for volumes >= 5mL', () => {
    expect(roundLiquidVolume(5)).toBe(5);
    expect(roundLiquidVolume(6)).toBe(10);
    expect(roundLiquidVolume(10)).toBe(10);
    expect(roundLiquidVolume(11)).toBe(15);
    expect(roundLiquidVolume(14.9)).toBe(15);
    expect(roundLiquidVolume(15)).toBe(15);
    expect(roundLiquidVolume(152)).toBe(155);
  });

  it('should round up to nearest whole mL for volumes < 5mL', () => {
    expect(roundLiquidVolume(1)).toBe(1);
    expect(roundLiquidVolume(1.5)).toBe(2);
    expect(roundLiquidVolume(2.1)).toBe(3);
    expect(roundLiquidVolume(3.9)).toBe(4);
    expect(roundLiquidVolume(4)).toBe(4);
    expect(roundLiquidVolume(4.1)).toBe(5);
  });

  it('should handle decimal volumes correctly', () => {
    expect(roundLiquidVolume(150.5)).toBe(155);
    expect(roundLiquidVolume(99.9)).toBe(100);
    expect(roundLiquidVolume(101.1)).toBe(105);
  });
});

describe('normalizeLiquidUnit', () => {
  it('should normalize liquid units to mL', () => {
    expect(normalizeLiquidUnit('teaspoon')).toBe('mL');
    expect(normalizeLiquidUnit('tablespoon')).toBe('mL');
    expect(normalizeLiquidUnit('oz')).toBe('mL');
    expect(normalizeLiquidUnit('ml')).toBe('mL');
    expect(normalizeLiquidUnit('milliliter')).toBe('mL');
  });

  it('should return null for non-liquid units', () => {
    expect(normalizeLiquidUnit('tablet')).toBeNull();
    expect(normalizeLiquidUnit('capsule')).toBeNull();
    expect(normalizeLiquidUnit('gram')).toBeNull();
  });

  it('should be case-insensitive', () => {
    expect(normalizeLiquidUnit('TEASPOON')).toBe('mL');
    expect(normalizeLiquidUnit('Tablespoon')).toBe('mL');
  });
});

describe('isLiquidUnit', () => {
  it('should return true for liquid units', () => {
    expect(isLiquidUnit('teaspoon')).toBe(true);
    expect(isLiquidUnit('tablespoon')).toBe(true);
    expect(isLiquidUnit('oz')).toBe(true);
    expect(isLiquidUnit('ml')).toBe(true);
    expect(isLiquidUnit('mL')).toBe(true);
  });

  it('should return false for non-liquid units', () => {
    expect(isLiquidUnit('tablet')).toBe(false);
    expect(isLiquidUnit('capsule')).toBe(false);
    expect(isLiquidUnit('gram')).toBe(false);
    expect(isLiquidUnit('unknown')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isLiquidUnit('TEASPOON')).toBe(true);
    expect(isLiquidUnit('Tablespoon')).toBe(true);
  });
});


