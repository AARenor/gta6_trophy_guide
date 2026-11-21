import { loadProgress, saveProgress, exportProgress, importProgress } from "./store.js";
import { FILTERS, GRADES, applyFilters, countByKind, gradeLetter, primaryKind } from "./filters.js";
import { spoilerShield, concealedLabel, missableTag } from "./spoiler.js";
import { renderGuide } from "./guide.js";
import { STAGE_LABELS, buildRoadmap, renderRoadmap, renderNextUp } from "./roadmap.js";
import { renderMissables } from "./missables.js";
import { renderSources, renderGuideSources } from "./sources.js";
import { computeAudit, renderAudit } from "./audit.js";

let trophies = [];
let sources = [];
let sourceById = new Map();
let state = null;
let roadmap = { stages: [], order: [] };
let ui = { filter: "all", grade: "all", query: "", tab: "tracker" };
let lastOpen = null;

export async function boot() {
  const [trophyRes, sourceRes] = await Promise.all([
    fetch("data/trophies.json"),
    fetch("data/sources.json"),
  ]);
  if (!trophyRes.ok || !sourceRes.ok) throw new Error("local data missing");
  const trophyDoc = await trophyRes.json();
  trophies = trophyDoc.trophies;
  sources = await sourceRes.json();
  sourceById = new Map(sources.map((source) => [source.id, source]));
  state = scrub(loadProgress());
  roadmap = buildRoadmap(trophies);
  bind();
  renderAudit(document.getElementById("audit"), computeAudit(trophies, sources));
  renderAll();
  showTab("tracker");
}

function scrub(loaded) {
  const ids = new Set(trophies.map((trophy) => trophy.id));
  for (const key of Object.keys(loaded.earned)) if (!ids.has(Number(key))) delete loaded.earned[key];
  for (const key of Object.keys(loaded.revealed)) if (!ids.has(Number(key))) delete loaded.revealed[key];
  for (const key of Object.keys(loaded.counts)) if (!ids.has(Number(key))) delete loaded.counts[key];
  if (!ids.has(loaded.openId)) loaded.openId = trophies[0] ? trophies[0].id : null;
  return loaded;
}

function bind() {
  document.getElementById("spoiler-shield").addEventListener("click", () => {
    state.shield = !state.shield;
    persist();
    renderAll();
  });
  document.getElementById("export-progress").addEventListener("click", () => {
    exportProgress(state);
    status("Exported progress JSON");
  });
  document.getElementById("import-progress").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const result = importProgress(await file.text(), trophies);
    if (!result.ok) {
      status(result.error);
      return;
    }
    state = scrub(result.state);
    persist();
    status("Imported progress");
    renderAll();
  });
  document.getElementById("search").addEventListener("input", (event) => {
    ui.query = event.target.value;
    renderList();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    event.preventDefault();
    showTab("tracker");
    document.getElementById("search").focus();
  });
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
}

function onClick(event) {
  const cite = event.target.closest("a.cite");
  if (cite) {
    event.preventDefault();
    openSource(cite.dataset.source);
    return;
  }
  const reveal = event.target.closest("[data-reveal]");
  if (reveal) {
    state.revealed[Number(reveal.dataset.reveal)] = true;
    persist();
    renderAll({ keepScroll: true });
    return;
  }
  const countBtn = event.target.closest("[data-count]");
  if (countBtn) {
    shiftCount(Number(countBtn.dataset.count));
    return;
  }
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    showTab(tab.dataset.tab);
    return;
  }
  const filter = event.target.closest("[data-filter]");
  if (filter) {
    ui.filter = filter.dataset.filter;
    renderChips();
    renderList();
    return;
  }
  const grade = event.target.closest("[data-grade]");
  if (grade) {
    ui.grade = ui.grade === grade.dataset.grade ? "all" : grade.dataset.grade;
    renderChips();
    renderList();
    return;
  }
  const next = event.target.closest("#next-up [data-id]");
  if (next) {
    openTrophy(Number(next.dataset.id));
    return;
  }
  if (event.target.closest("input, button, a, label")) return;
  const row = event.target.closest("#list [data-id]");
  if (row) openTrophy(Number(row.dataset.id));
}

function onChange(event) {
  const box = event.target.closest("input[data-earn]");
  if (!box) return;
  const id = Number(box.dataset.earn);
  if (box.checked) state.earned[id] = true;
  else delete state.earned[id];
  persist();
  renderAll({ keepScroll: true });
}

function shiftCount(dir) {
  const trophy = byId(state.openId);
  if (!trophy || trophy.count == null) return;
  const current = state.counts[trophy.id] || 0;
  const next = Math.max(0, Math.min(trophy.count, current + dir));
  if (next === current) return;
  state.counts[trophy.id] = next;
  persist();
  renderGuidePanel(false);
}

function openTrophy(id) {
  state.openId = id;
  persist();
  showTab("tracker");
  renderGuidePanel(true);
  renderSide();
  markSelected();
}

function openSource(id) {
  showTab("sources");
  const row = document.getElementById("source-" + id);
  if (!row) return;
  row.scrollIntoView({ block: "center" });
  row.classList.add("flash");
  setTimeout(() => row.classList.remove("flash"), 1600);
}

function showTab(name) {
  ui.tab = name;
  for (const id of ["tracker", "roadmap", "missables", "sources"]) {
    document.getElementById(id).hidden = id !== name;
    const button = document.getElementById("tab-" + id);
    button.setAttribute("aria-selected", id === name ? "true" : "false");
    button.classList.toggle("on", id === name);
  }
}

function renderAll(opts) {
  renderProgress();
  renderShield();
  renderChips();
  renderList(opts && opts.keepScroll);
  renderGuidePanel(false);
  renderSide();
  renderRoadmap(document.getElementById("roadmap"), roadmap, state);
  renderMissables(document.getElementById("missables"), trophies);
  renderSources(document.getElementById("sources"), sources, trophies);
}

function renderProgress() {
  const earned = trophies.filter((trophy) => state.earned[trophy.id]).length;
  document.getElementById("progress-label").textContent = earned + " / " + trophies.length + " earned";
  const fill = document.getElementById("progress-fill");
  fill.style.width = (trophies.length ? (earned / trophies.length) * 100 : 0) + "%";
  const parts = GRADES.map((grade) => {
    const total = trophies.filter((trophy) => trophy.grade === grade).length;
    const got = trophies.filter((trophy) => trophy.grade === grade && state.earned[trophy.id]).length;
    return gradeLetter(grade) + " " + got + "/" + total;
  });
  document.getElementById("grade-counts").textContent = parts.join(" · ");
}

function renderShield() {
  const button = document.getElementById("spoiler-shield");
  button.setAttribute("aria-pressed", state.shield ? "true" : "false");
  button.textContent = state.shield ? "Spoiler shield · On" : "Spoiler shield · Off";
}

function renderChips() {
  const counts = countByKind(trophies, viewState());
  const root = document.getElementById("chips");
  root.replaceChildren();
  for (const filter of FILTERS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.dataset.filter = filter.id;
    button.setAttribute("aria-pressed", ui.filter === filter.id ? "true" : "false");
    button.textContent = filter.label + " " + counts[filter.id];
    root.append(button);
  }
  const label = document.createElement("span");
  label.className = "chip-label";
  label.textContent = "Grade";
  root.append(label);
  for (const grade of GRADES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip grade-chip";
    button.dataset.grade = grade;
    button.setAttribute("aria-pressed", ui.grade === grade ? "true" : "false");
    button.textContent = gradeLetter(grade);
    button.setAttribute("aria-label", grade);
    root.append(button);
  }
}

function renderList(keepScroll) {
  const list = document.getElementById("list");
  const y = keepScroll ? list.scrollTop : 0;
  list.replaceChildren();
  const allow = new Set(applyFilters(trophies, viewState()).map((trophy) => trophy.id));
  const visible = roadmap.order.filter((trophy) => allow.has(trophy.id));
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No trophies match.";
    list.append(empty);
    return;
  }
  let stage = null;
  for (const trophy of visible) {
    if (trophy.stage !== stage) {
      stage = trophy.stage;
      const heading = document.createElement("h2");
      heading.className = "stage-h";
      heading.textContent = "Stage " + stage + " · " + (STAGE_LABELS[stage] || "Stage");
      list.append(heading);
    }
    list.append(rowFor(trophy));
  }
  list.scrollTop = y;
}

function rowFor(trophy) {
  const concealed = spoilerShield(trophy, viewState());
  const row = document.createElement("div");
  row.className = "row" + (trophy.id === state.openId ? " selected" : "") + (concealed ? " concealed" : "");
  row.dataset.id = String(trophy.id);
  const box = document.createElement("input");
  box.type = "checkbox";
  box.dataset.earn = String(trophy.id);
  box.checked = !!state.earned[trophy.id];
  const visible = concealed ? concealedLabel(trophy) : trophy.name;
  box.setAttribute("aria-label", "Earned: " + visible);
  const badge = document.createElement("span");
  badge.className = "badge b-" + trophy.grade;
  badge.textContent = gradeLetter(trophy.grade);
  const main = document.createElement("div");
  main.className = "row-main";
  const name = document.createElement("span");
  name.className = "row-name";
  name.textContent = visible;
  main.append(name);
  if (!concealed) {
    const desc = document.createElement("span");
    desc.className = "row-desc";
    desc.textContent = trophy.description;
    const tags = document.createElement("span");
    tags.className = "row-tags";
    const kind = document.createElement("span");
    kind.className = "tag";
    kind.textContent = primaryKind(trophy);
    tags.append(kind);
    const flag = missableTag(trophy.missable);
    if (flag) {
      const mark = document.createElement("span");
      mark.className = trophy.missable === "at-risk" ? "tag tag-risk" : "tag tag-miss";
      mark.textContent = flag;
      tags.append(mark);
    }
    main.append(desc, tags);
  } else {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reveal";
    button.dataset.reveal = String(trophy.id);
    button.textContent = "Reveal this one";
    main.append(button);
  }
  row.append(box, badge, main);
  return row;
}

function renderGuidePanel(reset) {
  const root = document.getElementById("guide");
  const trophy = byId(state.openId);
  const y = reset || trophy && trophy.id !== lastOpen ? 0 : root.scrollTop;
  lastOpen = trophy ? trophy.id : null;
  renderGuide(root, trophy, {
    concealed: trophy ? spoilerShield(trophy, state) : false,
    count: trophy ? state.counts[trophy.id] || 0 : 0,
    sourceById,
  });
  root.scrollTop = y;
}

function renderSide() {
  renderNextUp(document.getElementById("next-up"), roadmap.order, state, 5);
  const trophy = byId(state.openId);
  renderGuideSources(
    document.getElementById("guide-sources"),
    trophy,
    sources,
    trophy ? spoilerShield(trophy, state) : false,
  );
}

function markSelected() {
  for (const row of document.querySelectorAll("#list [data-id]")) {
    row.classList.toggle("selected", Number(row.dataset.id) === state.openId);
  }
}

function viewState() {
  return {
    earned: state.earned,
    revealed: state.revealed,
    shield: state.shield,
    filter: ui.filter,
    grade: ui.grade,
    query: ui.query,
  };
}

function byId(id) {
  return trophies.find((trophy) => trophy.id === id) || null;
}

function persist() {
  saveProgress(state);
}

function status(text) {
  const node = document.getElementById("io-status");
  node.textContent = text;
  clearTimeout(status.timer);
  status.timer = setTimeout(() => {
    node.textContent = "";
  }, 2400);
}

boot().catch(() => {
  const audit = document.getElementById("audit");
  if (audit) audit.textContent = "Could not read the local data files.";
});
