/**
 * @module components/dashboard
 * @description Main dashboard view for CarbonLens — the hero page. Displays
 * stat cards, charts (category + trend), recent activity, quick actions,
 * and a comparison banner.
 */

import { createElement, clearElement, announceToScreenReader } from '../utils/dom.js';
import { formatCO2, formatNumber, formatDate, formatRelativeDate, formatPercentage, formatTrend } from '../utils/format.js';
import { getStore } from '../store/store.js';
import { calculateTotalEmissions, calculateCategoryBreakdown } from '../core/calculator.js';
import { compareToAverages } from '../core/comparisons.js';
import { renderCategoryChart, renderTrendChart, destroyChart } from './charts.js';
import { prefersReducedMotion } from '../utils/a11y.js';

/** @type {Record<string, string>} */
const CATEGORY_ICONS = {
  transportation: '🚗',
  energy: '⚡',
  diet: '🍽️',
  shopping: '🛍️',
  waste: '🗑️',
};

/**
 * Renders the main dashboard into the given container.
 * @param {HTMLElement} container - The DOM element to render dashboard into.
 * @returns {Function} Cleanup function that removes event listeners, subscriptions, and chart instances.
 */
export function renderDashboard(container) {
  const store = getStore();
  const abortController = new AbortController();
  const { signal } = abortController;

  /** @type {Function|null} */
  let unsubscribe = null;

  /** @type {object | null} */
  let categoryChart = null;

  /** @type {object | null} */
  let trendChart = null;

  clearElement(container);

  const state = store.getState();
  const activities = state.activities || [];
  const goals = state.goals || [];

  // --- Compute data ---
  const totalEmissions = calculateTotalEmissions(activities);
  const breakdown = calculateCategoryBreakdown(activities);
  const comparisons = computeComparisons(totalEmissions);
  const trendData = computeTrendData(activities, 30);
  const recentActivities = activities.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const streak = computeStreak(activities);
  const activeGoals = goals.filter((g) => g.status !== 'completed');
  const previousTotal = computePreviousPeriodTotal(activities);
  const trend = previousTotal > 0 ? ((totalEmissions - previousTotal) / previousTotal) * 100 : 0;

  // Top category
  const topCategory = breakdown.length > 0
    ? breakdown.reduce((max, b) => (b.value > max.value ? b : max), breakdown[0])
    : null;

  // Nearest deadline
  const nearestGoal = activeGoals
    .filter((g) => g.deadline)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0] || null;

  // --- Build page ---
  const page = createElement('div', { className: 'dashboard' });

  // Page header
  const header = createElement('header', { className: 'dashboard-header' });
  const headerTitle = createElement('h1', { className: 'dashboard-title' });
  headerTitle.textContent = 'Dashboard';
  const headerSubtitle = createElement('p', { className: 'dashboard-subtitle' });
  headerSubtitle.textContent = 'Your carbon footprint at a glance';
  header.appendChild(headerTitle);
  header.appendChild(headerSubtitle);
  page.appendChild(header);

  // --- Stat cards grid ---
  const statsGrid = createElement('div', { className: 'stats-grid' });

  // 1. Total Footprint
  const totalCard = createStatCard({
    title: 'Total Footprint',
    value: formatCO2(totalEmissions),
    detail: formatTrend(trend),
    detailClass: trend <= 0 ? 'trend--positive' : 'trend--negative',
    icon: '🌍',
  });

  // 2. Top Category
  const topCatCard = createStatCard({
    title: 'Top Category',
    value: topCategory ? topCategory.category : 'N/A',
    detail: topCategory ? `${formatPercentage(topCategory.percentage)} of total` : 'No data yet',
    detailClass: '',
    icon: topCategory ? (CATEGORY_ICONS[topCategory.category.toLowerCase()] || '📊') : '📊',
  });

  // 3. Active Goals
  const goalsCard = createStatCard({
    title: 'Active Goals',
    value: String(activeGoals.length),
    detail: nearestGoal ? `Next deadline: ${formatDate(nearestGoal.deadline)}` : 'No deadlines set',
    detailClass: '',
    icon: '🎯',
  });

  // 4. Streak
  const streakCard = createStatCard({
    title: 'Logging Streak',
    value: `${streak} day${streak !== 1 ? 's' : ''}`,
    detail: streak > 0 ? 'Keep it up!' : 'Log today to start',
    detailClass: streak > 0 ? 'trend--positive' : '',
    icon: '🔥',
  });

  statsGrid.appendChild(totalCard);
  statsGrid.appendChild(topCatCard);
  statsGrid.appendChild(goalsCard);
  statsGrid.appendChild(streakCard);
  page.appendChild(statsGrid);

  // Animate numbers if motion not reduced
  if (!prefersReducedMotion()) {
    animateCountUp(totalCard.querySelector('.stat-card-value'), totalEmissions, (v) => formatCO2(v));
    animateCountUp(streakCard.querySelector('.stat-card-value'), streak, (v) => `${Math.round(v)} day${Math.round(v) !== 1 ? 's' : ''}`);
  }

  // --- Charts section ---
  const chartsSection = createElement('section', {
    className: 'dashboard-charts',
    attributes: { 'aria-label': 'Emission charts' },
  });

  const chartsGrid = createElement('div', { className: 'charts-grid' });

  // Category chart
  const categoryCard = createElement('div', { className: 'card chart-container' });
  const categoryTitle = createElement('h2', { className: 'card-title' });
  categoryTitle.textContent = 'Category Breakdown';
  const categoryCanvas = createElement('canvas', {
    attributes: { 'aria-label': 'Category breakdown doughnut chart' },
  });
  categoryCard.appendChild(categoryTitle);

  if (breakdown.length > 0) {
    categoryCard.appendChild(categoryCanvas);
    // Lazy-load chart
    loadCategoryChart(categoryCanvas, breakdown);
  } else {
    const emptyChart = createElement('p', { className: 'empty-state-text' });
    emptyChart.textContent = 'Log activities to see your breakdown';
    categoryCard.appendChild(emptyChart);
  }

  // Trend chart
  const trendCard = createElement('div', { className: 'card chart-container' });
  const trendTitle = createElement('h2', { className: 'card-title' });
  trendTitle.textContent = 'Emissions Trend (30 days)';
  const trendCanvas = createElement('canvas', {
    attributes: { 'aria-label': 'Emissions trend line chart' },
  });
  trendCard.appendChild(trendTitle);

  if (trendData.length > 0) {
    trendCard.appendChild(trendCanvas);
    loadTrendChart(trendCanvas, trendData);
  } else {
    const emptyTrend = createElement('p', { className: 'empty-state-text' });
    emptyTrend.textContent = 'Log activities over time to see trends';
    trendCard.appendChild(emptyTrend);
  }

  chartsGrid.appendChild(categoryCard);
  chartsGrid.appendChild(trendCard);
  chartsSection.appendChild(chartsGrid);
  page.appendChild(chartsSection);

  // --- Comparison banner ---
  const comparisonSection = createElement('section', {
    className: 'comparison-banner',
    attributes: { 'aria-label': 'Comparison to averages' },
  });
  const compBannerContent = createElement('div', { className: 'comparison-banner-content' });

  if (comparisons && comparisons.length > 0) {
    const comp = comparisons[0];
    const isBelow = comp.userValue <= comp.averageValue;
    const pctDiff = comp.averageValue > 0
      ? Math.abs(((comp.userValue - comp.averageValue) / comp.averageValue) * 100).toFixed(0)
      : 0;

    const bannerIcon = createElement('span', { className: 'comparison-icon', attributes: { 'aria-hidden': 'true' } });
    bannerIcon.textContent = isBelow ? '🎉' : '💪';
    const bannerText = createElement('p', { className: 'comparison-text' });
    bannerText.textContent = isBelow
      ? `Great! Your footprint is ${pctDiff}% below the average. Keep going!`
      : `Your footprint is ${pctDiff}% above the average. Small changes make a big difference!`;

    compBannerContent.appendChild(bannerIcon);
    compBannerContent.appendChild(bannerText);
  } else {
    const bannerText = createElement('p', { className: 'comparison-text' });
    bannerText.textContent = 'Log activities to see how you compare to averages.';
    compBannerContent.appendChild(bannerText);
  }

  comparisonSection.appendChild(compBannerContent);
  page.appendChild(comparisonSection);

  // --- Recent Activity section ---
  const recentSection = createElement('section', {
    className: 'dashboard-recent',
    attributes: { 'aria-label': 'Recent activity' },
  });

  const recentHeader = createElement('div', { className: 'section-header' });
  const recentTitle = createElement('h2', { className: 'section-title' });
  recentTitle.textContent = 'Recent Activity';
  recentHeader.appendChild(recentTitle);

  if (activities.length > 5) {
    const viewAllBtn = createElement('button', {
      className: 'btn btn--link',
      attributes: { type: 'button', 'aria-label': 'View all activities' },
    });
    viewAllBtn.textContent = 'View all →';
    viewAllBtn.addEventListener('click', () => {
      store.setState({ route: 'activity-log' });
    }, { signal });
    recentHeader.appendChild(viewAllBtn);
  }

  recentSection.appendChild(recentHeader);

  if (recentActivities.length > 0) {
    const actList = createElement('ul', {
      className: 'recent-activity-list',
      attributes: { role: 'list' },
    });

    recentActivities.forEach((activity) => {
      const item = createElement('li', { className: 'recent-activity-item' });

      const icon = createElement('span', {
        className: 'activity-icon',
        attributes: { 'aria-hidden': 'true' },
      });
      icon.textContent = CATEGORY_ICONS[activity.category] || '📊';

      const info = createElement('div', { className: 'activity-info' });
      const actName = createElement('span', { className: 'activity-name' });
      actName.textContent = [activity.type, activity.subtype].filter(Boolean).join(' — ');

      const actDetails = createElement('span', { className: 'activity-details' });
      actDetails.textContent = `${formatNumber(activity.amount)} ${activity.unit || ''}`;

      info.appendChild(actName);
      info.appendChild(actDetails);

      const meta = createElement('div', { className: 'activity-meta' });
      const actCO2 = createElement('span', { className: 'activity-co2' });
      actCO2.textContent = formatCO2(activity.co2e);

      const actDate = createElement('span', { className: 'activity-date' });
      actDate.textContent = formatRelativeDate(activity.date);

      meta.appendChild(actCO2);
      meta.appendChild(actDate);

      item.appendChild(icon);
      item.appendChild(info);
      item.appendChild(meta);
      actList.appendChild(item);
    });

    recentSection.appendChild(actList);
  } else {
    const emptyState = createElement('div', { className: 'empty-state' });
    const emptyIcon = createElement('span', { className: 'empty-state-icon', attributes: { 'aria-hidden': 'true' } });
    emptyIcon.textContent = '📋';
    const emptyText = createElement('p', { className: 'empty-state-text' });
    emptyText.textContent = 'No activities logged yet. Start tracking your footprint!';
    emptyState.appendChild(emptyIcon);
    emptyState.appendChild(emptyText);
    recentSection.appendChild(emptyState);
  }

  page.appendChild(recentSection);

  // --- Quick actions ---
  const actionsSection = createElement('section', {
    className: 'dashboard-actions',
    attributes: { 'aria-label': 'Quick actions' },
  });

  const logBtn = createElement('button', {
    className: 'btn btn--primary btn--lg',
    attributes: { type: 'button', 'aria-label': 'Log a new activity' },
  });
  logBtn.textContent = '📊 Log Activity';
  logBtn.addEventListener('click', () => {
    store.setState({ route: 'calculator' });
  }, { signal });

  const goalBtn = createElement('button', {
    className: 'btn btn--secondary btn--lg',
    attributes: { type: 'button', 'aria-label': 'Set a new goal' },
  });
  goalBtn.textContent = '🎯 Set Goal';
  goalBtn.addEventListener('click', () => {
    store.setState({ route: 'goals' });
  }, { signal });

  actionsSection.appendChild(logBtn);
  actionsSection.appendChild(goalBtn);
  page.appendChild(actionsSection);

  container.appendChild(page);

  /**
   * Loads category doughnut chart asynchronously.
   * @param {HTMLCanvasElement} canvas
   * @param {Array} data
   */
  async function loadCategoryChart(canvas, data) {
    try {
      categoryChart = await renderCategoryChart(canvas, data);
    } catch (err) {
      const errMsg = createElement('p', { className: 'chart-error' });
      errMsg.textContent = 'Unable to load chart';
      canvas.parentElement?.appendChild(errMsg);
    }
  }

  /**
   * Loads trend line chart asynchronously.
   * @param {HTMLCanvasElement} canvas
   * @param {Array} data
   */
  async function loadTrendChart(canvas, data) {
    try {
      trendChart = await renderTrendChart(canvas, data);
    } catch (err) {
      const errMsg = createElement('p', { className: 'chart-error' });
      errMsg.textContent = 'Unable to load chart';
      canvas.parentElement?.appendChild(errMsg);
    }
  }

  // --- Store subscription for live updates ---
  unsubscribe = store.subscribe(() => {
    // Re-render dashboard on state change
    cleanup();
    renderDashboard(container);
  });

  // --- Cleanup ---
  /** @type {boolean} */
  let cleanedUp = false;

  /**
   * Removes event listeners, chart instances, and store subscriptions.
   */
  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    abortController.abort();
    destroyChart(categoryChart);
    destroyChart(trendChart);
    categoryChart = null;
    trendChart = null;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return cleanup;
}

// --- Helper functions ---

/**
 * Animates a DOM element's text from 0 up to a target value.
 * @param {HTMLElement|null} el - The element whose textContent to animate.
 * @param {number} target - Target numeric value.
 * @param {Function} formatter - Formatting function to apply to the current value.
 */
function animateCountUp(el, target, formatter) {
  if (!el || target <= 0) return;

  const duration = 800;
  const start = performance.now();

  /**
   * @param {number} now
   */
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = target * eased;
    el.textContent = formatter(current);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = formatter(target);
    }
  }

  requestAnimationFrame(step);
}

/**
 * Creates a stat card DOM element.
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.value
 * @param {string} options.detail
 * @param {string} options.detailClass
 * @param {string} options.icon
 * @returns {HTMLElement}
 */
function createStatCard({ title, value, detail, detailClass, icon }) {
  const card = createElement('div', { className: 'stat-card card' });

  const cardHeader = createElement('div', { className: 'stat-card-header' });
  const cardIcon = createElement('span', {
    className: 'stat-card-icon',
    attributes: { 'aria-hidden': 'true' },
  });
  cardIcon.textContent = icon;
  const cardTitle = createElement('h3', { className: 'stat-card-title' });
  cardTitle.textContent = title;
  cardHeader.appendChild(cardIcon);
  cardHeader.appendChild(cardTitle);

  const cardValue = createElement('p', { className: 'stat-card-value' });
  cardValue.textContent = value;

  const cardDetail = createElement('p', {
    className: `stat-card-detail ${detailClass}`.trim(),
  });
  cardDetail.textContent = detail;

  card.appendChild(cardHeader);
  card.appendChild(cardValue);
  card.appendChild(cardDetail);

  return card;
}

/**
 * Computes the trend data (daily totals) for the last N days.
 * @param {Array} activities
 * @param {number} days
 * @returns {Array<{ date: string, value: number }>}
 */
function computeTrendData(activities, days) {
  const now = new Date();
  /** @type {Map<string, number>} */
  const dateMap = new Map();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dateMap.set(key, 0);
  }

  activities.forEach((act) => {
    if (!act.date) return;
    const key = new Date(act.date).toISOString().split('T')[0];
    if (dateMap.has(key)) {
      dateMap.set(key, dateMap.get(key) + (act.co2e || 0));
    }
  });

  return Array.from(dateMap.entries()).map(([date, value]) => ({ date, value }));
}

/**
 * Computes consecutive days of logging ending today.
 * @param {Array} activities
 * @returns {number}
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
 * Computes total emissions for the previous period (same duration ending before current period).
 * @param {Array} activities
 * @returns {number}
 */
function computePreviousPeriodTotal(activities) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  return activities
    .filter((a) => {
      if (!a.date) return false;
      const d = new Date(a.date);
      return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    })
    .reduce((sum, a) => sum + (a.co2e || 0), 0);
}

/**
 * Computes comparison data to averages.
 * @param {number} totalEmissions
 * @returns {Array<{ label: string, userValue: number, averageValue: number }>}
 */
function computeComparisons(totalEmissions) {
  try {
    const result = compareToAverages(totalEmissions);
    if (Array.isArray(result)) return result;
    // If compareToAverages returns an object, convert it
    if (result && typeof result === 'object') {
      return Object.entries(result).map(([label, data]) => ({
        label,
        userValue: totalEmissions,
        averageValue: typeof data === 'number' ? data : (data.average || 0),
      }));
    }
    return [];
  } catch {
    return [];
  }
}
