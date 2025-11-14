import { test, expect, clickUploadButton, testData } from './config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

test.describe('Selfie Flow - Complete Tests', () => {
  let prisma: PrismaClient;
  const baseUserId = 'selfie-test-user-id';
  const baseUserEmail = 'selfietest@example.com';
  const plainPassword = 'TestPassword123!';

  // Helper function to create unique test user
  async function createTestUser(testName: string) {
    const testId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userId = `${baseUserId}-${testName}-${testId}`;
    const userEmail = `${baseUserEmail.split('@')[0]}-${testName}-${testId}@${baseUserEmail.split('@')[1]}`;
    
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

    await prisma.person.create({
      data: {
        firstName: 'Selfie',
        lastName: 'Test',
        email: userEmail,
        userId: userId
      }
    });

    // Verify the Person record was created
    const person = await prisma.person.findFirst({
      where: { userId: userId }
    });
    console.log(`✅ Created Person record: ${person ? 'SUCCESS' : 'FAILED'}`);

    // Verify the User record was created
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    console.log(`✅ Created User record: ${user ? 'SUCCESS' : 'FAILED'}`);
    console.log(`📧 User email: ${userEmail}`);
    console.log(`🔑 User ID: ${userId}`);
    
    // Test password verification
    const isPasswordValid = await bcrypt.compare(plainPassword, user?.password || '');
    console.log(`🔐 Password verification: ${isPasswordValid ? 'VALID' : 'INVALID'}`);
    
    // Check what DATABASE_URL the test is using
    console.log(`🗄️ Test DATABASE_URL: ${process.env.DATABASE_URL}`);
    
    // Try to find the user using the same prisma instance that auth would use
    const authUser = await prisma.user.findUnique({
      where: { email: userEmail }
    });
    console.log(`🔍 Auth system can find user: ${authUser ? 'YES' : 'NO'}`);
    
    // Show all users in the test database
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true, role: true }
    });
    console.log(`👥 All users in test database:`, allUsers);
    
    // Show which user we're trying to sign in with
    console.log(`🔐 Trying to sign in with:`, { email: userEmail, password: 'TestPassword123!' });

    return { userId, userEmail, plainPassword };
  }

  test.beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/teamshots_test?schema=public'
        }
      }
    });
    console.log(`✅ Prisma client connected for selfie flow tests`);
  });

  test.afterAll(async () => {
    // Clean up any remaining test users
    await prisma.person.deleteMany({ where: { userId: { startsWith: baseUserId } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: baseUserId } } });
    console.log(`✅ Cleaned up all test users`);
    await prisma.$disconnect();
  });

  test('Complete selfie upload flow with real database', async ({ page }) => {
    // Create unique user for this test
    const { userId, userEmail, plainPassword } = await createTestUser('complete-flow');

    // Step 1: Navigate to login page and actually log in
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    
    // Fill in login form
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    
    // Submit login form
    await page.click('button[type="submit"]');
    
    // Wait a moment for the login to process
    await page.waitForTimeout(3000);
    
    // Check if there's an error message
    const errorElement = page.locator('.text-red-600');
    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent();
      console.log(`❌ Login error: ${errorText}`);
    }
    
    // Check current URL to see where we are
    const currentUrl = page.url();
    console.log(`🌐 Current URL after login: ${currentUrl}`);
    
    // Check if we're still on the login page
    const isStillOnLoginPage = currentUrl.includes('/auth/signin');
    console.log(`🔐 Still on login page: ${isStillOnLoginPage}`);
    
    // Wait for redirect to dashboard page
    await page.waitForURL('**/app/dashboard', { timeout: 5000 });
    await page.waitForLoadState('networkidle');
    
    // Navigate to selfies page
    await page.goto('https://localhost:3000/app/selfies');
    await page.waitForLoadState('networkidle');
    
    // Validate selfies page loaded correctly
    await expect(page.locator('[data-testid="selfies-title"]')).toContainText('Selfies');
    await expect(page.locator('button:has-text("Take or Upload Selfie")').first()).toBeVisible();

    // Step 2: Test empty state display (initial state)
    console.log('📭 Step 2: Testing empty state display...');
    
    // Check for two "Take or Upload Selfie" buttons
    const uploadButtons = page.locator('button:has-text("Take or Upload Selfie")');
    await expect(uploadButtons).toHaveCount(2);
    console.log('✅ Found 2 "Take or Upload Selfie" buttons');
    
    // Check for "No selfies yet" message
    await expect(page.locator('[data-testid="empty-title"]')).toContainText('No selfies yet');
    console.log('✅ Empty state displayed correctly - "No selfies yet" message found');
    
    // Verify no selfie cards are present
    const initialSelfieCards = page.locator('[data-testid="selfie-card"]');
    const initialSelfieCount = await initialSelfieCards.count();
    console.log('📸 Initial selfie cards count:', initialSelfieCount);
    expect(initialSelfieCount).toBe(0);
    console.log('✅ No selfie cards found in empty state');
    
    // Step 3: Click the upload button
    console.log('🔍 Clicking upload button...');
    await page.click('button:has-text("Take or Upload Selfie")', { force: true });
    console.log('✅ Upload button clicked');
    
    // Validate upload flow modal appears
    await expect(page.locator('[data-testid="upload-flow"]')).toBeVisible();
    await expect(page.locator('h2:has-text("Upload a New Selfie")')).toBeVisible();
    
    // Verify the upload screen elements
    await expect(page.locator('text=Take a photo with your camera or upload an existing photo to get started.')).toBeVisible();
    await expect(page.locator('text=Drag & drop a photo here')).toBeVisible();
    await expect(page.locator('text=or click to choose a file')).toBeVisible();
    await expect(page.locator('button:has-text("Use Camera")')).toBeVisible();
    await expect(page.locator('button:has-text("Choose File")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();

    // Step 4: Verify file input is present
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();

    // Step 5: Test cancel functionality (cancel button in top right of upload modal)
    console.log('🔍 Testing cancel button...');
    await page.click('button:has-text("Cancel")');
    
    // Verify upload flow is closed and we're back to selfie overview
    await expect(page.locator('[data-testid="upload-flow"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="selfies-title"]')).toContainText('Selfies');
    await expect(page.locator('button:has-text("Take or Upload Selfie")')).toHaveCount(2);
    await expect(page.locator('[data-testid="empty-title"]')).toContainText('No selfies yet');
    console.log('✅ Cancel button test completed - back to selfie overview');

    // Step 5: Reopen upload flow for file upload test
    await clickUploadButton(page);
    await expect(page.locator('[data-testid="upload-flow"]')).toBeVisible();

    // Step 6: Upload a test file
    const testFilePath = 'tests/fixtures/valid-selfie.jpg';
    await fileInput.setInputFiles(testFilePath);

    // Step 7: Wait for approval screen to appear
    await page.waitForSelector('[data-testid="approval-screen"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="approval-screen"]')).toBeVisible();

    // Step 7a: Test retake functionality
    console.log('🔄 Testing retake functionality...');
    await page.click('button:has-text("Retake Photo")');
    
    // Verify we're back to upload flow
    await expect(page.locator('[data-testid="upload-flow"]')).toBeVisible();
    console.log('✅ Retake - returned to upload flow');
    
    // Upload the file again
    await fileInput.setInputFiles(testFilePath);
    await page.waitForSelector('[data-testid="approval-screen"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="approval-screen"]')).toBeVisible();
    console.log('✅ Retake - new file uploaded and approval screen shown');

    // Step 7b: Test cancel functionality
    console.log('❌ Testing cancel functionality...');
    await page.click('button:has-text("Cancel")');
    
    // Verify we're back to selfies page
    await page.waitForURL('**/app/selfies', { timeout: 5000 });
    await expect(page.locator('[data-testid="selfies-title"]')).toBeVisible();
    await expect(page.locator('button:has-text("Take or Upload Selfie")')).toHaveCount(2);
    await expect(page.locator('[data-testid="empty-title"]')).toContainText('No selfies yet');
    console.log('✅ Cancel - returned to selfies overview');

    // Step 7c: Upload again for final approval
    console.log('📤 Uploading file again for final approval...');
    await page.click('button:has-text("Take or Upload Selfie")');
    await expect(page.locator('[data-testid="upload-flow"]')).toBeVisible();
    await fileInput.setInputFiles(testFilePath);
    await page.waitForSelector('[data-testid="approval-screen"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="approval-screen"]')).toBeVisible();

    // Step 8: Click approve button to complete the upload
    await page.click('button:has-text("Approve & Save")');

    // Step 9: Wait for upload to complete and verify success
    // The success state is returning to the selfies page with the uploaded selfie visible
    await page.waitForURL('**/app/selfies', { timeout: 15000 });
    await expect(page.locator('h1:has-text("Selfies")')).toBeVisible();
    await expect(page.locator('button:has-text("Take or Upload Selfie")')).toBeVisible();
    
    // Verify the uploaded selfie appears in the list
    await expect(page.locator('img[alt="upload"]')).toBeVisible();
    await expect(page.locator('a:has-text("Generate")')).toBeVisible();

    // Step 8: Verify the selfie appears in the database
    const person = await prisma.person.findFirst({
      where: { 
        userId: userId
      }
    });

    expect(person).not.toBeNull();
    
    const selfie = await prisma.selfie.findFirst({
      where: { 
        personId: person?.id
      }
    });

    expect(selfie).not.toBeNull();
    expect(selfie?.personId).toBe(person?.id);
    console.log(`✅ Selfie confirmed in database with ID: ${selfie?.id}`);

    // Step 9: Test delete functionality
    console.log('🗑️ Testing delete functionality...');
    
    // Set up dialog handler before clicking delete
    let dialogCount = 0;
    page.on('dialog', dialog => {
      dialogCount++;
      console.log(`Dialog ${dialogCount} appeared:`, dialog.message());
      dialog.accept(); // Confirm the deletion
    });

    // Click the delete button on the selfie
    await page.click('button:has-text("Delete")');

    // Wait for the delete to process
    await page.waitForTimeout(3000);

    // Verify that the delete button was clicked and dialogs appeared
    expect(dialogCount).toBeGreaterThan(0);
    console.log('✅ Delete dialog confirmed');

    // Verify the selfie disappeared from the UI
    await expect(page.locator('img[alt="upload"]')).not.toBeVisible();
    await expect(page.locator('a:has-text("Generate")')).not.toBeVisible();
    console.log('✅ Selfie removed from UI');

    // Verify the selfie was deleted from the database
    const deletedSelfie = await prisma.selfie.findFirst({
      where: { 
        personId: person?.id
      }
    });
    
    expect(deletedSelfie).toBeNull();
    console.log('✅ Selfie deleted from database');

    console.log('✅ Delete functionality test completed');

    // Step 10: Test drag and drop upload
    console.log('🖱️ Testing drag and drop upload...');
    
    // Navigate back to selfies page to test drag and drop
    await page.goto('https://localhost:3000/app/selfies');
    await page.waitForLoadState('networkidle');
    
    // Test drag and drop functionality
    await page.click('button:has-text("Take or Upload Selfie")');
    
    // Simulate drag and drop (we'll use file input as fallback since drag/drop is complex to simulate)
    await page.setInputFiles('input[type="file"]', testFilePath);
    await page.waitForSelector('[data-testid="approval-screen"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="approval-screen"]')).toBeVisible();  
    await page.click('button:has-text("Approve & Save")');
    await page.waitForURL('**/app/selfies', { timeout: 10000 });
    
    // Debug: Check how many selfies we have after drag & drop
    const selfieCardsAfterDrag = page.locator('[data-testid="selfie-card"]');
    const selfieCountAfterDrag = await selfieCardsAfterDrag.count();
    console.log('📸 Selfies after drag & drop:', selfieCountAfterDrag);
    
    // Check database state
    const dbSelfiesAfterDrag = await prisma.selfie.findMany({
      where: { person: { userId: userId } }
    });
    console.log('🗄️ Database selfies after drag & drop:', dbSelfiesAfterDrag.length);
    
    console.log('✅ Drag and drop upload test completed');

    // Step 11: Upload another selfie for additional testing
    console.log('📤 Uploading another selfie...');
    
    // Upload another selfie
    await page.click('button:has-text("Take or Upload Selfie")');
    await expect(page.locator('[data-testid="upload-flow"]')).toBeVisible();
    await page.setInputFiles('input[type="file"]', testFilePath);
    
    await page.click('button:has-text("Approve & Save")');
    await page.waitForURL('**/app/selfies', { timeout: 10000 });
    
    // Wait a bit for UI to update
    await page.waitForTimeout(2000);
    
    // Debug: Check how many selfies we have after second upload
    const selfieCardsAfterSecond = page.locator('[data-testid="selfie-card"]');
    const selfieCountAfterSecond = await selfieCardsAfterSecond.count();
    console.log('📸 Selfies after second upload:', selfieCountAfterSecond);
    
    // Check database state
    const dbSelfiesAfterSecond = await prisma.selfie.findMany({
      where: { person: { userId: userId } }
    });
    console.log('🗄️ Database selfies after second upload:', dbSelfiesAfterSecond.length);
    
    // Try refreshing the page to see if that helps
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const selfieCardsAfterRefresh = page.locator('[data-testid="selfie-card"]');
    const selfieCountAfterRefresh = await selfieCardsAfterRefresh.count();
    console.log('📸 Selfies after page refresh:', selfieCountAfterRefresh);

    // Step 12: Test deletion functionality
    console.log('🗑️ Testing deletion functionality...');
    
    // Delete all selfies to test deletion
    const deleteButtons = page.locator('button:has-text("Delete")');
    const deleteCount = await deleteButtons.count();

    console.log('🔍 Delete buttons count:', deleteCount);
    
    // Delete all selfies
    for (let i = 0; i < deleteCount; i++) {
      // Re-find delete buttons after each deletion
      const currentDeleteButtons = page.locator('button:has-text("Delete")');
      await currentDeleteButtons.first().click();
      await page.waitForTimeout(1000);
    }
    
    console.log('✅ Deletion functionality test completed');
    
    // Click upload button to open upload flow
    await page.click('button:has-text("Take or Upload Selfie")');
    await expect(page.locator('[data-testid="upload-flow"]')).toBeVisible();
    
    // Upload a new selfie
    await page.setInputFiles('input[type="file"]', testFilePath);
    
    // Wait for approval screen again
    await page.waitForSelector('[data-testid="approval-screen"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="approval-screen"]')).toBeVisible();

    // Step 17: Test quality guidelines display
    console.log('📋 Testing quality guidelines display...');
    
    // Verify quality guidelines are displayed
    await expect(page.locator('h3:has-text("Photo quality guidelines")')).toBeVisible();
    await expect(page.locator('text=Clear, well-lit face')).toBeVisible();
    await expect(page.locator('text=Looking at camera')).toBeVisible();
    await expect(page.locator('text=Good resolution')).toBeVisible();
    await expect(page.locator('text=Clean background')).toBeVisible();
    console.log('✅ Quality guidelines displayed correctly');

    await page.click('button:has-text("Approve & Save")');
    await page.waitForURL('**/app/selfies', { timeout: 10000 });

    // Step 19: Test mobile responsiveness
    console.log('📱 Testing mobile responsiveness...');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="selfies-title"]')).toBeVisible();
    await expect(page.locator('button:has-text("Take or Upload Selfie")').first()).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="selfies-title"]')).toBeVisible();
    await expect(page.locator('button:has-text("Take or Upload Selfie")').first()).toBeVisible();
    
    // Reset to desktop
    await page.setViewportSize({ width: 1200, height: 800 });
    console.log('✅ Mobile responsiveness test completed');

    // Step 19: Test accessibility features
    console.log('♿ Testing accessibility features...');
    
    // Check for ARIA labels
    const hasAriaLabels = await page.locator('[aria-label]').count() > 0;
    if (hasAriaLabels) {
      console.log('✅ ARIA labels found');
    } else {
      console.log('ℹ️ ARIA labels not found (may need implementation)');
    }
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    console.log('✅ Keyboard navigation test completed');

    // Step 20: Test "used" selfie functionality (after all other tests)
    console.log('🔗 Testing used selfie functionality...');
    
    // Get the selfie ID from the database
    const personRecord = await prisma.person.findFirst({
      where: { userId: userId }
    });
    
    const selfieRecord = await prisma.selfie.findFirst({
      where: { personId: personRecord?.id }
    });

    console.log('📸 Found selfie with ID:', selfieRecord?.id);

    // Create a generation record that uses this selfie
    const generation = await prisma.generation.create({
      data: {
        personId: personRecord!.id,
        selfieId: selfieRecord!.id,
        uploadedPhotoKey: selfieRecord!.key,
        status: 'completed',
        generatedPhotoKeys: ['generated1.jpg']
      }
    });

    console.log('🎨 Created generation record with ID:', generation.id);

    // Reload the page to see the "used" state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check that the selfie shows "Used in a generation" text
    await expect(page.locator('text=Used in a generation')).toBeVisible();
    
    // Check that the delete button is not visible for the used selfie
    const usedSelfie = page.locator('text=Used in a generation').locator('..').locator('..');
    await expect(usedSelfie.locator('button:has-text("Delete")')).not.toBeVisible();
    
    console.log('✅ Used selfie functionality test completed');

    // Step 21: Final verification and screenshot
    console.log('📸 Taking final screenshot...');
    await page.screenshot({ path: 'selfie-upload-complete-flow.png', fullPage: true });

    console.log('✅ Complete selfie upload flow with all features test successful');
  });

  

 

  

 

  test('Handle team context flow', async ({ teamContext }) => {
    // Set up E2E authentication headers for team context
    await teamContext.setExtraHTTPHeaders({
      'x-e2e-user-id': 'test-team-user-id',
      'x-e2e-user-email': 'admin@testteam.com',
      'x-e2e-user-role': 'team_admin',
      'x-e2e-user-locale': 'en'
    });

    // Set medium viewport for this test (tablet size to show selfies title)
    await teamContext.setViewportSize({ width: 1024, height: 768 });
    
    // Navigate to selfies page
    await teamContext.goto('https://localhost:3000/en/app/selfies');
    await teamContext.waitForLoadState('networkidle');
    
    // Wait for page to load and check for upload button instead of title
    await expect(teamContext.locator('[data-testid="upload-cta"]').first()).toBeVisible();
    
    // Upload selfie
    await clickUploadButton(teamContext);
    await teamContext.locator('[data-testid="desktop-file-input"]').setInputFiles(testData.files.validSelfie);
    await expect(teamContext.locator('[data-testid="approval-screen"]')).toBeVisible();
    
    // Approve selfie
    await teamContext.click('[data-testid="approve-button"]');
    
    // Verify we return to the selfies page (success)
    await expect(teamContext.locator('[data-testid="upload-cta"]').first()).toBeVisible();
  });

  

  

  

  test('Should validate file type restrictions', async ({ page }) => {
    // Create unique user for this test
    const { userEmail, plainPassword } = await createTestUser('file-validation');

    // Navigate to login page and log in
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.waitForURL('**/app/dashboard', { timeout: 5000 });
    await page.goto('https://localhost:3000/app/selfies');
    await page.waitForLoadState('networkidle');

    // Try to upload an invalid file
    await page.click('button:has-text("Take or Upload Selfie")');
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/invalid-file.txt');
    
    // Should show error message
    await expect(page.locator('text=Only image files are allowed')).toBeVisible();
  });

  test('Should handle face detection validation', async ({ page }) => {
    // Create unique user for this test
    const { userEmail, plainPassword } = await createTestUser('face-detection');

    // Navigate to login page and log in
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.waitForURL('**/app/dashboard', { timeout: 5000 });
    await page.goto('https://localhost:3000/app/selfies');
    await page.waitForLoadState('networkidle');

    // Try to upload a file with no face
    await page.click('button:has-text("Take or Upload Selfie")');
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/no-face.jpg');
    
    // Should show error message about face detection
    await expect(page.locator('text=No face detected in the image. Please upload a photo with a clear face.')).toBeVisible();
  });

  test('Should handle multiple faces detected', async ({ page }) => {
    // Create unique user for this test
    const { userEmail, plainPassword } = await createTestUser('multiple-faces');

    // Navigate to login page and log in
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.waitForURL('**/app/dashboard', { timeout: 5000 });
    await page.goto('https://localhost:3000/app/selfies');
    await page.waitForLoadState('networkidle');

    // Try to upload a file with multiple faces
    await page.click('button:has-text("Take or Upload Selfie")');
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/multiple-faces.jpg');
    
    // Should show error message about multiple faces
    await expect(page.locator('text=Multiple faces detected in the image. Please upload a photo with only one face.')).toBeVisible();
  });

  test('Should handle server errors during upload', async ({ page }) => {
    // Create unique user for this test
    const { userEmail, plainPassword } = await createTestUser('server-error');

    // Navigate to login page and log in
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.waitForURL('**/app/dashboard', { timeout: 5000 });
    await page.goto('https://localhost:3000/app/selfies');
    await page.waitForLoadState('networkidle');

    // Click upload button
    await page.click('button:has-text("Take or Upload Selfie")');
    
    // Wait for upload flow to be visible
    await expect(page.locator('[data-testid="upload-flow"]')).toBeVisible();
    
    // Upload a file
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/valid-selfie.jpg');
    
    // Wait for approval screen to appear
    await expect(page.locator('[data-testid="approval-screen"]')).toBeVisible({ timeout: 10000 });
    
    // Mock server error for the upload API (this will be called during approval)
    await page.route('/api/uploads/proxy', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    // Click approve to trigger the S3 upload (which will fail)
    await page.click('[data-testid="approve-button"]');
    
    // Wait for the error to appear in the main selfies page
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="error-message"]')).toContainText('error');
  });

  test('Should handle file size limit exceeded', async ({ page }) => {
    // Create unique user for this test
    const { userEmail, plainPassword } = await createTestUser('file-size-limit');

    // Navigate to login page and log in
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.waitForURL('**/app/dashboard', { timeout: 5000 });
    await page.goto('https://localhost:3000/app/selfies');
    await page.waitForLoadState('networkidle');

    // Click upload button
    await page.click('button:has-text("Take or Upload Selfie")');
    
    // Wait for upload flow to be visible
    await expect(page.locator('[data-testid="upload-flow"]')).toBeVisible();
    
    // Mock large file (30MB - larger than the 25MB limit)
    const largeFile = Buffer.alloc(30 * 1024 * 1024); // 30MB
    
    // Test file size validation
    await page.setInputFiles('input[type="file"]', {
      name: 'large-file.jpg',
      mimeType: 'image/jpeg',
      buffer: largeFile
    });
    
    // Wait for file size error to appear
    await expect(page.locator('[data-testid="file-size-error"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="file-size-error"]')).toContainText('File size too large');
  });

  test('Should handle network timeout during upload', async ({ page }) => {
    // Create unique user for this test
    const { userEmail, plainPassword } = await createTestUser('network-timeout');

    // Navigate to login page and log in
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.waitForURL('**/app/dashboard', { timeout: 5000 });
    await page.goto('https://localhost:3000/app/selfies');
    await page.waitForLoadState('networkidle');

    // Click upload button
    await page.click('button:has-text("Take or Upload Selfie")');
    
    // Wait for upload flow to be visible
    await expect(page.locator('[data-testid="upload-flow"]')).toBeVisible();
    
    // Upload a file
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/valid-selfie.jpg');
    
    // Wait for approval screen to appear
    await expect(page.locator('[data-testid="approval-screen"]')).toBeVisible({ timeout: 10000 });
    
    // Mock slow response for S3 upload (this will be called during approval)
    await page.route('/api/uploads/proxy', route => {
      // Simulate timeout by not responding
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ key: 'test-key' })
        });
      }, 30000); // 30 second delay
    });
    
    // Click approve to trigger the S3 upload (which will timeout)
    await page.click('[data-testid="approve-button"]');
    
    // Wait for timeout error to appear in the main selfies page
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="error-message"]')).toContainText('timeout');
  });

  test('Should handle browser storage limitations', async ({ page }) => {
    // Create unique user for this test
    const { userEmail, plainPassword } = await createTestUser('storage-limitations');

    // Navigate to login page and log in
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.waitForURL('**/app/dashboard', { timeout: 5000 });
    await page.goto('https://localhost:3000/app/selfies');
    await page.waitForLoadState('networkidle');

    // Click upload button
    await page.click('button:has-text("Take or Upload Selfie")');
    
    // Wait for upload flow to be visible
    await expect(page.locator('[data-testid="upload-flow"]')).toBeVisible();
    
    // Upload a file
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/valid-selfie.jpg');
    
    // Wait for approval screen to appear
    await expect(page.locator('[data-testid="approval-screen"]')).toBeVisible({ timeout: 10000 });
    
    // Mock API to return storage error (this will be called during approval)
    await page.route('/api/uploads/proxy', route => {
      route.fulfill({
        status: 507,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Storage quota exceeded. Please try again later.' })
      });
    });
    
    // Click approve to trigger the S3 upload (which will fail due to storage)
    await page.click('[data-testid="approve-button"]');
    
    // Wait for storage error to appear in the main selfies page
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Storage quota exceeded');
  });

  test('Should handle approval API errors', async ({ page }) => {
    // Create unique user for this test
    const { userEmail, plainPassword } = await createTestUser('approval-api-error');

    // Navigate to login page and log in
    await page.goto('https://localhost:3000/en/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.fill('input[id="email"]', userEmail);
    await page.fill('input[id="password"]', plainPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.waitForURL('**/app/dashboard', { timeout: 5000 });
    await page.goto('https://localhost:3000/app/selfies');
    await page.waitForLoadState('networkidle');

    // Mock database creation API error (now handled by promote endpoint)
    await page.route('/api/uploads/promote', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database creation failed' })
      });
    });
    
    // Also mock the upload API to ensure the flow works
    await page.route('/api/uploads/proxy', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ key: 'test-key', url: 'test-url' })
      });
    });
    
    // Click upload button
    await page.click('button:has-text("Take or Upload Selfie")');
    
    // Wait for upload flow to be visible
    await expect(page.locator('[data-testid="upload-flow"]')).toBeVisible();
    
    // Upload a file
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/valid-selfie.jpg');
    
    // Wait for approval screen to appear
    await expect(page.locator('[data-testid="approval-screen"]')).toBeVisible({ timeout: 10000 });
    
    // Click approve to trigger database creation (which will fail)
    await page.click('[data-testid="approve-button"]');
    
    // Wait for redirect back to main selfies page and error to appear
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="error-message"]')).toContainText('failed');
  });


});
