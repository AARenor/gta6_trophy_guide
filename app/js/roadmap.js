import { gradeLetter } from "./filters.js";
import { hiddenLabel, missableTag, spoilerShield } from "./spoiler.js";
import { renderCitations } from "./guide.js";

export function buildRoadmap(trophies) {
  const buckets = new Map();
  for (const trophy of trophies) {
    const stage = trophy.stage || 0;
    if (!buckets.has(stage)) buckets.set(stage, []);
    buckets.get(stage).push(trophy);
  }
  const stages = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([n, members]) => {
    members.sort(byChapterThenId);
    const chapters = unique(members.map((trophy) => trophy.chapter)).sort((a, b) => chapterRank(a) - chapterRank(b));
    const missions = unique(members.flatMap((trophy) => trophy.missions || []));
    const kinds = unique(members.flatMap((trophy) => trophy.kinds || []));
    return {
      n,
      title: stageTitle(members, chapters, kinds),
      chapters,
      missions,
      kinds,
      members,
      hours: members.filter((trophy) => trophy.hours),
      pins: [],
    };
  });
  for (const trophy of trophies) {
    if (!missableTag(trophy)) continue;
    const stage = stages.find((item) => item.n === pinStage(trophy, stages));
    if (stage) stage.pins.push(trophy);
  }
  return stages;
}

export function renderRoadmap(root, stages, ctx) {
  root.replaceChildren();
  const head = document.createElement("header");
  head.className = "road-head";
  const title = document.createElement("h2");
  title.textContent = "Roadmap to the platinum";
  const note = document.createElement("p");
  note.append(document.createTextNode("Ordered from the stage, chapter and mission fields. "));
  const hourBits = [];
  for (const stage of stages) {
    for (const trophy of stage.hours) hourBits.push(trophy);
  }
  if (hourBits.length) {
    note.append(document.createTextNode("Published hour figures sit on the trophies that carry them: "));
    hourBits.forEach((trophy, index) => {
      if (index) note.append(document.createTextNode("; "));
      note.append(document.createTextNode(`${trophy.name} ${trophy.hours} h `));
      const claim = (trophy.claims || []).find((item) => String(item.t).includes(String(trophy.hours)));
      note.append(renderCitations(claim ? claim.s : [], ctx.sources, ctx.onCite));
    });
    note.append(document.createTextNode(". Other stages do not publish an hour split."));
  }
  head.append(title, note);
  const grid = document.createElement("div");
  grid.className = "stage-grid";
  for (const stage of stages) grid.append(stageCard(stage, ctx));
  root.append(head, grid);
}

export function nextUp(stages, state, limit = 6) {
  const seen = new Set();
  const rows = [];
  for (const stage of stages) {
    const queued = [...stage.pins, ...stage.members];
    for (const trophy of queued) {
      if (seen.has(trophy.id) || state.earned.includes(trophy.name)) continue;
      seen.add(trophy.id);
      rows.push({ trophy, stage });
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}

function stageCard(stage, ctx) {
  const card = document.createElement("article");
  card.className = "stage";
  const head = document.createElement("header");
  const numeral = document.createElement("span");
  numeral.className = "numeral";
  numeral.textContent = String(stage.n);
  const copy = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = stage.title;
  const earned = stage.members.filter((trophy) => ctx.state.earned.includes(trophy.name)).length;
  const meta = document.createElement("p");
  meta.textContent = `${stage.chapters.join(" · ")} · ${earned} / ${stage.members.length}`;
  copy.append(title, meta);
  head.append(numeral, copy);
  card.append(head);
  if (stage.missions.length) {
    const missions = document.createElement("p");
    missions.className = "missions";
    missions.textContent = stage.missions.slice(0, 6).join(" · ");
    card.append(missions);
  }
  if (stage.hours.length) {
    const hours = document.createElement("p");
    hours.className = "hours";
    hours.textContent = stage.hours.map((trophy) => `${trophy.name} · ${trophy.hours} h`).join(" · ");
    card.append(hours);
  }
  for (const trophy of stage.pins) card.append(pin(trophy, ctx));
  const chips = document.createElement("div");
  chips.className = "chips";
  for (const trophy of stage.members) chips.append(chip(trophy, ctx));
  card.append(chips);
  return card;
}

function pin(trophy, ctx) {
  const box = document.createElement("div");
  box.className = "pin";
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = `Do this before the stage closes · ${missableTag(trophy)}`;
  const row = document.createElement("div");
  row.className = "pin-row";
  row.append(check(trophy, ctx));
  const name = document.createElement("button");
  name.type = "button";
  name.className = "text-btn";
  name.textContent = spoilerShield(trophy, ctx.state) ? hiddenLabel(trophy) : trophy.name;
  name.addEventListener("click", () => ctx.onOpen(trophy));
  row.append(name);
  const window = document.createElement("p");
  window.textContent = trophy.window || "";
  box.append(kicker, row, window);
  return box;
}

function chip(trophy, ctx) {
  const node = document.createElement("div");
  node.className = "chip" + (ctx.state.earned.includes(trophy.name) ? " earned" : "");
  node.append(check(trophy, ctx), badge(trophy.grade));
  const name = document.createElement("button");
  name.type = "button";
  name.className = "text-btn";
  name.textContent = spoilerShield(trophy, ctx.state) ? hiddenLabel(trophy) : trophy.name;
  name.addEventListener("click", () => ctx.onOpen(trophy));
  node.append(name);
  const flag = missableTag(trophy);
  if (flag && !spoilerShield(trophy, ctx.state)) {
    const tag = document.createElement("span");
    tag.className = flag === "AT RISK" ? "flag risk" : "flag miss";
    tag.textContent = flag;
    node.append(tag);
  }
  return node;
}

function check(trophy, ctx) {
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = ctx.state.earned.includes(trophy.name);
  box.setAttribute("aria-label", spoilerShield(trophy, ctx.state) ? "Mark story trophy earned" : `Earned: ${trophy.name}`);
  box.addEventListener("change", () => ctx.onToggle(trophy, box.checked));
  return box;
}

function badge(grade) {
  const node = document.createElement("span");
  node.className = `badge ${gradeLetter(grade).toLowerCase()}`;
  node.textContent = gradeLetter(grade);
  return node;
}

function stageTitle(members, chapters, kinds) {
  const storyOnly = kinds.length === 1 && kinds[0] === "story";
  const numbers = chapters.map((chapter) => /^Chapter (\d+)/.exec(chapter)).filter(Boolean).map((match) => Number(match[1]));
  if (storyOnly && numbers.length === 1) {
    const finale = members.some((trophy) => /final mission/i.test(trophy.description || ""));
    return finale ? `Chapter ${numbers[0]} · final mission` : `Chapter ${numbers[0]}`;
  }
  if (storyOnly && numbers.length > 1) return `Chapters ${numbers[0]}–${numbers[numbers.length - 1]}`;
  if (members.some((trophy) => trophy.grade === "platinum")) return "Strands and the platinum";
  if (kinds.includes("collectibles") && kinds.includes("completion")) return "Collectibles and 100%";
  if (kinds.includes("activities") || kinds.includes("crime")) return "Activities and crime";
  return "Later cleanup";
}

function pinStage(trophy, stages) {
  const match = /Chapter (\d+)/.exec(`${trophy.window || ""} ${trophy.chapter || ""}`);
  if (match) {
    const label = `Chapter ${match[1]}`;
    const hit = stages.find((stage) => stage.members.some((item) => item.chapter === label && (item.kinds || []).includes("story")));
    if (hit) return hit.n;
  }
  return trophy.stage;
}

function byChapterThenId(a, b) {
  const rank = chapterRank(a.chapter) - chapterRank(b.chapter);
  return rank || a.id - b.id;
}

function chapterRank(chapter) {
  const match = /^Chapter (\d+)/.exec(chapter || "");
  if (match) return Number(match[1]);
  if (chapter === "Post-story") return 80;
  if (chapter === "Any time") return 70;
  return 60;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
