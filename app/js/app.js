import { saveProgress, loadProgress, exportProgress, importProgress } from "./store.js";
import { FILTERS, GRADES, applyFilters, countByKind, gradeLetter } from "./filters.js";
import { spoilerShield, hiddenLabel, missableTag } from "./spoiler.js";
import { renderGuide, renderSealed } from "./guide.js";
import { buildRoadmap, renderRoadmap, nextUp } from "./roadmap.js";
import { renderMissables } from "./missables.js";
import { renderSources, backingCounts, guideBackings } from "./sources.js";
import { computeAudit, renderAudit, gradeTotals } from "./audit.js";

let doc = null;
let trophies = [];
let sources = [];
let state = null;
let filter = "all";
let query = "";
let tab = "tracker";
let stages = [];
let counts = new Map();
let toastTimer = 0;

export async function startApp() {
  const [trophyRes, sourceRes] = await Promise.all([
    fetch("data/trophies.json"),
    fetch("data/sources.json"),
  ]);
  if (!trophyRes.ok || !sourceRes.ok) throw new Error("local data missing");
  doc = await trophyRes.json();
  trophies = doc.trophies;
  sources = await sourceRes.json();
  state = normalize(loadProgress(), trophies);
  stages = buildRoadmap(trophies);
  counts = backingCounts(trophies);
  document.getElementById("meta").textContent = `GTA VI · ${doc.platform} · ${trophies.length} trophies`;
  bindChrome();
  buildFilters();
  setTab("tracker");
  render();
}

export function setTab(name) {
  tab = name;
  for (const id of ["tracker", "roadmap", "missables", "sources"]) {
    document.getElementById(id).hidden = id !== name;
    const button = document.getElementById(`tab-${id}`);
    button.setAttribute("aria-selected", id === name ? "true" : "false");
    button.classList.toggle("is-on", id === name);
  }
}

export function renderTracker() {
  renderProgress();
  renderShield();
  renderAudit(document.getElementById("audit"), computeAudit(trophies, sources));
  updateFilters();
  renderReading();
  renderList();
  renderOpenGuide();
  renderNext();
  renderGuideSources();
}

function bindChrome() {
  document.getElementById("spoiler-shield").addEventListener("click", () => {
    state.shield = !state.shield;
    persist();
    render();
  });
  document.getElementById("export-progress").addEventListener("click", () => {
    exportProgress(state);
    toast(`Exported plate-clerk-progress.json · ${state.earned.length} earned · saved in this browser`);
  });
  document.getElementById("import-progress").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const result = importProgress(await file.text(), trophies);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    state = normalize(result.state, trophies);
    persist();
    render();
    toast(`Imported ${state.earned.length} earned trophies.`);
  });
  document.getElementById("search").addEventListener("input", (event) => {
    query = event.target.value;
    renderList();
  });
  for (const id of ["tracker", "roadmap", "missables", "sources"]) {
    document.getElementById(`tab-${id}`).addEventListener("click", () => setTab(id));
  }
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    event.preventDefault();
    setTab("tracker");
    document.getElementById("search").focus();
  });
}

function buildFilters() {
  const bar = document.getElementById("filters");
  bar.replaceChildren();
  for (const [key, label] of FILTERS) bar.append(chip(key, label));
  const grades = document.createElement("span");
  grades.className = "grade-chips";
  for (const grade of GRADES) grades.append(chip(grade, gradeLetter(grade)));
  bar.append(grades);
}

function chip(key, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "filter";
  button.dataset.filter = key;
  button.addEventListener("click", () => {
    filter = key;
    updateFilters();
    renderList();
  });
  const name = document.createElement("span");
  name.textContent = label;
  const count = document.createElement("span");
  count.className = "n";
  button.append(name, count);
  return button;
}

function updateFilters() {
  const totals = countByKind(trophies, new Set(state.earned));
  for (const button of document.querySelectorAll("#filters .filter")) {
    const key = button.dataset.filter;
    button.classList.toggle("is-on", key === filter);
    button.querySelector(".n").textContent = String(totals[key] ?? 0);
  }
}

function render() {
  renderTracker();
  const ctx = viewCtx();
  renderRoadmap(document.getElementById("roadmap"), stages, ctx);
  renderMissables(document.getElementById("missables"), trophies, ctx);
  renderSources(document.getElementById("sources"), sources, counts, ctx);
}

function renderProgress() {
  const earned = new Set(state.earned);
  const line = document.getElementById("earned-line");
  line.textContent = `${earned.size} / ${trophies.length} earned`;
  const bar = document.getElementById("progress-bar");
  const pct = trophies.length ? (earned.size / trophies.length) * 100 : 0;
  bar.setAttribute("aria-valuemax", String(trophies.length));
  bar.setAttribute("aria-valuenow", String(earned.size));
  document.getElementById("progress-fill").style.width = `${pct}%`;
  const totals = gradeTotals(trophies, earned);
  const bits = GRADES.map((grade) => `${gradeLetter(grade)} ${totals[grade][0]}/${totals[grade][1]}`);
  document.getElementById("grade-counts").textContent = bits.join("  ");
}

function renderShield() {
  const button = document.getElementById("spoiler-shield");
  button.setAttribute("aria-pressed", state.shield ? "true" : "false");
  button.classList.toggle("is-on", state.shield);
  button.textContent = state.shield ? "Spoiler shield on" : "Spoiler shield off";
}

function renderReading() {
  const trophy = openTrophy();
  const node = document.getElementById("reading");
  if (!trophy) {
    node.textContent = "";
    return;
  }
  const name = spoilerShield(trophy, state) ? hiddenLabel(trophy) : trophy.name;
  const flag = !spoilerShield(trophy, state) && missableTag(trophy) ? ` · ${missableTag(trophy)}` : "";
  node.textContent = `Open · ${gradeLetter(trophy.grade)} · ${name}${flag}`;
}

function renderList() {
  const list = document.getElementById("trophy-list");
  const scroll = list.scrollTop;
  const earned = new Set(state.earned);
  const rows = applyFilters(trophies, {
    kind: filter,
    query,
    earned,
    textOf: (trophy) => searchable(trophy),
  });
  rows.sort((a, b) => a.stage - b.stage || a.id - b.id);
  list.replaceChildren();
  let last = null;
  for (const trophy of rows) {
    if (trophy.stage !== last) {
      last = trophy.stage;
      list.append(stageHead(trophy.stage, rows));
    }
    list.append(row(trophy));
  }
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No trophy matches that filter.";
    list.append(empty);
  }
  list.scrollTop = scroll;
}

function stageHead(stage, rows) {
  const node = document.createElement("p");
  node.className = "stage-head";
  const info = stages.find((item) => item.n === stage);
  const inView = rows.filter((trophy) => trophy.stage === stage);
  const earned = inView.filter((trophy) => state.earned.includes(trophy.name)).length;
  node.textContent = `Stage ${stage} · ${info ? info.title : ""} · ${earned} / ${inView.length}`;
  return node;
}

function row(trophy) {
  const sealed = spoilerShield(trophy, state);
  const node = document.createElement("div");
  node.className = "row" + (trophy.id === state.open ? " is-open" : "") + (state.earned.includes(trophy.name) ? " is-earned" : "");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = state.earned.includes(trophy.name);
  box.setAttribute("aria-label", sealed ? "Mark story trophy earned" : `Earned: ${trophy.name}`);
  box.addEventListener("click", (event) => event.stopPropagation());
  box.addEventListener("change", () => onToggle(trophy, box.checked));
  node.append(box, badge(trophy.grade));
  const body = document.createElement("div");
  const name = document.createElement("p");
  name.className = "row-name";
  name.textContent = sealed ? hiddenLabel(trophy) : trophy.name;
  body.append(name);
  if (!sealed) {
    const desc = document.createElement("p");
    desc.className = "row-desc";
    desc.textContent = trophy.description;
    const tags = document.createElement("p");
    tags.className = "row-tags";
    const kind = (trophy.kinds || []).slice(0, 2).join(" · ");
    tags.textContent = kind;
    const flag = missableTag(trophy);
    if (flag) {
      const mark = document.createElement("span");
      mark.className = flag === "AT RISK" ? "flag risk" : "flag miss";
      mark.textContent = flag;
      tags.append(document.createTextNode(" "), mark);
    }
    body.append(desc, tags);
  } else {
    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "reveal";
    reveal.textContent = "Reveal this one";
    reveal.addEventListener("click", (event) => {
      event.stopPropagation();
      onReveal(trophy);
    });
    body.append(reveal);
  }
  node.append(body);
  node.addEventListener("click", () => onOpen(trophy));
  return node;
}

function renderOpenGuide() {
  const trophy = openTrophy();
  const root = document.getElementById("guide");
  const scroll = trophy && trophy.id === root.dataset.open ? root.scrollTop : 0;
  if (!trophy) {
    root.replaceChildren();
    return;
  }
  if (spoilerShield(trophy, state)) renderSealed(root, trophy, onReveal);
  else {
    renderGuide(root, trophy, {
      earned: state.earned.includes(trophy.name),
      countValue: counterOf(trophy),
      sources,
      onCite: showSource,
      onCount: (next) => onCount(trophy, next),
    });
  }
  root.dataset.open = String(trophy.id);
  root.scrollTop = scroll;
}

function renderNext() {
  const root = document.getElementById("next-up");
  root.replaceChildren();
  const title = document.createElement("h3");
  title.textContent = "Next up on the roadmap";
  const list = document.createElement("ol");
  nextUp(stages, state, 5).forEach((item, index) => {
    const sealed = spoilerShield(item.trophy, state);
    const li = document.createElement("li");
    const num = document.createElement("span");
    num.className = "next-num";
    num.setAttribute("aria-hidden", "true");
    num.textContent = String(index + 1);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-btn";
    button.textContent = sealed ? hiddenLabel(item.trophy) : item.trophy.name;
    if (item.trophy.id === state.open) button.classList.add("is-open");
    button.addEventListener("click", () => onOpen(item.trophy));
    li.append(num, badge(item.trophy.grade), button);
    const flag = !sealed && missableTag(item.trophy);
    if (flag) {
      const tag = document.createElement("span");
      tag.className = flag === "AT RISK" ? "flag risk" : "flag miss";
      tag.textContent = flag;
      li.append(tag);
    }
    list.append(li);
  });
  root.append(title, list);
}

function renderGuideSources() {
  const root = document.getElementById("guide-sources");
  const trophy = openTrophy();
  root.replaceChildren();
  const title = document.createElement("h3");
  title.textContent = "Sources for this guide";
  root.append(title);
  if (!trophy || spoilerShield(trophy, state)) {
    const note = document.createElement("p");
    note.className = "quiet";
    note.textContent = "Covered while the shield is on.";
    root.append(note);
    return;
  }
  const byId = new Map(sources.map((source) => [source.id, source]));
  const list = document.createElement("ul");
  for (const [id, n] of guideBackings(trophy)) {
    const source = byId.get(id);
    if (!source) continue;
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-btn";
    button.textContent = source.site;
    button.addEventListener("click", () => showSource(id));
    const backs = document.createElement("span");
    backs.textContent = `backs ${n}`;
    const page = document.createElement("p");
    page.textContent = source.title;
    const read = document.createElement("p");
    read.className = "quiet";
    read.textContent = `Read ${source.read}`;
    item.append(button, backs, page, read);
    list.append(item);
  }
  root.append(list);
}

function viewCtx() {
  return { state, sources, onToggle, onOpen, onCite: showSource };
}

function onToggle(trophy, checked) {
  if (checked) {
    if (!state.earned.includes(trophy.name)) state.earned.push(trophy.name);
  } else {
    state.earned = state.earned.filter((name) => name !== trophy.name);
  }
  persist();
  render();
}

function onOpen(trophy) {
  state.open = trophy.id;
  persist();
  setTab("tracker");
  renderTracker();
  const row = document.querySelector(`#trophy-list .row.is-open`);
  if (row) row.scrollIntoView({ block: "nearest" });
}

function onReveal(trophy) {
  if (!state.revealed.includes(trophy.id)) state.revealed.push(trophy.id);
  state.open = trophy.id;
  persist();
  render();
}

function onCount(trophy, next) {
  const max = trophy.count;
  const value = Math.max(0, Math.min(max, next));
  state.counters[trophy.id] = value;
  persist();
  renderTracker();
}

function showSource(id) {
  setTab("sources");
  const row = document.getElementById(`source-${id}`);
  if (!row) return;
  row.scrollIntoView({ block: "center" });
  row.classList.add("lit");
  setTimeout(() => row.classList.remove("lit"), 1600);
}

function searchable(trophy) {
  if (spoilerShield(trophy, state)) return `${hiddenLabel(trophy)} ${trophy.grade} ${trophy.chapter}`;
  return `${trophy.name} ${trophy.description} ${trophy.chapter} ${(trophy.kinds || []).join(" ")} ${trophy.grade} ${trophy.missable || ""}`;
}

function openTrophy() {
  return trophies.find((trophy) => trophy.id === state.open) || trophies[0];
}

function counterOf(trophy) {
  const value = Number(state.counters[trophy.id] ?? state.counters[String(trophy.id)] ?? 0);
  if (!Number.isFinite(value)) return 0;
  return value;
}

function badge(grade) {
  const node = document.createElement("span");
  node.className = `badge ${gradeLetter(grade).toLowerCase()}`;
  node.textContent = gradeLetter(grade);
  return node;
}

function normalize(raw, list) {
  const names = new Set(list.map((trophy) => trophy.name));
  const byId = new Map(list.map((trophy) => [trophy.id, trophy]));
  const earned = raw.earned.filter((name) => names.has(name));
  const counters = {};
  for (const [key, value] of Object.entries(raw.counters || {})) {
    const trophy = byId.get(Number(key));
    const number = Number(value);
    if (!trophy || typeof trophy.count !== "number" || !Number.isFinite(number)) continue;
    counters[trophy.id] = Math.max(0, Math.min(trophy.count, Math.round(number)));
  }
  const revealed = (raw.revealed || []).filter((id) => byId.has(id));
  let open = byId.has(raw.open) ? raw.open : null;
  if (open == null) {
    const withWindow = list.find((trophy) => trophy.window);
    open = (withWindow || list[0]).id;
  }
  return { earned, counters, shield: raw.shield !== false, open, revealed };
}

function persist() {
  saveProgress(state);
}

function toast(message) {
  const node = document.getElementById("toast");
  node.hidden = false;
  node.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.hidden = true;
  }, 4200);
}

startApp().catch(() => {
  const audit = document.getElementById("audit");
  if (audit) audit.textContent = "Could not read the local trophy files.";
});
