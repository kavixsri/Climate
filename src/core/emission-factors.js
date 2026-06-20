/**
 * Emission factors sourced from EPA GHG Emission Factors Hub (2024)
 * and IPCC AR6 (2023). All values in kg CO₂e.
 * @module emission-factors
 * @see {@link https://www.epa.gov/climateleadership/ghg-emission-factors-hub}
 * @see {@link https://www.ipcc.ch/assessment-report/ar6/}
 */

/**
 * All supported emission categories.
 * @type {ReadonlyArray<string>}
 */
export const CATEGORIES = Object.freeze([
  'transportation',
  'energy',
  'diet',
  'shopping',
  'waste',
]);

/**
 * @typedef {object} EmissionFactor
 * @property {number}  factor - Emission factor in kg CO₂e per unit.
 * @property {string}  unit   - The unit of measurement (e.g. 'km', 'kWh', 'day').
 * @property {string}  label  - Human-readable label for display.
 * @property {string}  source - Data source citation.
 */

/**
 * Comprehensive emission factors organised by category and type.
 * Nested objects represent sub-types (e.g. car → gasoline / diesel).
 * @type {Readonly<Record<string, Record<string, EmissionFactor | Record<string, EmissionFactor>>>>}
 */
export const EMISSION_FACTORS = Object.freeze({
  transportation: Object.freeze({
    car: Object.freeze({
      gasoline: Object.freeze({ factor: 0.21, unit: 'km', label: 'Gasoline Car', source: 'EPA 2024' }),
      diesel: Object.freeze({ factor: 0.171, unit: 'km', label: 'Diesel Car', source: 'EPA 2024' }),
      electric: Object.freeze({ factor: 0.053, unit: 'km', label: 'Electric Car', source: 'EPA 2024' }),
      hybrid: Object.freeze({ factor: 0.12, unit: 'km', label: 'Hybrid Car', source: 'EPA 2024' }),
    }),
    bus: Object.freeze({ factor: 0.089, unit: 'km', label: 'Bus', source: 'IPCC AR6' }),
    train: Object.freeze({ factor: 0.041, unit: 'km', label: 'Train', source: 'IPCC AR6' }),
    flight: Object.freeze({
      short: Object.freeze({ factor: 0.255, unit: 'km', label: 'Short-haul Flight (<1500km)', source: 'IPCC AR6' }),
      long: Object.freeze({ factor: 0.195, unit: 'km', label: 'Long-haul Flight (>1500km)', source: 'IPCC AR6' }),
    }),
    bicycle: Object.freeze({ factor: 0, unit: 'km', label: 'Bicycle', source: 'N/A' }),
    walking: Object.freeze({ factor: 0, unit: 'km', label: 'Walking', source: 'N/A' }),
  }),

  energy: Object.freeze({
    electricity: Object.freeze({ factor: 0.417, unit: 'kWh', label: 'Electricity', source: 'EPA eGRID 2024' }),
    naturalGas: Object.freeze({ factor: 2.04, unit: 'm³', label: 'Natural Gas', source: 'EPA 2024' }),
    heatingOil: Object.freeze({ factor: 2.96, unit: 'liter', label: 'Heating Oil', source: 'EPA 2024' }),
    propane: Object.freeze({ factor: 1.51, unit: 'liter', label: 'Propane', source: 'EPA 2024' }),
  }),

  diet: Object.freeze({
    meatHeavy: Object.freeze({ factor: 7.19, unit: 'day', label: 'Meat-Heavy Diet', source: 'Poore & Nemecek 2018' }),
    average: Object.freeze({ factor: 5.63, unit: 'day', label: 'Average Diet', source: 'Poore & Nemecek 2018' }),
    pescatarian: Object.freeze({ factor: 4.67, unit: 'day', label: 'Pescatarian Diet', source: 'Poore & Nemecek 2018' }),
    vegetarian: Object.freeze({ factor: 3.81, unit: 'day', label: 'Vegetarian Diet', source: 'Poore & Nemecek 2018' }),
    vegan: Object.freeze({ factor: 2.89, unit: 'day', label: 'Vegan Diet', source: 'Poore & Nemecek 2018' }),
  }),

  shopping: Object.freeze({
    clothing: Object.freeze({ factor: 25, unit: 'item', label: 'Clothing Item', source: 'WRAP UK 2023' }),
    electronics: Object.freeze({ factor: 100, unit: 'item', label: 'Electronics', source: 'EPA 2024' }),
    furniture: Object.freeze({ factor: 150, unit: 'item', label: 'Furniture', source: 'EPA 2024' }),
    other: Object.freeze({ factor: 10, unit: 'item', label: 'Other Purchase', source: 'Estimated' }),
  }),

  waste: Object.freeze({
    landfill: Object.freeze({ factor: 0.58, unit: 'kg', label: 'Landfill Waste', source: 'EPA 2024' }),
    recycling: Object.freeze({ factor: 0.04, unit: 'kg', label: 'Recycled Waste', source: 'EPA 2024' }),
    composting: Object.freeze({ factor: 0.01, unit: 'kg', label: 'Composted Waste', source: 'EPA 2024' }),
  }),
});

/**
 * National and global per-capita averages in tonnes CO₂e per year.
 * @typedef {object} AverageEntry
 * @property {number} value  - Average annual emissions in tonnes CO₂e.
 * @property {string} label  - Human-readable region name.
 * @property {string} source - Data source citation.
 */

/**
 * @type {Readonly<Record<string, AverageEntry>>}
 */
export const AVERAGES = Object.freeze({
  global: Object.freeze({ value: 4.7, label: 'Global Average', source: 'World Bank 2023' }),
  us: Object.freeze({ value: 14.7, label: 'US Average', source: 'World Bank 2023' }),
  eu: Object.freeze({ value: 6.1, label: 'EU Average', source: 'Eurostat 2023' }),
  india: Object.freeze({ value: 1.9, label: 'India Average', source: 'World Bank 2023' }),
  china: Object.freeze({ value: 8.0, label: 'China Average', source: 'World Bank 2023' }),
  uk: Object.freeze({ value: 5.2, label: 'UK Average', source: 'World Bank 2023' }),
});

/**
 * Returns a flat array of all emission factors for a given category.
 * For categories with nested sub-types (e.g. transportation → car → gasoline),
 * the nested factors are flattened into the result.
 * @param {string} category - One of the values in {@link CATEGORIES}.
 * @returns {Array<{key: string, factor: EmissionFactor}>}
 *   Flat list of `{ key, factor }` objects where `key` is the dot-separated
 *   path relative to the category (e.g. `'car.gasoline'`).
 * @throws {Error} If the category is not recognised.
 * @example
 * const factors = getFactorsForCategory('energy');
 * // [{ key: 'electricity', factor: { factor: 0.417, … } }, …]
 */
export function getFactorsForCategory(category) {
  if (typeof category !== 'string' || !category.trim()) {
    throw new Error('category must be a non-empty string');
  }

  const normalised = category.trim().toLowerCase();

  if (!CATEGORIES.includes(normalised)) {
    throw new Error(
      `Unknown category "${normalised}". Valid categories: ${CATEGORIES.join(', ')}`,
    );
  }

  const categoryData = EMISSION_FACTORS[normalised];
  /** @type {Array<{key: string, factor: EmissionFactor}>} */
  const results = [];

  /**
   * Recursively collect leaf emission-factor objects.
   * @param {Record<string, any>} obj
   * @param {string} prefix
   */
  const collect = (obj, prefix) => {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && typeof value.factor === 'number') {
        results.push({ key: path, factor: value });
      } else if (value && typeof value === 'object') {
        collect(value, path);
      }
    }
  };

  collect(categoryData, '');
  return results;
}

/**
 * Looks up a specific emission factor by its dot-separated path.
 * @param {string} path - Dot-separated path such as `'transportation.car.gasoline'`
 *   or `'energy.electricity'`.
 * @returns {EmissionFactor | null} The matching emission factor, or `null`
 *   if the path does not resolve to a valid leaf factor.
 * @throws {Error} If `path` is not a non-empty string.
 * @example
 * const ef = getFactorByPath('transportation.car.gasoline');
 * // { factor: 0.21, unit: 'km', label: 'Gasoline Car', source: 'EPA 2024' }
 * @example
 * const missing = getFactorByPath('transportation.hovercraft');
 * // null
 */
export function getFactorByPath(path) {
  if (typeof path !== 'string' || !path.trim()) {
    throw new Error('path must be a non-empty string');
  }

  const segments = path.trim().split('.');

  /** @type {any} */
  let current = EMISSION_FACTORS;

  for (const segment of segments) {
    if (current == null || typeof current !== 'object') {
      return null;
    }
    current = current[segment];
  }

  // Verify that we landed on a leaf factor (has a numeric `factor` property)
  if (current && typeof current === 'object' && typeof current.factor === 'number') {
    return /** @type {EmissionFactor} */ (current);
  }

  return null;
}
