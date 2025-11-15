# Quick Security Checks

Quick reference for manual security testing without running the full penetration test suite.

## 1. Check CSP Headers (Browser)

1. Open browser DevTools → Network tab
2. Navigate to any page (e.g., `http://localhost:3000/en`)
3. Click on the page request → Headers → Response Headers
4. Find `Content-Security-Policy`
5. **Verify:** `script-src` does NOT contain `unsafe-inline` or `unsafe-eval`
6. **Note:** `style-src` may have `unsafe-inline` (this is OK for Next.js)

**Quick Check:**
```bash
curl -sI http://localhost:3000/en | grep -i "content-security-policy"
```

## 2. Check Rate Limiting (Terminal)

**Registration Rate Limit:**
```bash
# Should block after 5 attempts
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test$i@example.com\",\"password\":\"test\",\"firstName\":\"Test\",\"otpCode\":\"1234\",\"locale\":\"en\"}" \
    -w " - HTTP: %{http_code}\n"
done
# 6th attempt should return 429
```

**Sign-In Rate Limit:**
```bash
# Should block after 10 attempts
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -w " - HTTP: %{http_code}\n"
done
```

## 3. Check Cookie Security (Browser)

1. DevTools → Application → Cookies → `localhost:3000`
2. Find `next-auth.session-token`
3. **Verify:**
   - `SameSite`: `Strict` ✅
   - `HttpOnly`: `true` ✅
   - `Secure`: `true` (in production) ✅

**Quick Check:**
```bash
curl -I -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' \
  | grep -i "set-cookie"
```

## 4. Test SSRF Protection

```bash
# These should all be blocked
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test","firstName":"Test","teamWebsite":"http://127.0.0.1","otpCode":"1234","locale":"en"}'

curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test","firstName":"Test","teamWebsite":"http://192.168.1.1","otpCode":"1234","locale":"en"}'

curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test","firstName":"Test","teamWebsite":"file:///etc/passwd","otpCode":"1234","locale":"en"}'
```

**Expected:** All should return errors about invalid/private IP or protocol.

## 5. Check Security Headers

```bash
curl -I http://localhost:3000/en | grep -E "X-Frame|X-Content-Type|CSP|Strict-Transport"
```

**Expected Headers:**
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: ...` (with secure script-src)
- `Strict-Transport-Security: ...` (only on HTTPS)

## 6. Check Input Validation

```bash
# Invalid email - should fail
curl -X POST http://localhost:3000/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","code":"1234"}'

# Invalid OTP code - should fail
curl -X POST http://localhost:3000/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"abc"}'
```

**Expected:** Both should return `400 Bad Request` with validation errors.

## 7. Check E2E Security (Production Only)

```bash
# In production, this should NOT work
curl http://localhost:3000/api/dashboard \
  -H "x-e2e-user-id: attacker-id" \
  -H "x-e2e-user-is-admin: true"
```

**Expected:** Should return `401 Unauthorized` (not authenticated as attacker)

## Database Checks

```sql
-- Check failed auth attempts
SELECT COUNT(*), email, "ipAddress" 
FROM "SecurityLog" 
WHERE type = 'auth_attempt' AND success = false
GROUP BY email, "ipAddress"
ORDER BY COUNT(*) DESC
LIMIT 10;

-- Check rate limit violations
SELECT * FROM "SecurityLog" 
WHERE type = 'rate_limit_exceeded'
ORDER BY "createdAt" DESC
LIMIT 10;

-- Check impersonation logs
SELECT * FROM "SecurityLog" 
WHERE type = 'impersonation'
ORDER BY "createdAt" DESC;
```

## All-in-One Check Script

```bash
#!/bin/bash
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=== Quick Security Checks ==="
echo ""

# CSP Check
echo "1. CSP Header:"
curl -sI "$BASE_URL/en" | grep -i "content-security-policy" | head -1
echo ""

# Security Headers
echo "2. Security Headers:"
curl -sI "$BASE_URL/en" | grep -E "X-Frame|X-Content-Type|Strict-Transport" | head -3
echo ""

# Cookie Security
echo "3. Cookie Security:"
curl -sI -X POST "$BASE_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}' \
  | grep -i "set-cookie" | head -1
echo ""

echo "Done! Review output above."
```

Save as `quick-check.sh` and run: `chmod +x quick-check.sh && ./quick-check.sh`

