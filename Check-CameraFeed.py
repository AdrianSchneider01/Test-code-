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
import ctypes
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
from playwright.async_api import async_playwright

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

async def check_live_video(page) -> tuple[bool, str]:
    """
    Inspect the DOM for active <video> elements with real dimensions.
    A playing remote camera stream has videoWidth > 0 and readyState >= 2.
    Pixel analysis was unreliable — Teams UI elements caused false positives.
    """
    try:
        result = await page.evaluate("""
            () => {
                const all = Array.from(document.querySelectorAll('video'));
                const active = all.filter(v =>
                    !v.paused &&
                    v.readyState >= 2 &&
                    v.videoWidth > 50 &&
                    v.videoHeight > 50
                );
                return {
                    total: all.length,
                    active: active.length,
                    widths: active.map(v => v.videoWidth + 'x' + v.videoHeight)
                };
            }
        """)
        total  = result.get('total', 0)
        active = result.get('active', 0)
        widths = result.get('widths', [])
        if active > 0:
            return True, f"Live video stream detected ({active} active stream(s): {widths})"
        return False, f"No live video stream (found {total} video elements, none playing with dimensions)"
    except Exception as e:
        return False, f"Video DOM check error: {e}"

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
        # Chrome may show a native "Open Microsoft Teams?" dialog.
        # page.keyboard.press only reaches the page context, not Chrome's
        # browser UI, so we use the Windows keybd_event API to send an
        # OS-level Escape that dismisses the dialog.
        await page.wait_for_timeout(3500)
        ctypes.windll.user32.keybd_event(0x1B, 0, 0, 0)       # VK_ESCAPE down
        time.sleep(0.05)
        ctypes.windll.user32.keybd_event(0x1B, 0, 0x0002, 0)   # VK_ESCAPE up
        log("Sent OS-level Escape to dismiss protocol dialog", run_dir)
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
        log("Pre-join screenshot saved", run_dir)

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

        # 4 — turn camera off before joining.
        # Dump all button aria-labels so we can see exactly what Teams renders.
        all_labels = await page.evaluate("""
            () => Array.from(document.querySelectorAll('button, [role="button"], [role="switch"]'))
                .map(el => ({
                    tag: el.tagName,
                    aria: el.getAttribute('aria-label') || '',
                    tid:  el.getAttribute('data-tid') || '',
                    role: el.getAttribute('role') || ''
                }))
                .filter(el => el.aria || el.tid)
        """)
        log(f"Pre-join buttons: {all_labels}", run_dir)

        cam_selectors = [
            "[data-tid='calling-prejoin-local-video-toggle']",
            "[data-tid='toggle-av']",
            "button[aria-label*='camera' i]",
            "button[aria-label*='video' i]",
            "[role='switch'][aria-label*='camera' i]",
            "[role='switch'][aria-label*='video' i]",
        ]
        for sel in cam_selectors:
            btn = page.locator(sel).first
            try:
                if await btn.is_visible(timeout=1500):
                    aria    = (await btn.get_attribute("aria-label") or "").lower()
                    pressed = (await btn.get_attribute("aria-pressed") or "").lower()
                    checked = (await btn.get_attribute("aria-checked") or "").lower()
                    log(f"Camera control found ({sel}) aria='{aria}' pressed='{pressed}' checked='{checked}'", run_dir)
                    # Camera is ON when the control is "pressed"/"checked" true,
                    # or when the label says "turn … off"
                    cam_is_on = (pressed == "true" or checked == "true" or
                                 any(p in aria for p in [
                                     "turn camera off", "turn off camera",
                                     "turn your camera off", "disable camera",
                                     "stop camera", "camera on", "video on",
                                 ]))
                    if cam_is_on:
                        log("Camera ON → turning off", run_dir)
                        await btn.click()
                        await page.wait_for_timeout(600)
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

        # 7 — analyse via DOM video element check (more reliable than pixel analysis)
        live, reason = await check_live_video(page)
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
