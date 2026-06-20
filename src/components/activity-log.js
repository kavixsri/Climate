/**
 * @module components/activity-log
 * @description Activity logging timeline for CarbonLens with filtering,
 * sorting, pagination, inline edit/delete, and confirmation dialogs.
 */

import { createElement, clearElement, announceToScreenReader } from '../utils/dom.js';
import { formatCO2, formatNumber, formatRelativeDate, formatDate } from '../utils/format.js';
import { getStore } from '../store/store.js';
import { sanitizeString, sanitizeNumber } from '../utils/validation.js';
import { openModal, closeModal } from './modal.js';

/** Number of activities to display per page. */
const PAGE_SIZE = 20;

/** @type {Record<string, string>} */
const CATEGORY_ICONS = {
  transportation: '🚗',
  energy: '⚡',
  diet: '🍽️',
  shopping: '🛍️',
  waste: '🗑️',
};

/**
 * Renders the activity log view into the given container.
 * @param {HTMLElement} container - The DOM element to render into.
 * @returns {Function} Cleanup function that removes all event listeners and subscriptions.
 */
export function renderActivityLog(container) {
  const store = getStore();
  const abortController = new AbortController();
  const { signal } = abortController;

  /** @type {Function|null} */
  let unsubscribe = null;

  /** @type {string} */
  let filterCategory = 'all';

  /** @type {string} */
  let filterDateFrom = '';

  /** @type {string} */
  let filterDateTo = '';

  /** @type {string} */
  let sortBy = 'newest';

  /** @type {number} */
  let displayCount = PAGE_SIZE;

  clearElement(container);

  const page = createElement('div', { className: 'activity-log' });

  // --- Header ---
  const header = createElement('header', { className: 'activity-log-header' });
  const titleRow = createElement('div', { className: 'section-header' });
  const title = createElement('h1', { className: 'section-title' });
  title.textContent = 'Activity Log';
  const countBadge = createElement('span', { className: 'count-badge', attributes: { 'aria-live': 'polite' } });
  titleRow.appendChild(title);
  titleRow.appendChild(countBadge);
  header.appendChild(titleRow);

  // --- Filter controls ---
  const filters = createElement('div', {
    className: 'filter-controls',
    attributes: { 'aria-label': 'Activity filters' },
  });

  // Category filter
  const categoryGroup = createElement('div', { className: 'filter-group' });
  const categoryLabel = createElement('label', {
    className: 'filter-label',
    attributes: { for: 'filter-category' },
  });
  categoryLabel.textContent = 'Category';

  const categorySelect = createElement('select', {
    className: 'filter-select',
    attributes: { id: 'filter-category', 'aria-label': 'Filter by category' },
  });

  const allOption = createElement('option', { attributes: { value: 'all' } });
  allOption.textContent = 'All Categories';
  categorySelect.appendChild(allOption);

  Object.keys(CATEGORY_ICONS).forEach((cat) => {
    const opt = createElement('option', { attributes: { value: cat } });
    opt.textContent = `${CATEGORY_ICONS[cat]} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`;
    categorySelect.appendChild(opt);
  });

  categoryGroup.appendChild(categoryLabel);
  categoryGroup.appendChild(categorySelect);

  // Date range filters
  const dateFromGroup = createElement('div', { className: 'filter-group' });
  const dateFromLabel = createElement('label', {
    className: 'filter-label',
    attributes: { for: 'filter-date-from' },
  });
  dateFromLabel.textContent = 'From';
  const dateFromInput = createElement('input', {
    className: 'filter-input',
    attributes: { type: 'date', id: 'filter-date-from', 'aria-label': 'Filter from date' },
  });
  dateFromGroup.appendChild(dateFromLabel);
  dateFromGroup.appendChild(dateFromInput);

  const dateToGroup = createElement('div', { className: 'filter-group' });
  const dateToLabel = createElement('label', {
    className: 'filter-label',
    attributes: { for: 'filter-date-to' },
  });
  dateToLabel.textContent = 'To';
  const dateToInput = createElement('input', {
    className: 'filter-input',
    attributes: { type: 'date', id: 'filter-date-to', 'aria-label': 'Filter to date' },
  });
  dateToGroup.appendChild(dateToLabel);
  dateToGroup.appendChild(dateToInput);

  // Sort control
  const sortGroup = createElement('div', { className: 'filter-group' });
  const sortLabel = createElement('label', {
    className: 'filter-label',
    attributes: { for: 'filter-sort' },
  });
  sortLabel.textContent = 'Sort';
  const sortSelect = createElement('select', {
    className: 'filter-select',
    attributes: { id: 'filter-sort', 'aria-label': 'Sort activities' },
  });
  [
    { value: 'newest', text: 'Newest first' },
    { value: 'oldest', text: 'Oldest first' },
    { value: 'highest', text: 'Highest CO₂e' },
  ].forEach((opt) => {
    const option = createElement('option', { attributes: { value: opt.value } });
    option.textContent = opt.text;
    sortSelect.appendChild(option);
  });
  sortGroup.appendChild(sortLabel);
  sortGroup.appendChild(sortSelect);

  filters.appendChild(categoryGroup);
  filters.appendChild(dateFromGroup);
  filters.appendChild(dateToGroup);
  filters.appendChild(sortGroup);
  header.appendChild(filters);
  page.appendChild(header);

  // --- Activity list ---
  const listContainer = createElement('div', {
    className: 'activity-list-container',
    attributes: { 'aria-live': 'polite' },
  });
  page.appendChild(listContainer);

  container.appendChild(page);

  // --- Rendering ---

  /**
   * Gets filtered and sorted activities from state.
   * @returns {Array} Filtered and sorted activity array.
   */
  function getFilteredActivities() {
    const state = store.getState();
    let activities = [...(state.activities || [])];

    // Filter by category
    if (filterCategory !== 'all') {
      activities = activities.filter((a) => a.category === filterCategory);
    }

    // Filter by date range
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      activities = activities.filter((a) => a.date && new Date(a.date) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      activities = activities.filter((a) => a.date && new Date(a.date) <= to);
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        activities.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        break;
      case 'oldest':
        activities.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        break;
      case 'highest':
        activities.sort((a, b) => (b.co2e || 0) - (a.co2e || 0));
        break;
      default:
        break;
    }

    return activities;
  }

  /**
   * Renders the activity list based on current filters and pagination.
   */
  function renderList() {
    clearElement(listContainer);

    const activities = getFilteredActivities();
    const visible = activities.slice(0, displayCount);

    // Update count badge
    countBadge.textContent = `${activities.length} activit${activities.length === 1 ? 'y' : 'ies'}`;

    if (activities.length === 0) {
      renderEmptyState();
      return;
    }

    const list = createElement('ul', {
      className: 'activity-list',
      attributes: { role: 'list', 'aria-label': 'Activity entries' },
    });

    visible.forEach((activity) => {
      const item = createActivityItem(activity);
      list.appendChild(item);
    });

    listContainer.appendChild(list);

    // Load more button
    if (visible.length < activities.length) {
      const loadMoreBtn = createElement('button', {
        className: 'btn btn--secondary btn--block load-more-btn',
        attributes: {
          type: 'button',
          'aria-label': `Load more activities. Showing ${visible.length} of ${activities.length}`,
        },
      });
      loadMoreBtn.textContent = `Load more (${visible.length} of ${activities.length})`;
      loadMoreBtn.addEventListener('click', () => {
        displayCount += PAGE_SIZE;
        renderList();
        announceToScreenReader(`Showing ${Math.min(displayCount, activities.length)} of ${activities.length} activities`);
      }, { signal });
      listContainer.appendChild(loadMoreBtn);
    }
  }

  /**
   * Creates a single activity list item DOM element.
   * @param {object} activity - The activity data object.
   * @returns {HTMLElement} The list item element.
   */
  function createActivityItem(activity) {
    const item = createElement('li', { className: 'activity-item' });

    // Icon
    const icon = createElement('span', {
      className: 'activity-item-icon',
      attributes: { 'aria-hidden': 'true' },
    });
    icon.textContent = CATEGORY_ICONS[activity.category] || '📊';

    // Content
    const content = createElement('div', { className: 'activity-item-content' });

    const nameRow = createElement('div', { className: 'activity-item-name' });
    nameRow.textContent = [activity.type, activity.subtype].filter(Boolean).join(' — ');

    const detailRow = createElement('div', { className: 'activity-item-details' });
    const amountSpan = createElement('span', { className: 'activity-item-amount' });
    amountSpan.textContent = `${formatNumber(activity.amount)} ${activity.unit || ''}`;
    const dateSpan = createElement('span', { className: 'activity-item-date' });
    dateSpan.textContent = formatRelativeDate(activity.date);
    detailRow.appendChild(amountSpan);
    detailRow.appendChild(dateSpan);

    content.appendChild(nameRow);
    content.appendChild(detailRow);

    // CO₂e value
    const co2Span = createElement('span', { className: 'activity-item-co2' });
    co2Span.textContent = formatCO2(activity.co2e);

    // Action buttons
    const actions = createElement('div', { className: 'activity-item-actions' });

    const editBtn = createElement('button', {
      className: 'btn btn--icon btn--sm',
      attributes: {
        type: 'button',
        'aria-label': `Edit ${activity.type || 'activity'}`,
        title: 'Edit',
      },
    });
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', () => handleEdit(activity), { signal });

    const deleteBtn = createElement('button', {
      className: 'btn btn--icon btn--sm btn--danger',
      attributes: {
        type: 'button',
        'aria-label': `Delete ${activity.type || 'activity'}`,
        title: 'Delete',
      },
    });
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', () => handleDelete(activity), { signal });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(icon);
    item.appendChild(content);
    item.appendChild(co2Span);
    item.appendChild(actions);

    return item;
  }

  /**
   * Renders empty state when no activities match filters.
   */
  function renderEmptyState() {
    const empty = createElement('div', { className: 'empty-state' });

    const emptyIcon = createElement('span', {
      className: 'empty-state-icon',
      attributes: { 'aria-hidden': 'true' },
    });
    emptyIcon.textContent = '📋';

    const emptyTitle = createElement('h2', { className: 'empty-state-title' });
    emptyTitle.textContent = 'No activities yet';

    const emptyText = createElement('p', { className: 'empty-state-text' });
    emptyText.textContent = 'Start tracking your carbon footprint by logging your first activity.';

    const ctaBtn = createElement('button', {
      className: 'btn btn--primary',
      attributes: { type: 'button', 'aria-label': 'Log your first activity' },
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

  /**
   * Opens an edit modal for an activity with a simplified inline form.
   * @param {object} activity - The activity to edit.
   */
  function handleEdit(activity) {
    const formContent = createElement('div', { className: 'edit-form' });

    // Amount field
    const amountLabel = createElement('label', {
      className: 'form-label',
      attributes: { for: 'edit-amount' },
    });
    amountLabel.textContent = 'Amount';

    const amountInput = createElement('input', {
      className: 'form-input',
      attributes: {
        type: 'number',
        id: 'edit-amount',
        value: String(activity.amount || 0),
        min: '0',
        step: '0.1',
        'aria-label': 'Edit amount',
      },
    });

    // Date field
    const dateLabel = createElement('label', {
      className: 'form-label',
      attributes: { for: 'edit-date' },
    });
    dateLabel.textContent = 'Date';

    const dateInput = createElement('input', {
      className: 'form-input',
      attributes: {
        type: 'date',
        id: 'edit-date',
        value: activity.date || '',
        'aria-label': 'Edit date',
      },
    });

    // Error area
    const errorEl = createElement('p', {
      className: 'form-error',
      attributes: { role: 'alert', 'aria-live': 'assertive' },
    });

    // Save button
    const saveBtn = createElement('button', {
      className: 'btn btn--primary',
      attributes: { type: 'button', 'aria-label': 'Save changes' },
    });
    saveBtn.textContent = 'Save Changes';

    saveBtn.addEventListener('click', () => {
      const newAmount = sanitizeNumber(amountInput.value);
      const newDate = sanitizeString(dateInput.value);

      if (newAmount <= 0) {
        errorEl.textContent = 'Amount must be greater than 0';
        announceToScreenReader('Amount must be greater than 0');
        return;
      }
      if (!newDate) {
        errorEl.textContent = 'Please select a valid date';
        announceToScreenReader('Please select a valid date');
        return;
      }

      // Update in store
      const state = store.getState();
      const activities = (state.activities || []).map((a) => {
        if (a.id === activity.id) {
          return { ...a, amount: newAmount, date: newDate };
        }
        return a;
      });
      store.setState({ activities });
      closeModal();
      announceToScreenReader('Activity updated');
      renderList();
    });

    formContent.appendChild(amountLabel);
    formContent.appendChild(amountInput);
    formContent.appendChild(dateLabel);
    formContent.appendChild(dateInput);
    formContent.appendChild(errorEl);
    formContent.appendChild(saveBtn);

    openModal({
      title: `Edit: ${activity.type || 'Activity'}`,
      content: formContent,
      size: 'small',
    });
  }

  /**
   * Opens a confirmation dialog before deleting an activity.
   * @param {object} activity - The activity to delete.
   */
  function handleDelete(activity) {
    const confirmContent = createElement('div', { className: 'confirm-dialog' });

    const message = createElement('p', { className: 'confirm-message' });
    message.textContent = `Are you sure you want to delete this ${activity.type || 'activity'}? This action cannot be undone.`;

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
      const activities = (state.activities || []).filter((a) => a.id !== activity.id);
      store.setState({ activities });
      closeModal();
      announceToScreenReader('Activity deleted');
      renderList();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    confirmContent.appendChild(message);
    confirmContent.appendChild(btnRow);

    openModal({
      title: 'Delete Activity',
      content: confirmContent,
      size: 'small',
    });
  }

  // --- Filter event listeners ---
  categorySelect.addEventListener('change', () => {
    filterCategory = categorySelect.value;
    displayCount = PAGE_SIZE;
    renderList();
  }, { signal });

  dateFromInput.addEventListener('change', () => {
    filterDateFrom = dateFromInput.value;
    displayCount = PAGE_SIZE;
    renderList();
  }, { signal });

  dateToInput.addEventListener('change', () => {
    filterDateTo = dateToInput.value;
    displayCount = PAGE_SIZE;
    renderList();
  }, { signal });

  sortSelect.addEventListener('change', () => {
    sortBy = sortSelect.value;
    displayCount = PAGE_SIZE;
    renderList();
  }, { signal });

  // --- Initial render ---
  renderList();

  // --- Store subscription ---
  unsubscribe = store.subscribe(() => {
    renderList();
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
