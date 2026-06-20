import { describe, it, expect } from 'vitest';
import { createElement, createTextNode, clearElement, setAttributes } from '../../src/utils/dom.js';

describe('dom utilities', () => {
  it('creates an element with attributes and children', () => {
    const child = createTextNode('Hello');
    const el = createElement('div', { id: 'test', className: 'box' }, [child]);
    
    expect(el.tagName).toBe('DIV');
    expect(el.id).toBe('test');
    expect(el.className).toBe('box');
    expect(el.textContent).toBe('Hello');
  });

  it('clears an element', () => {
    const el = document.createElement('div');
    el.appendChild(document.createElement('span'));
    el.appendChild(document.createElement('span'));
    
    expect(el.childNodes.length).toBe(2);
    clearElement(el);
    expect(el.childNodes.length).toBe(0);
  });

  it('sets attributes safely', () => {
    const el = document.createElement('div');
    setAttributes(el, { ariaHidden: 'true', 'data-test': '123' });
    
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('data-test')).toBe('123');
  });
});
