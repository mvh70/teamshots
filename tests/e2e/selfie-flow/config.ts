import { test as base, expect, Page } from '@playwright/test';
import { testFixtures } from '../../utils/test-data';

export const test = base.extend<{
  authenticatedPage: Page;
  teamContext: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Set test database environment
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__E2E__ = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__TEST_DB__ = true;
    })

    // Enable touch support for tablet tests
    await page.context().addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: false,
        value: 5,
      });
    });
    
    // No E2E headers needed - we'll do real login in tests

    // Only mock CSRF token - everything else goes to real API
    await page.context().route('**/api/auth/csrf**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-csrf-token' })
      });
    });

    // Navigate to selfies page
    const browserName = page.context().browser()?.browserType().name();
    const isWebKit = browserName === 'webkit';
    
    if (isWebKit) {
      // For WebKit, use locale prefix to avoid routing issues
      await page.goto('https://localhost:3000/en/app/selfies');
    } else {
      // For other browsers, use standard route
      await page.goto('https://localhost:3000/app/selfies');
    }
    
    // Wait for page to be fully loaded with mobile-specific timeout
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const isMobile = userAgent.includes('Mobile') || userAgent.includes('Android');
    
    if (isMobile) {
      // For mobile browsers, use a longer timeout and more lenient waiting
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      await page.waitForTimeout(2000); // Give mobile browsers extra time
    } else {
      await page.waitForLoadState('networkidle');
    }
    
    await use(page);
  },

  teamContext: async ({ page }, use) => {
    // Mark E2E env to disable client-side auth redirects
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__E2E__ = true
    })

    // Enable touch support for tablet tests
    await page.context().addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: false,
        value: 5,
      });
    });
    
    // Set up E2E authentication headers for team context
    await page.setExtraHTTPHeaders({
      'x-e2e-user-id': 'test-team-user-id',
      'x-e2e-user-email': 'admin@testteam.com',
      'x-e2e-user-role': 'team_admin',
      'x-e2e-user-locale': 'en'
    });

    // Only mock CSRF token - everything else goes to real API
    await page.context().route('**/api/auth/csrf**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-csrf-token' })
      });
    });

    // Set up team context in localStorage
    await page.addInitScript(() => {
      localStorage.setItem('user-mode', 'team');
      localStorage.setItem('team-context', JSON.stringify({
        id: 'test-team-id',
        name: 'Test Team',
        domain: 'testteam.com',
      }));
    });

    // Navigate to selfies page
    const browserName = page.context().browser()?.browserType().name();
    const isWebKit = browserName === 'webkit';
    
    if (isWebKit) {
      // For WebKit, use locale prefix to avoid routing issues
      await page.goto('https://localhost:3000/en/app/selfies');
    } else {
      // For other browsers, use standard route
      await page.goto('https://localhost:3000/app/selfies');
    }
    
    // Wait for page to be fully loaded with mobile-specific timeout
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const isMobile = userAgent.includes('Mobile') || userAgent.includes('Android');
    
    if (isMobile) {
      // For mobile browsers, use a longer timeout and more lenient waiting
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      await page.waitForTimeout(2000); // Give mobile browsers extra time
    } else {
      await page.waitForLoadState('networkidle');
    }
    
    await use(page);
  },
});

export { expect };

// Export test data for use in tests
export const testData = testFixtures;

// Helper function for clicking upload button
export async function clickUploadButton(page: any) {
  await page.click('[data-testid="upload-cta"]', { force: true });
}

// Helper function for mobile-safe clicking (handles interception issues)
export async function clickMobileSafe(page: any, selector: string) {
  const userAgent = await page.evaluate(() => navigator.userAgent);
  const isMobile = userAgent.includes('Mobile') || userAgent.includes('Android');
  
  if (isMobile) {
    // For mobile, try multiple click strategies to avoid interception issues
    try {
      // First try normal click with shorter timeout
      await page.click(selector, { force: true, timeout: 3000 });
    } catch (error) {
      // If normal click fails, try JavaScript click
      await page.evaluate((sel: string) => {
        const element = document.querySelector(sel) as HTMLElement;
        if (element) {
          element.click();
        }
      }, selector);
    }
  } else {
    await page.click(selector, { force: true });
  }
}