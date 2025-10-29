import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

test.describe('Credit System Integration', () => {
  let prisma: PrismaClient
  const baseUserId = 'credit-system-test-user-id'
  const baseUserEmail = 'creditsystem@example.com'
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
        firstName: 'Credit',
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

  test('should handle credit top-up flow', async ({ page }) => {
    const { userId, userEmail } = await createTestUser('credit-topup')

    // Create initial credits in database
    await prisma.creditTransaction.create({
      data: {
        userId: userId,
        credits: 10,
        type: 'purchase',
        description: 'Initial credits',
        amount: 5.00,
        currency: 'USD',
        planTier: 'try_once',
        planPeriod: 'one_time'
      }
    })

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
    
    // Navigate to credits section
    await page.click('[data-testid="credits-tab"]')
    
    // Should see current balance
    await expect(page.locator('[data-testid="credit-balance"]')).toContainText('10')
    
    // Click top-up button
    await page.click('[data-testid="top-up-button"]')
    
    // Should show top-up options
    await expect(page.locator('[data-testid="top-up-modal"]')).toBeVisible()
    
    // Select try once top-up
    await page.click('[data-testid="try-once-topup-option"]')
    
    // Click purchase
    await page.click('[data-testid="purchase-topup-button"]')
    
    // Should redirect to Stripe
    await expect(page).toHaveURL(/checkout\.stripe\.com/)
  })

  test('should prevent generation without credits', async ({ page }) => {
    const { userId, userEmail } = await createTestUser('no-credits')

    // Create user with no credits
    await prisma.creditTransaction.create({
      data: {
        userId: userId,
        credits: 0,
        type: 'purchase',
        description: 'No credits',
        amount: 0,
        currency: 'USD',
        planTier: 'try_once',
        planPeriod: 'one_time'
      }
    })

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

    await page.goto('https://localhost:3000/en/app/upload')
    
    // Upload a selfie
    await page.setInputFiles('[data-testid="selfie-upload"]', 'tests/fixtures/valid-selfie.jpg')
    await page.click('[data-testid="upload-button"]')
    
    // Try to generate
    await page.click('[data-testid="generate-button"]')
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Insufficient credits')
    
    // Should show redirect button
    await expect(page.locator('[data-testid="purchase-credits-button"]')).toBeVisible()
  })

  test('should allow generation with sufficient credits', async ({ page }) => {
    const { userId, userEmail } = await createTestUser('sufficient-credits')

    // Create user with credits
    await prisma.creditTransaction.create({
      data: {
        userId: userId,
        credits: 20,
        type: 'purchase',
        description: 'Initial credits',
        amount: 8.90,
        currency: 'USD',
        planTier: 'try_once',
        planPeriod: 'one_time'
      }
    })

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

    await page.goto('https://localhost:3000/en/app/upload')
    
    // Upload a selfie
    await page.setInputFiles('[data-testid="selfie-upload"]', 'tests/fixtures/valid-selfie.jpg')
    await page.click('[data-testid="upload-button"]')
    
    // Generate photos
    await page.click('[data-testid="generate-button"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Generation started')
    
    // Should show remaining credits
    await expect(page.locator('[data-testid="remaining-credits"]')).toContainText('16')
  })

  test('should handle credit transaction history', async ({ page }) => {
    const { userId, userEmail } = await createTestUser('transaction-history')

    // Create transaction history in database
    await prisma.creditTransaction.createMany({
      data: [
        {
          userId: userId,
          credits: 20,
          type: 'purchase',
          description: 'Credit top-up - try_once (20 credits)',
          amount: 8.90,
          currency: 'USD',
          planTier: 'try_once',
          planPeriod: 'one_time'
        },
        {
          userId: userId,
          credits: -4,
          type: 'usage',
          description: 'Photo generation'
        }
      ]
    })

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
    
    // Navigate to credits section
    await page.click('[data-testid="credits-tab"]')
    
    // Should show transaction history
    await expect(page.locator('[data-testid="transaction-history"]')).toBeVisible()
    
    // Should show purchase transaction
    await expect(page.locator('[data-testid="transaction-0"]')).toContainText('Credit top-up')
    await expect(page.locator('[data-testid="transaction-0"]')).toContainText('+20')
    
    // Should show usage transaction
    await expect(page.locator('[data-testid="transaction-1"]')).toContainText('Photo generation')
    await expect(page.locator('[data-testid="transaction-1"]')).toContainText('-4')
  })
})