/* istanbul ignore file */
/**
 * @module components/insights-panel
 * @description Personalized recommendations panel for CarbonLens. Displays
 * insight cards with impact/ease badges, potential savings, expandable
 * action steps, and filter tabs.
 */

import { createElement, clearElement, announceToScreenReader } from '../utils/dom.js';
import { formatCO2 } from '../utils/format.js';
import { getStore } from '../store/store.js';
import { generateInsights } from '../core/insights.js';
import { calculateTotalEmissions } from '../core/calculator.js';

/**
 * @typedef {'all'|'high-impact'|'easy-wins'} InsightFilter
 */

/**
 * Impact level to badge config mapping.
 * @type {Record<string, { emoji: string, label: string, className: string }>}
 */
const IMPACT_BADGES = {
  high: { emoji: '🔴', label: 'High Impact', className: 'badge--high' },
  medium: { emoji: '🟡', label: 'Medium Impact', className: 'badge--medium' },
  low: { emoji: '🟢', label: 'Low Impact', className: 'badge--low' },
};

/**
 * Ease level to badge config mapping.
 * @type {Record<string, { label: string, className: string }>}
 */
const EASE_BADGES = {
  easy: { label: 'Easy', className: 'badge--easy' },
  moderate: { label: 'Moderate', className: 'badge--moderate' },
  hard: { label: 'Hard', className: 'badge--hard' },
};

/**
 * Renders the insights panel into the given container.
 * @param {HTMLElement} container - The DOM element to render into.
 * @returns {Function} Cleanup function that removes event listeners and subscriptions.
 */
export function renderInsightsPanel(container) {
  const store = getStore();
  const abortController = new AbortController();
  const { signal } = abortController;

  /** @type {Function|null} */
  let unsubscribe = null;

  /** @type {InsightFilter} */
  let activeFilter = 'all';

  /** @type {Set<string>} */
  const expandedInsights = new Set();

  clearElement(container);

  const state = store.getState();
  const activities = state.activities || [];
  const totalEmissions = calculateTotalEmissions(activities);
  const doneInsightIds = new Set(state.doneInsights || []);

  // --- Build page ---
  const page = createElement('section', {
    className: 'insights-panel',
    attributes: { 'aria-label': 'Personalized insights and recommendations' },
  });

  // Header
  const header = createElement('header', { className: 'insights-header' });
  const titleEl = createElement('h1', { className: 'section-title' });
  titleEl.textContent = 'Insights';

  const summaryEl = createElement('p', { className: 'insights-summary' });
  if (activities.length > 0) {
    summaryEl.textContent = `Your total emissions: ${formatCO2(totalEmissions)}. Here are personalized tips to reduce your footprint.`;
  } else {
    summaryEl.textContent = 'Log activities to get personalized insights.';
  }

  header.appendChild(titleEl);
  header.appendChild(summaryEl);
  page.appendChild(header);

  // Filter tabs
  const tabsContainer = createElement('div', {
    className: 'insight-tabs',
    attributes: { role: 'tablist', 'aria-label': 'Filter insights' },
  });

  /** @type {Array<{ id: InsightFilter, label: string }>} */
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'high-impact', label: 'High Impact' },
    { id: 'easy-wins', label: 'Easy Wins' },
  ];

  tabs.forEach((tab) => {
    const tabBtn = createElement('button', {
      className: `tab-btn${activeFilter === tab.id ? ' tab-btn--active' : ''}`,
      attributes: {
        type: 'button',
        role: 'tab',
        'aria-selected': activeFilter === tab.id ? 'true' : 'false',
        'data-filter': tab.id,
      },
    });
    tabBtn.textContent = tab.label;

    tabBtn.addEventListener('click', () => {
      activeFilter = /** @type {InsightFilter} */ (tab.id);
      rerenderContent();
      announceToScreenReader(`Showing ${tab.label} insights`);
    }, { signal });

    tabsContainer.appendChild(tabBtn);
  });

  page.appendChild(tabsContainer);

  // Insights list container
  const listContainer = createElement('div', {
    className: 'insights-list',
    attributes: { role: 'tabpanel', 'aria-live': 'polite' },
  });
  page.appendChild(listContainer);

  container.appendChild(page);

  // --- Render insights ---

  /**
   * Re-renders the insight list and filter tab active state.
   */
  function rerenderContent() {
    // Update tab active states
    const tabBtns = tabsContainer.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      const filter = btn.getAttribute('data-filter');
      const isActive = filter === activeFilter;
      btn.classList.toggle('tab-btn--active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });

    renderInsightsList();
  }

  /**
   * Renders the filtered list of insight cards.
   */
  function renderInsightsList() {
    clearElement(listContainer);

    if (activities.length === 0) {
      renderEmptyState();
      return;
    }

    let insights;
    try {
      insights = generateInsights(store.getState());
    } catch {
      insights = [];
    }

    if (!Array.isArray(insights) || insights.length === 0) {
      renderEmptyState();
      return;
    }

    // Filter
    let filtered = insights;
    if (activeFilter === 'high-impact') {
      filtered = insights.filter((i) => i.impact === 'high');
    } else if (activeFilter === 'easy-wins') {
      filtered = insights.filter((i) => i.ease === 'easy');
    }

    // Exclude done insights unless in "all" filter
    filtered = filtered.filter((i) => !doneInsightIds.has(i.id));

    if (filtered.length === 0) {
      const noResults = createElement('p', { className: 'empty-state-text' });
      noResults.textContent = activeFilter === 'all'
        ? 'You\'ve completed all insights! Great job!'
        : `No ${activeFilter === 'high-impact' ? 'high impact' : 'easy win'} insights available.`;
      listContainer.appendChild(noResults);
      return;
    }

    filtered.forEach((insight) => {
      const card = createInsightCard(insight);
      listContainer.appendChild(card);
    });
  }

  /**
   * Creates a single insight card DOM element.
   * @param {object} insight - The insight data object.
   * @param {string} insight.id - Unique identifier.
   * @param {string} insight.title - Insight title.
   * @param {string} insight.description - Insight description.
   * @param {string} insight.impact - Impact level: 'high', 'medium', 'low'.
   * @param {string} insight.ease - Ease level: 'easy', 'moderate', 'hard'.
   * @param {number} [insight.savings] - Potential CO₂e savings in kg.
   * @param {string[]} [insight.actions] - List of action step strings.
   * @returns {HTMLElement} The insight card element.
   */
  function createInsightCard(insight) {
    const card = createElement('div', { className: 'insight-card card' });

    // Header row with title and badges
    const cardHeader = createElement('div', { className: 'insight-card-header' });
    const cardTitle = createElement('h3', { className: 'insight-card-title' });
    cardTitle.textContent = insight.title || 'Tip';

    const badges = createElement('div', { className: 'insight-badges' });

    // Impact badge
    const impactConfig = IMPACT_BADGES[insight.impact] || IMPACT_BADGES.medium;
    const impactBadge = createElement('span', {
      className: `badge ${impactConfig.className}`,
      attributes: { 'aria-label': impactConfig.label },
    });
    impactBadge.textContent = `${impactConfig.emoji} ${impactConfig.label}`;

    // Ease badge
    const easeConfig = EASE_BADGES[insight.ease] || EASE_BADGES.moderate;
    const easeBadge = createElement('span', {
      className: `badge ${easeConfig.className}`,
    });
    easeBadge.textContent = easeConfig.label;

    badges.appendChild(impactBadge);
    badges.appendChild(easeBadge);

    cardHeader.appendChild(cardTitle);
    cardHeader.appendChild(badges);
    card.appendChild(cardHeader);

    // Description
    const desc = createElement('p', { className: 'insight-card-description' });
    desc.textContent = insight.description || '';
    card.appendChild(desc);

    // Savings
    if (insight.savings && insight.savings > 0) {
      const savingsEl = createElement('p', { className: 'insight-card-savings' });
      const savingsLabel = createElement('span', { className: 'savings-label' });
      savingsLabel.textContent = 'Potential savings: ';
      const savingsValue = createElement('strong', { className: 'savings-value' });
      savingsValue.textContent = `${formatCO2(insight.savings)}/year`;
      savingsEl.appendChild(savingsLabel);
      savingsEl.appendChild(savingsValue);
      card.appendChild(savingsEl);
    }

    // Expandable action steps
    if (insight.actions && insight.actions.length > 0) {
      const isExpanded = expandedInsights.has(insight.id);
      const expandBtn = createElement('button', {
        className: 'btn btn--link expand-btn',
        attributes: {
          type: 'button',
          'aria-expanded': String(isExpanded),
          'aria-label': `${isExpanded ? 'Collapse' : 'Expand'} action steps for ${insight.title}`,
        },
      });
      expandBtn.textContent = isExpanded ? '▾ Hide action steps' : '▸ Show action steps';

      const actionsList = createElement('ol', {
        className: `insight-actions-list${isExpanded ? '' : ' insight-actions-list--hidden'}`,
        attributes: { 'aria-label': 'Action steps' },
      });

      insight.actions.forEach((action) => {
        const li = createElement('li', { className: 'insight-action-item' });
        li.textContent = action;
        actionsList.appendChild(li);
      });

      expandBtn.addEventListener('click', () => {
        const nowExpanded = expandedInsights.has(insight.id);
        if (nowExpanded) {
          expandedInsights.delete(insight.id);
        } else {
          expandedInsights.add(insight.id);
        }
        const toggledState = !nowExpanded;
        expandBtn.setAttribute('aria-expanded', String(toggledState));
        expandBtn.textContent = toggledState ? '▾ Hide action steps' : '▸ Show action steps';
        expandBtn.setAttribute(
          'aria-label',
          `${toggledState ? 'Collapse' : 'Expand'} action steps for ${insight.title}`
        );
        actionsList.classList.toggle('insight-actions-list--hidden', !toggledState);
      }, { signal });

      card.appendChild(expandBtn);
      card.appendChild(actionsList);
    }

    // Mark as done button
    const doneBtn = createElement('button', {
      className: 'btn btn--secondary btn--sm mark-done-btn',
      attributes: {
        type: 'button',
        'aria-label': `Mark "${insight.title}" as done`,
      },
    });
    doneBtn.textContent = '✓ Mark as done';

    doneBtn.addEventListener('click', () => {
      doneInsightIds.add(insight.id);
      const currentState = store.getState();
      store.setState({ doneInsights: [...(currentState.doneInsights || []), insight.id] });
      announceToScreenReader(`"${insight.title}" marked as done`);
      renderInsightsList();
    }, { signal });

    card.appendChild(doneBtn);

    return card;
  }

  /**
   * Renders empty state when no activities are logged.
   */
  function renderEmptyState() {
    const empty = createElement('div', { className: 'empty-state' });

    const emptyIcon = createElement('span', {
      className: 'empty-state-icon',
      attributes: { 'aria-hidden': 'true' },
    });
    emptyIcon.textContent = '💡';

    const emptyTitle = createElement('h2', { className: 'empty-state-title' });
    emptyTitle.textContent = 'No insights yet';

    const emptyText = createElement('p', { className: 'empty-state-text' });
    emptyText.textContent = 'Log some activities first, and we\'ll provide personalized recommendations to reduce your carbon footprint.';

    const ctaBtn = createElement('button', {
      className: 'btn btn--primary',
      attributes: { type: 'button', 'aria-label': 'Start logging activities' },
    });
    ctaBtn.textContent = '📊 Log Activity';
    ctaBtn.addEventListener('click', () => {
      store.setState({ route: 'calculator' });
    }, { signal });

    empty.appendChild(emptyIcon);
    empty.appendChild(emptyTitle);
    empty.appendChild(emptyText);
    empty.appendChild(ctaBtn);
    listContainer.appendChild(empty);
  }

  // --- Initial render ---
  renderInsightsList();

  // --- Store subscription ---
  unsubscribe = store.subscribe(() => {
    rerenderContent();
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

