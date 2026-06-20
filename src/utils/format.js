/**
 * Formatting utilities for CarbonLens.
 * Provides locale-aware formatting for CO2 values, numbers, dates,
 * percentages, and trend indicators.
 * @module format
 */

/**
 * Threshold in kg at which CO2 values display in tons instead of kg.
 * @type {number}
 * @private
 */
const TONS_THRESHOLD = 1000;

/**
 * Formats a CO2 value in kilograms, auto-scaling to tons when appropriate.
 * @param {number} kgValue - The CO2 value in kilograms.
 * @returns {string} Formatted string, e.g., '1.2 kg' or '1.2 tons'.
 * @example
 * formatCO2(0.5);    // '0.50 kg'
 * formatCO2(1234);   // '1.23 tons'
 * formatCO2(0);      // '0.00 kg'
 */
export function formatCO2(kgValue) {
  const value = typeof kgValue === 'number' && Number.isFinite(kgValue) ? kgValue : 0;
  const absValue = Math.abs(value);

  if (absValue >= TONS_THRESHOLD) {
    const tons = value / TONS_THRESHOLD;
    return `${formatNumber(tons, 2)} tons CO₂e`;
  }

  return `${formatNumber(value, 2)} kg CO₂e`;
}

/**
 * Formats a number with locale-aware formatting and fixed decimal places.
 * @param {number} value - The number to format.
 * @param {number} [decimals] - Number of decimal places.
 * @returns {string} Locale-formatted number string.
 * @example
 * formatNumber(1234.5678, 2); // '1,234.57' (en-US)
 * formatNumber(0.1, 1);       // '0.1'
 */
export function formatNumber(value, decimals = 2) {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const dec = typeof decimals === 'number' && Number.isFinite(decimals) && decimals >= 0
    ? Math.round(decimals)
    : 2;

  try {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }).format(num);
  } catch {
    // Fallback if Intl is unavailable
    return num.toFixed(dec);
  }
}

/**
 * Formats an ISO date string to a locale-aware display date.
 * @param {string} dateString - ISO 8601 date string (e.g., '2024-03-15').
 * @returns {string} Locale-formatted date, or 'Invalid date' on error.
 * @example
 * formatDate('2024-03-15'); // 'Mar 15, 2024' (en-US) or locale equivalent
 */
export function formatDate(dateString) {
  if (typeof dateString !== 'string') {
    return 'Invalid date';
  }

  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return 'Invalid date';
    }

    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return 'Invalid date';
  }
}

/**
 * Formats a date as a relative human-readable string.
 * Returns 'today', 'yesterday', or 'N days ago' for recent dates,
 * falling back to locale-aware absolute date for older ones.
 * @param {string} dateString - ISO 8601 date string.
 * @returns {string} Relative date string.
 * @example
 * formatRelativeDate('2024-03-15'); // 'today' (if today is March 15)
 * formatRelativeDate('2024-03-14'); // 'yesterday'
 * formatRelativeDate('2024-03-12'); // '3 days ago'
 * formatRelativeDate('2024-01-01'); // 'Jan 1, 2024' (if > 30 days ago)
 */
export function formatRelativeDate(dateString) {
  if (typeof dateString !== 'string') {
    return 'Invalid date';
  }

  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const now = new Date();
    // Strip time components for day comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffMs = today.getTime() - target.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'today';
    }
    if (diffDays === 1) {
      return 'yesterday';
    }
    if (diffDays === -1) {
      return 'tomorrow';
    }
    if (diffDays > 1 && diffDays <= 30) {
      return `${diffDays} days ago`;
    }
    if (diffDays < -1 && diffDays >= -30) {
      return `in ${Math.abs(diffDays)} days`;
    }

    // Fall back to formatted date for anything beyond 30 days
    return formatDate(dateString);
  } catch {
    return 'Invalid date';
  }
}

/**
 * Formats a numeric value as a percentage string.
 * @param {number} value - The value to format (0-100 scale, or 0-1 scale auto-detected).
 * @param {number} [decimals] - Number of decimal places.
 * @returns {string} Formatted percentage, e.g., '45.2%'.
 * @example
 * formatPercentage(45.23);   // '45.2%'
 * formatPercentage(0.452);   // '45.2%' (auto-detected 0-1 scale)
 * formatPercentage(100, 0);  // '100%'
 */
export function formatPercentage(value, decimals = 1) {
  let num = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const dec = typeof decimals === 'number' && Number.isFinite(decimals) && decimals >= 0
    ? Math.round(decimals)
    : 1;

  // Auto-detect 0-1 scale: if value is between -1 and 1 (exclusive),
  // treat it as a fraction unless it's exactly 0
  if (num !== 0 && num > -1 && num < 1) {
    num = num * 100;
  }

  return `${num.toFixed(dec)}%`;
}

/**
 * Formats a numeric trend value with a directional indicator.
 * Positive values show an up arrow, negative values a down arrow.
 * Zero shows a horizontal dash.
 * @param {number} value - The trend percentage value.
 * @returns {string} Formatted trend, e.g., '↑ 12.3%' or '↓ 5.1%'.
 * @example
 * formatTrend(12.34);  // '↑ 12.3%'
 * formatTrend(-5.1);   // '↓ 5.1%'
 * formatTrend(0);      // '— 0.0%'
 */
export function formatTrend(value) {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;

  if (num > 0) {
    return `↑ ${num.toFixed(1)}%`;
  }
  if (num < 0) {
    return `↓ ${Math.abs(num).toFixed(1)}%`;
  }
  return `— 0.0%`;
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} str - The string to capitalize.
 * @returns {string} The capitalized string, or empty string if input is invalid.
 * @example
 * capitalize('hello');   // 'Hello'
 * capitalize('WORLD');   // 'WORLD'
 * capitalize('');        // ''
 */
export function capitalize(str) {
  if (typeof str !== 'string' || str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}
