import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

test.describe('Stripe Checkout Flow', () => {
  let prisma: PrismaClient
  const baseUserId = 'stripe-checkout-test-user-id'
  const baseUserEmail = 'stripecheckout@example.com'
  const plainPassword = 'TestPassword123!'

  // Helper function to create unique test user
  async function createTestUser(testName: string) {
    const testId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const userId = `${baseUserId}-${testName}-${testId}`
    const userEmail = `${baseUserEmail.split('@')[0]}-${testName}-${testId}@${baseUserEmail.split('@')[1]}`
    
    const hashedPassword = await bcrypt.hash(plainPassword, 10)
    await prisma.user.create({
      data: {
        id: userId,
        email: userEmail,
        password: hashedPassword,
        role: 'user',
        locale: 'en',
        metadata: {},
        emailVerified: new Date(),
      }
    })

    await prisma.person.create({
      data: {
        firstName: 'Stripe',
        lastName: 'Test',
        email: userEmail,
        userId: userId
      }
    })

    return { userId, userEmail, plainPassword }
  }

  test.beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/teamshots_test?schema=public'
        }
      }
    })
  })

  test.afterAll(async () => {
    // Clean up test users
    await prisma.person.deleteMany({ where: { userId: { startsWith: baseUserId } } })
    await prisma.user.deleteMany({ where: { id: { startsWith: baseUserId } } })
    await prisma.$disconnect()
  })

  test('should create checkout session for individual monthly subscription', async ({ page }) => {
    const { userId, userEmail } = await createTestUser('individual-monthly')

    // Set up E2E authentication headers
    await page.setExtraHTTPHeaders({
      'x-e2e-user-id': userId,
      'x-e2e-user-email': userEmail,
      'x-e2e-user-role': 'user',
      'x-e2e-user-locale': 'en'
    })

    // Only mock CSRF token - everything else goes to real API
    await page.context().route('**/api/auth/csrf**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-csrf-token' })
      })
    })

    // Navigate to settings page
    await page.goto('https://localhost:3000/en/app/settings?purchase=required&tier=individual&period=monthly')
    
    // Wait for subscription section to load
    await page.waitForSelector('[data-testid="subscription-section"]')
    
    // Click on individual monthly subscription
    await page.click('[data-testid="individual-monthly-button"]')
    
    // Verify redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout\.stripe\.com/)
  })

  test('should create checkout session for try once purchase', async ({ page }) => {
    const { userId, userEmail } = await createTestUser('try-once')

    // Set up E2E authentication headers
    await page.setExtraHTTPHeaders({
      'x-e2e-user-id': userId,
      'x-e2e-user-email': userEmail,
      'x-e2e-user-role': 'user',
      'x-e2e-user-locale': 'en'
    })

    // Only mock CSRF token - everything else goes to real API
    await page.context().route('**/api/auth/csrf**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-csrf-token' })
      })
    })

    await page.goto('https://localhost:3000/en/app/settings?purchase=required&tier=individual&period=try_once')
    
    await page.waitForSelector('[data-testid="subscription-section"]')
    await page.click('[data-testid="try-once-button"]')
    
    await expect(page).toHaveURL(/checkout\.stripe\.com/)
  })

  test('should create checkout session for credit top-up', async ({ page }) => {
    const { userId, userEmail } = await createTestUser('credit-topup')

    // Set up E2E authentication headers
    await page.setExtraHTTPHeaders({
      'x-e2e-user-id': userId,
      'x-e2e-user-email': userEmail,
      'x-e2e-user-role': 'user',
      'x-e2e-user-locale': 'en'
    })

    // Only mock CSRF token - everything else goes to real API
    await page.context().route('**/api/auth/csrf**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-csrf-token' })
      })
    })

    await page.goto('https://localhost:3000/en/app/settings')
    
    await page.waitForSelector('[data-testid="subscription-section"]')
    await page.click('[data-testid="try-once-topup-button"]')
    
    await expect(page).toHaveURL(/checkout\.stripe\.com/)
  })

  test('should handle checkout API errors gracefully', async ({ page }) => {
    const { userId, userEmail } = await createTestUser('checkout-error')

    // Set up E2E authentication headers
    await page.setExtraHTTPHeaders({
      'x-e2e-user-id': userId,
      'x-e2e-user-email': userEmail,
      'x-e2e-user-role': 'user',
      'x-e2e-user-locale': 'en'
    })

    // Only mock CSRF token - everything else goes to real API
    await page.context().route('**/api/auth/csrf**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-csrf-token' })
      })
    })

    // Mock checkout API to return error
    await page.context().route('**/api/stripe/checkout', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid price ID'
        })
      })
    })

    await page.goto('https://localhost:3000/en/app/settings?purchase=required&tier=individual&period=monthly')
    
    await page.waitForSelector('[data-testid="subscription-section"]')
    await page.click('[data-testid="individual-monthly-button"]')
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid price ID')
  })
})