#!/usr/bin/env python3
"""
Check-CameraFeed.py
Join the MTR test meeting as a silent observer, screenshot the video gallery,
and report whether the camera feed is live.

Setup (run once):
    pip install playwright pillow
    playwright install chromium

Usage:
    python Check-CameraFeed.py [room display name]

The room's meeting comes from %USERPROFILE%\\mtr-rooms.json (not in the repo):
    {"rooms": [{"room": "Boardroom Test Account", "joinMode": "Calendar",
                "meetingId": "...", "passcode": "...",
                "meetingUrl": "https://teams.microsoft.com/meet/<id>?p=<code>"}]}
With no room argument (or MTR_ROOM_NAME), the first room is used.
"""

import asyncio
import ctypes
import json
import os
import subprocess
import urllib.request
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
from playwright.async_api import async_playwright

ROOMS_CONFIG = Path(os.environ.get("USERPROFILE", "~")).expanduser() / "mtr-rooms.json"

def web_join_url(url: str) -> str:
    """Navigate directly to the Teams web client URL, bypassing the launcher.html
    page that triggers the "Open Microsoft Teams?" protocol handler dialog.
    https://teams.microsoft.com/meet/<id>?p=<code> -> .../_#/meet/<id>?p=<code>&anon=true
    Other link forms (meetup-join) go through the launcher interception below."""
    if "/meet/" in url and "/_#/" not in url:
        url = url.replace("teams.microsoft.com/meet/", "teams.microsoft.com/_#/meet/")
    if "/_#/meet/" in url and "anon=" not in url:
        url += ("&" if "?" in url else "?") + "anon=true"
    return url

def load_room():
    """Return (room_name, meeting_url).
    sys.argv[1] may be a URL (https://...) supplied by MTR-RunTestCall.ps1,
    a room display name to look up in mtr-rooms.json, or absent.
    Falls back: mtr-rooms.json first entry, then hardcoded constant URL."""
    _FALLBACK_URL = "https://teams.microsoft.com/_#/meet/497737059187682?p=NnqALr74DBIi2oFvDT&anon=true"
    arg = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("MTR_ROOM_NAME", "")).strip()
    if arg.startswith("https://"):
        return "MTR", web_join_url(arg)
    if ROOMS_CONFIG.exists():
        rooms = json.loads(ROOMS_CONFIG.read_text(encoding="utf-8-sig"))["rooms"]
        for r in rooms:
            if not arg or r["room"].lower() == arg.lower():
                return r["room"], web_join_url(r["meetingUrl"])
        if arg:
            raise SystemExit(f"Room '{arg}' not found in {ROOMS_CONFIG}")
    return "MTR", _FALLBACK_URL

# Only a live video on this participant's tile counts (other people's cameras don't)
ROOM_NAME, MEETING_URL = load_room()
GUEST_NAME  = "MTR-Observer"
# Picture thresholds (brightness 0-255): below these the room's video counts as no picture
BLACK_MEAN  = 16
FLAT_STD    = 6
# Central results endpoint: { "url": "...", "reportToken": "..." } (not in the repo)
ENDPOINT_CONFIG = Path(os.environ.get("USERPROFILE", "~")).expanduser() / "mtr-endpoint.json"
# Why the run ended, for the endpoint report
STATE = {"reason": "Observer did not finish"}

def report_result(live: bool, reason: str):
    """Send the camera result to the central endpoint, if configured."""
    if not ENDPOINT_CONFIG.exists():
        log(f"No {ENDPOINT_CONFIG} - not reporting to endpoint")
        return
    try:
        cfg  = json.loads(ENDPOINT_CONFIG.read_text(encoding="utf-8-sig"))
        body = json.dumps({
            "room": ROOM_NAME, "source": "observer",
            "status": "LIVE" if live else STATE.get("status", "NO_FEED"),
            "message": reason,
            "details": {"meetingUrl": MEETING_URL.split("?")[0], "guestName": GUEST_NAME},
        }).encode("utf-8")
        req = urllib.request.Request(
            cfg["url"].rstrip("/") + "/results", data=body, method="POST",
            # Cloudflare blocks Python's default "Python-urllib" user agent (HTTP 403)
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {cfg['reportToken']}",
                     "User-Agent": "mtr-observer/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            log(f"Reported to endpoint (HTTP {resp.status})")
    except Exception as e:
        log(f"Failed to report to endpoint: {e}")
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

async def check_live_video(page, room_name: str) -> tuple[bool, str]:
    """
    Inspect the DOM for active <video> elements with real dimensions.
    A playing remote camera stream has videoWidth > 0 and readyState >= 2.
    Pixel analysis was unreliable — Teams UI elements caused false positives.

    Each active video is matched to its participant tile: the nearest ancestor
    that contains only this one <video> and some text/aria-label. Only a live
    video whose tile names room_name counts, so another participant's camera
    can't produce a false LIVE.
    """
    try:
        result = await page.evaluate("""
            (roomName) => {
                const all = Array.from(document.querySelectorAll('video'));
                const active = all.filter(v =>
                    !v.paused &&
                    v.readyState >= 2 &&
                    v.videoWidth > 50 &&
                    v.videoHeight > 50
                );
                const tileLabel = (v) => {
                    let el = v.parentElement;
                    for (let i = 0; el && i < 15; i++, el = el.parentElement) {
                        if (el.querySelectorAll('video').length > 1) break;  // left this tile
                        const text = [el.getAttribute('aria-label') || '', el.innerText || '']
                            .join(' ').replace(/\\s+/g, ' ').trim();
                        if (text) return text;
                    }
                    return '';
                };
                // Picture content: a playing stream can still be black (lens covered,
                // camera fault). Sample a small frame: mean brightness + spread.
                const frameStats = (v) => {
                    try {
                        const w = 64, h = 36, c = document.createElement('canvas');
                        c.width = w; c.height = h;
                        const g = c.getContext('2d', { willReadFrequently: true });
                        g.drawImage(v, 0, 0, w, h);
                        const d = g.getImageData(0, 0, w, h).data;
                        let sum = 0, sq = 0, n = w * h;
                        for (let i = 0; i < d.length; i += 4) {
                            const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                            sum += y; sq += y * y;
                        }
                        const mean = sum / n;
                        return { mean: Math.round(mean), std: Math.round(Math.sqrt(Math.max(0, sq / n - mean * mean))) };
                    } catch (e) { return { error: String(e) }; }
                };
                const streams = active.map(v => {
                    const label = tileLabel(v);
                    return {
                        size: v.videoWidth + 'x' + v.videoHeight,
                        label: label.slice(0, 80),
                        isRoom: label.toLowerCase().includes(roomName.toLowerCase()),
                        frame: frameStats(v)
                    };
                });
                return { total: all.length, streams: streams };
            }
        """, room_name)
        total   = result.get('total', 0)
        streams = result.get('streams', [])
        desc    = [f"{s['size']} '{s['label']}'" for s in streams]
        room    = [s for s in streams if s['isRoom']]
        if room:
            f = room[0].get('frame') or {}
            if 'error' in f:
                return False, f"Video from '{room_name}' is playing but its picture could not be checked: {f['error']}"
            # Brightness 0-255. Near-black (mean < BLACK_MEAN) or one flat colour
            # (spread < FLAT_STD) = no usable picture.
            if f['mean'] < BLACK_MEAN or f['std'] < FLAT_STD:
                kind = "black" if f['mean'] < BLACK_MEAN else "a single flat colour"
                return False, (f"Video from '{room_name}' is {kind} (brightness {f['mean']}, variation {f['std']}): "
                               f"camera covered, off or faulty")
            return True, f"Live picture from '{room_name}' ({room[0]['size']}, brightness {f['mean']}, variation {f['std']})"
        if streams:
            return False, f"Live video found but none from '{room_name}': {desc}"
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
            permissions=["microphone"],  # no camera — observer only receives video, never sends it
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
        # Chrome's "Open Microsoft Teams?" dialog shows with Cancel focused (blue).
        # Escape alone highlights Cancel but doesn't click it — Enter activates it.
        await page.wait_for_timeout(3500)
        ctypes.windll.user32.keybd_event(0x1B, 0, 0, 0)        # VK_ESCAPE down
        time.sleep(0.05)
        ctypes.windll.user32.keybd_event(0x1B, 0, 0x0002, 0)   # VK_ESCAPE up
        time.sleep(0.15)
        ctypes.windll.user32.keybd_event(0x0D, 0, 0, 0)        # VK_RETURN down (clicks Cancel)
        time.sleep(0.05)
        ctypes.windll.user32.keybd_event(0x0D, 0, 0x0002, 0)   # VK_RETURN up
        log("Sent Escape+Enter to dismiss protocol dialog", run_dir)
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
            "[data-tid='prejoin-join-button']",
            "button:has-text('Join now')",
            "button:has-text('Ask to join')",
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
            "[data-tid='toggle-video']",                        # Teams v2 pre-join camera switch (INPUT role=switch)
            "[data-tid='calling-prejoin-local-video-toggle']",
            "[data-tid='toggle-av']",
            "button[aria-label*='camera' i]",
            "[role='switch'][aria-label*='camera' i]",
        ]
        # Determine camera state — check UI text indicators first
        try:
            cam_off_text = await page.locator("text=Your camera is turned off").is_visible(timeout=2000)
        except Exception:
            cam_off_text = False

        # Also check the toggle aria-label for "not available" (permission denied)
        cam_unavailable = False
        for sel in cam_selectors:
            btn = page.locator(sel).first
            try:
                if await btn.is_visible(timeout=1000):
                    aria = (await btn.get_attribute("aria-label") or "").lower()
                    if "not available" in aria or "unavailable" in aria:
                        cam_unavailable = True
                    log(f"Camera control found ({sel}) aria='{aria}'", run_dir)
                    break
            except Exception:
                pass

        if cam_off_text or cam_unavailable:
            log(f"Camera off/unavailable — not clicking toggle", run_dir)
        else:
            # Camera appears to be on — click the toggle to turn it off
            for sel in cam_selectors:
                btn = page.locator(sel).first
                try:
                    if await btn.is_visible(timeout=1500):
                        aria = (await btn.get_attribute("aria-label") or "").lower()
                        log(f"Camera ON ({sel}) aria='{aria}' — clicking to turn off", run_dir)
                        await btn.click()
                        await page.wait_for_timeout(800)
                        break
                except Exception:
                    pass

        # 5 — join
        joined = False
        for sel in [
            "[data-tid='prejoin-join-button']",
            "button:has-text('Join now')",
            "button:has-text('Ask to join')",
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
            STATE["reason"] = "Observer could not find the Join button on the pre-join screen"
            await browser.close()
            return False

        # 5b — wait if held in lobby
        in_lobby = False
        for lobby_sel in [
            "text=You're in the lobby",
            "text=Waiting for someone to let you in",
            # substring match: "...let you in soon/shortly/when the meeting starts"
            "text=Someone will let you in",
            "[data-tid='prejoin-waiting-for-host']",
        ]:
            try:
                if await page.locator(lobby_sel).is_visible(timeout=6000):
                    in_lobby = True
                    log(f"In lobby ({lobby_sel}) — waiting for MTR to admit...", run_dir)
                    break
            except Exception:
                pass

        if in_lobby:
            await page.screenshot(path=str(run_dir / "03_lobby.png"))
            admitted = False
            for i in range(24):  # poll every 5s, up to 2 min
                await page.wait_for_timeout(5000)
                # In-call: a "Leave" button shows and the lobby text is gone
                # (the old [data-tid='hangup-button'] no longer exists in Teams web)
                try:
                    leave_visible = await page.get_by_role("button", name="Leave").first.is_visible()
                    lobby_visible = await page.locator("text=Someone will let you in").first.is_visible()
                    if leave_visible or not lobby_visible:
                        admitted = True
                        log(f"Admitted from lobby after {(i+1)*5}s (leave={leave_visible}, lobby={lobby_visible})", run_dir)
                        break
                except Exception:
                    pass
                log(f"Still in lobby ({(i+1)*5}s)...", run_dir)
            if not admitted:
                log("ERROR: timed out waiting for lobby admission", run_dir)
                await page.screenshot(path=str(run_dir / "03_lobby_timeout.png"))
                STATE["reason"] = "Observer was not admitted from the lobby within 2 minutes"
                await browser.close()
                return False

        # 6 — wait for video to render
        log("Waiting 25s for MTR video...", run_dir)
        await page.wait_for_timeout(25000)
        shot = run_dir / "03_in_call.png"
        await page.screenshot(path=str(shot))
        log(f"In-call screenshot: {shot}", run_dir)

        # 7 — analyse via DOM video element check (more reliable than pixel analysis)
        live, reason = await check_live_video(page, ROOM_NAME)
        STATE["reason"] = reason
        if not live and "covered, off or faulty" in reason:
            STATE["status"] = "BLACK"
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
    try:
        result = asyncio.run(main())
    except Exception as e:
        result = False
        STATE["reason"] = f"Observer error: {e}"
    report_result(bool(result), STATE["reason"])
    sys.exit(0 if result else 1)
