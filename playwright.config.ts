import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });


const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be defined in .env.test')
}

(process.env as Record<string, string>).NODE_ENV = 'test';


export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Global setup for test database */
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/test-results.json' }],
    ['junit', { outputFile: 'playwright-report/junit.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.NEXT_PUBLIC_BASE_URL || 'https://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects by domain and browser */
  projects: [
    // ============================================
    // TeamShots Domain (teamshotspro.com)
    // Tests: team-admin, team-member flows
    // ============================================
    {
      name: 'teamshots-chromium',
      use: {
        ...devices['Desktop Chrome'],
        extraHTTPHeaders: {
          'x-forwarded-host': 'teamshotspro.com',
        },
      },
      testDir: './tests/e2e/teamshots',
      testMatch: '**/*.spec.ts',
    },
    {
      name: 'teamshots-mobile',
      use: {
        ...devices['Pixel 5'],
        extraHTTPHeaders: {
          'x-forwarded-host': 'teamshotspro.com',
        },
        actionTimeout: 15000,
        navigationTimeout: 30000,
      },
      testDir: './tests/e2e/teamshots',
      testMatch: '**/*.spec.ts',
    },

    // ============================================
    // Portreya Domain (portreya.com)
    // Tests: individual user flows
    // ============================================
    {
      name: 'portreya-chromium',
      use: {
        ...devices['Desktop Chrome'],
        extraHTTPHeaders: {
          'x-forwarded-host': 'portreya.com',
        },
      },
      testDir: './tests/e2e/portreya',
      testMatch: '**/*.spec.ts',
    },
    {
      name: 'portreya-mobile',
      use: {
        ...devices['Pixel 5'],
        extraHTTPHeaders: {
          'x-forwarded-host': 'portreya.com',
        },
        actionTimeout: 15000,
        navigationTimeout: 30000,
      },
      testDir: './tests/e2e/portreya',
      testMatch: '**/*.spec.ts',
    },

    // ============================================
    // Shared Tests (domain-agnostic)
    // Tests: auth, admin, common features
    // ============================================
    {
      name: 'shared-chromium',
      use: { ...devices['Desktop Chrome'] },
      testDir: './tests/e2e/shared',
      testMatch: '**/*.spec.ts',
    },

    // ============================================
    // Legacy Tests (existing tests during migration)
    // TODO: Remove after migration complete
    // ============================================
    {
      name: 'legacy-chromium',
      use: { ...devices['Desktop Chrome'] },
      testDir: './tests/e2e/legacy',
      testMatch: '**/*.spec.ts',
      testIgnore: /(selfie-flow|i18n-mobile)\.spec\.ts/,
    },
    {
      name: 'legacy-sequential',
      use: { ...devices['Desktop Chrome'] },
      testDir: './tests/e2e/legacy',
      testMatch: /(selfie-flow|i18n-mobile|complete-real-test)\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
    },
  ],

  /* Use existing dev server on port 3000 */
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'https://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  //   env: {
  //     ...process.env,
  //     NODE_ENV: 'test',
  //     DATABASE_URL: process.env.DATABASE_URL,
  //   },
  // },
});
