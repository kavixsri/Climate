/**
 * @fileoverview CarbonLens — App Orchestrator.
 *
 * Creates the app shell: sidebar navigation, main content area,
 * router initialization, store subscription, and theme management.
 * Uses only DOM API methods — never innerHTML.
 *
 * @module app
 */

import { createRouter } from './router.js';
import { renderDashboard } from './components/dashboard.js';
import { renderCalculatorForm } from './components/calculator-form.js';
import { renderActivityLog } from './components/activity-log.js';
import { renderInsightsPanel } from './components/insights-panel.js';
import { renderGoalsTracker } from './components/goals-tracker.js';
import { renderAchievements } from './components/achievements.js';

/* --------------------------------------------------------------------------
   View Wrapper
   -------------------------------------------------------------------------- */
function wrapView(renderFn) {
  return async (container) => {
    try {
      if (typeof renderFn === 'function') {
        return renderFn(container);
      }
      console.warn(`[App] View has no render function.`);
    } catch (err) {
      console.error(`[App] Failed to load view:`, err);
      const errorMsg = document.createElement('div');
      errorMsg.classList.add('empty-state', 'page-view');

      const title = document.createElement('h2');
      title.classList.add('empty-state__title');
      title.textContent = 'Failed to Load';

      const desc = document.createElement('p');
      desc.classList.add('empty-state__description');
      desc.textContent = 'This section encountered an error. Please try again later.';

      errorMsg.appendChild(title);
      errorMsg.appendChild(desc);
      container.appendChild(errorMsg);
    }
  };
}

/* --------------------------------------------------------------------------
   Route Definitions
   -------------------------------------------------------------------------- */
const ROUTES = [
  {
    path: '/dashboard',
    component: wrapView(renderDashboard),
    title: 'Dashboard'
  },
  {
    path: '/calculator',
    component: wrapView(renderCalculatorForm),
    title: 'Calculator'
  },
  {
    path: '/log',
    component: wrapView(renderActivityLog),
    title: 'Activity Log'
  },
  {
    path: '/insights',
    component: wrapView(renderInsightsPanel),
    title: 'Insights'
  },
  {
    path: '/goals',
    component: wrapView(renderGoalsTracker),
    title: 'Goals'
  },
  {
    path: '/achievements',
    component: wrapView(renderAchievements),
    title: 'Achievements'
  }
];

/* --------------------------------------------------------------------------
   Navigation Items Configuration
   -------------------------------------------------------------------------- */
const NAV_ITEMS = [
  { path: '/dashboard',    label: 'Dashboard',    icon: '📊' },
  { path: '/calculator',   label: 'Calculator',   icon: '🧮' },
  { path: '/log',          label: 'Activity Log', icon: '📋' },
  { path: '/insights',     label: 'Insights',     icon: '💡' },
  { path: '/goals',        label: 'Goals',        icon: '🎯' },
  { path: '/achievements', label: 'Achievements', icon: '🏆' }
];

/* --------------------------------------------------------------------------
   Navigation Component
   -------------------------------------------------------------------------- */

/**
 * Build the sidebar navigation DOM.
 *
 * @param {(path: string) => void} onNavigate - Callback when a nav item is clicked
 * @returns {{ element: HTMLElement, setActive: (path: string) => void, destroy: () => void }}
 */
function createNavigation(onNavigate) {
  const nav = document.createElement('nav');
  nav.classList.add('nav');
  nav.setAttribute('aria-label', 'Main navigation');

  // ── Brand ──
  const brand = document.createElement('div');
  brand.classList.add('nav__brand');

  const logo = document.createElement('img');
  logo.classList.add('nav__logo');
  logo.src = 'public/icons/icon.svg';
  logo.alt = 'CarbonLens logo';
  logo.width = 36;
  logo.height = 36;

  const appName = document.createElement('span');
  appName.classList.add('nav__app-name');
  appName.textContent = 'CarbonLens';

  brand.appendChild(logo);
  brand.appendChild(appName);
  nav.appendChild(brand);

  // ── Section Label ──
  const label = document.createElement('div');
  label.classList.add('nav__label');
  label.textContent = 'Menu';
  label.id = 'nav-menu-label';
  nav.appendChild(label);

  // ── Nav List ──
  const list = document.createElement('ul');
  list.classList.add('nav__list');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-labelledby', 'nav-menu-label');

  /** @type {Map<string, HTMLElement>} */
  const navItemMap = new Map();

  for (const item of NAV_ITEMS) {
    const li = document.createElement('li');

    const button = document.createElement('button');
    button.classList.add('nav__item');
    button.setAttribute('aria-label', `Navigate to ${item.label}`);
    button.setAttribute('data-path', item.path);
    button.type = 'button';

    const iconSpan = document.createElement('span');
    iconSpan.classList.add('nav__item-icon');
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = item.icon;

    const labelSpan = document.createElement('span');
    labelSpan.classList.add('nav__item-label');
    labelSpan.textContent = item.label;

    button.appendChild(iconSpan);
    button.appendChild(labelSpan);

    button.addEventListener('click', () => {
      onNavigate(item.path);
      // Close mobile nav if open
      nav.classList.remove('nav--open');
    });

    li.appendChild(button);
    list.appendChild(li);
    navItemMap.set(item.path, button);
  }

  nav.appendChild(list);

  // ── Footer: Theme Toggle ──
  const footer = document.createElement('div');
  footer.classList.add('nav__footer');

  const themeBtn = document.createElement('button');
  themeBtn.classList.add('nav__item');
  themeBtn.type = 'button';
  themeBtn.setAttribute('aria-label', 'Toggle light and dark theme');

  const themeIcon = document.createElement('span');
  themeIcon.classList.add('nav__item-icon');
  themeIcon.setAttribute('aria-hidden', 'true');
  themeIcon.textContent = '🌙';

  const themeLabel = document.createElement('span');
  themeLabel.classList.add('nav__item-label');
  themeLabel.textContent = 'Dark Mode';

  themeBtn.appendChild(themeIcon);
  themeBtn.appendChild(themeLabel);

  themeBtn.addEventListener('click', () => {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);

    themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    themeLabel.textContent = newTheme === 'dark' ? 'Dark Mode' : 'Light Mode';

    // Persist preference
    try {
      localStorage.setItem('carbonlens-theme', newTheme);
    } catch {
      // Storage may be unavailable
    }
  });

  footer.appendChild(themeBtn);
  nav.appendChild(footer);

  /**
   * Update the active nav item highlight.
   * @param {string} path - Currently active route path
   */
  function setActive(path) {
    for (const [itemPath, button] of navItemMap) {
      if (itemPath === path) {
        button.classList.add('nav__item--active');
        button.setAttribute('aria-current', 'page');
      } else {
        button.classList.remove('nav__item--active');
        button.removeAttribute('aria-current');
      }
    }
  }

  function destroy() {
    navItemMap.clear();
  }

  return { element: nav, setActive, destroy };
}

/* --------------------------------------------------------------------------
   Mobile Menu Toggle
   -------------------------------------------------------------------------- */

/**
 * Create the mobile header bar with hamburger menu button.
 * @param {HTMLElement} navElement - The sidebar nav element to toggle
 * @returns {HTMLElement}
 */
function createMobileHeader(navElement) {
  const header = document.createElement('header');
  header.classList.add('app-header-mobile');

  const menuBtn = document.createElement('button');
  menuBtn.classList.add('btn', 'btn--ghost', 'btn--icon');
  menuBtn.type = 'button';
  menuBtn.setAttribute('aria-label', 'Open navigation menu');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.textContent = '☰';

  menuBtn.addEventListener('click', () => {
    const isOpen = navElement.classList.toggle('nav--open');
    menuBtn.setAttribute('aria-expanded', String(isOpen));
    menuBtn.textContent = isOpen ? '✕' : '☰';
  });

  const brandText = document.createElement('span');
  brandText.classList.add('nav__app-name');
  brandText.textContent = 'CarbonLens';

  // Spacer
  const spacer = document.createElement('span');

  header.appendChild(menuBtn);
  header.appendChild(brandText);
  header.appendChild(spacer);

  return header;
}

/* --------------------------------------------------------------------------
   App Factory
   -------------------------------------------------------------------------- */

/**
 * Create the CarbonLens application instance.
 *
 * @returns {{ mount: (container: HTMLElement) => void, unmount: () => void }}
 *
 * @example
 * const app = createApp();
 * app.mount(document.getElementById('app'));
 */
export function createApp() {
  /** @type {import('./router.js').Router|null} */
  let router = null;
  let navigation = null;
  let containerEl = null;

  /**
   * Mount the application into a container element.
   * @param {HTMLElement} container - The #app element
   */
  function mount(container) {
    if (!container) {
      throw new Error('[App] Mount container is required');
    }
    containerEl = container;

    // ── Restore theme preference ──
    try {
      const savedTheme = localStorage.getItem('carbonlens-theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
    } catch {
      // Storage may be unavailable
    }

    // ── Build App Layout ──
    const layout = document.createElement('div');
    layout.classList.add('app-layout');

    // Sidebar
    const sidebarWrapper = document.createElement('div');
    sidebarWrapper.classList.add('app-layout__sidebar');

    navigation = createNavigation((path) => {
      if (router) {
        router.navigate(path);
      }
    });
    sidebarWrapper.appendChild(navigation.element);

    // Mobile header
    const mobileHeader = createMobileHeader(navigation.element);

    // Main content area
    const main = document.createElement('main');
    main.id = 'main-content';
    main.classList.add('app-layout__main');
    main.setAttribute('tabindex', '-1');
    main.setAttribute('role', 'main');
    main.setAttribute('aria-label', 'Main content');

    layout.appendChild(sidebarWrapper);
    layout.appendChild(main);

    container.appendChild(mobileHeader);
    container.appendChild(layout);

    // ── Initialize Router ──
    router = createRouter(ROUTES, main);

    // Sync nav active state with current route
    const syncNav = () => {
      const currentRoute = router.getCurrentRoute();
      if (currentRoute && navigation) {
        navigation.setActive(currentRoute.path);
      }
    };

    // Sync on hash change
    window.addEventListener('hashchange', syncNav);
    syncNav(); // Initial sync

    // Store reference for cleanup
    container._cleanupHashSync = () => {
      window.removeEventListener('hashchange', syncNav);
    };
  }

  /**
   * Unmount the application and clean up resources.
   */
  function unmount() {
    if (router) {
      router.destroy();
      router = null;
    }

    if (navigation) {
      navigation.destroy();
      navigation = null;
    }

    if (containerEl) {
      if (typeof containerEl._cleanupHashSync === 'function') {
        containerEl._cleanupHashSync();
        delete containerEl._cleanupHashSync;
      }
      while (containerEl.firstChild) {
        containerEl.removeChild(containerEl.firstChild);
      }
      containerEl = null;
    }
  }

  return Object.freeze({ mount, unmount });
}
