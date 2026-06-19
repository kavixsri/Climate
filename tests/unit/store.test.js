/**
 * Unit tests — store module.
 * Covers state management, subscription system, deep-clone isolation,
 * reset behaviour, and localStorage persistence.
 * @module tests/unit/store
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore, __resetStoreInstance } from '../../src/store/store.js';
import { createStorage } from '../../src/store/storage.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a mock storage adapter matching the storage.js interface */
function mockStorage() {
  const data = {};
  return Object.freeze({
    get(key) {
      const raw = data[key];
      return raw !== undefined ? JSON.parse(raw) : null;
    },
    set(key, value) {
      data[key] = JSON.stringify(value);
    },
    remove(key) {
      delete data[key];
    },
    clear() {
      for (const k of Object.keys(data)) delete data[k];
    },
    has(key) {
      return key in data;
    },
    _raw: data,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('store module', () => {
  let store;
  let storage;

  beforeEach(() => {
    __resetStoreInstance();
    storage = mockStorage();
    store = createStore(storage);
  });

  // ── createStore ─────────────────────────────────────────────────────────
  describe('createStore()', () => {
    it('initializes with the provided default state', () => {
      const state = store.getState();
      expect(state.activities).toEqual([]);
      expect(state.goals).toEqual([]);
      expect(state.profile.theme).toBe('dark');
    });

    it('the returned object exposes getState, setState, subscribe, reset', () => {
      expect(typeof store.getState).toBe('function');
      expect(typeof store.setState).toBe('function');
      expect(typeof store.subscribe).toBe('function');
      expect(typeof store.reset).toBe('function');
    });
  });

  // ── getState ────────────────────────────────────────────────────────────
  describe('getState()', () => {
    it('returns a deep clone — mutations do not affect the store', () => {
      const state = store.getState();
      state.activities.push({ id: 'rogue' });
      state.profile.theme = 'light';

      const fresh = store.getState();
      expect(fresh.activities.length).toBe(0);
      expect(fresh.profile.theme).toBe('dark');
    });
  });

  // ── setState ────────────────────────────────────────────────────────────
  describe('setState()', () => {
    it('updates state correctly with a function updater', () => {
      store.setState((prev) => ({
        ...prev,
        profile: { ...prev.profile, theme: 'light', country: 'eu' },
      }));
      const state = store.getState();
      expect(state.profile.theme).toBe('light');
      expect(state.profile.country).toBe('eu');
    });

    it('merges instead of replacing the whole state', () => {
      store.setState((prev) => ({
        ...prev,
        activities: [{ id: '1' }],
      }));
      const state = store.getState();
      expect(state.activities.length).toBe(1);
      // goals should still exist
      expect(state.goals).toBeDefined();
    });

    it('notifies subscribers on update', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.setState((prev) => ({
        ...prev,
        activities: [{ id: '1' }],
      }));
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ activities: [{ id: '1' }] }),
      );
    });
  });

  // ── subscribe / unsubscribe ─────────────────────────────────────────────
  describe('subscribe()', () => {
    it('returns an unsubscribe function', () => {
      const unsub = store.subscribe(vi.fn());
      expect(typeof unsub).toBe('function');
    });

    it('stops notifying after unsubscribe', () => {
      const listener = vi.fn();
      const unsub = store.subscribe(listener);

      store.setState((prev) => ({ ...prev, activities: [{ id: '1' }] }));
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      store.setState((prev) => ({ ...prev, activities: [{ id: '2' }] }));
      expect(listener).toHaveBeenCalledTimes(1); // no extra call
    });

    it('supports multiple subscribers', () => {
      const a = vi.fn();
      const b = vi.fn();
      store.subscribe(a);
      store.subscribe(b);

      store.setState((prev) => ({ ...prev, goals: [{ id: 'g1' }] }));
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });

  // ── reset ───────────────────────────────────────────────────────────────
  describe('reset()', () => {
    it('restores the default state', () => {
      store.setState((prev) => ({
        ...prev,
        activities: [{ id: '1' }, { id: '2' }],
      }));
      store.reset();

      const state = store.getState();
      expect(state.activities).toEqual([]);
      expect(state.profile.theme).toBe('dark');
    });

    it('notifies subscribers on reset', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.reset();
      expect(listener).toHaveBeenCalled();
    });
  });

  // ── Persistence ─────────────────────────────────────────────────────────
  describe('persistence', () => {
    it('saves state to localStorage on setState', async () => {
      store.setState((prev) => ({
        ...prev,
        activities: [{ id: 'p1' }],
      }));

      // Debounced persistence — wait for it
      await new Promise((r) => setTimeout(r, 600));

      expect(storage.has('state')).toBe(true);
      const persisted = storage.get('state');
      expect(persisted.activities).toEqual([{ id: 'p1' }]);
    });

    it('loads state from localStorage on creation', () => {
      // Pre-seed storage
      storage.set('state', {
        activities: [{ id: 'seed' }],
        goals: [],
        profile: { name: '', country: 'us', dietType: 'average', theme: 'dark' },
        schemaVersion: 1,
      });

      __resetStoreInstance();
      const newStore = createStore(storage);
      const state = newStore.getState();

      expect(state.activities).toEqual([{ id: 'seed' }]);
      expect(state.profile.theme).toBe('dark');
    });
  });
});
