/**
 * Unit tests — emission-factors module.
 * Validates the correctness and completeness of emission factor data,
 * lookup utilities, and exported constants.
 * @module tests/unit/emission-factors
 */

import { describe, it, expect } from 'vitest';
import {
  EMISSION_FACTORS,
  CATEGORIES,
  AVERAGES,
  getFactorsForCategory,
  getFactorByPath,
} from '../../src/core/emission-factors.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const EXPECTED_CATEGORIES = [
  'transportation',
  'energy',
  'diet',
  'shopping',
  'waste',
];

const REQUIRED_FACTOR_PROPS = ['factor', 'unit', 'label', 'source'];

const EXPECTED_AVERAGE_REGIONS = [
  'global',
  'us',
  'eu',
  'uk',
  'india',
  'china',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively collects every leaf factor object from a nested structure.
 * A leaf is any object that contains the `factor` property.
 *
 * @param {Record<string, any>} obj
 * @param {string} [prefix]
 * @returns {Array<{ path: string; value: Record<string, any> }>}
 */
function collectLeafFactors(obj, prefix = '') {
  /** @type {Array<{ path: string; value: Record<string, any> }>} */
  const results = [];
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && 'factor' in val) {
      results.push({ path, value: val });
    } else if (val && typeof val === 'object') {
      results.push(...collectLeafFactors(val, path));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('emission-factors module', () => {
  // ── Category presence ───────────────────────────────────────────────────
  describe('EMISSION_FACTORS structure', () => {
    it.each(EXPECTED_CATEGORIES)(
      'contains the "%s" category',
      (category) => {
        expect(EMISSION_FACTORS).toHaveProperty(category);
        expect(typeof EMISSION_FACTORS[category]).toBe('object');
      },
    );

    it('does not contain unexpected top-level keys', () => {
      const keys = Object.keys(EMISSION_FACTORS);
      for (const key of keys) {
        expect(EXPECTED_CATEGORIES).toContain(key);
      }
    });
  });

  // ── Leaf factor shape ───────────────────────────────────────────────────
  describe('factor entries', () => {
    const leaves = collectLeafFactors(EMISSION_FACTORS);

    it('has at least one leaf factor', () => {
      expect(leaves.length).toBeGreaterThan(0);
    });

    it.each(REQUIRED_FACTOR_PROPS)(
      'every factor has the required "%s" property',
      (prop) => {
        for (const { path, value } of leaves) {
          expect(value, `Missing "${prop}" at ${path}`).toHaveProperty(prop);
        }
      },
    );

    it('every factor value is a non-negative number', () => {
      for (const { path, value } of leaves) {
        expect(typeof value.factor, `factor at ${path} is not a number`).toBe(
          'number',
        );
        expect(
          value.factor,
          `factor at ${path} is negative`,
        ).toBeGreaterThanOrEqual(0);
      }
    });

    it('every factor has a non-empty label string', () => {
      for (const { path, value } of leaves) {
        expect(typeof value.label, `label at ${path}`).toBe('string');
        expect(value.label.length, `empty label at ${path}`).toBeGreaterThan(0);
      }
    });

    it('every factor has a non-empty unit string', () => {
      for (const { path, value } of leaves) {
        expect(typeof value.unit, `unit at ${path}`).toBe('string');
        expect(value.unit.length, `empty unit at ${path}`).toBeGreaterThan(0);
      }
    });
  });

  // ── getFactorsForCategory ───────────────────────────────────────────────
  describe('getFactorsForCategory()', () => {
    it('returns factors for a valid category', () => {
      const factors = getFactorsForCategory('transportation');
      expect(factors).toBeDefined();
      expect(Array.isArray(factors)).toBe(true);
      expect(factors.length).toBeGreaterThan(0);
    });

    it('each result has key and factor properties', () => {
      for (const cat of EXPECTED_CATEGORIES) {
        const factors = getFactorsForCategory(cat);
        for (const entry of factors) {
          expect(entry).toHaveProperty('key');
          expect(entry).toHaveProperty('factor');
          expect(typeof entry.factor.factor).toBe('number');
        }
      }
    });

    it('throws for an invalid category', () => {
      expect(() => getFactorsForCategory('nonexistent')).toThrow();
    });
  });

  // ── getFactorByPath ─────────────────────────────────────────────────────
  describe('getFactorByPath()', () => {
    it('returns the correct factor object for a valid dot-path', () => {
      const result = getFactorByPath('transportation.bus');
      expect(result).toBeDefined();
      expect(typeof result.factor).toBe('number');
      expect(result.label).toBe('Bus');
    });

    it('returns null for an invalid path', () => {
      const result = getFactorByPath('nonexistent.deeply.nested.path');
      expect(result).toBeNull();
    });

    it('throws for an empty string', () => {
      expect(() => getFactorByPath('')).toThrow();
    });

    it('returns null when path stops at a branch node (not a leaf)', () => {
      // A category key is a branch, not a leaf with `factor`
      const result = getFactorByPath('transportation');
      expect(result).toBeNull();
    });
  });

  // ── AVERAGES ────────────────────────────────────────────────────────────
  describe('AVERAGES', () => {
    it('is defined and is an object', () => {
      expect(AVERAGES).toBeDefined();
      expect(typeof AVERAGES).toBe('object');
    });

    it.each(EXPECTED_AVERAGE_REGIONS)(
      'contains the "%s" region',
      (region) => {
        expect(AVERAGES).toHaveProperty(region);
        expect(typeof AVERAGES[region]).toBe('object');
        expect(typeof AVERAGES[region].value).toBe('number');
        expect(AVERAGES[region].value).toBeGreaterThan(0);
      },
    );
  });

  // ── CATEGORIES ──────────────────────────────────────────────────────────
  describe('CATEGORIES', () => {
    it('is an array', () => {
      expect(Array.isArray(CATEGORIES)).toBe(true);
    });

    it('matches the keys of EMISSION_FACTORS', () => {
      const factorKeys = Object.keys(EMISSION_FACTORS).sort();
      const cats = [...CATEGORIES].sort();
      expect(cats).toEqual(factorKeys);
    });

    it('contains no duplicates', () => {
      const unique = new Set(CATEGORIES);
      expect(unique.size).toBe(CATEGORIES.length);
    });
  });
});
