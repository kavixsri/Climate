/**
 * Vitest global test setup.
 * Provides mocks for browser APIs not available in jsdom and
 * ensures a clean state before every test.
 * @module test-setup
 */

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  /** @type {Record<string, string>} */
  let store = {};

  return {
    /** @param {string} key */
    getItem: (key) => store[key] ?? null,

    /**
     * @param {string} key
     * @param {*} value
     */
    setItem: (key, value) => {
      store[key] = String(value);
    },

    /** @param {string} key */
    removeItem: (key) => {
      delete store[key];
    },

    clear: () => {
      store = {};
    },

    /** @returns {number} */
    get length() {
      return Object.keys(store).length;
    },

    /**
     * @param {number} index
     * @returns {string | null}
     */
    key: (index) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// ---------------------------------------------------------------------------
// Mock crypto.randomUUID
// ---------------------------------------------------------------------------
if (!globalThis.crypto) {
  globalThis.crypto = /** @type {Crypto} */ ({});
}

globalThis.crypto.randomUUID = () =>
  /** @type {`${string}-${string}-${string}-${string}-${string}`} */ (
    'test-uuid-' + Math.random().toString(36).slice(2, 11)
  );

// ---------------------------------------------------------------------------
// Reset DOM & storage before each test
// ---------------------------------------------------------------------------
import { beforeEach } from 'vitest';

beforeEach(() => {
  document.body.innerHTML = '';
  localStorageMock.clear();
});
