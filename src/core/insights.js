/**
 * Personalized carbon-reduction recommendation engine for CarbonLens.
 *
 * Analyses a user's emission profile and generates ranked, actionable
 * insights with estimated CO₂e savings.
 * @module insights
 */

import { CATEGORIES } from './emission-factors.js';
import { calculateCategoryBreakdown } from './calculator.js';

/* ------------------------------------------------------------------ */
/*  Type definitions                                                   */
/* ------------------------------------------------------------------ */

/**
 * @typedef {'high' | 'medium' | 'low'} ImpactLevel
 */

/**
 * @typedef {'easy' | 'moderate' | 'hard'} EaseLevel
 */

/**
 * @typedef {object} Insight
 * @property {string}      id               - Unique identifier for the insight.
 * @property {string}      title            - Short headline.
 * @property {string}      description      - Detailed explanation.
 * @property {string}      category         - The emission category this targets.
 * @property {ImpactLevel} impactLevel      - Estimated emission-reduction impact.
 * @property {EaseLevel}   easeLevel        - How easy the action is to adopt.
 * @property {number}      potentialSavingKg - Estimated annual saving in kg CO₂e.
 * @property {string[]}    actionSteps      - Ordered steps the user can take.
 */

/**
 * @typedef {object} SuggestionTemplate
 * @property {string}      id
 * @property {string}      title
 * @property {string}      description
 * @property {string}      category
 * @property {ImpactLevel} impactLevel
 * @property {EaseLevel}   easeLevel
 * @property {number}      savingFraction - Fraction of category emissions that
 *   could be saved (0-1). Used to estimate `potentialSavingKg`.
 * @property {string[]}    actionSteps
 */

/* ------------------------------------------------------------------ */
/*  Suggestion templates (~20)                                         */
/* ------------------------------------------------------------------ */

/** @type {ReadonlyArray<SuggestionTemplate>} */
const SUGGESTION_TEMPLATES = Object.freeze([
  // ── Transportation (6) ───────────────────────────────────────────
  {
    id: 'transit-commute',
    title: 'Switch to public transit 2 days/week',
    description:
      'Replacing two car commute days per week with public transit can cut your transportation emissions by up to 30 %.',
    category: 'transportation',
    impactLevel: 'high',
    easeLevel: 'moderate',
    savingFraction: 0.30,
    actionSteps: [
      'Research local bus / train routes for your commute',
      'Buy a weekly or monthly transit pass',
      'Start with 1 day per week and increase to 2',
      'Track your mileage savings in CarbonLens',
    ],
  },
  {
    id: 'carpool',
    title: 'Join or start a carpool',
    description:
      'Sharing rides with one other person halves the per-capita emissions for those trips.',
    category: 'transportation',
    impactLevel: 'high',
    easeLevel: 'moderate',
    savingFraction: 0.25,
    actionSteps: [
      'Find coworkers or neighbours with similar commutes',
      'Agree on a schedule and pickup points',
      'Use a carpool matching app if available',
      'Alternate driving duties weekly',
    ],
  },
  {
    id: 'bike-short-trips',
    title: 'Cycle for trips under 5 km',
    description:
      'Many car trips are under 5 km. Switching these to cycling eliminates their emissions entirely.',
    category: 'transportation',
    impactLevel: 'medium',
    easeLevel: 'moderate',
    savingFraction: 0.15,
    actionSteps: [
      'Identify short trips you currently drive',
      'Ensure your bicycle is in good working order',
      'Plan safe cycling routes',
      'Start with 2-3 short trips per week',
    ],
  },
  {
    id: 'reduce-flights',
    title: 'Replace one short-haul flight per year with a train',
    description:
      'A single short-haul flight emits roughly 6× more CO₂ per km than a train journey.',
    category: 'transportation',
    impactLevel: 'high',
    easeLevel: 'hard',
    savingFraction: 0.20,
    actionSteps: [
      'Check rail options for your next short-distance trip',
      'Book train tickets early for better prices',
      'Consider overnight sleeper trains for longer routes',
      'Offset remaining flights if unavoidable',
    ],
  },
  {
    id: 'ev-switch',
    title: 'Consider switching to an electric vehicle',
    description:
      'EVs produce about 75 % fewer tailpipe-equivalent emissions than gasoline cars.',
    category: 'transportation',
    impactLevel: 'high',
    easeLevel: 'hard',
    savingFraction: 0.50,
    actionSteps: [
      'Research EV models within your budget',
      'Check local incentives and tax credits',
      'Evaluate home charging feasibility',
      'Test-drive before committing',
    ],
  },
  {
    id: 'remote-work',
    title: 'Work from home 1-2 days per week',
    description:
      'Eliminating commute days directly reduces transportation emissions with minimal lifestyle change.',
    category: 'transportation',
    impactLevel: 'medium',
    easeLevel: 'easy',
    savingFraction: 0.15,
    actionSteps: [
      'Discuss remote work options with your employer',
      'Set up a productive home workspace',
      'Batch errands on office days to reduce extra trips',
    ],
  },

  // ── Energy (4) ──────────────────────────────────────────────────
  {
    id: 'led-lighting',
    title: 'Switch to LED lighting',
    description:
      'LED bulbs use up to 80 % less energy than incandescent bulbs and last 25× longer.',
    category: 'energy',
    impactLevel: 'medium',
    easeLevel: 'easy',
    savingFraction: 0.08,
    actionSteps: [
      'Identify all incandescent or CFL bulbs in your home',
      'Replace them with equivalent LED bulbs',
      'Choose warm-white LEDs for living areas',
      'Dispose of old bulbs responsibly',
    ],
  },
  {
    id: 'thermostat-adjust',
    title: 'Adjust thermostat by 2 °C seasonally',
    description:
      'Lowering heating by 2 °C in winter (or raising cooling by 2 °C in summer) can save ~10 % on energy bills and emissions.',
    category: 'energy',
    impactLevel: 'high',
    easeLevel: 'easy',
    savingFraction: 0.10,
    actionSteps: [
      'Install a programmable or smart thermostat',
      'Set heating to 19 °C instead of 21 °C in winter',
      'Set cooling to 26 °C instead of 24 °C in summer',
      'Use blankets and fans as complements',
    ],
  },
  {
    id: 'green-energy',
    title: 'Switch to a green energy tariff',
    description:
      'Renewable electricity tariffs can reduce your grid electricity emissions to near zero.',
    category: 'energy',
    impactLevel: 'high',
    easeLevel: 'moderate',
    savingFraction: 0.40,
    actionSteps: [
      'Compare green tariffs from local suppliers',
      'Check for 100 % renewable-backed options',
      'Switch provider (usually takes 2-4 weeks)',
      'Monitor your bills for any cost difference',
    ],
  },
  {
    id: 'appliance-efficiency',
    title: 'Upgrade to energy-efficient appliances',
    description:
      'ENERGY STAR appliances use 10-50 % less energy than standard models.',
    category: 'energy',
    impactLevel: 'medium',
    easeLevel: 'hard',
    savingFraction: 0.15,
    actionSteps: [
      'Identify your highest-consumption appliances',
      'Research ENERGY STAR rated replacements',
      'Prioritise fridge, washer, and water heater',
      'Recycle old appliances through take-back programmes',
    ],
  },

  // ── Diet (4) ─────────────────────────────────────────────────────
  {
    id: 'meatless-monday',
    title: 'Try Meatless Mondays',
    description:
      'Replacing meat with plant-based meals one day a week can reduce diet emissions by ~15 %.',
    category: 'diet',
    impactLevel: 'medium',
    easeLevel: 'easy',
    savingFraction: 0.15,
    actionSteps: [
      'Plan one meat-free day each week',
      'Explore plant-based recipes you enjoy',
      'Stock up on legumes, tofu, and seasonal vegetables',
      'Gradually add a second meat-free day',
    ],
  },
  {
    id: 'reduce-beef',
    title: 'Replace beef with poultry or plant protein',
    description:
      'Beef has roughly 5× the carbon footprint of chicken and 20× that of lentils.',
    category: 'diet',
    impactLevel: 'high',
    easeLevel: 'moderate',
    savingFraction: 0.25,
    actionSteps: [
      'Track how often you eat beef each week',
      'Swap half your beef meals for chicken, fish, or beans',
      'Try plant-based burger alternatives',
      'Experiment with cuisines that are naturally low-beef (e.g. Asian, Mediterranean)',
    ],
  },
  {
    id: 'reduce-food-waste',
    title: 'Reduce household food waste',
    description:
      'The average household wastes ~30 % of purchased food. Reducing waste lowers both diet and waste-category emissions.',
    category: 'diet',
    impactLevel: 'medium',
    easeLevel: 'easy',
    savingFraction: 0.12,
    actionSteps: [
      'Plan meals and make a shopping list before buying',
      'Use FIFO (first in, first out) in your fridge',
      'Freeze leftovers and batch-cook',
      'Compost unavoidable scraps',
    ],
  },
  {
    id: 'local-seasonal',
    title: 'Buy local and seasonal produce',
    description:
      'Locally grown, in-season food travels fewer food-miles and often requires less energy-intensive storage.',
    category: 'diet',
    impactLevel: 'low',
    easeLevel: 'easy',
    savingFraction: 0.08,
    actionSteps: [
      'Visit a local farmers\' market weekly',
      'Learn which fruits and vegetables are in season',
      'Reduce purchases of air-freighted produce',
      'Grow herbs or salad greens at home',
    ],
  },

  // ── Shopping (3) ────────────────────────────────────────────────
  {
    id: 'secondhand-clothing',
    title: 'Buy second-hand clothing',
    description:
      'The fashion industry accounts for ~10 % of global emissions. Buying second-hand extends garment life and avoids new production.',
    category: 'shopping',
    impactLevel: 'low',
    easeLevel: 'easy',
    savingFraction: 0.20,
    actionSteps: [
      'Browse thrift stores or online resale platforms',
      'Host or attend clothing swap events',
      'Repair existing clothes before replacing',
      'Donate unwanted items instead of discarding',
    ],
  },
  {
    id: 'repair-electronics',
    title: 'Repair and extend the life of electronics',
    description:
      'Manufacturing a new smartphone generates ~70 kg CO₂e. Extending its life by one year saves significant emissions.',
    category: 'shopping',
    impactLevel: 'medium',
    easeLevel: 'moderate',
    savingFraction: 0.25,
    actionSteps: [
      'Use protective cases and screen protectors',
      'Replace batteries instead of whole devices',
      'Check local repair cafés or certified repair shops',
      'Buy refurbished when a replacement is needed',
    ],
  },
  {
    id: 'mindful-purchasing',
    title: 'Adopt a "one in, one out" purchasing rule',
    description:
      'For every new item you buy, donate or recycle one existing item. This naturally curbs consumption.',
    category: 'shopping',
    impactLevel: 'medium',
    easeLevel: 'easy',
    savingFraction: 0.15,
    actionSteps: [
      'Before purchasing, ask: do I really need this?',
      'Apply a 30-day waiting rule for non-essentials',
      'Track purchases in CarbonLens to see patterns',
      'Set a monthly spending / item cap',
    ],
  },

  // ── Waste (3) ───────────────────────────────────────────────────
  {
    id: 'start-composting',
    title: 'Start composting food waste',
    description:
      'Composting diverts organic waste from landfill, where it would generate methane — a potent greenhouse gas.',
    category: 'waste',
    impactLevel: 'low',
    easeLevel: 'moderate',
    savingFraction: 0.30,
    actionSteps: [
      'Get a kitchen compost bin or outdoor compost pile',
      'Learn what can and cannot be composted',
      'Use finished compost in your garden or donate it',
      'If space is limited, try a worm-composting system',
    ],
  },
  {
    id: 'improve-recycling',
    title: 'Improve your recycling habits',
    description:
      'Proper sorting can increase effective recycling rates and dramatically reduce landfill emissions.',
    category: 'waste',
    impactLevel: 'medium',
    easeLevel: 'easy',
    savingFraction: 0.25,
    actionSteps: [
      'Learn your local recycling rules and accepted materials',
      'Set up clearly labelled bins at home',
      'Rinse containers before recycling',
      'Avoid "wish-cycling" — when in doubt, check',
    ],
  },
  {
    id: 'reduce-single-use',
    title: 'Eliminate single-use plastics',
    description:
      'Switching to reusable bags, bottles, and containers reduces both waste volume and upstream production emissions.',
    category: 'waste',
    impactLevel: 'low',
    easeLevel: 'easy',
    savingFraction: 0.10,
    actionSteps: [
      'Carry a reusable water bottle and coffee cup',
      'Bring reusable bags when shopping',
      'Replace cling wrap with beeswax wraps or silicone lids',
      'Choose products with minimal packaging',
    ],
  },
]);

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Numeric score for ranking insights (higher = more impactful & easier).
 * @param {SuggestionTemplate} suggestion
 * @returns {number}
 * @private
 */
function _rankScore(suggestion) {
  const impactScores = { high: 3, medium: 2, low: 1 };
  const easeScores = { easy: 3, moderate: 2, hard: 1 };
  return (
    (impactScores[suggestion.impactLevel] || 0) * 2 +
    (easeScores[suggestion.easeLevel] || 0)
  );
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Returns categories sorted by their emission totals (descending).
 * @param {Record<string, { total: number, percentage: number, count: number }>} breakdown
 *   Category breakdown as returned by {@link calculateCategoryBreakdown}.
 * @returns {Array<{ category: string, total: number, percentage: number }>}
 * @example
 * const top = getTopEmissionCategories(breakdown);
 * // [{ category: 'transportation', total: 120, percentage: 55 }, …]
 */
export function getTopEmissionCategories(breakdown) {
  if (breakdown == null || typeof breakdown !== 'object') {
    throw new TypeError('breakdown must be a non-null object');
  }

  return Object.entries(breakdown)
    .map(([category, data]) => ({
      category,
      total: data.total,
      percentage: data.percentage,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Returns actionable reduction suggestions for a specific category,
 * ordered by a combined impact × ease score.
 * @param {string} category        - One of {@link CATEGORIES}.
 * @param {number} currentValueKg  - The user's current emissions (kg CO₂e)
 *   for this category.
 * @returns {Insight[]} Array of insights with `potentialSavingKg` calculated.
 * @throws {Error} If the category is not recognised or currentValueKg is invalid.
 * @example
 * const tips = getReductionSuggestions('transportation', 2500);
 */
export function getReductionSuggestions(category, currentValueKg) {
  if (typeof category !== 'string' || !category.trim()) {
    throw new Error('category must be a non-empty string');
  }
  const normalised = category.trim().toLowerCase();

  if (!CATEGORIES.includes(normalised)) {
    throw new Error(
      `Unknown category "${normalised}". Valid categories: ${CATEGORIES.join(', ')}`,
    );
  }

  if (typeof currentValueKg !== 'number' || !Number.isFinite(currentValueKg) || currentValueKg < 0) {
    throw new Error('currentValueKg must be a non-negative finite number');
  }

  const relevant = SUGGESTION_TEMPLATES
    .filter((s) => s.category === normalised)
    .sort((a, b) => _rankScore(b) - _rankScore(a));

  return relevant.map((template) => ({
    id: template.id,
    title: template.title,
    description: template.description,
    category: template.category,
    impactLevel: template.impactLevel,
    easeLevel: template.easeLevel,
    potentialSavingKg: Math.round(currentValueKg * template.savingFraction * 100) / 100,
    actionSteps: [...template.actionSteps],
  }));
}

/**
 * Estimates the annual CO₂e saving (kg) if the user follows a given suggestion.
 * @param {{ savingFraction?: number, potentialSavingKg?: number }} suggestion
 *   A suggestion template or insight object.
 * @param {number} currentValueKg - Current annual emissions for the relevant category in kg CO₂e.
 * @returns {number} Estimated saving in kg CO₂e.
 * @throws {Error} If inputs are invalid.
 */
export function calculatePotentialSavings(suggestion, currentValueKg) {
  if (suggestion == null || typeof suggestion !== 'object') {
    throw new TypeError('suggestion must be a non-null object');
  }
  if (typeof currentValueKg !== 'number' || !Number.isFinite(currentValueKg) || currentValueKg < 0) {
    throw new Error('currentValueKg must be a non-negative finite number');
  }

  // If the insight already has a computed potentialSavingKg, return it
  if (typeof suggestion.potentialSavingKg === 'number' && Number.isFinite(suggestion.potentialSavingKg)) {
    return suggestion.potentialSavingKg;
  }

  // Otherwise, compute from savingFraction
  if (typeof suggestion.savingFraction === 'number' && Number.isFinite(suggestion.savingFraction)) {
    return Math.round(currentValueKg * suggestion.savingFraction * 100) / 100;
  }

  return 0;
}

/**
 * Analyses the user's emission profile and returns the top 5 personalised
 * recommendations, ranked by a combination of impact and ease.
 *
 * The algorithm:
 * 1. Build a category breakdown from the activities.
 * 2. Sort categories by total emissions (highest first).
 * 3. Collect all applicable suggestions for each category.
 * 4. Score suggestions by `impactLevel × 2 + easeLevel`, weighted by
 *    how large the category's share is.
 * 5. De-duplicate and return the top 5.
 * @param {Array<import('./calculator.js').Activity>} activities
 *   The user's recent activities.
 * @param {object} [goals]
 *   Optional goals object. If a goal targets a specific category, suggestions
 *   for that category are boosted.
 * @param {string} [goals.focusCategory] - Category the user is actively
 *   trying to reduce.
 * @returns {Insight[]} Top 5 personalised insights, sorted by relevance.
 * @example
 * const tips = generateInsights(myActivities, { focusCategory: 'energy' });
 */
export function generateInsights(activities, goals) {
  if (!Array.isArray(activities)) {
    throw new TypeError('activities must be an array');
  }

  // Handle empty activities gracefully
  if (activities.length === 0) {
    // Return a generic set of high-impact, easy suggestions
    return SUGGESTION_TEMPLATES
      .filter((s) => s.impactLevel === 'high' || s.easeLevel === 'easy')
      .sort((a, b) => _rankScore(b) - _rankScore(a))
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        impactLevel: t.impactLevel,
        easeLevel: t.easeLevel,
        potentialSavingKg: 0,
        actionSteps: [...t.actionSteps],
      }));
  }

  const breakdown = calculateCategoryBreakdown(activities);
  const topCategories = getTopEmissionCategories(breakdown);

  const focusCategory = goals && typeof goals.focusCategory === 'string'
    ? goals.focusCategory.trim().toLowerCase()
    : null;

  /**
   * @type {Array<{ insight: Insight, score: number }>}
   */
  const scored = [];

  for (const { category, total, percentage } of topCategories) {
    if (total <= 0) continue;

    const suggestions = getReductionSuggestions(category, total);

    for (const insight of suggestions) {
      let score = _rankScore({
        impactLevel: insight.impactLevel,
        easeLevel: insight.easeLevel,
        savingFraction: 0, // not needed for scoring
        id: '', title: '', description: '', category: '', actionSteps: [],
      });

      // Weight by category share (0-1)
      score *= 1 + (percentage / 100);

      // Boost if the user has a focus goal for this category
      if (focusCategory && category === focusCategory) {
        score *= 1.5;
      }

      scored.push({ insight, score });
    }
  }

  // Sort by score descending, take top 5
  scored.sort((a, b) => b.score - a.score);

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Insight[]} */
  const results = [];

  for (const { insight } of scored) {
    if (seen.has(insight.id)) continue;
    seen.add(insight.id);
    results.push(insight);
    if (results.length >= 5) break;
  }

  return results;
}
