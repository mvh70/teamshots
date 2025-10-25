import { test, expect } from './config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('Complete Real Database Test', () => {
  let prisma: PrismaClient;
  const userId = 'complete-test-user-id';
  const userEmail = 'completetest@example.com';
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
        firstName: 'Complete',
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

  test('Create style with real database user and API calls', async ({ page }) => {
    // Step 1: Navigate to login page and perform real login
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    
    // Fill in login form with test user credentials
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    
    // Submit login form
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard/app
    await page.waitForURL('**/app/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    // Step 2: Navigate to the personal contexts page
    await page.goto('https://localhost:3000/en/app/contexts/personal');
    await page.waitForLoadState('networkidle');
    
    // Validate contexts page loaded correctly
    await expect(page.locator('h1')).toContainText('Personal Photo Styles');
    await expect(page.locator('button:has-text("Create Personal Style")')).toBeVisible();

    // Step 2: Click the "Create Personal Style" button
    await page.click('button:has-text("Create Personal Style")');
    await page.waitForURL('**/app/contexts/personal/create');
    await page.waitForLoadState('networkidle');
    
    // Validate create page loaded correctly
    await expect(page.locator('h1')).toContainText('Create Personal Photo Style');
    await expect(page.locator('input[placeholder="My Personal Style"]')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();

    // Step 2.5: Test cancel button functionality
    await page.click('button:has-text("Cancel")');
    await page.waitForURL('**/contexts/personal');
    await page.waitForLoadState('networkidle');
    
    // Validate we're back on contexts page
    await expect(page.locator('h1')).toContainText('Personal Photo Styles');
    console.log('✅ Cancel button test completed');
    
    // Step 2.6: Navigate back to create page for the main test
    await page.click('button:has-text("Create Personal Style")');
    await page.waitForURL('**/app/contexts/personal/create');
    await page.waitForLoadState('networkidle');
    
    // Validate create page loaded correctly again
    await expect(page.locator('h1')).toContainText('Create Personal Photo Style');
    await expect(page.locator('input[placeholder="My Personal Style"]')).toBeVisible();

    // Step 3: Fill out the style name
    const timestamp = Date.now();
    const styleName = `Real Database Style ${timestamp}`;
    await page.fill('input[placeholder="My Personal Style"]', styleName);

    // Step 4: Fill out the description
    await page.fill('textarea[placeholder="Additional instructions for this style..."]', 'This is a real database test style description');

    // Step 5: Smart approach - find all toggle buttons and click them to set to "User Choice"
    const toggleButtons = await page.locator('button:has-text("User Choice"), button:has-text("Predefined")').all();
    console.log(`Found ${toggleButtons.length} toggle buttons`);

    for (let i = 0; i < toggleButtons.length; i++) {
      const button = toggleButtons[i];
      const buttonText = await button.textContent();
      console.log(`Button ${i}: "${buttonText}"`);
      
      // Click the button to toggle it
      await button.click();
      await page.waitForTimeout(100); // Small delay to let the state update
      
      // Check what the button text is now
      const newButtonText = await button.textContent();
      console.log(`Button ${i} after click: "${newButtonText}"`);
    }

    // Step 6: Verify the Create Style button is enabled (should be enabled after filling form)
    const createButton = page.locator('button:has-text("Create Style")');
    const isEnabled = await createButton.isEnabled();
    console.log(`Create Style button enabled: ${isEnabled}`);
    
    // This should fail the test if the button is disabled when it should be enabled
    expect(isEnabled).toBe(true);

    // Step 7: Click Create Style button
    await createButton.click();

    // Step 8: Wait for navigation back to contexts page
    await page.waitForURL('**/app/contexts/personal', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Step 9: Verify we're back on the contexts page
    await expect(page.locator('h1')).toContainText('Personal Photo Styles');

    // Step 10: Check if our created style appears on the page
    const styleVisible = await page.locator(`text=${styleName}`).isVisible();
    console.log(`Created style "${styleName}" visible on contexts page: ${styleVisible}`);

    // Step 12: Verify the style was actually created in the database
    const createdContext = await prisma.context.findFirst({
      where: { 
        name: styleName,
        userId: userId
      }
    });

    expect(createdContext).not.toBeNull();
    expect(createdContext?.name).toBe(styleName);
    console.log(`✅ Style "${styleName}" confirmed in database with ID: ${createdContext?.id}`);

    // Step 13: Test delete functionality
    console.log('Testing delete functionality...');
    
    // Look for delete button - it's the second button in the actions container
    // The delete button is the TrashIcon button after the PencilIcon (edit) button
    const deleteButton = page.locator('div.flex.items-center.gap-2 button').nth(1);
    const deleteButtonExists = await deleteButton.isVisible();
    
    if (deleteButtonExists) {
      console.log('✅ Delete button found, testing deletion...');
      
      // Set up dialog handler for browser confirm dialog
      page.on('dialog', async dialog => {
        console.log('Browser dialog detected:', dialog.message());
        if (dialog.type() === 'confirm') {
          console.log('Accepting confirmation dialog...');
          await dialog.accept();
        }
      });
      
      // Click the delete button
      await deleteButton.click();
      
      // Wait for the dialog to be handled and deletion to complete
      await page.waitForTimeout(3000);
      
      // Debug: Check what's on the page after deletion attempt
      console.log('Checking page content after deletion attempt...');
      const pageContent = await page.textContent('body');
      console.log('Page contains style name:', pageContent?.includes(styleName));
      
      // Verify the style is no longer visible on the page
      const styleStillVisible = await page.locator(`text=${styleName}`).isVisible();
      console.log(`Style still visible: ${styleStillVisible}`);
      
      if (styleStillVisible) {
        console.log('⚠️ Style still visible - deletion may not have worked');
        // Don't fail the test yet, let's check the database
      } else {
        console.log(`✅ Style "${styleName}" no longer visible on page after deletion`);
      }
      
      // Verify the style was actually deleted from the database
      const deletedContext = await prisma.context.findFirst({
        where: { 
          name: styleName,
          userId: userId
        }
      });
      
      if (deletedContext) {
        console.log(`❌ Style "${styleName}" still exists in database - deletion failed`);
        console.log(`Database context ID: ${deletedContext.id}`);
        expect(deletedContext).toBeNull();
      } else {
        console.log(`✅ Style "${styleName}" confirmed deleted from database`);
      }
      
    } else {
      console.log('⚠️ Delete button not found - skipping deletion test');
    }

    console.log('✅ Complete real database test successful');
  });



  test('Test individual background and photo style options', async ({ page }) => {
    // Perform real login
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Navigate to create page
    await page.goto('https://localhost:3000/en/app/contexts/personal/create');
    await page.waitForLoadState('networkidle');
    
    // Validate create page loaded correctly
    await expect(page.locator('h1')).toContainText('Create Personal Photo Style');

    // Test background options
    await page.click('button:has-text("Office Environment")');
    await page.click('button:has-text("Neutral Background")');
    await page.click('button:has-text("Gradient Background")');

    // Verify background buttons are still visible after clicking
    await expect(page.locator('button:has-text("Office Environment")')).toBeVisible();
    await expect(page.locator('button:has-text("Neutral Background")')).toBeVisible();
    await expect(page.locator('button:has-text("Gradient Background")')).toBeVisible();

    // Test photo style options
    await page.click('button:has-text("Business")');
    await page.click('button:has-text("Startup")');
    await page.click('button:has-text("Black Tie")');

    // Verify photo style buttons are still visible after clicking
    await expect(page.locator('button:has-text("Business")')).toBeVisible();
    await expect(page.locator('button:has-text("Startup")')).toBeVisible();
    await expect(page.locator('button:has-text("Black Tie")')).toBeVisible();

    console.log('✅ Individual options test completed');
  });

  test('Test form validation with empty fields', async ({ page }) => {
    // Perform real login
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Navigate to create page
    await page.goto('https://localhost:3000/en/app/contexts/personal/create');
    await page.waitForLoadState('networkidle');
    
    // Validate create page loaded correctly
    await expect(page.locator('h1')).toContainText('Create Personal Photo Style');

    // Try to submit without filling required fields - button should be disabled
    const createButton = page.locator('button:has-text("Create Style")');
    const isEnabled = await createButton.isEnabled();
    
    // This should fail the test if the button is enabled when it should be disabled
    expect(isEnabled).toBe(false);
    console.log('✅ Form validation working - Create button disabled with empty fields');
  });

  test('Debug page structure and elements', async ({ page }) => {
    // Perform real login
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Navigate to create page
    await page.goto('https://localhost:3000/en/app/contexts/personal/create');
    await page.waitForLoadState('networkidle');
    
    // Validate create page loaded correctly
    await expect(page.locator('h1')).toContainText('Create Personal Photo Style');

    // Get all section headings
    const headings = await page.locator('h3').all();
    console.log('Found section headings:', headings.length);
    
    for (let i = 0; i < headings.length; i++) {
      const text = await headings[i].textContent();
      console.log(`Section ${i}: "${text}"`);
    }
    
    // Get all buttons and their states
    const buttons = await page.locator('button').all();
    console.log('Found buttons:', buttons.length);
    
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      const text = await buttons[i].textContent();
      const classes = await buttons[i].getAttribute('class');
      const enabled = await buttons[i].isEnabled();
      console.log(`Button ${i}: "${text}" - enabled: ${enabled} - classes: "${classes}"`);
    }

    console.log('✅ Debug information logged');
  });

  test('Contexts page basic functionality', async ({ page }) => {
    // Perform real login
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Navigate to the personal contexts page
    await page.goto('https://localhost:3000/en/app/contexts/personal');
    await page.waitForLoadState('networkidle');

    // Verify page title
    await expect(page.locator('h1')).toContainText('Personal Photo Styles');

    // Verify main elements are present
    await expect(page.locator('button:has-text("Create Personal Style")')).toBeVisible();
    await expect(page.locator('button:has-text("Create Personal Style")')).toBeEnabled();
    
    // Verify the description text
    await expect(page.locator('text=A photo style is a standard that you can apply over multiple photos to maintain consistency in your professional image.')).toBeVisible();
    
    // Note: "No Active Personal Style" warning only appears for team admins, not individual users
    console.log('✅ Contexts page basic functionality test completed');
  });

  test('Contexts page responsive design', async ({ page }) => {
    // Perform real login
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Navigate to the personal contexts page
    await page.goto('https://localhost:3000/en/app/contexts/personal');
    await page.waitForLoadState('networkidle');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('button:has-text("Create Personal Style")')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('button:has-text("Create Personal Style")')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('button:has-text("Create Personal Style")')).toBeVisible();

    console.log('✅ Contexts page responsive design test completed');
  });

});
