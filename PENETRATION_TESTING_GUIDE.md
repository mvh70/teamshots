# Penetration Testing Guide

This guide provides step-by-step instructions for testing the security improvements implemented in TeamShots.

## Prerequisites

- **Server running**: Start the development server with `npm run dev` or have access to staging/production
- Browser developer tools (Chrome DevTools, Firefox DevTools)
- curl or Postman for API testing
- Burp Suite or OWASP ZAP (optional, for advanced testing)

## Quick Start

### 1. Start the Server

```bash
# Development
npm run dev

# Or test against staging/production
export BASE_URL=https://staging.teamshotspro.com
```

### 2. Run Automated Tests

```bash
# Test against local development
BASE_URL=http://localhost:3000 ./scripts/penetration-test.sh

# Test against staging/production
BASE_URL=https://staging.teamshotspro.com ./scripts/penetration-test.sh
```

**Note:** The test script checks if the server is running and will exit early if it's not available.

## 1. Content Security Policy (CSP) Testing

### Test 1.1: Verify unsafe-inline is blocked

**Objective:** Confirm that inline scripts cannot execute

**Steps:**
1. Open browser DevTools → Console
2. Navigate to any page (e.g., `/app/dashboard`)
3. Check Network tab → Response Headers → `Content-Security-Policy`
4. Verify `script-src` does NOT contain `'unsafe-inline'` or `'unsafe-eval'`

**Expected Result:**
- CSP header should show: `script-src 'self' https://static.cloudflareinsights.com ...`
- `script-src` should NOT contain `'unsafe-inline'` or `'unsafe-eval'`
- `style-src` may contain `'unsafe-inline'` (required for Next.js CSS-in-JS - this is acceptable)

**Test Script Injection:**
```javascript
// In browser console, try to inject script
document.body.innerHTML += '<script>alert("XSS")</script>';
// Should be blocked by CSP
```

**Automated Test:**
```bash
# Check CSP header
curl -I https://your-domain.com | grep -i "content-security-policy"

# Should NOT contain unsafe-inline or unsafe-eval
```

### Test 1.2: Verify external script loading works

**Objective:** Confirm trusted external scripts still load

**Steps:**
1. Navigate to a page with PostHog analytics
2. Check Network tab for PostHog script requests
3. Verify scripts load successfully from allowed domains

**Expected Result:**
- PostHog scripts load from `https://app.posthog.com` or EU/US variants
- No CSP violations in console

## 2. Rate Limiting Testing

### Test 2.1: Registration Rate Limiting

**Objective:** Verify registration endpoint blocks after 5 attempts

**Steps:**
```bash
# Test registration rate limiting
for i in {1..6}; do
  echo "Attempt $i:"
  curl -X POST https://your-domain.com/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test'$i'@example.com",
      "password": "testpass123",
      "firstName": "Test",
      "otpCode": "123456",
      "locale": "en"
    }' \
    -w "\nHTTP Status: %{http_code}\n\n"
  sleep 1
done
```

**Expected Result:**
- First 5 attempts: May succeed or fail with validation errors (400)
- 6th attempt: Should return `429 Too Many Requests` with `Retry-After` header

**Check Security Logs:**
```sql
-- Query SecurityLog table for rate limit events
SELECT * FROM "SecurityLog" 
WHERE type = 'rate_limit_exceeded' 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

### Test 2.2: Sign-In Rate Limiting

**Objective:** Verify sign-in blocks after 10 failed attempts

**Steps:**
```bash
# Test sign-in rate limiting (use invalid credentials)
for i in {1..11}; do
  echo "Attempt $i:"
  curl -X POST https://your-domain.com/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "wrongpassword"
    }' \
    -c cookies.txt \
    -w "\nHTTP Status: %{http_code}\n\n"
  sleep 1
done
```

**Expected Result:**
- First 10 attempts: Return 401 Unauthorized
- 11th attempt: Should be blocked (rate limited) or take longer to respond

**Check Auth Logs:**
```sql
-- Query SecurityLog for failed auth attempts
SELECT email, success, "ipAddress", "createdAt" 
FROM "SecurityLog" 
WHERE type = 'auth_attempt' AND success = false
ORDER BY "createdAt" DESC 
LIMIT 20;
```

### Test 2.3: OTP Rate Limiting

**Objective:** Verify OTP endpoint blocks after 3 attempts

**Steps:**
```bash
# Test OTP send rate limiting
for i in {1..4}; do
  echo "Attempt $i:"
  curl -X POST https://your-domain.com/api/auth/otp/send \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com", "locale": "en"}' \
    -w "\nHTTP Status: %{http_code}\n\n"
  sleep 1
done
```

**Expected Result:**
- First 3 attempts: Should succeed (200) or return throttled message
- 4th attempt: Should return `429 Too Many Requests`

## 3. Session Cookie Security Testing

### Test 3.1: Verify SameSite=Strict

**Objective:** Confirm cookies use SameSite=Strict

**Steps:**
1. Open browser DevTools → Application/Storage → Cookies
2. Navigate to your domain
3. Find `next-auth.session-token` cookie
4. Check cookie attributes

**Expected Result:**
- `SameSite`: `Strict` (not `Lax` or `None`)
- `HttpOnly`: `true`
- `Secure`: `true` (in production)

**Automated Test:**
```bash
# Check Set-Cookie header
curl -I https://your-domain.com/api/auth/signin \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' \
  | grep -i "set-cookie"

# Should show: SameSite=Strict
```

### Test 3.2: CSRF Protection Test

**Objective:** Verify CSRF protection works with SameSite=Strict

**Steps:**
1. Create an HTML file on a different domain:
```html
<!-- evil-site.com/csrf-test.html -->
<!DOCTYPE html>
<html>
<body>
  <form id="csrf-form" action="https://your-domain.com/api/generations/create" method="POST">
    <input type="hidden" name="selfieId" value="test-id">
    <input type="hidden" name="prompt" value="test">
  </form>
  <script>
    document.getElementById('csrf-form').submit();
  </script>
</body>
</html>
```

2. Open this file in a browser (simulating cross-site request)
3. Check if the request succeeds

**Expected Result:**
- Request should fail with 401 Unauthorized
- Session cookie should NOT be sent due to SameSite=Strict
- Browser console may show CORS errors

## 4. E2E Test Security Testing

### Test 4.1: E2E Headers in Production

**Objective:** Verify E2E headers are ignored in production

**Steps:**
```bash
# Test E2E header bypass in production
curl https://your-domain.com/api/dashboard \
  -H "x-e2e-user-id: attacker-user-id" \
  -H "x-e2e-user-email: attacker@evil.com" \
  -H "x-e2e-user-role: admin" \
  -H "x-e2e-user-is-admin: true" \
  -v
```

**Expected Result:**
- Should return 401 Unauthorized (not authenticated as attacker)
- E2E headers should be completely ignored
- Check SecurityLog for `e2e_auth_bypass` entries (should only appear in dev/test)

**Check Logs:**
```sql
-- Should NOT find E2E bypass logs in production
SELECT * FROM "SecurityLog" 
WHERE type = 'suspicious_activity' 
AND details->>'reason' = 'e2e_auth_bypass'
AND "createdAt" > NOW() - INTERVAL '1 day';
```

### Test 4.2: E2E Headers in Development

**Objective:** Verify E2E headers work in development but are logged

**Steps:**
1. Set `NODE_ENV=development`
2. Make request with E2E headers
3. Check SecurityLog for audit entry

**Expected Result:**
- E2E headers work in development
- SecurityLog entry created with `e2e_auth_bypass` reason

## 5. Impersonation Audit Logging Testing

### Test 5.1: Verify Impersonation Logging

**Objective:** Confirm all impersonation actions are logged

**Prerequisites:**
- Admin account
- Target user account to impersonate

**Steps:**
1. Log in as admin
2. Set impersonation cookie:
```bash
# Get admin session first
curl -X POST https://your-domain.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"adminpass"}' \
  -c admin-cookies.txt

# Set impersonation cookie
curl https://your-domain.com/api/admin/impersonate?userId=TARGET_USER_ID \
  -b admin-cookies.txt \
  -c impersonated-cookies.txt
```

3. Make requests with impersonated session
4. Check SecurityLog

**Expected Result:**
```sql
-- Should find impersonation log entry
SELECT 
  "userId" as admin_id,
  email as admin_email,
  resource as impersonated_user_id,
  details->>'impersonatedUserEmail' as impersonated_email,
  "ipAddress",
  "userAgent",
  "createdAt"
FROM "SecurityLog"
WHERE type = 'impersonation'
ORDER BY "createdAt" DESC
LIMIT 10;
```

**Verify Log Contains:**
- Admin user ID and email
- Impersonated user ID and email
- IP address
- User agent
- Timestamp

## 6. SSRF Protection Testing

### Test 6.1: Private IP Address Blocking

**Objective:** Verify private IPs are blocked in team website URLs

**Test Cases:**
```bash
# Test 1: localhost
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "firstName": "Test",
    "teamWebsite": "http://localhost",
    "otpCode": "123456",
    "locale": "en"
  }'

# Test 2: 127.0.0.1
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@example.com",
    "password": "testpass123",
    "firstName": "Test",
    "teamWebsite": "http://127.0.0.1",
    "otpCode": "123456",
    "locale": "en"
  }'

# Test 3: Private IP range
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test3@example.com",
    "password": "testpass123",
    "firstName": "Test",
    "teamWebsite": "http://192.168.1.1",
    "otpCode": "123456",
    "locale": "en"
  }'

# Test 4: 10.x.x.x range
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test4@example.com",
    "password": "testpass123",
    "firstName": "Test",
    "teamWebsite": "http://10.0.0.1",
    "otpCode": "123456",
    "locale": "en"
  }'

# Test 5: 172.16.x.x range
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test5@example.com",
    "password": "testpass123",
    "firstName": "Test",
    "teamWebsite": "http://172.16.0.1",
    "otpCode": "123456",
    "locale": "en"
  }'
```

**Expected Result:**
- All should fail with validation error or return `isValid: false`
- Check logs for "SSRF protection" or "Private IP detected" messages

**Check Application Logs:**
```bash
# Look for SSRF protection logs
grep -i "ssrf\|private ip" /path/to/application.log
```

### Test 6.2: DNS Resolution Validation

**Objective:** Verify hostnames resolving to private IPs are blocked

**Steps:**
1. Set up a test DNS record pointing to 127.0.0.1 (or use a service like nip.io)
2. Try to register with that hostname:
```bash
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "firstName": "Test",
    "teamWebsite": "http://test.127.0.0.1.nip.io",
    "otpCode": "123456",
    "locale": "en"
  }'
```

**Expected Result:**
- Should be blocked if DNS resolves to private IP
- Error message about private IP addresses

### Test 6.3: Protocol Validation

**Objective:** Verify only HTTP/HTTPS protocols are allowed

**Test Cases:**
```bash
# Test file:// protocol
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "firstName": "Test",
    "teamWebsite": "file:///etc/passwd",
    "otpCode": "123456",
    "locale": "en"
  }'

# Test gopher:// protocol
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@example.com",
    "password": "testpass123",
    "firstName": "Test",
    "teamWebsite": "gopher://internal-server",
    "otpCode": "123456",
    "locale": "en"
  }'
```

**Expected Result:**
- Should fail with "Invalid protocol" error
- Only `http://` and `https://` should be accepted

## 7. Input Validation Testing

### Test 7.1: OTP Verification Input Validation

**Objective:** Verify OTP endpoint validates input properly

**Test Cases:**
```bash
# Test 1: Invalid email format
curl -X POST https://your-domain.com/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "not-an-email", "code": "1234"}'

# Test 2: Email too long
curl -X POST https://your-domain.com/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "'$(python3 -c "print('a' * 300 + '@example.com')")'", "code": "1234"}'

# Test 3: OTP code with letters
curl -X POST https://your-domain.com/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "code": "abcd"}'

# Test 4: OTP code too short
curl -X POST https://your-domain.com/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "code": "12"}'

# Test 5: OTP code too long
curl -X POST https://your-domain.com/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "code": "12345678901"}'

# Test 6: Missing fields
curl -X POST https://your-domain.com/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**Expected Result:**
- All should return `400 Bad Request` with validation error messages
- Error messages should be specific (e.g., "Invalid email format", "OTP code must contain only digits")

## 8. Password Hashing Testing

### Test 8.1: Verify Bcrypt Cost Factor

**Objective:** Confirm passwords are hashed with cost factor 13

**Steps:**
1. Register a new user
2. Check database for password hash:
```sql
SELECT 
  email,
  password,
  -- Extract cost factor from bcrypt hash (format: $2a$cost$...)
  SUBSTRING(password FROM '^\$2[aby]\$(\d{2})') as cost_factor
FROM "User"
WHERE email = 'test@example.com';
```

**Expected Result:**
- Cost factor should be `13` (not `12`)
- Hash should start with `$2a$13$` or `$2b$13$`

## 9. Automated Penetration Testing Script

Create a comprehensive test script:

```bash
#!/bin/bash
# penetration-test.sh

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_EMAIL="pentest-$(date +%s)@example.com"

echo "=== Penetration Testing Suite ==="
echo "Target: $BASE_URL"
echo ""

# Test 1: CSP Header Check
echo "1. Testing CSP Headers..."
CSP=$(curl -sI "$BASE_URL" | grep -i "content-security-policy" | cut -d: -f2-)
if echo "$CSP" | grep -q "unsafe-inline\|unsafe-eval"; then
  echo "❌ FAIL: CSP contains unsafe-inline or unsafe-eval"
else
  echo "✅ PASS: CSP is secure"
fi
echo ""

# Test 2: Rate Limiting
echo "2. Testing Registration Rate Limiting..."
for i in {1..6}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test$i@example.com\",\"password\":\"test\",\"firstName\":\"Test\",\"otpCode\":\"1234\",\"locale\":\"en\"}")
  
  if [ "$i" -le 5 ]; then
    echo "  Attempt $i: HTTP $STATUS"
  else
    if [ "$STATUS" = "429" ]; then
      echo "✅ PASS: Rate limiting works (HTTP 429 on attempt $i)"
    else
      echo "❌ FAIL: Rate limiting not working (HTTP $STATUS on attempt $i)"
    fi
  fi
done
echo ""

# Test 3: SSRF Protection
echo "3. Testing SSRF Protection..."
SSRF_TESTS=(
  "http://localhost"
  "http://127.0.0.1"
  "http://192.168.1.1"
  "http://10.0.0.1"
  "file:///etc/passwd"
)

for url in "${SSRF_TESTS[@]}"; do
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test@example.com\",\"password\":\"test\",\"firstName\":\"Test\",\"teamWebsite\":\"$url\",\"otpCode\":\"1234\",\"locale\":\"en\"}")
  
  if echo "$RESPONSE" | grep -qi "invalid\|private\|ssrf\|error"; then
    echo "✅ PASS: Blocked $url"
  else
    echo "❌ FAIL: Allowed $url"
  fi
done
echo ""

# Test 4: Cookie Security
echo "4. Testing Cookie Security..."
COOKIE_HEADER=$(curl -sI -X POST "$BASE_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' | grep -i "set-cookie")

if echo "$COOKIE_HEADER" | grep -qi "SameSite=Strict"; then
  echo "✅ PASS: Cookies use SameSite=Strict"
else
  echo "❌ FAIL: Cookies do not use SameSite=Strict"
fi

if echo "$COOKIE_HEADER" | grep -qi "HttpOnly"; then
  echo "✅ PASS: Cookies are HttpOnly"
else
  echo "❌ FAIL: Cookies are not HttpOnly"
fi
echo ""

echo "=== Testing Complete ==="
```

**Usage:**
```bash
chmod +x penetration-test.sh
BASE_URL=https://your-domain.com ./penetration-test.sh
```

## 10. Using Burp Suite / OWASP ZAP

### Burp Suite Setup

1. **Configure Proxy:**
   - Burp → Proxy → Options → Proxy Listeners → Add
   - Bind to port 8080

2. **Configure Browser:**
   - Set HTTP proxy to `127.0.0.1:8080`
   - Install Burp CA certificate

3. **Active Scanning:**
   - Right-click on target → Scan
   - Configure scan scope to your domain
   - Review findings for:
     - XSS vulnerabilities
     - CSRF vulnerabilities
     - Authentication bypass
     - SSRF vulnerabilities

### OWASP ZAP Setup

1. **Quick Start:**
   ```bash
   # Start ZAP
   zap.sh -quickurl https://your-domain.com -quickout report.html
   ```

2. **Manual Testing:**
   - Use ZAP's browser (configured proxy)
   - Navigate through application
   - ZAP will automatically detect vulnerabilities

3. **Review Alerts:**
   - Check for CSP issues
   - Check for missing security headers
   - Check for authentication issues

## 11. Security Monitoring

### Set Up Alerts

Monitor SecurityLog table for:
- Multiple failed auth attempts from same IP
- Rate limit exceeded events
- Impersonation actions
- SSRF protection triggers

**Example Alert Query:**
```sql
-- Alert on suspicious activity
SELECT 
  type,
  COUNT(*) as count,
  "ipAddress",
  MAX("createdAt") as last_occurrence
FROM "SecurityLog"
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
  AND type IN ('auth_attempt', 'rate_limit_exceeded', 'suspicious_activity')
GROUP BY type, "ipAddress"
HAVING COUNT(*) > 10
ORDER BY count DESC;
```

## 12. Reporting

After testing, create a report with:

1. **Executive Summary:**
   - Overall security posture
   - Critical findings
   - Recommendations

2. **Detailed Findings:**
   - For each test: Expected vs Actual results
   - Screenshots/evidence
   - Severity ratings

3. **Remediation:**
   - Prioritized list of fixes
   - Timeline recommendations

## Tools and Resources

- **OWASP Testing Guide:** https://owasp.org/www-project-web-security-testing-guide/
- **Burp Suite:** https://portswigger.net/burp
- **OWASP ZAP:** https://www.zaproxy.org/
- **Postman:** For API testing
- **curl:** Command-line testing
- **Browser DevTools:** For client-side testing

## Next Steps

1. Run automated test script
2. Perform manual testing for each security feature
3. Review SecurityLog entries
4. Document findings
5. Address any issues found
6. Re-test after fixes

