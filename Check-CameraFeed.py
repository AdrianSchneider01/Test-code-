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
    img  = Image.open(image_path).convert("RGB")
    stat = ImageStat.Stat(img)
    avg_stddev = statistics.mean(stat.stddev)
    log(f"Pixel stddev R={stat.stddev[0]:.1f} G={stat.stddev[1]:.1f} B={stat.stddev[2]:.1f} avg={avg_stddev:.1f}")
    if avg_stddev < 8:
        return False, f"Feed appears BLACK / no signal (stddev={avg_stddev:.1f})"
    return True, f"Feed appears LIVE (stddev={avg_stddev:.1f})"

async def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,   # visible so you can watch it join
            args=[
                "--no-sandbox",
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
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
                    await page.wait_for_timeout(3000)
                    break
            except Exception:
                pass
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
