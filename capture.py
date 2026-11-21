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
      const strip = document.querySelector("#roadmap-strip");
      if (!strip) problems.push("missing roadmap strip");
      else {
        const sr = strip.getBoundingClientRect();
        if (sr.left < -1 || sr.right > 1281 || sr.top < 0 || sr.bottom > 800) problems.push("strip outside viewport");
        if (strip.scrollWidth > strip.clientWidth + 1) problems.push("strip overflows");
        const row = strip.querySelector(".strip-row");
        if (!row) problems.push("missing strip row");
        else if (row.scrollWidth > row.clientWidth + 1) problems.push("strip row overflows");
        const chips = [...strip.querySelectorAll(".stage-chip")];
        if (chips.length !== 6) problems.push("stage chips " + chips.length);
        const names = ["Opening chapters", "Middle chapters", "Finale", "Free roam", "Collectibles", "Cleanup"];
        let earned = 0;
        let total = 0;
        const tops = [];
        chips.forEach((chip, i) => {
          const box = chip.getBoundingClientRect();
          tops.push(Math.round(box.top));
          if (box.width < 20 || box.height < 16 || box.bottom > 800 || box.right > 1280) problems.push("chip not fully visible " + chip.textContent);
          if (chip.scrollWidth > chip.clientWidth + 1) problems.push("chip text clipped " + chip.textContent);
          const name = chip.querySelector(".stage-name");
          const count = chip.querySelector(".stage-count");
          const num = chip.querySelector(".stage-num");
          if (!name || name.textContent !== names[i]) problems.push("chip name " + (name && name.textContent));
          if (!num || num.textContent !== String(i + 1)) problems.push("chip number");
          if (name && name.scrollWidth > name.clientWidth + 1) problems.push("name clipped " + name.textContent);
          const parts = count ? count.textContent.split("/") : [];
          if (parts.length !== 2 || parts.some((part) => part === "" || Number.isNaN(Number(part)))) problems.push("bad earned/total");
          else {
            earned += Number(parts[0]);
            total += Number(parts[1]);
          }
        });
        if (tops.length && new Set(tops).size !== 1) problems.push("stage chips wrap");
        if (earned !== 14 || total !== 55) problems.push("strip totals " + earned + "/" + total);
        const current = chips.find((chip) => {
          const parts = chip.querySelector(".stage-count").textContent.split("/");
          return Number(parts[0]) < Number(parts[1]);
        });
        if (!current || !current.classList.contains("is-current")) problems.push("current stage not highlighted");
        const watch = strip.querySelector(".miss-watch");
        if (!watch) problems.push("missing missable watch");
        else {
          const box = watch.getBoundingClientRect();
          if (box.width < 40 || box.right > 1281 || box.bottom > 800 || box.left < 0) problems.push("watch not visible");
          if (chips[0] && Math.abs(box.top - chips[0].getBoundingClientRect().top) > 2) problems.push("watch not on the chip row");
          if (watch.textContent !== "Missable watch: 1 possibly · 1 at risk") problems.push("watch text " + watch.textContent);
          if (watch.dataset.tab !== "missables") problems.push("watch tab target");
        }
        const nameSize = chips[0] ? parseFloat(getComputedStyle(chips[0]).fontSize) : 0;
        if (nameSize < 13) problems.push("strip font " + nameSize);
        const track = strip.querySelector(".strip-bar");
        const fill = track && track.querySelector("span");
        if (!track || !fill) problems.push("missing progress bar");
        else {
          const tb = track.getBoundingClientRect();
          const fb = fill.getBoundingClientRect();
          if (tb.width < sr.width - 24) problems.push("bar not across strip");
          if (tb.height < 2 || tb.height > 8) problems.push("bar not thin");
          if (fb.width < 8) problems.push("bar fill missing");
          if (chips[0] && tb.top < chips[0].getBoundingClientRect().bottom - 1) problems.push("bar overlaps chips");
        }
      }
      const stats = [...document.querySelectorAll("#audit .stat span")];
      stats.forEach((span) => {
        const textBox = span.getBoundingClientRect();
        const card = span.parentElement.getBoundingClientRect();
        if (textBox.right > card.right + 1) problems.push("audit label overflow " + span.textContent);
      });
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
        "Claims with 2+ sources",
        "Missable watch: 1 possibly · 1 at risk",
        "Opening chapters",
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
            page.click(".miss-watch")
            page.wait_for_selector("#missables:not([hidden]) .miss-card")
            opened = page.evaluate("""() => ({
              miss: document.getElementById("missables").hidden === false,
              tracker: document.getElementById("tracker").hidden === true,
              on: document.getElementById("tab-missables").classList.contains("on"),
            })""")
            if not (opened["miss"] and opened["tracker"] and opened["on"]):
                raise SystemExit("missable watch did not open Missables")
            page.click("#tab-tracker")
            page.wait_for_selector("#guide h2")
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
