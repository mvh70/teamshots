import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });


if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be defined in .env.test');
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

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Exclude selfie-flow and i18n-mobile tests from parallel execution
      testIgnore: /(selfie-flow|i18n-mobile)\.spec\.ts/,
    },
    {
      name: 'chromium-sequential',
      use: { ...devices['Desktop Chrome'] },
      // Only run database-intensive tests sequentially
      testMatch: /(selfie-flow|i18n-mobile|complete-real-test)\.spec\.ts/,
      // Force sequential execution for these tests
      fullyParallel: false,
      workers: 1,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      // Exclude selfie-flow and i18n-mobile tests from parallel execution
      testIgnore: /(selfie-flow|i18n-mobile)\.spec\.ts/,
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        extraHTTPHeaders: {
          'x-playwright-e2e': '1',
        },
      },
      // Exclude selfie-flow and i18n-mobile tests from parallel execution
      testIgnore: /(selfie-flow|i18n-mobile)\.spec\.ts/,
    },
    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        // Increase timeout for mobile Chrome
        actionTimeout: 15000,
        navigationTimeout: 30000,
      },
      // Exclude selfie-flow and i18n-mobile tests from parallel execution
      testIgnore: /(selfie-flow|i18n-mobile)\.spec\.ts/,
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      // Exclude selfie-flow and i18n-mobile tests from parallel execution
      testIgnore: /(selfie-flow|i18n-mobile)\.spec\.ts/,
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
