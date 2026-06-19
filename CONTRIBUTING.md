# Contributing to CarbonLens 🌿

Thank you for considering contributing to CarbonLens! Every contribution helps make carbon tracking more accessible and effective.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Report Bugs](#how-to-report-bugs)
- [How to Suggest Features](#how-to-suggest-features)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold a welcoming, inclusive, and harassment-free community.

---

## How to Report Bugs

1. **Search existing issues** to avoid duplicates.
2. Open a new issue using the **Bug Report** template.
3. Include:
   - Clear title and description
   - Steps to reproduce
   - Expected vs. actual behaviour
   - Browser and OS information
   - Screenshots or console output (if applicable)

> **Security bugs**: Do **not** file public issues. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

---

## How to Suggest Features

1. **Search existing issues** and discussions for similar ideas.
2. Open a new issue using the **Feature Request** template.
3. Include:
   - Problem statement ("As a user, I want to…")
   - Proposed solution
   - Alternatives considered
   - Impact on accessibility and security

---

## Development Setup

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Getting Started

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/Climate.git
cd Climate

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Run tests
npm test
```

### Project Structure

```
src/
├── components/        # UI components (DOM API only)
├── data/              # Emission factor database
├── state/             # Reactive store
├── utils/             # Pure utility functions
└── styles/            # CSS with custom properties

tests/
├── unit/              # Module-level tests
├── integration/       # Cross-module workflow tests
├── security/          # XSS & injection tests
└── accessibility/     # ARIA & focus tests
```

---

## Code Style

### ESLint & Prettier

```bash
npm run lint           # Check for lint errors
npm run format         # Auto-format all source files
```

### Conventions

| Rule | Details |
|------|---------|
| **Modules** | ES Modules (`import` / `export`) — no CommonJS |
| **JSDoc** | Every exported function must have a JSDoc comment |
| **DOM** | Use `createElement`, `textContent`, `appendChild` — **never** `innerHTML` |
| **Naming** | `camelCase` for variables/functions, `PascalCase` for classes, `UPPER_SNAKE` for constants |
| **Error handling** | Always wrap risky operations in try/catch |
| **Purity** | Prefer pure functions; isolate side effects |
| **Accessibility** | Add `aria-label` to every interactive element |
| **Security** | Sanitise all user input via `validation.js` |

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add weekly emissions summary chart
fix: correct electricity emission factor unit
test: add XSS payload tests for activity description
docs: update ARCHITECTURE.md with state diagram
refactor: extract trend calculation into pure function
a11y: add aria-live region for route changes
security: block prototype pollution in store
```

---

## Testing Requirements

All pull requests **must** pass the full test suite:

```bash
npm test               # All tests must pass
npm run test:coverage  # Coverage thresholds must be met
```

### Coverage Thresholds

| Metric | Minimum |
|--------|---------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

### What to Test

| Change Type | Required Tests |
|-------------|---------------|
| New utility function | Unit test in `tests/unit/` |
| New component | Unit test + accessibility test |
| Bug fix | Regression test proving the fix |
| Security change | Security test in `tests/security/` |
| New user flow | Integration test in `tests/integration/` |

---

## Pull Request Process

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make your changes** following the code style above.

3. **Write tests** covering your changes.

4. **Run the full suite**:
   ```bash
   npm test
   npm run lint
   ```

5. **Push and open a PR** against `main`.

6. **PR checklist** (included in the template):
   - [ ] Tests pass locally
   - [ ] Coverage thresholds met
   - [ ] No `innerHTML`, `eval()`, or inline handlers
   - [ ] JSDoc on all exported functions
   - [ ] ARIA labels on interactive elements
   - [ ] Commit messages follow Conventional Commits

7. **Code review** — at least one approval required before merge.

8. **Squash and merge** to keep a clean history.

---

## Questions?

Open a [Discussion](https://github.com/kavixsri/Climate/discussions) — we're happy to help!

---

<p align="center">
  Thank you for helping make the world a little greener 💚
</p>
