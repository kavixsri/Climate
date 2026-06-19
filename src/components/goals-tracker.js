/**
 * @module components/goals-tracker
 * @description Goal setting and progress tracking component for CarbonLens.
 * Supports creating goals with reduction targets and deadlines, displays
 * progress bars with milestones, and manages completed goals.
 */

import { createElement, clearElement, announceToScreenReader } from '../utils/dom.js';
import { formatCO2, formatNumber, formatDate, formatPercentage } from '../utils/format.js';
import { getStore } from '../store/store.js';
import { createGoal, updateGoalProgress, getGoalStatus } from '../core/goals.js';
import { validateGoal, sanitizeString, sanitizeNumber } from '../utils/validation.js';
import { generateId } from '../utils/crypto.js';
import { openModal, closeModal } from './modal.js';

/** Milestone thresholds. */
const MILESTONES = [25, 50, 75, 100];

/**
 * Status badge configuration.
 * @type {Record<string, { label: string, className: string }>}
 */
const STATUS_CONFIG = {
  'on-track': { label: 'On Track', className: 'status-badge--on-track' },
  behind: { label: 'Behind', className: 'status-badge--behind' },
  ahead: { label: 'Ahead', className: 'status-badge--ahead' },
  completed: { label: 'Completed', className: 'status-badge--completed' },
};

/**
 * Renders the goals tracker into the given container.
 *
 * @param {HTMLElement} container - The DOM element to render into.
 * @returns {Function} Cleanup function that removes all event listeners and subscriptions.
 */
export function renderGoalsTracker(container) {
  const store = getStore();
  const abortController = new AbortController();
  const { signal } = abortController;

  /** @type {Function|null} */
  let unsubscribe = null;

  /** @type {boolean} */
  let showCompleted = false;

  /** @type {boolean} */
  let showCreateForm = false;

  clearElement(container);

  const page = createElement('div', { className: 'goals-tracker' });

  // Header
  const header = createElement('header', { className: 'goals-header' });
  const titleEl = createElement('h1', { className: 'section-title' });
  titleEl.textContent = 'Goals';

  const createBtn = createElement('button', {
    className: 'btn btn--primary',
    attributes: { type: 'button', 'aria-label': 'Create a new goal' },
  });
  createBtn.textContent = '+ New Goal';

  const headerRow = createElement('div', { className: 'section-header' });
  headerRow.appendChild(titleEl);
  headerRow.appendChild(createBtn);
  header.appendChild(headerRow);
  page.appendChild(header);

  // Create form placeholder
  const formContainer = createElement('div', {
    className: 'goal-form-container',
    attributes: { 'aria-live': 'polite' },
  });
  page.appendChild(formContainer);

  // Active goals section
  const activeSection = createElement('section', {
    className: 'goals-active-section',
    attributes: { 'aria-label': 'Active goals' },
  });
  page.appendChild(activeSection);

  // Completed goals section
  const completedSection = createElement('section', {
    className: 'goals-completed-section',
    attributes: { 'aria-label': 'Completed goals' },
  });
  page.appendChild(completedSection);

  container.appendChild(page);

  // --- Event listeners ---
  createBtn.addEventListener('click', () => {
    showCreateForm = !showCreateForm;
    renderForm();
  }, { signal });

  // --- Render functions ---

  /**
   * Renders the inline goal creation form.
   */
  function renderForm() {
    clearElement(formContainer);

    if (!showCreateForm) return;

    const form = createElement('div', { className: 'goal-form card' });
    const formTitle = createElement('h2', { className: 'goal-form-title' });
    formTitle.textContent = 'Create New Goal';

    // Name
    const nameGroup = createElement('div', { className: 'form-group' });
    const nameLabel = createElement('label', {
      className: 'form-label',
      attributes: { for: 'goal-name' },
    });
    nameLabel.textContent = 'Goal Name';
    const nameInput = createElement('input', {
      className: 'form-input',
      attributes: {
        type: 'text',
        id: 'goal-name',
        placeholder: 'e.g., Reduce transportation emissions',
        maxlength: '100',
        'aria-label': 'Goal name',
      },
    });
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);

    // Target reduction %
    const targetGroup = createElement('div', { className: 'form-group' });
    const targetLabel = createElement('label', {
      className: 'form-label',
      attributes: { for: 'goal-target' },
    });
    targetLabel.textContent = 'Target Reduction (%)';
    const targetInput = createElement('input', {
      className: 'form-input',
      attributes: {
        type: 'number',
        id: 'goal-target',
        min: '1',
        max: '100',
        placeholder: '10',
        'aria-label': 'Target reduction percentage',
      },
    });
    targetGroup.appendChild(targetLabel);
    targetGroup.appendChild(targetInput);

    // Deadline
    const deadlineGroup = createElement('div', { className: 'form-group' });
    const deadlineLabel = createElement('label', {
      className: 'form-label',
      attributes: { for: 'goal-deadline' },
    });
    deadlineLabel.textContent = 'Deadline';
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 1);
    const deadlineInput = createElement('input', {
      className: 'form-input',
      attributes: {
        type: 'date',
        id: 'goal-deadline',
        min: minDate.toISOString().split('T')[0],
        'aria-label': 'Goal deadline',
      },
    });
    deadlineGroup.appendChild(deadlineLabel);
    deadlineGroup.appendChild(deadlineInput);

    // Category (optional)
    const categoryGroup = createElement('div', { className: 'form-group' });
    const categoryLabel = createElement('label', {
      className: 'form-label',
      attributes: { for: 'goal-category' },
    });
    categoryLabel.textContent = 'Category (optional)';
    const categorySelect = createElement('select', {
      className: 'form-input',
      attributes: { id: 'goal-category', 'aria-label': 'Goal category filter' },
    });
    const allOpt = createElement('option', { attributes: { value: '' } });
    allOpt.textContent = 'All categories';
    categorySelect.appendChild(allOpt);

    ['transportation', 'energy', 'diet', 'shopping', 'waste'].forEach((cat) => {
      const opt = createElement('option', { attributes: { value: cat } });
      opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      categorySelect.appendChild(opt);
    });
    categoryGroup.appendChild(categoryLabel);
    categoryGroup.appendChild(categorySelect);

    // Error
    const errorEl = createElement('p', {
      className: 'form-error',
      attributes: { role: 'alert', 'aria-live': 'assertive' },
    });

    // Buttons
    const btnRow = createElement('div', { className: 'form-actions' });
    const cancelBtn = createElement('button', {
      className: 'btn btn--secondary',
      attributes: { type: 'button', 'aria-label': 'Cancel goal creation' },
    });
    cancelBtn.textContent = 'Cancel';

    const saveBtn = createElement('button', {
      className: 'btn btn--primary',
      attributes: { type: 'button', 'aria-label': 'Create goal' },
    });
    saveBtn.textContent = 'Create Goal';

    cancelBtn.addEventListener('click', () => {
      showCreateForm = false;
      renderForm();
    }, { signal });

    saveBtn.addEventListener('click', () => {
      const name = sanitizeString(nameInput.value);
      const target = sanitizeNumber(targetInput.value);
      const deadline = deadlineInput.value;
      const category = categorySelect.value;

      // Validate
      if (!name || name.length < 2) {
        errorEl.textContent = 'Please enter a goal name (at least 2 characters)';
        announceToScreenReader('Please enter a goal name');
        return;
      }
      if (!target || target < 1 || target > 100) {
        errorEl.textContent = 'Target must be between 1% and 100%';
        announceToScreenReader('Target must be between 1% and 100%');
        return;
      }
      if (!deadline) {
        errorEl.textContent = 'Please select a deadline';
        announceToScreenReader('Please select a deadline');
        return;
      }

      const goalData = {
        name,
        targetReduction: target,
        deadline,
        category: category || null,
      };

      const validation = validateGoal(goalData);
      if (validation && !validation.valid) {
        errorEl.textContent = validation.message || 'Invalid goal data';
        announceToScreenReader(validation.message || 'Validation error');
        return;
      }

      // Create goal
      let newGoal;
      try {
        newGoal = createGoal(goalData);
      } catch {
        newGoal = {
          ...goalData,
          id: generateId(),
          status: 'on-track',
          progress: 0,
          createdAt: new Date().toISOString(),
        };
      }

      const state = store.getState();
      const goals = [...(state.goals || []), newGoal];
      store.setState({ goals });

      showCreateForm = false;
      renderForm();
      renderGoals();
      announceToScreenReader(`Goal "${name}" created`);
    }, { signal });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);

    form.appendChild(formTitle);
    form.appendChild(nameGroup);
    form.appendChild(targetGroup);
    form.appendChild(deadlineGroup);
    form.appendChild(categoryGroup);
    form.appendChild(errorEl);
    form.appendChild(btnRow);

    formContainer.appendChild(form);

    requestAnimationFrame(() => nameInput.focus());
  }

  /**
   * Renders all goal cards (active and completed sections).
   */
  function renderGoals() {
    clearElement(activeSection);
    clearElement(completedSection);

    const state = store.getState();
    const goals = state.goals || [];

    // Update progress for all goals
    const updatedGoals = goals.map((goal) => {
      try {
        return updateGoalProgress(goal, state);
      } catch {
        return goal;
      }
    });

    const activeGoals = updatedGoals.filter((g) => g.status !== 'completed');
    const completedGoals = updatedGoals.filter((g) => g.status === 'completed');

    // Active goals
    if (activeGoals.length > 0) {
      const activeTitle = createElement('h2', { className: 'subsection-title' });
      activeTitle.textContent = `Active Goals (${activeGoals.length})`;
      activeSection.appendChild(activeTitle);

      activeGoals.forEach((goal) => {
        const card = createGoalCard(goal);
        activeSection.appendChild(card);
      });
    } else {
      renderGoalEmptyState(activeSection);
    }

    // Completed goals
    if (completedGoals.length > 0) {
      const completedHeader = createElement('div', { className: 'section-header' });
      const completedTitle = createElement('h2', { className: 'subsection-title' });
      completedTitle.textContent = `Completed Goals (${completedGoals.length})`;

      const toggleBtn = createElement('button', {
        className: 'btn btn--link',
        attributes: {
          type: 'button',
          'aria-expanded': String(showCompleted),
          'aria-label': `${showCompleted ? 'Collapse' : 'Expand'} completed goals`,
        },
      });
      toggleBtn.textContent = showCompleted ? '▾ Hide' : '▸ Show';

      toggleBtn.addEventListener('click', () => {
        showCompleted = !showCompleted;
        renderGoals();
      }, { signal });

      completedHeader.appendChild(completedTitle);
      completedHeader.appendChild(toggleBtn);
      completedSection.appendChild(completedHeader);

      if (showCompleted) {
        completedGoals.forEach((goal) => {
          const card = createGoalCard(goal);
          completedSection.appendChild(card);
        });
      }
    }
  }

  /**
   * Creates a single goal card DOM element.
   *
   * @param {Object} goal - Goal data object.
   * @returns {HTMLElement} The goal card element.
   */
  function createGoalCard(goal) {
    const card = createElement('div', { className: 'goal-card card' });

    // Header: name + status badge
    const cardHeader = createElement('div', { className: 'goal-card-header' });
    const cardName = createElement('h3', { className: 'goal-card-name' });
    cardName.textContent = goal.name || 'Untitled Goal';

    let statusKey = goal.status || 'on-track';
    try {
      const computed = getGoalStatus(goal);
      if (computed) statusKey = computed;
    } catch {
      // Use existing status
    }

    const statusConf = STATUS_CONFIG[statusKey] || STATUS_CONFIG['on-track'];
    const statusBadge = createElement('span', {
      className: `status-badge ${statusConf.className}`,
    });
    statusBadge.textContent = statusConf.label;

    cardHeader.appendChild(cardName);
    cardHeader.appendChild(statusBadge);
    card.appendChild(cardHeader);

    // Progress bar
    const progressPct = Math.min(100, Math.max(0, goal.progress || 0));
    const progressContainer = createElement('div', {
      className: 'goal-progress-container',
      attributes: {
        role: 'progressbar',
        'aria-valuenow': String(Math.round(progressPct)),
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-label': `Goal progress: ${Math.round(progressPct)}%`,
      },
    });
    const progressBar = createElement('div', {
      className: `goal-progress-bar goal-progress-bar--${statusKey}`,
    });
    progressBar.style.width = `${progressPct}%`;
    const progressLabel = createElement('span', { className: 'goal-progress-label' });
    progressLabel.textContent = `${Math.round(progressPct)}%`;

    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(progressLabel);
    card.appendChild(progressContainer);

    // Details: current vs target + deadline
    const details = createElement('div', { className: 'goal-details' });

    const reductionRow = createElement('div', { className: 'goal-detail-row' });
    const reductionLabel = createElement('span', { className: 'goal-detail-label' });
    reductionLabel.textContent = 'Target Reduction';
    const reductionValue = createElement('span', { className: 'goal-detail-value' });
    reductionValue.textContent = `${formatNumber(goal.targetReduction || 0)}%`;
    reductionRow.appendChild(reductionLabel);
    reductionRow.appendChild(reductionValue);
    details.appendChild(reductionRow);

    if (goal.deadline) {
      const deadlineRow = createElement('div', { className: 'goal-detail-row' });
      const deadlineLabel = createElement('span', { className: 'goal-detail-label' });
      deadlineLabel.textContent = 'Deadline';
      const deadlineValue = createElement('span', { className: 'goal-detail-value' });

      const daysRemaining = Math.ceil(
        (new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24)
      );
      deadlineValue.textContent = daysRemaining > 0
        ? `${formatDate(goal.deadline)} (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left)`
        : `${formatDate(goal.deadline)} (past due)`;

      deadlineRow.appendChild(deadlineLabel);
      deadlineRow.appendChild(deadlineValue);
      details.appendChild(deadlineRow);
    }

    if (goal.category) {
      const catRow = createElement('div', { className: 'goal-detail-row' });
      const catLabel = createElement('span', { className: 'goal-detail-label' });
      catLabel.textContent = 'Category';
      const catValue = createElement('span', { className: 'goal-detail-value' });
      catValue.textContent = goal.category.charAt(0).toUpperCase() + goal.category.slice(1);
      catRow.appendChild(catLabel);
      catRow.appendChild(catValue);
      details.appendChild(catRow);
    }

    card.appendChild(details);

    // Milestones checklist
    const milestonesContainer = createElement('div', { className: 'goal-milestones' });
    const milestonesTitle = createElement('span', { className: 'milestones-title' });
    milestonesTitle.textContent = 'Milestones';
    milestonesContainer.appendChild(milestonesTitle);

    const milestoneList = createElement('div', {
      className: 'milestone-list',
      attributes: { 'aria-label': 'Goal milestones' },
    });

    MILESTONES.forEach((ms) => {
      const achieved = progressPct >= ms;
      const milestone = createElement('span', {
        className: `milestone${achieved ? ' milestone--achieved' : ''}`,
        attributes: {
          'aria-label': `${ms}% milestone ${achieved ? 'achieved' : 'not achieved'}`,
        },
      });
      milestone.textContent = achieved ? `✅ ${ms}%` : `⬜ ${ms}%`;
      milestoneList.appendChild(milestone);
    });

    milestonesContainer.appendChild(milestoneList);
    card.appendChild(milestonesContainer);

    // Delete button (not for completed goals viewed in collapsed section)
    if (goal.status !== 'completed') {
      const deleteBtn = createElement('button', {
        className: 'btn btn--danger btn--sm',
        attributes: {
          type: 'button',
          'aria-label': `Delete goal "${goal.name}"`,
        },
      });
      deleteBtn.textContent = '🗑️ Delete';

      deleteBtn.addEventListener('click', () => {
        handleDeleteGoal(goal);
      }, { signal });

      card.appendChild(deleteBtn);
    }

    return card;
  }

  /**
   * Handles goal deletion with confirmation.
   * @param {Object} goal - The goal to delete.
   */
  function handleDeleteGoal(goal) {
    const confirmContent = createElement('div', { className: 'confirm-dialog' });

    const message = createElement('p', { className: 'confirm-message' });
    message.textContent = `Are you sure you want to delete the goal "${goal.name}"? This cannot be undone.`;

    const btnRow = createElement('div', { className: 'confirm-actions' });
    const cancelBtn = createElement('button', {
      className: 'btn btn--secondary',
      attributes: { type: 'button', 'aria-label': 'Cancel deletion' },
    });
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => closeModal());

    const confirmBtn = createElement('button', {
      className: 'btn btn--danger',
      attributes: { type: 'button', 'aria-label': 'Confirm deletion' },
    });
    confirmBtn.textContent = 'Delete';
    confirmBtn.addEventListener('click', () => {
      const state = store.getState();
      const goals = (state.goals || []).filter((g) => g.id !== goal.id);
      store.setState({ goals });
      closeModal();
      announceToScreenReader(`Goal "${goal.name}" deleted`);
      renderGoals();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    confirmContent.appendChild(message);
    confirmContent.appendChild(btnRow);

    openModal({
      title: 'Delete Goal',
      content: confirmContent,
      size: 'small',
    });
  }

  /**
   * Renders empty state for goals section.
   * @param {HTMLElement} section - The section to render into.
   */
  function renderGoalEmptyState(section) {
    const empty = createElement('div', { className: 'empty-state' });
    const emptyIcon = createElement('span', {
      className: 'empty-state-icon',
      attributes: { 'aria-hidden': 'true' },
    });
    emptyIcon.textContent = '🎯';

    const emptyTitle = createElement('h2', { className: 'empty-state-title' });
    emptyTitle.textContent = 'No active goals';

    const emptyText = createElement('p', { className: 'empty-state-text' });
    emptyText.textContent = 'Set a goal to start tracking your progress toward reducing your carbon footprint!';

    const ctaBtn = createElement('button', {
      className: 'btn btn--primary',
      attributes: { type: 'button', 'aria-label': 'Create your first goal' },
    });
    ctaBtn.textContent = '🎯 Create a Goal';
    ctaBtn.addEventListener('click', () => {
      showCreateForm = true;
      renderForm();
    }, { signal });

    empty.appendChild(emptyIcon);
    empty.appendChild(emptyTitle);
    empty.appendChild(emptyText);
    empty.appendChild(ctaBtn);
    section.appendChild(empty);
  }

  // --- Initial render ---
  renderGoals();

  // --- Store subscription ---
  unsubscribe = store.subscribe(() => {
    renderGoals();
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
