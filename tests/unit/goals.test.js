/**
 * Unit tests — goals module.
 * Covers goal creation, milestone auto-generation, progress tracking,
 * status evaluation, and milestone achievement detection.
 * @module tests/unit/goals
 */

import { describe, it, expect } from 'vitest';
import {
  createGoal,
  updateGoalProgress,
  getGoalStatus,
  checkMilestones,
} from '../../src/core/goals.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @returns {object} Minimal valid goal input */
function goalInput(overrides = {}) {
  return {
    name: 'Reduce transport emissions',
    targetReductionPercent: 50,
    baselineEmissions: 1000, // kg CO₂e
    deadline: futureDate(90), // 90 days from now
    category: 'transportation',
    ...overrides,
  };
}

/**
 * Returns an ISO date string N days in the future (or past if negative).
 * @param {number} days
 * @returns {string}
 */
function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('goals module', () => {
  // ── createGoal ──────────────────────────────────────────────────────────
  describe('createGoal()', () => {
    it('creates a goal with all required fields', () => {
      const goal = createGoal(goalInput());

      expect(goal).toHaveProperty('id');
      expect(goal).toHaveProperty('name', 'Reduce transport emissions');
      expect(goal).toHaveProperty('targetReductionPercent', 50);
      expect(goal).toHaveProperty('baselineEmissions', 1000);
      expect(goal).toHaveProperty('targetEmissions');
      expect(goal).toHaveProperty('deadline');
      expect(goal).toHaveProperty('currentEmissions');
      expect(goal).toHaveProperty('milestones');
      expect(goal).toHaveProperty('createdAt');
    });

    it('generates milestones at 25%, 50%, 75%, and 100%', () => {
      const goal = createGoal(goalInput());
      const milestones = goal.milestones;

      expect(milestones.length).toBe(4);

      const percentages = milestones.map((m) => m.percent);
      expect(percentages).toEqual([25, 50, 75, 100]);
    });

    it('milestones start as not achieved', () => {
      const goal = createGoal(goalInput());
      for (const m of goal.milestones) {
        expect(m.achieved).toBe(false);
      }
    });

    it('initializes progress to 0', () => {
      const goal = createGoal(goalInput());
      expect(goal.progress).toBe(0);
    });

    it('computes correct targetEmissions', () => {
      // 50% reduction of 1000 = target of 500
      const goal = createGoal(goalInput({ targetReductionPercent: 50, baselineEmissions: 1000 }));
      expect(goal.targetEmissions).toBeCloseTo(500, 1);
    });
  });

  // ── updateGoalProgress ─────────────────────────────────────────────────
  describe('updateGoalProgress()', () => {
    it('calculates correct progress percentage', () => {
      // baseline=1000, target=500 (50% reduction), currentEmissions=750
      // reduction needed = 1000-500 = 500, reduction achieved = 1000-750 = 250
      // progress = 250/500 * 100 = 50%
      const goal = createGoal(goalInput({ targetReductionPercent: 50, baselineEmissions: 1000 }));
      const updated = updateGoalProgress(goal, 750);

      expect(updated.currentEmissions).toBe(750);
      expect(updated.progress).toBeCloseTo(50, 0);
    });

    it('marks milestones as achieved when passed', () => {
      // baseline=1000, target=500, currentEmissions=400
      // reduction achieved = 600, reduction needed = 500
      // progress = 120% → clamped to 100%
      const goal = createGoal(goalInput({ targetReductionPercent: 50, baselineEmissions: 1000 }));
      const updated = updateGoalProgress(goal, 400);

      const achieved = updated.milestones.filter((m) => m.achieved);
      expect(achieved.length).toBe(4); // all milestones achieved at 100%
    });

    it('does not exceed 100% progress', () => {
      const goal = createGoal(goalInput({ targetReductionPercent: 50, baselineEmissions: 1000 }));
      const updated = updateGoalProgress(goal, 0); // massive reduction

      expect(updated.progress).toBeLessThanOrEqual(100);
    });

    it('handles 0 progress (no reduction)', () => {
      const goal = createGoal(goalInput({ targetReductionPercent: 50, baselineEmissions: 1000 }));
      const updated = updateGoalProgress(goal, 1000); // same as baseline

      expect(updated.currentEmissions).toBe(1000);
      expect(updated.progress).toBe(0);
    });
  });

  // ── getGoalStatus ──────────────────────────────────────────────────────
  describe('getGoalStatus()', () => {
    it('returns "completed" when target is reached', () => {
      const goal = createGoal(goalInput({ targetReductionPercent: 50, baselineEmissions: 1000 }));
      const updated = updateGoalProgress(goal, 500); // exactly at target
      const status = getGoalStatus(updated);
      expect(status).toBe('completed');
    });

    it('returns "expired" when past deadline and incomplete', () => {
      const goal = createGoal(
        goalInput({
          deadline: futureDate(-1), // Yesterday
        }),
      );
      const updated = updateGoalProgress(goal, 900); // only 10% progress
      const status = getGoalStatus(updated);
      expect(status).toBe('expired');
    });

    it('returns "on-track" or "ahead" when progress matches elapsed time proportion', () => {
      const goal = createGoal(goalInput());
      // Manually set createdAt to 45 days ago (halfway through 90-day goal)
      goal.createdAt = new Date(Date.now() - 45 * 86400000).toISOString();
      // 50% progress at 50% elapsed time
      const updated = updateGoalProgress(goal, 750);
      const status = getGoalStatus(updated);
      expect(['on-track', 'ahead']).toContain(status);
    });

    it('returns "behind" when progress is below expected pace', () => {
      const goal = createGoal(goalInput());
      goal.createdAt = new Date(Date.now() - 80 * 86400000).toISOString(); // 80 of 90 days elapsed
      const updated = updateGoalProgress(goal, 950); // only 10% progress
      const status = getGoalStatus(updated);
      expect(status).toBe('behind');
    });

    it('returns "ahead" when progress exceeds expected pace', () => {
      const goal = createGoal(goalInput());
      goal.createdAt = new Date(Date.now() - 10 * 86400000).toISOString(); // only 10 of 90 days elapsed
      const updated = updateGoalProgress(goal, 600); // 80% progress
      const status = getGoalStatus(updated);
      expect(status).toBe('ahead');
    });
  });

  // ── checkMilestones ─────────────────────────────────────────────────────
  describe('checkMilestones()', () => {
    it('returns achieved milestones', () => {
      const goal = createGoal(goalInput({ targetReductionPercent: 50, baselineEmissions: 1000 }));

      // 30% progress: reduction of 150 out of 500 needed
      const afterFirst = updateGoalProgress(goal, 850);
      const achieved1 = checkMilestones(afterFirst);
      expect(achieved1.some((m) => m.percent === 25)).toBe(true);
    });

    it('returns empty array when no milestones are achieved', () => {
      const goal = createGoal(goalInput({ targetReductionPercent: 50, baselineEmissions: 1000 }));
      const updated = updateGoalProgress(goal, 975); // only 5% progress
      const achieved = checkMilestones(updated);
      expect(achieved.length).toBe(0);
    });

    it('returns all four milestones when at 100%', () => {
      const goal = createGoal(goalInput({ targetReductionPercent: 50, baselineEmissions: 1000 }));
      const updated = updateGoalProgress(goal, 500); // 100% progress
      const achieved = checkMilestones(updated);
      expect(achieved.length).toBe(4);
    });
  });
});
