/**
 * Integration tests — data persistence.
 * Validates that state persists correctly to storage, loads on init,
 * handles migrations, corrupted data, and edge cases.
 * @module tests/integration/data-persistence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStore, __resetStoreInstance } from '../../src/store/store.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a mock storage adapter */
function mockStorage() {
  const data = {};
  return {
    get(key) { const r = data[key]; return r !== undefined ? JSON.parse(r) : null; },
    set(key, value) { data[key] = JSON.stringify(value); },
    remove(key) { delete data[key]; },
    clear() { for (const k of Object.keys(data)) delete data[k]; },
    has(key) { return key in data; },
    _raw: data,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('data persistence', () => {
  let storage;

  beforeEach(() => {
    __resetStoreInstance();
    storage = mockStorage();
  });

  it('state persists to localStorage', async () => {
    const store = createStore(storage);

    store.setState((prev) => ({
      ...prev,
      activities: [{ id: 'a1', category: 'energy', type: 'electricity', amount: 100 }],
    }));

    // Wait for debounced persistence
    await new Promise((r) => setTimeout(r, 600));

    expect(storage.has('state')).toBe(true);
    const persisted = storage.get('state');
    expect(persisted.activities[0].id).toBe('a1');
  });

  it('state loads from localStorage on init', () => {
    // Pre-seed
    storage.set('state', {
      activities: [{ id: 'pre-seeded' }],
      goals: [],
      achievements: [],
      profile: { name: '', country: 'us', dietType: 'average', theme: 'dark' },
      schemaVersion: 1,
    });

    const store = createStore(storage);
    const state = store.getState();
    expect(state.activities[0].id).toBe('pre-seeded');
  });

  it('migration runs on old data format', () => {
    // Seed with v0-style data (no schemaVersion)
    storage.set('state', {
      activities: [{ id: 'old' }],
    });

    const store = createStore(storage);
    const state = store.getState();
    // Should still have activities after migration
    expect(state.activities).toBeDefined();
    expect(Array.isArray(state.activities)).toBe(true);
  });

  it('corrupted data falls back to defaults', () => {
    // Seed with garbage that won't parse as valid state
    storage._raw['state'] = '{{{{invalid json';

    const store = createStore(storage);
    const state = store.getState();
    // Should fall back to defaults
    expect(state.profile.theme).toBe('dark');
    expect(Array.isArray(state.activities)).toBe(true);
  });

  it('handles empty-string storage gracefully', () => {
    storage._raw['state'] = '""';

    const store = createStore(storage);
    const state = store.getState();
    expect(state).toBeDefined();
    expect(Array.isArray(state.activities)).toBe(true);
  });

  it('handles "null" stored value', () => {
    storage._raw['state'] = 'null';

    const store = createStore(storage);
    const state = store.getState();
    expect(state).toBeDefined();
  });

  it('handles storage quota error gracefully', () => {
    // Make set throw to simulate quota error
    const brokenStorage = {
      get() { return null; },
      set() { throw new DOMException('QuotaExceededError'); },
      remove() {},
      clear() {},
      has() { return false; },
    };

    const store = createStore(brokenStorage);
    // setState should not throw even if persistence fails
    expect(() => {
      store.setState((prev) => ({ ...prev, activities: [{ id: 'test' }] }));
    }).not.toThrow();
  });

  it('changes from one store instance are visible to a newly created store', async () => {
    const store1 = createStore(storage);

    store1.setState((prev) => ({
      ...prev,
      activities: [{ id: 'shared' }],
    }));

    // Wait for debounced persistence
    await new Promise((r) => setTimeout(r, 600));

    const store2 = createStore(storage);
    const state = store2.getState();
    expect(state.activities[0].id).toBe('shared');
  });
});
