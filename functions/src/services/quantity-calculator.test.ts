/**
 * Quantity Calculator Tests
 */

import { describe, it, expect } from 'vitest';
import { calculateQuantity } from './quantity-calculator';
import { ValidationError } from '../utils/errors';
import type { ParsedSIG } from './sig-parser';

describe('Quantity Calculator', () => {
  const mockParsedSIG: ParsedSIG = {
    dose_unit: 'tab',
    per_day: 2,
    confidence: 'parsed',
  };

  describe('calculateQuantity', () => {
    it('should calculate basic quantity (per_day × days_supply)', () => {
      const result = calculateQuantity(mockParsedSIG, 30, 'solid');
      expect(result).toEqual({
        dose_unit: 'tab',
        per_day: 2,
        total_qty: 60, // 2 × 30
        days_supply: 30,
      });
    });

    it('should calculate quantity for different days supply', () => {
      const result = calculateQuantity(mockParsedSIG, 90, 'solid');
      expect(result.total_qty).toBe(180); // 2 × 90
    });

    it('should normalize unit types', () => {
      const tabletSIG: ParsedSIG = { dose_unit: 'tablet', per_day: 1, confidence: 'parsed' };
      const result = calculateQuantity(tabletSIG, 30, 'solid');
      expect(result.dose_unit).toBe('tab');
    });

    it('should use unit override when provided', () => {
      const result = calculateQuantity(mockParsedSIG, 30, 'solid', undefined, 'cap');
      expect(result.dose_unit).toBe('cap');
    });

    it('should round to integers for tab/cap units', () => {
      const decimalSIG: ParsedSIG = { dose_unit: 'tab', per_day: 1.5, confidence: 'parsed' };
      const result = calculateQuantity(decimalSIG, 30, 'solid');
      expect(result.total_qty).toBe(45); // 1.5 × 30 = 45 (rounded)
    });

    it('should round liquid volumes to nearest 5mL', () => {
      const liquidSIG: ParsedSIG = { dose_unit: 'mL', per_day: 5.123, confidence: 'parsed' };
      const result = calculateQuantity(liquidSIG, 30, 'liquid');
      expect(result.total_qty).toBe(155); // 5.123 × 30 = 153.69 → rounds up to 155 (nearest 5mL)
    });

    it('should throw ValidationError for invalid parsedSIG', () => {
      expect(() => calculateQuantity(null as any, 30, 'solid')).toThrow(ValidationError);
      expect(() => calculateQuantity(undefined as any, 30, 'solid')).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid days_supply (not a number)', () => {
      expect(() => calculateQuantity(mockParsedSIG, NaN, 'solid')).toThrow(ValidationError);
      expect(() => calculateQuantity(mockParsedSIG, '30' as any, 'solid')).toThrow(ValidationError);
    });

    it('should throw ValidationError for zero days_supply', () => {
      expect(() => calculateQuantity(mockParsedSIG, 0, 'solid')).toThrow(ValidationError);
    });

    it('should throw ValidationError for negative days_supply', () => {
      expect(() => calculateQuantity(mockParsedSIG, -1, 'solid')).toThrow(ValidationError);
    });

    it('should throw ValidationError for days_supply > 365', () => {
      expect(() => calculateQuantity(mockParsedSIG, 366, 'solid')).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-integer days_supply', () => {
      expect(() => calculateQuantity(mockParsedSIG, 30.5, 'solid')).toThrow(ValidationError);
    });

    it('should throw ValidationError for zero per_day', () => {
      const zeroSIG: ParsedSIG = { dose_unit: 'tab', per_day: 0, confidence: 'parsed' };
      expect(() => calculateQuantity(zeroSIG, 30, 'solid')).toThrow(ValidationError);
    });

    it('should throw ValidationError for negative per_day', () => {
      const negativeSIG: ParsedSIG = { dose_unit: 'tab', per_day: -1, confidence: 'parsed' };
      expect(() => calculateQuantity(negativeSIG, 30, 'solid')).toThrow(ValidationError);
    });

    it('should throw ValidationError for per_day > 100', () => {
      const largeSIG: ParsedSIG = { dose_unit: 'tab', per_day: 101, confidence: 'parsed' };
      expect(() => calculateQuantity(largeSIG, 30, 'solid')).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid unit type', () => {
      const invalidSIG: ParsedSIG = { dose_unit: 'invalid', per_day: 2, confidence: 'parsed' };
      expect(() => calculateQuantity(invalidSIG, 30, 'solid')).toThrow(ValidationError);
    });

    it('should throw ValidationError for total_qty > 10000', () => {
      const largeSIG: ParsedSIG = { dose_unit: 'tab', per_day: 100, confidence: 'parsed' };
      expect(() => calculateQuantity(largeSIG, 200, 'solid')).toThrow(ValidationError); // 100 × 200 = 20000 > 10000
    });

    it('should handle edge case: days_supply = 1', () => {
      const result = calculateQuantity(mockParsedSIG, 1, 'solid');
      expect(result.total_qty).toBe(2); // 2 × 1
      expect(result.days_supply).toBe(1);
    });

    it('should handle edge case: days_supply = 365', () => {
      const result = calculateQuantity(mockParsedSIG, 365, 'solid');
      expect(result.total_qty).toBe(730); // 2 × 365
      expect(result.days_supply).toBe(365);
    });

    it('should handle edge case: per_day = 1', () => {
      const oneSIG: ParsedSIG = { dose_unit: 'tab', per_day: 1, confidence: 'parsed' };
      const result = calculateQuantity(oneSIG, 30, 'solid');
      expect(result.total_qty).toBe(30); // 1 × 30
    });

    it('should handle edge case: per_day = 100', () => {
      const maxSIG: ParsedSIG = { dose_unit: 'tab', per_day: 100, confidence: 'parsed' };
      const result = calculateQuantity(maxSIG, 30, 'solid');
      expect(result.total_qty).toBe(3000); // 100 × 30
    });
  });
});
