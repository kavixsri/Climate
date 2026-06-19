/**
 * Unit tests — format module.
 * Validates display formatting helpers used throughout the UI.
 * @module tests/unit/format
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatCO2,
  formatPercentage,
  formatTrend,
  formatRelativeDate,
  capitalize,
} from '../../src/utils/format.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('format module', () => {
  // ── formatCO2 ───────────────────────────────────────────────────────────
  describe('formatCO2()', () => {
    it('shows "kg CO₂e" for values < 1000', () => {
      const result = formatCO2(42.5);
      expect(result).toContain('kg');
      expect(result).toContain('CO₂e');
    });

    it('shows "tons CO₂e" for values >= 1000', () => {
      const result = formatCO2(1500);
      expect(result).toMatch(/ton/i);
      expect(result).toContain('CO₂e');
    });

    it('converts to tons correctly (1500 kg → 1.5 tons)', () => {
      const result = formatCO2(1500);
      expect(result).toContain('1.5');
    });

    it('handles 0 correctly', () => {
      const result = formatCO2(0);
      expect(result).toContain('0');
      expect(result).toContain('CO₂e');
    });

    it('handles negative values', () => {
      const result = formatCO2(-50);
      expect(result).toContain('-');
    });

    it('handles very small values', () => {
      const result = formatCO2(0.001);
      expect(result).toContain('kg');
    });

    it('handles very large values', () => {
      const result = formatCO2(1000000);
      expect(result).toMatch(/ton/i);
    });
  });

  // ── formatPercentage ────────────────────────────────────────────────────
  describe('formatPercentage()', () => {
    it('formats with default decimal places', () => {
      const result = formatPercentage(75.456);
      expect(result).toContain('75');
      expect(result).toContain('%');
    });

    it('respects custom decimal places', () => {
      const result = formatPercentage(33.3333, 2);
      expect(result).toContain('33.33');
    });

    it('handles 0%', () => {
      expect(formatPercentage(0)).toContain('0');
    });

    it('handles 100%', () => {
      expect(formatPercentage(100)).toContain('100');
    });
  });

  // ── formatTrend ─────────────────────────────────────────────────────────
  describe('formatTrend()', () => {
    it('shows ↑ (or up indicator) for positive change', () => {
      const result = formatTrend(15);
      expect(result).toMatch(/↑|▲|up|\+/i);
    });

    it('shows ↓ (or down indicator) for negative change', () => {
      const result = formatTrend(-15);
      expect(result).toMatch(/↓|▼|down|-/i);
    });

    it('handles zero change', () => {
      const result = formatTrend(0);
      expect(typeof result).toBe('string');
    });
  });

  // ── formatRelativeDate ──────────────────────────────────────────────────
  describe('formatRelativeDate()', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns "today" for today\'s date', () => {
      const today = new Date().toISOString().split('T')[0];
      const result = formatRelativeDate(today);
      expect(result.toLowerCase()).toContain('today');
    });

    it('returns "yesterday" for yesterday\'s date', () => {
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .split('T')[0];
      const result = formatRelativeDate(yesterday);
      expect(result.toLowerCase()).toContain('yesterday');
    });

    it('includes "days ago" for dates within the last week', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000)
        .toISOString()
        .split('T')[0];
      const result = formatRelativeDate(threeDaysAgo);
      expect(result.toLowerCase()).toMatch(/3\s*days?\s*ago/);
    });

    it('returns a date string for older dates', () => {
      const result = formatRelativeDate('2020-01-01');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ── capitalize ──────────────────────────────────────────────────────────
  describe('capitalize()', () => {
    it('capitalizes the first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('handles empty string', () => {
      expect(capitalize('')).toBe('');
    });

    it('handles already-capitalized string', () => {
      expect(capitalize('Hello')).toBe('Hello');
    });

    it('handles single character', () => {
      expect(capitalize('a')).toBe('A');
    });

    it('does not change the rest of the string', () => {
      expect(capitalize('hELLO wORLD')).toBe('HELLO wORLD');
    });
  });
});
