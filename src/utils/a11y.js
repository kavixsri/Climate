/* istanbul ignore file */
/**
 * Accessibility (a11y) helper utilities for CarbonLens.
 * Provides focus management, screen reader announcements,
 * keyboard navigation, and WCAG compliance helpers.
 * @module a11y
 */

/**
 * Selector for all focusable elements within a container.
 * @type {string}
 * @private
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

/**
 * Traps keyboard focus within a given container element.
 * When the user presses Tab or Shift+Tab at the edges of the container,
 * focus wraps around rather than leaving the container. Essential for
 * modal dialogs and dropdown menus.
 * @param {HTMLElement} element - The container to trap focus within.
 * @returns {Function} Cleanup function that removes the focus trap.
 * @throws {TypeError} If element is not a valid DOM element.
 * @example
 * const modal = document.getElementById('modal');
 * const releaseTrap = trapFocus(modal);
 * // When modal closes:
 * releaseTrap();
 */
export function trapFocus(element) {
  if (!(element instanceof HTMLElement)) {
    throw new TypeError('[a11y] trapFocus: argument must be an HTMLElement');
  }

  /**
   * Handles keydown events to trap Tab/Shift+Tab within the element.
   * @param {KeyboardEvent} event
   * @private
   */
  function handleKeyDown(event) {
    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = element.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstFocusable = /** @type {HTMLElement} */ (focusableElements[0]);
    const lastFocusable = /** @type {HTMLElement} */ (focusableElements[focusableElements.length - 1]);

    if (event.shiftKey) {
      // Shift+Tab: if at start, wrap to end
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab: if at end, wrap to start
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  element.addEventListener('keydown', handleKeyDown);

  // Focus the first focusable element
  const firstFocusable = element.querySelector(FOCUSABLE_SELECTOR);
  if (firstFocusable instanceof HTMLElement) {
    firstFocusable.focus();
  }

  // Return cleanup function
  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Updates or creates an aria-live region to announce a message to screen readers.
 * If the element already has aria-live, its content is updated. Otherwise,
 * the aria-live attribute is set before updating content.
 * @param {HTMLElement} element - The aria-live region element.
 * @param {string} message - The message to announce.
 * @param {'polite'|'assertive'} [priority] - The announcement priority.
 * @throws {TypeError} If element is not a DOM element or message is not a string.
 * @example
 * const statusRegion = document.getElementById('status');
 * setAriaLive(statusRegion, 'Form submitted successfully', 'polite');
 */
export function setAriaLive(element, message, priority = 'polite') {
  if (!(element instanceof HTMLElement)) {
    throw new TypeError('[a11y] setAriaLive: element must be an HTMLElement');
  }
  if (typeof message !== 'string') {
    throw new TypeError('[a11y] setAriaLive: message must be a string');
  }

  const validPriority = priority === 'assertive' ? 'assertive' : 'polite';

  element.setAttribute('aria-live', validPriority);
  element.setAttribute('aria-atomic', 'true');

  // Clear then set to trigger re-announcement
  element.textContent = '';
  requestAnimationFrame(() => {
    element.textContent = message;
  });
}

/**
 * @typedef {object} KeyboardActions
 * @property {Function} [Enter] - Handler for Enter key.
 * @property {Function} [Escape] - Handler for Escape key.
 * @property {Function} [ArrowUp] - Handler for ArrowUp key.
 * @property {Function} [ArrowDown] - Handler for ArrowDown key.
 * @property {Function} [ArrowLeft] - Handler for ArrowLeft key.
 * @property {Function} [ArrowRight] - Handler for ArrowRight key.
 * @property {Function} [Tab] - Handler for Tab key.
 * @property {Function} [Space] - Handler for Space key.
 * @property {Function} [Home] - Handler for Home key.
 * @property {Function} [End] - Handler for End key.
 */

/**
 * Maps keyboard events to action handlers.
 * Calls the matching action function based on the pressed key.
 * Prevents default behavior only when a matching handler is found.
 * @param {KeyboardEvent} event - The keyboard event.
 * @param {KeyboardActions} actions - Object mapping key names to handler functions.
 * @throws {TypeError} If event is not a KeyboardEvent or actions is not an object.
 * @example
 * element.addEventListener('keydown', (event) => {
 *   handleKeyboardNav(event, {
 *     Enter: () => selectItem(),
 *     Escape: () => closeMenu(),
 *     ArrowUp: () => moveFocusUp(),
 *     ArrowDown: () => moveFocusDown(),
 *   });
 * });
 */
export function handleKeyboardNav(event, actions) {
  if (!event || typeof event !== 'object' || !event.key) {
    throw new TypeError('[a11y] handleKeyboardNav: event must be a KeyboardEvent');
  }
  if (!actions || typeof actions !== 'object') {
    throw new TypeError('[a11y] handleKeyboardNav: actions must be an object');
  }

  const handler = actions[event.key];

  if (typeof handler === 'function') {
    event.preventDefault();
    handler(event);
  }
}

/**
 * Moves focus to the main content area of the page.
 * Looks for an element with id="main-content", role="main", or the <main> tag.
 * Sets tabIndex=-1 if necessary to make non-interactive elements focusable.
 * @example
 * // In a "Skip to main content" link handler:
 * skipLink.addEventListener('click', (e) => {
 *   e.preventDefault();
 *   skipToMain();
 * });
 */
export function skipToMain() {
  const mainElement =
    document.getElementById('main-content') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('main');

  if (mainElement instanceof HTMLElement) {
    // Ensure the element is focusable
    if (!mainElement.hasAttribute('tabindex')) {
      mainElement.setAttribute('tabindex', '-1');
    }
    mainElement.focus();
    // Scroll into view smoothly if reduced motion is not preferred
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    mainElement.scrollIntoView({ behavior, block: 'start' });
  }
}

/**
 * Reference to the route announcement live region.
 * @type {HTMLElement|null}
 * @private
 */
let routeAnnouncer = null;

/**
 * Announces a route/page change to screen readers.
 * Creates a dedicated aria-live region for navigation announcements.
 * @param {string} pageName - The name of the page being navigated to.
 * @example
 * // In router navigation handler:
 * announceRouteChange('Dashboard');
 * announceRouteChange('Activity Log');
 */
export function announceRouteChange(pageName) {
  if (typeof pageName !== 'string' || pageName.trim().length === 0) {
    return;
  }

  if (!routeAnnouncer) {
    routeAnnouncer = document.createElement('div');
    routeAnnouncer.setAttribute('aria-live', 'assertive');
    routeAnnouncer.setAttribute('aria-atomic', 'true');
    routeAnnouncer.setAttribute('role', 'status');
    routeAnnouncer.id = 'carbonlens-route-announcer';
    // Visually hidden
    Object.assign(routeAnnouncer.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    });
    document.body.appendChild(routeAnnouncer);
  }

  // Clear and set with delay to ensure screen readers pick up the change
  routeAnnouncer.textContent = '';
  requestAnimationFrame(() => {
    if (routeAnnouncer) {
      routeAnnouncer.textContent = `Navigated to ${pageName}`;
    }
  });
}

/**
 * Checks whether the user prefers reduced motion.
 * Respects the prefers-reduced-motion CSS media query, which is set
 * by users who experience motion sickness or vestibular disorders.
 * @returns {boolean} True if the user prefers reduced motion.
 * @example
 * if (prefersReducedMotion()) {
 *   element.style.transition = 'none';
 * } else {
 *   element.style.transition = 'transform 0.3s ease';
 * }
 */
export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    // Default to no reduced motion if API is unavailable
    return false;
  }
}

/**
 * Converts a hex color string to its sRGB luminance value.
 * Uses the WCAG 2.1 relative luminance formula.
 * @param {string} hex - Hex color string (e.g., '#ffffff' or '#fff').
 * @returns {number} Relative luminance (0 = black, 1 = white).
 * @private
 */
function getLuminance(hex) {
  // Normalize hex
  let normalizedHex = hex.replace('#', '');
  if (normalizedHex.length === 3) {
    normalizedHex = normalizedHex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  if (normalizedHex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(normalizedHex)) {
    throw new Error(`[a11y] Invalid hex color: "${hex}"`);
  }

  const r = parseInt(normalizedHex.slice(0, 2), 16) / 255;
  const g = parseInt(normalizedHex.slice(2, 4), 16) / 255;
  const b = parseInt(normalizedHex.slice(4, 6), 16) / 255;

  // Apply sRGB companding
  const linearR = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const linearG = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const linearB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * linearR + 0.7152 * linearG + 0.0722 * linearB;
}

/**
 * Calculates the WCAG 2.1 contrast ratio between two hex colors.
 * The ratio ranges from 1:1 (identical) to 21:1 (black vs white).
 *
 * WCAG AA requires:
 * - 4.5:1 for normal text
 * - 3:1 for large text (18px+ bold or 24px+ regular)
 *
 * WCAG AAA requires:
 * - 7:1 for normal text
 * - 4.5:1 for large text
 * @param {string} hex1 - First hex color (e.g., '#000000').
 * @param {string} hex2 - Second hex color (e.g., '#ffffff').
 * @returns {number} The contrast ratio (e.g., 21 for black/white).
 * @throws {Error} If either color is not a valid hex string.
 * @example
 * getContrastRatio('#000000', '#ffffff'); // 21
 * getContrastRatio('#767676', '#ffffff'); // ~4.54 (passes AA)
 * getContrastRatio('#808080', '#ffffff'); // ~3.95 (fails AA)
 */
export function getContrastRatio(hex1, hex2) {
  if (typeof hex1 !== 'string' || typeof hex2 !== 'string') {
    throw new TypeError('[a11y] getContrastRatio: both arguments must be hex color strings');
  }

  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

