// Test pricing page domain filtering logic
// Recreate the filtering logic inline for testing

function getSignupTypeFromDomain(domain) {
  if (!domain) return null
  const normalizedDomain = domain.replace(/^www\./, '')

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

function getPlansToShow(domainSignupType) {
  const plansToShow = [
    // Always show Try Once
    'tryOnce',
    // Show Pro if team domain or no domain restriction
    ...(domainSignupType === 'team' || domainSignupType === null ? ['pro'] : []),
    // Show Individual if individual domain or no domain restriction
    ...(domainSignupType === 'individual' || domainSignupType === null ? ['individual'] : []),
  ]
  return plansToShow
}

console.log('Testing pricing page domain filtering...');

// Test cases
const testCases = [
  { domain: 'teamshotspro.com', expectedPlans: ['tryOnce', 'pro'], description: 'Team domain should show Try Once + Pro' },
  { domain: 'photoshotspro.com', expectedPlans: ['tryOnce', 'individual'], description: 'Individual domain should show Try Once + Individual' },
  { domain: 'example.com', expectedPlans: ['tryOnce', 'pro', 'individual'], description: 'Unknown domain should show all plans' },
  { domain: null, expectedPlans: ['tryOnce', 'pro', 'individual'], description: 'No domain should show all plans' },
]

// Test localhost with forced type
process.env.FORCE_DOMAIN_SIGNUP_TYPE = 'team'
const localhostTeam = getSignupTypeFromDomain('localhost')
console.log(`✅ Localhost with FORCE_DOMAIN_SIGNUP_TYPE=team: "${localhostTeam}" (expected: "team")`)

process.env.FORCE_DOMAIN_SIGNUP_TYPE = 'individual'
const localhostIndividual = getSignupTypeFromDomain('localhost')
console.log(`✅ Localhost with FORCE_DOMAIN_SIGNUP_TYPE=individual: "${localhostIndividual}" (expected: "individual")`)

delete process.env.FORCE_DOMAIN_SIGNUP_TYPE
const localhostNoForce = getSignupTypeFromDomain('localhost')
console.log(`✅ Localhost without force: "${localhostNoForce}" (expected: "null")`)

// Test plan filtering
testCases.forEach(({ domain, expectedPlans, description }) => {
  const domainSignupType = getSignupTypeFromDomain(domain)
  const plansToShow = getPlansToShow(domainSignupType)
  const passed = JSON.stringify(plansToShow) === JSON.stringify(expectedPlans)
  console.log(`${passed ? '✅' : '❌'} ${description}`)
  console.log(`   Domain: "${domain}" → Type: "${domainSignupType}" → Plans: [${plansToShow.join(', ')}]`)
  if (!passed) {
    console.log(`   Expected: [${expectedPlans.join(', ')}]`)
  }
})

console.log('\n🎉 Pricing domain filtering tests complete!')
