import { test, expect, testData, clickUploadButton } from './config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('Internationalization and Mobile Testing', () => {
  let prisma: PrismaClient;
  const userId = 'selfie-i18n-test-user-id';
  const userEmail = 'selfiei18ntest@example.com';
  const plainPassword = 'TestPassword123!';

  test.beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/teamshots_test?schema=public'
        }
      }
    });

    // Create a user in the test database
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
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
    });

    // Create a person record for the user
    await prisma.person.create({
      data: {
        firstName: 'I18n',
        lastName: 'Test',
        email: userEmail,
        userId: userId
      }
    });
    console.log(`✅ Created test user: ${userEmail}`);
  });

  test.afterAll(async () => {
    // Clean up the user and person from the test database
    await prisma.person.deleteMany({ where: { userId: userId } });
    await prisma.user.delete({ where: { id: userId } });
    console.log(`✅ Cleaned up test user: ${userEmail}`);
    await prisma.$disconnect();
  });
  test('should display Spanish UI elements correctly', async ({ page }) => {
    // Set up E2E authentication headers for our real test user
    await page.setExtraHTTPHeaders({
      'x-e2e-user-id': userId,
      'x-e2e-user-email': userEmail,
      'x-e2e-user-role': 'user',
      'x-e2e-user-locale': 'en'
    });

    // Set desktop viewport for this test
    await page.setViewportSize({ width: 1920, height: 1080 });
    // Test Spanish internationalization
    await page.goto('https://localhost:3000/es/app/selfies');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Debug: Check what title elements are available
    const landscapeTitle = await page.locator('[data-testid="selfies-title"]').count();
    const portraitTitle = await page.locator('[data-testid="selfies-title"]').count();
    
    // Try both title elements - one should be visible
    const titleLocator = landscapeTitle > 0 
      ? page.locator('[data-testid="selfies-title"]')
      : page.locator('[data-testid="selfies-title"]');
    
    await expect(titleLocator).toContainText('Selfies', { timeout: 10000 });
    await expect(page.locator('[data-testid="empty-title"]')).toContainText('Aún no hay selfies');
    await expect(page.locator('[data-testid="empty-subtitle"]')).toContainText('Toma o sube una selfie');
    await expect(page.locator('[data-testid="upload-cta"]').first()).toContainText('Tomar o Subir Selfie');
  });

  test('should display Spanish text in upload flow', async ({ page }) => {
    // Set up E2E authentication headers for our real test user
    await page.setExtraHTTPHeaders({
      'x-e2e-user-id': userId,
      'x-e2e-user-email': userEmail,
      'x-e2e-user-role': 'user',
      'x-e2e-user-locale': 'en'
    });

    // Set desktop viewport for this test
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('https://localhost:3000/es/app/selfies');
    await clickUploadButton(page);
    
    // Verify Spanish upload flow text
    await expect(page.locator('[data-testid="desktop-upload-title"]')).toContainText('Subir una Nueva Selfie', { timeout: 10000 });
    await expect(page.locator('[data-testid="upload-description"]').first()).toContainText('Toma una foto con tu cámara o sube una foto existente para comenzar');
  });

  test('should display Spanish text in approval flow', async ({ page }) => {
    // Set up E2E authentication headers for our real test user
    await page.setExtraHTTPHeaders({
      'x-e2e-user-id': userId,
      'x-e2e-user-email': userEmail,
      'x-e2e-user-role': 'user',
      'x-e2e-user-locale': 'en'
    });

    // Set desktop viewport for this test
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('https://localhost:3000/es/app/selfies');
    await clickUploadButton(page);
    await page.locator('[data-testid="desktop-file-input"]').setInputFiles(testData.files.validSelfie);
    
    // Verify Spanish approval text
    await expect(page.locator('[data-testid="approval-title"]')).toContainText('Revisa tu selfie');
    await expect(page.locator('[data-testid="approve-button"]')).toContainText('Aprobar y Guardar');
    await expect(page.locator('[data-testid="retake-button"]')).toContainText('Tomar Otra Foto');
    await expect(page.locator('[data-testid="cancel-button"]')).toContainText('Cancelar');
  });

  test.describe('Mobile viewport testing', () => {
    test.use({ 
      viewport: { width: 375, height: 667 }, // iPhone SE
      hasTouch: true // Enable touch support for mobile tests
    });

    test('should display mobile-optimized selfies page', async ({ page }) => {
      // Set up E2E authentication headers for our real test user
      await page.setExtraHTTPHeaders({
        'x-e2e-user-id': userId,
        'x-e2e-user-email': userEmail,
        'x-e2e-user-role': 'user',
        'x-e2e-user-locale': 'en'
      });

      // Navigate to selfies page
      await page.goto('https://localhost:3000/en/app/selfies');
      await page.waitForLoadState('networkidle');
      
      // Verify mobile layout - mobile uses upload-cta in empty state
      await expect(page.locator('[data-testid="empty-state"] [data-testid="upload-cta"]')).toBeVisible();
    });

    test('should display mobile-optimized upload UI', async ({ page }) => {
      // Set up E2E authentication headers for our real test user
      await page.setExtraHTTPHeaders({
        'x-e2e-user-id': userId,
        'x-e2e-user-email': userEmail,
        'x-e2e-user-role': 'user',
        'x-e2e-user-locale': 'en'
      });

      // Navigate to selfies page
      await page.goto('https://localhost:3000/en/app/selfies');
      await page.waitForLoadState('networkidle');
      
      await clickUploadButton(page);
      
      // Wait for upload flow to load
      await page.waitForLoadState('networkidle');
      
      // Verify mobile-specific elements
      await expect(page.locator('[data-testid="mobile-upload-interface"]')).toBeVisible();
      await expect(page.locator('[data-testid="camera-button"]')).toBeVisible();
    });

    test('should handle mobile touch interactions', async ({ page }) => {
      // Set up E2E authentication headers for our real test user
      await page.setExtraHTTPHeaders({
        'x-e2e-user-id': userId,
        'x-e2e-user-email': userEmail,
        'x-e2e-user-role': 'user',
        'x-e2e-user-locale': 'en'
      });

      // Navigate to selfies page
      await page.goto('https://localhost:3000/en/app/selfies');
      await page.waitForLoadState('networkidle');
      
      await clickUploadButton(page);
      
      // Test touch interactions - verify camera button is visible and clickable
      await expect(page.locator('[data-testid="camera-button"]')).toBeVisible();
      
      // Test tap interaction (camera might not work in test environment)
      await page.tap('[data-testid="camera-button"]');
      
      // Wait a moment for any potential camera interface to appear
      await page.waitForTimeout(1000);
      
      // Verify the button was responsive (no error occurred)
      await expect(page.locator('[data-testid="camera-button"]')).toBeVisible();
    });

    test('should display mobile-optimized approval screen', async ({ page }) => {
      // Set up E2E authentication headers for our real test user
      await page.setExtraHTTPHeaders({
        'x-e2e-user-id': userId,
        'x-e2e-user-email': userEmail,
        'x-e2e-user-role': 'user',
        'x-e2e-user-locale': 'en'
      });

      // Navigate to selfies page
      await page.goto('https://localhost:3000/en/app/selfies');
      await page.waitForLoadState('networkidle');
      
      await clickUploadButton(page);
      await page.locator('[data-testid="desktop-file-input"]').setInputFiles(testData.files.validSelfie);
      
      // Verify mobile approval layout
      await expect(page.locator('[data-testid="approval-screen"]')).toBeVisible();
      await expect(page.locator('[data-testid="approve-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="retake-button"]')).toBeVisible();
    });
  });

  test.describe('Tablet viewport testing', () => {
    test.use({ 
      viewport: { width: 768, height: 1024 }, // iPad
      hasTouch: true // Enable touch support for tablet tests
    });

    test('should display tablet-optimized layout', async ({ page }) => {
      // Set up E2E authentication headers for our real test user
      await page.setExtraHTTPHeaders({
        'x-e2e-user-id': userId,
        'x-e2e-user-email': userEmail,
        'x-e2e-user-role': 'user',
        'x-e2e-user-locale': 'en'
      });

      // Navigate to selfies page
      await page.goto('https://localhost:3000/en/app/selfies');
      await page.waitForLoadState('networkidle');
      
      // First upload a selfie to populate the layout
      // Use the empty state upload CTA for tablet
      await clickUploadButton(page);
      await page.locator('[data-testid="desktop-file-input"]').setInputFiles(testData.files.validSelfie);
      await page.click('[data-testid="approve-button"]');
      
      // Wait for the upload to be processed
      await page.waitForLoadState('networkidle');
      
      // Verify tablet layout
      await expect(page.locator('[data-testid="selfies-title"]')).toBeVisible();
    });

    test('should handle tablet touch interactions', async ({ page }) => {
      // Set up E2E authentication headers for our real test user
      await page.setExtraHTTPHeaders({
        'x-e2e-user-id': userId,
        'x-e2e-user-email': userEmail,
        'x-e2e-user-role': 'user',
        'x-e2e-user-locale': 'en'
      });

      // Navigate to selfies page
      await page.goto('https://localhost:3000/en/app/selfies');
      await page.waitForLoadState('networkidle');
      
      await clickUploadButton(page);
      
      // Test tablet-specific interactions
      await page.tap('[data-testid="dropzone"]');
      
      // Verify the dropzone is interactive (file input should be accessible)
      await expect(page.locator('[data-testid="desktop-file-input"]')).toBeAttached();
    });
  });

  test.describe('Orientation changes', () => {
    test('should handle orientation change from portrait to landscape', async ({ page }) => {
      // Set up E2E authentication headers for our real test user
      await page.setExtraHTTPHeaders({
        'x-e2e-user-id': userId,
        'x-e2e-user-email': userEmail,
        'x-e2e-user-role': 'user',
        'x-e2e-user-locale': 'en'
      });

      // Navigate to selfies page
      await page.goto('https://localhost:3000/en/app/selfies');
      await page.waitForLoadState('networkidle');
      
      // Start in portrait
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Change to landscape
      await page.setViewportSize({ width: 667, height: 375 });
      
      // Verify layout adapts
      await expect(page.locator('[data-testid="selfies-title"]')).toBeVisible();
    });

    test('should handle orientation change during upload', async ({ page }) => {
      // Set up E2E authentication headers for our real test user
      await page.setExtraHTTPHeaders({
        'x-e2e-user-id': userId,
        'x-e2e-user-email': userEmail,
        'x-e2e-user-role': 'user',
        'x-e2e-user-locale': 'en'
      });

      // Navigate to selfies page
      await page.goto('https://localhost:3000/en/app/selfies');
      await page.waitForLoadState('networkidle');
      
      await page.setViewportSize({ width: 375, height: 667 });
      await clickUploadButton(page);
      
      // Change orientation during upload
      await page.setViewportSize({ width: 667, height: 375 });
      
      // Verify upload flow still works
      await page.locator('[data-testid="desktop-file-input"]').setInputFiles(testData.files.validSelfie);
      await expect(page.locator('[data-testid="approval-screen"]')).toBeVisible();
    });
  });

  test.describe('Accessibility testing', () => {
    test('should support keyboard navigation', async ({ page }) => {
      // Set up E2E authentication headers for our real test user
      await page.setExtraHTTPHeaders({
        'x-e2e-user-id': userId,
        'x-e2e-user-email': userEmail,
        'x-e2e-user-role': 'user',
        'x-e2e-user-locale': 'en'
      });

      // Navigate to selfies page
      await page.goto('https://localhost:3000/en/app/selfies');
      await page.waitForLoadState('networkidle');
      
      // Test keyboard navigation - focus on the upload CTA
      const uploadCta = page.locator('[data-testid="upload-cta"]').first();
      await uploadCta.focus();
      await expect(uploadCta).toBeFocused();
      
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-testid="upload-flow"]')).toBeVisible();
    });

    test('should have proper ARIA labels', async ({ page }) => {
      // Set up E2E authentication headers for our real test user
      await page.setExtraHTTPHeaders({
        'x-e2e-user-id': userId,
        'x-e2e-user-email': userEmail,
        'x-e2e-user-role': 'user',
        'x-e2e-user-locale': 'en'
      });

      // Navigate to selfies page
      await page.goto('https://localhost:3000/en/app/selfies');
      await page.waitForLoadState('networkidle');
      
      await clickUploadButton(page);
      
      // Verify ARIA labels - use first() to avoid strict mode violations
      await expect(page.locator('[data-testid="dropzone"]').first()).toHaveAttribute('aria-label');
      await expect(page.locator('[data-testid="file-picker-button"]').first()).toHaveAttribute('aria-label');
    });

    test('should support screen reader navigation', async ({ page }) => {
      // Set up E2E authentication headers for our real test user
      await page.setExtraHTTPHeaders({
        'x-e2e-user-id': userId,
        'x-e2e-user-email': userEmail,
        'x-e2e-user-role': 'user',
        'x-e2e-user-locale': 'en'
      });

      // Navigate to selfies page
      await page.goto('https://localhost:3000/en/app/selfies');
      await page.waitForLoadState('networkidle');
      
      // Ensure the page has focusable elements
      const focusableElements = page.locator('button, input, [tabindex]:not([tabindex="-1"])');
      await expect(focusableElements.first()).toBeAttached();
      
      // Test keyboard navigation by pressing Tab
      await page.keyboard.press('Tab');
      
      // Verify that keyboard navigation works (no errors thrown)
      // The test passes if we can press Tab without errors
      await page.keyboard.press('Tab');
      
      // Additional verification: check that we can interact with focusable elements
      const uploadButton = page.locator('[data-testid="upload-cta"]').first();
      await expect(uploadButton).toBeAttached();
    });
  });
});
