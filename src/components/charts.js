/**
 * @module components/charts
 * @description Chart visualization components for CarbonLens. Uses Chart.js
 * loaded dynamically. Provides category doughnut, trend line, and comparison
 * bar charts with dark-theme support and screen-reader fallbacks.
 */

import { createElement } from '../utils/dom.js';
import { formatCO2, formatNumber } from '../utils/format.js';

/**
 * Category color map used across charts.
 * @type {Record<string, string>}
 */
const CATEGORY_COLORS = {
  transportation: '#3b82f6',
  energy: '#f59e0b',
  diet: '#22c55e',
  shopping: '#a855f7',
  waste: '#ef4444',
};

/** @type {string[]} */
const DEFAULT_COLORS = Object.values(CATEGORY_COLORS);

/**
 * Lazily loads Chart.js from the auto-registering entry point.
 * @returns {Promise<typeof import('chart.js/auto').Chart>}
 */
async function loadChartJS() {
  const module = await import('chart.js/auto');
  return module.Chart;
}

/**
 * Adds screen-reader fallback text to a canvas element.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {string} label - Accessible label for the chart.
 * @param {string} description - Longer text description of the chart data.
 */
function applyCanvasA11y(canvas, label, description) {
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);

  // Add a fallback text node inside the canvas for screen readers
  const fallback = createElement('p');
  fallback.textContent = description;
  canvas.appendChild(fallback);
}

/**
 * Renders a doughnut chart showing category breakdown of emissions.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element to render into.
 * @param {Array<{ category: string, value: number, percentage: number }>} breakdown
 *   Array of category breakdown objects from calculateCategoryBreakdown().
 * @returns {Promise<Object>} The Chart.js instance.
 */
export async function renderCategoryChart(canvas, breakdown) {
  const ChartClass = await loadChartJS();

  const labels = breakdown.map((b) => b.category);
  const data = breakdown.map((b) => b.value);
  const total = data.reduce((sum, v) => sum + v, 0);

  const colors = labels.map(
    (label) => CATEGORY_COLORS[label.toLowerCase()] || DEFAULT_COLORS[labels.indexOf(label) % DEFAULT_COLORS.length]
  );

  // Screen reader fallback
  const description = breakdown
    .map((b) => `${b.category}: ${formatCO2(b.value)} (${formatNumber(b.percentage)}%)`)
    .join(', ');
  applyCanvasA11y(canvas, 'Emission breakdown by category', `Category breakdown: ${description}. Total: ${formatCO2(total)}`);

  const chart = new ChartClass(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: colors.map((c) => c),
          borderWidth: 2,
          hoverBorderWidth: 3,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: getTextColor(),
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 12,
            font: { size: 13 },
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              const val = context.parsed;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
              return ` ${context.label}: ${formatCO2(val)} (${pct}%)`;
            },
          },
        },
      },
    },
    plugins: [createCenterTextPlugin(total)],
  });

  return chart;
}

/**
 * Renders a line chart showing emission trends over time.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element to render into.
 * @param {Array<{ date: string, value: number }>} trendData
 *   Array of date/value pairs representing daily emissions.
 * @returns {Promise<Object>} The Chart.js instance.
 */
export async function renderTrendChart(canvas, trendData) {
  const ChartClass = await loadChartJS();

  const labels = trendData.map((d) => d.date);
  const data = trendData.map((d) => d.value);

  // Screen reader fallback
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const avgVal = data.length > 0 ? data.reduce((a, b) => a + b, 0) / data.length : 0;
  applyCanvasA11y(
    canvas,
    'Emissions trend over time',
    `Emissions trend: ${data.length} data points. ` +
      `Min: ${formatCO2(minVal)}, Max: ${formatCO2(maxVal)}, Average: ${formatCO2(avgVal)}.`
  );

  const chart = new ChartClass(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'CO₂e Emissions',
          data,
          borderColor: '#3b82f6',
          backgroundColor: createGradient(canvas, '#3b82f6'),
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      scales: {
        x: {
          grid: { color: getGridColor() },
          ticks: { color: getTextColor(), maxTicksLimit: 10 },
        },
        y: {
          beginAtZero: true,
          grid: { color: getGridColor() },
          ticks: {
            color: getTextColor(),
            callback(value) {
              return formatCO2(/** @type {number} */ (value));
            },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              return items[0]?.label || '';
            },
            label(context) {
              return ` ${formatCO2(context.parsed.y)}`;
            },
          },
        },
      },
    },
  });

  return chart;
}

/**
 * Renders a horizontal bar chart comparing user emissions to averages.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element to render into.
 * @param {Array<{ label: string, userValue: number, averageValue: number }>} comparisons
 *   Array of comparison objects with labels and paired values.
 * @returns {Promise<Object>} The Chart.js instance.
 */
export async function renderComparisonChart(canvas, comparisons) {
  const ChartClass = await loadChartJS();

  const labels = comparisons.map((c) => c.label);
  const userData = comparisons.map((c) => c.userValue);
  const avgData = comparisons.map((c) => c.averageValue);

  const userColors = comparisons.map((c) =>
    c.userValue <= c.averageValue ? '#22c55e' : c.userValue <= c.averageValue * 1.2 ? '#f59e0b' : '#ef4444'
  );

  // Screen reader fallback
  const description = comparisons
    .map(
      (c) =>
        `${c.label}: You ${formatCO2(c.userValue)} vs average ${formatCO2(c.averageValue)} ` +
        `(${c.userValue <= c.averageValue ? 'below' : 'above'} average)`
    )
    .join('. ');
  applyCanvasA11y(canvas, 'Your emissions compared to averages', description);

  const chart = new ChartClass(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Your Emissions',
          data: userData,
          backgroundColor: userColors,
          borderColor: userColors,
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Average',
          data: avgData,
          backgroundColor: 'rgba(148, 163, 184, 0.4)',
          borderColor: 'rgba(148, 163, 184, 0.8)',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: getGridColor() },
          ticks: {
            color: getTextColor(),
            callback(value) {
              return formatCO2(/** @type {number} */ (value));
            },
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: getTextColor() },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: getTextColor(),
            usePointStyle: true,
            padding: 16,
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              return ` ${context.dataset.label}: ${formatCO2(context.parsed.x)}`;
            },
          },
        },
      },
    },
  });

  return chart;
}

/**
 * Safely destroys a Chart.js instance.
 *
 * @param {Object|null|undefined} chartInstance - The Chart.js instance to destroy.
 * @returns {void}
 */
export function destroyChart(chartInstance) {
  if (chartInstance && typeof chartInstance.destroy === 'function') {
    try {
      chartInstance.destroy();
    } catch {
      // Chart already destroyed or canvas removed
    }
  }
}

// --- Internal helpers ---

/**
 * Creates a vertical gradient for line chart fill.
 * @param {HTMLCanvasElement} canvas
 * @param {string} color - Base hex color
 * @returns {CanvasGradient|string} The gradient or fallback color string.
 */
function createGradient(canvas, color) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return color;

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 300);
  gradient.addColorStop(0, hexToRgba(color, 0.3));
  gradient.addColorStop(1, hexToRgba(color, 0.02));
  return gradient;
}

/**
 * Creates a Chart.js plugin that renders total text in the center of a doughnut.
 * @param {number} total - Total value to display.
 * @returns {Object} Chart.js plugin descriptor.
 */
function createCenterTextPlugin(total) {
  return {
    id: 'centerText',
    /**
     * @param {Object} chart
     */
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!ctx || !chartArea) return;

      const centerX = (chartArea.left + chartArea.right) / 2;
      const centerY = (chartArea.top + chartArea.bottom) / 2;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Total value
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillStyle = getTextColor();
      ctx.fillText(formatCO2(total), centerX, centerY - 10);

      // Label
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = getSecondaryTextColor();
      ctx.fillText('Total CO₂e', centerX, centerY + 14);

      ctx.restore();
    },
  };
}

/**
 * Converts a hex color to an rgba string.
 * @param {string} hex - Hex color (e.g., '#3b82f6').
 * @param {number} alpha - Opacity value 0–1.
 * @returns {string} rgba color string.
 */
function hexToRgba(hex, alpha) {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Returns the text color based on current theme.
 * @returns {string}
 */
function getTextColor() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark ? '#e2e8f0' : '#1e293b';
}

/**
 * Returns the secondary text color based on current theme.
 * @returns {string}
 */
function getSecondaryTextColor() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark ? '#94a3b8' : '#64748b';
}

/**
 * Returns the grid line color based on current theme.
 * @returns {string}
 */
function getGridColor() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
}
