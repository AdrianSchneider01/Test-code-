#!/usr/bin/env python3
"""
Check-CameraFeed.py
Join the MTR test meeting as a silent observer, screenshot the video gallery,
and report whether the camera feed is live.

Setup (run once):
    pip install playwright pillow
    playwright install chromium

Usage:
    python Check-CameraFeed.py
"""

import asyncio
import sys
import statistics
from pathlib import Path
from playwright.async_api import async_playwright
from PIL import Image, ImageStat

MEETING_URL  = "https://teams.microsoft.com/meet/497737059187682?p=NnqALr74DBIi2oFvDT"
GUEST_NAME   = "MTR-Observer"
OUTPUT_DIR   = Path(__file__).parent / "CameraCheckOutput"

def log(msg): print(f"[cam-check] {msg}", flush=True)

def analyse_feed(image_path: Path) -> tuple[bool, str]:
    """
    Check if any participant has a live camera feed.
    The observer joins with camera OFF (avatar), so any live video must be from the MTR.
    Detects colourful / high-variance pixels — avatar tiles are near-white/grey.
    """
    img   = Image.open(image_path).convert("RGB")
    pixels = list(img.get_flattened_data())
    total  = len(pixels)

    # Count pixels that are "interesting": not near-grey (R≈G≈B) and not near-white
    def is_interesting(r, g, b):
        brightness = (r + g + b) / 3
        if brightness > 230:          # near-white background
            return False
        diff = max(abs(r-g), abs(g-b), abs(r-b))
        return diff > 30              # colourful enough to be real video

    interesting = sum(1 for r, g, b in pixels if is_interesting(r, g, b))
    pct = 100 * interesting / total
    log(f"Interesting pixels: {interesting}/{total} ({pct:.1f}%)")

    if pct < 3:
        return False, f"No live camera feed detected ({pct:.1f}% interesting pixels)"
    return True, f"Live camera feed detected ({pct:.1f}% interesting pixels)"

async def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,   # visible so you can watch it join
            args=[
                "--no-sandbox",
                "--use-fake-ui-for-media-stream",
            ],
        )
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            permissions=["camera", "microphone"],
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = await ctx.new_page()

        # 1 — navigate
        log("Navigating to meeting...")
        await page.goto(MEETING_URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)
        await page.screenshot(path=str(OUTPUT_DIR / "01_landing.png"))

        # 2 — choose browser join
        for sel, label in [
            ("text=Continue on this browser", "Continue on this browser"),
            ("text=Join on the web instead",  "Join on the web instead"),
            ("a:has-text('Join')",             "Join link"),
        ]:
            btn = page.locator(sel).first
            try:
                if await btn.is_visible(timeout=4000):
                    log(f"Clicking: {label}")
                    await btn.click()
                    break
            except Exception:
                pass

        # Wait for the pre-join page to fully render
        log("Waiting for pre-join screen to load...")
        for ready_sel in [
            "input[placeholder*='name' i]",
            "[data-tid='prejoin-display-name-input']",
            "button:has-text('Join now')",
            "button:has-text('Ask to join')",
            "button:has-text('Join')",
        ]:
            try:
                await page.wait_for_selector(ready_sel, timeout=15000)
                log(f"Pre-join ready (found: {ready_sel})")
                break
            except Exception:
                pass
        await page.wait_for_timeout(1000)
        await page.screenshot(path=str(OUTPUT_DIR / "02_after_browser_choice.png"))

        # 3 — enter guest name
        for sel in [
            "[data-tid='prejoin-display-name-input']",
            "input[placeholder*='name' i]",
            "input[type='text']",
        ]:
            inp = page.locator(sel).first
            try:
                if await inp.is_visible(timeout=4000):
                    log(f"Typing guest name into {sel}")
                    await inp.fill(GUEST_NAME)
                    await page.wait_for_timeout(500)
                    break
            except Exception:
                pass

        # 4 — turn off our own camera (we don't need to send video)
        for sel in [
            "button[aria-label*='camera' i]",
            "[data-tid='toggle-av']",
        ]:
            btn = page.locator(sel).first
            try:
                if await btn.is_visible(timeout=2000):
                    aria = await btn.get_attribute("aria-label") or ""
                    # only click if camera is currently ON (we want it OFF)
                    if "off" not in aria.lower():
                        log(f"Turning our camera off: {sel}")
                        await btn.click()
                        await page.wait_for_timeout(500)
                    break
            except Exception:
                pass

        await page.screenshot(path=str(OUTPUT_DIR / "03_prejoin.png"))

        # 5 — join
        joined = False
        for sel in [
            "[data-tid='prejoin-join-button']",
            "button:has-text('Join now')",
            "button:has-text('Ask to join')",
            "button:has-text('Join')",
        ]:
            btn = page.locator(sel).first
            try:
                if await btn.is_visible(timeout=4000):
                    log(f"Joining via: {sel}")
                    await btn.click()
                    joined = True
                    await page.wait_for_timeout(2000)
                    break
            except Exception:
                pass

        if not joined:
            log("ERROR: could not find Join button — check 03_prejoin.png")
            await browser.close()
            return False

        await page.screenshot(path=str(OUTPUT_DIR / "04_joining.png"))

        # 6 — wait for call and MTR video tile to render
        log("Waiting 25s for call to connect and MTR video to appear...")
        await page.wait_for_timeout(25000)
        shot = OUTPUT_DIR / "05_in_call.png"
        await page.screenshot(path=str(shot))
        log(f"In-call screenshot saved: {shot}")

        # 7 — analyse
        live, reason = analyse_feed(shot)
        log(f"\n{'='*50}")
        log(f"RESULT: {'CAMERA LIVE ✓' if live else 'NO CAMERA FEED ✗'}")
        log(f"DETAIL: {reason}")
        log(f"SCREENSHOTS: {OUTPUT_DIR}")
        log(f"{'='*50}\n")

        # 8 — leave
        for sel in [
            "[data-tid='hangup-button']",
            "button[aria-label*='Leave' i]",
            "button:has-text('Leave')",
        ]:
            btn = page.locator(sel).first
            try:
                if await btn.is_visible(timeout=3000):
                    log("Leaving call")
                    await btn.click()
                    await page.wait_for_timeout(2000)
                    break
            except Exception:
                pass

        await browser.close()
        return live

if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)
