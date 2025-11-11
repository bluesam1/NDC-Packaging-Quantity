/**
 * SIG Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { parseWithRules, parseSIG } from './sig-parser';

describe('SIG Parser', () => {
  describe('parseWithRules', () => {
    describe('common tablet patterns', () => {
      it('should parse QD (once daily) pattern', () => {
        const result = parseWithRules('Take 1 tablet by mouth once daily');
        expect(result).toEqual({
          dose_unit: 'tab',
          per_day: 1,
          confidence: 'parsed',
        });
      });

      it('should parse BID (twice daily) pattern', () => {
        const result = parseWithRules('Take 1 tablet by mouth twice daily');
        expect(result).toEqual({
          dose_unit: 'tab',
          per_day: 2,
          confidence: 'parsed',
        });
      });

      it('should parse TID (three times daily) pattern', () => {
        const result = parseWithRules('Take 1 tablet by mouth three times daily');
        expect(result).toEqual({
          dose_unit: 'tab',
          per_day: 3,
          confidence: 'parsed',
        });
      });

      it('should parse QID (four times daily) pattern', () => {
        const result = parseWithRules('Take 1 tablet by mouth four times daily');
        expect(result).toEqual({
          dose_unit: 'tab',
          per_day: 4,
          confidence: 'parsed',
        });
      });

      it('should parse QD abbreviation', () => {
        const result = parseWithRules('1 tab PO QD');
        expect(result).toEqual({
          dose_unit: 'tab',
          per_day: 1,
          confidence: 'parsed',
        });
      });

      it('should parse BID abbreviation', () => {
        const result = parseWithRules('Take 2 capsules PO BID');
        expect(result).toEqual({
          dose_unit: 'cap',
          per_day: 4, // 2 capsules × 2 times daily
          confidence: 'parsed',
        });
      });

      it('should parse TID abbreviation', () => {
        const result = parseWithRules('1 tab PO TID');
        expect(result).toEqual({
          dose_unit: 'tab',
          per_day: 3,
          confidence: 'parsed',
        });
      });

      it('should parse QID abbreviation', () => {
        const result = parseWithRules('1 tab PO QID');
        expect(result).toEqual({
          dose_unit: 'tab',
          per_day: 4,
          confidence: 'parsed',
        });
      });
    });

    describe('liquid formats', () => {
      it('should parse mL format', () => {
        const result = parseWithRules('Take 5 mL by mouth once daily');
        expect(result).toEqual({
          dose_unit: 'mL',
          per_day: 5,
          confidence: 'parsed',
        });
      });

      it('should parse teaspoon format', () => {
        const result = parseWithRules('Take 1 teaspoon by mouth twice daily');
        expect(result).toEqual({
          dose_unit: 'mL',
          per_day: 10, // 1 teaspoon = 5 mL × 2/day = 10 mL
          confidence: 'parsed',
        });
      });

      it('should parse tablespoon format', () => {
        const result = parseWithRules('Take 1 tablespoon by mouth once daily');
        expect(result).toEqual({
          dose_unit: 'mL',
          per_day: 15, // 1 tablespoon = 15 mL × 1/day = 15 mL
          confidence: 'parsed',
        });
      });
    });

    describe('inhaler formats', () => {
      it('should parse puffs format', () => {
        const result = parseWithRules('Inhale 2 puffs twice daily');
        expect(result).toEqual({
          dose_unit: 'actuation',
          per_day: 4, // 2 puffs × 2/day = 4 actuations
          confidence: 'parsed',
        });
      });

      it('should parse actuations format', () => {
        const result = parseWithRules('Use 1 actuation three times daily');
        expect(result).toEqual({
          dose_unit: 'actuation',
          per_day: 3, // 1 actuation × 3/day = 3 actuations
          confidence: 'parsed',
        });
      });

      it('should parse inhalations format', () => {
        const result = parseWithRules('Inhale 2 inhalations four times daily');
        expect(result).toEqual({
          dose_unit: 'actuation',
          per_day: 8, // 2 inhalations × 4/day = 8 actuations
          confidence: 'parsed',
        });
      });

      it('should parse sprays format', () => {
        const result = parseWithRules('Use 1 spray twice daily');
        expect(result).toEqual({
          dose_unit: 'actuation',
          per_day: 2, // 1 spray × 2/day = 2 actuations
          confidence: 'parsed',
        });
      });
    });

    describe('insulin formats', () => {
      it('should parse units format', () => {
        const result = parseWithRules('Inject 20 units once daily');
        expect(result).toEqual({
          dose_unit: 'unit',
          per_day: 20, // 20 units × 1/day = 20 units
          confidence: 'parsed',
        });
      });

      it('should parse units with SC administration', () => {
        const result = parseWithRules('Inject 10 units SC twice daily');
        expect(result).toEqual({
          dose_unit: 'unit',
          per_day: 20, // 10 units × 2/day = 20 units
          confidence: 'parsed',
        });
      });

      it('should parse decimal units', () => {
        const result = parseWithRules('Inject 5.5 units once daily');
        expect(result).toEqual({
          dose_unit: 'unit',
          per_day: 5.5, // 5.5 units × 1/day = 5.5 units
          confidence: 'parsed',
        });
      });
    });

    describe('unit normalization', () => {
      it('should normalize tablet to tab', () => {
        const result = parseWithRules('Take 1 tablet by mouth once daily');
        expect(result?.dose_unit).toBe('tab');
      });

      it('should normalize tablets to tab', () => {
        const result = parseWithRules('Take 2 tablets by mouth once daily');
        expect(result?.dose_unit).toBe('tab');
      });

      it('should normalize capsule to cap', () => {
        const result = parseWithRules('Take 1 capsule by mouth once daily');
        expect(result?.dose_unit).toBe('cap');
      });

      it('should normalize capsules to cap', () => {
        const result = parseWithRules('Take 2 capsules by mouth once daily');
        expect(result?.dose_unit).toBe('cap');
      });

      it('should normalize milliliter to mL', () => {
        const result = parseWithRules('Take 5 milliliters by mouth once daily');
        expect(result?.dose_unit).toBe('mL');
      });
    });

    describe('per-day quantity calculation', () => {
      it('should calculate per_day = quantity × frequency', () => {
        const result = parseWithRules('Take 2 tablets by mouth twice daily');
        expect(result?.per_day).toBe(4); // 2 × 2
      });

      it('should calculate per_day for multiple doses', () => {
        const result = parseWithRules('Take 1 tablet by mouth three times daily');
        expect(result?.per_day).toBe(3); // 1 × 3
      });

      it('should calculate per_day for complex pattern', () => {
        const result = parseWithRules('Take 3 capsules by mouth four times daily');
        expect(result?.per_day).toBe(12); // 3 × 4
      });
    });

    describe('common variations', () => {
      it('should handle "orally" synonym', () => {
        const result = parseWithRules('Take 1 tablet orally twice daily');
        expect(result).toBeDefined();
        expect(result?.per_day).toBe(2);
      });

      it('should handle "by mouth" synonym', () => {
        const result = parseWithRules('Take 1 tablet by mouth once daily');
        expect(result).toBeDefined();
        expect(result?.per_day).toBe(1);
      });

      it('should handle numeric frequencies (1x daily)', () => {
        const result = parseWithRules('Take 1 tablet 1x daily');
        expect(result).toBeDefined();
        expect(result?.per_day).toBe(1);
      });

      it('should handle numeric frequencies (2x daily)', () => {
        const result = parseWithRules('Take 1 tablet 2x daily');
        expect(result).toBeDefined();
        expect(result?.per_day).toBe(2);
      });

      it('should handle numeric frequencies (2x/day)', () => {
        const result = parseWithRules('Take 1 tablet 2x/day');
        expect(result).toBeDefined();
        expect(result?.per_day).toBe(2);
      });
    });

    describe('unit override', () => {
      it('should use unit override when provided', () => {
        const result = parseWithRules('Take 1 tablet by mouth once daily', 'cap');
        expect(result?.dose_unit).toBe('cap');
      });

      it('should normalize unit override', () => {
        const result = parseWithRules('Take 1 tablet by mouth once daily', 'capsule');
        expect(result?.dose_unit).toBe('cap');
      });
    });

    describe('parsing failures', () => {
      it('should return null for empty string', () => {
        const result = parseWithRules('');
        expect(result).toBeNull();
      });

      it('should return null for invalid format', () => {
        const result = parseWithRules('Invalid SIG format');
        expect(result).toBeNull();
      });

      it('should return null when frequency is missing', () => {
        const result = parseWithRules('Take 1 tablet');
        expect(result).toBeNull();
      });

      it('should return null when unit is missing', () => {
        const result = parseWithRules('Take 1 twice daily');
        expect(result).toBeNull();
      });

      it('should return null for unreasonable per_day (> 100)', () => {
        const result = parseWithRules('Take 50 tablets by mouth three times daily');
        expect(result).toBeNull(); // 50 × 3 = 150 > 100
      });
    });
  });

  describe('parseSIG', () => {
    it('should parse valid SIG with rules', async () => {
      const result = await parseSIG('Take 1 tablet by mouth once daily');
      expect(result).toBeDefined();
      expect(result?.dose_unit).toBe('tab');
      expect(result?.per_day).toBe(1);
    });

    it('should return null for invalid SIG when AI fallback disabled', async () => {
      // Disable AI fallback
      const originalEnv = process.env.USE_AI_FALLBACK;
      process.env.USE_AI_FALLBACK = 'false';
      
      const result = await parseSIG('Invalid SIG format');
      expect(result).toBeNull();
      
      // Restore
      if (originalEnv) {
        process.env.USE_AI_FALLBACK = originalEnv;
      } else {
        delete process.env.USE_AI_FALLBACK;
      }
    });

    it('should use unit override', async () => {
      const result = await parseSIG('Take 1 tablet by mouth once daily', 'cap');
      expect(result?.dose_unit).toBe('cap');
    });

    it('should return null when both rules and AI fail', async () => {
      // Disable AI fallback for this test
      const originalEnv = process.env.USE_AI_FALLBACK;
      process.env.USE_AI_FALLBACK = 'false';
      
      const result = await parseSIG('Complex SIG format that rules cannot parse');
      expect(result).toBeNull();
      
      // Restore
      if (originalEnv) {
        process.env.USE_AI_FALLBACK = originalEnv;
      } else {
        delete process.env.USE_AI_FALLBACK;
      }
    });
  });
});

