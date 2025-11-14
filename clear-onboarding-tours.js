// Clear all onboarding tours from localStorage and sessionStorage
// Run this in the browser console to reset all tours

const keysToRemove = [
  'onboarding-welcome-seen',
  'onboarding-team-admin-welcome-seen', 
  'onboarding-team-photo-style-setup-seen',
  'onboarding-team-photo-styles-page-seen',
  'onboarding-team-photo-styles-free-seen',
  'onboarding-personal-photo-styles-page-seen',
  'onboarding-personal-photo-styles-free-seen',
  'onboarding-photo-style-creation-seen',
  'onboarding-first-generation-seen',
  'onboarding-test-generation-seen',
  'onboarding-team-setup-seen',
  'onboarding-invite-team-seen',
  'onboarding-generation-detail-seen',
  'onboarding-context'
];

keysToRemove.forEach(key => {
  localStorage.removeItem(key);
  console.log(`Removed: ${key}`);
});

// Also clear sessionStorage
sessionStorage.removeItem('pending-tour');
console.log('Removed: pending-tour from sessionStorage');

console.log('All onboarding localStorage entries cleared! Refresh the page to see tours again.');

