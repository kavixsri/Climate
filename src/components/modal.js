/**
 * @module components/modal
 * @description Accessible modal dialog with focus trapping, keyboard dismiss,
 * backdrop blur, scroll lock, and ARIA attributes.
 */

import { createElement, clearElement } from '../utils/dom.js';
import { trapFocus, prefersReducedMotion } from '../utils/a11y.js';
import { generateId } from '../utils/crypto.js';

/** @type {{ close: Function } | null} */
let activeModal = null;

/** @type {HTMLElement|null} */
let previouslyFocusedElement = null;

/** @type {AbortController|null} */
let activeAbortController = null;

/** @type {Function|null} */
let cleanupTrapFocus = null;

/**
 * Opens an accessible modal dialog.
 * @param {object} options - Modal configuration options.
 * @param {string} options.title - Title text displayed in the modal header.
 * @param {HTMLElement|Function} options.content - A DOM element to place inside
 *   the modal body, or a function that receives the body element and populates it.
 * @param {Function} [options.onClose] - Optional callback invoked when the modal closes.
 * @param {'small'|'medium'|'large'} [options.size] - Modal width preset.
 * @returns {{ close: Function }} An object with a `close()` method to programmatically close the modal.
 */
export function openModal({ title, content, onClose, size = 'medium' }) {
  // Close any existing modal first
  if (activeModal) {
    activeModal.close();
  }

  previouslyFocusedElement = /** @type {HTMLElement} */ (document.activeElement);

  const abortController = new AbortController();
  const { signal } = abortController;
  activeAbortController = abortController;

  const modalRoot = document.getElementById('modal-root') || createModalRoot();
  clearElement(modalRoot);

  const titleId = `modal-title-${generateId()}`;

  // --- Build DOM ---
  const overlay = createElement('div', {
    className: 'modal-overlay',
    attributes: { 'data-modal-overlay': 'true' },
  });

  const dialog = createElement('div', {
    className: `modal modal--${size}`,
    attributes: {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      tabindex: '-1',
    },
  });

  // Header
  const header = createElement('div', { className: 'modal-header' });
  const titleEl = createElement('h2', {
    className: 'modal-title',
    attributes: { id: titleId },
  });
  titleEl.textContent = title;

  const closeBtn = createElement('button', {
    className: 'modal-close-btn',
    attributes: {
      type: 'button',
      'aria-label': 'Close dialog',
    },
  });
  closeBtn.textContent = '✕';

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  // Body
  const body = createElement('div', { className: 'modal-body' });
  if (typeof content === 'function') {
    content(body);
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }

  dialog.appendChild(header);
  dialog.appendChild(body);
  overlay.appendChild(dialog);
  modalRoot.appendChild(overlay);

  // --- Prevent body scroll ---
  document.body.style.overflow = 'hidden';

  // --- Set aria-hidden on #app ---
  const appEl = document.getElementById('app');
  if (appEl) {
    appEl.setAttribute('aria-hidden', 'true');
  }

  // --- Animate in ---
  if (!prefersReducedMotion()) {
    overlay.classList.add('modal-overlay--entering');
    dialog.classList.add('modal--entering');
    requestAnimationFrame(() => {
      overlay.classList.remove('modal-overlay--entering');
      overlay.classList.add('modal-overlay--visible');
      dialog.classList.remove('modal--entering');
      dialog.classList.add('modal--visible');
    });
  } else {
    overlay.classList.add('modal-overlay--visible');
    dialog.classList.add('modal--visible');
  }

  // --- Focus management ---
  dialog.focus();

  // Trap focus inside modal
  cleanupTrapFocus = trapFocus(dialog);

  // --- Event handlers ---

  /**
   * Handles Escape key press to close the modal.
   * @param {KeyboardEvent} event
   */
  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  /**
   * Handles clicks on the backdrop overlay to close.
   * @param {MouseEvent} event
   */
  function handleOverlayClick(event) {
    if (event.target === overlay) {
      close();
    }
  }

  document.addEventListener('keydown', handleKeyDown, { signal });
  overlay.addEventListener('click', handleOverlayClick, { signal });
  closeBtn.addEventListener('click', () => close(), { signal });

  /**
   * Closes the modal with optional animation.
   */
  function close() {
    if (!prefersReducedMotion()) {
      overlay.classList.remove('modal-overlay--visible');
      overlay.classList.add('modal-overlay--leaving');
      dialog.classList.remove('modal--visible');
      dialog.classList.add('modal--leaving');

      const handleAnimEnd = () => {
        teardown();
      };

      dialog.addEventListener('animationend', handleAnimEnd, { once: true, signal });
      // Fallback in case animationend doesn't fire
      setTimeout(teardown, 300);
    } else {
      teardown();
    }
  }

  /** @type {boolean} */
  let tornDown = false;

  /**
   * Performs the actual DOM cleanup and state restoration.
   */
  function teardown() {
    if (tornDown) return;
    tornDown = true;

    abortController.abort();

    if (cleanupTrapFocus) {
      cleanupTrapFocus();
      cleanupTrapFocus = null;
    }

    clearElement(modalRoot);

    // Restore body scroll
    document.body.style.overflow = '';

    // Restore aria-hidden
    const app = document.getElementById('app');
    if (app) {
      app.removeAttribute('aria-hidden');
    }

    // Restore focus
    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
      previouslyFocusedElement.focus();
      previouslyFocusedElement = null;
    }

    activeModal = null;
    activeAbortController = null;

    if (typeof onClose === 'function') {
      onClose();
    }
  }

  activeModal = { close };
  return { close };
}

/**
 * Closes the currently active modal, if any.
 * @returns {void}
 */
export function closeModal() {
  if (activeModal) {
    activeModal.close();
  }
}

/**
 * Creates the #modal-root element if it doesn't exist.
 * @returns {HTMLElement} The modal root element.
 */
function createModalRoot() {
  const root = createElement('div', {
    attributes: { id: 'modal-root' },
  });
  document.body.appendChild(root);
  return root;
}
