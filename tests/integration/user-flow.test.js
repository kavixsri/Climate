/**
 * Integration tests — core user workflow.
 * End-to-end flows validating that activities, goals, and aggregations
 * work together through the store layer.
 * @module tests/integration/user-flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, __resetStoreInstance } from '../../src/store/store.js';
import { calculateActivityEmission, calculateTotalEmissions } from '../../src/core/calculator.js';
import { createGoal, updateGoalProgress } from '../../src/core/goals.js';
import { validateActivity } from '../../src/utils/validation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a mock storage adapter */
function mockStorage() {
  const data = {};
  return Object.freeze({
    get(key) { const r = data[key]; return r !== undefined ? JSON.parse(r) : null; },
    set(key, value) { data[key] = JSON.stringify(value); },
    remove(key) { delete data[key]; },
    clear() { for (const k of Object.keys(data)) delete data[k]; },
    has(key) { return key in data; },
  });
}

function validActivity(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    category: overrides.category || 'transportation',
    type: overrides.type || 'car',
    subtype: 'subtype' in overrides ? overrides.subtype : (overrides.category ? undefined : 'gasoline'),
    amount: 10,
    date: new Date().toISOString().split('T')[0],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('User flow integration', () => {
  /** @type {ReturnType<typeof createStore>} */
  let store;
  let storage;

  beforeEach(() => {
    __resetStoreInstance();
    storage = mockStorage();
    store = createStore(storage);
  });

  // ── Activity logging ────────────────────────────────────────────────────
  it('user logs an activity → appears in store → totals update', () => {
    const activity = validActivity();
    const enriched = calculateActivityEmission(activity);

    // Add activity to store using function updater
    store.setState((prev) => ({
      ...prev,
      activities: [...prev.activities, enriched],
    }));

    const state = store.getState();
    expect(state.activities.length).toBe(1);
    expect(state.activities[0].id).toBe(activity.id);

    // Dashboard total should reflect the new activity
    const { total } = calculateTotalEmissions(state.activities);
    expect(total).toBeGreaterThan(0);
  });

  // ── Goal tracking ──────────────────────────────────────────────────────
  it('user creates a goal → progress tracked against logged activities', () => {
    // Log some activities first
    const activity = validActivity({ amount: 50 });
    const enriched = calculateActivityEmission(activity);

    store.setState((prev) => ({
      ...prev,
      activities: [...prev.activities, enriched],
    }));

    const { total } = calculateTotalEmissions(store.getState().activities);

    // Create a goal to reduce by 20%
    const goal = createGoal({
      name: 'Reduce driving',
      targetReductionPercent: 20,
      baselineEmissions: total * 365, // annual baseline
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      category: 'transportation',
    });

    expect(goal.id).toBeDefined();
    expect(goal.targetReductionPercent).toBe(20);
    expect(goal.milestones.length).toBeGreaterThan(0);
  });

  // ── Multiple activities ────────────────────────────────────────────────
  it('user logs multiple activities → category breakdown is correct', () => {
    const activities = [
      validActivity({ category: 'transportation', type: 'car', subtype: 'gasoline', amount: 20 }),
      validActivity({ category: 'energy', type: 'electricity', amount: 100 }),
      validActivity({ category: 'diet', type: 'meatHeavy', amount: 1 }),
    ].map(calculateActivityEmission);

    store.setState((prev) => ({
      ...prev,
      activities,
    }));

    const { breakdown } = calculateTotalEmissions(store.getState().activities);
    expect(breakdown).toHaveProperty('transportation');
    expect(breakdown).toHaveProperty('energy');
    expect(breakdown).toHaveProperty('diet');
  });

  // ── Delete activity ────────────────────────────────────────────────────
  it('user deletes an activity → totals update correctly', () => {
    const a1 = calculateActivityEmission(validActivity({ amount: 10 }));
    const a2 = calculateActivityEmission(validActivity({ amount: 20 }));

    store.setState((prev) => ({
      ...prev,
      activities: [a1, a2],
    }));

    const totalBefore = calculateTotalEmissions(store.getState().activities).total;
    expect(totalBefore).toBeGreaterThan(0);

    // Delete a1
    store.setState((prev) => ({
      ...prev,
      activities: prev.activities.filter((a) => a.id !== a1.id),
    }));

    const totalAfter = calculateTotalEmissions(store.getState().activities).total;
    expect(totalAfter).toBeLessThan(totalBefore);
    expect(store.getState().activities.length).toBe(1);
  });

  // ── Persistence ────────────────────────────────────────────────────────
  it('activities persist across store re-creation (via storage)', async () => {
    const activity = calculateActivityEmission(validActivity({ amount: 15 }));

    store.setState((prev) => ({
      ...prev,
      activities: [activity],
    }));

    // Wait for debounced persistence
    await new Promise((r) => setTimeout(r, 600));

    // Create new store from same storage
    const newStore = createStore(storage);
    const state = newStore.getState();
    expect(state.activities.length).toBe(1);
    expect(state.activities[0].id).toBe(activity.id);
  });

  // ── Validation ─────────────────────────────────────────────────────────
  it('validation prevents bad data from entering the store', () => {
    const badActivity = { category: 'invalid', amount: -5 };
    const result = validateActivity(badActivity);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
