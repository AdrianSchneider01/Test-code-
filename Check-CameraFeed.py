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
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
from playwright.async_api import async_playwright
from PIL import Image

MEETING_URL = "https://teams.microsoft.com/meet/497737059187682?p=NnqALr74DBIi2oFvDT"
GUEST_NAME  = "MTR-Observer"
OUTPUT_ROOT = Path(__file__).parent / "CameraCheckOutput"
LOG_FILE    = OUTPUT_ROOT / "camera_log.txt"

def log(msg, run_dir=None):
    ts  = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(f"[cam-check] {msg}", flush=True)
    # append to master log
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")
    # also append to per-run log if we have a run dir
    if run_dir:
        with open(run_dir / "run_log.txt", "a", encoding="utf-8") as f:
            f.write(line + "\n")

def analyse_feed(image_path: Path) -> tuple[bool, str]:
    """
    Check if any participant has a live camera feed.
    The observer joins with camera OFF (avatar), so any live video must be from the MTR.
    Detects colourful / high-variance pixels — avatar tiles are near-white/grey.
    """
    img    = Image.open(image_path).convert("RGB")
    pixels = list(img.getdata())
    total  = len(pixels)

    def is_interesting(r, g, b):
        brightness = (r + g + b) / 3
        if brightness > 230:
            return False
        return max(abs(r-g), abs(g-b), abs(r-b)) > 30

    interesting = sum(1 for r, g, b in pixels if is_interesting(r, g, b))
    pct = 100 * interesting / total
    if pct < 3:
        return False, f"No live camera feed detected ({pct:.1f}% interesting pixels)"
    return True, f"Live camera feed detected ({pct:.1f}% interesting pixels)"

async def main():
    # timestamped folder for this run
    ts_label = datetime.now().strftime("%Y-%m-%d_%H-%M")
    run_dir  = OUTPUT_ROOT / ts_label
    run_dir.mkdir(parents=True, exist_ok=True)

    log(f"=== Run started: {ts_label} ===", run_dir)

    # Kill Teams desktop so it cannot intercept the msteams:// protocol call
    # and show its own "is calling you" popup that blocks the browser flow.
    for exe in ["ms-teams.exe", "Teams.exe"]:
        r = subprocess.run(["taskkill", "/F", "/IM", exe], capture_output=True)
        if r.returncode == 0:
            log(f"Closed Teams desktop ({exe})", run_dir)
    await asyncio.sleep(2)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=[
                "--no-sandbox",
                "--use-fake-ui-for-media-stream",
                "--disable-features=ExternalProtocolDialog",
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

        # Intercept Teams launcher.html so we never see the native
        # "Open Microsoft Teams?" OS dialog or "Continue on this browser" page.
        # Teams redirects the meeting URL through launcher.html?url=<target>;
        # we extract that target and redirect straight to it.
        async def bypass_launcher(route):
            req_url = route.request.url
            parsed  = urlparse(req_url)
            params  = parse_qs(parsed.query)
            target  = unquote(params.get("url", [""])[0])
            if target:
                if not target.startswith("http"):
                    target = f"https://teams.microsoft.com{target}"
                log("Launcher intercepted — going straight to web client", run_dir)
                await route.fulfill(status=302, headers={"Location": target})
            else:
                await route.continue_()

        await page.route("**/dl/launcher/**", bypass_launcher)

        # 1 — navigate
        log("Navigating to meeting...", run_dir)
        await page.goto(MEETING_URL, wait_until="domcontentloaded", timeout=30000)
        # Wait for Teams JS to run, then press Escape to dismiss the
        # "Open Microsoft Teams?" OS dialog if it appeared.
        await page.wait_for_timeout(4000)
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=str(run_dir / "01_landing.png"))

        # 2 — click "Continue on this browser" if the launcher gate is showing.
        #     Wait up to 12s so we don't race ahead before it appears.
        for sel, label in [
            ("text=Continue on this browser", "Continue on this browser"),
            ("text=Join on the web instead",  "Join on the web instead"),
        ]:
            btn = page.locator(sel).first
            try:
                if await btn.is_visible(timeout=12000):
                    log(f"Clicking: {label}", run_dir)
                    await btn.click()
                    await page.wait_for_timeout(3000)
                    break
            except Exception:
                pass

        # Wait for pre-join to render
        log("Waiting for pre-join screen...", run_dir)
        for ready_sel in [
            "input[placeholder*='name' i]",
            "[data-tid='prejoin-display-name-input']",
            "button:has-text('Join now')",
            "button:has-text('Ask to join')",
            "button:has-text('Join')",
        ]:
            try:
                await page.wait_for_selector(ready_sel, timeout=15000)
                log(f"Pre-join ready ({ready_sel})", run_dir)
                break
            except Exception:
                pass
        await page.wait_for_timeout(1000)
        await page.screenshot(path=str(run_dir / "02_prejoin.png"))

        # 3 — enter guest name
        for sel in [
            "[data-tid='prejoin-display-name-input']",
            "input[placeholder*='name' i]",
            "input[type='text']",
        ]:
            inp = page.locator(sel).first
            try:
                if await inp.is_visible(timeout=4000):
                    log(f"Typing name into {sel}", run_dir)
                    await inp.fill(GUEST_NAME)
                    await page.wait_for_timeout(500)
                    break
            except Exception:
                pass

        # 4 — turn camera off before joining
        # Log the actual aria-label so we can tune the match if needed.
        for sel in ["button[aria-label*='camera' i]", "[data-tid='toggle-av']"]:
            btn = page.locator(sel).first
            try:
                if await btn.is_visible(timeout=2000):
                    aria = (await btn.get_attribute("aria-label") or "").lower()
                    log(f"Camera button aria-label: '{aria}'", run_dir)
                    # Click if camera is currently ON (any phrasing Teams may use)
                    camera_on_phrases = [
                        "turn camera off", "turn off camera",
                        "disable camera", "stop camera",
                        "camera on", "video on",
                    ]
                    if any(p in aria for p in camera_on_phrases):
                        log("Camera ON → clicking to turn off", run_dir)
                        await btn.click()
                        await page.wait_for_timeout(500)
                    else:
                        log("Camera already off", run_dir)
                    break
            except Exception:
                pass

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
                    log(f"Joining via: {sel}", run_dir)
                    await btn.click()
                    joined = True
                    await page.wait_for_timeout(2000)
                    break
            except Exception:
                pass

        if not joined:
            log("ERROR: could not find Join button", run_dir)
            await browser.close()
            return False

        # 6 — wait for video to render
        log("Waiting 25s for MTR video...", run_dir)
        await page.wait_for_timeout(25000)
        shot = run_dir / "03_in_call.png"
        await page.screenshot(path=str(shot))
        log(f"In-call screenshot: {shot}", run_dir)

        # 7 — analyse
        live, reason = analyse_feed(shot)
        result_label = "CAMERA LIVE ✓" if live else "NO CAMERA FEED ✗"
        log("=" * 50, run_dir)
        log(f"RESULT: {result_label}", run_dir)
        log(f"DETAIL: {reason}", run_dir)
        log("=" * 50, run_dir)

        # 8 — leave
        for sel in [
            "[data-tid='hangup-button']",
            "button[aria-label*='Leave' i]",
            "button:has-text('Leave')",
        ]:
            btn = page.locator(sel).first
            try:
                if await btn.is_visible(timeout=3000):
                    log("Leaving call", run_dir)
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
