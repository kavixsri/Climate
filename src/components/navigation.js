/* istanbul ignore file */
/**
 * @module components/navigation
 * @description Sidebar navigation component for CarbonLens with route-based
 * active state, theme toggle, mobile hamburger menu, and keyboard navigation.
 */

import { createElement, clearElement, announceToScreenReader } from '../utils/dom.js';
import { getStore } from '../store/store.js';
import { handleKeyboardNav, prefersReducedMotion } from '../utils/a11y.js';

/**
 * @typedef {object} NavItem
 * @property {string} id - Route identifier
 * @property {string} label - Display label
 * @property {string} icon - Emoji icon
 */

/** @type {NavItem[]} */
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'calculator', label: 'Calculator', icon: '📊' },
  { id: 'activity-log', label: 'Activity Log', icon: '📋' },
  { id: 'insights', label: 'Insights', icon: '💡' },
  { id: 'goals', label: 'Goals', icon: '🎯' },
  { id: 'achievements', label: 'Achievements', icon: '🏆' },
];

/**
 * Renders the sidebar navigation into the given container.
 * @param {HTMLElement} container - The DOM element to render navigation into.
 * @returns {Function} Cleanup function that removes all event listeners and subscriptions.
 */
export function renderNavigation(container) {
  const store = getStore();
  const abortController = new AbortController();
  const { signal } = abortController;

  /** @type {Function|null} */
  let unsubscribe = null;

  /** @type {HTMLElement|null} */
  let navListEl = null;

  /** @type {boolean} */
  let mobileMenuOpen = false;

  clearElement(container);

  // --- Build DOM ---
  const nav = createElement('nav', {
    className: 'sidebar-nav',
    attributes: { 'aria-label': 'Main navigation' },
  });

  // Logo / Brand
  const brand = createElement('div', { className: 'nav-brand' });
  const brandIcon = createElement('span', {
    className: 'nav-brand-icon',
    attributes: { 'aria-hidden': 'true' },
  });
  brandIcon.textContent = '🌿';
  const brandName = createElement('span', { className: 'nav-brand-name' });
  brandName.textContent = 'CarbonLens';
  brand.appendChild(brandIcon);
  brand.appendChild(brandName);

  // Hamburger toggle (mobile)
  const hamburger = createElement('button', {
    className: 'nav-hamburger',
    attributes: {
      'aria-label': 'Toggle navigation menu',
      'aria-expanded': 'false',
      'aria-controls': 'nav-list',
      type: 'button',
    },
  });
  const hamburgerIcon = createElement('span', {
    className: 'hamburger-icon',
    attributes: { 'aria-hidden': 'true' },
  });
  hamburgerIcon.textContent = '☰';
  hamburger.appendChild(hamburgerIcon);

  // Nav list
  navListEl = createElement('ul', {
    className: 'nav-list',
    attributes: { role: 'list', id: 'nav-list' },
  });

  /**
   * Builds nav items and applies active state.
   * @param {string} currentRoute - Current active route from store.
   */
  function buildNavItems(currentRoute) {
    clearElement(navListEl);

    NAV_ITEMS.forEach((item) => {
      const li = createElement('li', {
        className: 'nav-item',
        attributes: { role: 'listitem' },
      });

      const isActive = currentRoute === item.id;
      const button = createElement('button', {
        className: `nav-link${isActive ? ' nav-link--active' : ''}`,
        attributes: {
          type: 'button',
          'aria-current': isActive ? 'page' : 'false',
          'data-route': item.id,
          'aria-label': item.label,
        },
      });

      const iconSpan = createElement('span', {
        className: 'nav-link-icon',
        attributes: { 'aria-hidden': 'true' },
      });
      iconSpan.textContent = item.icon;

      const labelSpan = createElement('span', { className: 'nav-link-label' });
      labelSpan.textContent = item.label;

      button.appendChild(iconSpan);
      button.appendChild(labelSpan);
      li.appendChild(button);
      navListEl.appendChild(li);
    });
  }

  // Theme toggle
  const themeToggle = createElement('div', { className: 'nav-theme-toggle' });
  const themeBtn = createElement('button', {
    className: 'theme-toggle-btn',
    attributes: {
      type: 'button',
      'aria-label': 'Toggle dark mode',
    },
  });

  /**
   * Updates the theme toggle button icon/label.
   * @param {string} theme - 'light' or 'dark'
   */
  function updateThemeButton(theme) {
    const isDark = theme === 'dark';
    themeBtn.textContent = '';
    const icon = createElement('span', { attributes: { 'aria-hidden': 'true' } });
    icon.textContent = isDark ? '☀️' : '🌙';
    const label = createElement('span', { className: 'theme-toggle-label' });
    label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    themeBtn.appendChild(icon);
    themeBtn.appendChild(label);
    themeBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  // --- Assemble ---
  const header = createElement('div', { className: 'nav-header' });
  header.appendChild(brand);
  header.appendChild(hamburger);

  themeToggle.appendChild(themeBtn);

  nav.appendChild(header);
  nav.appendChild(navListEl);
  nav.appendChild(themeToggle);
  container.appendChild(nav);

  // --- Initial render ---
  const state = store.getState();
  const currentRoute = state.route || 'dashboard';
  const currentTheme = state.theme || 'light';
  buildNavItems(currentRoute);
  updateThemeButton(currentTheme);

  if (mobileMenuOpen) {
    navListEl.classList.add('nav-list--open');
  }

  // --- Event Handlers ---

  /**
   * Handles navigation item clicks via event delegation.
   * @param {MouseEvent} event
   */
  function handleNavClick(event) {
    const button = event.target.closest('[data-route]');
    if (!button) return;

    const route = button.getAttribute('data-route');
    if (route) {
      store.setState({ route });
      announceToScreenReader(`Navigated to ${button.getAttribute('aria-label') || route}`);

      // Close mobile menu on navigation
      if (mobileMenuOpen) {
        toggleMobileMenu();
      }
    }
  }

  /**
   * Toggles the mobile hamburger menu open/closed.
   */
  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
    navListEl.classList.toggle('nav-list--open', mobileMenuOpen);
    hamburger.setAttribute('aria-expanded', String(mobileMenuOpen));
    const iconSpan = hamburger.querySelector('.hamburger-icon');
    if (iconSpan) {
      iconSpan.textContent = mobileMenuOpen ? '✕' : '☰';
    }
    announceToScreenReader(mobileMenuOpen ? 'Navigation menu opened' : 'Navigation menu closed');
  }

  /**
   * Handles keyboard navigation within the nav list (arrow keys).
   * @param {KeyboardEvent} event
   */
  function handleNavKeyboard(event) {
    const buttons = Array.from(navListEl.querySelectorAll('.nav-link'));
    handleKeyboardNav(event, buttons, { orientation: 'vertical', wrap: true });
  }

  /**
   * Handles theme toggle button click.
   */
  function handleThemeToggle() {
    const currentState = store.getState();
    const newTheme = currentState.theme === 'dark' ? 'light' : 'dark';
    store.setState({ theme: newTheme });
    document.documentElement.setAttribute('data-theme', newTheme);
    announceToScreenReader(`Switched to ${newTheme} mode`);
  }

  navListEl.addEventListener('click', handleNavClick, { signal });
  navListEl.addEventListener('keydown', handleNavKeyboard, { signal });
  hamburger.addEventListener('click', toggleMobileMenu, { signal });
  themeBtn.addEventListener('click', handleThemeToggle, { signal });

  // --- Store subscription ---
  unsubscribe = store.subscribe((newState) => {
    const route = newState.route || 'dashboard';
    buildNavItems(route);
    updateThemeButton(newState.theme || 'light');
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

