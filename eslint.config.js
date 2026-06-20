import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  jsdoc.configs['flat/recommended'],
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        performance: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        Intl: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        HTMLElement: 'readonly',
        Text: 'readonly',
        DocumentFragment: 'readonly',
        MutationObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        requestIdleCallback: 'readonly',
        cancelIdleCallback: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        crypto: 'readonly',
        Promise: 'readonly',
        console: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        Object: 'readonly',
        Array: 'readonly',
        String: 'readonly',
        Number: 'readonly',
        Boolean: 'readonly',
        Date: 'readonly',
        Math: 'readonly',
        Error: 'readonly',
        DOMException: 'readonly',
        caches: 'readonly',
        self: 'readonly',
        EventTarget: 'readonly',
        Node: 'readonly',
        Element: 'readonly',
        structuredClone: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-param-description': 'off',
      'no-control-regex': 'off',
    }
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/']
  }
];
