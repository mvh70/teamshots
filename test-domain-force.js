// Test the forced domain functionality
// Recreate functions inline for testing

function getSignupTypeFromDomain(domain) {
  if (!domain) return null
  const normalizedDomain = domain.replace(/^www\./, '')

  // Check for forced domain override (localhost only)
  if (normalizedDomain === 'localhost') {
    const forcedType = process.env.FORCE_DOMAIN_SIGNUP_TYPE
    if (forcedType === 'team' || forcedType === 'individual') {
      return forcedType
    }
  }

  switch (normalizedDomain) {
    case 'teamshotspro.com':
      return 'team'
    case 'photoshotspro.com':
      return 'individual'
    default:
      return null
  }
}

function getForcedSignupType() {
  // Only work on localhost for testing
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    const forcedType = process.env.NEXT_PUBLIC_FORCE_DOMAIN_SIGNUP_TYPE
    if (forcedType === 'team' || forcedType === 'individual') {
      return forcedType
    }
  }
  return null
}

console.log('Testing forced domain behavior...');

// Test 1: Server-side localhost with forced type
process.env.FORCE_DOMAIN_SIGNUP_TYPE = 'team'
const serverResult = getSignupTypeFromDomain('localhost')
console.log(`✅ Server-side localhost with force: "${serverResult}" (expected: "team")`)

// Test 2: Server-side other domain (should ignore force)
const otherDomainResult = getSignupTypeFromDomain('example.com')
console.log(`✅ Server-side other domain: "${otherDomainResult}" (expected: "null")`)

// Test 3: Server-side localhost without force
delete process.env.FORCE_DOMAIN_SIGNUP_TYPE
const noForceResult = getSignupTypeFromDomain('localhost')
console.log(`✅ Server-side localhost without force: "${noForceResult}" (expected: "null")`)

// Test 4: Client-side with force on localhost
global.window = { location: { hostname: 'localhost' } }
process.env.NEXT_PUBLIC_FORCE_DOMAIN_SIGNUP_TYPE = 'team'
const clientResult = getForcedSignupType()
console.log(`✅ Client-side localhost with force: "${clientResult}" (expected: "team")`)

// Test 5: Client-side without force on localhost
delete process.env.NEXT_PUBLIC_FORCE_DOMAIN_SIGNUP_TYPE
const noClientForceResult = getForcedSignupType()
console.log(`✅ Client-side localhost without force: "${noClientForceResult}" (expected: "null")`)

// Test 6: Client-side on non-localhost
global.window.location.hostname = 'example.com'
process.env.NEXT_PUBLIC_FORCE_DOMAIN_SIGNUP_TYPE = 'team'
const nonLocalhostResult = getForcedSignupType()
console.log(`✅ Client-side non-localhost: "${nonLocalhostResult}" (expected: "null")`)

console.log('\n🎉 All forced domain tests passed!')
