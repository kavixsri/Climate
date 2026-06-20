/**
 * Obfuscated localStorage wrapper with namespace isolation.
 * Provides a safe interface over localStorage with XOR-based obfuscation
 * to prevent casual inspection of stored data.
 *
 * **Note:** XOR obfuscation is NOT cryptographic encryption. It protects
 * against casual browsing of devtools but not determined attackers.
 * @module storage
 */

import { obfuscate, deobfuscate } from '../utils/crypto.js';

/**
 * @typedef {object} StorageAdapter
 * @property {function(string): *} get - Retrieve a value by key.
 * @property {function(string, *): void} set - Store a value by key.
 * @property {function(string): void} remove - Remove a value by key.
 * @property {function(): void} clear - Remove all namespaced entries.
 * @property {function(string): boolean} has - Check if a key exists.
 */

/**
 * Builds a namespaced storage key.
 * @param {string} namespace - The storage namespace.
 * @param {string} key - The storage key.
 * @returns {string} The full namespaced key.
 * @private
 */
function buildKey(namespace, key) {
  return `carbonlens_${namespace}_${key}`;
}

/**
 * Tests whether localStorage is available and writable.
 * Handles private browsing modes and disabled storage gracefully.
 * @returns {boolean} True if localStorage is available.
 * @private
 */
function isStorageAvailable() {
  try {
    const testKey = '__carbonlens_storage_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a namespaced storage adapter with obfuscation.
 * All values are serialized to JSON, then XOR-obfuscated before storage.
 * Operations are wrapped in try/catch to handle quota errors and
 * private browsing mode gracefully.
 * @param {string} namespace - Namespace prefix for key isolation.
 * @returns {StorageAdapter} Storage adapter with get, set, remove, clear, has methods.
 * @throws {TypeError} If namespace is not a non-empty string.
 * @example
 * const storage = createStorage('app');
 * storage.set('theme', 'dark');
 * console.log(storage.get('theme')); // 'dark'
 * storage.remove('theme');
 */
export function createStorage(namespace) {
  if (typeof namespace !== 'string' || namespace.trim().length === 0) {
    throw new TypeError('[Storage] namespace must be a non-empty string');
  }

  const available = isStorageAvailable();

  /** @type {Map<string, *>} In-memory fallback when localStorage is unavailable */
  const memoryFallback = new Map();

  /**
   * Retrieves a value from storage by key.
   * Returns null if the key does not exist or on read error.
   * @param {string} key - The key to look up.
   * @returns {*} The deserialized value, or null if not found.
   */
  function get(key) {
    if (typeof key !== 'string') {
      console.warn('[Storage] get: key must be a string');
      return null;
    }

    const fullKey = buildKey(namespace, key);

    if (!available) {
      const value = memoryFallback.get(fullKey);
      return value !== undefined ? value : null;
    }

    try {
      const raw = localStorage.getItem(fullKey);
      if (raw === null) {
        return null;
      }

      const jsonStr = deobfuscate(raw);
      return JSON.parse(jsonStr);
    } catch (error) {
      console.warn(`[Storage] Failed to read key "${key}":`, error);
      return null;
    }
  }

  /**
   * Stores a value under the given key.
   * The value is serialized to JSON and obfuscated before writing.
   * @param {string} key - The key to store under.
   * @param {*} value - The value to store (must be JSON-serializable).
   */
  function set(key, value) {
    if (typeof key !== 'string') {
      console.warn('[Storage] set: key must be a string');
      return;
    }

    const fullKey = buildKey(namespace, key);

    if (!available) {
      memoryFallback.set(fullKey, value);
      return;
    }

    try {
      const jsonStr = JSON.stringify(value);
      const encoded = obfuscate(jsonStr);
      localStorage.setItem(fullKey, encoded);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error(`[Storage] Storage quota exceeded when writing key "${key}".`);
      } else {
        console.error(`[Storage] Failed to write key "${key}":`, error);
      }
      // Fall back to memory
      memoryFallback.set(fullKey, value);
    }
  }

  /**
   * Removes a single key from storage.
   * @param {string} key - The key to remove.
   */
  function remove(key) {
    if (typeof key !== 'string') {
      console.warn('[Storage] remove: key must be a string');
      return;
    }

    const fullKey = buildKey(namespace, key);
    memoryFallback.delete(fullKey);

    if (!available) {
      return;
    }

    try {
      localStorage.removeItem(fullKey);
    } catch (error) {
      console.warn(`[Storage] Failed to remove key "${key}":`, error);
    }
  }

  /**
   * Clears all keys belonging to this namespace.
   * Does not affect keys from other namespaces or other applications.
   */
  function clear() {
    // Clear memory fallback entries for this namespace
    const prefix = `carbonlens_${namespace}_`;
    for (const memKey of memoryFallback.keys()) {
      if (memKey.startsWith(prefix)) {
        memoryFallback.delete(memKey);
      }
    }

    if (!available) {
      return;
    }

    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.startsWith(prefix)) {
          keysToRemove.push(storageKey);
        }
      }
      for (const storageKey of keysToRemove) {
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.warn('[Storage] Failed to clear namespace:', error);
    }
  }

  /**
   * Checks if a key exists in storage.
   * @param {string} key - The key to check.
   * @returns {boolean} True if the key exists.
   */
  function has(key) {
    if (typeof key !== 'string') {
      return false;
    }

    const fullKey = buildKey(namespace, key);

    if (!available) {
      return memoryFallback.has(fullKey);
    }

    try {
      return localStorage.getItem(fullKey) !== null;
    } catch {
      return memoryFallback.has(fullKey);
    }
  }

  return Object.freeze({ get, set, remove, clear, has });
}
