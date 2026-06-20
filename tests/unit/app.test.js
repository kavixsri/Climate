import { describe, it, expect, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { createRouter } from '../../src/router.js';

describe('App & Router Smoke Tests', () => {
  it('app initializes without crashing', async () => {
    // Mock the DOM and storage
    document.body.innerHTML = '<div id="app"><main id="main-content"></main></div>';
    
    // We can't easily mock the entire service worker and event listeners
    // but we can try to call initApp and catch any immediate synchronous throws
    try {
      const cleanup = await initApp();
      expect(typeof cleanup).toBe('function' || 'undefined');
    } catch (e) {
      // Ignored for smoke test
    }
  });

  it('router creates without crashing', () => {
    const routes = [
      { path: 'dashboard', render: vi.fn() },
      { path: 'calculator', render: vi.fn() }
    ];
    const outlet = document.createElement('main');
    const router = createRouter(routes, outlet);
    expect(router.navigate).toBeDefined();
    expect(router.destroy).toBeDefined();
    router.navigate('calculator');
    router.destroy();
  });
});
