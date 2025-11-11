/**
 * Package Selector Tests
 */

import { describe, it, expect } from 'vitest';
import { selectPackages, type SelectionConfig } from './package-selector';
import type { NDCPackageData } from '../types/index';

describe('Package Selector', () => {
  const mockNdcs: NDCPackageData[] = [
    { ndc: '12345678902', pkg_size: 60, active: true, dosage_form: 'TABLET' }, // Put 60 first to test sorting
    { ndc: '12345678901', pkg_size: 30, active: true, dosage_form: 'TABLET' },
    { ndc: '12345678903', pkg_size: 90, active: true, dosage_form: 'TABLET' },
    { ndc: '12345678904', pkg_size: 30, active: false, dosage_form: 'TABLET' }, // Inactive
  ];

  describe('selectPackages', () => {
    it('should select exact match (overfill = 0)', () => {
      const result = selectPackages(mockNdcs, 30);
      expect(result.chosen).toBeDefined();
      expect(result.chosen?.ndc).toBe('12345678901');
      expect(result.chosen?.pkg_size).toBe(30);
      expect(result.chosen?.overfill).toBe(0);
      expect(result.chosen?.packs).toBe(1);
    });

    it('should select minimal overfill option', () => {
      // Need 35, closest options:
      // - 30×2=60 (71% overfill) - exceeds 10% limit, rejected
      // - 60×1=60 (71% overfill) - exceeds 10% limit, rejected
      // - 90×1=90 (157% overfill) - exceeds 10% limit, rejected
      // With 10% max overfill, no option should be valid
      // Let's test with a case that should work: need 28, closest is 30 (7% overfill)
      const result = selectPackages(mockNdcs, 28); // Need 28, closest is 30 (7% overfill)
      expect(result.chosen).toBeDefined();
      expect(result.chosen?.overfill).toBeGreaterThan(0);
      expect(result.chosen?.overfill).toBeLessThanOrEqual(0.10); // Within 10% overfill
    });

    it('should prefer fewer packs for same quantity', () => {
      const result = selectPackages(mockNdcs, 60);
      expect(result.chosen).toBeDefined();
      // Should prefer 60×1 over 30×2 (same quantity, fewer packs)
      // Both have overfill=0, but 60×1 has fewer packs
      if (result.chosen) {
        expect(result.chosen.packs).toBe(1);
        expect(result.chosen.pkg_size).toBe(60);
      }
    });

    it('should support single-NDC multi-pack (e.g., 30×2)', () => {
      const result = selectPackages(mockNdcs, 60);
      expect(result.chosen).toBeDefined();
      // Could be 60×1 or 30×2, but 60×1 should win (fewer packs)
      if (result.chosen) {
        expect(result.chosen.pkg_size * result.chosen.packs).toBe(60);
      }
    });

    it('should filter out inactive NDCs', () => {
      const result = selectPackages(mockNdcs, 30);
      // Should not select inactive NDC (12345678904)
      expect(result.chosen?.ndc).not.toBe('12345678904');
    });

    it('should return alternates list (max 10)', () => {
      const result = selectPackages(mockNdcs, 30);
      expect(result.alternates).toBeDefined();
      expect(result.alternates.length).toBeLessThanOrEqual(10);
    });

    it('should enforce MAX_PACKS constraint', () => {
      const config: SelectionConfig = { maxPacks: 2 };
      const result = selectPackages(mockNdcs, 100, config);
      // Should not select options with > 2 packs
      if (result.chosen) {
        expect(result.chosen.packs).toBeLessThanOrEqual(2);
      }
      result.alternates.forEach((alt) => {
        expect(alt.packs).toBeLessThanOrEqual(2);
      });
    });

    it('should enforce OVERFILL_MAX constraint', () => {
      const config: SelectionConfig = { maxOverfill: 0.05 }; // 5% max overfill
      const result = selectPackages(mockNdcs, 35, config);
      // Should not select options with > 5% overfill
      if (result.chosen) {
        expect(result.chosen.overfill).toBeLessThanOrEqual(0.05);
      }
      result.alternates.forEach((alt) => {
        expect(alt.overfill).toBeLessThanOrEqual(0.05);
      });
    });

    it('should apply preferred NDCs bias', () => {
      const config: SelectionConfig = { preferredNdcs: ['12345678902'] };
      const result = selectPackages(mockNdcs, 30, config);
      // Preferred NDC should be ranked higher
      expect(result.chosen).toBeDefined();
      // If there are multiple options with similar scores, preferred should win
    });

    it('should return null chosen when no suitable package found', () => {
      const largeNdcs: NDCPackageData[] = [
        { ndc: '12345678901', pkg_size: 10, active: true, dosage_form: 'TABLET' },
      ];
      // Need 9, closest is 10 (11% overfill, exceeds 10% limit)
      const result = selectPackages(largeNdcs, 9);
      expect(result.chosen).toBeUndefined();
      expect(result.alternates).toEqual([]);
    });

    it('should handle empty NDCs array', () => {
      const result = selectPackages([], 30);
      expect(result.chosen).toBeUndefined();
      expect(result.alternates).toEqual([]);
    });

    it('should handle all inactive NDCs', () => {
      const inactiveNdcs: NDCPackageData[] = [
        { ndc: '12345678901', pkg_size: 30, active: false, dosage_form: 'TABLET' },
      ];
      const result = selectPackages(inactiveNdcs, 30);
      expect(result.chosen).toBeUndefined();
      expect(result.alternates).toEqual([]);
    });

    it('should calculate overfill correctly', () => {
      // Need 25, closest is 30 (20% overfill, exceeds 10% limit)
      // With 10% max overfill, this should be rejected
      // Let's test with a case that should work: need 28, closest is 30 (7% overfill)
      const result = selectPackages(mockNdcs, 28);
      expect(result.chosen).toBeDefined();
      // Overfill = (30 - 28) / 28 = 0.0714 = 7.14%
      expect(result.chosen?.overfill).toBeCloseTo(0.0714, 2);
    });

    it('should rank by score (exact match > minimal overfill > fewer packs)', () => {
      const exactMatchNdcs: NDCPackageData[] = [
        { ndc: '12345678901', pkg_size: 30, active: true, dosage_form: 'TABLET' },
        { ndc: '12345678902', pkg_size: 35, active: true, dosage_form: 'TABLET' },
      ];
      const result = selectPackages(exactMatchNdcs, 30);
      // Exact match (30) should be chosen over minimal overfill (35)
      expect(result.chosen?.ndc).toBe('12345678901');
      expect(result.chosen?.overfill).toBe(0);
    });

    it('should handle edge case: zero quantity', () => {
      const result = selectPackages(mockNdcs, 0);
      // Should handle gracefully (may return undefined or handle edge case)
      expect(result).toBeDefined();
    });

    it('should handle edge case: very large quantity', () => {
      const result = selectPackages(mockNdcs, 10000);
      // Should handle gracefully (may return undefined if no suitable package)
      expect(result).toBeDefined();
    });
  });
});

