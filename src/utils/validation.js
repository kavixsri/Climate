/**
 * Input validation and sanitization utilities for CarbonLens.
 * CRITICAL FOR SECURITY — never trust user input.
 *
 * All user-facing data must pass through these validators before
 * being stored or rendered. HTML tags are stripped, strings are
 * length-limited, and numbers are clamped to safe ranges.
 * @module validation
 */

/** @type {number} Maximum allowed length for user-entered strings */
const MAX_STRING_LENGTH = 200;

/** @type {number} Maximum allowed amount value for activities */
const MAX_AMOUNT = 100000;

/** @type {number} Minimum allowed amount value for activities */
const MIN_AMOUNT = 0;

import { CATEGORIES, EMISSION_FACTORS } from '../core/emission-factors.js';

/**
 * Map of HTML entities that must be escaped for safe text rendering.
 * @type {Object<string, string>}
 * @private
 */
const HTML_ENTITY_MAP = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
});

/**
 * Escapes HTML special characters to prevent XSS.
 * Converts &, <, >, ", and ' to their HTML entity equivalents.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string, or empty string if input is not a string.
 * @example
 * escapeHtml('<script>alert("xss")</script>');
 * // '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(/[&<>"']/g, (char) => HTML_ENTITY_MAP[char] || char);
}

/**
 * Strips all HTML tags from a string.
 * @param {string} str - The string to strip tags from.
 * @returns {string} The string with all HTML tags removed.
 * @private
 */
function stripHtmlTags(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitizes a string input by stripping HTML tags, trimming whitespace,
 * and enforcing a maximum length.
 * @param {string} str - The string to sanitize.
 * @param {number} [maxLength] - Maximum allowed length.
 * @returns {string} The sanitized string.
 * @example
 * sanitizeString('  <b>Hello</b> World  '); // 'Hello World'
 * sanitizeString('x'.repeat(300)); // 200 chars
 */
export function sanitizeString(str, maxLength = MAX_STRING_LENGTH) {
  if (typeof str !== 'string') {
    return '';
  }

  let sanitized = stripHtmlTags(str);
  sanitized = sanitized.replace(/\u0000/g, '');
  sanitized = sanitized.trim();
  // Collapse multiple whitespace to single space
  sanitized = sanitized.replace(/\s+/g, ' ');

  const limit = typeof maxLength === 'number' && maxLength > 0 ? maxLength : MAX_STRING_LENGTH;
  if (sanitized.length > limit) {
    sanitized = sanitized.slice(0, limit);
  }

  return sanitized;
}

/**
 * Sanitizes a numeric value by parsing and clamping to a valid range.
 * Returns null if the value cannot be parsed to a finite number.
 * @param {*} value - The value to sanitize.
 * @param {number} [min] - Minimum allowed value (inclusive).
 * @param {number} [max] - Maximum allowed value (inclusive).
 * @returns {number|null} The clamped number, or null if invalid.
 * @example
 * sanitizeNumber('42.5', 0, 100); // 42.5
 * sanitizeNumber(-5, 0, 100);     // 0
 * sanitizeNumber('abc');           // null
 */
export function sanitizeNumber(value, min = MIN_AMOUNT, max = MAX_AMOUNT) {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    return null;
  }

  const safeMin = typeof min === 'number' && Number.isFinite(min) ? min : MIN_AMOUNT;
  const safeMax = typeof max === 'number' && Number.isFinite(max) ? max : MAX_AMOUNT;

  return Math.min(Math.max(num, safeMin), safeMax);
}

/**
 * Validates whether a string is a valid ISO 8601 date (YYYY-MM-DD).
 * Also checks that the date is a real calendar date (e.g., rejects Feb 30).
 * @param {string} dateString - The date string to validate.
 * @returns {boolean} True if the string is a valid date.
 * @example
 * isValidDate('2024-03-15'); // true
 * isValidDate('2024-02-30'); // false
 * isValidDate('not-a-date'); // false
 */
export function isValidDate(dateString) {
  if (typeof dateString !== 'string') {
    return false;
  }

  // Must match YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }

  // Parse and validate the actual date
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Checks whether a category string is a valid activity category.
 * @param {string} category - The category to validate.
 * @returns {boolean} True if the category is valid.
 * @example
 * isValidCategory('transport'); // true
 * isValidCategory('invalid');   // false
 */
export function isValidCategory(category) {
  if (typeof category !== 'string') {
    return false;
  }
  return CATEGORIES.includes(category);
}

/**
 * Checks whether a type string is valid for a given category.
 * @param {string} category - The activity category.
 * @param {string} type - The activity type to validate.
 * @returns {boolean} True if the type is valid for the given category.
 * @example
 * isValidType('transport', 'car');  // true
 * isValidType('transport', 'lamp'); // false
 */
export function isValidType(category, type) {
  if (typeof category !== 'string' || typeof type !== 'string') {
    return false;
  }

  if (!isValidCategory(category)) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(EMISSION_FACTORS[category], type);
}

/**
 * @typedef {object} ActivityValidationResult
 * @property {boolean} valid - Whether the activity passes validation.
 * @property {string[]} errors - Array of validation error messages.
 * @property {object} [sanitized] - The sanitized activity object (only if valid).
 */

/**
 * Validates and sanitizes a carbon activity entry.
 * Checks category, type, amount, date, and notes. Returns sanitized
 * values suitable for storage.
 * @param {object} activity - The activity object to validate.
 * @returns {ActivityValidationResult} Validation result with errors and sanitized data.
 * @example
 * const result = validateActivity({
 *   category: 'transport',
 *   type: 'car',
 *   amount: 50,
 *   date: '2024-03-15',
 * });
 * if (result.valid) {
 *   store.addActivity(result.sanitized);
 * }
 */
export function validateActivity(activity) {
  const errors = [];

  if (activity === null || typeof activity !== 'object' || Array.isArray(activity)) {
    return { valid: false, errors: ['Activity must be a plain object'] };
  }

  // Validate category
  if (!activity.category) {
    errors.push('Category is required');
  } else if (!isValidCategory(activity.category)) {
    errors.push(`Invalid category: "${sanitizeString(String(activity.category))}". Valid: ${CATEGORIES.join(', ')}`);
  }

  // Validate type
  if (!activity.type) {
    errors.push('Type is required');
  } else if (activity.category && isValidCategory(activity.category) && !isValidType(activity.category, activity.type)) {
    errors.push(
      `Invalid type "${sanitizeString(String(activity.type))}" for category "${activity.category}". ` +
      `Valid: ${Object.keys(EMISSION_FACTORS[activity.category]).join(', ')}`
    );
  }

  // Validate amount
  if (activity.amount === undefined || activity.amount === null || activity.amount === '') {
    errors.push('Amount is required');
  } else {
    const sanitizedAmount = sanitizeNumber(activity.amount);
    if (sanitizedAmount === null) {
      errors.push('Amount must be a valid number');
    } else if (sanitizedAmount <= 0) {
      errors.push('Amount must be greater than zero');
    }
  }

  // Validate date
  if (!activity.date) {
    errors.push('Date is required');
  } else if (!isValidDate(activity.date)) {
    errors.push('Date must be in YYYY-MM-DD format and be a valid calendar date');
  } else {
    // Reject dates too far in the future (allow 1 day tolerance for timezone)
    const activityDate = new Date(activity.date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (activityDate > tomorrow) {
      errors.push('Date cannot be in the future');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Build sanitized activity
  const sanitized = {
    category: activity.category,
    type: activity.type,
    amount: sanitizeNumber(activity.amount),
    date: activity.date,
    unit: typeof activity.unit === 'string' ? sanitizeString(activity.unit, 50) : '',
    description: typeof activity.description === 'string' ? sanitizeString(activity.description) : '',
    notes: typeof activity.notes === 'string' ? sanitizeString(activity.notes) : '',
  };

  // Preserve ID if present, otherwise it will be assigned later
  if (typeof activity.id === 'string' && activity.id.trim().length > 0) {
    sanitized.id = sanitizeString(activity.id, 100);
  }

  // Preserve CO2 value if pre-calculated
  if (typeof activity.co2 === 'number' && Number.isFinite(activity.co2)) {
    sanitized.co2 = sanitizeNumber(activity.co2, 0, 1000000);
  }

  return { valid: true, errors: [], sanitized };
}

/**
 * @typedef {object} GoalValidationResult
 * @property {boolean} valid - Whether the goal passes validation.
 * @property {string[]} errors - Array of validation error messages.
 */

/**
 * Valid goal period values.
 * @type {ReadonlyArray<string>}
 */
const VALID_PERIODS = Object.freeze(['daily', 'weekly', 'monthly', 'yearly']);

/**
 * Validates a user goal object.
 * @param {object} goal - The goal object to validate.
 * @returns {GoalValidationResult} Validation result with errors.
 * @example
 * const result = validateGoal({
 *   name: 'Reduce transport',
 *   targetCO2: 50,
 *   period: 'monthly',
 * });
 */
export function validateGoal(goal) {
  const errors = [];

  if (goal === null || typeof goal !== 'object' || Array.isArray(goal)) {
    return { valid: false, errors: ['Goal must be a plain object'] };
  }

  // Validate name
  if (!goal.name || typeof goal.name !== 'string' || goal.name.trim().length === 0) {
    errors.push('Goal name is required');
  } else if (goal.name.trim().length < 2) {
    errors.push('Goal name must be at least 2 characters');
  } else if (goal.name.length > MAX_STRING_LENGTH) {
    errors.push(`Goal name must be at most ${MAX_STRING_LENGTH} characters`);
  }

  // Validate targetCO2
  if (goal.targetCO2 === undefined || goal.targetCO2 === null) {
    errors.push('Target CO2 value is required');
  } else {
    const target = sanitizeNumber(goal.targetCO2);
    if (target === null) {
      errors.push('Target CO2 must be a valid number');
    } else if (target <= 0) {
      errors.push('Target CO2 must be greater than zero');
    }
  }

  // Validate period
  if (!goal.period) {
    errors.push('Period is required');
  } else if (!VALID_PERIODS.includes(goal.period)) {
    errors.push(`Invalid period: "${sanitizeString(String(goal.period))}". Valid: ${VALID_PERIODS.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

export { VALID_PERIODS };
