#!/usr/bin/env node
import { chromium } from '@playwright/test';

async function testMobileFlows() {
  console.log('========================================');
  console.log('MOBILE CUSTOMIZATION FLOW TEST');
  console.log('========================================\n');

  const browser = await chromium.launch({
    headless: false,
    devtools: true
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'log' || msg.type() === 'error') {
      console.log(`[Browser ${msg.type()}]:`, msg.text());
    }
  });

  console.log('\n--- INVITED USER FLOW ---');
  const invitedUrl = 'https://localhost:3000/invite-dashboard/b65ec4f4cb09cab719fd789c9648c38feb03830c2a3a233ea4c7c131d23a6131';

  try {
    await page.goto(invitedUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: '/tmp/invited-flow.png', fullPage: true });
    console.log('✓ Screenshot: /tmp/invited-flow.png');

    // Check what's visible
    const mobileSwipe = await page.locator('.flex.transition-transform').count();
    const desktopGrid = await page.locator('[class*="CardGrid"]').count();

    console.log(`Mobile swipe containers: ${mobileSwipe}`);
    console.log(`Desktop grids: ${desktopGrid}`);

    // Check viewport info from page
    const viewportInfo = await page.evaluate(() => {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 768
      };
    });
    console.log(`Viewport: ${viewportInfo.width}x${viewportInfo.height}, isMobile: ${viewportInfo.isMobile}`);

  } catch (error) {
    console.error('✗ Error:', error.message);
  }

  console.log('\n--- LOGGED-IN USER FLOW ---');
  const loggedInUrl = 'https://localhost:3000/app/generate/start?skipUpload=1';

  try {
    await page.goto(loggedInUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: '/tmp/logged-in-flow.png', fullPage: true });
    console.log('✓ Screenshot: /tmp/logged-in-flow.png');

    // Check what's visible
    const mobileSwipe = await page.locator('.flex.transition-transform').count();
    const desktopGrid = await page.locator('[class*="CardGrid"]').count();

    console.log(`Mobile swipe containers: ${mobileSwipe}`);
    console.log(`Desktop grids: ${desktopGrid}`);

    // Check viewport info
    const viewportInfo = await page.evaluate(() => {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 768
      };
    });
    console.log(`Viewport: ${viewportInfo.width}x${viewportInfo.height}, isMobile: ${viewportInfo.isMobile}`);

    // Check for clothing colors specifically
    const clothingSection = await page.locator('#clothingColors-settings').count();
    console.log(`Clothing colors sections found: ${clothingSection}`);

    if (clothingSection > 0) {
      // Check if it's in the swipe container or desktop grid
      const inSwipe = await page.locator('.flex.transition-transform #clothingColors-settings').count();
      const inGrid = await page.locator('[class*="CardGrid"] #clothingColors-settings').count();
      console.log(`  - In swipe carousel: ${inSwipe}`);
      console.log(`  - In desktop grid: ${inGrid}`);

      // Get the parent container classes
      const parentClasses = await page.evaluate(() => {
        const section = document.getElementById('clothingColors-settings');
        if (!section) return null;

        let parent = section.parentElement;
        const parents = [];

        while (parent && parents.length < 5) {
          parents.push({
            tag: parent.tagName,
            classes: parent.className
          });
          parent = parent.parentElement;
        }

        return parents;
      });

      console.log('\nParent hierarchy:');
      parentClasses?.forEach((p, i) => {
        console.log(`  ${i}: <${p.tag}> class="${p.classes}"`);
      });
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
  }

  console.log('\n========================================');
  console.log('TEST COMPLETE');
  console.log('Screenshots saved to /tmp/');
  console.log('========================================');

  // Keep browser open for inspection
  console.log('\nBrowser will stay open for manual inspection.');
  console.log('Press Ctrl+C to exit...');
  await new Promise(() => {}); // Keep alive
}

testMobileFlows().catch(console.error);
