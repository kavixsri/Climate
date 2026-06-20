import { describe, it, expect } from 'vitest';
import { compareToAverages, getPercentile, formatComparison, getEquivalents } from '../../src/core/comparisons.js';

describe('comparisons module', () => {
  it('compares to averages correctly', () => {
    const results = compareToAverages(5000); // 5 tons
    expect(Array.isArray(results)).toBe(true);
    const globalComparison = results.find(r => r.region === 'global');
    expect(globalComparison).toBeDefined();
    expect(globalComparison.userValue).toBe(5);
  });

  it('calculates percentile', () => {
    expect(getPercentile(0).percentile).toBe(0);
    expect(getPercentile(20000).percentile).toBe(98);
    const p = getPercentile(5000).percentile;
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(99);
  });

  it('formats comparison strings', () => {
    const comp = { regionLabel: 'Global', average: 4700, userValue: 5000, difference: 300, percentDiff: 6.38, status: 'above' };
    const text = formatComparison(comp);
    expect(typeof text).toBe('string');
    expect(text).toContain('Global');
    expect(text).toContain('6.38');
  });

  it('calculates equivalents correctly', () => {
    const eq = getEquivalents(1600);
    expect(eq.treesNeeded).toBeGreaterThan(0);
    expect(eq.drivingKm).toBeGreaterThan(0);
    expect(eq.smartphoneCharges).toBeGreaterThan(0);
  });
});
