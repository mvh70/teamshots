import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

test.describe('Signup Flow with Individual/Team Selection', () => {
  let prisma: PrismaClient
  const baseUserEmail = 'signupflow@example.com'
  const plainPassword = 'TestPassword123!'

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
    await prisma.person.deleteMany({ where: { email: { contains: 'signupflow' } } })
    await prisma.user.deleteMany({ where: { email: { contains: 'signupflow' } } })
    await prisma.$disconnect()
  })

  test('should complete individual signup and land on dashboard (free plan)', async ({ page }) => {
    const testId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const userEmail = `${baseUserEmail.split('@')[0]}-individual-${testId}@${baseUserEmail.split('@')[1]}`

    // Use real API: no mocks

    // Navigate to signup page
    await page.goto('https://localhost:3000/en/auth/signup?tier=individual&period=monthly')
    
    // Fill in signup form
    await page.fill('[data-testid="firstName-input"]', 'John')
    await page.fill('[data-testid="email-input"]', userEmail)
    await page.fill('[data-testid="password-input"]', plainPassword)
    await page.fill('[data-testid="confirmPassword-input"]', plainPassword)
    
    // Select individual user type
    await page.click('[data-testid="individual-user-type"]')
    
    // Send OTP
    await page.click('[data-testid="send-otp-button"]')
    
    // Read latest OTP from DB and fill it
    const otp = await prisma.oTP.findFirst({ where: { email: userEmail }, orderBy: { createdAt: 'desc' } })
    const code = otp?.code || '000000'
    await page.fill('[data-testid="otp-input"]', code)
    
    // Verify OTP and complete signup
    await page.click('[data-testid="verify-otp-button"]')
    
    // Should land on dashboard (free plan)
    await expect(page).toHaveURL(/\/en\/app\/dashboard/)
  })

  test('should complete team signup and land on dashboard (free plan)', async ({ page }) => {
    const testId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const userEmail = `${baseUserEmail.split('@')[0]}-team-${testId}@${baseUserEmail.split('@')[1]}`

    // Use real API: no mocks

    // Navigate to signup page
    await page.goto('https://localhost:3000/en/auth/signup?tier=team&period=monthly')
    
    // Fill in signup form
    await page.fill('[data-testid="firstName-input"]', 'Jane')
    await page.fill('[data-testid="email-input"]', userEmail)
    await page.fill('[data-testid="password-input"]', plainPassword)
    await page.fill('[data-testid="confirmPassword-input"]', plainPassword)
    
    // Select team user type
    await page.click('[data-testid="team-user-type"]')
    
    // Send OTP
    await page.click('[data-testid="send-otp-button"]')
    
    const otp = await prisma.oTP.findFirst({ where: { email: userEmail }, orderBy: { createdAt: 'desc' } })
    const code = otp?.code || '000000'
    await page.fill('[data-testid="otp-input"]', code)
    
    // Verify OTP and complete signup
    await page.click('[data-testid="verify-otp-button"]')
    
    // Should land on dashboard (free plan)
    await expect(page).toHaveURL(/\/en\/app\/dashboard/)
  })

  test('should handle signup without pre-selected tier and land on dashboard', async ({ page }) => {
    const testId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const userEmail = `${baseUserEmail.split('@')[0]}-no-tier-${testId}@${baseUserEmail.split('@')[1]}`

    // Use real API: no mocks

    // Navigate to signup page without tier parameter
    await page.goto('https://localhost:3000/en/auth/signup')
    
    // Should show user type selection
    await expect(page.locator('[data-testid="user-type-selection"]')).toBeVisible()
    
    // Fill in signup form
    await page.fill('[data-testid="firstName-input"]', 'Bob')
    await page.fill('[data-testid="email-input"]', userEmail)
    await page.fill('[data-testid="password-input"]', plainPassword)
    await page.fill('[data-testid="confirmPassword-input"]', plainPassword)
    
    // Select individual user type
    await page.click('[data-testid="individual-user-type"]')
    
    // Send OTP
    await page.click('[data-testid="send-otp-button"]')
    
    const otp = await prisma.oTP.findFirst({ where: { email: userEmail }, orderBy: { createdAt: 'desc' } })
    const code = otp?.code || '000000'
    await page.fill('[data-testid="otp-input"]', code)
    
    // Verify OTP and complete signup
    await page.click('[data-testid="verify-otp-button"]')
    
    // Should land on dashboard (free plan)
    await expect(page).toHaveURL(/\/en\/app\/dashboard/)
  })

  test('should validate required fields', async ({ page }) => {
    await page.goto('https://localhost:3000/en/auth/signup')
    
    // Try to submit without filling required fields
    await page.click('[data-testid="send-otp-button"]')
    
    // Should show validation errors
    await expect(page.locator('[data-testid="firstName-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible()
  })

  test('should validate password confirmation', async ({ page }) => {
    await page.goto('https://localhost:3000/en/auth/signup')
    
    // Fill form with mismatched passwords
    await page.fill('[data-testid="firstName-input"]', 'Test')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.fill('[data-testid="confirmPassword-input"]', 'different123')
    
    await page.click('[data-testid="send-otp-button"]')
    
    // Should show password mismatch error
    await expect(page.locator('[data-testid="confirmPassword-error"]')).toBeVisible()
  })
})