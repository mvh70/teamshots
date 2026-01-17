#!/usr/bin/env python3
"""Mobile flow audit - navigate through entire invite dashboard flow and capture screenshots."""

from playwright.sync_api import sync_playwright
import time

BASE_URL = 'https://localhost:3000/invite-dashboard/5ddc63c8ad8a54bd68ba94c79397240ffb437f907fe09c6e615aa29404530ccb'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    # iPhone SE viewport
    page = browser.new_page(viewport={'width': 375, 'height': 667})

    screenshots = []

    # Step 1: Dashboard
    print("\n=== Step 1: Dashboard ===")
    page.goto(BASE_URL)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path='/tmp/audit_1_dashboard.png', full_page=True)
    screenshots.append('/tmp/audit_1_dashboard.png')
    print("Screenshot: /tmp/audit_1_dashboard.png")

    # Step 2: Selfie Tips
    print("\n=== Step 2: Selfie Tips ===")
    page.goto(f'{BASE_URL}/selfie-tips')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path='/tmp/audit_2_selfie_tips.png', full_page=True)
    screenshots.append('/tmp/audit_2_selfie_tips.png')
    print("Screenshot: /tmp/audit_2_selfie_tips.png")

    # Step 3: Selfies
    print("\n=== Step 3: Selfies ===")
    page.goto(f'{BASE_URL}/selfies')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path='/tmp/audit_3_selfies.png', full_page=True)
    screenshots.append('/tmp/audit_3_selfies.png')
    print("Screenshot: /tmp/audit_3_selfies.png")

    # Step 4: Customization Intro
    print("\n=== Step 4: Customization Intro ===")
    page.goto(f'{BASE_URL}/customization-intro')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path='/tmp/audit_4_customization_intro.png', full_page=True)
    screenshots.append('/tmp/audit_4_customization_intro.png')
    print("Screenshot: /tmp/audit_4_customization_intro.png")

    # Step 5: Customization - First view
    print("\n=== Step 5: Customization (Step 1 - Background/Style) ===")
    page.goto(f'{BASE_URL}/customization')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)
    page.screenshot(path='/tmp/audit_5_customization_step1.png', full_page=True)
    screenshots.append('/tmp/audit_5_customization_step1.png')
    print("Screenshot: /tmp/audit_5_customization_step1.png")

    # Try to navigate to step 2 via swipe
    print("\n=== Step 6: Customization (Step 2 - Pose) ===")
    # Swipe left
    page.mouse.move(300, 400)
    page.mouse.down()
    page.mouse.move(75, 400, steps=15)
    page.mouse.up()
    page.wait_for_timeout(1500)
    page.screenshot(path='/tmp/audit_6_customization_step2.png', full_page=True)
    screenshots.append('/tmp/audit_6_customization_step2.png')
    print("Screenshot: /tmp/audit_6_customization_step2.png")

    # Check for dot navigation and click second dot if available
    dots = page.locator('.rounded-full').all()
    print(f"Found {len(dots)} dot elements")

    # Check generate button state
    gen_btn = page.locator('button:has-text("Generate"), button:has-text("generate")').first
    if gen_btn.is_visible():
        classes = gen_btn.get_attribute('class') or ''
        is_disabled = 'bg-gray-300' in classes or 'cursor-not-allowed' in classes or gen_btn.is_disabled()
        print(f"Generate button visible, disabled: {is_disabled}")

    # Step 7: Generations page (results)
    print("\n=== Step 7: Generations (Results) ===")
    page.goto(f'{BASE_URL}/generations')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path='/tmp/audit_7_generations.png', full_page=True)
    screenshots.append('/tmp/audit_7_generations.png')
    print("Screenshot: /tmp/audit_7_generations.png")

    browser.close()

    print("\n\n=== All Screenshots ===")
    for s in screenshots:
        print(s)
    print("\nAudit complete!")
