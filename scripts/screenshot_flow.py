#!/usr/bin/env python3
"""Take screenshots of the invite dashboard generation flow on laptop view."""

from playwright.sync_api import sync_playwright
import os

BASE_URL = "https://localhost:3000"
TOKEN = "5ddc63c8ad8a54bd68ba94c79397240ffb437f907fe09c6e615aa29404530ccb"
SCREENSHOT_DIR = "/tmp/flow_screenshots"

# Create screenshot directory
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def take_screenshot(page, name):
    """Take a full page screenshot."""
    path = f"{SCREENSHOT_DIR}/{name}.png"
    page.screenshot(path=path, full_page=True)
    print(f"Saved: {path}")
    return path

with sync_playwright() as p:
    # Launch browser with laptop viewport
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1280, "height": 800},
        ignore_https_errors=True  # For localhost with self-signed cert
    )
    page = context.new_page()

    # 1. Dashboard page
    print("\n1. Navigating to dashboard...")
    page.goto(f"{BASE_URL}/invite-dashboard/{TOKEN}")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)  # Extra time for animations
    take_screenshot(page, "01_dashboard")

    # 2. Selfie tips page
    print("\n2. Navigating to selfie tips...")
    page.goto(f"{BASE_URL}/invite-dashboard/{TOKEN}/selfie-tips")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    take_screenshot(page, "02_selfie_tips")

    # 3. Selfies page
    print("\n3. Navigating to selfies...")
    page.goto(f"{BASE_URL}/invite-dashboard/{TOKEN}/selfies")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    take_screenshot(page, "03_selfies")

    # 4. Customization intro page
    print("\n4. Navigating to customization intro...")
    page.goto(f"{BASE_URL}/invite-dashboard/{TOKEN}/customization-intro")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    take_screenshot(page, "04_customization_intro")

    # 5. Customization page
    print("\n5. Navigating to customization...")
    page.goto(f"{BASE_URL}/invite-dashboard/{TOKEN}/customization")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)  # More time for customization UI
    take_screenshot(page, "05_customization")

    # 6. Scroll down on customization to see more
    print("\n6. Scrolling customization page...")
    page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
    page.wait_for_timeout(500)
    take_screenshot(page, "06_customization_scrolled")

    # 7. Generations page
    print("\n7. Navigating to generations...")
    page.goto(f"{BASE_URL}/invite-dashboard/{TOKEN}/generations")
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    take_screenshot(page, "07_generations")

    browser.close()

print(f"\n✓ Screenshots saved to {SCREENSHOT_DIR}/")
print("Files:")
for f in sorted(os.listdir(SCREENSHOT_DIR)):
    print(f"  - {f}")
