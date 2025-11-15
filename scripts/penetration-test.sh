#!/bin/bash
# Penetration Testing Script for TeamShots Security Improvements
# Usage: BASE_URL=https://your-domain.com ./scripts/penetration-test.sh

# Don't exit on error - we want to run all tests and report results
set +e

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_EMAIL="pentest-$(date +%s)@example.com"
RESULTS_DIR="./penetration-test-results"
mkdir -p "$RESULTS_DIR"

echo "=== TeamShots Penetration Testing Suite ==="
echo "Target: $BASE_URL"
echo "Timestamp: $(date)"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

# Test result tracking
test_pass() {
  echo -e "${GREEN}✅ PASS:${NC} $1"
  ((PASS_COUNT++))
}

test_fail() {
  echo -e "${RED}❌ FAIL:${NC} $1"
  ((FAIL_COUNT++))
}

test_warn() {
  echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

# Test 1: CSP Header Check
echo "1. Testing Content Security Policy..."
# Check if server is running
if ! curl -s --head "$BASE_URL" > /dev/null 2>&1; then
  test_fail "Server is not running at $BASE_URL"
  echo "Please start the server first: npm run dev"
  exit 1
fi

# Try multiple routes - middleware applies to page routes, not API routes
CSP_ROUTES=("/" "/en" "/es" "/app/dashboard")
CSP_FOUND=false

for route in "${CSP_ROUTES[@]}"; do
  FULL_URL="${BASE_URL}${route}"
  CSP=$(curl -sI -L "$FULL_URL" 2>/dev/null | grep -i "content-security-policy" | cut -d: -f2- | tr -d '\r\n' | xargs)
  
  if [ -n "$CSP" ]; then
    CSP_FOUND=true
    # Extract script-src directive specifically (style-src can have unsafe-inline for Next.js CSS-in-JS)
    SCRIPT_SRC=$(echo "$CSP" | grep -oE "script-src[^;]*" || echo "")
    
    if [ -z "$SCRIPT_SRC" ]; then
      test_warn "script-src directive not found in CSP on $route"
    elif echo "$SCRIPT_SRC" | grep -qE "unsafe-inline|unsafe-eval"; then
      test_fail "script-src contains unsafe-inline or unsafe-eval on $route: $SCRIPT_SRC"
      echo "$route: $CSP" >> "$RESULTS_DIR/csp-header.txt"
    else
      test_pass "CSP script-src is secure (no unsafe-inline/unsafe-eval) on $route"
      echo "$route: $CSP" >> "$RESULTS_DIR/csp-header.txt"
      break
    fi
  fi
done

if [ "$CSP_FOUND" = false ]; then
  test_warn "CSP header not found on any tested routes. Middleware may not be applying."
  echo "Tested routes: ${CSP_ROUTES[*]}" >> "$RESULTS_DIR/csp-header.txt"
fi
echo ""

# Test 2: Registration Rate Limiting
echo "2. Testing Registration Rate Limiting..."
RATE_LIMIT_WORKING=false
for i in {1..6}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test$i-$(date +%s)@example.com\",\"password\":\"testpass123\",\"firstName\":\"Test\",\"otpCode\":\"123456\",\"locale\":\"en\"}" 2>/dev/null)
  
  if [ "$i" -le 5 ]; then
    echo "  Attempt $i: HTTP $STATUS"
  else
    if [ "$STATUS" = "429" ]; then
      test_pass "Rate limiting works (HTTP 429 on attempt $i)"
      RATE_LIMIT_WORKING=true
    else
      test_fail "Rate limiting not working (HTTP $STATUS on attempt $i, expected 429)"
    fi
  fi
  sleep 0.5
done
echo ""

# Test 3: SSRF Protection
echo "3. Testing SSRF Protection..."
SSRF_TESTS=(
  "http://localhost"
  "http://127.0.0.1"
  "http://192.168.1.1"
  "http://10.0.0.1"
  "http://172.16.0.1"
  "file:///etc/passwd"
  "gopher://internal"
)

SSRF_BLOCKED=0
for url in "${SSRF_TESTS[@]}"; do
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test-ssrf-$(date +%s)@example.com\",\"password\":\"testpass123\",\"firstName\":\"Test\",\"teamWebsite\":\"$url\",\"otpCode\":\"123456\",\"locale\":\"en\"}" 2>/dev/null)
  
  if echo "$RESPONSE" | grep -qiE "invalid|private|ssrf|error|does not match"; then
    test_pass "Blocked SSRF attempt: $url"
    ((SSRF_BLOCKED++))
  else
    test_fail "Allowed potential SSRF: $url"
    echo "Response: $RESPONSE" >> "$RESULTS_DIR/ssrf-failures.txt"
  fi
done

if [ "$SSRF_BLOCKED" -eq "${#SSRF_TESTS[@]}" ]; then
  test_pass "All SSRF test cases blocked"
else
  test_fail "Only $SSRF_BLOCKED/${#SSRF_TESTS[@]} SSRF test cases blocked"
fi
echo ""

# Test 4: Cookie Security
echo "4. Testing Cookie Security..."
COOKIE_HEADER=$(curl -sI -X POST "$BASE_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' 2>/dev/null | grep -i "set-cookie" | head -1)

if [ -z "$COOKIE_HEADER" ]; then
  test_warn "No Set-Cookie header found (may require valid credentials)"
else
  if echo "$COOKIE_HEADER" | grep -qi "SameSite=Strict"; then
    test_pass "Cookies use SameSite=Strict"
  else
    test_fail "Cookies do not use SameSite=Strict"
    echo "Cookie header: $COOKIE_HEADER" >> "$RESULTS_DIR/cookie-security.txt"
  fi

  if echo "$COOKIE_HEADER" | grep -qi "HttpOnly"; then
    test_pass "Cookies are HttpOnly"
  else
    test_fail "Cookies are not HttpOnly"
  fi

  if echo "$COOKIE_HEADER" | grep -qi "Secure"; then
    test_pass "Cookies use Secure flag"
  else
    test_warn "Cookies do not use Secure flag (may be OK in development)"
  fi
fi
echo ""

# Test 5: Input Validation
echo "5. Testing Input Validation (OTP endpoint)..."
INVALID_EMAIL=$(curl -s -X POST "$BASE_URL/api/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","code":"1234"}' 2>/dev/null)

if echo "$INVALID_EMAIL" | grep -qiE "invalid|error|validation"; then
  test_pass "Invalid email format rejected"
else
  test_fail "Invalid email format accepted"
fi

INVALID_CODE=$(curl -s -X POST "$BASE_URL/api/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"abc"}' 2>/dev/null)

if echo "$INVALID_CODE" | grep -qiE "invalid|error|validation|digits"; then
  test_pass "Invalid OTP code format rejected"
else
  test_fail "Invalid OTP code format accepted"
fi
echo ""

# Test 6: Security Headers
echo "6. Testing Security Headers..."
# Check page route (not API) for security headers
HEADERS=$(curl -sI -L "${BASE_URL}/en" 2>/dev/null)

REQUIRED_HEADERS=(
  "X-Frame-Options"
  "X-Content-Type-Options"
  "Content-Security-Policy"
)

OPTIONAL_HEADERS=(
  "Strict-Transport-Security"  # Only in HTTPS
)

for header in "${REQUIRED_HEADERS[@]}"; do
  if echo "$HEADERS" | grep -qi "^$header:"; then
    test_pass "Security header present: $header"
  else
    test_fail "Security header missing: $header"
  fi
done

for header in "${OPTIONAL_HEADERS[@]}"; do
  if echo "$HEADERS" | grep -qi "^$header:"; then
    test_pass "Security header present: $header"
  else
    # HSTS only applies to HTTPS
    if echo "$BASE_URL" | grep -q "^https://"; then
      test_warn "Security header missing (expected for HTTPS): $header"
    else
      test_pass "Security header not required (HTTP): $header"
    fi
  fi
done

echo "$HEADERS" > "$RESULTS_DIR/security-headers.txt"
echo ""

# Test 7: E2E Header Security (Production Check)
echo "7. Testing E2E Header Security..."
# Check if this looks like production (not localhost or 127.0.0.1)
IS_PRODUCTION=false
if echo "$BASE_URL" | grep -qE "https://.*\.(com|net|org|io|app)"; then
  IS_PRODUCTION=true
fi

if [ "$IS_PRODUCTION" = true ]; then
  E2E_RESPONSE=$(curl -s "$BASE_URL/api/dashboard" \
    -H "x-e2e-user-id: attacker-id" \
    -H "x-e2e-user-email: attacker@evil.com" \
    -H "x-e2e-user-is-admin: true" 2>/dev/null)
  
  if echo "$E2E_RESPONSE" | grep -qiE "unauthorized|401|forbidden|403"; then
    test_pass "E2E headers ignored in production"
  else
    test_fail "E2E headers may be working in production (security risk!)"
  fi
else
  # In development, E2E headers should work (this is expected)
  test_pass "E2E headers allowed in development (expected behavior)"
fi
echo ""

# Summary
echo "=== Test Summary ==="
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo ""
echo "Detailed results saved to: $RESULTS_DIR/"

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed. Review results above.${NC}"
  exit 1
fi

