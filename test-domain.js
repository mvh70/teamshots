// Simple test for domain detection functions
// Recreate the function inline for testing
function getSignupTypeFromDomain(domain) {
  if (!domain) return null

  // Normalize domain (handle www. prefix)
  const normalizedDomain = domain.replace(/^www\./, '')

  switch (normalizedDomain) {
    case 'teamshotspro.com':
      return 'team'
    case 'photoshotspro.com':
      return 'individual'
    default:
      return null // Allow selection UI
  }
}

// Test cases
const testCases = [
  { domain: 'teamshotspro.com', expected: 'team' },
  { domain: 'www.teamshotspro.com', expected: 'team' },
  { domain: 'photoshotspro.com', expected: 'individual' },
  { domain: 'www.photoshotspro.com', expected: 'individual' },
  { domain: 'localhost', expected: null },
  { domain: 'example.com', expected: null },
  { domain: null, expected: null },
  { domain: undefined, expected: null },
];

console.log('Testing getSignupTypeFromDomain function...');

let allPassed = true;
testCases.forEach(({ domain, expected }) => {
  try {
    const result = getSignupTypeFromDomain(domain);
    const passed = result === expected;
    console.log(`${passed ? '✅' : '❌'} getSignupTypeFromDomain("${domain}") = "${result}" (expected: "${expected}")`);
    if (!passed) allPassed = false;
  } catch (error) {
    console.log(`❌ getSignupTypeFromDomain("${domain}") threw error: ${error.message}`);
    allPassed = false;
  }
});

console.log(`\n${allPassed ? '🎉 All tests passed!' : '❌ Some tests failed!'}`);
process.exit(allPassed ? 0 : 1);
