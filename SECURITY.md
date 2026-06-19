# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅ Active support |
| < 1.0   | ❌ Not supported |

---

## Reporting a Vulnerability

We take security seriously. If you discover a vulnerability in CarbonLens, please follow the **responsible disclosure** process below.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities.
2. Email **security@carbonlens.example.com** with:
   - A clear description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if any)
3. You will receive an acknowledgement within **48 hours**.
4. We aim to release a patch within **7 business days** for critical issues.

### What to Expect

| Severity | Response Time | Patch Target |
|----------|--------------|--------------|
| Critical | 24 hours | 3 business days |
| High | 48 hours | 7 business days |
| Medium | 5 business days | Next release |
| Low | 10 business days | Future release |

---

## Security Measures Implemented

### 1. No Dangerous DOM APIs

CarbonLens **never** uses:

- `innerHTML`
- `outerHTML` (for setting content)
- `document.write()` / `document.writeln()`
- `eval()`
- `new Function()` from user input
- Inline event handlers (`onclick="..."`)

All DOM manipulation uses safe APIs:
- `document.createElement()`
- `element.textContent`
- `element.appendChild()`
- `element.setAttribute()` (with validated values)

### 2. Input Validation & Sanitisation

Every user input passes through `src/utils/validation.js`:

```
User Input → sanitizeString() → validateActivity() → Store
                ↓
          - Strip HTML tags
          - Trim whitespace
          - Enforce max length
          - Reject invalid categories
          - Reject negative / extreme amounts
          - Escape HTML entities for display
```

### 3. Data Obfuscation

Sensitive data stored in `localStorage` is obfuscated via `src/utils/crypto.js`:

- Data is encoded before storage
- Data is decoded on retrieval
- Not encryption — provides a barrier against casual inspection

### 4. Content Security Policy (CSP)

For production deployment, we recommend the following CSP headers:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'self';
  font-src 'self';
  object-src 'none';
  frame-src 'none';
  base-uri 'self';
  form-action 'self';
```

### 5. Prototype Pollution Prevention

- Object keys from user input are validated against an allowlist
- `Object.create(null)` is used for lookup maps where appropriate
- `__proto__`, `constructor`, and `prototype` keys are explicitly rejected

### 6. No External Data Transmission

CarbonLens is a **fully client-side** application:

- No data is sent to any server
- No analytics or tracking scripts
- No third-party API calls
- All calculations happen in the browser

---

## Responsible Disclosure Policy

- We will credit reporters (with permission) in release notes
- We will not take legal action against good-faith security researchers
- We ask that you:
  - Give us reasonable time to fix the issue before public disclosure
  - Do not access or modify other users' data
  - Do not degrade the service for others

---

## Security Testing

Run the security test suite:

```bash
npm run test:security
```

This suite covers:
- XSS payload injection (15+ attack vectors)
- SQL injection string handling
- HTML entity escaping
- String length boundary attacks
- Unicode edge cases
- Prototype pollution attempts

---

*Last updated: 2025-06-15*
