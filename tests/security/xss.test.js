/**
 * Security tests — XSS and injection prevention.
 * Validates that all user-facing string processing functions neutralize
 * malicious payloads including XSS, injection, prototype pollution, and
 * boundary edge cases.
 * @module tests/security/xss
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  escapeHtml,
  validateActivity,
} from '../../src/utils/validation.js';

// ---------------------------------------------------------------------------
// XSS Payload Library
// ---------------------------------------------------------------------------
const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert(1)>',
  '<img onerror="alert(1)" src="x">',
  '<svg onload=alert(1)>',
  '<body onload=alert(1)>',
  '<iframe src="javascript:alert(1)">',
  '<a href="javascript:alert(1)">click</a>',
  '<div onmouseover="alert(1)">hover</div>',
  '"><script>alert(String.fromCharCode(88,83,83))</script>',
  "';alert(1);//",
  '<math><mi//xlink:href="data:x,<script>alert(1)</script>">',
  '<input onfocus=alert(1) autofocus>',
  '<details open ontoggle=alert(1)>',
  '<marquee onstart=alert(1)>',
];

const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE users; --",
  "1' OR '1'='1",
  "1; DELETE FROM activities WHERE 1=1",
  "' UNION SELECT * FROM users --",
  "admin'--",
];

const PROTOTYPE_POLLUTION = [
  '__proto__',
  'constructor',
  '__proto__.polluted',
  'constructor.prototype.polluted',
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('XSS & injection security', () => {
  // ── XSS payloads in sanitizeString ──────────────────────────────────────
  describe('sanitizeString() — XSS payloads', () => {
    it.each(XSS_PAYLOADS)(
      'strips XSS payload: %s',
      (payload) => {
        const result = sanitizeString(payload);
        expect(result).not.toContain('<script');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('onload');
        expect(result).not.toContain('onmouseover');
        expect(result).not.toContain('onfocus');
        expect(result).not.toContain('ontoggle');
        expect(result).not.toContain('onstart');
        expect(result).not.toContain('javascript:');
        expect(result).not.toMatch(/<[a-zA-Z]/); // no remaining HTML tags
      },
    );
  });

  // ── Script injection in activity descriptions ──────────────────────────
  describe('validateActivity() — script injection', () => {
    it.each(XSS_PAYLOADS)(
      'neutralises XSS in activity description: %s',
      (payload) => {
        const result = validateActivity({
          category: 'transport',
          type: 'car',
          amount: 10,
          unit: 'km',
          date: '2025-06-15',
          description: payload,
        });

        if (result.valid) {
          expect(result.sanitized.description).not.toContain('<script');
          expect(result.sanitized.description).not.toMatch(/<[a-zA-Z]/);
        }
        // If invalid that's also fine — payload was rejected
      },
    );
  });

  // ── HTML entities in escapeHtml ─────────────────────────────────────────
  describe('escapeHtml() — entity escaping', () => {
    it('converts all dangerous characters to entities', () => {
      const input = '<img src="x" onerror=\'alert(1)\'>&';
      const result = escapeHtml(input);

      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).toContain('&amp;');
    });

    it('double-escaping does not produce raw HTML', () => {
      const once = escapeHtml('<b>bold</b>');
      const twice = escapeHtml(once);
      expect(twice).not.toContain('<b>');
    });
  });

  // ── SQL injection strings ──────────────────────────────────────────────
  describe('SQL-like injection strings', () => {
    it.each(SQL_INJECTION_PAYLOADS)(
      'safely handles SQL injection attempt: %s',
      (payload) => {
        const result = sanitizeString(payload);
        expect(typeof result).toBe('string');
        // Should not crash; content may be preserved since it's just text,
        // but no execution should occur (no eval / innerHTML).
      },
    );
  });

  // ── Extremely long strings ─────────────────────────────────────────────
  describe('length limits', () => {
    it('truncates strings exceeding max length', () => {
      const megaString = 'A'.repeat(100_000);
      const result = sanitizeString(megaString, 500);
      expect(result.length).toBeLessThanOrEqual(500);
    });

    it('activity validation rejects absurdly long description', () => {
      const result = validateActivity({
        category: 'transport',
        type: 'car',
        amount: 10,
        unit: 'km',
        date: '2025-06-15',
        description: 'x'.repeat(100_000),
      });
      // Either rejected or description is truncated
      if (result.valid) {
        expect(result.sanitized.description.length).toBeLessThan(100_000);
      }
    });
  });

  // ── Unicode edge cases ─────────────────────────────────────────────────
  describe('Unicode edge cases', () => {
    it('handles emoji correctly', () => {
      const result = sanitizeString('Hello 🌍🔥 CO₂');
      expect(result).toContain('🌍');
      expect(result).toContain('CO₂');
    });

    it('handles zero-width characters', () => {
      const zeroWidth = 'test\u200B\u200C\u200Dstring';
      const result = sanitizeString(zeroWidth);
      expect(typeof result).toBe('string');
    });

    it('handles RTL override characters', () => {
      const rtl = 'hello\u202Eworld';
      const result = sanitizeString(rtl);
      expect(typeof result).toBe('string');
    });

    it('handles null bytes', () => {
      const nullByte = 'hello\x00world';
      const result = sanitizeString(nullByte);
      expect(typeof result).toBe('string');
      // Null bytes should be stripped or escaped
      expect(result).not.toContain('\x00');
    });
  });

  // ── Prototype pollution ─────────────────────────────────────────────────
  describe('prototype pollution prevention', () => {
    it.each(PROTOTYPE_POLLUTION)(
      'blocks prototype pollution via key: %s',
      (key) => {
        // Attempt to set a property via a polluted key
        const malicious = {};
        malicious[key] = { polluted: true };

        // Sanitize by validating as an activity — the key should not leak
        const result = validateActivity({
          category: 'transport',
          type: 'car',
          amount: 10,
          unit: 'km',
          date: '2025-06-15',
          description: key,
        });

        // Object.prototype should not be polluted
        expect(({}).polluted).toBeUndefined();

        if (result.valid) {
          // The description is just a string, so the key text is fine
          expect(typeof result.sanitized.description).toBe('string');
        }
      },
    );

    it('Object.prototype is not modified after processing', () => {
      const before = Object.keys(Object.prototype);

      sanitizeString('__proto__');
      sanitizeString('constructor.prototype');

      const after = Object.keys(Object.prototype);
      expect(after).toEqual(before);
    });
  });
});
