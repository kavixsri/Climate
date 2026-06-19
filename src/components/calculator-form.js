/**
 * @module components/calculator-form
 * @description Multi-step carbon calculator form for CarbonLens. Guides users
 * through category → type → subtype → amount → date → review flow with
 * real-time CO₂e preview, validation, and accessibility support.
 */

import { createElement, clearElement, announceToScreenReader } from '../utils/dom.js';
import { formatCO2, formatNumber, formatDate } from '../utils/format.js';
import { getStore } from '../store/store.js';
import { calculateActivityEmission } from '../core/calculator.js';
import { CATEGORIES, EMISSION_FACTORS } from '../core/emission-factors.js';
import { validateActivity, sanitizeString, sanitizeNumber } from '../utils/validation.js';
import { debounce } from '../utils/debounce.js';
import { generateId } from '../utils/crypto.js';
import { prefersReducedMotion } from '../utils/a11y.js';

/** Total number of steps in the form. */
const TOTAL_STEPS = 6;

/** @type {Record<string, string>} */
const CATEGORY_ICONS = {
  transportation: '🚗',
  energy: '⚡',
  diet: '🍽️',
  shopping: '🛍️',
  waste: '🗑️',
};

/**
 * Renders the multi-step carbon calculator form into the given container.
 *
 * @param {HTMLElement} container - The DOM element to render into.
 * @returns {Function} Cleanup function that removes all event listeners.
 */
export function renderCalculatorForm(container) {
  const store = getStore();
  const abortController = new AbortController();
  const { signal } = abortController;

  /** @type {number} */
  let currentStep = 1;

  /** @type {Object} */
  const formData = {
    category: '',
    type: '',
    subtype: '',
    amount: 0,
    unit: '',
    date: new Date().toISOString().split('T')[0],
    co2e: 0,
  };

  /** @type {boolean} */
  let submitted = false;

  clearElement(container);

  const page = createElement('div', { className: 'calculator-form' });

  // Page header
  const header = createElement('header', { className: 'calculator-header' });
  const title = createElement('h1', { className: 'calculator-title' });
  title.textContent = 'Carbon Calculator';
  const subtitle = createElement('p', { className: 'calculator-subtitle' });
  subtitle.textContent = 'Log your activity in a few easy steps';
  header.appendChild(title);
  header.appendChild(subtitle);
  page.appendChild(header);

  // Progress bar
  const progressContainer = createElement('div', {
    className: 'progress-container',
    attributes: {
      role: 'progressbar',
      'aria-valuemin': '1',
      'aria-valuemax': String(TOTAL_STEPS),
      'aria-valuenow': '1',
      'aria-label': 'Form progress',
    },
  });
  const progressBar = createElement('div', { className: 'progress-bar' });
  const progressText = createElement('span', { className: 'progress-text' });
  progressContainer.appendChild(progressBar);
  progressContainer.appendChild(progressText);
  page.appendChild(progressContainer);

  // Step container
  const stepContainer = createElement('div', {
    className: 'step-container',
    attributes: { 'aria-live': 'polite' },
  });
  page.appendChild(stepContainer);

  // Navigation buttons
  const navRow = createElement('div', { className: 'calculator-nav' });

  const backBtn = createElement('button', {
    className: 'btn btn--secondary',
    attributes: { type: 'button', 'aria-label': 'Go back to previous step' },
  });
  backBtn.textContent = '← Back';

  const nextBtn = createElement('button', {
    className: 'btn btn--primary',
    attributes: { type: 'button', 'aria-label': 'Continue to next step' },
  });
  nextBtn.textContent = 'Next →';

  navRow.appendChild(backBtn);
  navRow.appendChild(nextBtn);
  page.appendChild(navRow);

  container.appendChild(page);

  // --- Render logic ---

  /**
   * Updates progress bar and step indicator.
   */
  function updateProgress() {
    const pct = (currentStep / TOTAL_STEPS) * 100;
    progressBar.style.width = `${pct}%`;
    progressText.textContent = `Step ${currentStep} of ${TOTAL_STEPS}`;
    progressContainer.setAttribute('aria-valuenow', String(currentStep));
    backBtn.style.visibility = currentStep > 1 && !submitted ? 'visible' : 'hidden';
    nextBtn.style.display = submitted ? 'none' : '';
  }

  /**
   * Renders the current step content.
   */
  function renderStep() {
    clearElement(stepContainer);
    updateProgress();

    if (submitted) {
      renderSuccess();
      return;
    }

    switch (currentStep) {
      case 1:
        renderCategoryStep();
        break;
      case 2:
        renderTypeStep();
        break;
      case 3:
        renderSubtypeStep();
        break;
      case 4:
        renderAmountStep();
        break;
      case 5:
        renderDateStep();
        break;
      case 6:
        renderReviewStep();
        break;
      default:
        break;
    }

    announceToScreenReader(`Step ${currentStep} of ${TOTAL_STEPS}`);
  }

  /**
   * Step 1: Category selection with card-based UI.
   */
  function renderCategoryStep() {
    const stepTitle = createElement('h2', { className: 'step-title' });
    stepTitle.textContent = 'Select a Category';

    const grid = createElement('div', { className: 'card-selector' });

    const categories = Object.keys(CATEGORIES);
    categories.forEach((catKey) => {
      const cat = CATEGORIES[catKey];
      const card = createElement('button', {
        className: `selector-card${formData.category === catKey ? ' selector-card--selected' : ''}`,
        attributes: {
          type: 'button',
          'aria-pressed': formData.category === catKey ? 'true' : 'false',
          'data-value': catKey,
        },
      });

      const icon = createElement('span', {
        className: 'selector-card-icon',
        attributes: { 'aria-hidden': 'true' },
      });
      icon.textContent = CATEGORY_ICONS[catKey] || '📊';

      const label = createElement('span', { className: 'selector-card-label' });
      label.textContent = cat.name || catKey;

      card.appendChild(icon);
      card.appendChild(label);

      card.addEventListener('click', () => {
        formData.category = catKey;
        formData.type = '';
        formData.subtype = '';
        goToStep(2);
      }, { signal });

      grid.appendChild(card);
    });

    stepContainer.appendChild(stepTitle);
    stepContainer.appendChild(grid);
  }

  /**
   * Step 2: Type selection (dynamic based on selected category).
   */
  function renderTypeStep() {
    const stepTitle = createElement('h2', { className: 'step-title' });
    stepTitle.textContent = 'Select Type';

    const cat = CATEGORIES[formData.category];
    if (!cat || !cat.types) {
      const noTypes = createElement('p', { className: 'step-info' });
      noTypes.textContent = 'No types available for this category.';
      stepContainer.appendChild(stepTitle);
      stepContainer.appendChild(noTypes);
      return;
    }

    const grid = createElement('div', { className: 'card-selector' });
    const types = Object.keys(cat.types);

    types.forEach((typeKey) => {
      const typeData = cat.types[typeKey];
      const card = createElement('button', {
        className: `selector-card${formData.type === typeKey ? ' selector-card--selected' : ''}`,
        attributes: {
          type: 'button',
          'aria-pressed': formData.type === typeKey ? 'true' : 'false',
          'data-value': typeKey,
        },
      });

      const label = createElement('span', { className: 'selector-card-label' });
      label.textContent = typeData.name || typeKey;

      card.appendChild(label);

      card.addEventListener('click', () => {
        formData.type = typeKey;
        formData.subtype = '';

        // Check if subtypes exist
        if (typeData.subtypes && Object.keys(typeData.subtypes).length > 0) {
          goToStep(3);
        } else {
          formData.unit = typeData.unit || 'kg';
          goToStep(4);
        }
      }, { signal });

      grid.appendChild(card);
    });

    stepContainer.appendChild(stepTitle);
    stepContainer.appendChild(grid);
  }

  /**
   * Step 3: Subtype selection (if applicable).
   */
  function renderSubtypeStep() {
    const cat = CATEGORIES[formData.category];
    const typeData = cat?.types?.[formData.type];

    if (!typeData?.subtypes || Object.keys(typeData.subtypes).length === 0) {
      formData.unit = typeData?.unit || 'kg';
      goToStep(4);
      return;
    }

    const stepTitle = createElement('h2', { className: 'step-title' });
    stepTitle.textContent = 'Select Subtype';

    const grid = createElement('div', { className: 'card-selector' });
    const subtypes = Object.keys(typeData.subtypes);

    subtypes.forEach((subKey) => {
      const sub = typeData.subtypes[subKey];
      const card = createElement('button', {
        className: `selector-card${formData.subtype === subKey ? ' selector-card--selected' : ''}`,
        attributes: {
          type: 'button',
          'aria-pressed': formData.subtype === subKey ? 'true' : 'false',
          'data-value': subKey,
        },
      });

      const label = createElement('span', { className: 'selector-card-label' });
      label.textContent = sub.name || subKey;

      card.appendChild(label);

      card.addEventListener('click', () => {
        formData.subtype = subKey;
        formData.unit = sub.unit || typeData.unit || 'kg';
        goToStep(4);
      }, { signal });

      grid.appendChild(card);
    });

    stepContainer.appendChild(stepTitle);
    stepContainer.appendChild(grid);
  }

  /**
   * Step 4: Amount input with +/- buttons and real-time CO₂e preview.
   */
  function renderAmountStep() {
    const stepTitle = createElement('h2', { className: 'step-title' });
    stepTitle.textContent = 'Enter Amount';

    const amountGroup = createElement('div', { className: 'amount-input-group' });

    const decrementBtn = createElement('button', {
      className: 'btn btn--icon amount-btn',
      attributes: { type: 'button', 'aria-label': 'Decrease amount' },
    });
    decrementBtn.textContent = '−';

    const inputId = 'calc-amount-input';
    const amountInput = createElement('input', {
      className: 'amount-input',
      attributes: {
        type: 'number',
        id: inputId,
        min: '0',
        step: '0.1',
        value: String(formData.amount || ''),
        placeholder: '0',
        'aria-label': `Amount in ${formData.unit || 'units'}`,
      },
    });

    const incrementBtn = createElement('button', {
      className: 'btn btn--icon amount-btn',
      attributes: { type: 'button', 'aria-label': 'Increase amount' },
    });
    incrementBtn.textContent = '+';

    const unitLabel = createElement('span', { className: 'amount-unit' });
    unitLabel.textContent = formData.unit || 'units';

    amountGroup.appendChild(decrementBtn);
    amountGroup.appendChild(amountInput);
    amountGroup.appendChild(incrementBtn);
    amountGroup.appendChild(unitLabel);

    // CO₂e preview
    const preview = createElement('div', { className: 'co2-preview', attributes: { 'aria-live': 'polite' } });
    const previewLabel = createElement('span', { className: 'co2-preview-label' });
    previewLabel.textContent = 'Estimated CO₂e: ';
    const previewValue = createElement('span', { className: 'co2-preview-value' });
    previewValue.textContent = formatCO2(0);
    preview.appendChild(previewLabel);
    preview.appendChild(previewValue);

    // Error message
    const errorEl = createElement('p', {
      className: 'form-error',
      attributes: { role: 'alert', 'aria-live': 'assertive' },
    });

    /**
     * Updates the CO₂e preview based on current amount.
     */
    const updatePreview = debounce(() => {
      const amount = sanitizeNumber(amountInput.value);
      formData.amount = amount;

      if (amount > 0) {
        try {
          const co2e = calculateActivityEmission(formData.category, formData.type, formData.subtype, amount);
          formData.co2e = co2e;
          previewValue.textContent = formatCO2(co2e);
        } catch {
          previewValue.textContent = formatCO2(0);
        }
      } else {
        previewValue.textContent = formatCO2(0);
      }
    }, 150);

    amountInput.addEventListener('input', () => {
      errorEl.textContent = '';
      updatePreview();
    }, { signal });

    decrementBtn.addEventListener('click', () => {
      const current = sanitizeNumber(amountInput.value);
      const newVal = Math.max(0, current - 1);
      amountInput.value = String(newVal);
      updatePreview();
    }, { signal });

    incrementBtn.addEventListener('click', () => {
      const current = sanitizeNumber(amountInput.value);
      amountInput.value = String(current + 1);
      updatePreview();
    }, { signal });

    // Initialize preview
    if (formData.amount > 0) {
      amountInput.value = String(formData.amount);
      updatePreview();
    }

    stepContainer.appendChild(stepTitle);
    stepContainer.appendChild(amountGroup);
    stepContainer.appendChild(preview);
    stepContainer.appendChild(errorEl);

    // Focus the input
    requestAnimationFrame(() => amountInput.focus());
  }

  /**
   * Step 5: Date selection.
   */
  function renderDateStep() {
    const stepTitle = createElement('h2', { className: 'step-title' });
    stepTitle.textContent = 'Select Date';

    const dateGroup = createElement('div', { className: 'date-input-group' });

    const dateLabel = createElement('label', {
      className: 'form-label',
      attributes: { for: 'calc-date-input' },
    });
    dateLabel.textContent = 'When did this activity occur?';

    const dateInput = createElement('input', {
      className: 'date-input',
      attributes: {
        type: 'date',
        id: 'calc-date-input',
        value: formData.date,
        max: new Date().toISOString().split('T')[0],
        'aria-label': 'Activity date',
      },
    });

    dateInput.addEventListener('change', () => {
      formData.date = dateInput.value || new Date().toISOString().split('T')[0];
    }, { signal });

    dateGroup.appendChild(dateLabel);
    dateGroup.appendChild(dateInput);

    stepContainer.appendChild(stepTitle);
    stepContainer.appendChild(dateGroup);

    requestAnimationFrame(() => dateInput.focus());
  }

  /**
   * Step 6: Review and submit.
   */
  function renderReviewStep() {
    const stepTitle = createElement('h2', { className: 'step-title' });
    stepTitle.textContent = 'Review & Submit';

    const reviewCard = createElement('div', { className: 'review-card card' });

    const items = [
      { label: 'Category', value: formData.category },
      { label: 'Type', value: formData.type },
      formData.subtype ? { label: 'Subtype', value: formData.subtype } : null,
      { label: 'Amount', value: `${formatNumber(formData.amount)} ${formData.unit}` },
      { label: 'Date', value: formatDate(formData.date) },
    ].filter(Boolean);

    items.forEach((item) => {
      const row = createElement('div', { className: 'review-row' });
      const rowLabel = createElement('span', { className: 'review-label' });
      rowLabel.textContent = item.label;
      const rowValue = createElement('span', { className: 'review-value' });
      rowValue.textContent = item.value;
      row.appendChild(rowLabel);
      row.appendChild(rowValue);
      reviewCard.appendChild(row);
    });

    // CO₂e total
    const co2Row = createElement('div', { className: 'review-row review-row--total' });
    const co2Label = createElement('span', { className: 'review-label review-label--total' });
    co2Label.textContent = 'CO₂e Impact';
    const co2Value = createElement('span', { className: 'review-value review-value--total' });
    co2Value.textContent = formatCO2(formData.co2e);
    co2Row.appendChild(co2Label);
    co2Row.appendChild(co2Value);
    reviewCard.appendChild(co2Row);

    // Error message
    const errorEl = createElement('p', {
      className: 'form-error',
      attributes: { role: 'alert', 'aria-live': 'assertive' },
    });

    stepContainer.appendChild(stepTitle);
    stepContainer.appendChild(reviewCard);
    stepContainer.appendChild(errorEl);

    // Change next button to submit
    nextBtn.textContent = '✓ Submit';
    nextBtn.setAttribute('aria-label', 'Submit activity');
  }

  /**
   * Renders success state after submission.
   */
  function renderSuccess() {
    clearElement(stepContainer);
    backBtn.style.display = 'none';
    nextBtn.style.display = 'none';

    const successContainer = createElement('div', { className: 'success-state' });

    const successIcon = createElement('span', {
      className: `success-icon${prefersReducedMotion() ? '' : ' success-icon--animated'}`,
      attributes: { 'aria-hidden': 'true' },
    });
    successIcon.textContent = '✅';

    const successTitle = createElement('h2', { className: 'success-title' });
    successTitle.textContent = 'Activity Logged!';

    const successDetail = createElement('p', { className: 'success-detail' });
    successDetail.textContent = `${formatCO2(formData.co2e)} of CO₂e recorded for ${formData.category}`;

    const logAnotherBtn = createElement('button', {
      className: 'btn btn--primary',
      attributes: { type: 'button', 'aria-label': 'Log another activity' },
    });
    logAnotherBtn.textContent = '📊 Log Another';
    logAnotherBtn.addEventListener('click', () => {
      resetForm();
    }, { signal });

    const dashboardBtn = createElement('button', {
      className: 'btn btn--secondary',
      attributes: { type: 'button', 'aria-label': 'Return to dashboard' },
    });
    dashboardBtn.textContent = '🏠 Dashboard';
    dashboardBtn.addEventListener('click', () => {
      store.setState({ route: 'dashboard' });
    }, { signal });

    const btnRow = createElement('div', { className: 'success-actions' });
    btnRow.appendChild(logAnotherBtn);
    btnRow.appendChild(dashboardBtn);

    successContainer.appendChild(successIcon);
    successContainer.appendChild(successTitle);
    successContainer.appendChild(successDetail);
    successContainer.appendChild(btnRow);

    stepContainer.appendChild(successContainer);

    announceToScreenReader('Activity logged successfully');

    // Update progress to completed
    progressBar.style.width = '100%';
    progressText.textContent = 'Complete!';
  }

  /**
   * Navigates to a specific step number.
   * @param {number} step
   */
  function goToStep(step) {
    if (step >= 1 && step <= TOTAL_STEPS) {
      currentStep = step;
      renderStep();
    }
  }

  /**
   * Validates the current step before advancing.
   * @returns {string|null} Error message if invalid, null if valid.
   */
  function validateCurrentStep() {
    switch (currentStep) {
      case 1:
        return formData.category ? null : 'Please select a category';
      case 2:
        return formData.type ? null : 'Please select a type';
      case 3:
        // Subtypes are optional in some categories
        return null;
      case 4:
        if (!formData.amount || formData.amount <= 0) {
          return 'Please enter a valid amount greater than 0';
        }
        return null;
      case 5:
        return formData.date ? null : 'Please select a date';
      case 6:
        return null;
      default:
        return null;
    }
  }

  /**
   * Handles the Next button click.
   */
  function handleNext() {
    const error = validateCurrentStep();
    if (error) {
      const errorEl = stepContainer.querySelector('.form-error');
      if (errorEl) {
        errorEl.textContent = error;
      }
      announceToScreenReader(error);
      return;
    }

    if (currentStep === TOTAL_STEPS) {
      handleSubmit();
    } else {
      // Skip subtype step if no subtypes
      if (currentStep === 2) {
        const cat = CATEGORIES[formData.category];
        const typeData = cat?.types?.[formData.type];
        if (!typeData?.subtypes || Object.keys(typeData.subtypes).length === 0) {
          formData.unit = typeData?.unit || 'kg';
          goToStep(4);
          return;
        }
      }
      goToStep(currentStep + 1);
    }
  }

  /**
   * Handles form submission.
   */
  function handleSubmit() {
    // Calculate CO₂e
    try {
      formData.co2e = calculateActivityEmission(
        formData.category,
        formData.type,
        formData.subtype,
        formData.amount
      );
    } catch {
      // Keep existing co2e
    }

    // Validate full activity
    const validation = validateActivity({
      category: formData.category,
      type: formData.type,
      subtype: formData.subtype,
      amount: formData.amount,
      date: formData.date,
    });

    if (validation && !validation.valid) {
      const errorEl = stepContainer.querySelector('.form-error');
      if (errorEl) {
        errorEl.textContent = validation.message || 'Invalid activity data';
      }
      announceToScreenReader(validation.message || 'Validation error');
      return;
    }

    // Add to store
    const state = store.getState();
    const activities = [...(state.activities || [])];
    activities.push({
      id: generateId(),
      category: sanitizeString(formData.category),
      type: sanitizeString(formData.type),
      subtype: sanitizeString(formData.subtype),
      amount: formData.amount,
      unit: formData.unit,
      date: formData.date,
      co2e: formData.co2e,
      createdAt: new Date().toISOString(),
    });

    store.setState({ activities });
    submitted = true;
    renderStep();
  }

  /**
   * Handles the Back button click.
   */
  function handleBack() {
    if (currentStep > 1) {
      // Skip subtype step going backwards if no subtypes
      if (currentStep === 4) {
        const cat = CATEGORIES[formData.category];
        const typeData = cat?.types?.[formData.type];
        if (!typeData?.subtypes || Object.keys(typeData.subtypes).length === 0) {
          goToStep(2);
          return;
        }
      }
      goToStep(currentStep - 1);
    }
  }

  /**
   * Resets the form to initial state for logging another activity.
   */
  function resetForm() {
    formData.category = '';
    formData.type = '';
    formData.subtype = '';
    formData.amount = 0;
    formData.unit = '';
    formData.date = new Date().toISOString().split('T')[0];
    formData.co2e = 0;
    currentStep = 1;
    submitted = false;
    backBtn.style.display = '';
    nextBtn.style.display = '';
    nextBtn.textContent = 'Next →';
    nextBtn.setAttribute('aria-label', 'Continue to next step');
    renderStep();
  }

  /**
   * Handles keyboard shortcuts: Enter to advance, Escape to go back.
   * @param {KeyboardEvent} event
   */
  function handleKeyboard(event) {
    if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') {
      event.preventDefault();
      handleNext();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleBack();
    }
  }

  // --- Attach event listeners ---
  nextBtn.addEventListener('click', handleNext, { signal });
  backBtn.addEventListener('click', handleBack, { signal });
  page.addEventListener('keydown', handleKeyboard, { signal });

  // --- Initial render ---
  renderStep();

  // --- Cleanup ---
  return function cleanup() {
    abortController.abort();
  };
}
