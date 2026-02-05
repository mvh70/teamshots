---
status: pending
priority: p2
issue_id: "005"
tags: [security, headers, cache-poisoning]
dependencies: []
---

# Add Host Header Validation for Brand Detection

## Problem Statement

Brand detection relies on the `Host` header without validation against a whitelist. This could lead to web cache poisoning if responses are cached based on Host header, and potential brand confusion attacks.

## Findings

- **Location**: `src/config/brand.ts` lines 330-351
- **Location**: `src/app/[locale]/(product)/app/layout.tsx` lines 72-74
- Current implementation:
  ```typescript
  const host = headersList.get('host') || headersList.get('x-forwarded-host')
  const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
  ```
- Uses `x-forwarded-host` which could be spoofed if proxy isn't properly configured
- No whitelist validation of allowed domains
- Could lead to cache poisoning in CDN/proxy configurations

## Proposed Solutions

### Option 1: Add Domain Whitelist Validation (Recommended)

**Approach**: Validate Host header against known allowed domains before processing.

**Pros:**
- Prevents cache poisoning
- Explicit security boundary
- Easy to audit

**Cons:**
- Requires maintaining whitelist
- New domains require config update

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Use Environment Variable for Allowed Domains

**Approach**: Configure allowed domains via environment variable.

**Pros:**
- Configurable per environment
- No code changes for new domains

**Cons:**
- More complex setup
- Still requires validation logic

**Effort:** 1 hour

**Risk:** Low

---

### Option 3: Set Vary Headers

**Approach**: Add explicit Vary headers to prevent caching issues.

**Pros:**
- Prevents cache poisoning at CDN level
- Standard HTTP practice

**Cons:**
- Doesn't address root cause
- Only helps if cache respects Vary

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

Implement Option 1 with Option 3 as additional defense. Add domain whitelist validation and set appropriate Vary headers.

**Example implementation:**
```typescript
const ALLOWED_DOMAINS = [
  'teamshotspro.com',
  'photoshotspro.com',
  'rightclickfit.com',
  'localhost',
  // ... etc
]

function normalizeDomain(host: string | null): string | null {
  if (!host) return null
  const domain = host.split(':')[0].replace(/^www\./, '').toLowerCase()
  return ALLOWED_DOMAINS.includes(domain) ? domain : null
}
```

## Technical Details

**Affected files:**
- `src/config/brand.ts:330-351`
- `src/app/[locale]/(product)/app/layout.tsx:72-74`
- Middleware or headers config for Vary header

## Resources

- **Security Review**: Security Sentinel identified as medium risk
- **OWASP**: https://owasp.org/www-community/attacks/Cache_Poisoning

## Acceptance Criteria

- [ ] Domain whitelist validation implemented
- [ ] Invalid domains fall back to default safely
- [ ] Vary: Host header added to responses
- [ ] x-forwarded-host properly validated if used
- [ ] Security tests added for domain validation

## Work Log

### 2026-02-01 - Initial Discovery

**By:** Claude Code (Security Sentinel)

**Actions:**
- Identified Host header-based brand detection
- Analyzed cache poisoning risks
- Documented validation approaches

**Learnings:**
- Host header manipulation is a real attack vector in some configurations
- Defense in depth (whitelist + Vary headers) is best practice
- x-forwarded-host requires careful validation
