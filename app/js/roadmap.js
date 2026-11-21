import { gradeLetter, primaryKind } from "./filters.js";
import { spoilerShield, concealedLabel, missableTag } from "./spoiler.js";

export const STAGE_LABELS = {
  1: "Opening chapters",
  2: "Middle chapters",
  3: "Finale",
  4: "Strands and jobs",
  5: "Collectible counts",
  6: "After the credits",
};

export function buildRoadmap(trophies) {
  const byStage = new Map();
  for (const trophy of trophies) {
    if (!byStage.has(trophy.stage)) byStage.set(trophy.stage, []);
    byStage.get(trophy.stage).push(trophy);
  }
  const stages = [...byStage.keys()].sort((a, b) => a - b).map((stage) => {
    const list = byStage.get(stage).slice().sort(byPath);
    const chapters = [];
    const missions = [];
    const hours = [];
    for (const trophy of list) {
      if (!chapters.includes(trophy.chapter)) chapters.push(trophy.chapter);
      for (const mission of trophy.missions || []) {
        if (!missions.includes(mission)) missions.push(mission);
      }
      if (typeof trophy.hours === "number") hours.push({ hours: trophy.hours, name: trophy.name });
    }
    return {
      stage,
      label: STAGE_LABELS[stage] || "Stage " + stage,
      chapters,
      missions,
      hours,
      trophies: list,
      pins: [],
    };
  });
  for (const trophy of trophies) {
    if (!trophy.missable || trophy.missable === "no") continue;
    const chapter = windowChapter(trophy);
    const host = stages.find((stage) => stage.chapters.includes(chapter)) || stages.find((stage) => stage.stage === trophy.stage);
    if (host) host.pins.push(trophy);
  }
  return { stages, order: stages.flatMap((stage) => stage.trophies) };
}

export function windowChapter(trophy) {
  if (/^Chapter \d+$/.test(trophy.chapter)) return trophy.chapter;
  const match = (trophy.window || "").match(/Chapter \d+/);
  return match ? match[0] : trophy.chapter;
}

export function renderRoadmap(root, roadmap, state) {
  root.replaceChildren();
  const head = document.createElement("header");
  head.className = "page-head";
  const title = document.createElement("h2");
  title.textContent = "Platinum path";
  const note = document.createElement("p");
  note.textContent = pathNote(roadmap);
  head.append(title, note);
  root.append(head);
  for (const stage of roadmap.stages) root.append(stageCard(stage, state));
}

export function renderNextUp(root, order, state, limit) {
  root.replaceChildren();
  const title = document.createElement("h2");
  title.textContent = "Next up on the roadmap";
  const note = document.createElement("p");
  note.className = "side-note";
  note.textContent = state.shield ? "Shield is on. Unearned story names stay hidden." : "Shield is off.";
  const list = document.createElement("ol");
  list.className = "next-list";
  const pending = order.filter((trophy) => !state.earned[trophy.id]).slice(0, limit);
  pending.forEach((trophy, index) => {
    const item = document.createElement("li");
    item.className = "next-row";
    item.dataset.id = String(trophy.id);
    const n = document.createElement("span");
    n.className = "next-n";
    n.textContent = String(index + 1);
    const badge = document.createElement("span");
    badge.className = "badge b-" + trophy.grade;
    badge.textContent = gradeLetter(trophy.grade);
    const name = document.createElement("span");
    name.className = "next-name";
    const concealed = spoilerShield(trophy, state);
    name.textContent = concealed ? concealedLabel(trophy) : trophy.name;
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = nextTag(trophy, concealed);
    item.append(n, badge, name, tag);
    list.append(item);
  });
  if (!pending.length) {
    const done = document.createElement("p");
    done.className = "side-note";
    done.textContent = "Every trophy on the path is earned.";
    root.append(title, note, done);
    return;
  }
  root.append(title, note, list);
}

function stageCard(stage, state) {
  const card = document.createElement("article");
  card.className = "stage-card";
  const header = document.createElement("header");
  header.className = "stage-head";
  const num = document.createElement("span");
  num.className = "stage-n";
  num.textContent = String(stage.stage);
  const text = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = stage.label;
  const meta = document.createElement("p");
  const earned = stage.trophies.filter((trophy) => state.earned[trophy.id]).length;
  meta.textContent = chapterSpan(stage.chapters) + " · " + earned + "/" + stage.trophies.length + " earned · " + hoursText(stage.hours);
  text.append(title, meta);
  header.append(num, text);
  card.append(header);
  if (stage.missions.length) {
    const missions = document.createElement("p");
    missions.className = "missions";
    const shown = stage.missions.slice(0, 4);
    const more = stage.missions.length - shown.length;
    missions.textContent = "Missions: " + shown.join(", ") + (more ? " · +" + more : "");
    card.append(missions);
  }
  for (const trophy of stage.pins) card.append(pin(trophy, state));
  const pills = document.createElement("div");
  pills.className = "pills";
  for (const trophy of stage.trophies) pills.append(pill(trophy, state));
  card.append(pills);
  return card;
}

function pin(trophy, state) {
  const box = document.createElement("div");
  box.className = "pin";
  const kicker = document.createElement("p");
  kicker.className = "pin-k";
  kicker.textContent = "Missable pin · " + trophy.missable + " · act before " + windowChapter(trophy);
  const row = document.createElement("div");
  row.className = "pin-row";
  row.append(earnBox(trophy, state));
  const badge = document.createElement("span");
  badge.className = "badge b-" + trophy.grade;
  badge.textContent = gradeLetter(trophy.grade);
  const name = document.createElement("span");
  name.className = "pin-name";
  name.textContent = spoilerShield(trophy, state) ? concealedLabel(trophy) : trophy.name;
  const flag = document.createElement("span");
  flag.className = trophy.missable === "at-risk" ? "tag tag-risk" : "tag tag-miss";
  flag.textContent = missableTag(trophy.missable);
  row.append(badge, name, flag);
  const window = document.createElement("p");
  window.className = "pin-window";
  window.textContent = trophy.window || "";
  box.append(kicker, row, window);
  return box;
}

function pill(trophy, state) {
  const label = document.createElement("label");
  label.className = "pill";
  label.append(earnBox(trophy, state));
  const badge = document.createElement("span");
  badge.className = "badge b-" + trophy.grade;
  badge.textContent = gradeLetter(trophy.grade);
  const name = document.createElement("span");
  name.className = "pill-name";
  name.textContent = spoilerShield(trophy, state) ? concealedLabel(trophy) : trophy.name;
  label.append(badge, name);
  return label;
}

function earnBox(trophy, state) {
  const box = document.createElement("input");
  box.type = "checkbox";
  box.dataset.earn = String(trophy.id);
  box.checked = !!state.earned[trophy.id];
  const visible = spoilerShield(trophy, state) ? concealedLabel(trophy) : trophy.name;
  box.setAttribute("aria-label", "Earned: " + visible);
  return box;
}

function pathNote(roadmap) {
  const stored = [];
  for (const stage of roadmap.stages) {
    for (const item of stage.hours) stored.push(item.hours + " h (" + item.name + ")");
  }
  const hours = stored.length ? "Hour figures stored in the file: " + stored.join(", ") + "." : "No hour figure is stored in the file.";
  return roadmap.stages.length + " stages from the stage field. Missable windows are pinned on the earliest stage that still contains their chapter. " + hours;
}

function hoursText(hours) {
  if (!hours.length) return "Hours not stored";
  const values = hours.map((item) => item.hours);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? min + " h" : min + "–" + max + " h";
}

function chapterSpan(chapters) {
  const nums = [];
  const extras = [];
  for (const chapter of chapters) {
    const match = /^Chapter (\d+)$/.exec(chapter);
    if (match) nums.push(Number(match[1]));
    else extras.push(chapter);
  }
  const unique = [...new Set(nums)].sort((a, b) => a - b);
  const contiguous = unique.every((n, i) => i === 0 || n === unique[i - 1] + 1);
  const parts = [];
  if (unique.length === 1) parts.push("Chapter " + unique[0]);
  else if (unique.length > 1 && contiguous) parts.push("Chapters " + unique[0] + "–" + unique[unique.length - 1]);
  else parts.push(...unique.map((n) => "Chapter " + n));
  parts.push(...extras);
  return parts.join(" · ");
}

function nextTag(trophy, concealed) {
  if (concealed) return "story";
  const flag = missableTag(trophy.missable);
  if (flag) return flag.toLowerCase();
  return primaryKind(trophy);
}

function byPath(a, b) {
  return chapterRank(a.chapter) - chapterRank(b.chapter) || a.id - b.id;
}

function chapterRank(chapter) {
  const match = /^Chapter (\d+)$/.exec(chapter || "");
  if (match) return Number(match[1]);
  if (chapter === "Any time") return 80;
  if (chapter === "Post-story") return 90;
  return 70;
}
