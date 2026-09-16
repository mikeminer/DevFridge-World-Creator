"""Create/configure DevFridge World Creator on Discord Developer Portal.

Opens a visible Chromium window. If Discord asks you to log in, do it there;
the script waits, then fills name, description, icon, cover, bot, and writes .env.
"""

from __future__ import annotations

import re
import sys
import time
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ICON = ROOT / "assets" / "discord" / "icon.png"
COVER = ROOT / "assets" / "discord" / "cover.png"
AVATAR = ROOT / "assets" / "discord" / "avatar.png"
ENV = ROOT / ".env"
EXAMPLE = ROOT / ".env.example"
PROFILE = ROOT / ".playwright-chrome"
APP_NAME = "DevFridge World Creator"
DESCRIPTION = (
    "Creator pipeline for next seasons of DevFridge World. "
    "Communities upload a meme, generate a 3D asset, pass review, and commit $PASTA "
    "to activate it for a defined period. A commitment is not an IP license."
)
TAGS = ["pasta", "world", "creator", "solana", "fridge"]
PORTAL = "https://discord.com/developers/applications"


def upsert_env(updates: dict[str, str]) -> None:
    if not ENV.exists() and EXAMPLE.exists():
        ENV.write_text(EXAMPLE.read_text(encoding="utf-8"), encoding="utf-8")
    text = ENV.read_text(encoding="utf-8") if ENV.exists() else ""
    lines = text.splitlines()
    keys_seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            if key in updates:
                out.append(f"{key}={updates[key]}")
                keys_seen.add(key)
                continue
        out.append(line)
    for key, value in updates.items():
        if key not in keys_seen:
            out.append(f"{key}={value}")
    ENV.write_text("\n".join(out) + "\n", encoding="utf-8")


def wait_logged_in(page, timeout_ms: int = 300_000) -> None:
    print("If Discord asks to log in, do it in the browser window...")
    page.goto(PORTAL, wait_until="domcontentloaded")
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
        url = page.url
        if "developers/applications" in url and "login" not in url:
            try:
                if page.get_by_role("button", name=re.compile("New Application", re.I)).count():
                    print("Logged in.")
                    return
                if page.get_by_text(re.compile("Applications", re.I)).count():
                    print("Logged in (applications page).")
                    return
            except Exception:
                pass
        page.wait_for_timeout(1000)
    raise SystemExit("Timed out waiting for Discord login.")


def click_first(page, names: list[str], timeout: int = 8000) -> bool:
    for name in names:
        loc = page.get_by_role("button", name=re.compile(name, re.I))
        try:
            if loc.count():
                loc.first.click(timeout=timeout)
                return True
        except PlaywrightTimeout:
            continue
    return False


def fill_general(page) -> None:
    print("Filling General Information...")
    # Name
    for label in ("Name", "App Name", "Application Name"):
        box = page.get_by_label(re.compile(label, re.I))
        if box.count():
            box.first.fill(APP_NAME)
            break
    # Description
    for sel in (
        page.get_by_label(re.compile("Description", re.I)),
        page.locator("textarea"),
    ):
        if sel.count():
            sel.first.fill(DESCRIPTION)
            break
    # Icon
    file_inputs = page.locator('input[type="file"]')
    n = file_inputs.count()
    print(f"file inputs: {n}")
    if n >= 1 and ICON.exists():
        file_inputs.nth(0).set_input_files(str(ICON))
        page.wait_for_timeout(800)
        click_first(page, ["Apply", "Save Image", "Crop", "Upload"])
    if n >= 2 and COVER.exists():
        file_inputs.nth(1).set_input_files(str(COVER))
        page.wait_for_timeout(800)
        click_first(page, ["Apply", "Save Image", "Crop", "Upload"])
    click_first(page, ["Save Changes", "Save"])
    page.wait_for_timeout(1500)


def read_ids(page) -> dict[str, str]:
    body = page.content()
    public_key = ""
    app_id = ""
    m = re.search(r"Public Key</.*?([0-9a-f]{64})", body, re.I | re.S)
    if m:
        public_key = m.group(1)
    m = re.search(r"Application ID</.*?([0-9]{17,20})", body, re.I | re.S)
    if m:
        app_id = m.group(1)
    if not app_id:
        m = re.search(r"/applications/(\d{17,20})", page.url)
        if m:
            app_id = m.group(1)
    # Copy buttons often sit next to the values
    for label, key in (("Application ID", "id"), ("Public Key", "pk")):
        loc = page.get_by_text(label, exact=False)
        if loc.count():
            nearby = loc.first.locator("xpath=following::*[self::div or self::span or self::code][1]")
            try:
                txt = nearby.inner_text(timeout=1000).strip()
                if key == "id" and re.fullmatch(r"\d{17,20}", txt):
                    app_id = txt
                if key == "pk" and re.fullmatch(r"[0-9a-f]{64}", txt, re.I):
                    public_key = txt
            except Exception:
                pass
    return {"id": app_id, "public_key": public_key}


def ensure_app(page) -> None:
    page.goto(PORTAL, wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    existing = page.get_by_text(APP_NAME, exact=False)
    if existing.count():
        print("App already exists — opening it.")
        existing.first.click()
        page.wait_for_timeout(2000)
        return
    print("Creating New Application...")
    if not click_first(page, ["New Application", "Create Application"]):
        raise SystemExit("Could not find New Application button.")
    page.wait_for_timeout(800)
    name_box = page.get_by_placeholder(re.compile("name", re.I))
    if not name_box.count():
        name_box = page.get_by_label(re.compile("name", re.I))
    name_box.first.fill(APP_NAME)
    # ToS checkbox if present
    boxes = page.locator('input[type="checkbox"]')
    if boxes.count():
        boxes.last.check()
    click_first(page, ["Create", "Create App"])
    page.wait_for_timeout(2500)


def setup_bot(page) -> str | None:
    print("Opening Bot tab...")
    bot_nav = page.get_by_role("link", name=re.compile("^Bot$", re.I))
    if not bot_nav.count():
        bot_nav = page.get_by_text("Bot", exact=True)
    bot_nav.first.click()
    page.wait_for_timeout(1500)
    click_first(page, ["Add Bot", "Reset Token", "Yes, do it"])
    page.wait_for_timeout(800)
    click_first(page, ["Yes", "Yes, do it!", "Reset"])
    page.wait_for_timeout(1000)
    # Username
    user_box = page.get_by_label(re.compile("Username", re.I))
    if user_box.count():
        user_box.first.fill("WorldCreator")
    files = page.locator('input[type="file"]')
    if files.count() and AVATAR.exists():
        files.first.set_input_files(str(AVATAR))
        page.wait_for_timeout(800)
        click_first(page, ["Apply", "Save Image", "Crop"])
    click_first(page, ["Save Changes", "Save"])
    token = None
    # Reset Token to reveal a copyable token
    if click_first(page, ["Reset Token", "Regenerate"]):
        page.wait_for_timeout(600)
        click_first(page, ["Yes", "Yes, do it!"])
        page.wait_for_timeout(1200)
    # Token is often in an input or a code block after reset
    for loc in (
        page.locator('input[type="text"]'),
        page.locator("code"),
        page.get_by_text(re.compile(r"[\w-]{24,}\.[\w-]{6}\.[\w-]{20,}")),
    ):
        try:
            if loc.count():
                txt = loc.first.input_value() if loc.first.evaluate("el => el.tagName") == "INPUT" else loc.first.inner_text()
                if txt and "." in txt and len(txt) > 40:
                    token = txt.strip()
                    break
        except Exception:
            continue
    return token


def main() -> None:
    if not ICON.exists() or not COVER.exists():
        raise SystemExit(f"Missing assets in {ICON.parent}")
    PROFILE.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE),
            headless=False,
            viewport={"width": 1400, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else context.new_page()
        wait_logged_in(page)
        ensure_app(page)
        fill_general(page)
        ids = read_ids(page)
        print("ids", {k: (v[:8] + "…") if v else "" for k, v in ids.items()})
        token = setup_bot(page)
        updates = {}
        if ids.get("id"):
            updates["DISCORD_APPLICATION_ID"] = ids["id"]
        if ids.get("public_key"):
            updates["DISCORD_PUBLIC_KEY"] = ids["public_key"]
        if token:
            updates["DISCORD_BOT_TOKEN"] = token
        if updates:
            upsert_env(updates)
            print("Wrote", ", ".join(updates.keys()), "to .env")
        else:
            print("Could not scrape credentials automatically — copy them in the dashboard.")
        page.screenshot(path=str(ROOT / "assets" / "discord" / "portal-last.png"), full_page=True)
        print("Done. Leave the window open if you still need to copy the token.")
        page.wait_for_timeout(8000)
        context.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("ERROR:", exc)
        sys.exit(1)
