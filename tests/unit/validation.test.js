/**
 * Unit tests — validation module.
 * @module tests/unit/validation
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeNumber,
  validateActivity,
  isValidDate,
  isValidCategory,
  isValidType,
  escapeHtml,
} from '../../src/utils/validation.js';
import { CATEGORIES } from '../../src/core/emission-factors.js';

describe('validation module', () => {
  // ── escapeHtml ─────────────────────────────────────────────────────────
  describe('escapeHtml()', () => {
    it('escapes common HTML entities', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(escapeHtml("'single'")).toBe('&#x27;single&#x27;');
    });

    it('returns empty string for non-string inputs', () => {
      expect(escapeHtml(123)).toBe('');
      expect(escapeHtml(null)).toBe('');
    });
  });

  // ── sanitizeString ──────────────────────────────────────────────────────
  describe('sanitizeString()', () => {
    it('strips HTML tags', () => {
      expect(sanitizeString('<b>bold</b> <script>alert(1)</script>')).toBe('bold alert(1)');
    });

    it('trims and collapses whitespace', () => {
      expect(sanitizeString('  hello   world  ')).toBe('hello world');
    });

    it('enforces maximum length', () => {
      const longStr = 'a'.repeat(300);
      const sanitized = sanitizeString(longStr, 200);
      expect(sanitized.length).toBe(200);
    });
  });

  // ── sanitizeNumber ──────────────────────────────────────────────────────
  describe('sanitizeNumber()', () => {
    it('parses valid numbers', () => {
      expect(sanitizeNumber('42.5')).toBe(42.5);
      expect(sanitizeNumber(10)).toBe(10);
    });

    it('clamps to specified min/max', () => {
      expect(sanitizeNumber(150, 0, 100)).toBe(100);
      expect(sanitizeNumber(-10, 0, 100)).toBe(0);
    });

    it('returns null for invalid inputs', () => {
      expect(sanitizeNumber('abc')).toBe(null);
      expect(sanitizeNumber(NaN)).toBe(null);
      expect(sanitizeNumber({})).toBe(null);
    });
  });

  // ── validateActivity ────────────────────────────────────────────────────
  describe('validateActivity()', () => {
    const validActivity = {
      category: 'transportation',
      type: 'car',
      subtype: 'gasoline',
      amount: 10,
      unit: 'km',
      date: '2025-06-15',
      description: 'Commute',
    };

    it('accepts a valid activity and returns sanitized version', () => {
      const result = validateActivity(validActivity);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBeDefined();
      expect(result.sanitized.category).toBe('transportation');
    });

    it('rejects missing required fields', () => {
      const { category, ...noCategory } = validActivity;
      const result = validateActivity(noCategory);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid category', () => {
      const result = validateActivity({ ...validActivity, category: 'space_travel' });
      expect(result.valid).toBe(false);
    });

    it('clamps extremely large amounts to MAX_AMOUNT', () => {
      const result = validateActivity({ ...validActivity, amount: 9999999 });
      expect(result.valid).toBe(true);
      expect(result.sanitized.amount).toBe(100000);
    });

    it('rejects zero amount', () => {
      const result = validateActivity({ ...validActivity, amount: 0 });
      expect(result.valid).toBe(false);
    });

    it('sanitizes description field', () => {
      const result = validateActivity({
        ...validActivity,
        description: '<img onerror=alert(1)>Commute',
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized.description).not.toContain('<img');
    });
  });

  // ── isValidDate ─────────────────────────────────────────────────────────
  describe('isValidDate()', () => {
    it('accepts valid ISO dates', () => {
      expect(isValidDate('2025-06-15')).toBe(true);
    });
    it('rejects invalid dates', () => {
      expect(isValidDate('2025-13-01')).toBe(false);
    });
  });

  // ── isValidCategory ─────────────────────────────────────────────────────
  describe('isValidCategory()', () => {
    it('returns true for known categories', () => {
      for (const cat of CATEGORIES) {
        expect(isValidCategory(cat)).toBe(true);
      }
    });

    it('returns false for unknown categories', () => {
      expect(isValidCategory('invalid_cat')).toBe(false);
    });
  });

  // ── isValidType ─────────────────────────────────────────────────────────
  describe('isValidType()', () => {
    it('returns true for valid type', () => {
      expect(isValidType('transportation', 'car')).toBe(true);
    });

    it('returns false for invalid type', () => {
      expect(isValidType('transportation', 'rocket')).toBe(false);
      expect(isValidType('invalid_cat', 'car')).toBe(false);
    });
  });
});
