#!/usr/bin/env python3
"""Investigate the '1 Issue' badge on the customization page."""

from playwright.sync_api import sync_playwright

BASE_URL = 'https://localhost:3000/invite-dashboard/5ddc63c8ad8a54bd68ba94c79397240ffb437f907fe09c6e615aa29404530ccb'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 375, 'height': 667})

    page.goto(f'{BASE_URL}/customization')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)

    # Take full page screenshot
    page.screenshot(path='/tmp/issue_badge_full.png', full_page=True)
    print("Full page screenshot: /tmp/issue_badge_full.png")

    # Look for any element containing "Issue"
    issue_elements = page.locator('text=Issue').all()
    print(f"Found {len(issue_elements)} elements with 'Issue' text")
    for i, el in enumerate(issue_elements):
        try:
            text = el.inner_text()
            print(f"  Element {i}: '{text}'")
        except:
            pass

    # Look for any badge-like elements near the bottom
    bottom_elements = page.locator('.fixed.bottom-0, [class*="fixed"][class*="bottom"]').all()
    print(f"Found {len(bottom_elements)} fixed bottom elements")

    # Get the HTML of the bottom area
    bottom_html = page.evaluate('''
        () => {
            const fixed = document.querySelectorAll('[class*="fixed"]');
            return Array.from(fixed).map(el => el.outerHTML.substring(0, 500)).join('\\n---\\n');
        }
    ''')
    print("Fixed elements HTML (truncated):")
    print(bottom_html[:2000] if bottom_html else "None found")

    # Check for any onboarding/feedback widgets
    widgets = page.locator('[class*="onboard"], [class*="feedback"], [class*="widget"]').all()
    print(f"Found {len(widgets)} onboarding/feedback widgets")

    browser.close()
    print("\nInvestigation complete!")
