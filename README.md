# CarbonLens 🌿

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-80%25-yellowgreen)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Accessibility](https://img.shields.io/badge/a11y-WCAG%202.1%20AA-green)

> **Track, understand, and reduce your personal carbon footprint with data-driven insights and actionable recommendations.**

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 📊 | **Dashboard** | Real-time overview of your carbon footprint with interactive Chart.js visualisations |
| ✏️ | **Activity Logging** | Log emissions across transport, energy, food, shopping, and waste categories |
| 🎯 | **Goal Setting** | Set reduction targets with auto-generated milestones at 25 / 50 / 75 / 100 % |
| 💡 | **Personalised Insights** | AI-ranked suggestions prioritised by impact and ease of implementation |
| 📈 | **Trend Analysis** | Track progress over time with increasing / decreasing / stable trend detection |
| 🌍 | **Regional Benchmarks** | Compare your footprint against world, US, EU, UK, India, and China averages |
| 🔒 | **Privacy First** | All data stays in your browser — no server, no tracking |
| ♿ | **Fully Accessible** | WCAG 2.1 AA compliant with keyboard navigation, ARIA landmarks, and screen-reader support |
| 🎨 | **Theming** | Light and dark mode with `prefers-color-scheme` support |

---

## 📸 Screenshots

> _Screenshots will be added after the first visual milestone._

| Dashboard | Activity Logger | Insights |
|-----------|----------------|----------|
| _coming soon_ | _coming soon_ | _coming soon_ |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9 (or **pnpm** / **yarn**)

### Install

```bash
git clone https://github.com/kavixsri/Climate.git
cd Climate
npm install
```

### Development

```bash
npm run dev        # Start Vite dev server on http://localhost:3000
```

### Build

```bash
npm run build      # Production build → dist/
npm run preview    # Preview the production build
```

### Test

```bash
npm test                # Run all tests once
npm run test:watch      # Watch mode
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
npm run test:security   # Security tests only
npm run test:a11y       # Accessibility tests only
npm run test:coverage   # With V8 coverage report
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Build** | [Vite 6](https://vitejs.dev/) |
| **Charts** | [Chart.js 4](https://www.chartjs.org/) |
| **Testing** | [Vitest 3](https://vitest.dev/) + jsdom |
| **Coverage** | [@vitest/coverage-v8](https://vitest.dev/guide/coverage) |
| **Linting** | ESLint 9 |
| **Formatting** | Prettier 3 |
| **Language** | Vanilla ES Modules (no framework) |

---

## 🏗 Architecture Overview

```
src/
├── components/          # UI components (DOM-based, no innerHTML)
│   ├── dashboard.js
│   ├── activity-form.js
│   ├── goal-card.js
│   └── insights-panel.js
├── data/
│   └── emission-factors.js  # EPA / IPCC emission factor database
├── state/
│   └── store.js             # Reactive state with localStorage persistence
├── utils/
│   ├── calculator.js        # Emission calculations & projections
│   ├── validation.js        # Input sanitisation & security
│   ├── insights.js          # Personalised recommendation engine
│   ├── goals.js             # Goal & milestone management
│   ├── crypto.js            # Data obfuscation & ID generation
│   └── format.js            # Display formatting helpers
├── styles/
│   └── main.css             # CSS with custom properties & prefers-*
└── app.js                   # Entry point & router
```

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for a detailed deep-dive.

---

## 🧪 Testing

Tests are organised into four suites:

| Suite | Path | Purpose |
|-------|------|---------|
| **Unit** | `tests/unit/` | Individual module correctness |
| **Integration** | `tests/integration/` | Cross-module workflows |
| **Security** | `tests/security/` | XSS, injection, prototype pollution |
| **Accessibility** | `tests/accessibility/` | ARIA, focus, keyboard, screen readers |

**Coverage thresholds** (enforced in CI):

- Statements: **80 %**
- Branches: **75 %**
- Functions: **80 %**
- Lines: **80 %**

---

## ♿ Accessibility

CarbonLens follows **WCAG 2.1 Level AA** guidelines:

- Semantic HTML5 (`<header>`, `<nav>`, `<main>`, `<footer>`)
- ARIA landmarks, labels, and live regions
- Skip-to-content link
- Modal focus trapping
- Keyboard-navigable throughout
- `prefers-reduced-motion` honoured
- Minimum **4.5:1** contrast ratio

---

## 🔒 Security

- **No `innerHTML`, `eval()`, `document.write()`, or inline event handlers** — DOM API only
- All user input is sanitised via `validation.js`
- HTML entities are escaped before display
- Data is obfuscated before storage
- Content Security Policy (CSP) headers recommended for deployment
- Prototype pollution vectors are blocked

See **[SECURITY.md](SECURITY.md)** for the full security policy.

---

## 📚 Data Sources

All emission factors are sourced from peer-reviewed and governmental publications:

| Source | Used For |
|--------|----------|
| [US EPA GHG Emission Factors Hub](https://www.epa.gov/ghgemissions) | Transport, energy, waste |
| [IPCC AR6 (2021)](https://www.ipcc.ch/assessment-report/ar6/) | Global warming potentials |
| [Poore & Nemecek (2018), *Science*](https://doi.org/10.1126/science.aaq0216) | Food emissions |
| [WRAP UK](https://wrap.org.uk/) | Waste & recycling |
| [World Bank Open Data](https://data.worldbank.org/) | Per-capita national averages |

See **[docs/EMISSION_SOURCES.md](docs/EMISSION_SOURCES.md)** for the complete reference table.

---

## 🤝 Contributing

Contributions are welcome! Please read **[CONTRIBUTING.md](CONTRIBUTING.md)** before submitting a PR.

---

## 📄 License

This project is licensed under the **MIT License** — see the **[LICENSE](LICENSE)** file for details.

---

<p align="center">
  Made with 💚 for a greener planet
</p>
