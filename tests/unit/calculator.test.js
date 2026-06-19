/**
 * Unit tests — calculator module.
 * Covers individual activity calculations, aggregation, category breakdowns,
 * annual projections, and trend detection.
 * @module tests/unit/calculator
 */

import { describe, it, expect } from 'vitest';
import {
  calculateActivityEmission,
  calculateTotalEmissions,
  calculateCategoryBreakdown,
  projectAnnualEmissions,
  calculateTrend,
} from '../../src/core/calculator.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** @returns {Array<{name: string; activity: object; expected: number}>} */
function activityFixtures() {
  return [
    {
      name: 'car travel (10 km, gasoline)',
      activity: { category: 'transportation', type: 'car', subtype: 'gasoline', amount: 10, date: '2024-06-15' },
      expectedMin: 0,
    },
    {
      name: 'electricity usage (100 kWh)',
      activity: {
        category: 'energy',
        type: 'electricity',
        amount: 100,
        date: '2024-06-15',
      },
      expectedMin: 0,
    },
    {
      name: 'meat-heavy diet (2 days)',
      activity: { category: 'diet', type: 'meatHeavy', amount: 2, date: '2024-06-15' },
      expectedMin: 0,
    },
    {
      name: 'clothing purchase (1 item)',
      activity: {
        category: 'shopping',
        type: 'clothing',
        amount: 1,
        date: '2024-06-15',
      },
      expectedMin: 0,
    },
    {
      name: 'landfill waste (5 kg)',
      activity: {
        category: 'waste',
        type: 'landfill',
        amount: 5,
        date: '2024-06-15',
      },
      expectedMin: 0,
    },
  ];
}

/**
 * Build a minimal valid activity for helper tests.
 * @param {Partial<object>} overrides
 */
function makeActivity(overrides = {}) {
  return {
    category: 'transportation',
    type: 'car',
    subtype: 'gasoline',
    amount: 10,
    date: '2024-06-15',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculator module', () => {
  // ── calculateActivityEmission ───────────────────────────────────────────
  describe('calculateActivityEmission()', () => {
    const fixtures = activityFixtures();

    it.each(fixtures)(
      'returns a positive CO₂e value for $name',
      ({ activity }) => {
        const result = calculateActivityEmission(activity);
        expect(typeof result).toBe('object');
        expect(typeof result.co2e).toBe('number');
        expect(result.co2e).toBeGreaterThan(0);
      },
    );

    it('returns 0 for zero amount', () => {
      const result = calculateActivityEmission(makeActivity({ amount: 0 }));
      expect(result.co2e).toBe(0);
    });

    it('scales linearly with amount', () => {
      const base = calculateActivityEmission(makeActivity({ amount: 1 }));
      const double = calculateActivityEmission(makeActivity({ amount: 2 }));
      expect(double.co2e).toBeCloseTo(base.co2e * 2, 5);
    });
  });

  // ── calculateTotalEmissions ─────────────────────────────────────────────
  describe('calculateTotalEmissions()', () => {
    it('returns correct total for multiple activities', () => {
      const activities = [
        makeActivity({ amount: 10 }),
        makeActivity({ category: 'diet', type: 'meatHeavy', subtype: undefined, amount: 2, date: '2024-06-15' }),
      ];
      const result = calculateTotalEmissions(activities);
      expect(result).toBeDefined();
      expect(typeof result.total).toBe('number');
      expect(result.total).toBeGreaterThan(0);
    });

    it('provides a correct breakdown by category', () => {
      const activities = [
        makeActivity({ amount: 10 }),
        makeActivity({ category: 'diet', type: 'meatHeavy', subtype: undefined, amount: 2, date: '2024-06-15' }),
      ];
      const result = calculateTotalEmissions(activities);
      expect(result.breakdown).toBeDefined();
      expect(typeof result.breakdown).toBe('object');

      // Sum of breakdown values should equal total
      const breakdownSum = Object.values(result.breakdown).reduce(
        (acc, v) => acc + v,
        0,
      );
      expect(breakdownSum).toBeCloseTo(result.total, 2);
    });

    it('returns zeros for an empty array', () => {
      const result = calculateTotalEmissions([]);
      expect(result.total).toBe(0);
      if (result.breakdown) {
        for (const val of Object.values(result.breakdown)) {
          expect(val).toBe(0);
        }
      }
    });

    it('handles a single activity correctly', () => {
      const activity = makeActivity({ amount: 5 });
      const single = calculateActivityEmission(activity);
      const result = calculateTotalEmissions([activity]);
      expect(result.total).toBeCloseTo(single.co2e, 2);
    });
  });

  // ── calculateCategoryBreakdown ──────────────────────────────────────────
  describe('calculateCategoryBreakdown()', () => {
    it('returns percentages that sum to ~100', () => {
      const activities = [
        makeActivity({ amount: 10 }),
        makeActivity({ category: 'diet', type: 'meatHeavy', subtype: undefined, amount: 2, date: '2024-06-15' }),
        makeActivity({
          category: 'energy',
          type: 'electricity',
          subtype: undefined,
          amount: 50,
          date: '2024-06-15',
        }),
      ];
      const breakdown = calculateCategoryBreakdown(activities);
      expect(breakdown).toBeDefined();

      // Sum only non-zero percentages
      const total = Object.values(breakdown).reduce((s, v) => s + v.percentage, 0);
      expect(total).toBeCloseTo(100, 0);
    });

    it('returns zero percentages for an empty array', () => {
      const breakdown = calculateCategoryBreakdown([]);
      for (const entry of Object.values(breakdown)) {
        expect(entry.total).toBe(0);
        expect(entry.percentage).toBe(0);
      }
    });

    it('returns 100% for a single category', () => {
      const activities = [
        makeActivity({ amount: 10 }),
        makeActivity({ amount: 20 }),
      ];
      const breakdown = calculateCategoryBreakdown(activities);
      expect(breakdown.transportation.percentage).toBeCloseTo(100, 0);
    });
  });

  // ── projectAnnualEmissions ──────────────────────────────────────────────
  describe('projectAnnualEmissions()', () => {
    it('correctly projects 30-day data to annual', () => {
      const activities = [makeActivity({ amount: 10 })];
      const projected = projectAnnualEmissions(activities, 30);
      expect(projected.annualTotal).toBeGreaterThan(0);
      // annualTotal = (periodTotal / 30) * 365.25
      const expectedAnnual = (projected.periodTotal / 30) * 365.25;
      expect(projected.annualTotal).toBeCloseTo(expectedAnnual, 1);
    });

    it('returns 0 when activities is empty', () => {
      const projected = projectAnnualEmissions([], 30);
      expect(projected.annualTotal).toBe(0);
    });

    it('has dailyAverage field', () => {
      const activities = [makeActivity({ amount: 10 })];
      const projected = projectAnnualEmissions(activities, 7);
      expect(typeof projected.dailyAverage).toBe('number');
      expect(projected.dailyAverage).toBeGreaterThan(0);
    });

    it('has confidence field', () => {
      const activities = [makeActivity({ amount: 10 })];
      const projected = projectAnnualEmissions(activities, 90);
      expect(typeof projected.confidence).toBe('number');
      expect(projected.confidence).toBeGreaterThan(0);
    });
  });

  // ── calculateTrend ──────────────────────────────────────────────────────
  describe('calculateTrend()', () => {
    it('detects an increasing trend', () => {
      const trend = calculateTrend({
        '2024-W01': [makeActivity({ amount: 10 })],
        '2024-W02': [makeActivity({ amount: 20 })],
        '2024-W03': [makeActivity({ amount: 50 })],
      });
      expect(trend.direction).toBe('increasing');
      expect(trend.percentageChange).toBeGreaterThan(0);
    });

    it('detects a decreasing trend', () => {
      const trend = calculateTrend({
        '2024-W01': [makeActivity({ amount: 50 })],
        '2024-W02': [makeActivity({ amount: 20 })],
        '2024-W03': [makeActivity({ amount: 10 })],
      });
      expect(trend.direction).toBe('decreasing');
      expect(trend.percentageChange).toBeLessThan(0);
    });

    it('detects a stable trend', () => {
      const trend = calculateTrend({
        '2024-W01': [makeActivity({ amount: 30 })],
        '2024-W02': [makeActivity({ amount: 30 })],
        '2024-W03': [makeActivity({ amount: 30 })],
      });
      expect(trend.direction).toBe('stable');
      expect(Math.abs(trend.percentageChange)).toBeLessThanOrEqual(2);
    });

    it('handles a single period gracefully', () => {
      const trend = calculateTrend({
        '2024-W01': [makeActivity({ amount: 42 })],
      });
      expect(trend.direction).toBe('insufficient_data');
    });

    it('handles an empty object', () => {
      const trend = calculateTrend({});
      expect(trend.direction).toBe('insufficient_data');
      expect(trend.percentageChange).toBe(0);
    });
  });
});
