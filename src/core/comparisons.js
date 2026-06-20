/**
 * Footprint comparison utilities for CarbonLens.
 *
 * Compares a user's annual emissions against national and global averages,
 * estimates their global percentile, and converts abstract kg CO₂e numbers
 * into tangible real-world equivalents.
 * @module comparisons
 */

import { AVERAGES } from './emission-factors.js';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/**
 * Equivalence factors used to convert kg CO₂e into tangible metrics.
 * @private
 */
const EQUIVALENCE = Object.freeze({
  /** kg CO₂ absorbed by one mature tree per year. */
  treeAbsorptionKgPerYear: 22,
  /** kg CO₂e for one economy transatlantic round-trip flight. */
  transatlanticFlightKg: 1600,
  /** kg CO₂e per km of average gasoline car driving. */
  drivingKgPerKm: 0.21,
  /** kg CO₂e per smartphone full charge. */
  smartphoneChargeKg: 0.008,
});

/**
 * Threshold (as a fraction of the average) within which the user is
 * considered "near" the average rather than distinctly above or below.
 * @private
 */
const NEAR_THRESHOLD = 0.10; // ±10 %

/* ------------------------------------------------------------------ */
/*  Type definitions                                                   */
/* ------------------------------------------------------------------ */

/**
 * @typedef {'above' | 'below' | 'near'} ComparisonStatus
 */

/**
 * @typedef {object} Comparison
 * @property {string}           region      - Region key (e.g. 'us', 'global').
 * @property {string}           regionLabel - Human-readable region name.
 * @property {number}           average     - Regional average in tonnes CO₂e/year.
 * @property {number}           userValue   - User's emissions in tonnes CO₂e/year.
 * @property {number}           difference  - Absolute difference in tonnes (user − average).
 * @property {number}           percentDiff - Percentage difference relative to the average.
 * @property {ComparisonStatus} status      - 'above', 'below', or 'near'.
 */

/**
 * @typedef {object} Equivalents
 * @property {number} treesNeeded        - Trees needed to offset annual emissions.
 * @property {number} flightsEquivalent  - Equivalent transatlantic flights.
 * @property {number} drivingKm          - Equivalent km driven in a gasoline car.
 * @property {number} smartphoneCharges  - Equivalent smartphone charges.
 */

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Compares the user's annual emissions against all regions in {@link AVERAGES}.
 * @param {number} annualEmissionsKg - User's total annual emissions in **kg** CO₂e.
 * @returns {Comparison[]} Array of comparison objects, one per region,
 *   sorted by the magnitude of the difference (largest first).
 * @throws {Error} If `annualEmissionsKg` is not a non-negative finite number.
 * @example
 * const comparisons = compareToAverages(8500);
 * // [{ region: 'india', average: 1.9, userValue: 8.5, difference: 6.6, … }, …]
 */
export function compareToAverages(annualEmissionsKg) {
  if (
    typeof annualEmissionsKg !== 'number' ||
    !Number.isFinite(annualEmissionsKg) ||
    annualEmissionsKg < 0
  ) {
    throw new Error('annualEmissionsKg must be a non-negative finite number');
  }

  const userTonnes = Math.round((annualEmissionsKg / 1000) * 1000) / 1000;

  /** @type {Comparison[]} */
  const results = [];

  for (const [region, data] of Object.entries(AVERAGES)) {
    const average = data.value; // tonnes
    const difference = Math.round((userTonnes - average) * 1000) / 1000;
    const percentDiff = average > 0
      ? Math.round(((userTonnes - average) / average) * 10000) / 100
      : userTonnes > 0 ? 100 : 0;

    /** @type {ComparisonStatus} */
    let status;
    if (Math.abs(percentDiff) <= NEAR_THRESHOLD * 100) {
      status = 'near';
    } else if (userTonnes > average) {
      status = 'above';
    } else {
      status = 'below';
    }

    results.push({
      region,
      regionLabel: data.label,
      average,
      userValue: userTonnes,
      difference,
      percentDiff,
      status,
    });
  }

  // Sort by absolute difference descending
  results.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  return results;
}

/**
 * Estimates the user's global percentile based on a simplified log-normal
 * distribution model of world per-capita emissions.
 *
 * The model uses the global average (4.7 t) with a geometric standard
 * deviation of ~2.5, which roughly approximates the World Bank
 * distribution data.
 *
 * A percentile of 80 means "your emissions are higher than ~80 % of
 * the world population".
 * @param {number} annualEmissionsKg - User's total annual emissions in **kg** CO₂e.
 * @returns {{ percentile: number, interpretation: string }}
 *   The estimated percentile (0-100) and a human-readable interpretation.
 * @throws {Error} If `annualEmissionsKg` is not a non-negative finite number.
 * @example
 * const { percentile, interpretation } = getPercentile(8500);
 * // { percentile: 73, interpretation: 'Your emissions are higher than ~73 % of the world population.' }
 */
export function getPercentile(annualEmissionsKg) {
  if (
    typeof annualEmissionsKg !== 'number' ||
    !Number.isFinite(annualEmissionsKg) ||
    annualEmissionsKg < 0
  ) {
    throw new Error('annualEmissionsKg must be a non-negative finite number');
  }

  if (annualEmissionsKg === 0) {
    return {
      percentile: 0,
      interpretation: 'You have zero recorded emissions — lower than virtually the entire world population.',
    };
  }

  const userTonnes = annualEmissionsKg / 1000;
  const globalMeanTonnes = AVERAGES.global.value; // 4.7

  // Log-normal CDF approximation
  // μ = ln(median), σ = ln(geometric SD)
  // Median ≈ mean / exp(σ²/2) for log-normal
  const geoSD = 2.5;
  const sigma = Math.log(geoSD);
  const mu = Math.log(globalMeanTonnes) - (sigma * sigma) / 2;

  const z = (Math.log(userTonnes) - mu) / sigma;

  // Standard normal CDF approximation (Abramowitz & Stegun)
  const percentile = _clamp(Math.round(_normalCDF(z) * 100), 0, 100);

  /** @type {string} */
  let interpretation;
  if (percentile <= 20) {
    interpretation = `Your emissions are very low — lower than ~${100 - percentile} % of the world population.`;
  } else if (percentile <= 40) {
    interpretation = `Your emissions are below average — lower than ~${100 - percentile} % of the world population.`;
  } else if (percentile <= 60) {
    interpretation = `Your emissions are near the global average — higher than ~${percentile} % of the world population.`;
  } else if (percentile <= 80) {
    interpretation = `Your emissions are above average — higher than ~${percentile} % of the world population.`;
  } else {
    interpretation = `Your emissions are significantly above average — higher than ~${percentile} % of the world population.`;
  }

  return { percentile, interpretation };
}

/**
 * Formats a single comparison object into a human-readable string.
 * @param {Comparison} comparison - A comparison object from {@link compareToAverages}.
 * @returns {string} A sentence describing the comparison.
 * @throws {TypeError} If comparison is invalid.
 * @example
 * formatComparison(comparisons[0]);
 * // 'Your footprint (8.5 t) is 81 % above the India Average (1.9 t).'
 */
export function formatComparison(comparison) {
  if (comparison == null || typeof comparison !== 'object') {
    throw new TypeError('comparison must be a non-null object');
  }

  const { regionLabel, average, userValue, percentDiff, status } = comparison;

  if (status === 'near') {
    return `Your footprint (${userValue} t) is roughly equal to the ${regionLabel} (${average} t).`;
  }

  const direction = status === 'above' ? 'above' : 'below';
  const absPct = Math.abs(percentDiff);

  return `Your footprint (${userValue} t) is ${absPct} % ${direction} the ${regionLabel} (${average} t).`;
}

/**
 * Converts a CO₂e amount into tangible real-world equivalents.
 *
 * Equivalence factors:
 * - 1 mature tree absorbs ~22 kg CO₂ per year
 * - 1 economy transatlantic round-trip ≈ 1,600 kg CO₂e
 * - 1 km of gasoline car driving ≈ 0.21 kg CO₂e
 * - 1 smartphone full charge ≈ 0.008 kg CO₂e
 * @param {number} co2eKg - Amount of CO₂e in **kilograms**.
 * @returns {Equivalents} Object with tangible equivalents.
 * @throws {Error} If `co2eKg` is not a non-negative finite number.
 * @example
 * const eq = getEquivalents(5000);
 * // { treesNeeded: 227, flightsEquivalent: 3.13, drivingKm: 23810, smartphoneCharges: 625000 }
 */
export function getEquivalents(co2eKg) {
  if (
    typeof co2eKg !== 'number' ||
    !Number.isFinite(co2eKg) ||
    co2eKg < 0
  ) {
    throw new Error('co2eKg must be a non-negative finite number');
  }

  const r = (/** @type {number} */ n, /** @type {number} */ decimals = 2) =>
    Math.round(n * 10 ** decimals) / 10 ** decimals;

  return {
    treesNeeded: Math.ceil(co2eKg / EQUIVALENCE.treeAbsorptionKgPerYear),
    flightsEquivalent: r(co2eKg / EQUIVALENCE.transatlanticFlightKg),
    drivingKm: Math.round(co2eKg / EQUIVALENCE.drivingKgPerKm),
    smartphoneCharges: Math.round(co2eKg / EQUIVALENCE.smartphoneChargeKg),
  };
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

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

/**
 * Approximation of the standard normal CDF using the Abramowitz & Stegun
 * formula (equation 26.2.17). Accurate to ~1.5 × 10⁻⁷.
 * @param {number} z - The z-score.
 * @returns {number} P(Z ≤ z) for the standard normal distribution.
 * @private
 */
function _normalCDF(z) {
  if (z < -8) return 0;
  if (z > 8) return 1;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z);
  const t = 1.0 / (1.0 + p * absZ);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const y = 1.0 - (a1 * t + a2 * t2 + a3 * t3 + a4 * t4 + a5 * t5) * Math.exp(-absZ * absZ / 2);

  return 0.5 * (1.0 + sign * y);
}
