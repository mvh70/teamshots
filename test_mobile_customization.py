#!/usr/bin/env python3
"""
Test script to investigate mobile customization display issue.
Compares invited user flow vs logged-in user flow.
"""
from playwright.sync_api import sync_playwright
import time

def test_customization_flows():
    with sync_playwright() as p:
        # Launch browser in mobile viewport to simulate mobile device
        browser = p.chromium.launch(headless=False)

        # iPhone 13 Pro viewport
        context = browser.new_context(
            viewport={'width': 390, 'height': 844},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
        )

        page = context.new_page()

        print("=" * 80)
        print("TESTING INVITED USER FLOW")
        print("=" * 80)

        # Test invited user flow
        invited_url = 'https://localhost:3000/invite-dashboard/b65ec4f4cb09cab719fd789c9648c38feb03830c2a3a233ea4c7c131d23a6131'
        print(f"\nNavigating to: {invited_url}")

        try:
            page.goto(invited_url, wait_until='networkidle', timeout=30000)
            time.sleep(2)  # Extra wait for any animations

            # Take screenshot
            page.screenshot(path='/tmp/invited_user_flow.png', full_page=True)
            print("✓ Screenshot saved: /tmp/invited_user_flow.png")

            # Check for mobile swipe container
            swipe_container = page.locator('[class*="SwipeableContainer"]').count()
            print(f"Swipeable containers found: {swipe_container}")

            # Check for mobile cards
            mobile_cards = page.locator('.rounded-2xl.border.border-gray-200').count()
            print(f"Mobile card elements found: {mobile_cards}")

            # Check for desktop grid
            desktop_grid = page.locator('[class*="CardGrid"]').count()
            print(f"Desktop grid elements found: {desktop_grid}")

            # Get the outer container classes for PhotoStyleSettings
            style_settings = page.locator('[class*="space-y-"]').first
            if style_settings.count() > 0:
                classes = style_settings.get_attribute('class')
                print(f"Style settings container classes: {classes}")

        except Exception as e:
            print(f"✗ Error testing invited user flow: {e}")

        print("\n" + "=" * 80)
        print("TESTING LOGGED-IN USER FLOW")
        print("=" * 80)

        # Test logged-in user flow
        logged_in_url = 'https://localhost:3000/app/generate/start?skipUpload=1'
        print(f"\nNavigating to: {logged_in_url}")

        try:
            page.goto(logged_in_url, wait_until='networkidle', timeout=30000)
            time.sleep(2)  # Extra wait for any animations

            # Take screenshot
            page.screenshot(path='/tmp/logged_in_user_flow.png', full_page=True)
            print("✓ Screenshot saved: /tmp/logged_in_user_flow.png")

            # Check for mobile swipe container
            swipe_container = page.locator('[class*="SwipeableContainer"]').count()
            print(f"Swipeable containers found: {swipe_container}")

            # Check for mobile cards
            mobile_cards = page.locator('.rounded-2xl.border.border-gray-200').count()
            print(f"Mobile card elements found: {mobile_cards}")

            # Check for desktop grid
            desktop_grid = page.locator('[class*="CardGrid"]').count()
            print(f"Desktop grid elements found: {desktop_grid}")

            # Get the outer container classes for PhotoStyleSettings
            style_settings = page.locator('[class*="space-y-"]').first
            if style_settings.count() > 0:
                classes = style_settings.get_attribute('class')
                print(f"Style settings container classes: {classes}")

            # Check specifically for clothing colors section
            print("\nChecking Clothing Colors section:")
            clothing_section = page.locator('#clothingColors-settings')
            if clothing_section.count() > 0:
                classes = clothing_section.get_attribute('class')
                print(f"Clothing Colors section classes: {classes}")
                # Check if it's in mobile or desktop layout
                is_in_swipe = page.locator('.flex.transition-transform').locator('#clothingColors-settings').count() > 0
                print(f"Is in swipe carousel: {is_in_swipe}")
            else:
                print("Clothing Colors section not found!")

        except Exception as e:
            print(f"✗ Error testing logged-in user flow: {e}")

        print("\n" + "=" * 80)
        print("COMPARISON COMPLETE")
        print("=" * 80)
        print("\nScreenshots saved to /tmp/")
        print("- /tmp/invited_user_flow.png")
        print("- /tmp/logged_in_user_flow.png")

        # Keep browser open for manual inspection
        input("\nPress Enter to close browser...")

        browser.close()

if __name__ == '__main__':
    test_customization_flows()
