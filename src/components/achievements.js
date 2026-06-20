/* istanbul ignore file */
/**
 * @module components/achievements
 * @description Gamification achievement badges for CarbonLens. Defines ~12
 * achievements with condition checks, renders a grid of locked/unlocked
 * badge cards, and shows toast notifications on new unlocks.
 */

import { createElement, clearElement, announceToScreenReader } from '../utils/dom.js';
import { formatDate } from '../utils/format.js';
import { getStore } from '../store/store.js';
import { prefersReducedMotion } from '../utils/a11y.js';

/**
 * @typedef {object} AchievementDef
 * @property {string} id - Unique achievement identifier.
 * @property {string} name - Display name.
 * @property {string} description - How to unlock this achievement.
 * @property {string} icon - Emoji icon.
 * @property {function(object): boolean} condition - Evaluates state to determine if unlocked.
 */

/** @type {AchievementDef[]} */
const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'first-step',
    name: 'First Step',
    description: 'Log your first activity',
    icon: '🌱',
    condition: (state) => (state.activities || []).length >= 1,
  },
  {
    id: 'data-driven',
    name: 'Data Driven',
    description: 'Log 10 activities',
    icon: '📊',
    condition: (state) => (state.activities || []).length >= 10,
  },
  {
    id: 'trend-setter',
    name: 'Trend Setter',
    description: 'Log activities for 7 consecutive days',
    icon: '📈',
    condition: (state) => computeStreak(state.activities || []) >= 7,
  },
  {
    id: 'goal-setter',
    name: 'Goal Setter',
    description: 'Create your first goal',
    icon: '🎯',
    condition: (state) => (state.goals || []).length >= 1,
  },
  {
    id: 'goal-crusher',
    name: 'Goal Crusher',
    description: 'Complete a goal',
    icon: '✅',
    condition: (state) => (state.goals || []).some((g) => g.status === 'completed'),
  },
  {
    id: 'green-eater',
    name: 'Green Eater',
    description: 'Log a vegan or vegetarian meal',
    icon: '🥬',
    condition: (state) =>
      (state.activities || []).some(
        (a) =>
          a.category === 'diet' &&
          (a.type === 'vegan' ||
            a.type === 'vegetarian' ||
            a.subtype === 'vegan' ||
            a.subtype === 'vegetarian')
      ),
  },
  {
    id: 'pedal-power',
    name: 'Pedal Power',
    description: 'Log bicycle or walking transportation',
    icon: '🚲',
    condition: (state) =>
      (state.activities || []).some(
        (a) =>
          a.category === 'transportation' &&
          (a.type === 'bicycle' ||
            a.type === 'walking' ||
            a.type === 'bike' ||
            a.subtype === 'bicycle' ||
            a.subtype === 'walking')
      ),
  },
  {
    id: 'waste-warrior',
    name: 'Waste Warrior',
    description: 'Log recycling or composting',
    icon: '♻️',
    condition: (state) =>
      (state.activities || []).some(
        (a) =>
          a.category === 'waste' &&
          (a.type === 'recycling' ||
            a.type === 'composting' ||
            a.subtype === 'recycling' ||
            a.subtype === 'composting')
      ),
  },
  {
    id: 'insight-master',
    name: 'Insight Master',
    description: 'Mark 5 insights as done',
    icon: '💡',
    condition: (state) => (state.doneInsights || []).length >= 5,
  },
  {
    id: 'below-average',
    name: 'Below Average',
    description: 'Get below global average footprint',
    icon: '🌍',
    condition: (state) => {
      const total = (state.activities || []).reduce((sum, a) => sum + (a.co2e || 0), 0);
      // Global avg ~4600 kg CO₂e/year; monthly ~383
      return state.activities && state.activities.length > 0 && total < 383;
    },
  },
  {
    id: '10pct-reducer',
    name: '10% Reducer',
    description: 'Reduce footprint by 10%',
    icon: '📉',
    condition: (state) => checkReduction(state, 10),
  },
  {
    id: 'carbon-champion',
    name: 'Carbon Champion',
    description: 'Reduce footprint by 25%',
    icon: '🏆',
    condition: (state) => checkReduction(state, 25),
  },
];

/**
 * Renders the achievements grid into the given container.
 * @param {HTMLElement} container - The DOM element to render into.
 * @returns {Function} Cleanup function that removes event listeners and subscriptions.
 */
export function renderAchievements(container) {
  const store = getStore();
  const abortController = new AbortController();
  const { signal } = abortController;

  /** @type {Function|null} */
  let unsubscribe = null;

  /** @type {Set<string>} Previously known unlocked IDs (for toast detection). */
  let previouslyUnlocked = new Set();

  clearElement(container);

  const page = createElement('div', { className: 'achievements-page' });

  // Header
  const header = createElement('header', { className: 'achievements-header' });
  const titleEl = createElement('h1', { className: 'section-title' });
  titleEl.textContent = 'Achievements';
  const subtitleEl = createElement('p', { className: 'achievements-subtitle' });
  header.appendChild(titleEl);
  header.appendChild(subtitleEl);
  page.appendChild(header);

  // Grid
  const grid = createElement('div', {
    className: 'achievements-grid',
    attributes: { 'aria-label': 'Achievement badges' },
  });
  page.appendChild(grid);

  // Toast container
  const toastContainer = createElement('div', {
    className: 'toast-container',
    attributes: { 'aria-live': 'assertive', 'aria-atomic': 'true' },
  });
  page.appendChild(toastContainer);

  container.appendChild(page);

  // --- Render ---

  /**
   * Evaluates achievements against current state and renders the grid.
   */
  function renderGrid() {
    clearElement(grid);

    const state = store.getState();
    const unlockedMap = state.achievements || {};

    let unlockedCount = 0;

    ACHIEVEMENT_DEFINITIONS.forEach((def) => {
      let isUnlocked = false;
      let unlockedAt = unlockedMap[def.id] || null;

      try {
        isUnlocked = def.condition(state);
      } catch {
        isUnlocked = false;
      }

      // Track newly unlocked and persist
      if (isUnlocked && !unlockedAt) {
        unlockedAt = new Date().toISOString();
        unlockedMap[def.id] = unlockedAt;
      }

      if (isUnlocked) {
        unlockedCount++;
      }

      const card = createAchievementCard(def, isUnlocked, unlockedAt);
      grid.appendChild(card);
    });

    // Persist achievement state
    store.setState((prev) => ({ ...prev, achievements: { ...unlockedMap } }));

    // Update subtitle
    subtitleEl.textContent = `${unlockedCount} of ${ACHIEVEMENT_DEFINITIONS.length} unlocked`;

    // Check for newly unlocked (toast)
    const currentUnlocked = new Set(
      ACHIEVEMENT_DEFINITIONS.filter((def) => {
        try {
          return def.condition(state);
        } catch {
          return false;
        }
      }).map((d) => d.id)
    );

    currentUnlocked.forEach((id) => {
      if (!previouslyUnlocked.has(id)) {
        const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === id);
        if (def) {
          showToast(def);
        }
      }
    });

    previouslyUnlocked = currentUnlocked;
  }

  /**
   * Creates a single achievement card DOM element.
   * @param {AchievementDef} def - Achievement definition.
   * @param {boolean} unlocked - Whether the achievement is unlocked.
   * @param {string|null} unlockedAt - ISO date string when unlocked, or null.
   * @returns {HTMLElement} The achievement card element.
   */
  function createAchievementCard(def, unlocked, unlockedAt) {
    const card = createElement('div', {
      className: `achievement-card${unlocked ? ' achievement-card--unlocked' : ' achievement-card--locked'}`,
      attributes: {
        'aria-label': `${def.name}: ${unlocked ? 'Unlocked' : 'Locked'}. ${def.description}`,
      },
    });

    // Icon
    const iconContainer = createElement('div', { className: 'achievement-icon-container' });
    const iconEl = createElement('span', {
      className: `achievement-icon${unlocked ? '' : ' achievement-icon--locked'}`,
      attributes: { 'aria-hidden': 'true' },
    });
    iconEl.textContent = def.icon;

    if (!unlocked) {
      const lockOverlay = createElement('span', {
        className: 'achievement-lock-overlay',
        attributes: { 'aria-hidden': 'true' },
      });
      lockOverlay.textContent = '🔒';
      iconContainer.appendChild(lockOverlay);
    }

    iconContainer.appendChild(iconEl);
    card.appendChild(iconContainer);

    // Name
    const nameEl = createElement('h3', { className: 'achievement-name' });
    nameEl.textContent = def.name;
    card.appendChild(nameEl);

    // Description
    const descEl = createElement('p', { className: 'achievement-description' });
    descEl.textContent = def.description;
    card.appendChild(descEl);

    // Unlocked date
    if (unlocked && unlockedAt) {
      const dateEl = createElement('p', { className: 'achievement-date' });
      dateEl.textContent = `Unlocked ${formatDate(unlockedAt)}`;
      card.appendChild(dateEl);
    }

    // Status for screen readers
    const statusEl = createElement('span', { className: 'sr-only' });
    statusEl.textContent = unlocked ? 'Achievement unlocked' : 'Achievement locked';
    card.appendChild(statusEl);

    return card;
  }

  /**
   * Shows a toast notification for a newly unlocked achievement.
   * @param {AchievementDef} def - The achievement definition.
   */
  function showToast(def) {
    const toast = createElement('div', { className: 'toast achievement-toast' });

    const toastIcon = createElement('span', {
      className: 'toast-icon',
      attributes: { 'aria-hidden': 'true' },
    });
    toastIcon.textContent = def.icon;

    const toastContent = createElement('div', { className: 'toast-content' });
    const toastTitle = createElement('strong', { className: 'toast-title' });
    toastTitle.textContent = 'Achievement Unlocked!';
    const toastName = createElement('p', { className: 'toast-name' });
    toastName.textContent = def.name;

    toastContent.appendChild(toastTitle);
    toastContent.appendChild(toastName);
    toast.appendChild(toastIcon);
    toast.appendChild(toastContent);

    toastContainer.appendChild(toast);

    announceToScreenReader(`Achievement unlocked: ${def.name}. ${def.description}`);

    // Animate in
    if (!prefersReducedMotion()) {
      toast.classList.add('toast--entering');
      requestAnimationFrame(() => {
        toast.classList.remove('toast--entering');
        toast.classList.add('toast--visible');
      });
    } else {
      toast.classList.add('toast--visible');
    }

    // Auto-dismiss after 4 seconds
    const dismissTimer = setTimeout(() => {
      if (!prefersReducedMotion()) {
        toast.classList.remove('toast--visible');
        toast.classList.add('toast--leaving');
        toast.addEventListener('animationend', () => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, { once: true });

        // Fallback removal
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 500);
      } else {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }
    }, 4000);

    // Allow manual dismiss
    toast.addEventListener('click', () => {
      clearTimeout(dismissTimer);
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, { signal });
  }

  // --- Initial render ---
  // Initialize previouslyUnlocked from current state to avoid toasts on first load
  const initState = store.getState();
  ACHIEVEMENT_DEFINITIONS.forEach((def) => {
    try {
      if (def.condition(initState)) {
        previouslyUnlocked.add(def.id);
      }
    } catch {
      // ignore
    }
  });

  renderGrid();

  // --- Store subscription ---
  unsubscribe = store.subscribe(() => {
    renderGrid();
  });

  // --- Cleanup ---
  return function cleanup() {
    abortController.abort();
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

// --- Internal helpers ---

/**
 * Computes consecutive days of activity logging ending today.
 * @param {Array} activities - Activities array.
 * @returns {number} Number of consecutive days.
 */
function computeStreak(activities) {
  if (activities.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /** @type {Set<string>} */
  const loggedDates = new Set();
  activities.forEach((act) => {
    if (act.date) {
      loggedDates.add(new Date(act.date).toISOString().split('T')[0]);
    }
  });

  let streak = 0;
  const checkDate = new Date(today);
  while (loggedDates.has(checkDate.toISOString().split('T')[0])) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

/**
 * Checks if user has achieved a given percentage reduction in emissions
 * by comparing the most recent 30-day period to the preceding 30-day period.
 * @param {object} state - Application state.
 * @param {number} pct - Target reduction percentage.
 * @returns {boolean} True if reduction achieved.
 */
function checkReduction(state, pct) {
  const activities = state.activities || [];
  if (activities.length < 2) return false;

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const currentPeriod = activities
    .filter((a) => a.date && new Date(a.date) >= thirtyDaysAgo)
    .reduce((sum, a) => sum + (a.co2e || 0), 0);

  const previousPeriod = activities
    .filter((a) => {
      if (!a.date) return false;
      const d = new Date(a.date);
      return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    })
    .reduce((sum, a) => sum + (a.co2e || 0), 0);

  if (previousPeriod <= 0) return false;

  const reduction = ((previousPeriod - currentPeriod) / previousPeriod) * 100;
  return reduction >= pct;
}

