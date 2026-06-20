/**
 * Reactive state management store using observer pattern.
 * Provides immutable state access via deep cloning, debounced persistence,
 * and a pub/sub listener system for reactive UI updates.
 * @module store
 */

import { debounce } from '../utils/debounce.js';

/**
 * Default application state shape.
 * @type {Readonly<object>}
 */
const DEFAULT_STATE = Object.freeze({
  /** @type {Array<object>} Array of logged carbon activities */
  activities: [],
  /** @type {Array<object>} Array of user-defined goals */
  goals: [],
  /** @type {Array<object>} Array of earned achievements */
  achievements: [],
  /** @type {object} User profile and preferences */
  profile: {
    name: '',
    country: 'us',
    dietType: 'average',
    theme: 'dark',
  },
  /** @type {object} UI state (not persisted) */
  ui: {
    currentView: 'dashboard',
    modalOpen: false,
    modalContent: null,
  },
  /** @type {number} Schema version for migrations */
  schemaVersion: 1,
});

/**
 * Deep clones a value using structured clone with JSON fallback.
 * @param {*} value - The value to clone.
 * @returns {*} A deep clone of the value.
 */
function deepClone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  try {
    return structuredClone(value);
  } catch {
    // Fallback for environments without structuredClone
    return JSON.parse(JSON.stringify(value));
  }
}

/**
 * Merges persisted state with defaults, ensuring all keys exist.
 * @param {object} persisted - The persisted state from storage.
 * @param {object} defaults - The default state shape.
 * @returns {object} Merged state with all default keys present.
 */
function mergeWithDefaults(persisted, defaults) {
  const result = deepClone(defaults);

  for (const key of Object.keys(defaults)) {
    if (!(key in persisted)) {
      continue;
    }
    if (
      typeof defaults[key] === 'object' &&
      defaults[key] !== null &&
      !Array.isArray(defaults[key])
    ) {
      result[key] = mergeWithDefaults(persisted[key] || {}, defaults[key]);
    } else {
      result[key] = deepClone(persisted[key]);
    }
  }

  return result;
}

/**
 * Reactive state management store.
 * Uses the observer pattern to notify subscribers of state changes.
 * State is always accessed via deep clone to prevent external mutation.
 */
class Store {
  /** @type {object} */
  #state;

  /** @type {Set<Function>} */
  #listeners;

  /** @type {object | null} */
  #storage;

  /** @type {Function} */
  #debouncedPersist;

  /**
   * Creates a new Store instance.
   * Loads persisted state from storage or falls back to defaults.
   * @param {object} [storage] - Storage adapter with get/set methods.
   */
  constructor(storage = null) {
    this.#listeners = new Set();
    this.#storage = storage;
    this.#state = deepClone(DEFAULT_STATE);

    // Set up debounced persistence (max once every 500ms)
    this.#debouncedPersist = debounce(() => this.#persist(), 500);

    // Attempt to load persisted state
    if (this.#storage) {
      try {
        const persisted = this.#storage.get('state');
        if (persisted && typeof persisted === 'object') {
          this.#state = mergeWithDefaults(persisted, DEFAULT_STATE);
        }
      } catch (error) {
        console.warn('[Store] Failed to load persisted state, using defaults:', error);
        this.#state = deepClone(DEFAULT_STATE);
      }
    }
  }

  /**
   * Returns a deep clone of the current state.
   * The clone prevents external mutation of the store's internal state.
   * @returns {object} Deep clone of the current state.
   * @example
   * const state = store.getState();
   * state.activities.push(item); // Does NOT mutate the store
   */
  getState() {
    return deepClone(this.#state);
  }

  /**
   * Updates the state using an updater function.
   * The updater receives a deep clone of the current state and must return
   * the new state object. Listeners are notified and state is persisted.
   * @param {function(object): object} updater - Function that receives current state clone and returns new state.
   * @throws {TypeError} If updater is not a function.
   * @throws {TypeError} If updater does not return an object.
   * @example
   * store.setState(state => ({
   *   ...state,
   *   activities: [...state.activities, newActivity],
   * }));
   */
  setState(updater) {
    const prevState = deepClone(this.#state);
    let nextState;

    if (typeof updater === 'function') {
      nextState = updater(prevState);
    } else {
      nextState = { ...prevState, ...updater };
    }

    if (nextState === null || typeof nextState !== 'object' || Array.isArray(nextState)) {
      throw new TypeError('[Store] setState updater must return a plain object');
    }

    this.#state = nextState;
    this.#notify();
    this.#debouncedPersist();
  }

  /**
   * Subscribes a listener function to state changes.
   * The listener is called with the new state whenever setState is invoked.
   * @param {Function} listener - Callback invoked on state changes with the new state.
   * @returns {Function} Unsubscribe function — call to remove the listener.
   * @throws {TypeError} If listener is not a function.
   * @example
   * const unsubscribe = store.subscribe((newState) => {
   *   console.log('State changed:', newState);
   * });
   * // Later...
   * unsubscribe();
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('[Store] subscribe requires a function argument');
    }

    this.#listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Notifies all subscribed listeners with a deep clone of the current state.
   * Errors in individual listeners are caught and logged to prevent
   * one failing listener from blocking others.
   * @private
   */
  #notify() {
    const stateClone = this.getState();
    for (const listener of this.#listeners) {
      try {
        listener(stateClone);
      } catch (error) {
        console.error('[Store] Listener threw an error:', error);
      }
    }
  }

  /**
   * Persists the current state to the storage adapter.
   * UI state is excluded from persistence since it is transient.
   * @private
   */
  #persist() {
    if (!this.#storage) {
      return;
    }

    try {
      // Exclude transient UI state from persistence
      const stateToPersist = deepClone(this.#state);
      delete stateToPersist.ui;

      this.#storage.set('state', stateToPersist);
    } catch (error) {
      console.error('[Store] Failed to persist state:', error);
    }
  }

  /**
   * Resets the store to the default state.
   * Clears persisted data, notifies all listeners of the reset.
   */
  reset() {
    this.#state = deepClone(DEFAULT_STATE);

    if (this.#storage) {
      try {
        this.#storage.remove('state');
      } catch (error) {
        console.error('[Store] Failed to clear persisted state:', error);
      }
    }

    this.#notify();
  }

  /**
   * Returns the number of active listeners.
   * Useful for debugging subscription leaks.
   * @returns {number} Count of active listeners.
   */
  get listenerCount() {
    return this.#listeners.size;
  }
}

/** @type {Store|null} Singleton store instance */
let storeInstance = null;

/**
 * Creates and returns the singleton Store instance.
 * If a store already exists, it is returned without creating a new one.
 * @param {object} [storage] - Storage adapter to use for persistence.
 * @returns {Store} The singleton store instance.
 * @example
 * import { createStorage } from './storage.js';
 * const storage = createStorage('app');
 * const store = createStore(storage);
 */
export function createStore(storage = null) {
  if (!storeInstance) {
    storeInstance = new Store(storage);
  }
  return storeInstance;
}

/**
 * Resets the singleton store instance (used for testing).
 */
export function __resetStoreInstance() {
  if (storeInstance) {
    try {
      storeInstance = null;
    } catch (_e) {
      // ignore
    }
  }
  storeInstance = null;
}
/**
 * Returns the existing singleton Store instance.
 * @returns {Store} The singleton store instance.
 * @throws {Error} If createStore has not been called yet.
 * @example
 * const store = getStore();
 * const state = store.getState();
 */
export function getStore() {
  if (!storeInstance) {
    throw new Error('[Store] Store has not been created. Call createStore() first.');
  }
  return storeInstance;
}

/**
 * Destroys the singleton store instance.
 * Primarily useful for testing.
 */
export function destroyStore() {
  storeInstance = null;
}

export { DEFAULT_STATE };
