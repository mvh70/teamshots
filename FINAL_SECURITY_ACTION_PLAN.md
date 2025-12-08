# TeamShots Security & Technical Action Plan
**Date:** December 8, 2025
**Status:** Consolidated from security audit + architectural reviews
**Methodology:** Verified each issue in current codebase before inclusion

---

## Executive Summary

This plan consolidates and verifies issues from:
1. SECURITY_AUDIT_REPORT_FINAL.md (34 findings)
2. CONSOLIDATED_REVIEW_AND_ACTION_PLAN.md (16 findings)

After verification against the current codebase:
- **3 CRITICAL issues** require immediate action
- **8 HIGH priority** security/functionality gaps
- **6 MEDIUM priority** technical debt items
- **Several issues already fixed** (removed from this plan)

**Estimated Timeline:**
- **Minimum viable:** 1 week (Critical only)
- **Production ready:** 3 weeks (Critical + High + Observability)
- **Optimal:** 5 weeks (All items)

---

## ✅ Already Fixed (Verified in Codebase)

These issues from the security audit have been resolved:

1. **C1 - Undefined Variable `mergedStyleSettings`** ✅
   - **Reported:** Lines 683, 701 used `mergedStyleSettings` (undefined)
   - **Status:** Fixed - code now uses `finalStyleSettingsObj` (lines 711, 729)
   - **No action needed**

2. **H4 - E2E Auth Bypass Logging** ✅
   - **Reported:** Missing security logging for E2E bypass
   - **Status:** Fixed - SecurityLogger.logSuspiciousActivity() implemented (src/auth.ts:35-42)
   - **Improvement:** Already logs to audit trail
   - **No action needed**

---

## 🔴 CRITICAL - Fix Immediately (Week 1)

### C1. OTP Timing Attack Vulnerability
**Severity:** 🔴 CRITICAL SECURITY
**File:** `src/domain/auth/otp.ts:47-106`
**Issue:** Different code paths take measurably different times (1-3 DB queries), allowing attackers to enumerate valid OTP codes

**Current Code Problem:**
```typescript
// Query 1: Check valid OTP
const otp = await prisma.oTP.findFirst({ where: { email, code, expires: { gt: new Date() }, verified: false } })

if (!otp) {
  // Query 2: Check if already verified (fast)
  const verifiedOtp = await prisma.oTP.findFirst({ ... })

  // Query 3: Check if expired (medium)
  const expiredOtp = await prisma.oTP.findFirst({ ... })
}
```

**Attack Vector:**
- Invalid code: 3 queries (~150ms)
- Expired code: 2 queries (~100ms)
- Already used: 1 query (~50ms)
- Attacker measures timing to enumerate valid codes

**Solution:**
```typescript
export async function verifyOTP(email: string, code: string): Promise<OTPVerificationResult> {
  try {
    // SINGLE query - constant time
    const otp = await prisma.oTP.findFirst({
      where: { email, code },
      orderBy: { createdAt: 'desc' }
    })

    // Add artificial delay for timing attack prevention
    await new Promise(resolve => setTimeout(resolve, 100))

    if (!otp) {
      return { success: false, reason: 'invalid_code' }
    }

    const isExpired = otp.expires < new Date()
    const isVerified = otp.verified

    if (isVerified) return { success: false, reason: 'already_verified' }
    if (isExpired) return { success: false, reason: 'expired' }

    await prisma.oTP.update({
      where: { id: otp.id },
      data: { verified: true }
    })

    // Async cleanup (don't wait)
    prisma.oTP.deleteMany({
      where: { expires: { lt: new Date() } }
    }).catch(() => {})

    return { success: true }
  } catch (error) {
    Logger.error('Error verifying OTP', { error: error instanceof Error ? error.message : String(error) })
    return { success: false, reason: 'technical_error' }
  }
}
```

**Estimated Time:** 2 hours
**Testing:** Measure response times with timing attack script
**Priority:** P0 - Deploy before public launch

---

### C2. Content Security Policy Relaxation
**Severity:** 🔴 CRITICAL SECURITY
**File:** `src/middleware.ts:75-92`
**Issue:** CSP allows `'unsafe-inline'` for scripts and styles, creating XSS attack surface

**Current Code:**
```typescript
// TODO: Re-enable strict CSP when codebase stabilizes
const unsafeInlineDirective = "'unsafe-inline'" // Temporarily enabled
"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
"style-src 'self' 'unsafe-inline'",
```

**Impact:** Attackers can inject inline scripts/styles for XSS attacks

**Solution - Phase 1 (Quick Fix):**
```typescript
// Remove unsafe-eval immediately (most dangerous)
const scriptSrc = process.env.NODE_ENV === 'production'
  ? "script-src 'self' 'unsafe-inline'" // Remove unsafe-eval
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"

// Add report-only mode to detect violations
response.headers.set('Content-Security-Policy-Report-Only',
  `default-src 'self'; script-src 'self'; style-src 'self'; report-uri /api/csp-report`
)
```

**Solution - Phase 2 (Complete Fix):**
```typescript
// Implement nonce-based CSP (Next.js 14+ built-in support)
import { NextRequest, NextResponse } from 'next/server'
import { nonce } from 'next/headers'

export function middleware(request: NextRequest) {
  const nonceValue = nonce()

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonceValue}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonceValue}'`,
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'"
  ].join('; ')

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Nonce', nonceValue)

  return response
}
```

**Estimated Time:**
- Phase 1 (remove unsafe-eval): 1 hour
- Phase 2 (nonce-based CSP): 2-3 days (requires removing all inline scripts/styles)

**Testing:**
- Mozilla Observatory scan (target: A+ rating)
- Manual XSS injection attempts
- Verify all features still work

**Priority:** P0 - Critical for production launch
**Blocking:** Yes

---

### C3. Hardcoded Development Bypass Creates Backdoor
**Severity:** 🔴 CRITICAL SECURITY
**File:** `src/lib/mobile-handoff.ts:11`
**Issue:** Hardcoded user ID bypasses all security checks in development mode

**Current Code:**
```typescript
const DEV_BYPASS_USER_ID = 'cmiegyxlv0001dqsviijns412'

// Used throughout file:
const isDevBypass = process.env.NODE_ENV === 'development' && userId === DEV_BYPASS_USER_ID

if (!isDevBypass && handoffToken.absoluteExpiry < now) {
  // Bypasses: token expiration, device binding, rate limits
}
```

**Risks:**
1. If `NODE_ENV` accidentally set to 'development' in production → backdoor active
2. If this user ID exists in production database → permanent access
3. Bypasses ALL security: expiration, device binding, rate limits

**Solution (Recommended):**
```typescript
// REMOVE hardcoded ID entirely
// Use environment variable that MUST be set explicitly

// .env.development (local only, never commit)
DEV_BYPASS_USER_ID=cmiegyxlv0001dqsviijns412

// .env.production
# DEV_BYPASS_USER_ID not set (undefined)

// src/lib/mobile-handoff.ts
const DEV_BYPASS_USER_ID = process.env.DEV_BYPASS_USER_ID

// Strict validation
const isDevBypass =
  process.env.NODE_ENV === 'development' &&
  DEV_BYPASS_USER_ID !== undefined &&
  DEV_BYPASS_USER_ID.trim() !== '' &&
  userId === DEV_BYPASS_USER_ID

// Add startup check
if (process.env.NODE_ENV === 'production' && DEV_BYPASS_USER_ID) {
  throw new Error('SECURITY: DEV_BYPASS_USER_ID must not be set in production!')
}
```

**Better Solution (Remove bypass entirely):**
```typescript
// Delete all DEV_BYPASS logic
// Use proper test environment with skipExpiryCheck option

export async function validateMobileHandoffToken(
  token: string,
  deviceId?: string,
  options?: { skipExpiryCheck?: boolean } // Only in test
): Promise<ValidateHandoffTokenResult> {
  const skipExpiry = options?.skipExpiryCheck && process.env.NODE_ENV === 'test'

  if (!skipExpiry && handoffToken.absoluteExpiry < now) {
    return { success: false, error: 'Token has expired' }
  }
}
```

**Estimated Time:** 1 hour
**Testing:** Verify bypass doesn't work in production mode
**Priority:** P0 - Deploy immediately

---

## 🟠 HIGH PRIORITY - Fix This Week (Week 1-2)

### H1. Missing Rate Limiting on OTP Verification
**Severity:** 🟠 HIGH SECURITY
**File:** `src/app/api/auth/otp/verify/route.ts`
**Issue:** No rate limiting allows unlimited brute-force attempts on 6-digit OTP codes

**Current Status:** ❌ **NOT IMPLEMENTED**

**Attack:**
- 6-digit code = 1,000,000 possibilities
- No rate limit = attacker can test 1000s/minute
- OTP broken in minutes

**Solution:**
```typescript
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { SecurityLogger } from '@/lib/security-logger'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, code } = body

  // Rate limiting: 5 attempts per 5 minutes per IP+email
  const identifier = await getRateLimitIdentifier(request, `otp_verify:${email}`)
  const rateLimit = await checkRateLimit(identifier, 5, 300)

  if (!rateLimit.success) {
    await SecurityLogger.logSuspiciousActivity(
      email,
      'otp_verify_rate_limit_exceeded',
      { ip: request.headers.get('x-forwarded-for') || 'unknown' }
    )

    return NextResponse.json(
      { error: 'Too many verification attempts. Please request a new code.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000))
        }
      }
    )
  }

  const result = await verifyOTP(email, code)

  if (!result.success) {
    await SecurityLogger.logFailedLogin(email, 'otp_invalid', {
      reason: result.reason
    })
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
```

**Add to rate-limit-config.ts:**
```typescript
export const RATE_LIMITS = {
  // ... existing
  otpVerify: { limit: 5, window: 300 }, // 5 attempts / 5 min
}
```

**Estimated Time:** 1 hour
**Testing:** Try 10 verification attempts, verify first 5 work, rest blocked
**Priority:** P0 - Critical security

---

### H2. Race Condition in User Registration
**Severity:** 🟠 HIGH
**File:** `src/app/api/auth/register/route.ts:168-243`
**Issue:** Check-then-act pattern without transaction allows duplicate users

**Current Code:**
```typescript
// Line 170: Check if user exists (NOT in transaction)
const existingRecords = await prisma.$queryRaw`...`

// Lines 213-243: Create/update user (SEPARATE operation)
if (existingUser) {
  await prisma.user.update({ ... })
} else {
  await prisma.user.create({ ... })
}
```

**Race Condition:**
- Request A: Check exists → NO
- Request B: Check exists → NO
- Request A: Create user → SUCCESS
- Request B: Create user → DATABASE ERROR (duplicate email constraint)

**Solution:**
```typescript
// Wrap in transaction with retry
const user = await prisma.$transaction(async (tx) => {
  const existing = await tx.user.findUnique({
    where: { email },
    include: {
      person: { include: { team: true } }
    }
  })

  if (existing) {
    return await tx.user.update({
      where: { id: existing.id },
      data: { password: hashedPassword }
    })
  }

  return await tx.user.create({
    data: {
      email,
      password: hashedPassword,
      role: initialRole,
      locale,
      signupDomain
    }
  })
}, {
  maxWait: 5000,
  timeout: 10000,
})
```

**Estimated Time:** 3 hours (includes testing concurrent requests)
**Priority:** P1 - Fix before scaling

---

### H3. Credit Reservation Race Condition
**Severity:** 🟠 HIGH
**File:** `src/app/api/generations/create/route.ts:568-631`
**Issue:** Generation created BEFORE credit reservation, causes orphaned generations and credit issues

**Current Flow:**
```typescript
// 1. Create generation FIRST
const generation = await prisma.generation.create({ ... })

// 2. THEN try to reserve credits (SEPARATE operation)
const reservationResult = await CreditService.reserveCreditsForGeneration({ ... })

// 3. If credits fail, TRY to delete generation (can fail!)
if (!reservationResult.success) {
  try {
    await prisma.generation.delete({ where: { id: generation.id } })
  } catch (error) {
    // Orphaned generation remains!
  }
}
```

**Problems:**
- User could spam generations without credits
- Orphaned generations if deletion fails
- Race: 2 concurrent requests both think they have credits

**Solution:**
```typescript
// 1. Check credits BEFORE creating generation
const creditCheck = await CreditService.checkAvailableCredits({
  userId: session.user.id,
  personId: firstPersonId,
  teamId: ownerPerson.teamId,
  creditSource: enforcedCreditSource
})

if (creditCheck.available < creditsUsed) {
  return NextResponse.json({
    error: 'Insufficient credits',
    details: { required: creditsUsed, available: creditCheck.available }
  }, { status: 402 })
}

// 2. Create generation AND reserve credits atomically
const generation = await prisma.$transaction(async (tx) => {
  const gen = await tx.generation.create({
    data: { ... }
  })

  const reservation = await CreditService.reserveCreditsForGenerationInTransaction(
    tx,
    {
      userId: session.user.id,
      personId: firstPersonId,
      credits: creditsUsed,
      generationId: gen.id,
      creditSource: enforcedCreditSource
    }
  )

  if (!reservation.success) {
    // Transaction rolls back automatically
    throw new Error(reservation.error || 'Credit reservation failed')
  }

  return gen
}, {
  maxWait: 5000,
  timeout: 10000
})
```

**Update CreditService:**
```typescript
// Add transaction-aware method
export async function reserveCreditsForGenerationInTransaction(
  tx: Prisma.TransactionClient,
  params: { ... }
): Promise<{ success: boolean; error?: string }> {
  // Implementation...
}
```

**Estimated Time:** 4 hours
**Priority:** P1 - Critical for payment integrity

---

### H4. File Upload Path Traversal Vulnerability
**Severity:** 🟠 HIGH SECURITY
**File:** `src/app/api/uploads/proxy/route.ts:77` and `temp/route.ts:26`
**Issue:** User-controlled file extension concatenated without validation

**Current Code:**
```typescript
const extension = (await getRequestHeader('x-file-extension')) || ''
const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${extension ? `.${extension.replace(/^\./, '')}` : ''}`
```

**Attack:**
```bash
curl -X POST /api/uploads/proxy \
  -H "x-file-extension: ../../etc/passwd"

# Results in path: selfies/personId/timestamp-random../../etc/passwd
# S3 key: selfies/../../etc/passwd (directory traversal!)
```

**Solution:**
```typescript
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic'] as const
type AllowedExtension = typeof ALLOWED_EXTENSIONS[number]

function sanitizeFileExtension(raw: string | null): AllowedExtension | null {
  if (!raw) return null

  const cleaned = raw.replace(/\./g, '').toLowerCase().trim()

  if (ALLOWED_EXTENSIONS.includes(cleaned as AllowedExtension)) {
    return cleaned as AllowedExtension
  }

  return null
}

// In handler:
const rawExtension = (await getRequestHeader('x-file-extension')) || ''
const extension = sanitizeFileExtension(rawExtension)

if (rawExtension && !extension) {
  return NextResponse.json({
    error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
  }, { status: 400 })
}

const fileName = extension
  ? `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Also sanitize full path
const sanitizedKey = relativeKey.replace(/\.\./g, '').replace(/\/\//g, '/')
```

**Estimated Time:** 1.5 hours
**Priority:** P1 - Security vulnerability

---

### H5. Missing S3 Signed URLs
**Severity:** 🟠 HIGH SECURITY
**File:** `src/app/api/generations/[id]/route.ts:129`
**Issue:** Generated images served via proxy instead of signed URLs

**Current Code:**
```typescript
// TODO: Generate signed URLs for S3 objects
generatedImageUrls = generation.generatedPhotoKeys.map(key =>
  `/api/files/proxy?key=${encodeURIComponent(key)}&type=generated&index=${index}`
)
```

**Problems:**
- Potential unauthorized access
- Server bandwidth for proxying
- Performance bottleneck
- No expiration control

**Solution:**
```typescript
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'

async function generateSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.HETZNER_S3_BUCKET,
    Key: key
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

// In route handler:
generatedImageUrls = await Promise.all(
  generation.generatedPhotoKeys.map(key => generateSignedUrl(key, 3600)) // 1 hour
)
```

**Client-side caching:**
```typescript
// Cache signed URLs on client
const [imageUrls, setImageUrls] = useState<string[]>([])
const [urlExpiry, setUrlExpiry] = useState<number>(0)

useEffect(() => {
  if (Date.now() > urlExpiry - 300000) { // Refresh 5 min before expiry
    fetchGeneration().then(gen => {
      setImageUrls(gen.generatedImageUrls)
      setUrlExpiry(Date.now() + 3600000) // 1 hour
    })
  }
}, [urlExpiry])
```

**Estimated Time:** 1 day
**Priority:** P1 - Required for production

---

### H6. Authorization Check Order
**Severity:** 🟠 HIGH
**File:** `src/app/api/generations/create/route.ts:108-191`
**Issue:** Fetches and validates data BEFORE checking authorization

**Current Code:**
```typescript
// Lines 108-160: Fetch selfies (BEFORE auth!)
const selfies = await prisma.selfie.findMany({ where: { id: { in: ids } } })

// Lines 161-166: Validate same person (BEFORE auth!)
const allSamePerson = selfies.every(s => s.personId === firstPersonId)

// Lines 186-191: ONLY NOW check authorization!
if (!isOwner && !isSameTeam) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
}
```

**Information Disclosure:**
- Attacker learns if selfies exist (404 vs 400)
- Learns if selfies belong to same person
- User enumeration possible

**Solution:**
```typescript
// 1. Get user's person FIRST
const userPerson = await prisma.person.findUnique({
  where: { userId: session.user.id },
  select: { id: true, teamId: true }
})

// 2. Filter by authorization DURING query
const selfies = await prisma.selfie.findMany({
  where: {
    id: { in: requestedIds },
    OR: [
      { personId: userPerson.id }, // User owns
      { person: { teamId: userPerson.teamId } } // Same team
    ]
  },
  include: { person: { select: { teamId: true } } }
})

// 3. Generic error if not found
if (selfies.length === 0) {
  return NextResponse.json({ error: 'Selfies not found' }, { status: 404 })
}

// 4. Now safe to validate (already authorized)
const allSamePerson = selfies.every(s => s.personId === selfies[0].personId)
```

**Estimated Time:** 2 hours
**Priority:** P1 - Information disclosure

---

### H7. E2E Auth Bypass Allows Development Mode
**Severity:** 🟠 HIGH
**File:** `src/auth.ts:31`
**Issue:** E2E bypass works in 'development' mode, not just 'test'

**Current Code:**
```typescript
if (e2eUserId && (nodeEnv === 'test' || nodeEnv === 'development')) {
  // Bypasses authentication!
}
```

**Risk:** If production accidentally has `NODE_ENV=development` → backdoor active

**Solution:**
```typescript
// ONLY allow in test environment
if (e2eUserId && nodeEnv === 'test') {
  await SecurityLogger.logSuspiciousActivity(
    e2eUserId,
    'e2e_auth_bypass',
    { environment: nodeEnv }
  )
  return { /* mock session */ }
}

// Reject E2E headers in production
if (e2eUserId && nodeEnv === 'production') {
  await SecurityLogger.logSuspiciousActivity(
    'unknown',
    'e2e_bypass_attempt_in_production',
    { headers: Object.fromEntries(headersList.entries()) }
  )
  // Fall through to normal auth
}
```

**Add startup validation:**
```typescript
// src/lib/startup-checks.ts
export function validateEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.NEXT_PUBLIC_BASE_URL?.startsWith('https://')) {
      throw new Error('Production must use HTTPS')
    }
    if (process.env.DEV_BYPASS_USER_ID) {
      throw new Error('DEV_BYPASS_USER_ID must not be set in production')
    }
    console.log('✓ Environment validation passed')
  }
}
```

**Estimated Time:** 2 hours
**Priority:** P1 - Security hardening

---

### H8. OTP Email Spam via Multi-IP Attack
**Severity:** 🟡 MEDIUM-HIGH
**File:** `src/app/api/auth/otp/send/route.ts:33-41`
**Issue:** Rate limiting only checks email, not IP

**Current Code:**
```typescript
// Only checks per-email (30 second throttle)
const last = await prisma.oTP.findFirst({
  where: { email },
  orderBy: { createdAt: 'desc' }
})

if (last && (now - last.createdAt.getTime()) < 30 * 1000) {
  return NextResponse.json({ error: 'Please wait' }, { status: 429 })
}
```

**Attack:** Attacker rotates IPs to bypass email throttle, spams victim

**Solution - Multi-layer rate limiting:**
```typescript
// LAYER 1: Per-email throttle (30 seconds)
const lastOtp = await prisma.oTP.findFirst({
  where: { email },
  orderBy: { createdAt: 'desc' }
})

if (lastOtp && (Date.now() - lastOtp.createdAt.getTime()) < 30 * 1000) {
  return NextResponse.json({ error: 'Please wait 30 seconds' }, { status: 429 })
}

// LAYER 2: Per-IP rate limit (10 per 5 minutes)
const identifier = await getRateLimitIdentifier(request, 'otp_send')
const ipRateLimit = await checkRateLimit(identifier, 10, 300)

if (!ipRateLimit.success) {
  await SecurityLogger.logSuspiciousActivity(email, 'otp_send_ip_rate_limit', {
    ip: request.headers.get('x-forwarded-for') || 'unknown'
  })
  return NextResponse.json({ error: 'Too many requests from your IP' }, { status: 429 })
}

// LAYER 3: Per-email rate limit (5 per hour)
const emailIdentifier = `otp_send:email:${email}`
const emailRateLimit = await checkRateLimit(emailIdentifier, 5, 3600)

if (!emailRateLimit.success) {
  await SecurityLogger.logSuspiciousActivity(email, 'otp_send_email_rate_limit', {})
  return NextResponse.json({ error: 'Too many codes for this email. Try in 1 hour.' }, { status: 429 })
}
```

**Estimated Time:** 1.5 hours
**Priority:** P1 - Abuse prevention

---

## 🟡 MEDIUM PRIORITY - Technical Debt (Week 3-4)

### M1. Weak Session Configuration
**File:** `src/lib/auth.ts:14-15`
**Issue:** 30-minute sessions with 5-minute extension threshold

**Current:**
```typescript
const SESSION_MAX_AGE_SECONDS = 30 * 60 // 30 minutes
const SESSION_EXTENSION_THRESHOLD_SECONDS = 5 * 60 // 5 minutes
```

**Recommendation:**
```typescript
const SESSION_MAX_AGE_SECONDS = 15 * 60 // 15 minutes
const SESSION_EXTENSION_THRESHOLD_SECONDS = 2 * 60 // 2 minutes
const ABSOLUTE_MAX_SESSION_AGE = 4 * 60 * 60 // 4 hours absolute max

// Track session creation time to enforce absolute maximum
```

**Estimated Time:** 1 hour
**Priority:** P2

---

### M2. Mobile Handoff Device Binding Weak
**File:** `src/app/api/mobile-handoff/validate/route.ts:91-99`
**Issue:** Simple hash(userAgent) = same device ID for all users with same browser

**Current:**
```typescript
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
  }
  return Math.abs(hash).toString(16)
}

const deviceId = simpleHash(userAgent)
```

**Solution:**
```typescript
import { createHmac } from 'crypto'

function generateDeviceId(userAgent: string, ip: string, token: string): string {
  const secret = process.env.DEVICE_ID_SECRET || 'change-me'
  const hmac = createHmac('sha256', secret)
  hmac.update(`${userAgent}:${ip}:${token}`)
  return hmac.digest('hex')
}

const deviceId = generateDeviceId(userAgent, ip, token)
```

**Estimated Time:** 1.5 hours
**Priority:** P2

---

### M3. Missing File Magic Byte Validation
**File:** `src/app/api/uploads/promote/route.ts:30-34`
**Issue:** Content-Type guessed from extension, no validation of actual file type

**Solution:**
```typescript
import { fileTypeFromBuffer } from 'file-type'

// Read file from S3
const { Body } = await s3.send(new GetObjectCommand({ Bucket, Key: sourceKey }))
const buffer = await Body.transformToByteArray()

// Validate magic bytes
const fileType = await fileTypeFromBuffer(buffer)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

if (!fileType || !ALLOWED_TYPES.includes(fileType.mime)) {
  return NextResponse.json({
    error: 'Invalid file type',
    details: { detected: fileType?.mime || 'unknown' }
  }, { status: 400 })
}

// Use detected type
const contentType = fileType.mime
```

**Estimated Time:** 2 hours
**Priority:** P2

---

### M4. User Enumeration via Response Timing
**File:** `src/app/api/auth/register/route.ts:213-243`
**Issue:** Existing user update (fast) vs new user creation (slow) reveals email existence

**Solution:**
```typescript
// Add artificial delay to normalize response time
const startTime = Date.now()

// ... registration logic ...

const processingTime = Date.now() - startTime
const targetTime = 1000 // 1 second constant
if (processingTime < targetTime) {
  await new Promise(resolve => setTimeout(resolve, targetTime - processingTime))
}

// Return identical structure
return NextResponse.json({
  success: true,
  message: 'Account created. You can now sign in.'
})
```

**Estimated Time:** 1 hour
**Priority:** P2

---

### M5. Observability Gaps
**Issue:** Limited production monitoring

**Missing:**
- APM integration (Sentry)
- Structured logging with aggregation
- Distributed tracing
- Custom metrics for generation rates

**Solution:**
1. Enable PostHog server-side events
2. Integrate Sentry for error tracking
3. Implement structured logging
4. Add custom metrics dashboard

**Estimated Time:** 2-3 days
**Priority:** P2 - Before high-traffic production

---

### M6. Redis/Queue Dependency Risk
**Issue:** Single point of failure for job processing

**Recommendations:**
- Implement Redis Sentinel for HA
- Add queue health monitoring with alerts
- Document recovery procedures
- Consider job state backup to database

**Estimated Time:** 2-3 days
**Priority:** P2 - Before production launch

---

## 📋 Testing Requirements

### Security Tests to Add

**tests/security/otp-timing-attack.test.ts:**
```typescript
describe('OTP Timing Attack Protection', () => {
  it('should have constant response time', async () => {
    // Test invalid, expired, verified codes
    // Verify all within 50ms of each other
  })
})
```

**tests/security/rate-limiting.test.ts:**
```typescript
describe('Rate Limiting', () => {
  it('should block OTP verify after 5 attempts', async () => {
    // Send 10 requests
    // Verify first 5 return 400, rest 429
  })
})
```

**tests/security/auth-bypass-production.test.ts:**
```typescript
describe('Auth Bypass Production Protection', () => {
  it('should reject E2E headers in production mode', async () => {
    process.env.NODE_ENV = 'production'
    // Send request with x-e2e-user-id header
    // Verify it's ignored
  })
})
```

---

## 📅 Recommended Timeline

### Week 1: Critical Security (P0)
**Days 1-2:**
- [ ] Fix C1: OTP Timing Attack (2h)
- [ ] Fix C2 Phase 1: Remove unsafe-eval from CSP (1h)
- [ ] Fix C3: Remove hardcoded bypass (1h)
- [ ] Fix H1: OTP rate limiting (1h)
- [ ] Deploy security update

**Days 3-5:**
- [ ] Fix H2: Registration race condition (3h)
- [ ] Fix H3: Credit reservation transaction (4h)
- [ ] Fix H4: Path traversal (1.5h)
- [ ] Fix H5: S3 signed URLs (1 day)

**Total:** ~3.5 days of work

---

### Week 2: High Priority Security (P1)
**Days 1-3:**
- [ ] Fix H6: Authorization check order (2h)
- [ ] Fix H7: E2E bypass hardening (2h)
- [ ] Fix H8: OTP spam prevention (1.5h)
- [ ] Add security tests (4h)

**Days 4-5:**
- [ ] C2 Phase 2: Nonce-based CSP (2-3 days)
- [ ] Security audit testing
- [ ] Deploy

**Total:** 1 week

---

### Week 3: Medium Priority (P2)
- [ ] Fix M1-M4: Session, device binding, file validation, timing (6h)
- [ ] Add M5: Observability (2-3 days)
- [ ] M6: Redis HA planning and docs (1 day)

**Total:** 1 week

---

## 🎯 Success Criteria

### Security Metrics
- ✅ Mozilla Observatory: A+ rating
- ✅ All rate limits enforced
- ✅ Zero auth bypass vulnerabilities
- ✅ Timing attacks mitigated
- ✅ All file uploads validated

### Testing Metrics
- ✅ All security tests passing
- ✅ E2E tests passing
- ✅ Manual penetration testing completed
- ✅ Load testing passed

### Deployment Checklist
- [ ] `NODE_ENV=production` verified
- [ ] No `DEV_BYPASS_USER_ID` in production .env
- [ ] HTTPS enforced
- [ ] CSP headers strict (no unsafe-inline)
- [ ] Rate limiting enabled (Redis online)
- [ ] Security logging active
- [ ] Monitoring alerts configured

---

## 📊 Risk Assessment

| Priority | Issues | Risk Level | Blocking Production? |
|----------|--------|------------|---------------------|
| P0 - Critical | 3 | 🔴 HIGH | YES |
| P1 - High | 8 | 🟠 MEDIUM-HIGH | RECOMMENDED |
| P2 - Medium | 6 | 🟡 MEDIUM | Before Scale |

**Minimum Viable Timeline:** 1 week (P0 only)
**Production Ready:** 3 weeks (P0 + P1 + Observability)
**Optimal:** 5 weeks (All items)

---

## 🚀 Next Steps

1. **Review this plan** with team
2. **Create GitHub issues** for each item
3. **Assign ownership** and timelines
4. **Begin Week 1** security fixes
5. **Schedule security review** after Week 2

---

**Document Status:** Ready for implementation
**Last Updated:** December 8, 2025
**Approver:** _________________
**Start Date:** _________________

---

## 🟡 ADDITIONAL MEDIUM PRIORITY ISSUES

### M7. Dynamic Subject Count Hardcoded
**Severity:** 🟡 MEDIUM
**Files:** 
- `src/domain/style/packages/headshot1/index.ts:68`
- `src/domain/style/packages/freepackage/index.ts:76`
**Issue:** Subject count hardcoded to '1' instead of derived from selfieKeys.length

**Current Code:**
```typescript
const DEFAULTS = {
  ...FREE_PRESET_DEFAULTS,
  shotType: { type: 'medium-shot' },
  subjectCount: '1' as const // TODO: Should be dynamic
}
```

**Impact:** Multi-selfie generations may fail or produce incorrect results

**Solution:**
```typescript
// In buildGenerationPayload():
const subjectCount = context.selfieS3Keys.length.toString()

effectiveSettings.subjectCount = subjectCount
```

**Estimated Time:** 4 hours (includes testing with 1-5 selfies)
**Priority:** P2 - If multi-selfie feature is active

---

### M8. Missing Success Messages in Team Management
**Severity:** 🟡 MEDIUM UX
**File:** `src/app/[locale]/app/team/page.tsx:557, 629, 658, 683`
**Issue:** User actions complete without feedback

**Current Code:**
```typescript
if (response.ok) {
  await fetchTeamData()
  setError(null)
  // TODO: Show success message
}
```

**Impact:** Poor UX - users uncertain if actions succeeded

**Solution:**
```typescript
import { toast } from '@/components/ui/use-toast'

if (response.ok) {
  await fetchTeamData()
  setError(null)
  toast({
    title: t('team.inviteSent'),
    description: t('team.inviteSentDescription'),
    variant: 'success'
  })
}
```

**Add toasts for:**
- Invite sent
- Member removed
- Role changed
- Credits allocated

**Estimated Time:** 2 hours
**Priority:** P2 - UX quality

---

### M9. Incomplete Upload Flow
**Severity:** 🟡 MEDIUM
**File:** `src/app/[locale]/upload/page.tsx:94`
**Issue:** Upload page doesn't call generation API

**Current Code:**
```typescript
const onProceed = () => {
  // TODO: call generation API with { key, generationType, personId, token }
}
```

**Impact:** Upload flow is incomplete

**Solution:**
```typescript
const onProceed = async () => {
  setLoading(true)
  try {
    const response = await fetch('/api/generations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selfieKeys: [uploadedKey],
        generationType,
        styleSettings: { packageId: 'freepackage' }
      })
    })

    if (!response.ok) throw new Error('Generation failed')

    const { generationId } = await response.json()
    router.push(`/app/generations/${generationId}`)
  } catch (error) {
    setError('Failed to start generation')
  } finally {
    setLoading(false)
  }
}
```

**Estimated Time:** 3 hours
**Priority:** P2 - If this upload path is used

---

### M10. Dashboard Stats Placeholders
**Severity:** 🟡 MEDIUM
**File:** `src/app/[locale]/app/dashboard/page-backup.tsx:173, 180, 187, 194`
**Issue:** Stats show '+0' change instead of actual deltas

**Current Code:**
```typescript
const statsConfig = [
  {
    name: t('stats.teamMembers'),
    value: stats.teamMembers.toString(),
    change: '+0', // TODO: Calculate from previous period
  }
]
```

**Impact:** Dashboard lacks actionable insights

**Solution:**
```typescript
// Add time-series tracking
interface StatsDelta {
  current: number
  previous: number
  change: string
}

async function calculateStatsDelta(
  teamId: string,
  metric: string,
  currentPeriodDays: number = 7
): Promise<StatsDelta> {
  const now = new Date()
  const periodStart = new Date(now.getTime() - currentPeriodDays * 24 * 60 * 60 * 1000)
  const previousPeriodStart = new Date(periodStart.getTime() - currentPeriodDays * 24 * 60 * 60 * 1000)

  // Query current and previous period counts
  const current = await prisma[metric].count({
    where: { teamId, createdAt: { gte: periodStart } }
  })

  const previous = await prisma[metric].count({
    where: {
      teamId,
      createdAt: { gte: previousPeriodStart, lt: periodStart }
    }
  })

  const delta = current - previous
  const change = delta > 0 ? `+${delta}` : delta.toString()

  return { current, previous, change }
}
```

**Estimated Time:** 1 day
**Priority:** P2 - Analytics value

---

### M11. Incomplete Launch Notification Email
**Severity:** 🟡 MEDIUM
**File:** `src/lib/email.ts:72`
**Issue:** Waitlist launch email functionality stubbed

**Current Code:**
```typescript
export async function sendWaitlistLaunchEmail(...) {
  // TODO: Implement launch notification email
  console.log('Launch email not yet implemented')
  return { success: false, error: 'Not implemented' }
}
```

**Impact:** Cannot notify waitlist users

**Solution:**
```typescript
import { LaunchEmailTemplate } from '@/emails/LaunchEmail'
import { render } from '@react-email/render'

export async function sendWaitlistLaunchEmail(
  email: string,
  locale: string,
  discountCode?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const emailHtml = render(
      LaunchEmailTemplate({
        locale,
        discountCode,
        ctaUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/${locale}/signup?code=${discountCode}`
      })
    )

    await resend.emails.send({
      from: 'TeamShots <launch@teamshotspro.com>',
      to: email,
      subject: locale === 'en' ? 'TeamShots is Live!' : 'TeamShots está disponible!',
      html: emailHtml
    })

    return { success: true }
  } catch (error) {
    Logger.error('Failed to send launch email', { error, email })
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
```

**Create email template:**
```tsx
// emails/LaunchEmail.tsx
export function LaunchEmailTemplate({ locale, discountCode, ctaUrl }) {
  return (
    <Html>
      <Head />
      <Body>
        <h1>{locale === 'en' ? 'We're Live!' : '¡Ya estamos en vivo!'}</h1>
        <p>
          {locale === 'en'
            ? 'TeamShots is now available. Create professional team photos in minutes.'
            : 'TeamShots ya está disponible. Crea fotos profesionales de equipo en minutos.'}
        </p>
        {discountCode && (
          <p>
            {locale === 'en' ? 'Your exclusive discount code:' : 'Tu código de descuento exclusivo:'}{' '}
            <strong>{discountCode}</strong>
          </p>
        )}
        <Button href={ctaUrl}>
          {locale === 'en' ? 'Get Started' : 'Comenzar'}
        </Button>
      </Body>
    </Html>
  )
}
```

**Estimated Time:** 1 day (includes template design)
**Priority:** P2 - Only if waitlist launch planned

---

## 🔵 LOW PRIORITY - Polish & Improvements

### L1. Verbose Logging Leaks Internal State
**Severity:** 🔵 LOW
**Files:** Multiple, e.g., `src/app/api/generations/create/route.ts:228-234`
**Issue:** Production logs reveal user IDs, team structure

**Current Code:**
```typescript
Logger.debug('Credit source determination', {
  userId: session.user.id,
  creditSource: enforcedCreditSource,
  personTeamId: ownerPerson.teamId
})
```

**Solution:**
```typescript
if (process.env.NODE_ENV === 'development') {
  Logger.debug('Credit source determination', {
    userId: session.user.id.substring(0, 8) + '...', // Truncate
    creditSource: enforcedCreditSource
    // Don't log teamId in production
  })
}
```

**Estimated Time:** 3 hours (review all logging)
**Priority:** P3

---

### L2. No Per-File Rate Limiting on Downloads
**Severity:** 🔵 LOW
**Issue:** Bandwidth abuse possible

**Solution:**
```typescript
// Add per-file-per-hour rate limits
const fileIdentifier = `file_download:${key}:${userId}`
const rateLimit = await checkRateLimit(fileIdentifier, 100, 3600) // 100 downloads/hour

if (!rateLimit.success) {
  return NextResponse.json(
    { error: 'Too many downloads for this file' },
    { status: 429 }
  )
}
```

**Estimated Time:** 2 hours
**Priority:** P3

---

### L3. Invite Tokens Never Truly Expire
**Severity:** 🔵 LOW
**Issue:** Tokens can be refreshed indefinitely if used regularly

**Current Behavior:**
- Tokens have `slidingExpiry` (refreshes on use)
- No absolute maximum lifetime

**Solution:**
```typescript
// Add absolute expiry field to TeamInvite model
// schema.prisma
model TeamInvite {
  // ... existing fields
  absoluteExpiry DateTime // 7 days from creation, never extends
}

// In validation:
if (now > invite.absoluteExpiry) {
  return { error: 'Token has permanently expired' }
}
```

**Estimated Time:** 1 hour
**Priority:** P3

---

### L4. Spanish Blog Content Quality
**Severity:** 🔵 LOW
**Files:** Various in `src/app/[locale]/blog/`
**Issue:** Multiple TODOs for Spanish translations

**Current Status:** Machine-translated content with quality issues

**Solution:**
- Professional translation review
- Consistency check across all Spanish content
- Native speaker proofreading

**Estimated Time:** 1-2 days
**Priority:** P3 - Blog SEO only

---

### L5. Workflow State Debugging Tools
**Severity:** 🔵 LOW
**Issue:** Complex V3 workflow state is hard to debug

**Recommendation:**
- Add workflow state visualization tool
- Document state transitions
- Improve error messages with workflow step context
- Add workflow state export/import for debugging

**Estimated Time:** 3-5 days
**Priority:** P3 - Maintainability

---

## 🛠️ TECHNICAL DEBT & CODE CLEANUP

### D1. Duplicate Selfie Selection Logic
**File:** `src/app/api/generations/create/route.ts:145-159`
**Issue:** Inefficient fallback logic to fetch selected selfies

**Current Code:**
```typescript
// Lines 145-159: Fallback logic
if (selfies.length === 1) {
  try {
    const moreSelected = await prisma.selfie.findMany({
      where: { personId: selfies[0].personId, selected: true }
    })
    // Merge logic...
  } catch {}
}
```

**Recommendation:** Remove fallback, enforce client sends all IDs

**Estimated Time:** 1 hour
**Priority:** P3

---

### D2. Unused WorkflowVersion Enum
**Files:** Multiple references to v1/v2 workflows that don't exist
**Issue:** Dead code and legacy workflow references

**Recommendation:**
- Remove v1/v2 workflow code
- Keep only v3
- Clean up types and enums

**Estimated Time:** 2 hours
**Priority:** P3

---

### D3. Redundant Credit Source Derivation
**File:** `src/app/api/generations/create/route.ts:204-226`
**Issue:** Credit source derived twice using different functions

**Recommendation:** Use single source of truth

**Estimated Time:** 1 hour
**Priority:** P3

---

### D4. Aspect Ratio Logic Duplicated
**Files:**
- `headshot1/server.ts:62-81`
- `freepackage/server.ts:62-81`
- `outfit1/server.ts:62-81`

**Issue:** ~60 lines of identical aspect ratio resolution code

**Solution:** Extract to shared function

**Estimated Time:** 1 hour
**Priority:** P3

---

### D5. Hardcoded 'medium-shot' in All Packages
**Files:** All `*/server.ts:58`

**Current:**
```typescript
effectiveSettings.shotType = { type: 'medium-shot' }  // Hardcoded!
```

**Should:**
```typescript
const shotType = packageBase.defaultSettings.shotType?.type || 'medium-shot'
effectiveSettings.shotType = { type: shotType }
```

**Estimated Time:** 30 minutes
**Priority:** P3

---

## 🏗️ INFRASTRUCTURE & ARCHITECTURE

### I1. Database Query Optimization
**Severity:** 🟡 MEDIUM
**Issue:** Potential N+1 queries, unbounded JSON fields

**Findings:**
- Large JSON fields (`styleSettings`, `metadata`) can grow unbounded
- No JSON schema validation
- Some relations lack explicit foreign key constraints

**Recommendations:**
1. Add database-level constraints for critical foreign keys
2. Implement JSON schema validation (Zod)
3. Profile slow queries, add missing composite indexes
4. Consider extracting frequently queried JSON fields to columns

**Estimated Time:** 3-5 days
**Priority:** P2 - Before scaling to 10k+ users

---

### I2. Rate Limiting Inconsistencies
**Severity:** 🟡 MEDIUM
**Issue:** Not all API routes have rate limiting

**Audit Required:**
- Inventory all public API routes
- Apply default rate limits globally via middleware
- Add route-specific overrides
- Log violations to SecurityLog

**Estimated Time:** 1 day
**Priority:** P2 - Before public launch

---

### I3. AI Provider Vendor Lock-in
**Severity:** 🟡 MEDIUM
**Issue:** Complete dependency on Google Gemini

**Findings:**
- Replicate integration exists but not production-ready
- No failover if Gemini unavailable
- Cost optimization limited

**Recommendations:**
- Abstract AI provider interface (strategy pattern)
- Complete Replicate integration as backup
- Add provider health checks and automatic failover
- Test backup provider regularly

**Estimated Time:** 1 week
**Priority:** P2 - Risk reduction

---

### I4. NextAuth v5 Beta Dependency
**Severity:** 🟠 HIGH RISK
**Issue:** Production relies on beta software

**Current:** `next-auth@5.0.0-beta.29`

**Mitigation:**
- Pin exact version ✅ (already done)
- Monitor changelog closely
- Plan migration to stable release
- Test thoroughly on beta updates

**Timeline:** Monitor for stable release (expected Q1 2026)
**Priority:** P2 - Monitoring required

---

### I5. React 19 RC Dependency
**Severity:** 🟡 MEDIUM RISK
**Issue:** Using release candidate in production

**Current:** `react@19.0.0-rc`

**Mitigation:**
- Consider backporting to React 18 if timeline critical
- Monitor for stable release
- Test thoroughly

**Timeline:** React 19 stable expected Q1 2026
**Priority:** P2 - Evaluate risk

---

## 📊 SUMMARY TABLE

| ID | Issue | Severity | Time | Priority | Blocking? |
|----|-------|----------|------|----------|-----------|
| C1 | OTP Timing Attack | 🔴 CRITICAL | 2h | P0 | YES |
| C2 | CSP Relaxation | 🔴 CRITICAL | 3d | P0 | YES |
| C3 | Hardcoded Bypass | 🔴 CRITICAL | 1h | P0 | YES |
| H1 | OTP Rate Limiting | 🟠 HIGH | 1h | P0 | YES |
| H2 | Registration Race | 🟠 HIGH | 3h | P1 | Recommended |
| H3 | Credit Race | 🟠 HIGH | 4h | P1 | Recommended |
| H4 | Path Traversal | 🟠 HIGH | 1.5h | P1 | Recommended |
| H5 | Signed URLs | 🟠 HIGH | 1d | P1 | Recommended |
| H6 | Auth Check Order | 🟠 HIGH | 2h | P1 | Recommended |
| H7 | E2E Bypass | 🟠 HIGH | 2h | P1 | Recommended |
| H8 | OTP Spam | 🟡 MED-HIGH | 1.5h | P1 | Recommended |
| M1 | Weak Sessions | 🟡 MEDIUM | 1h | P2 | No |
| M2 | Device Binding | 🟡 MEDIUM | 1.5h | P2 | No |
| M3 | File Validation | 🟡 MEDIUM | 2h | P2 | No |
| M4 | User Enumeration | 🟡 MEDIUM | 1h | P2 | No |
| M5 | Observability | 🟡 MEDIUM | 2-3d | P2 | Before Scale |
| M6 | Redis HA | 🟡 MEDIUM | 2-3d | P2 | Before Scale |
| M7 | Subject Count | 🟡 MEDIUM | 4h | P2 | If Multi-Selfie |
| M8 | Success Messages | 🟡 MEDIUM | 2h | P2 | No |
| M9 | Upload Flow | 🟡 MEDIUM | 3h | P2 | If Used |
| M10 | Dashboard Stats | 🟡 MEDIUM | 1d | P2 | No |
| M11 | Launch Email | 🟡 MEDIUM | 1d | P2 | If Waitlist |
| I1 | DB Optimization | 🟡 MEDIUM | 3-5d | P2 | Before 10k Users |
| I2 | Rate Limit Audit | 🟡 MEDIUM | 1d | P2 | Before Launch |
| I3 | AI Vendor Lock | 🟡 MEDIUM | 1w | P2 | Risk |
| I4 | NextAuth Beta | 🟠 HIGH | Monitor | P2 | Risk |
| I5 | React 19 RC | 🟡 MEDIUM | Monitor | P2 | Risk |
| L1-L5 | Low Priority | 🔵 LOW | 1-5d | P3 | No |
| D1-D5 | Tech Debt | 🔵 LOW | 5h | P3 | No |

**Total Issues:** 36 (17 new items added to original plan)

---

## 📈 REVISED TIMELINE

### Phase 1: Critical Security (Week 1)
**Total Time:** 3.5 days
- C1, C2 Phase 1, C3: 4h
- H1: 1h
- Deploy security update
- C2 Phase 2: 2-3 days

### Phase 2: High Priority (Week 2)
**Total Time:** 1 week
- H2-H8: 16h (~2 days)
- Security testing: 1 day
- Deploy

### Phase 3: Medium Priority (Week 3-4)
**Total Time:** 2 weeks
- M1-M11: 9-11 days
- I1-I3: 1-2 weeks
- Infrastructure improvements

### Phase 4: Low Priority & Cleanup (Week 5)
**Total Time:** 1 week
- L1-L5: 1-5 days
- D1-D5: 5 hours
- Final testing and polish

**TOTAL: 5 weeks for complete implementation**

---

## ✅ FINAL PRE-DEPLOYMENT CHECKLIST

### Security
- [ ] All P0 issues fixed (C1-C3, H1)
- [ ] All P1 issues fixed (H2-H8)
- [ ] CSP strict (no unsafe-inline/eval)
- [ ] Rate limiting on all routes
- [ ] Security tests passing
- [ ] Penetration testing completed

### Environment
- [ ] NODE_ENV=production verified
- [ ] No DEV_BYPASS_USER_ID in .env
- [ ] HTTPS enforced
- [ ] All secrets rotated
- [ ] Database backups configured

### Monitoring
- [ ] Sentry integrated
- [ ] PostHog server-side events
- [ ] Custom metrics dashboard
- [ ] Alerts configured
- [ ] Runbooks documented

### Testing
- [ ] All E2E tests passing
- [ ] Security tests passing
- [ ] Load testing completed
- [ ] Manual testing on staging

### Documentation
- [ ] API docs updated
- [ ] Security procedures documented
- [ ] Incident response plan
- [ ] Rollback procedures tested

---

**END OF CONSOLIDATED ACTION PLAN**
**Status:** Ready for Implementation
**Last Updated:** December 8, 2025
**Version:** 2.0 (Complete)
