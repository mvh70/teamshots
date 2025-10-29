import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

test.describe('Subscription Flow Integration', () => {
  let prisma: PrismaClient
  const baseUserId = 'subscription-flow-test-user-id'
  const baseUserEmail = 'subscriptionflow@example.com'
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
        firstName: 'Subscription',
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

  test('should handle complete subscription lifecycle', async ({ page }) => {
    const { userId, userEmail } = await createTestUser('complete-lifecycle')

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

    // Start the flow
    await page.goto('https://localhost:3000/en/pricing')
    
    // Click individual plan
    await page.click('[data-testid="individual-plan-button"]')
    
    // Should redirect to signup
    await expect(page).toHaveURL(/\/auth\/signup\?tier=individual&period=monthly/)
    
    // Complete signup
    await page.fill('[data-testid="firstName-input"]', 'John')
    await page.fill('[data-testid="email-input"]', userEmail)
    await page.fill('[data-testid="password-input"]', plainPassword)
    await page.fill('[data-testid="confirmPassword-input"]', plainPassword)
    
    await page.click('[data-testid="send-otp-button"]')
    await page.fill('[data-testid="otp-input"]', '123456')
    await page.click('[data-testid="verify-otp-button"]')
    
    // Should redirect to checkout
    await expect(page).toHaveURL(/\/en\/app\/settings\?purchase=required&tier=individual&period=monthly/)
    
    // Purchase subscription
    await page.waitForSelector('[data-testid="subscription-section"]')
    await page.click('[data-testid="individual-monthly-button"]')
    
    // Should redirect to Stripe
    await expect(page).toHaveURL(/checkout\.stripe\.com/)
  })

  test('should handle upgrade flow', async ({ page }) => {
    const { userId, userEmail } = await createTestUser('upgrade-flow')

    // Create user with individual subscription in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        metadata: {
          subscription: {
            status: 'active',
            tier: 'individual',
            stripeSubscriptionId: 'sub_test_123'
          }
        }
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
    
    // Should see upgrade option
    await expect(page.locator('[data-testid="upgrade-to-pro-button"]')).toBeVisible()
    
    // Click upgrade
    await page.click('[data-testid="upgrade-to-pro-button"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should handle downgrade flow', async ({ page }) => {
    const { userId, userEmail } = await createTestUser('downgrade-flow')

    // Create user with pro subscription in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        metadata: {
          subscription: {
            status: 'active',
            tier: 'pro',
            stripeSubscriptionId: 'sub_test_456',
            contract_end: '2024-12-31'
          }
        }
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
    
    // Should see downgrade option
    await expect(page.locator('[data-testid="downgrade-to-individual-button"]')).toBeVisible()
    
    // Click downgrade
    await page.click('[data-testid="downgrade-to-individual-button"]')
    
    // Should show confirmation with effective date
    await expect(page.locator('[data-testid="downgrade-confirmation"]')).toBeVisible()
    await expect(page.locator('[data-testid="downgrade-confirmation"]')).toContainText('2024-12-31')
  })
})