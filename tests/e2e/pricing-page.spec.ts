import { test, expect } from '@playwright/test'

test.describe('Pricing Page Redirects', () => {
  test('should redirect individual plan button to signup with individual tier', async ({ page }) => {
    await page.goto('/en/pricing')
    
    // Find the individual plan button
    const individualButton = page.locator('[data-testid="individual-plan-button"]')
    await expect(individualButton).toBeVisible()
    
    // Click the button
    await individualButton.click()
    
    // Should redirect to signup with individual tier
    await expect(page).toHaveURL(/\/auth\/signup\?tier=individual&period=monthly/)
  })

  test('should redirect pro plan button to signup with team tier', async ({ page }) => {
    await page.goto('/en/pricing')
    
    // Find the pro plan button
    const proButton = page.locator('[data-testid="pro-plan-button"]')
    await expect(proButton).toBeVisible()
    
    // Click the button
    await proButton.click()
    
    // Should redirect to signup with team tier
    await expect(page).toHaveURL(/\/auth\/signup\?tier=team&period=monthly/)
  })

  test('should redirect try once plan button to signup with try_once period', async ({ page }) => {
    await page.goto('/en/pricing')
    
    // Find the try once plan button
    const tryOnceButton = page.locator('[data-testid="try-once-plan-button"]')
    await expect(tryOnceButton).toBeVisible()
    
    // Click the button
    await tryOnceButton.click()
    
    // Should redirect to signup with try_once period
    await expect(page).toHaveURL(/\/auth\/signup\?tier=individual&period=try_once/)
  })

  test('should work with Spanish locale', async ({ page }) => {
    await page.goto('/es/pricing')
    
    // Find the individual plan button
    const individualButton = page.locator('[data-testid="individual-plan-button"]')
    await expect(individualButton).toBeVisible()
    
    // Click the button
    await individualButton.click()
    
    // Should redirect to Spanish signup with individual tier
    await expect(page).toHaveURL(/\/es\/auth\/signup\?tier=individual&period=monthly/)
  })

  test('should show correct pricing information', async ({ page }) => {
    await page.goto('/en/pricing')
    
    // Check that pricing cards are visible
    await expect(page.locator('[data-testid="individual-plan-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="pro-plan-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="try-once-plan-card"]')).toBeVisible()
    
    // Check individual plan pricing
    const individualPrice = page.locator('[data-testid="individual-plan-card"] [data-testid="price"]')
    await expect(individualPrice).toContainText('$24.00')
    
    // Check pro plan pricing
    const proPrice = page.locator('[data-testid="pro-plan-card"] [data-testid="price"]')
    await expect(proPrice).toContainText('$49.00')
    
    // Check try once plan pricing
    const tryOncePrice = page.locator('[data-testid="try-once-plan-card"] [data-testid="price"]')
    await expect(tryOncePrice).toContainText('$5.00')
  })

  test('should toggle between monthly and yearly pricing', async ({ page }) => {
    await page.goto('/en/pricing')
    
    // Find the yearly toggle
    const yearlyToggle = page.locator('[data-testid="yearly-toggle"]')
    await expect(yearlyToggle).toBeVisible()
    
    // Initially should show monthly pricing
    const individualPrice = page.locator('[data-testid="individual-plan-card"] [data-testid="price"]')
    await expect(individualPrice).toContainText('$24.00')
    
    // Click yearly toggle
    await yearlyToggle.click()
    
    // Should show yearly pricing (monthly equivalent)
    await expect(individualPrice).toContainText('$19.00') // $228 / 12
  })

  test('should show savings badge for yearly plans', async ({ page }) => {
    await page.goto('/en/pricing')
    
    // Click yearly toggle
    await page.click('[data-testid="yearly-toggle"]')
    
    // Check that savings badge is visible
    const savingsBadge = page.locator('[data-testid="individual-plan-card"] [data-testid="savings-badge"]')
    await expect(savingsBadge).toBeVisible()
    await expect(savingsBadge).toContainText('Save')
  })
})
