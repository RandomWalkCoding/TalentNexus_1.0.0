from pathlib import Path
import os
from playwright.sync_api import sync_playwright

base_url = os.environ.get("WEB_BASE_URL", "http://127.0.0.1:5173")
output_dir = Path("output")
output_dir.mkdir(exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for name, width, height in (("desktop", 1440, 900), ("mobile", 390, 844)):
        page = browser.new_page(viewport={"width": width, "height": height})
        errors = []
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(base_url, wait_until="networkidle")
        body = page.locator("body").inner_text()
        if not body.strip():
            raise RuntimeError(f"{name}: empty page")
        if errors:
            raise RuntimeError(f"{name}: {' | '.join(errors)}")
        page.screenshot(path=str(output_dir / f"stage13-{name}.png"), full_page=True)
        print(f"{name}: title={page.title()}, body={body[:60].replace(chr(10), ' ')}")
        page.close()
    browser.close()
