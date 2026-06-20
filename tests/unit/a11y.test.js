import { describe, it, expect, beforeEach } from 'vitest';
import { trapFocus, setAriaLive, handleKeyboardNav, skipToMain, getContrastRatio } from '../../src/utils/a11y.js';

describe('a11y utilities', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.requestAnimationFrame = (cb) => cb();
  });

  it('calculates contrast ratio correctly', () => {
    expect(getContrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(getContrastRatio('#ff0000', '#ff0000')).toBe(1);
  });

  it('sets aria-live region correctly', () => {
    const region = document.createElement('div');
    region.id = 'a11y-live-region';
    document.body.appendChild(region);

    setAriaLive(region, 'Test message', 'polite');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('Test message');

    setAriaLive(region, 'New message', 'assertive');
    expect(region.getAttribute('aria-live')).toBe('assertive');
    expect(region.textContent).toBe('New message');
  });

  it('skips to main content', () => {
    const main = document.createElement('main');
    main.id = 'main-content';
    main.scrollIntoView = () => {}; // mock
    document.body.appendChild(main);
    
    skipToMain();
    expect(document.activeElement).toBe(main);
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('traps focus inside an element', () => {
    const container = document.createElement('div');
    const btn1 = document.createElement('button');
    const btn2 = document.createElement('button');
    container.appendChild(btn1);
    container.appendChild(btn2);
    document.body.appendChild(container);

    const cleanup = trapFocus(container);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('handles keyboard navigation', () => {
    let triggered = false;
    const actions = {
      Enter: () => { triggered = true; }
    };
    
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    handleKeyboardNav(event, actions);
    expect(triggered).toBe(true);
  });
});
