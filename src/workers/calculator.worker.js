/**
 * Web Worker for offloading heavy batch emission calculations.
 *
 * Handles message types:
 * - `'calculateBatch'` – Receives an array of activities; returns totals + breakdown.
 * - `'projectAnnual'`  – Receives activities + periodDays; returns annual projection.
 *
 * Because ES module imports inside workers are not universally supported
 * across all browsers, the core calculation logic is **inlined** here.
 * This avoids runtime import failures while keeping the worker self-contained.
 * @module calculator-worker
 */

/* ------------------------------------------------------------------ */
/*  Inlined emission factors (mirror of emission-factors.js)           */
/* ------------------------------------------------------------------ */

const CATEGORIES = ['transportation', 'energy', 'diet', 'shopping', 'waste'];

const EMISSION_FACTORS = {
  transportation: {
    car: {
      gasoline: { factor: 0.21, unit: 'km', label: 'Gasoline Car', source: 'EPA 2024' },
      diesel: { factor: 0.171, unit: 'km', label: 'Diesel Car', source: 'EPA 2024' },
      electric: { factor: 0.053, unit: 'km', label: 'Electric Car', source: 'EPA 2024' },
      hybrid: { factor: 0.12, unit: 'km', label: 'Hybrid Car', source: 'EPA 2024' },
    },
    bus: { factor: 0.089, unit: 'km', label: 'Bus', source: 'IPCC AR6' },
    train: { factor: 0.041, unit: 'km', label: 'Train', source: 'IPCC AR6' },
    flight: {
      short: { factor: 0.255, unit: 'km', label: 'Short-haul Flight (<1500km)', source: 'IPCC AR6' },
      long: { factor: 0.195, unit: 'km', label: 'Long-haul Flight (>1500km)', source: 'IPCC AR6' },
    },
    bicycle: { factor: 0, unit: 'km', label: 'Bicycle', source: 'N/A' },
    walking: { factor: 0, unit: 'km', label: 'Walking', source: 'N/A' },
  },
  energy: {
    electricity: { factor: 0.417, unit: 'kWh', label: 'Electricity', source: 'EPA eGRID 2024' },
    naturalGas: { factor: 2.04, unit: 'm³', label: 'Natural Gas', source: 'EPA 2024' },
    heatingOil: { factor: 2.96, unit: 'liter', label: 'Heating Oil', source: 'EPA 2024' },
    propane: { factor: 1.51, unit: 'liter', label: 'Propane', source: 'EPA 2024' },
  },
  diet: {
    meatHeavy: { factor: 7.19, unit: 'day', label: 'Meat-Heavy Diet', source: 'Poore & Nemecek 2018' },
    average: { factor: 5.63, unit: 'day', label: 'Average Diet', source: 'Poore & Nemecek 2018' },
    pescatarian: { factor: 4.67, unit: 'day', label: 'Pescatarian Diet', source: 'Poore & Nemecek 2018' },
    vegetarian: { factor: 3.81, unit: 'day', label: 'Vegetarian Diet', source: 'Poore & Nemecek 2018' },
    vegan: { factor: 2.89, unit: 'day', label: 'Vegan Diet', source: 'Poore & Nemecek 2018' },
  },
  shopping: {
    clothing: { factor: 25, unit: 'item', label: 'Clothing Item', source: 'WRAP UK 2023' },
    electronics: { factor: 100, unit: 'item', label: 'Electronics', source: 'EPA 2024' },
    furniture: { factor: 150, unit: 'item', label: 'Furniture', source: 'EPA 2024' },
    other: { factor: 10, unit: 'item', label: 'Other Purchase', source: 'Estimated' },
  },
  waste: {
    landfill: { factor: 0.58, unit: 'kg', label: 'Landfill Waste', source: 'EPA 2024' },
    recycling: { factor: 0.04, unit: 'kg', label: 'Recycled Waste', source: 'EPA 2024' },
    composting: { factor: 0.01, unit: 'kg', label: 'Composted Waste', source: 'EPA 2024' },
  },
};

/* ------------------------------------------------------------------ */
/*  Inlined calculation logic                                          */
/* ------------------------------------------------------------------ */

/**
 * Resolves an emission factor from the factor tree.
 * @param {string} category
 * @param {string} type
 * @param {string} [subtype]
 * @returns {{ factor: number, unit: string, label: string, source: string } | null}
 */
function resolveFactor(category, type, subtype) {
  const categoryData = EMISSION_FACTORS[category];
  if (!categoryData) return null;

  const typeData = categoryData[type];
  if (!typeData) return null;

  if (typeof typeData.factor === 'number' && !subtype) {
    return typeData;
  }

  if (subtype && typeData[subtype] && typeof typeData[subtype].factor === 'number') {
    return typeData[subtype];
  }

  if (typeof typeData.factor !== 'number' && !subtype) {
    return null;
  }

  return null;
}

/**
 * Validates an activity object. Returns an array of error strings (empty = valid).
 * @param {object} activity
 * @returns {string[]}
 */
function validateActivity(activity) {
  const errors = [];

  if (activity == null || typeof activity !== 'object') {
    return ['Activity must be a non-null object'];
  }

  if (typeof activity.category !== 'string' || !activity.category.trim()) {
    errors.push('category is required and must be a non-empty string');
  } else if (!CATEGORIES.includes(activity.category.trim().toLowerCase())) {
    errors.push(`Unknown category "${activity.category}"`);
  }

  if (typeof activity.type !== 'string' || !activity.type.trim()) {
    errors.push('type is required and must be a non-empty string');
  }

  if (typeof activity.amount !== 'number' || !Number.isFinite(activity.amount) || activity.amount < 0) {
    errors.push('amount must be a non-negative finite number');
  }

  if (typeof activity.date !== 'string' || !activity.date.trim()) {
    errors.push('date is required and must be a non-empty string');
  } else if (Number.isNaN(new Date(activity.date).getTime())) {
    errors.push(`Invalid date: "${activity.date}"`);
  }

  return errors;
}

/**
 * Calculates CO₂e for a single activity.
 * @param {object} activity
 * @returns {{ co2e: number, category: string, date: string }}
 */
function calculateActivityEmission(activity) {
  const errors = validateActivity(activity);
  if (errors.length > 0) {
    throw new Error(`Invalid activity: ${errors.join('; ')}`);
  }

  const { category, type, subtype, amount, date } = activity;
  const factorEntry = resolveFactor(category, type, subtype);

  if (!factorEntry) {
    const path = [category, type, subtype].filter(Boolean).join('.');
    throw new Error(`No emission factor found for path "${path}"`);
  }

  const co2e = Math.round(amount * factorEntry.factor * 1000) / 1000;

  return {
    category,
    type,
    subtype,
    amount,
    date,
    co2e,
    unit: factorEntry.unit,
    label: factorEntry.label,
    source: factorEntry.source,
  };
}

/**
 * Calculates totals and breakdown for an array of activities.
 * @param {object[]} activities
 * @returns {{ total: number, breakdown: Record<string, number>, daily: number, weekly: number, monthly: number, annual: number, activityCount: number }}
 */
function calculateTotalEmissions(activities) {
  if (!Array.isArray(activities) || activities.length === 0) {
    const emptyBreakdown = {};
    for (const cat of CATEGORIES) emptyBreakdown[cat] = 0;
    return { total: 0, breakdown: emptyBreakdown, daily: 0, weekly: 0, monthly: 0, annual: 0, activityCount: 0 };
  }

  const breakdown = {};
  for (const cat of CATEGORIES) breakdown[cat] = 0;

  let total = 0;
  let minDate = Infinity;
  let maxDate = -Infinity;

  for (const activity of activities) {
    const calc = calculateActivityEmission(activity);
    total += calc.co2e;
    breakdown[calc.category] = (breakdown[calc.category] || 0) + calc.co2e;

    const ts = new Date(calc.date).getTime();
    if (Number.isFinite(ts)) {
      if (ts < minDate) minDate = ts;
      if (ts > maxDate) maxDate = ts;
    }
  }

  const MS_PER_DAY = 86_400_000;
  const spanDays = Math.max(1, Math.round((maxDate - minDate) / MS_PER_DAY) + 1);

  const daily = total / spanDays;
  const r = (n) => Math.round(n * 1000) / 1000;

  return {
    total: r(total),
    breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, r(v)])),
    daily: r(daily),
    weekly: r(daily * 7),
    monthly: r(daily * 30.44),
    annual: r(daily * 365.25),
    activityCount: activities.length,
  };
}

/**
 * Projects annual emissions from a sample period.
 * @param {object[]} activities
 * @param {number} periodDays
 * @returns {{ annualTotal: number, annualTonnes: number, periodTotal: number, periodDays: number, dailyAverage: number, confidence: number }}
 */
function projectAnnualEmissions(activities, periodDays) {
  if (typeof periodDays !== 'number' || !Number.isFinite(periodDays) || periodDays <= 0) {
    throw new Error('periodDays must be a positive finite number');
  }

  const totals = calculateTotalEmissions(activities);
  const periodTotal = totals.total;
  const dailyAverage = periodTotal / periodDays;
  const annualTotal = dailyAverage * 365.25;

  let confidence;
  if (periodDays < 7) confidence = 0.2;
  else if (periodDays < 30) confidence = 0.5;
  else if (periodDays < 90) confidence = 0.7;
  else confidence = 0.9;

  const r = (n) => Math.round(n * 1000) / 1000;

  return {
    annualTotal: r(annualTotal),
    annualTonnes: r(annualTotal / 1000),
    periodTotal: r(periodTotal),
    periodDays,
    dailyAverage: r(dailyAverage),
    confidence,
  };
}

/**
 * Calculates category breakdown with percentages.
 * @param {object[]} activities
 * @returns {Record<string, { total: number, percentage: number, count: number }>}
 */
function calculateCategoryBreakdown(activities) {
  const accumulator = {};
  for (const cat of CATEGORIES) accumulator[cat] = { total: 0, count: 0 };

  let grandTotal = 0;

  for (const activity of activities) {
    const calc = calculateActivityEmission(activity);
    accumulator[calc.category].total += calc.co2e;
    accumulator[calc.category].count += 1;
    grandTotal += calc.co2e;
  }

  const result = {};
  for (const cat of CATEGORIES) {
    const { total, count } = accumulator[cat];
    result[cat] = {
      total: Math.round(total * 1000) / 1000,
      percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 10000) / 100 : 0,
      count,
    };
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Worker message handler                                             */
/* ------------------------------------------------------------------ */

/**
 * Handles incoming messages from the main thread.
 *
 * Expected message format:
 * ```js
 * {
 *   id: string,          // Unique request ID for correlating responses
 *   type: string,        // 'calculateBatch' | 'projectAnnual'
 *   payload: Object      // Request-specific data
 * }
 * ```
 *
 * Response format:
 * ```js
 * {
 *   id: string,          // Echoed request ID
 *   type: string,        // Echoed request type
 *   success: boolean,
 *   result?: Object,     // Present on success
 *   error?: string       // Present on failure
 * }
 * ```
 * @param event
 */
self.onmessage = function handleMessage(event) {
  const { id, type, payload } = event.data || {};

  // Validate the envelope
  if (!id || !type) {
    self.postMessage({
      id: id || 'unknown',
      type: type || 'unknown',
      success: false,
      error: 'Message must include "id" and "type" fields.',
    });
    return;
  }

  try {
    switch (type) {
      case 'calculateBatch': {
        if (!payload || !Array.isArray(payload.activities)) {
          throw new Error('payload.activities must be an array');
        }

        const totals = calculateTotalEmissions(payload.activities);
        const breakdown = calculateCategoryBreakdown(payload.activities);

        self.postMessage({
          id,
          type,
          success: true,
          result: { totals, breakdown },
        });
        break;
      }

      case 'projectAnnual': {
        if (!payload || !Array.isArray(payload.activities)) {
          throw new Error('payload.activities must be an array');
        }
        if (typeof payload.periodDays !== 'number' || payload.periodDays <= 0) {
          throw new Error('payload.periodDays must be a positive number');
        }

        const projection = projectAnnualEmissions(
          payload.activities,
          payload.periodDays,
        );

        self.postMessage({
          id,
          type,
          success: true,
          result: projection,
        });
        break;
      }

      default:
        self.postMessage({
          id,
          type,
          success: false,
          error: `Unknown message type: "${type}". Supported types: calculateBatch, projectAnnual.`,
        });
    }
  } catch (err) {
    self.postMessage({
      id,
      type,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
