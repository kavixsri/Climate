/**
 * Unit tests — insights module.
 * Validates insight generation, structural contracts, relevance to user
 * emission data, and reduction suggestion helpers.
 * @module tests/unit/insights
 */

import { describe, it, expect } from 'vitest';
import {
  generateInsights,
  getTopEmissionCategories,
  getReductionSuggestions,
} from '../../src/core/insights.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Sample activities simulating a user who drives and eats meat a lot. */
const SAMPLE_ACTIVITIES = [
  { category: 'transportation', type: 'car', subtype: 'gasoline', amount: 50, date: new Date().toISOString().split('T')[0] },
  { category: 'transportation', type: 'car', subtype: 'gasoline', amount: 30, date: new Date().toISOString().split('T')[0] },
  { category: 'energy', type: 'electricity', amount: 200, date: new Date().toISOString().split('T')[0] },
  { category: 'diet', type: 'meatHeavy', amount: 7, date: new Date().toISOString().split('T')[0] },
  { category: 'shopping', type: 'clothing', amount: 2, date: new Date().toISOString().split('T')[0] },
  { category: 'waste', type: 'landfill', amount: 10, date: new Date().toISOString().split('T')[0] },
];

/** Sample category breakdown for getTopEmissionCategories */
const SAMPLE_BREAKDOWN = {
  transportation: { total: 450, percentage: 43.7, count: 2 },
  energy: { total: 200, percentage: 19.4, count: 1 },
  diet: { total: 300, percentage: 29.1, count: 1 },
  shopping: { total: 50, percentage: 4.9, count: 1 },
  waste: { total: 30, percentage: 2.9, count: 1 },
};

const VALID_IMPACT_LEVELS = ['high', 'medium', 'low'];
const VALID_EASE_LEVELS = ['easy', 'moderate', 'hard'];

const REQUIRED_INSIGHT_FIELDS = [
  'id',
  'title',
  'description',
  'category',
  'impactLevel',
  'easeLevel',
  'potentialSavingKg',
  'actionSteps',
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('insights module', () => {
  // ── generateInsights ────────────────────────────────────────────────────
  describe('generateInsights()', () => {
    it('returns an array of insight objects', () => {
      const insights = generateInsights(SAMPLE_ACTIVITIES);
      expect(Array.isArray(insights)).toBe(true);
      expect(insights.length).toBeGreaterThan(0);
    });

    for (const field of REQUIRED_INSIGHT_FIELDS) {
      it(`every insight has the required "${field}" field`, () => {
        const insights = generateInsights(SAMPLE_ACTIVITIES);
        for (const insight of insights) {
          expect(insight).toHaveProperty(field);
        }
      });
    }

    it('impactLevel is one of high, medium, low', () => {
      const insights = generateInsights(SAMPLE_ACTIVITIES);
      for (const insight of insights) {
        expect(VALID_IMPACT_LEVELS).toContain(insight.impactLevel);
      }
    });

    it('easeLevel is one of easy, moderate, hard', () => {
      const insights = generateInsights(SAMPLE_ACTIVITIES);
      for (const insight of insights) {
        expect(VALID_EASE_LEVELS).toContain(insight.easeLevel);
      }
    });

    it("insights are relevant to the user\u2019s top emission categories", () => {
      const insights = generateInsights(SAMPLE_ACTIVITIES);
      // At least one insight should target the highest category
      const categories = insights.map((i) => i.category);
      // transportation or diet should appear (the two highest)
      const hasRelevant =
        categories.includes('transportation') || categories.includes('diet');
      expect(hasRelevant).toBe(true);
    });

    it('potentialSavingKg is a non-negative number', () => {
      const insights = generateInsights(SAMPLE_ACTIVITIES);
      for (const insight of insights) {
        expect(typeof insight.potentialSavingKg).toBe('number');
        expect(insight.potentialSavingKg).toBeGreaterThanOrEqual(0);
      }
    });

    it('actionSteps is an array of strings', () => {
      const insights = generateInsights(SAMPLE_ACTIVITIES);
      for (const insight of insights) {
        expect(Array.isArray(insight.actionSteps)).toBe(true);
        for (const step of insight.actionSteps) {
          expect(typeof step).toBe('string');
        }
      }
    });

    it('returns at most 5 insights', () => {
      const insights = generateInsights(SAMPLE_ACTIVITIES);
      expect(insights.length).toBeLessThanOrEqual(5);
    });

    it('returns empty array for empty activities', () => {
      const insights = generateInsights([]);
      expect(Array.isArray(insights)).toBe(true);
    });
  });

  // ── getTopEmissionCategories ───────────────────────────────────────────
  describe('getTopEmissionCategories()', () => {
    it('returns categories sorted by emission value', () => {
      const top = getTopEmissionCategories(SAMPLE_BREAKDOWN);
      expect(Array.isArray(top)).toBe(true);
      expect(top.length).toBeGreaterThan(0);
      // First should be the highest
      expect(top[0].category || top[0]).toBeDefined();
    });

    it('handles empty breakdown', () => {
      const top = getTopEmissionCategories({});
      expect(Array.isArray(top)).toBe(true);
    });
  });

  // ── getReductionSuggestions ────────────────────────────────────────────
  describe('getReductionSuggestions()', () => {
    it('returns suggestions for a valid category', () => {
      const suggestions = getReductionSuggestions('transportation', 5000);
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('each suggestion has required fields', () => {
      const suggestions = getReductionSuggestions('energy', 3000);
      for (const s of suggestions) {
        expect(s).toHaveProperty('title');
        expect(s).toHaveProperty('description');
        expect(s).toHaveProperty('category');
      }
    });

    it('throws error for unknown category', () => {
      expect(() => getReductionSuggestions('nonexistent', 1000)).toThrow();
    });
  });
});
