/**
 * Unit tests — crypto module.
 * Validates obfuscation roundtrips, output uniqueness, and ID generation.
 * @module tests/unit/crypto
 */

import { describe, it, expect } from 'vitest';
import {
  obfuscate,
  deobfuscate,
  generateId,
} from '../../src/utils/crypto.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('crypto module', () => {
  // ── obfuscate / deobfuscate ─────────────────────────────────────────────
  describe('obfuscate + deobfuscate roundtrip', () => {
    it('roundtrips a plain string', () => {
      const original = 'Hello, CarbonLens!';
      const encoded = obfuscate(original);
      const decoded = deobfuscate(encoded);
      expect(decoded).toBe(original);
    });

    it('roundtrips an object via JSON', () => {
      const original = { user: 'test', emissions: 42.5 };
      const encoded = obfuscate(JSON.stringify(original));
      const decoded = JSON.parse(deobfuscate(encoded));
      expect(decoded).toEqual(original);
    });

    it('roundtrips an empty string', () => {
      const encoded = obfuscate('');
      expect(deobfuscate(encoded)).toBe('');
    });

    it('roundtrips strings with special characters', () => {
      const specials = '🌍 CO₂e → <script>alert("xss")</script>';
      const encoded = obfuscate(specials);
      expect(deobfuscate(encoded)).toBe(specials);
    });

    it('roundtrips a very long string', () => {
      const long = 'x'.repeat(10000);
      const encoded = obfuscate(long);
      expect(deobfuscate(encoded)).toBe(long);
    });
  });

  describe('obfuscated output', () => {
    it('differs from the original input', () => {
      const original = 'sensitive data';
      const encoded = obfuscate(original);
      expect(encoded).not.toBe(original);
    });

    it('is a string', () => {
      expect(typeof obfuscate('test')).toBe('string');
    });
  });

  // ── generateId ──────────────────────────────────────────────────────────
  describe('generateId()', () => {
    it('returns a string', () => {
      expect(typeof generateId()).toBe('string');
    });

    it('returns a non-empty string', () => {
      expect(generateId().length).toBeGreaterThan(0);
    });

    it('returns unique values on successive calls', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });

    it('IDs contain only safe characters', () => {
      const id = generateId();
      // UUIDs or base-36 strings — should be alphanumeric + hyphens
      expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
    });
  });
});
