/**
 * Inhaler Configuration Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getActuationsPerCanister,
  calculateCanistersNeeded,
  DEFAULT_INHALER_ACTUATIONS,
} from './inhaler-config';

describe('getActuationsPerCanister', () => {
  it('should return actuation count for albuterol', () => {
    expect(getActuationsPerCanister('albuterol')).toBe(200);
  });

  it('should return actuation count for fluticasone', () => {
    expect(getActuationsPerCanister('fluticasone')).toBe(120);
  });

  it('should return actuation count for advair', () => {
    expect(getActuationsPerCanister('advair')).toBe(120);
  });

  it('should return actuation count for spiriva', () => {
    expect(getActuationsPerCanister('spiriva')).toBe(30);
  });

  it('should handle drug names with extra text (e.g., "albuterol sulfate")', () => {
    expect(getActuationsPerCanister('albuterol sulfate')).toBe(200);
    expect(getActuationsPerCanister('fluticasone propionate')).toBe(120);
  });

  it('should be case-insensitive', () => {
    expect(getActuationsPerCanister('ALBUTEROL')).toBe(200);
    expect(getActuationsPerCanister('Fluticasone')).toBe(120);
  });

  it('should handle whitespace', () => {
    expect(getActuationsPerCanister('  albuterol  ')).toBe(200);
    expect(getActuationsPerCanister(' fluticasone ')).toBe(120);
  });

  it('should return default for unknown drugs', () => {
    expect(getActuationsPerCanister('unknown_drug')).toBe(DEFAULT_INHALER_ACTUATIONS);
  });

  it('should return default for empty string', () => {
    expect(getActuationsPerCanister('')).toBe(DEFAULT_INHALER_ACTUATIONS);
  });

  it('should return default for null/undefined', () => {
    expect(getActuationsPerCanister(null as any)).toBe(DEFAULT_INHALER_ACTUATIONS);
    expect(getActuationsPerCanister(undefined as any)).toBe(DEFAULT_INHALER_ACTUATIONS);
  });
});

describe('calculateCanistersNeeded', () => {
  it('should calculate canisters for exact match', () => {
    expect(calculateCanistersNeeded(200, 200)).toBe(1);
    expect(calculateCanistersNeeded(400, 200)).toBe(2);
    expect(calculateCanistersNeeded(600, 200)).toBe(3);
  });

  it('should round up to whole canisters', () => {
    expect(calculateCanistersNeeded(120, 200)).toBe(1); // 120/200 = 0.6 → 1
    expect(calculateCanistersNeeded(250, 200)).toBe(2); // 250/200 = 1.25 → 2
    expect(calculateCanistersNeeded(450, 200)).toBe(3); // 450/200 = 2.25 → 3
  });

  it('should handle small quantities', () => {
    expect(calculateCanistersNeeded(1, 200)).toBe(1);
    expect(calculateCanistersNeeded(10, 200)).toBe(1);
    expect(calculateCanistersNeeded(50, 200)).toBe(1);
  });

  it('should handle large quantities', () => {
    expect(calculateCanistersNeeded(1000, 200)).toBe(5);
    expect(calculateCanistersNeeded(2400, 200)).toBe(12);
  });

  it('should handle different actuation counts', () => {
    expect(calculateCanistersNeeded(120, 120)).toBe(1);
    expect(calculateCanistersNeeded(150, 120)).toBe(2);
    expect(calculateCanistersNeeded(30, 30)).toBe(1);
    expect(calculateCanistersNeeded(45, 30)).toBe(2);
  });

  it('should handle zero actuations', () => {
    expect(calculateCanistersNeeded(0, 200)).toBe(0);
  });

  it('should handle zero actuations per canister', () => {
    expect(calculateCanistersNeeded(100, 0)).toBe(0);
  });

  it('should handle negative values gracefully', () => {
    expect(calculateCanistersNeeded(-100, 200)).toBe(0);
    expect(calculateCanistersNeeded(100, -200)).toBe(0);
  });
});


