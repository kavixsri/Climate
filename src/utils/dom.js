/**
 * Safe DOM manipulation utilities for CarbonLens.
 * NEVER uses innerHTML, eval(), or document.write().
 * All content is set via textContent or DOM API methods only.
 *
 * @module dom
 */

/**
 * WeakMap tracking event listeners attached via addEventListenerSafe.
 * Enables bulk cleanup to prevent memory leaks.
 * @type {WeakMap<HTMLElement, Array<{event: string, handler: Function, options: Object}>>}
 * @private
 */
const listenerRegistry = new WeakMap();

/**
 * Reference to the shared aria-live announcement region.
 * @type {HTMLElement|null}
 * @private
 */
let liveRegion = null;

/**
 * Valid HTML tag names for createElement (non-exhaustive allowlist of common tags).
 * @type {Set<string>}
 * @private
 */
const VALID_TAGS = new Set([
  'div', 'span', 'p', 'a', 'button', 'input', 'select', 'option', 'optgroup',
  'textarea', 'label', 'form', 'fieldset', 'legend', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody',
  'tfoot', 'tr', 'th', 'td', 'caption', 'header', 'footer', 'main', 'nav',
  'aside', 'section', 'article', 'figure', 'figcaption', 'img', 'video',
  'audio', 'source', 'canvas', 'svg', 'path', 'circle', 'rect', 'line',
  'polyline', 'polygon', 'text', 'g', 'defs', 'use', 'details', 'summary',
  'dialog', 'template', 'slot', 'progress', 'meter', 'output', 'time',
  'mark', 'small', 'strong', 'em', 'code', 'pre', 'blockquote', 'hr', 'br',
  'abbr', 'cite', 'sub', 'sup', 'del', 'ins',
]);

/**
 * Attributes that are set as DOM properties rather than via setAttribute.
 * @type {Set<string>}
 * @private
 */
const PROPERTY_ATTRS = new Set([
  'textContent', 'value', 'checked', 'disabled', 'selected',
  'hidden', 'required', 'readOnly', 'multiple',
]);

/**
 * Creates an HTML element with attributes and children.
 * Uses only safe DOM API methods — never innerHTML.
 *
 * @param {string} tag - The HTML tag name (e.g., 'div', 'button').
 * @param {Object} [attributes={}] - Attribute key-value pairs.
 *   Supports: className, id, textContent, ariaLabel, role, tabIndex,
 *   data-* attributes, event handlers (onclick, etc. are NOT supported — use addEventListenerSafe).
 * @param {Array<HTMLElement|string>} [children=[]] - Child elements or text strings.
 * @returns {HTMLElement} The created element.
 * @throws {TypeError} If tag is not a valid string.
 *
 * @example
 * const btn = createElement('button', {
 *   className: 'btn btn-primary',
 *   textContent: 'Click me',
 *   ariaLabel: 'Submit form',
 *   tabIndex: 0,
 * });
 *
 * @example
 * const list = createElement('ul', { className: 'items' }, [
 *   createElement('li', { textContent: 'Item 1' }),
 *   createElement('li', { textContent: 'Item 2' }),
 * ]);
 */
export function createElement(tag, attributes = {}, children = []) {
  if (typeof tag !== 'string' || tag.trim().length === 0) {
    throw new TypeError('[DOM] createElement: tag must be a non-empty string');
  }

  const normalizedTag = tag.toLowerCase().trim();

  if (!VALID_TAGS.has(normalizedTag)) {
    console.warn(`[DOM] createElement: "${normalizedTag}" is not in the allowlist. Proceeding anyway.`);
  }

  const element = document.createElement(normalizedTag);

  // Apply attributes
  if (attributes && typeof attributes === 'object') {
    setAttributes(element, attributes);
  }

  // Append children
  const childList = Array.isArray(children) ? children : [children];
  for (const child of childList) {
    if (child instanceof Node) {
      element.appendChild(child);
    } else if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child !== null && child !== undefined) {
      console.warn('[DOM] createElement: Ignoring invalid child:', typeof child);
    }
  }

  return element;
}

/**
 * Creates a text node with the given content.
 *
 * @param {string} text - The text content.
 * @returns {Text} The created text node.
 *
 * @example
 * const text = createTextNode('Hello, world!');
 * container.appendChild(text);
 */
export function createTextNode(text) {
  return document.createTextNode(typeof text === 'string' ? text : String(text ?? ''));
}

/**
 * Safely removes all child nodes from an element.
 * Uses a loop with removeChild rather than innerHTML = ''.
 *
 * @param {HTMLElement} element - The element to clear.
 * @throws {TypeError} If element is not a valid DOM element.
 *
 * @example
 * clearElement(document.getElementById('container'));
 */
export function clearElement(element) {
  if (!(element instanceof Node)) {
    throw new TypeError('[DOM] clearElement: argument must be a DOM Node');
  }

  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Sets multiple attributes on a DOM element safely.
 * Handles className, textContent, dataset, aria-* attributes,
 * and standard HTML attributes. Never sets innerHTML.
 *
 * @param {HTMLElement} element - The target element.
 * @param {Object} attrs - Key-value pairs of attributes to set.
 * @throws {TypeError} If element is not a DOM element.
 *
 * @example
 * setAttributes(myDiv, {
 *   className: 'card active',
 *   ariaLabel: 'User card',
 *   'data-id': '42',
 *   role: 'article',
 * });
 */
export function setAttributes(element, attrs) {
  if (!(element instanceof Element)) {
    throw new TypeError('[DOM] setAttributes: first argument must be a DOM Element');
  }

  if (!attrs || typeof attrs !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) {
      continue;
    }

    // Block dangerous attributes
    if (key === 'innerHTML' || key === 'outerHTML') {
      console.error(`[DOM] setAttributes: "${key}" is forbidden. Use textContent or DOM methods.`);
      continue;
    }

    // Handle className
    if (key === 'className') {
      element.className = String(value);
      continue;
    }

    // Handle textContent (safe)
    if (key === 'textContent') {
      element.textContent = String(value);
      continue;
    }

    // Handle DOM properties
    if (PROPERTY_ATTRS.has(key)) {
      element[key] = value;
      continue;
    }

    // Handle aria-* attributes (camelCase → kebab-case)
    if (key.startsWith('aria') && key !== 'aria') {
      const ariaAttr = 'aria-' + key.slice(4).toLowerCase();
      element.setAttribute(ariaAttr, String(value));
      continue;
    }

    // Handle data-* attributes
    if (key.startsWith('data-')) {
      element.setAttribute(key, String(value));
      continue;
    }

    // Handle tabIndex
    if (key === 'tabIndex') {
      element.tabIndex = Number(value);
      continue;
    }

    // Handle style as an object
    if (key === 'style' && typeof value === 'object') {
      for (const [prop, val] of Object.entries(value)) {
        element.style[prop] = String(val);
      }
      continue;
    }

    // Standard attribute
    try {
      element.setAttribute(key, String(value));
    } catch (error) {
      console.warn(`[DOM] setAttributes: Failed to set "${key}":`, error);
    }
  }
}

/**
 * Adds an event listener with tracking for later cleanup.
 * All listeners added through this function can be removed in bulk
 * using removeAllListeners.
 *
 * @param {HTMLElement} element - The target element.
 * @param {string} event - The event name (e.g., 'click', 'keydown').
 * @param {Function} handler - The event handler function.
 * @param {Object} [options={}] - addEventListener options.
 * @returns {Function} A function to remove this specific listener.
 * @throws {TypeError} If arguments are invalid.
 *
 * @example
 * const removeClick = addEventListenerSafe(button, 'click', handleClick);
 * // Later...
 * removeClick();
 */
export function addEventListenerSafe(element, event, handler, options = {}) {
  if (!(element instanceof EventTarget)) {
    throw new TypeError('[DOM] addEventListenerSafe: element must be an EventTarget');
  }
  if (typeof event !== 'string' || event.trim().length === 0) {
    throw new TypeError('[DOM] addEventListenerSafe: event must be a non-empty string');
  }
  if (typeof handler !== 'function') {
    throw new TypeError('[DOM] addEventListenerSafe: handler must be a function');
  }

  element.addEventListener(event, handler, options);

  // Track the listener
  if (!listenerRegistry.has(element)) {
    listenerRegistry.set(element, []);
  }
  const entry = { event, handler, options };
  listenerRegistry.get(element).push(entry);

  // Return removal function
  return () => {
    element.removeEventListener(event, handler, options);
    const entries = listenerRegistry.get(element);
    if (entries) {
      const idx = entries.indexOf(entry);
      if (idx !== -1) {
        entries.splice(idx, 1);
      }
    }
  };
}

/**
 * Removes all tracked event listeners from an element.
 * Only removes listeners that were added via addEventListenerSafe.
 *
 * @param {HTMLElement} element - The element to clean up.
 *
 * @example
 * removeAllListeners(myComponent);
 */
export function removeAllListeners(element) {
  if (!(element instanceof EventTarget)) {
    return;
  }

  const entries = listenerRegistry.get(element);
  if (!entries) {
    return;
  }

  for (const { event, handler, options } of entries) {
    element.removeEventListener(event, handler, options);
  }

  listenerRegistry.delete(element);
}

/**
 * Creates a DocumentFragment containing the given children.
 * Useful for batching DOM insertions to minimize reflows.
 *
 * @param {Array<HTMLElement|string>} children - Elements or text strings to include.
 * @returns {DocumentFragment} A fragment containing all children.
 *
 * @example
 * const fragment = createFragment([
 *   createElement('li', { textContent: 'A' }),
 *   createElement('li', { textContent: 'B' }),
 * ]);
 * list.appendChild(fragment); // Single reflow
 */
export function createFragment(children = []) {
  const fragment = document.createDocumentFragment();
  const items = Array.isArray(children) ? children : [children];

  for (const child of items) {
    if (child instanceof Node) {
      fragment.appendChild(child);
    } else if (typeof child === 'string') {
      fragment.appendChild(document.createTextNode(child));
    }
  }

  return fragment;
}

/**
 * Announces a message to screen readers via an aria-live region.
 * Creates the live region if it doesn't exist, then updates its content.
 *
 * @param {string} message - The message to announce.
 * @param {'polite'|'assertive'} [priority='polite'] - The aria-live priority level.
 *   'polite' waits for the user to be idle; 'assertive' interrupts immediately.
 *
 * @example
 * announceToScreenReader('Activity saved successfully');
 * announceToScreenReader('Error: invalid input', 'assertive');
 */
export function announceToScreenReader(message, priority = 'polite') {
  if (typeof message !== 'string' || message.trim().length === 0) {
    return;
  }

  const validPriority = priority === 'assertive' ? 'assertive' : 'polite';

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', validPriority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('role', 'status');
    // Visually hidden but accessible to screen readers
    Object.assign(liveRegion.style, {
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
    liveRegion.id = 'carbonlens-live-region';
    document.body.appendChild(liveRegion);
  }

  // Update priority if changed
  liveRegion.setAttribute('aria-live', validPriority);

  // Clear and re-set to trigger screen reader announcement
  liveRegion.textContent = '';
  // Use requestAnimationFrame to ensure the DOM has cleared before setting new text
  requestAnimationFrame(() => {
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  });
}
