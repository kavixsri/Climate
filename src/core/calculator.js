/**
 * Emission calculation engine for CarbonLens.
 *
 * All exported functions are **pure** — they produce no side effects and
 * return new objects rather than mutating inputs.
 *
 * @module calculator
 */

import { EMISSION_FACTORS, CATEGORIES } from './emission-factors.js';
import { validateActivity } from '../utils/validation.js';

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Safely resolves a nested emission factor from the EMISSION_FACTORS tree.
 *
 * @param {string} category
 * @param {string} type
 * @param {string} [subtype]
 * @returns {{ factor: number, unit: string, label: string, source: string } | null}
 * @private
 */
function _resolveFactor(category, type, subtype) {
  const categoryData = EMISSION_FACTORS[category];
  if (!categoryData) return null;

  const typeData = categoryData[type];
  if (!typeData) return null;

  // Leaf node (has a numeric `factor` property directly)
  if (typeof typeData.factor === 'number' && !subtype) {
    return typeData;
  }

  // Nested node — a subtype is required
  if (subtype && typeData[subtype] && typeof typeData[subtype].factor === 'number') {
    return typeData[subtype];
  }

  // typeData is a group but no subtype was specified → can't resolve
  if (typeof typeData.factor !== 'number' && !subtype) {
    return null;
  }

  return null;
}

/**
 * Converts a number of days into a human-friendly period label.
 *
 * @param {number} days
 * @returns {string}
 * @private
 */
function _periodLabel(days) {
  if (days <= 1) return 'daily';
  if (days <= 7) return 'weekly';
  if (days <= 31) return 'monthly';
  if (days <= 366) return 'annual';
  return `${days}-day`;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} Activity
 * @property {string}  category  - One of {@link CATEGORIES}.
 * @property {string}  type      - Emission type within the category (e.g. 'car').
 * @property {string}  [subtype] - Optional sub-type (e.g. 'gasoline').
 * @property {number}  amount    - Quantity consumed in the factor's native unit.
 * @property {string}  date      - ISO-8601 date string (YYYY-MM-DD).
 */

/**
 * @typedef {Object} CalculatedActivity
 * @property {string}  category
 * @property {string}  type
 * @property {string}  [subtype]
 * @property {number}  amount
 * @property {string}  date
 * @property {number}  co2e   - Calculated emissions in kg CO₂e.
 * @property {string}  unit   - The unit of the underlying emission factor.
 * @property {string}  label  - Human-readable label for the factor used.
 * @property {string}  source - Citation for the factor used.
 */

/**
 * Calculates the CO₂e emissions for a single activity.
 *
 * @param {Activity} activity - The activity to calculate emissions for.
 * @returns {CalculatedActivity} A new object containing the original activity
 *   fields plus `co2e`, `unit`, `label`, and `source`.
 * @throws {Error} If the activity fails validation or the emission factor
 *   cannot be resolved.
 *
 * @example
 * const result = calculateActivityEmission({
 *   category: 'transportation',
 *   type: 'car',
 *   subtype: 'gasoline',
 *   amount: 50,
 *   date: '2024-06-15',
 * });
 * // result.co2e === 10.5  (50 km × 0.21 kg CO₂e/km)
 */
export function calculateActivityEmission(activity) {
  // Validate input — throws on failure
  const errors = validateActivity(activity);
  if (errors.length > 0) {
    throw new Error(`Invalid activity: ${errors.join('; ')}`);
  }

  const { category, type, subtype, amount, date } = activity;

  const factorEntry = _resolveFactor(category, type, subtype);
  if (!factorEntry) {
    const path = [category, type, subtype].filter(Boolean).join('.');
    throw new Error(`No emission factor found for path "${path}"`);
  }

  const co2e = Math.round(amount * factorEntry.factor * 1000) / 1000; // 3 decimal places

  return {
    ...activity,
    co2e,
    unit: factorEntry.unit,
    label: factorEntry.label,
    source: factorEntry.source,
  };
}

/**
 * @typedef {Object} TotalEmissions
 * @property {number} total     - Sum of all emissions in kg CO₂e.
 * @property {Record<string, number>} breakdown - Emissions per category in kg CO₂e.
 * @property {number} daily     - Estimated daily average (kg CO₂e).
 * @property {number} weekly    - Estimated weekly average (kg CO₂e).
 * @property {number} monthly   - Estimated monthly average (kg CO₂e).
 * @property {number} annual    - Estimated annual projection (kg CO₂e).
 * @property {number} activityCount - Total number of activities processed.
 */

/**
 * Calculates aggregate emissions for an array of activities.
 *
 * If the activities span multiple dates the function derives daily, weekly,
 * monthly, and annual estimates from the date range. If all activities share
 * a single date the period is assumed to be 1 day.
 *
 * @param {Activity[]} activities - Array of activity objects.
 * @returns {TotalEmissions} Aggregated emission statistics.
 * @throws {Error} If any individual activity is invalid.
 *
 * @example
 * const totals = calculateTotalEmissions([
 *   { category: 'energy', type: 'electricity', amount: 30, date: '2024-06-01' },
 *   { category: 'energy', type: 'electricity', amount: 28, date: '2024-06-30' },
 * ]);
 */
export function calculateTotalEmissions(activities) {
  if (!Array.isArray(activities)) {
    throw new TypeError('activities must be an array');
  }

  if (activities.length === 0) {
    /** @type {Record<string, number>} */
    const emptyBreakdown = {};
    for (const cat of CATEGORIES) {
      emptyBreakdown[cat] = 0;
    }
    return {
      total: 0,
      breakdown: emptyBreakdown,
      daily: 0,
      weekly: 0,
      monthly: 0,
      annual: 0,
      activityCount: 0,
    };
  }

  /** @type {Record<string, number>} */
  const breakdown = {};
  for (const cat of CATEGORIES) {
    breakdown[cat] = 0;
  }

  let total = 0;
  let minDate = Infinity;
  let maxDate = -Infinity;

  for (const activity of activities) {
    const calculated = calculateActivityEmission(activity);
    total += calculated.co2e;
    breakdown[calculated.category] = (breakdown[calculated.category] || 0) + calculated.co2e;

    const ts = new Date(calculated.date).getTime();
    if (Number.isFinite(ts)) {
      if (ts < minDate) minDate = ts;
      if (ts > maxDate) maxDate = ts;
    }
  }

  // Determine date span in days (minimum 1)
  const MS_PER_DAY = 86_400_000;
  const spanDays = Math.max(1, Math.round((maxDate - minDate) / MS_PER_DAY) + 1);

  const daily = total / spanDays;
  const weekly = daily * 7;
  const monthly = daily * 30.44; // average days per month
  const annual = daily * 365.25;

  // Round all values to 3 decimal places
  const r = (/** @type {number} */ n) => Math.round(n * 1000) / 1000;

  return {
    total: r(total),
    breakdown: Object.fromEntries(
      Object.entries(breakdown).map(([k, v]) => [k, r(v)]),
    ),
    daily: r(daily),
    weekly: r(weekly),
    monthly: r(monthly),
    annual: r(annual),
    activityCount: activities.length,
  };
}

/**
 * @typedef {Object} CategoryBreakdownEntry
 * @property {number} total      - Total emissions for the category in kg CO₂e.
 * @property {number} percentage - Percentage of overall emissions (0-100).
 * @property {number} count      - Number of activities in this category.
 */

/**
 * Returns a per-category breakdown with totals, percentages, and counts.
 *
 * @param {Activity[]} activities - Array of activity objects.
 * @returns {Record<string, CategoryBreakdownEntry>} Breakdown keyed by category.
 *
 * @example
 * const bd = calculateCategoryBreakdown(activities);
 * // { transportation: { total: 42, percentage: 60, count: 5 }, … }
 */
export function calculateCategoryBreakdown(activities) {
  if (!Array.isArray(activities)) {
    throw new TypeError('activities must be an array');
  }

  /** @type {Record<string, { total: number, count: number }>} */
  const accumulator = {};
  for (const cat of CATEGORIES) {
    accumulator[cat] = { total: 0, count: 0 };
  }

  let grandTotal = 0;

  for (const activity of activities) {
    const calculated = calculateActivityEmission(activity);
    const cat = calculated.category;
    accumulator[cat].total += calculated.co2e;
    accumulator[cat].count += 1;
    grandTotal += calculated.co2e;
  }

  /** @type {Record<string, CategoryBreakdownEntry>} */
  const result = {};
  for (const cat of CATEGORIES) {
    const { total, count } = accumulator[cat];
    result[cat] = {
      total: Math.round(total * 1000) / 1000,
      percentage: grandTotal > 0
        ? Math.round((total / grandTotal) * 10000) / 100
        : 0,
      count,
    };
  }

  return result;
}

/**
 * @typedef {Object} AnnualProjection
 * @property {number} annualTotal     - Projected annual emissions in kg CO₂e.
 * @property {number} annualTonnes    - Same value converted to tonnes CO₂e.
 * @property {number} periodTotal     - Actual total for the sample period.
 * @property {number} periodDays      - Length of the sample period in days.
 * @property {string} periodLabel     - Human-readable period description.
 * @property {number} dailyAverage    - Daily average in kg CO₂e.
 * @property {number} confidence      - Rough confidence indicator (0-1) based on period length.
 */

/**
 * Projects annual emissions from a sample period.
 *
 * Confidence is higher for longer sample periods:
 * - 1-6 days   → 0.2
 * - 7-29 days  → 0.5
 * - 30-89 days → 0.7
 * - 90+ days   → 0.9
 *
 * @param {Activity[]} activities - Activities within the sample period.
 * @param {number} periodDays     - Number of days the sample covers.
 * @returns {AnnualProjection} The projection result.
 * @throws {Error} If periodDays is not a positive finite number.
 */
export function projectAnnualEmissions(activities, periodDays) {
  if (typeof periodDays !== 'number' || !Number.isFinite(periodDays) || periodDays <= 0) {
    throw new Error('periodDays must be a positive finite number');
  }

  if (!Array.isArray(activities)) {
    throw new TypeError('activities must be an array');
  }

  const totals = calculateTotalEmissions(activities);
  const periodTotal = totals.total;
  const dailyAverage = periodTotal / periodDays;
  const annualTotal = dailyAverage * 365.25;

  /** @type {number} */
  let confidence;
  if (periodDays < 7) confidence = 0.2;
  else if (periodDays < 30) confidence = 0.5;
  else if (periodDays < 90) confidence = 0.7;
  else confidence = 0.9;

  const r = (/** @type {number} */ n) => Math.round(n * 1000) / 1000;

  return {
    annualTotal: r(annualTotal),
    annualTonnes: r(annualTotal / 1000),
    periodTotal: r(periodTotal),
    periodDays,
    periodLabel: _periodLabel(periodDays),
    dailyAverage: r(dailyAverage),
    confidence,
  };
}

/**
 * @typedef {Object} TrendResult
 * @property {'increasing' | 'decreasing' | 'stable' | 'insufficient_data'} direction
 *   The overall trend direction.
 * @property {number} percentageChange - Percentage change from the first to last period.
 * @property {number} absoluteChange   - Absolute change in kg CO₂e.
 * @property {number} periodsAnalysed  - Number of periods used in the analysis.
 */

/**
 * Calculates the emission trend across multiple periods.
 *
 * Each key in `activitiesByPeriod` should be a period label (e.g. '2024-W01')
 * mapped to the array of activities for that period. Periods are sorted
 * lexicographically, so ISO week / month labels work well.
 *
 * A change of less than ±2 % is considered **stable**.
 *
 * @param {Record<string, Activity[]>} activitiesByPeriod
 *   Object mapping period labels to their activities.
 * @returns {TrendResult} The computed trend.
 *
 * @example
 * const trend = calculateTrend({
 *   '2024-W01': activitiesWeek1,
 *   '2024-W02': activitiesWeek2,
 *   '2024-W03': activitiesWeek3,
 * });
 */
export function calculateTrend(activitiesByPeriod) {
  if (
    activitiesByPeriod == null ||
    typeof activitiesByPeriod !== 'object' ||
    Array.isArray(activitiesByPeriod)
  ) {
    throw new TypeError('activitiesByPeriod must be a non-null object');
  }

  const sortedKeys = Object.keys(activitiesByPeriod).sort();

  if (sortedKeys.length < 2) {
    return {
      direction: 'insufficient_data',
      percentageChange: 0,
      absoluteChange: 0,
      periodsAnalysed: sortedKeys.length,
    };
  }

  const periodTotals = sortedKeys.map((key) => {
    const acts = activitiesByPeriod[key];
    if (!Array.isArray(acts)) {
      throw new TypeError(`Activities for period "${key}" must be an array`);
    }
    return calculateTotalEmissions(acts).total;
  });

  const first = periodTotals[0];
  const last = periodTotals[periodTotals.length - 1];
  const absoluteChange = Math.round((last - first) * 1000) / 1000;

  let percentageChange = 0;
  if (first !== 0) {
    percentageChange = Math.round(((last - first) / first) * 10000) / 100;
  } else if (last !== 0) {
    percentageChange = 100; // went from zero to something
  }

  const STABLE_THRESHOLD = 2; // ±2 %

  /** @type {'increasing' | 'decreasing' | 'stable'} */
  let direction;
  if (Math.abs(percentageChange) <= STABLE_THRESHOLD) {
    direction = 'stable';
  } else if (percentageChange > 0) {
    direction = 'increasing';
  } else {
    direction = 'decreasing';
  }

  return {
    direction,
    percentageChange,
    absoluteChange,
    periodsAnalysed: sortedKeys.length,
  };
}
