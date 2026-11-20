export const STORAGE_KEY = "bridge-log-gta6-v1";
export const OFFICIAL_TOTAL = 55;
export const GRADE_TOTALS = { platinum: 1, gold: 2, silver: 6, bronze: 46 };

const SOURCE_LABELS = {
  "https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/": "PowerPyx roadmap",
  "https://www.powerpyx.com/gta-6-100-completion-checklist-guide/": "PowerPyx 100% checklist",
  "https://outputlag.com/guides/gta-6-trophy-list/": "OutputLag trophy list",
  "https://outputlag.com/guides/gta-6-missables/": "OutputLag missables",
  "https://outputlag.com/guides/gta-6-endings/": "OutputLag endings",
  "https://mobalytics.gg/gamebase/guides/grand-theft-auto-6-all-trophies": "Mobalytics list"
};

export function loadSavedProgress(storage) {
  try {
    const raw = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object") return { earned: [], spoiler: true };
    return {
      earned: Array.isArray(raw.earned) ? raw.earned.filter((n) => typeof n === "string") : [],
      spoiler: raw.spoiler !== false
    };
  } catch {
    return { earned: [], spoiler: true };
  }
}

export function saveProgress(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify({
    app: "bridge-log",
    version: 1,
    earned: [...state.earned],
    spoiler: state.spoiler
  }));
}

export function exportProgress(state) {
  return JSON.stringify({
    app: "bridge-log",
    version: 1,
    earned: [...state.earned].sort(),
    spoiler: state.spoiler
  }, null, 2);
}

export function importProgress(text, names) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data && data.earned;
  if (!Array.isArray(list)) throw new Error("Need a list of trophy names.");
  const known = new Set(names);
  const earned = [];
  let skipped = 0;
  for (const item of list) {
    if (typeof item === "string" && known.has(item)) earned.push(item);
    else skipped += 1;
  }
  return { earned, skipped, spoiler: data && typeof data.spoiler === "boolean" ? data.spoiler : null };
}

export function spoilerShieldHides(trophy, state) {
  return state.spoiler && trophy.kind === "story" && !state.earned.has(trophy.name);
}

export function matchesKindFilter(trophy, kind) {
  if (kind === "all") return true;
  if (kind === "missable") return trophy.missable === true;
  if (kind === "risk") return trophy.risk === true;
  if (kind === "online") return trophy.kind === "online";
  return trophy.kind === kind;
}

export function matchesGradeFilter(trophy, grade) {
  return grade === "all" || trophy.grade === grade;
}

export function matchesSearch(trophy, query, hidden) {
  if (!query) return true;
  const hay = hidden ? "story trophy hidden" : `${trophy.name} ${trophy.description} ${trophy.guide}`.toLowerCase();
  return hay.includes(query);
}

export function platinumEarned(trophies, earned) {
  return trophies.filter((t) => t.grade !== "platinum" && earned.has(t.name)).length;
}

export function sourceLabel(url) {
  return SOURCE_LABELS[url] || url.replace(/^https?:\/\//, "");
}

const $ = (id) => document.getElementById(id);

function badge(grade) {
  const el = document.createElement("span");
  el.className = `badge g-${grade}`;
  el.textContent = grade === "platinum" ? "PLAT" : grade.toUpperCase();
  return el;
}

function flag(text, kind) {
  const el = document.createElement("span");
  el.className = `flag ${kind}`;
  el.textContent = text;
  return el;
}

let doc = null;
let state = null;

function persist(note) {
  saveProgress(localStorage, state);
  $("saved-state").textContent = note || "Saved here";
}

function visibleName(t) {
  return spoilerShieldHides(t, state) ? "Story trophy" : t.name;
}

function visibleDesc(t) {
  return spoilerShieldHides(t, state) ? "Hidden until earned, or until the shield is off." : t.description;
}

function filtered() {
  const q = state.query.trim().toLowerCase();
  return doc.trophies.filter((t) => {
    if (!matchesKindFilter(t, state.kind)) return false;
    if (!matchesGradeFilter(t, state.grade)) return false;
    if (state.status === "earned" && !state.earned.has(t.name)) return false;
    if (state.status === "open" && state.earned.has(t.name)) return false;
    return matchesSearch(t, q, spoilerShieldHides(t, state));
  }).sort((a, b) => a.order - b.order);
}

function renderMeters() {
  const n = state.earned.size;
  const ready = platinumEarned(doc.trophies, state.earned);
  $("progress-earned").textContent = `${n} / ${doc.trophies.length} earned`;
  $("platinum-fill").style.width = `${Math.round((ready / (doc.trophies.length - 1)) * 100)}%`;
  $("platinum-bar").setAttribute("aria-label", `Platinum ${ready} of ${doc.trophies.length - 1}`);
  const bits = [];
  for (const g of ["platinum", "gold", "silver", "bronze"]) {
    const have = doc.trophies.filter((t) => t.grade === g && state.earned.has(t.name)).length;
    const letter = g[0].toUpperCase();
    bits.push(`${letter} ${have}/${GRADE_TOTALS[g]}`);
  }
  $("grade-meters").textContent = `${bits.join(" · ")} · platinum ${ready}/54`;
}

function renderList() {
  const list = $("trophy-list");
  list.replaceChildren();
  const rows = filtered();
  if (!rows.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = state.kind === "online"
      ? "No online trophies. PowerPyx, OutputLag and Mobalytics each list 55 offline trophies."
      : "Nothing matches these filters.";
    list.append(p);
    return;
  }
  for (const t of rows) {
    const row = document.createElement("div");
    row.className = "row-item";
    row.dataset.id = String(t.id);
    if (t.id === state.selected) row.classList.add("on");
    if (t.missable) row.classList.add("miss");
    if (spoilerShieldHides(t, state)) row.classList.add("hid");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = state.earned.has(t.name);
    box.setAttribute("aria-label", `Earned: ${visibleName(t)}`);
    box.addEventListener("change", () => {
      if (box.checked) state.earned.add(t.name);
      else state.earned.delete(t.name);
      persist("Saved");
      render();
    });
    const text = document.createElement("button");
    text.type = "button";
    text.className = "row-text";
    const name = document.createElement("strong");
    name.textContent = visibleName(t);
    const desc = document.createElement("em");
    desc.textContent = visibleDesc(t);
    text.append(name, desc);
    text.addEventListener("click", () => {
      state.selected = t.id;
      render();
    });
    row.append(box, badge(t.grade), text);
    list.append(row);
  }
}

function renderDetail() {
  const t = doc.trophies.find((x) => x.id === state.selected) || filtered()[0] || doc.trophies[0];
  if (!t) return;
  state.selected = t.id;
  const panel = $("trophy-detail");
  const hidden = spoilerShieldHides(t, state);
  panel.replaceChildren();
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = `OFFICIAL · ${t.grade.toUpperCase()} · CHAPTER ${t.chapter} · ROADMAP ${t.order}`;
  const h = document.createElement("h2");
  h.textContent = hidden ? "Story trophy" : t.name;
  const official = document.createElement("p");
  official.className = "official";
  official.textContent = hidden ? "Name and description stay covered until you earn this trophy or turn the spoiler shield off." : t.description;
  const flags = document.createElement("div");
  flags.className = "flags";
  flags.append(flag(t.grade.toUpperCase(), "dim"));
  if (t.hidden) flags.append(flag("HIDDEN ON PSN", "dim"));
  if (t.missable) flags.append(flag("POSSIBLY MISSABLE", "miss"));
  else flags.append(flag("NOT MISSABLE", "ok"));
  if (t.risk) flags.append(flag("AT RISK", "risk"));
  panel.append(kicker, h, official, flags);
  if (!hidden) {
    const guide = document.createElement("p");
    guide.id = "guide-text";
    guide.textContent = t.guide;
    panel.append(guide);
    if (t.call) {
      const call = document.createElement("p");
      call.className = "call";
      call.textContent = `Our call: ${t.call}`;
      panel.append(call);
    }
  }
  renderRail(t, hidden);
}

function renderRail(t, hidden) {
  const rail = $("guide-sources");
  rail.replaceChildren();
  const h = document.createElement("h3");
  h.textContent = "SOURCES FOR THIS GUIDE";
  rail.append(h);
  if (hidden) {
    const p = document.createElement("p");
    p.textContent = "Sources stay covered with the story guide.";
    rail.append(p);
    return;
  }
  const ol = document.createElement("ol");
  for (const url of t.sources) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = sourceLabel(url);
    li.append(a);
    ol.append(li);
  }
  rail.append(ol);
  const nextH = document.createElement("h3");
  nextH.textContent = "NEXT ON THE ROADMAP";
  const upcoming = doc.trophies.filter((x) => !state.earned.has(x.name) && x.grade !== "platinum").sort((a, b) => a.order - b.order).slice(0, 4);
  const ul = document.createElement("ol");
  for (const x of upcoming) {
    const li = document.createElement("li");
    const masked = spoilerShieldHides(x, state);
    li.textContent = masked ? "Story trophy · hidden" : `${x.name}${x.missable ? " · MISSABLE" : ""}`;
    ul.append(li);
  }
  rail.append(nextH, ul);
}

function renderRoadmap() {
  const root = $("roadmap");
  root.replaceChildren();
  const h = document.createElement("h2");
  h.textContent = "Roadmap to the platinum";
  const lead = document.createElement("p");
  lead.textContent = doc.roadmapLead;
  root.append(h, lead);
  const grid = document.createElement("div");
  grid.className = "stages";
  for (const stage of doc.roadmap) {
    const card = document.createElement("article");
    card.className = stage.missable ? "stage miss" : "stage";
    const title = document.createElement("h3");
    title.textContent = `${stage.step}. ${stage.title}`;
    const body = document.createElement("p");
    body.textContent = stage.text;
    card.append(title, body);
    if (stage.missable) card.append(flag("MISSABLE WINDOW", "miss"));
    grid.append(card);
  }
  root.append(grid);
}

function renderMissables() {
  const root = $("missable-flags");
  root.replaceChildren();
  const h = document.createElement("h2");
  h.textContent = "Missable flags";
  const lead = document.createElement("p");
  lead.textContent = "Built from the official descriptions plus the pages named on each card. One window can close. The rest of the list stays available after the credits.";
  root.append(h, lead);
  for (const item of doc.missables) {
    const card = document.createElement("article");
    card.className = item.missable ? "stage miss" : "stage";
    const title = document.createElement("h3");
    title.textContent = item.title;
    const body = document.createElement("p");
    body.textContent = item.text;
    card.append(title, body);
    root.append(card);
  }
}

function renderCounts() {
  const root = $("counts");
  root.replaceChildren();
  const h = document.createElement("h2");
  h.textContent = "Counts on the way to 100%";
  const lead = document.createElement("p");
  lead.textContent = "Trophy counts are the official descriptions. The 100% column is PowerPyx's checklist, which OutputLag points at as the work behind A Long Road. Do the higher number when you are going for the gold.";
  const table = document.createElement("table");
  const head = document.createElement("tr");
  for (const label of ["Trophy", "Trophy needs", "Also for 100%", "Source"]) {
    const th = document.createElement("th");
    th.textContent = label;
    head.append(th);
  }
  table.append(head);
  for (const row of doc.counts) {
    const tr = document.createElement("tr");
    for (const key of ["name", "need", "also", "source"]) {
      const td = document.createElement("td");
      td.textContent = row[key];
      tr.append(td);
    }
    table.append(tr);
  }
  root.append(h, lead, table);
}

function showView(view) {
  state.view = view;
  location.hash = view === "tracker" ? "" : view;
  $("tracker").hidden = view !== "tracker";
  $("roadmap").hidden = view !== "roadmap";
  $("missable-flags").hidden = view !== "missables";
  $("counts").hidden = view !== "counts";
  for (const btn of $("views").querySelectorAll("button")) btn.classList.toggle("on", btn.dataset.view === view);
  if (view === "roadmap") renderRoadmap();
  if (view === "missables") renderMissables();
  if (view === "counts") renderCounts();
}

function render() {
  renderMeters();
  renderList();
  renderDetail();
  if (state.view === "roadmap") renderRoadmap();
  if (state.view === "missables") renderMissables();
  if (state.view === "counts") renderCounts();
}

function openExport() {
  $("export-json").value = exportProgress(state);
  $("export-panel").hidden = false;
}

function downloadExport() {
  const blob = new Blob([exportProgress(state)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bridge-log-progress.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function bindTracker() {
  $("spoiler-toggle").checked = state.spoiler;
  $("spoiler-toggle").addEventListener("change", () => {
    state.spoiler = $("spoiler-toggle").checked;
    persist("Shield saved");
    render();
  });
  $("export-progress").addEventListener("click", openExport);
  $("download-progress").addEventListener("click", downloadExport);
  $("close-export").addEventListener("click", () => { $("export-panel").hidden = true; });
  $("import-file").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const result = importProgress(await file.text(), doc.trophies.map((t) => t.name));
      state.earned = new Set(result.earned);
      if (result.spoiler !== null) {
        state.spoiler = result.spoiler;
        $("spoiler-toggle").checked = result.spoiler;
      }
      persist("Imported");
      $("import-note").textContent = result.skipped
        ? `Imported ${result.earned.length}. Skipped ${result.skipped} unknown names.`
        : `Imported ${result.earned.length} earned trophies.`;
      openExport();
      render();
    } catch {
      $("import-note").textContent = "That file is not progress JSON.";
      openExport();
    }
  });
  for (const btn of $("kind-filters").querySelectorAll("button")) {
    btn.addEventListener("click", () => {
      state.kind = btn.dataset.kind;
      for (const other of $("kind-filters").querySelectorAll("button")) other.classList.toggle("on", other === btn);
      render();
    });
  }
  $("grade-filter").addEventListener("change", () => { state.grade = $("grade-filter").value; render(); });
  $("status-filter").addEventListener("change", () => { state.status = $("status-filter").value; render(); });
  $("search-trophies").addEventListener("input", () => { state.query = $("search-trophies").value; render(); });
  for (const btn of $("views").querySelectorAll("button")) {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  }
  window.addEventListener("hashchange", () => {
    const view = location.hash.replace("#", "") || "tracker";
    if (["tracker", "roadmap", "missables", "counts"].includes(view)) showView(view);
  });
}

const saved = loadSavedProgress(localStorage);
state = {
  earned: new Set(saved.earned),
  spoiler: saved.spoiler,
  kind: "all",
  grade: "all",
  status: "all",
  query: "",
  view: "tracker",
  selected: 28
};
doc = await (await fetch("data/trophies.json")).json();
const kindCount = { all: doc.trophies.length, online: 0, missable: 0, risk: 0 };
for (const t of doc.trophies) {
  kindCount[t.kind] = (kindCount[t.kind] || 0) + 1;
  if (t.missable) kindCount.missable += 1;
  if (t.risk) kindCount.risk += 1;
}
const kindLabel = {
  all: "All", story: "Story", missable: "Missable", collectible: "Collectibles",
  activity: "Activities", online: "Online", side: "Side", crime: "Crime", risk: "At risk"
};
for (const btn of $("kind-filters").querySelectorAll("button")) {
  const n = kindCount[btn.dataset.kind] || 0;
  btn.textContent = `${kindLabel[btn.dataset.kind] || btn.dataset.kind} ${n}`;
}
bindTracker();
const start = location.hash.replace("#", "");
if (["roadmap", "missables", "counts"].includes(start)) showView(start);
render();
