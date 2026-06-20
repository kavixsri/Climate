/**
 * SMART goal tracking for CarbonLens.
 *
 * Provides creation, progress tracking, milestone generation,
 * and status evaluation for carbon-reduction goals.
 *
 * All exported functions are **pure** — they return new objects
 * rather than mutating inputs.
 * @module goals
 */

import { CATEGORIES } from './emission-factors.js';

/* ------------------------------------------------------------------ */
/*  Type definitions                                                   */
/* ------------------------------------------------------------------ */

/**
 * @typedef {object} Milestone
 * @property {number}      percent    - Target percentage (e.g. 25, 50, 75, 100).
 * @property {boolean}     achieved   - Whether this milestone has been reached.
 * @property {string|null} achievedAt - ISO-8601 timestamp when achieved, or null.
 */

/**
 * @typedef {'on-track' | 'behind' | 'ahead' | 'completed' | 'expired'} GoalStatus
 */

/**
 * @typedef {object} Goal
 * @property {string}      id                     - Unique identifier (UUID v4-style).
 * @property {string}      name                   - Human-readable goal name.
 * @property {number}      targetReductionPercent  - Target reduction as a percentage (0-100).
 * @property {number}      baselineEmissions       - Baseline emissions in kg CO₂e.
 * @property {number}      targetEmissions         - Calculated target emissions in kg CO₂e.
 * @property {number}      currentEmissions        - Latest measured emissions in kg CO₂e.
 * @property {string}      deadline                - ISO-8601 date string for the goal deadline.
 * @property {string|null} category                - Optional category focus, or null for all.
 * @property {Milestone[]} milestones              - Auto-generated milestone checkpoints.
 * @property {GoalStatus}  status                  - Current goal status.
 * @property {number}      progress                - Progress percentage (0-100).
 * @property {string}      createdAt               - ISO-8601 timestamp of creation.
 */

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Generates a pseudo-random UUID v4 string.
 * Uses `crypto.randomUUID()` when available, otherwise falls back to
 * a Math.random-based generator.
 * @returns {string}
 * @private
 */
function _generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Clamps a number between min and max (inclusive).
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 * @private
 */
function _clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Auto-generates milestones at 25 %, 50 %, 75 %, and 100 % of the
 * target reduction.
 * @param {Pick<Goal, 'targetReductionPercent'>} goal
 *   An object containing at least `targetReductionPercent`.
 * @returns {Milestone[]} Array of four milestone objects.
 * @example
 * const ms = generateMilestones({ targetReductionPercent: 20 });
 * // [{ percent: 25, achieved: false, achievedAt: null }, …]
 */
export function generateMilestones(goal) {
  if (goal == null || typeof goal !== 'object') {
    throw new TypeError('goal must be a non-null object');
  }

  if (
    typeof goal.targetReductionPercent !== 'number' ||
    !Number.isFinite(goal.targetReductionPercent) ||
    goal.targetReductionPercent <= 0 ||
    goal.targetReductionPercent > 100
  ) {
    throw new Error('targetReductionPercent must be a finite number between 0 (exclusive) and 100 (inclusive)');
  }

  return [25, 50, 75, 100].map((percent) => ({
    percent,
    achieved: false,
    achievedAt: null,
  }));
}

/**
 * Creates a new carbon-reduction goal with auto-generated milestones.
 * @param {object} params
 * @param {string}  params.name                   - Human-readable goal name.
 * @param {number}  params.targetReductionPercent  - Target reduction percentage (1-100).
 * @param {number}  params.baselineEmissions       - Current baseline in kg CO₂e.
 * @param {string}  params.deadline                - ISO-8601 deadline date (YYYY-MM-DD).
 * @param {string}  [params.category]              - Optional category to focus on.
 * @returns {Goal} The newly created goal object.
 * @throws {Error} If any required parameter is missing or invalid.
 * @example
 * const goal = createGoal({
 *   name: 'Halve my transport emissions',
 *   targetReductionPercent: 50,
 *   baselineEmissions: 3000,
 *   deadline: '2025-12-31',
 *   category: 'transportation',
 * });
 */
export function createGoal({ name, targetReductionPercent, baselineEmissions, deadline, category }) {
  // ── Validate name ──
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('name must be a non-empty string');
  }

  // ── Validate targetReductionPercent ──
  if (
    typeof targetReductionPercent !== 'number' ||
    !Number.isFinite(targetReductionPercent) ||
    targetReductionPercent <= 0 ||
    targetReductionPercent > 100
  ) {
    throw new Error('targetReductionPercent must be a finite number between 0 (exclusive) and 100 (inclusive)');
  }

  // ── Validate baselineEmissions ──
  if (
    typeof baselineEmissions !== 'number' ||
    !Number.isFinite(baselineEmissions) ||
    baselineEmissions < 0
  ) {
    throw new Error('baselineEmissions must be a non-negative finite number');
  }

  // ── Validate deadline ──
  if (typeof deadline !== 'string' || !deadline.trim()) {
    throw new Error('deadline must be a non-empty ISO-8601 date string');
  }
  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) {
    throw new Error(`Invalid deadline date: "${deadline}"`);
  }

  // ── Validate optional category ──
  const normalisedCategory = category
    ? category.trim().toLowerCase()
    : null;
  if (normalisedCategory && !CATEGORIES.includes(normalisedCategory)) {
    throw new Error(
      `Unknown category "${normalisedCategory}". Valid categories: ${CATEGORIES.join(', ')}`,
    );
  }

  const targetEmissions = Math.round(
    baselineEmissions * (1 - targetReductionPercent / 100) * 1000,
  ) / 1000;

  const now = new Date().toISOString();

  return {
    id: _generateId(),
    name: name.trim(),
    targetReductionPercent,
    baselineEmissions,
    targetEmissions,
    currentEmissions: baselineEmissions,
    deadline: deadlineDate.toISOString().slice(0, 10),
    category: normalisedCategory,
    milestones: generateMilestones({ targetReductionPercent }),
    status: 'on-track',
    progress: 0,
    createdAt: now,
  };
}

/**
 * Updates a goal's progress based on the user's current emissions.
 *
 * Progress is measured as the fraction of the intended reduction that has
 * been achieved:
 *
 *     progress = (baseline - current) / (baseline - target) × 100
 *
 * The returned goal is a **new object** — the original is not mutated.
 * @param {Goal} goal              - The existing goal object.
 * @param {number} currentEmissions - Latest measured emissions in kg CO₂e.
 * @returns {Goal} A new goal object with updated `currentEmissions`,
 *   `progress`, `milestones`, and `status`.
 * @throws {Error} If inputs are invalid.
 * @example
 * const updated = updateGoalProgress(myGoal, 2200);
 */
export function updateGoalProgress(goal, currentEmissions) {
  if (goal == null || typeof goal !== 'object') {
    throw new TypeError('goal must be a non-null object');
  }
  if (
    typeof currentEmissions !== 'number' ||
    !Number.isFinite(currentEmissions) ||
    currentEmissions < 0
  ) {
    throw new Error('currentEmissions must be a non-negative finite number');
  }

  const { baselineEmissions, targetEmissions } = goal;
  const reductionNeeded = baselineEmissions - targetEmissions;

  let progress = 0;
  if (reductionNeeded > 0) {
    const reductionAchieved = baselineEmissions - currentEmissions;
    progress = _clamp(
      Math.round((reductionAchieved / reductionNeeded) * 10000) / 100,
      0,
      100,
    );
  } else if (currentEmissions <= targetEmissions) {
    progress = 100;
  }

  const now = new Date().toISOString();

  // Update milestones
  const updatedMilestones = goal.milestones.map((ms) => {
    if (ms.achieved) return { ...ms };
    const milestoneProgress = ms.percent;
    if (progress >= milestoneProgress) {
      return { ...ms, achieved: true, achievedAt: now };
    }
    return { ...ms };
  });

  const updatedGoal = {
    ...goal,
    currentEmissions,
    progress,
    milestones: updatedMilestones,
  };

  // Derive status
  updatedGoal.status = getGoalStatus(updatedGoal);

  return updatedGoal;
}

/**
 * Returns an array of milestones that have been newly achieved (i.e. their
 * `achieved` flag is `true` and they represent recent progress).
 *
 * This is useful for triggering congratulatory notifications.
 * @param {Goal} goal - The goal to inspect.
 * @returns {Milestone[]} Milestones with `achieved === true`.
 * @throws {TypeError} If goal is invalid.
 * @example
 * const newlyAchieved = checkMilestones(updatedGoal);
 * // [{ percent: 25, achieved: true, achievedAt: '2024-…' }]
 */
export function checkMilestones(goal) {
  if (goal == null || typeof goal !== 'object') {
    throw new TypeError('goal must be a non-null object');
  }

  if (!Array.isArray(goal.milestones)) {
    throw new TypeError('goal.milestones must be an array');
  }

  return goal.milestones
    .filter((ms) => ms.achieved === true)
    .map((ms) => ({ ...ms }));
}

/**
 * Evaluates the current status of a goal.
 *
 * Status logic:
 * - **completed** — progress ≥ 100 %.
 * - **expired** — deadline has passed and progress < 100 %.
 * - **ahead** — progress is more than 10 % above the expected linear
 *   trajectory for the elapsed time.
 * - **behind** — progress is more than 10 % below the expected trajectory.
 * - **on-track** — within ±10 % of the expected trajectory.
 * @param {Goal} goal - The goal to evaluate.
 * @returns {GoalStatus} One of 'on-track', 'behind', 'ahead', 'completed', or 'expired'.
 * @throws {TypeError} If goal is invalid.
 * @example
 * const status = getGoalStatus(myGoal);
 * // 'on-track'
 */
export function getGoalStatus(goal) {
  if (goal == null || typeof goal !== 'object') {
    throw new TypeError('goal must be a non-null object');
  }

  const { progress, deadline, createdAt } = goal;

  // Completed?
  if (typeof progress === 'number' && progress >= 100) {
    return 'completed';
  }

  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();
  const createdMs = new Date(createdAt).getTime();

  // Expired?
  if (Number.isFinite(deadlineMs) && now > deadlineMs) {
    return 'expired';
  }

  // Calculate expected progress based on elapsed time
  if (Number.isFinite(deadlineMs) && Number.isFinite(createdMs) && deadlineMs > createdMs) {
    const totalDuration = deadlineMs - createdMs;
    const elapsed = now - createdMs;
    const expectedProgress = _clamp((elapsed / totalDuration) * 100, 0, 100);
    const difference = (progress || 0) - expectedProgress;

    if (difference > 10) return 'ahead';
    if (difference < -10) return 'behind';
    return 'on-track';
  }

  // Fallback if dates are not usable
  return 'on-track';
}
