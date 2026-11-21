"""Render Plate Clerk and save the four guide screenshots."""

import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "screenshots"
URL = "http://127.0.0.1:8137/"
STATE = {
    "earned": [
        "Just Like Paradise",
        "Paradise Lost",
        "Vice City, Baby!",
        "Break the Bank",
        "Master of None",
        "Top Fun",
        "Baited My Tackle",
        "Hot Together",
        "Retail Therapy",
        "Gunslinger",
        "Don't Touch My Deck",
        "One Last Thing",
        "This Was No Boat Accident",
        "The Lone Rider",
    ],
    "counters": {"28": 7},
    "shield": True,
    "open": 28,
    "revealed": [],
}


def main():
    OUT.mkdir(exist_ok=True)
    errors = []
    outside = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            headless=True,
            args=["--no-sandbox"],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 800}, accept_downloads=True)
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("request", lambda req: outside.append(req.url) if "127.0.0.1:8137" not in req.url else None)
        page.goto(URL)
        page.evaluate("(state) => localStorage.setItem('plate-clerk-v1', JSON.stringify(state))", STATE)
        page.reload(wait_until="networkidle")
        page.wait_for_selector("#guide h2")
        page.wait_for_function("() => document.body.innerText.includes('Positive Mental Attitude')")
        shoot(page, "1-tracker.jpg")
        page.click("#tab-roadmap")
        page.wait_for_selector("#roadmap .stage")
        shoot(page, "2-roadmap.jpg")
        page.click("#tab-missables")
        page.wait_for_selector("#missables .window-card")
        shoot(page, "3-missables-spoilers.jpg")
        page.click("#tab-sources")
        page.wait_for_selector("#sources table")
        page.click("#export-progress")
        page.wait_for_selector("#toast:not([hidden])")
        shoot(page, "4-sources-export.jpg")
        check = page.evaluate(
            """async () => {
              const trophies = (await (await fetch('data/trophies.json')).json()).trophies;
              const mod = await import('./js/store.js');
              const bad = mod.importProgress('{', trophies);
              const good = mod.importProgress(JSON.stringify({
                earned: ['Vice Got a Price!'],
                counters: { '1': 3 },
                shield: false,
                open: 1,
                revealed: [],
              }), trophies);
              return { bad: bad.ok, good: good.ok, earned: good.ok ? good.state.earned.length : bad.error };
            }"""
        )
        browser.close()
    print("console_errors", len(errors))
    for item in errors:
        print("ERR", item)
    print("outside_requests", len(outside))
    for item in outside:
        print("OUT", item)
    print("import_check", json.dumps(check))
    for path in sorted(OUT.glob("*.jpg")):
        print(f"{path.name} {path.stat().st_size}")


def shoot(page, name):
    page.screenshot(path=str(OUT / name), type="jpeg", quality=80)


if __name__ == "__main__":
    main()
