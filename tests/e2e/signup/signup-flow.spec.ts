import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

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

  test('should complete individual signup and redirect to checkout', async ({ page }) => {
    const testId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const userEmail = `${baseUserEmail.split('@')[0]}-individual-${testId}@${baseUserEmail.split('@')[1]}`

    // Mock OTP sending
    await page.context().route('**/api/auth/otp/send', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    // Mock OTP verification and registration
    await page.context().route('**/api/auth/register', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

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
    
    // Fill OTP
    await page.fill('[data-testid="otp-input"]', '123456')
    
    // Verify OTP and complete signup
    await page.click('[data-testid="verify-otp-button"]')
    
    // Should redirect to checkout with individual tier
    await expect(page).toHaveURL(/\/en\/app\/settings\?purchase=required&tier=individual&period=monthly/)
  })

  test('should complete team signup and redirect to checkout', async ({ page }) => {
    const testId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const userEmail = `${baseUserEmail.split('@')[0]}-team-${testId}@${baseUserEmail.split('@')[1]}`

    // Mock OTP sending
    await page.context().route('**/api/auth/otp/send', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    // Mock OTP verification and registration
    await page.context().route('**/api/auth/register', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

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
    
    // Fill OTP
    await page.fill('[data-testid="otp-input"]', '123456')
    
    // Verify OTP and complete signup
    await page.click('[data-testid="verify-otp-button"]')
    
    // Should redirect to checkout with team tier
    await expect(page).toHaveURL(/\/en\/app\/settings\?purchase=required&tier=team&period=monthly/)
  })

  test('should handle signup without pre-selected tier', async ({ page }) => {
    const testId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const userEmail = `${baseUserEmail.split('@')[0]}-no-tier-${testId}@${baseUserEmail.split('@')[1]}`

    // Mock OTP sending
    await page.context().route('**/api/auth/otp/send', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

    // Mock OTP verification and registration
    await page.context().route('**/api/auth/register', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })

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
    
    // Fill OTP
    await page.fill('[data-testid="otp-input"]', '123456')
    
    // Verify OTP and complete signup
    await page.click('[data-testid="verify-otp-button"]')
    
    // Should redirect to checkout with individual tier and monthly period
    await expect(page).toHaveURL(/\/en\/app\/settings\?purchase=required&tier=individual&period=monthly/)
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