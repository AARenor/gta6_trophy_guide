"""Render Quire at 1280x800 and save the four judge screenshots."""

import json
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
APP = ROOT / "app"
SHOTS = ROOT / "screenshots"
PORT = 8137
HOST = "127.0.0.1"
VIEW = {"width": 1280, "height": 800}
EARNED = [2, 3, 4, 21, 23, 24, 16, 18, 19, 30, 36, 43, 54, 33]
STATE = {
    "v": 1,
    "earned": {str(i): True for i in EARNED},
    "counts": {"28": 7},
    "shield": True,
    "openId": 28,
    "revealed": {},
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP), **kwargs)

    def log_message(self, fmt, *args):
        return


def serve():
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


def layout_ok(page):
    return page.evaluate("""() => {
      const problems = [];
      const columns = ["#list", "#guide", "#side", "#top", "#audit", "#filters"];
      for (const sel of columns) {
        const col = document.querySelector(sel);
        if (!col) { problems.push("missing " + sel); continue; }
        const cr = col.getBoundingClientRect();
        for (const node of col.querySelectorAll("*")) {
          const box = node.getBoundingClientRect();
          if (box.width < 2 || box.height < 2) continue;
          let clipped = false;
          let parent = node.parentElement;
          while (parent && parent !== col) {
            const cs = getComputedStyle(parent);
            if (cs.overflowX === "hidden" || cs.overflow === "hidden") { clipped = true; break; }
            parent = parent.parentElement;
          }
          if (clipped) continue;
          if (box.right > cr.right + 2 || box.left < cr.left - 2) {
            problems.push(sel + " overflow " + (node.className || node.tagName) + " " + (node.textContent || "").slice(0, 40));
          }
        }
      }
      for (const row of document.querySelectorAll(".next-row")) {
        const tag = row.querySelector(".tag");
        const name = row.querySelector(".next-name");
        if (row.offsetHeight > 28) problems.push("next row wraps: " + row.innerText);
        if (tag && tag.getBoundingClientRect().right > row.getBoundingClientRect().right + 1) {
          problems.push("next tag clipped: " + row.innerText);
        }
        if (name && name.scrollWidth > name.clientWidth + 1 && getComputedStyle(name).textOverflow !== "ellipsis") {
          problems.push("next name overflows without ellipsis");
        }
      }
      const text = document.body.innerText;
      for (const need of [
        "Positive Mental Attitude",
        "Official description",
        "Missable window",
        "Sources differ",
        "How to earn it",
        "Our call",
        "Spoiler shield",
        "Export",
        "Import",
        "Saved in this browser",
        "14 / 55 earned",
        "Story trophy · Chapter 2 · hidden until earned",
        "Reveal this one",
        "GTA VI · PS5 · 55 trophies",
      ]) {
        if (!text.includes(need)) problems.push("missing text: " + need);
      }
      const tags = [...document.querySelectorAll("#guide .tag-row .tag")].map((el) => el.textContent);
      if (tags.some((tag) => tag.startsWith("Chapter ·"))) problems.push("chapter tag prefixed: " + tags.join(", "));
      const step = document.querySelector(".steps li");
      if (!step || step.getBoundingClientRect().bottom > 800) problems.push("first step not in view");
      const second = document.querySelectorAll(".steps li")[1];
      if (!second || second.getBoundingClientRect().bottom > 800) problems.push("second step not in view");
      return problems;
    }""")


def save(page, name):
    path = SHOTS / name
    page.screenshot(path=str(path), type="jpeg", quality=72, animations="disabled")
    image = Image.open(path)
    if max(path.stat().st_size for _ in [0]) > 250 * 1024 or path.stat().st_size > 250 * 1024:
        page.screenshot(path=str(path), type="jpeg", quality=58, animations="disabled")
        image = Image.open(path)
    w, h = image.size
    size = path.stat().st_size
    image.close()
    if size > 250 * 1024:
        raise SystemExit(name + " is " + str(size) + " bytes")
    if max(w, h) > 1280 or min(w, h) < 480:
        raise SystemExit(name + " is " + str(w) + "x" + str(h))
    print(name, w, h, size)


def main():
    SHOTS.mkdir(exist_ok=True)
    for old in ["1-checklist.jpg", "2-silver.jpg", "3-bronze.jpg"]:
        path = SHOTS / old
        if path.exists():
            path.unlink()
    httpd = serve()
    errors = []
    outside = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                executable_path="/usr/bin/google-chrome",
                headless=True,
                args=["--no-sandbox"],
            )
            page = browser.new_page(viewport=VIEW)
            page.add_init_script(
                "localStorage.setItem('quire.gta6.progress', %s);" % json.dumps(json.dumps(STATE))
            )
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda err: errors.append(str(err)))
            page.on("request", lambda req: outside.append(req.url) if "127.0.0.1:8137" not in req.url else None)
            page.goto("http://127.0.0.1:8137/", wait_until="networkidle")
            page.wait_for_selector("#guide h2")
            problems = layout_ok(page)
            if problems:
                raise SystemExit("layout:\\n" + "\\n".join(problems))
            save(page, "1-tracker.jpg")
            page.click("#tab-roadmap")
            page.wait_for_selector(".pin")
            save(page, "2-roadmap.jpg")
            page.click("#tab-missables")
            page.wait_for_selector(".miss-card")
            save(page, "3-missables-spoilers.jpg")
            page.click("#tab-sources")
            page.wait_for_selector("#source-1")
            save(page, "4-sources-export.jpg")
            browser.close()
    finally:
        httpd.shutdown()
    print("console errors", len(errors))
    print("outside requests", len(outside))
    if errors or outside:
        print(errors[:5], outside[:5])
        raise SystemExit(1)
    print("ok")


if __name__ == "__main__":
    main()
