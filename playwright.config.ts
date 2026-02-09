import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Allow self-signed certificates for HTTPS dev server health checks
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be defined in .env.test')
}

(process.env as Record<string, string>).NODE_ENV = 'test';


const E2E_PORT = 3001
const E2E_BASE_URL = `https://localhost:${E2E_PORT}`

export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry flaky tests caused by parallel DB contention */
  retries: process.env.CI ? 2 : 1,
  /* Limit workers to reduce database contention; CI uses 1 for determinism */
  workers: process.env.CI ? 1 : 4,
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
    baseURL: E2E_BASE_URL,
    /* Ignore self-signed cert errors (dev server uses --experimental-https) */
    ignoreHTTPSErrors: true,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects by domain and browser.
     Each project uses a hosts-file domain (e.g. teamshotspro → 127.0.0.1) as baseURL
     and x-forwarded-host for the proxy's domain routing (needs .com suffix). */
  projects: [
    // ============================================
    // TeamShots Domain (teamshotspro.com)
    // ============================================
    {
      name: 'teamshots-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `https://teamshotspro:${E2E_PORT}`,
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
        baseURL: `https://teamshotspro:${E2E_PORT}`,
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
    // ============================================
    {
      name: 'portreya-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `https://portreya:${E2E_PORT}`,
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
        baseURL: `https://portreya:${E2E_PORT}`,
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
    // ============================================
    {
      name: 'shared-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: E2E_BASE_URL,
      },
      testDir: './tests/e2e/shared',
      testMatch: '**/*.spec.ts',
    },
  ],

  /* Start dedicated E2E dev server on a separate port using test database.
     Uses port 3001 to avoid conflicts with any manually running dev server. */
  webServer: {
    command: `npx next dev --experimental-https -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL,
      NEXT_DIST_DIR: '.next-e2e',
      NEXTAUTH_URL: E2E_BASE_URL,
      NEXT_PUBLIC_BASE_URL: E2E_BASE_URL,
      ENFORCE_CANONICAL_HOST: 'false',
      ENABLE_CROSS_DOMAIN_REDIRECT: 'false',
      NEXT_PUBLIC_ENABLE_CROSS_DOMAIN_REDIRECT: 'false',
    },
  },
});
