#!/usr/bin/env python3
"""Find the source of the '1 Issue' badge by getting its HTML."""

from playwright.sync_api import sync_playwright
import json

BASE_URL = 'https://localhost:3000/invite-dashboard/5ddc63c8ad8a54bd68ba94c79397240ffb437f907fe09c6e615aa29404530ccb'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 375, 'height': 667})

    page.goto(f'{BASE_URL}/customization')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)

    # Find elements containing "Issue" and get their parent HTML
    html = page.evaluate('''
        () => {
            // Find all text nodes containing "Issue"
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            const results = [];
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes('Issue')) {
                    // Get the containing element
                    let parent = node.parentElement;
                    // Go up a few levels to get context
                    for (let i = 0; i < 3 && parent.parentElement; i++) {
                        parent = parent.parentElement;
                    }
                    results.push({
                        text: node.textContent.trim(),
                        parentHtml: parent.outerHTML
                    });
                }
            }
            return results;
        }
    ''')

    print("=== Elements containing 'Issue' ===\n")
    for i, item in enumerate(html):
        print(f"--- Result {i} ---")
        print(f"Text: {item.get('text')}")
        print(f"\nParent HTML:\n{item.get('parentHtml')[:1500]}")
        print("\n")

    browser.close()
