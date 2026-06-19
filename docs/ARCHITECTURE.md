# Architecture

> Detailed technical architecture of the CarbonLens application.

---

## Table of Contents

- [System Overview](#system-overview)
- [Module Dependency Graph](#module-dependency-graph)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [Security Architecture](#security-architecture)
- [Performance Optimisations](#performance-optimisations)
- [Accessibility Approach](#accessibility-approach)

---

## System Overview

CarbonLens is a **single-page application (SPA)** built with vanilla ES Modules — no framework. It runs entirely in the browser with zero server dependencies.

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser                                │
│                                                                 │
│  ┌──────────┐   ┌────────────┐   ┌─────────────┐               │
│  │  Router   │──▶│ Components │──▶│   DOM       │               │
│  │ (app.js)  │   │ (views)    │   │ (rendered)  │               │
│  └────┬─────┘   └─────┬──────┘   └─────────────┘               │
│       │               │                                         │
│       │         ┌─────▼──────┐                                  │
│       │         │   Store    │◀──── localStorage (persisted)    │
│       │         │ (reactive) │                                  │
│       │         └─────┬──────┘                                  │
│       │               │                                         │
│  ┌────▼───────────────▼──────────────────────────────────┐      │
│  │                    Utils Layer                         │      │
│  │  ┌────────────┐ ┌───────────┐ ┌──────────┐           │      │
│  │  │ calculator │ │ validation│ │ insights │           │      │
│  │  ├────────────┤ ├───────────┤ ├──────────┤           │      │
│  │  │  goals     │ │  crypto   │ │  format  │           │      │
│  │  └────────────┘ └───────────┘ └──────────┘           │      │
│  └───────────────────────┬───────────────────────────────┘      │
│                          │                                      │
│                 ┌────────▼────────┐                              │
│                 │ emission-factors│                              │
│                 │   (data layer)  │                              │
│                 └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Dependency Graph

```
app.js
├── components/dashboard.js
│   ├── utils/calculator.js
│   │   └── data/emission-factors.js
│   ├── utils/format.js
│   └── state/store.js
├── components/activity-form.js
│   ├── utils/validation.js
│   │   └── data/emission-factors.js
│   ├── utils/calculator.js
│   └── state/store.js
├── components/goal-card.js
│   ├── utils/goals.js
│   ├── utils/format.js
│   └── state/store.js
├── components/insights-panel.js
│   ├── utils/insights.js
│   └── state/store.js
└── components/settings.js
    └── state/store.js
```

### Key Principles

- **No circular dependencies** — strict top-down dependency tree
- **Data layer is leaf** — `emission-factors.js` has zero imports
- **Utils are pure** — no side effects, no DOM access
- **Components own DOM** — only component modules touch the DOM
- **Store is the single source of truth** — components read from and write to the store

---

## Data Flow

```
User Action
    │
    ▼
┌──────────────┐     ┌───────────────┐     ┌─────────────┐
│  Component   │────▶│  validation   │────▶│    Store     │
│  (captures   │     │  (sanitise &  │     │  (setState)  │
│   input)     │     │   validate)   │     └──────┬──────┘
└──────────────┘     └───────────────┘            │
                                                  │ notify subscribers
                                                  ▼
                                         ┌─────────────────┐
                                         │   Components     │
                                         │   (re-render)    │
                                         └────────┬────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │   calculator /   │
                                         │   insights /     │
                                         │   goals          │
                                         │   (derive data)  │
                                         └────────┬────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │    format        │
                                         │   (display)      │
                                         └─────────────────┘
```

### Flow Summary

1. **Capture** — Component captures user action (click, form submit)
2. **Validate** — Input is sanitised and validated before entering the system
3. **Store** — Valid data is written to the reactive store
4. **Notify** — Store notifies all subscribers of the state change
5. **Derive** — Components call calculator / insights / goals to compute derived data
6. **Render** — Components update the DOM using safe APIs (`createElement`, `textContent`)

---

## State Management

### Store Design

The store (`src/state/store.js`) follows a minimal reactive pattern:

```
┌────────────────────────────────────────────┐
│                   Store                     │
│                                            │
│  state: { activities, goals, settings }    │
│                                            │
│  getState()  → deep clone of state         │
│  setState()  → merge + notify + persist    │
│  subscribe() → register listener           │
│  reset()     → restore defaults + notify   │
│                                            │
│  ┌────────────────────────────────────┐    │
│  │        Persistence Layer           │    │
│  │  setState → JSON → obfuscate       │    │
│  │          → localStorage.setItem    │    │
│  │                                    │    │
│  │  init    → localStorage.getItem    │    │
│  │          → deobfuscate → JSON      │    │
│  │          → merge with defaults     │    │
│  └────────────────────────────────────┘    │
└────────────────────────────────────────────┘
```

### State Shape

```javascript
{
  activities: [
    {
      id: "uuid",
      category: "transport",
      type: "car",
      amount: 10,
      unit: "km",
      emission: 2.31,       // calculated kg CO₂e
      date: "2025-06-15",
      description: "Commute"
    }
  ],
  goals: [
    {
      id: "uuid",
      title: "Reduce transport",
      category: "transport",
      targetReduction: 100,
      currentReduction: 45,
      progress: 45,
      deadline: "2025-12-31",
      milestones: [
        { percent: 25, target: 25, achieved: true },
        { percent: 50, target: 50, achieved: false },
        ...
      ],
      createdAt: "2025-06-01"
    }
  ],
  settings: {
    theme: "light",    // "light" | "dark"
    region: "world"    // "world" | "us" | "eu" | "uk" | "india" | "china"
  }
}
```

### Immutability

- `getState()` returns a **deep clone** — external mutation cannot corrupt internal state
- `setState()` performs a **shallow merge** — only the provided keys are updated
- Subscribers receive a fresh clone of the new state

---

## Security Architecture

```
                    User Input
                        │
                        ▼
               ┌────────────────┐
               │ sanitizeString │  ← strip tags, trim, max length
               └───────┬────────┘
                        │
                        ▼
               ┌────────────────┐
               │validateActivity│  ← type-check, range-check, category allowlist
               └───────┬────────┘
                        │
                        ▼
               ┌────────────────┐
               │   escapeHtml   │  ← before rendering to DOM (defense-in-depth)
               └───────┬────────┘
                        │
                        ▼
               ┌────────────────┐
               │  textContent   │  ← safe DOM insertion (never innerHTML)
               └────────────────┘
```

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| XSS (stored) | Input sanitisation + no innerHTML |
| XSS (reflected) | Client-only app, no URL parameter injection |
| Prototype pollution | Key allowlisting, `Object.create(null)` |
| Data tampering | Obfuscation + validation on load |
| Data exfiltration | No network calls, CSP headers |

---

## Performance Optimisations

| Technique | Where | Impact |
|-----------|-------|--------|
| **Lazy loading** | Chart.js loaded on demand | Faster initial load |
| **Debounced inputs** | Activity form amount field | Reduced re-renders |
| **Manual chunks** | `chart.js` in separate Vite chunk | Better caching |
| **Pure functions** | calculator, format, validation | Memoisation-friendly |
| **Minimal DOM updates** | Components diff state before re-render | Less layout thrash |
| **Source maps** | Production build with sourcemaps | Debug without bloat |

### Bundle Strategy

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js        # App code (~15 KB gzipped)
│   ├── chart-[hash].js        # Chart.js (~50 KB gzipped, lazy)
│   └── style-[hash].css       # Styles (~3 KB gzipped)
```

---

## Accessibility Approach

### Semantic Structure

```html
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header role="banner">
    <nav role="navigation" aria-label="Main navigation">…</nav>
  </header>
  <main id="main-content" role="main" aria-label="Main content">
    <div id="sr-announcements" role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>
    <!-- Page content -->
  </main>
  <footer role="contentinfo">…</footer>
</body>
```

### Checklist

| Requirement | Implementation |
|-------------|---------------|
| Skip link | First focusable element → `#main-content` |
| Landmarks | `banner`, `navigation`, `main`, `contentinfo` |
| Live region | `aria-live="polite"` for route changes & alerts |
| Focus trap | Modal captures Tab / Shift+Tab |
| Labels | Every `<input>` has a `<label for="">` + `aria-label` |
| Contrast | 4.5:1 minimum (verified with axe) |
| Motion | `prefers-reduced-motion: reduce` disables animations |
| Keyboard | All flows completable via keyboard alone |

---

*Last updated: 2025-06-15*
