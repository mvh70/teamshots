import { test as base, expect, Page } from '@playwright/test';
import { testFixtures } from '../../utils/test-data';

export const test = base.extend<{
  authenticatedPage: Page;
  companyContext: Page;
  inviteContext: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Set test database environment
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      win.__E2E__ = true;
      win.__TEST_DB__ = true;
    })

    // Enable touch support for tablet tests
    await page.context().addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: false,
        value: 5,
      });
    });
    
    // Set up E2E authentication headers for individual user
    await page.setExtraHTTPHeaders({
      'x-e2e-user-id': 'test-user-id',
      'x-e2e-user-email': 'test@example.com',
      'x-e2e-user-role': 'user',
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

    // Navigate to generation start page
    const browserName = page.context().browser()?.browserType().name();
    const isWebKit = browserName === 'webkit';
    
    if (isWebKit) {
      // For WebKit, use locale prefix to avoid routing issues
      await page.goto('https://localhost:3000/en/app/contexts/personal');
    } else {
      // For other browsers, use standard route
      await page.goto('https://localhost:3000/app/contexts/personal');
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

  companyContext: async ({ page }, use) => {
    // Mark E2E env to disable client-side auth redirects
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      win.__E2E__ = true;
    })

    // Enable touch support for tablet tests
    await page.context().addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: false,
        value: 5,
      });
    });
    
    // Set up E2E authentication headers for company context
    await page.setExtraHTTPHeaders({
      'x-e2e-user-id': 'test-company-user-id',
      'x-e2e-user-email': 'admin@testcompany.com',
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

    // Set up company context in localStorage
    await page.addInitScript(() => {
      localStorage.setItem('user-mode', 'company');
      localStorage.setItem('company-context', JSON.stringify({
        id: 'test-company-id',
        name: 'Test Company',
        domain: 'testcompany.com',
      }));
    });

    // Navigate to generation start page
    const browserName = page.context().browser()?.browserType().name();
    const isWebKit = browserName === 'webkit';
    
    if (isWebKit) {
      // For WebKit, use locale prefix to avoid routing issues
      await page.goto('https://localhost:3000/en/app/contexts/personal');
    } else {
      // For other browsers, use standard route
      await page.goto('https://localhost:3000/app/contexts/personal');
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

  inviteContext: async ({ page }, use) => {
    // Mark E2E env to disable client-side auth redirects
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      win.__E2E__ = true;
    })

    // Enable touch support for tablet tests
    await page.context().addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: false,
        value: 5,
      });
    });
    
    // Set up E2E authentication headers for invite context
    await page.setExtraHTTPHeaders({
      'x-e2e-user-id': 'test-invite-user-id',
      'x-e2e-user-email': 'invited@testcompany.com',
      'x-e2e-user-role': 'team_member',
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

    // Navigate to invite dashboard
    const browserName = page.context().browser()?.browserType().name();
    const isWebKit = browserName === 'webkit';
    
    if (isWebKit) {
      // For WebKit, use locale prefix to avoid routing issues
      await page.goto('https://localhost:3000/en/invite-dashboard/test-invite-token');
    } else {
      // For other browsers, use standard route
      await page.goto('https://localhost:3000/invite-dashboard/test-invite-token');
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

// Helper function for clicking generation button
export async function clickGenerateButton(page: any) {
  await page.click('[data-testid="generate-button"]', { force: true });
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

// Helper function to select generation type
export async function selectGenerationType(page: any, type: 'personal' | 'company') {
  const selector = `[data-testid="generation-type-${type}"]`;
  await clickMobileSafe(page, selector);
}

// Helper function to select photo style settings
export async function selectPhotoStyleSetting(page: any, category: string, setting: string) {
  const selector = `[data-testid="photo-style-${category}-${setting}"]`;
  await clickMobileSafe(page, selector);
}

// Helper function to toggle photo style category
export async function togglePhotoStyleCategory(page: any, category: string) {
  const selector = `[data-testid="photo-style-toggle-${category}"]`;
  await clickMobileSafe(page, selector);
}
