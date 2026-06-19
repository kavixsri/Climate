/**
 * @fileoverview CarbonLens — Application Entry Point.
 *
 * Bootstraps the app by initializing storage, creating the store,
 * mounting the application, registering the service worker, and
 * setting up global error handlers.
 *
 * @module main
 */

import './styles/index.css';
import { createApp } from './app.js';
import { createStore } from './store/store.js';
import { createStorage } from './store/storage.js';

/** App version — update on each release */
const APP_VERSION = '1.0.0';

/**
 * Initialize and start the CarbonLens application.
 * Handles storage init, store creation, app mounting, and error handlers.
 */
async function init() {
  const startTime = performance.now();

  try {
    // ── Mount the App ──
    const appContainer = document.getElementById('app');
    if (!appContainer) {
      throw new Error('Could not find #app element in the DOM');
    }

    // ── Initialize Store ──
    const storage = createStorage('app');
    createStore(storage);

    const app = createApp();
    app.mount(appContainer);

    // ── Register Service Worker ──
    registerServiceWorker();

    // ── Log Initialization ──
    const elapsed = (performance.now() - startTime).toFixed(1);
    console.log(
      `%c🌿 CarbonLens v${APP_VERSION}%c initialized in ${elapsed}ms`,
      'color: #22c55e; font-weight: bold; font-size: 14px;',
      'color: #94a3b8; font-size: 12px;'
    );
  } catch (err) {
    console.error('[CarbonLens] Initialization failed:', err);

    // Show a minimal error UI
    const appContainer = document.getElementById('app');
    if (appContainer) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText =
        'display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center;';

      const errorContent = document.createElement('div');

      const heading = document.createElement('h1');
      heading.style.cssText = 'color:#ef4444;margin-bottom:1rem;font-size:1.5rem;';
      heading.textContent = 'Failed to Start';

      const message = document.createElement('p');
      message.style.cssText = 'color:#94a3b8;max-width:400px;';
      message.textContent =
        'CarbonLens encountered an error during initialization. Please refresh the page or try again later.';

      const reloadBtn = document.createElement('button');
      reloadBtn.style.cssText =
        'margin-top:1.5rem;padding:0.625rem 1.25rem;background:#22c55e;color:#fff;border:none;border-radius:0.5rem;cursor:pointer;font-weight:600;';
      reloadBtn.textContent = 'Reload Page';
      reloadBtn.addEventListener('click', () => window.location.reload());

      errorContent.appendChild(heading);
      errorContent.appendChild(message);
      errorContent.appendChild(reloadBtn);
      errorDiv.appendChild(errorContent);

      while (appContainer.firstChild) {
        appContainer.removeChild(appContainer.firstChild);
      }
      appContainer.appendChild(errorDiv);
    }
  }
}

/**
 * Register the service worker for offline PWA support.
 * Only registers in production-like environments with serviceWorker support.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported in this browser');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        console.log('[SW] Registered with scope:', registration.scope);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                console.log('[SW] New version available — refresh to update');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  });
}

/* --------------------------------------------------------------------------
   Global Error Handlers
   -------------------------------------------------------------------------- */

/**
 * Catch uncaught errors globally.
 */
window.addEventListener('error', (event) => {
  console.error('[CarbonLens] Uncaught error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

/**
 * Catch unhandled promise rejections.
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('[CarbonLens] Unhandled rejection:', event.reason);
  // Prevent default browser handling
  event.preventDefault();
});

/* --------------------------------------------------------------------------
   Bootstrap
   -------------------------------------------------------------------------- */
init();
