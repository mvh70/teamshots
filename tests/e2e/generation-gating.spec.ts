import { test, expect } from '@playwright/test'

test.describe('Generation Gating', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.evaluate(() => {
      window.localStorage.setItem('auth-token', 'mock-token')
    })
  })

  test('should allow generation with sufficient individual credits', async ({ page }) => {
    // Mock user with credits
    await page.route('**/api/user/credits', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 50,
          transactions: []
        })
      })
    })

    // Mock generation API success
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

    await page.goto('/en/app/dashboard')
    
    // Should be able to access generation form
    await expect(page.locator('[data-testid="generation-form"]')).toBeVisible()
    
    // Fill out generation form
    await page.fill('[data-testid="prompt-input"]', 'Professional headshot')
    await page.selectOption('[data-testid="style-select"]', 'corporate')
    
    // Submit generation
    await page.click('[data-testid="generate-button"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should block generation with insufficient credits', async ({ page }) => {
    // Mock user with no credits
    await page.route('**/api/user/credits', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 0,
          transactions: []
        })
      })
    })

    // Mock generation API to return insufficient credits error
    await page.route('**/api/generations/create', async (route) => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Insufficient individual credits',
          required: 10,
          available: 0,
          message: 'Please purchase a subscription or credit package to generate photos',
          redirectTo: '/en/app/settings?purchase=required'
        })
      })
    })

    await page.goto('/en/app/dashboard')
    
    // Fill out generation form
    await page.fill('[data-testid="prompt-input"]', 'Professional headshot')
    await page.selectOption('[data-testid="style-select"]', 'corporate')
    
    // Submit generation
    await page.click('[data-testid="generate-button"]')
    
    // Should show insufficient credits error
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Insufficient individual credits')
    
    // Should show purchase button
    await expect(page.locator('[data-testid="purchase-button"]')).toBeVisible()
  })

  test('should allow generation with active subscription', async ({ page }) => {
    // Mock user with active subscription
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

    // Mock generation API success
    await page.route('**/api/generations/create', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          generationId: 'gen_456'
        })
      })
    })

    await page.goto('/en/app/dashboard')
    
    // Should be able to access generation form
    await expect(page.locator('[data-testid="generation-form"]')).toBeVisible()
    
    // Fill out generation form
    await page.fill('[data-testid="prompt-input"]', 'Professional headshot')
    await page.selectOption('[data-testid="style-select"]', 'corporate')
    
    // Submit generation
    await page.click('[data-testid="generate-button"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should redirect to purchase page when clicking purchase button', async ({ page }) => {
    // Mock user with no credits
    await page.route('**/api/user/credits', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 0,
          transactions: []
        })
      })
    })

    // Mock generation API to return insufficient credits error
    await page.route('**/api/generations/create', async (route) => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Insufficient individual credits',
          required: 10,
          available: 0,
          message: 'Please purchase a subscription or credit package to generate photos',
          redirectTo: '/en/app/settings?purchase=required'
        })
      })
    })

    await page.goto('/en/app/dashboard')
    
    // Fill out generation form and submit
    await page.fill('[data-testid="prompt-input"]', 'Professional headshot')
    await page.selectOption('[data-testid="style-select"]', 'corporate')
    await page.click('[data-testid="generate-button"]')
    
    // Click purchase button
    await page.click('[data-testid="purchase-button"]')
    
    // Should redirect to settings page with purchase required
    await expect(page).toHaveURL(/\/en\/app\/settings\?purchase=required/)
  })

  test('should handle team credits for team users', async ({ page }) => {
    // Mock user with team credits
    await page.route('**/api/user/credits', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 0,
          teamBalance: 100,
          transactions: []
        })
      })
    })

    // Mock generation API success for team credits
    await page.route('**/api/generations/create', async (route) => {
      const request = route.request()
      const body = JSON.parse(request.postData() || '{}')
      
      if (body.creditSource === 'team') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            generationId: 'gen_789'
          })
        })
      } else {
        await route.fulfill({
          status: 402,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Insufficient individual credits'
          })
        })
      }
    })

    await page.goto('/en/app/dashboard')
    
    // Select team credits
    await page.selectOption('[data-testid="credit-source-select"]', 'team')
    
    // Fill out generation form
    await page.fill('[data-testid="prompt-input"]', 'Professional headshot')
    await page.selectOption('[data-testid="style-select"]', 'corporate')
    
    // Submit generation
    await page.click('[data-testid="generate-button"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should show credit balance in UI', async ({ page }) => {
    // Mock user with credits
    await page.route('**/api/user/credits', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance: 25,
          teamBalance: 50,
          transactions: []
        })
      })
    })

    await page.goto('/en/app/dashboard')
    
    // Should show individual credit balance
    await expect(page.locator('[data-testid="individual-credits"]')).toContainText('25')
    
    // Should show team credit balance
    await expect(page.locator('[data-testid="team-credits"]')).toContainText('50')
  })
})
