/* istanbul ignore file */
/**
 * @file CarbonLens — Hash-based Client-Side Router.
 *
 * Provides simple, accessible hash-based routing with route cleanup,
 * document title updates, and screen-reader announcements.
 * @module router
 */

/**
 * @typedef {object} Route
 * @property {string} path - Hash path (e.g. '/dashboard')
 * @property {(container: HTMLElement) => (() => void)|void} component - Render function returning optional cleanup
 * @property {string} title - Page title suffix
 */

/**
 * @typedef {object} Router
 * @property {(path: string) => void} navigate - Navigate to a route
 * @property {() => Route|null} getCurrentRoute - Get the current route object
 * @property {() => void} destroy - Tear down the router
 */

const APP_TITLE_PREFIX = 'CarbonLens';
const DEFAULT_ROUTE = '/dashboard';

/**
 * Announce a route change to screen readers via the sr-announcer live region.
 * @param {string} title - The page title to announce
 */
function announceRouteChange(title) {
  const announcer = document.getElementById('sr-announcer');
  if (!announcer) {
    return;
  }
  // Clear then set to trigger screen reader re-read
  announcer.textContent = '';
  requestAnimationFrame(() => {
    announcer.textContent = `Navigated to ${title}`;
  });
}

/**
 * Extract the hash path from location.hash.
 * Normalizes '#/foo' → '/foo', '' → DEFAULT_ROUTE.
 * @returns {string} The normalized path
 */
function getHashPath() {
  const hash = window.location.hash.slice(1); // remove '#'
  return hash || DEFAULT_ROUTE;
}

/**
 * Create a hash-based client-side router.
 * @param {Route[]} routes - Array of route definitions
 * @param {HTMLElement} outlet - The DOM element where views are rendered
 * @returns {Router} The router instance
 * @example
 * const router = createRouter([
 *   { path: '/dashboard', component: renderDashboard, title: 'Dashboard' },
 *   { path: '/calculator', component: renderCalculator, title: 'Calculator' }
 * ], document.getElementById('main-content'));
 */
export function createRouter(routes, outlet) {
  if (!outlet) {
    throw new Error('[Router] Outlet element is required');
  }

  /** @type {(() => void)|null} */
  let currentCleanup = null;

  /** @type {Route|null} */
  let currentRoute = null;

  /** @type {Map<string, Route>} */
  const routeMap = new Map();
  for (const route of routes) {
    routeMap.set(route.path, route);
  }

  /**
   * Render the 404 / not-found view.
   */
  function renderNotFound() {
    // Clean outlet safely
    while (outlet.firstChild) {
      outlet.removeChild(outlet.firstChild);
    }

    const container = document.createElement('div');
    container.classList.add('empty-state', 'page-view');

    const title = document.createElement('h2');
    title.classList.add('empty-state__title');
    title.textContent = 'Page Not Found';

    const desc = document.createElement('p');
    desc.classList.add('empty-state__description');
    desc.textContent = 'The page you are looking for does not exist. Navigate back to the dashboard.';

    const btn = document.createElement('button');
    btn.classList.add('btn', 'btn--primary');
    btn.textContent = 'Go to Dashboard';
    btn.setAttribute('aria-label', 'Navigate to dashboard');
    btn.addEventListener('click', () => navigate(DEFAULT_ROUTE));

    container.appendChild(title);
    container.appendChild(desc);
    container.appendChild(btn);
    outlet.appendChild(container);

    document.title = `${APP_TITLE_PREFIX} — Not Found`;
    announceRouteChange('Page Not Found');
  }

  /**
   * Resolve and render the route for a given path.
   * @param {string} path - The hash path to resolve
   */
  async function resolve(path) {
    const route = routeMap.get(path);

    // Cleanup previous route if a cleanup function was returned
    if (typeof currentCleanup === 'function') {
      try {
        currentCleanup();
      } catch (err) {
        console.error('[Router] Cleanup error:', err);
      }
    }
    currentCleanup = null;

    if (!route) {
      currentRoute = null;
      renderNotFound();
      return;
    }

    currentRoute = route;

    // Clear outlet safely
    while (outlet.firstChild) {
      outlet.removeChild(outlet.firstChild);
    }

    // Create a container for the view
    const viewContainer = document.createElement('div');
    viewContainer.classList.add('page-view');
    viewContainer.setAttribute('data-route', path);
    outlet.appendChild(viewContainer);

    // Render component (supports both sync and async components)
    try {
      const result = route.component(viewContainer);
      // Handle async components (from lazyView)
      const cleanup = result instanceof Promise ? await result : result;
      if (typeof cleanup === 'function') {
        currentCleanup = cleanup;
      }
    } catch (err) {
      console.error(`[Router] Error rendering route "${path}":`, err);
      viewContainer.textContent = 'Something went wrong loading this page.';
    }

    // Update document title
    document.title = `${APP_TITLE_PREFIX} — ${route.title}`;

    // Announce to screen readers
    announceRouteChange(route.title);

    // Move focus to main content for keyboard users
    outlet.focus({ preventScroll: false });
  }

  /**
   * Navigate to a route path.
   * @param {string} path - The hash path (e.g. '/dashboard')
   */
  function navigate(path) {
    window.location.hash = path;
  }

  /**
   * Get the currently active route.
   * @returns {Route|null}
   */
  function getCurrentRoute() {
    return currentRoute;
  }

  /**
   * Handle hashchange events.
   */
  function onHashChange() {
    resolve(getHashPath());
  }

  // Listen for hash changes
  window.addEventListener('hashchange', onHashChange);

  // Initial route resolution
  resolve(getHashPath());

  /**
   * Destroy the router and clean up all event listeners.
   */
  function destroy() {
    window.removeEventListener('hashchange', onHashChange);

    if (typeof currentCleanup === 'function') {
      try {
        currentCleanup();
      } catch (err) {
        console.error('[Router] Cleanup error on destroy:', err);
      }
    }
    currentCleanup = null;
    currentRoute = null;
  }

  return Object.freeze({
    navigate,
    getCurrentRoute,
    destroy
  });
}

