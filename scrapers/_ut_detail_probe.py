#!/usr/bin/env python3
"""
Click a facility detail and capture all API calls including inspections.
Also reverse-engineer the full POST body options for facilities-search.
"""
import json, time
from playwright.sync_api import sync_playwright

api_calls = []

def handle_response(response):
    url = response.url
    if "cclapi.dlbc.utah.gov" not in url:
        return
    try:
        status = response.status
        ct = response.headers.get("content-type", "")
        body = response.text()
        if status == 200 and body.strip():
            try:
                parsed = json.loads(body)
            except Exception:
                parsed = body[:500]
            api_calls.append({"url": url, "status": status, "data": parsed})
            print(f"✓ {url.split('dlbc.utah.gov')[1]} → {str(parsed)[:200]}", flush=True)
        else:
            api_calls.append({"url": url, "status": status, "data": body[:200]})
            print(f"  {status} {url.split('dlbc.utah.gov')[1]}", flush=True)
    except Exception as e:
        print(f"  ERR {url}: {e}", flush=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
    page = ctx.new_page()
    ctx.on("response", handle_response)

    # Navigate to facilities search
    page.goto("https://provider.dlbc.utah.gov/ccl/facilities", wait_until="networkidle", timeout=25_000)
    page.wait_for_timeout(2000)

    # First search with Assisted Living Type II to find memory care facilities
    # Fill in the facility name first
    name_input = page.query_selector("input#facilityName")
    if name_input:
        name_input.fill("Abbington Manor")

    btn = page.query_selector("button:has-text('Search')")
    if btn:
        btn.click()
        page.wait_for_timeout(5000)

    # Look for clickable elements on first result
    print("\n=== Page after search ===")
    print(page.inner_text("body")[:800])

    # Try clicking the first "Capacity" link or any clickable row
    clickables = page.query_selector_all("button, [onclick], tr[class*='cursor'], tr.clickable")
    print(f"\nClickable elements: {len(clickables)}")
    for c in clickables[:5]:
        print(f"  {c.evaluate('el => el.tagName')} text={c.inner_text()[:60].strip()!r}")

    # Try clicking on the row text itself
    row = page.query_selector("tr:has-text('Abbington')")
    if row:
        print("\nClicking Abbington row...", flush=True)
        row.click()
        page.wait_for_timeout(4000)
        print(f"After click URL: {page.url}")
        print(page.inner_text("body")[:500])
    else:
        # Try the Details column or button in any row
        detail_btn = page.query_selector("button:has-text('Capacity'), td:last-child button, a[href*='detail'], td button")
        if detail_btn:
            print(f"\nClicking detail button: {detail_btn.inner_text()[:40]}", flush=True)
            detail_btn.click()
            page.wait_for_timeout(4000)
        else:
            print("\nNo detail button found — trying all rows...", flush=True)
            rows = page.query_selector_all("tbody tr")
            print(f"  {len(rows)} data rows")
            if rows:
                rows[0].click()
                page.wait_for_timeout(4000)
                print(f"  Clicked first row. URL: {page.url}")
                print(page.inner_text("body")[:400])

    # Also try navigating directly to a facility by ID
    print("\n=== Trying direct facility endpoints ===", flush=True)
    # ID 66446 is "180 Fitness - Richfield" from earlier probe
    for endpoint in [
        "/ccl/facilities/66446",
        "/ccl/facility/66446",
        "/ccl/facilities/66446/inspections",
        "/ccl/facilities/66446/compliance",
    ]:
        page.goto(f"https://provider.dlbc.utah.gov{endpoint}", wait_until="domcontentloaded", timeout=10_000)
        page.wait_for_timeout(2000)
        print(f"  {page.url} — {page.title()[:50]}")
        if "facility" in page.url.lower() and page.url != "https://provider.dlbc.utah.gov/":
            print(page.inner_text("body")[:300])

    browser.close()

print("\n\n=== All API Calls ===")
for c in api_calls:
    url_short = c["url"].replace("https://cclapi.dlbc.utah.gov/api/public/", "/public/")
    print(f"\n  {c['status']} {url_short}")
    if isinstance(c["data"], (list, dict)):
        print(f"  {json.dumps(c['data'], default=str)[:400]}")
