from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(ignore_https_errors=True)
    page = context.new_page()

    # Navigate to the team page
    page.goto('https://localhost:3000/app/team')
    page.wait_for_load_state('networkidle')

    # Wait a bit for any animations to complete
    page.wait_for_timeout(2000)

    # Take full page screenshot
    page.screenshot(path='/tmp/team_page_full.png', full_page=True)
    print("Full page screenshot saved to /tmp/team_page_full.png")

    # Take screenshot of just the viewport (top area)
    page.screenshot(path='/tmp/team_page_top.png')
    print("Top viewport screenshot saved to /tmp/team_page_top.png")

    # Scroll to bottom to capture the invite buttons
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(500)
    page.screenshot(path='/tmp/team_page_bottom.png')
    print("Bottom screenshot saved to /tmp/team_page_bottom.png")

    browser.close()
