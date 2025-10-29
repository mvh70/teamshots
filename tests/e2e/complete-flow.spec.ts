import { test, expect } from '@playwright/test'

test.describe('Complete User Flow - Pricing to Generation', () => {
  test('complete individual user journey: pricing → signup → checkout → generation', async ({ page }) => {
    // Step 1: Start at pricing page
    await page.goto('/en/pricing')
    
    // Verify pricing page loads correctly
    await expect(page.locator('[data-testid="individual-plan-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="pro-plan-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="try-once-plan-card"]')).toBeVisible()
    
    // Step 2: Click individual plan button
    await page.click('[data-testid="individual-plan-button"]')
    
    // Should redirect to signup with individual tier pre-selected
    await expect(page).toHaveURL(/\/auth\/signup\?tier=individual&period=monthly/)
    
    // Verify individual option is pre-selected
    const individualButton = page.locator('[data-testid="individual-option"]')
    await expect(individualButton).toHaveClass(/border-brand-primary/)
    
    // Step 3: Complete signup form
    await page.fill('[data-testid="firstName-input"]', 'John')
    await page.fill('[data-testid="email-input"]', 'john@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.fill('[data-testid="confirmPassword-input"]', 'password123')
    
    // Mock OTP sending
    await page.route('**/api/auth/otp/send', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })
    
    // Send OTP
    await page.click('[data-testid="send-otp-button"]')
    
    // Fill OTP
    await page.fill('[data-testid="otp-input"]', '123456')
    
    // Mock registration and sign-in
    await page.route('**/api/auth/register', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })
    
    await page.route('**/api/auth/signin', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })
    
    // Complete signup
    await page.click('[data-testid="verify-otp-button"]')
    
    // Step 4: Should redirect to settings with purchase required
    await expect(page).toHaveURL(/\/en\/app\/settings\?purchase=required&tier=individual&period=monthly/)
    
    // Step 5: Purchase subscription
    await page.waitForSelector('[data-testid="subscription-section"]')
    
    // Mock checkout API
    await page.route('**/api/stripe/checkout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          checkoutUrl: 'https://checkout.stripe.com/test-session-123',
          sessionId: 'cs_test_123'
        })
      })
    })
    
    // Click individual monthly subscription
    await page.click('[data-testid="individual-monthly-button"]')
    
    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout\.stripe\.com/)
    
    // Step 6: Simulate successful checkout (mock webhook)
    await page.goto('/en/app/dashboard')
    
    // Mock user with active subscription and credits
    await page.route('**/api/user/subscription', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subscription: {
            status: 'active',
            tier: 'individual'
          }
        })
      })
    })
    
    await page.route('**/api/user/credits', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 60, // Monthly credits
          transactions: []
        })
      })
    })
    
    // Step 7: Generate photos
    await expect(page.locator('[data-testid="generation-form"]')).toBeVisible()
    
    // Mock generation API
    await page.route('**/api/generations/create', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          generationId: 'gen_123'
        })
      })
    })
    
    // Fill out generation form
    await page.fill('[data-testid="prompt-input"]', 'Professional headshot')
    await page.selectOption('[data-testid="style-select"]', 'corporate')
    
    // Submit generation
    await page.click('[data-testid="generate-button"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('complete team user journey: pricing → signup → checkout → generation', async ({ page }) => {
    // Step 1: Start at pricing page
    await page.goto('/en/pricing')
    
    // Step 2: Click pro plan button
    await page.click('[data-testid="pro-plan-button"]')
    
    // Should redirect to signup with team tier pre-selected
    await expect(page).toHaveURL(/\/auth\/signup\?tier=team&period=monthly/)
    
    // Verify team option is pre-selected
    const teamButton = page.locator('[data-testid="team-option"]')
    await expect(teamButton).toHaveClass(/border-brand-primary/)
    
    // Step 3: Complete signup form
    await page.fill('[data-testid="firstName-input"]', 'Jane')
    await page.fill('[data-testid="email-input"]', 'jane@company.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.fill('[data-testid="confirmPassword-input"]', 'password123')
    
    // Mock OTP and registration
    await page.route('**/api/auth/otp/send', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })
    
    await page.route('**/api/auth/register', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })
    
    await page.route('**/api/auth/signin', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })
    
    // Complete signup flow
    await page.click('[data-testid="send-otp-button"]')
    await page.fill('[data-testid="otp-input"]', '123456')
    await page.click('[data-testid="verify-otp-button"]')
    
    // Step 4: Should redirect to settings with team purchase required
    await expect(page).toHaveURL(/\/en\/app\/settings\?purchase=required&tier=team&period=monthly/)
    
    // Step 5: Purchase pro subscription
    await page.waitForSelector('[data-testid="subscription-section"]')
    
    // Mock checkout API
    await page.route('**/api/stripe/checkout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          checkoutUrl: 'https://checkout.stripe.com/test-session-456',
          sessionId: 'cs_test_456'
        })
      })
    })
    
    // Click pro monthly subscription
    await page.click('[data-testid="pro-monthly-button"]')
    
    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout\.stripe\.com/)
  })

  test('complete try once user journey: pricing → signup → checkout → generation', async ({ page }) => {
    // Step 1: Start at pricing page
    await page.goto('/en/pricing')
    
    // Step 2: Click try once plan button
    await page.click('[data-testid="try-once-plan-button"]')
    
    // Should redirect to signup with try_once period
    await expect(page).toHaveURL(/\/auth\/signup\?tier=individual&period=try_once/)
    
    // Step 3: Complete signup form
    await page.fill('[data-testid="firstName-input"]', 'Bob')
    await page.fill('[data-testid="email-input"]', 'bob@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.fill('[data-testid="confirmPassword-input"]', 'password123')
    
    // Mock OTP and registration
    await page.route('**/api/auth/otp/send', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })
    
    await page.route('**/api/auth/register', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })
    
    await page.route('**/api/auth/signin', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })
    
    // Complete signup flow
    await page.click('[data-testid="send-otp-button"]')
    await page.fill('[data-testid="otp-input"]', '123456')
    await page.click('[data-testid="verify-otp-button"]')
    
    // Step 4: Should redirect to settings with try_once purchase required
    await expect(page).toHaveURL(/\/en\/app\/settings\?purchase=required&tier=individual&period=try_once/)
    
    // Step 5: Purchase try once package
    await page.waitForSelector('[data-testid="subscription-section"]')
    
    // Mock checkout API
    await page.route('**/api/stripe/checkout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          checkoutUrl: 'https://checkout.stripe.com/test-session-789',
          sessionId: 'cs_test_789'
        })
      })
    })
    
    // Click try once button
    await page.click('[data-testid="try-once-button"]')
    
    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout\.stripe\.com/)
  })

  test('credit top-up flow for existing user', async ({ page }) => {
    // Mock authenticated user with existing subscription
    await page.route('**/api/user/subscription', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subscription: {
            status: 'active',
            tier: 'individual'
          }
        })
      })
    })
    
    await page.route('**/api/user/credits', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 5, // Low credits
          transactions: []
        })
      })
    })
    
    // Navigate to settings
    await page.goto('/en/app/settings')
    
    // Should see top-up options
    await expect(page.locator('[data-testid="individual-topup-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="try-once-topup-button"]')).toBeVisible()
    
    // Mock checkout API for top-up
    await page.route('**/api/stripe/checkout', async (route) => {
      const request = route.request()
      const body = JSON.parse(request.postData() || '{}')
      
      expect(body.type).toBe('top_up')
      expect(body.priceId).toBe('price_try_once_topup')
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          checkoutUrl: 'https://checkout.stripe.com/test-session-topup',
          sessionId: 'cs_test_topup'
        })
      })
    })
    
    // Click try once top-up
    await page.click('[data-testid="try-once-topup-button"]')
    
    // Should redirect to Stripe checkout
    await expect(page).toHaveURL(/checkout\.stripe\.com/)
  })

  test('upgrade flow for existing individual user', async ({ page }) => {
    // Mock user with individual subscription
    await page.route('**/api/user/subscription', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subscription: {
            status: 'active',
            tier: 'individual'
          }
        })
      })
    })
    
    // Navigate to settings
    await page.goto('/en/app/settings')
    
    // Should see upgrade option
    await expect(page.locator('[data-testid="upgrade-to-pro-button"]')).toBeVisible()
    
    // Mock upgrade API
    await page.route('**/api/stripe/subscriptions/upgrade', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          newTier: 'pro'
        })
      })
    })
    
    // Click upgrade button
    await page.click('[data-testid="upgrade-to-pro-button"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })
})
