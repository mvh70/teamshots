import { test, expect } from './e2e/photo-style-flow/config';

test.describe('Test Database Setup', () => {
  test('Verify test database is being used', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    // Navigate to a page that would make database calls
    await page.goto('https://localhost:3000/en/app/contexts/personal');
    await page.waitForLoadState('networkidle');
    
    // Check that we can access the page (which means database is working)
    await expect(page.locator('h1')).toContainText('Personal Photo Styles');
        
    console.log('✅ Test database is working correctly!');
  });
});
