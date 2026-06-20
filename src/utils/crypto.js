/**
 * Simple obfuscation utilities for CarbonLens localStorage data.
 *
 * **IMPORTANT:** This module provides XOR-based obfuscation, NOT cryptographic
 * encryption. It prevents casual inspection of data in browser devtools but
 * does NOT protect against determined attackers. Do not use for sensitive
 * data like passwords or financial information.
 * @module crypto
 */

/**
 * Fixed XOR key used for obfuscation.
 * This is intentionally simple — it's obfuscation, not encryption.
 * @type {string}
 * @private
 */
const XOR_KEY = 'C4rb0nL3ns_0bfu5c4t10n_K3y!';

/**
 * XOR-encodes a string against the fixed key.
 * Each character is XOR'd with the corresponding key character (cycling).
 * @param {string} input - The string to XOR-encode.
 * @returns {string} The XOR-encoded string.
 * @private
 */
function xorCipher(input) {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length);
    result += String.fromCharCode(charCode);
  }
  return result;
}

/**
 * Obfuscates a data string using XOR encoding and base64.
 * The input is XOR'd with a fixed key, then base64-encoded for
 * safe storage in localStorage.
 *
 * **Note:** This is obfuscation, not encryption. It prevents casual
 * reading of stored data but is trivially reversible.
 * @param {string} data - The plaintext string to obfuscate.
 * @returns {string} Base64-encoded obfuscated string.
 * @throws {TypeError} If data is not a string.
 * @example
 * const encoded = obfuscate('{"theme":"dark"}');
 * localStorage.setItem('prefs', encoded);
 */
export function obfuscate(data) {
  if (typeof data !== 'string') {
    throw new TypeError('[crypto] obfuscate: data must be a string');
  }

  if (data.length === 0) {
    return '';
  }

  try {
    const xored = xorCipher(data);
    // Convert to base64, handling Unicode by encoding to UTF-8 percent-encoding first
    return btoa(unescape(encodeURIComponent(xored)));
  } catch (error) {
    console.error('[crypto] obfuscate failed:', error);
    // Fallback: return base64 without XOR
    try {
      return btoa(unescape(encodeURIComponent(data)));
    } catch {
      return data;
    }
  }
}

/**
 * Deobfuscates a previously obfuscated string.
 * Reverses the base64 encoding and XOR cipher to recover the original data.
 * @param {string} encoded - The base64-encoded obfuscated string.
 * @returns {string} The original plaintext string.
 * @throws {TypeError} If encoded is not a string.
 * @example
 * const encoded = obfuscate('{"theme":"dark"}');
 * const original = deobfuscate(encoded);
 * console.log(original); // '{"theme":"dark"}'
 */
export function deobfuscate(encoded) {
  if (typeof encoded !== 'string') {
    throw new TypeError('[crypto] deobfuscate: encoded must be a string');
  }

  if (encoded.length === 0) {
    return '';
  }

  try {
    const decoded = decodeURIComponent(escape(atob(encoded)));
    return xorCipher(decoded); // XOR is its own inverse
  } catch (error) {
    console.error('[crypto] deobfuscate failed:', error);
    // Attempt base64-only decode as fallback
    try {
      return decodeURIComponent(escape(atob(encoded)));
    } catch {
      return encoded;
    }
  }
}

/**
 * Generates a unique identifier string.
 * Uses crypto.randomUUID() when available (secure contexts),
 * with a fallback to a pseudo-random UUID v4 implementation.
 * @returns {string} A UUID v4 string (e.g., '550e8400-e29b-41d4-a716-446655440000').
 * @example
 * const id = generateId();
 * console.log(id); // 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
 */
export function generateId() {
  // Prefer native crypto.randomUUID (available in secure contexts)
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: use crypto.getRandomValues if available
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);

      // Set version 4 bits
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      // Set variant bits
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
      ].join('-');
    }
  } catch {
    // Fall through to Math.random fallback
  }

  // Last resort: Math.random-based UUID (not cryptographically secure)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
