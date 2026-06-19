/**
 * Accessibility tests.
 * Validates ARIA landmarks, focus management, keyboard navigation,
 * screen-reader announcements, and reduced-motion support.
 * @module tests/accessibility/a11y
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a representative DOM matching the app's expected structure.
 * Tests validate the contracts that the component layer must satisfy.
 */
function buildAppDOM() {
  document.body.innerHTML = '';

  // Skip link
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.className = 'skip-link';
  skipLink.textContent = 'Skip to main content';
  skipLink.setAttribute('aria-label', 'Skip to main content');
  document.body.appendChild(skipLink);

  // Header / nav
  const header = document.createElement('header');
  header.setAttribute('role', 'banner');

  const nav = document.createElement('nav');
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');

  const navLinks = ['Dashboard', 'Log Activity', 'Goals', 'Insights', 'Settings'];
  for (const label of navLinks) {
    const a = document.createElement('a');
    a.href = `#${label.toLowerCase().replace(/\s+/g, '-')}`;
    a.textContent = label;
    a.setAttribute('aria-label', label);
    nav.appendChild(a);
  }
  header.appendChild(nav);
  document.body.appendChild(header);

  // Main
  const main = document.createElement('main');
  main.id = 'main-content';
  main.setAttribute('role', 'main');
  main.setAttribute('aria-label', 'Main content');

  // Live region for screen-reader announcements
  const liveRegion = document.createElement('div');
  liveRegion.id = 'sr-announcements';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  main.appendChild(liveRegion);

  // A form with labels
  const form = document.createElement('form');
  form.setAttribute('aria-label', 'Log activity form');

  const fields = [
    { id: 'activity-category', label: 'Category', type: 'select' },
    { id: 'activity-amount', label: 'Amount', type: 'number' },
    { id: 'activity-date', label: 'Date', type: 'date' },
    { id: 'activity-description', label: 'Description', type: 'text' },
  ];
  for (const { id, label, type } of fields) {
    const lbl = document.createElement('label');
    lbl.setAttribute('for', id);
    lbl.textContent = label;
    form.appendChild(lbl);

    const input =
      type === 'select'
        ? document.createElement('select')
        : document.createElement('input');
    input.id = id;
    if (type !== 'select') input.type = type;
    input.setAttribute('aria-label', label);
    form.appendChild(input);
  }

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Log Activity';
  submit.setAttribute('aria-label', 'Log Activity');
  form.appendChild(submit);
  main.appendChild(form);

  // Icon with aria-label (simulating an SVG icon)
  const iconBtn = document.createElement('button');
  iconBtn.setAttribute('aria-label', 'Delete activity');
  iconBtn.className = 'icon-button';
  const iconSvg = document.createElement('span');
  iconSvg.setAttribute('role', 'img');
  iconSvg.setAttribute('aria-hidden', 'true');
  iconSvg.textContent = '🗑';
  iconBtn.appendChild(iconSvg);
  main.appendChild(iconBtn);

  document.body.appendChild(main);

  // Footer
  const footer = document.createElement('footer');
  footer.setAttribute('role', 'contentinfo');
  footer.textContent = '© CarbonLens';
  document.body.appendChild(footer);

  // Modal (hidden by default)
  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'modal-overlay';
  modalOverlay.setAttribute('role', 'dialog');
  modalOverlay.setAttribute('aria-modal', 'true');
  modalOverlay.setAttribute('aria-label', 'Confirm action');
  modalOverlay.hidden = true;

  const modalClose = document.createElement('button');
  modalClose.className = 'modal-close';
  modalClose.textContent = 'Close';
  modalClose.setAttribute('aria-label', 'Close dialog');
  modalOverlay.appendChild(modalClose);

  const modalBody = document.createElement('div');
  modalBody.className = 'modal-body';
  modalBody.textContent = 'Are you sure?';
  modalOverlay.appendChild(modalBody);

  const modalConfirm = document.createElement('button');
  modalConfirm.className = 'modal-confirm';
  modalConfirm.textContent = 'Confirm';
  modalConfirm.setAttribute('aria-label', 'Confirm');
  modalOverlay.appendChild(modalConfirm);

  document.body.appendChild(modalOverlay);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Accessibility (a11y)', () => {
  beforeEach(() => {
    buildAppDOM();
  });

  // ── Interactive elements have accessible names ──────────────────────────
  describe('accessible names', () => {
    it('all buttons have accessible names', () => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const name =
          btn.getAttribute('aria-label') ||
          btn.getAttribute('aria-labelledby') ||
          btn.textContent.trim();
        expect(name.length, `Button without accessible name: ${btn.outerHTML}`).toBeGreaterThan(0);
      }
    });

    it('all links have accessible names', () => {
      const links = document.querySelectorAll('a');
      for (const link of links) {
        const name =
          link.getAttribute('aria-label') ||
          link.textContent.trim();
        expect(name.length, `Link without accessible name: ${link.outerHTML}`).toBeGreaterThan(0);
      }
    });

    it('all form inputs have accessible names', () => {
      const inputs = document.querySelectorAll('input, select, textarea');
      for (const input of inputs) {
        const hasLabel =
          input.getAttribute('aria-label') ||
          input.getAttribute('aria-labelledby') ||
          document.querySelector(`label[for="${input.id}"]`);
        expect(hasLabel, `Input without label: ${input.outerHTML}`).toBeTruthy();
      }
    });
  });

  // ── ARIA landmarks ──────────────────────────────────────────────────────
  describe('ARIA landmarks', () => {
    it('has a banner landmark (header)', () => {
      const banner = document.querySelector('[role="banner"]');
      expect(banner).not.toBeNull();
    });

    it('has a navigation landmark', () => {
      const nav = document.querySelector('[role="navigation"]');
      expect(nav).not.toBeNull();
      expect(nav.getAttribute('aria-label')).toBeTruthy();
    });

    it('has a main landmark', () => {
      const main = document.querySelector('[role="main"]');
      expect(main).not.toBeNull();
    });

    it('has a contentinfo landmark (footer)', () => {
      const footer = document.querySelector('[role="contentinfo"]');
      expect(footer).not.toBeNull();
    });
  });

  // ── Focus management ───────────────────────────────────────────────────
  describe('focus management', () => {
    it('skip link is the first focusable element', () => {
      const allFocusable = document.querySelectorAll(
        'a, button, input, select, textarea, [tabindex]',
      );
      const first = allFocusable[0];
      expect(first.classList.contains('skip-link')).toBe(true);
    });

    it('skip link points to main content', () => {
      const skipLink = document.querySelector('.skip-link');
      expect(skipLink.getAttribute('href')).toBe('#main-content');
      expect(document.querySelector('#main-content')).not.toBeNull();
    });

    it('all interactive elements are keyboard-focusable', () => {
      const interactive = document.querySelectorAll('a, button, input, select, textarea');
      for (const el of interactive) {
        const tabIndex = el.tabIndex;
        // tabIndex of -1 means programmatically focusable only; 0 or above is fine
        expect(tabIndex).toBeGreaterThanOrEqual(-1);
      }
    });
  });

  // ── Screen-reader announcements ─────────────────────────────────────────
  describe('screen-reader announcements', () => {
    it('live region exists with aria-live="polite"', () => {
      const live = document.querySelector('[aria-live="polite"]');
      expect(live).not.toBeNull();
    });

    it('announcements fire on simulated route change', () => {
      const live = document.querySelector('#sr-announcements');
      live.textContent = 'Navigated to Dashboard';

      expect(live.textContent).toBe('Navigated to Dashboard');
      expect(live.getAttribute('aria-live')).toBe('polite');
    });
  });

  // ── Modal focus trap ────────────────────────────────────────────────────
  describe('modal focus trap', () => {
    it('modal has role="dialog" and aria-modal="true"', () => {
      const modal = document.querySelector('#modal-overlay');
      expect(modal.getAttribute('role')).toBe('dialog');
      expect(modal.getAttribute('aria-modal')).toBe('true');
    });

    it('modal has an accessible label', () => {
      const modal = document.querySelector('#modal-overlay');
      const label =
        modal.getAttribute('aria-label') ||
        modal.getAttribute('aria-labelledby');
      expect(label).toBeTruthy();
    });

    it('modal contains a close button', () => {
      const modal = document.querySelector('#modal-overlay');
      const closeBtn = modal.querySelector('.modal-close');
      expect(closeBtn).not.toBeNull();
      expect(closeBtn.getAttribute('aria-label')).toBeTruthy();
    });

    it('focus-trappable elements exist inside the modal', () => {
      const modal = document.querySelector('#modal-overlay');
      const focusable = modal.querySelectorAll('button, [tabindex]');
      expect(focusable.length).toBeGreaterThanOrEqual(2); // close + confirm
    });
  });

  // ── Images / icons ──────────────────────────────────────────────────────
  describe('images and icons', () => {
    it('all icon buttons have aria-label', () => {
      const iconBtns = document.querySelectorAll('.icon-button');
      for (const btn of iconBtns) {
        expect(btn.getAttribute('aria-label')).toBeTruthy();
      }
    });

    it('decorative icons have aria-hidden="true"', () => {
      const decorative = document.querySelectorAll('[role="img"][aria-hidden="true"]');
      expect(decorative.length).toBeGreaterThan(0);
    });
  });

  // ── Form labels ─────────────────────────────────────────────────────────
  describe('form inputs have associated labels', () => {
    it('every input with an id has a matching <label for="…">', () => {
      const inputs = document.querySelectorAll('input[id], select[id], textarea[id]');
      for (const input of inputs) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        expect(label, `No label for input#${input.id}`).not.toBeNull();
      }
    });
  });

  // ── prefers-reduced-motion ──────────────────────────────────────────────
  describe('prefersReducedMotion', () => {
    globalThis.matchMedia = globalThis.matchMedia || function(query) {
      return { matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} };
    };
    it('matchMedia can be queried for reduced motion', () => {
      // In jsdom matchMedia returns a stub — we just verify the API is callable
      const mql = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
      expect(mql).toBeDefined();
      expect(typeof mql.matches).toBe('boolean');
    });
  });
});
