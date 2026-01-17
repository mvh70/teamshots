#!/usr/bin/env python3
"""Test generate button state persists across navigation on mobile."""

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    # Mobile viewport
    page = browser.new_page(viewport={'width': 375, 'height': 667})

    # Clear session storage
    page.goto('https://localhost:3000/invite-dashboard/5ddc63c8ad8a54bd68ba94c79397240ffb437f907fe09c6e615aa29404530ccb')
    page.wait_for_load_state('networkidle')
    page.evaluate('sessionStorage.clear()')

    # Set both customization steps as visited
    page.evaluate('sessionStorage.setItem("visitedCustomizationSteps", "[0,1]")')
    print("Set visitedCustomizationSteps to [0,1]")

    # Navigate to customization page
    print("\n1. Navigating to customization page...")
    page.goto('https://localhost:3000/invite-dashboard/5ddc63c8ad8a54bd68ba94c79397240ffb437f907fe09c6e615aa29404530ccb/customization')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    # Check generate button state
    gen_btn = page.locator('button:has-text("Generate"), button:has-text("generate")').first
    if gen_btn.is_visible():
        classes = gen_btn.get_attribute('class') or ''
        is_disabled = 'bg-gray-300' in classes or 'cursor-not-allowed' in classes
        print(f"   Generate button disabled: {is_disabled}")

    page.screenshot(path='/tmp/mobile_cust_1.png', full_page=True)
    print("   Screenshot: /tmp/mobile_cust_1.png")

    # Navigate to selfies
    print("\n2. Navigating to selfies page...")
    page.goto('https://localhost:3000/invite-dashboard/5ddc63c8ad8a54bd68ba94c79397240ffb437f907fe09c6e615aa29404530ccb/selfies')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    visited = page.evaluate('sessionStorage.getItem("visitedCustomizationSteps")')
    print(f"   visitedCustomizationSteps: {visited}")

    # Navigate back to customization
    print("\n3. Navigating back to customization page...")
    page.goto('https://localhost:3000/invite-dashboard/5ddc63c8ad8a54bd68ba94c79397240ffb437f907fe09c6e615aa29404530ccb/customization')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    visited = page.evaluate('sessionStorage.getItem("visitedCustomizationSteps")')
    print(f"   visitedCustomizationSteps: {visited}")

    # Check generate button state again
    gen_btn = page.locator('button:has-text("Generate"), button:has-text("generate")').first
    if gen_btn.is_visible():
        classes = gen_btn.get_attribute('class') or ''
        is_disabled = 'bg-gray-300' in classes or 'cursor-not-allowed' in classes
        print(f"   Generate button disabled: {is_disabled}")

    page.screenshot(path='/tmp/mobile_cust_2.png', full_page=True)
    print("   Screenshot: /tmp/mobile_cust_2.png")

    # Check the green dots count
    green_dots = page.locator('.rounded-full.bg-green-500').all()
    print(f"   Green dots (visited): {len(green_dots)}")

    browser.close()
    print("\nTest complete!")
