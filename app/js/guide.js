import { gradeLetter } from "./filters.js";
import { hiddenLabel, missableTag } from "./spoiler.js";

export function renderGuide(root, trophy, ctx) {
  root.replaceChildren();
  root.append(head(trophy, ctx.earned));
  root.append(officialBox(trophy));
  root.append(tagRow(trophy));
  if (typeof trophy.count === "number") root.append(counterBox(trophy, ctx));
  if (trophy.window || missableTag(trophy)) root.append(windowBox(trophy));
  if ((trophy.disputes || []).length) root.append(differBox(trophy, ctx));
  root.append(stepsBox(trophy, ctx));
  root.append(claimsBox(trophy, ctx));
}

export function renderCitations(ids, sources, onCite) {
  const wrap = document.createElement("span");
  wrap.className = "cites";
  const byId = new Map((sources || []).map((source) => [source.id, source]));
  for (const id of ids || []) {
    const link = document.createElement("a");
    link.className = "cite";
    link.href = `#source-${id}`;
    link.textContent = `[${id}]`;
    const source = byId.get(id);
    if (source) link.title = `${source.site}: ${source.title}`;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      onCite(id);
    });
    wrap.append(link);
  }
  return wrap;
}

export function renderSealed(root, trophy, onReveal) {
  root.replaceChildren();
  const box = document.createElement("div");
  box.className = "sealed";
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = "Spoiler shield";
  const title = document.createElement("h2");
  title.textContent = hiddenLabel(trophy);
  const note = document.createElement("p");
  note.textContent = "The name, the official description and the guide stay covered until you earn it, or until you reveal this one.";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "reveal";
  button.textContent = "Reveal this one";
  button.addEventListener("click", () => onReveal(trophy));
  box.append(kicker, title, note, button);
  root.append(box);
}

function head(trophy, earned) {
  const row = document.createElement("header");
  row.className = "g-head";
  row.append(badge(trophy.grade));
  const title = document.createElement("h2");
  title.textContent = trophy.name;
  row.append(title);
  const flag = missableTag(trophy);
  if (flag) {
    const tag = document.createElement("span");
    tag.className = flag === "AT RISK" ? "flag risk" : "flag miss";
    tag.textContent = flag;
    row.append(tag);
  }
  const state = document.createElement("span");
  state.className = earned ? "state on" : "state";
  state.textContent = earned ? "Earned" : "Not earned";
  row.append(state);
  return row;
}

function officialBox(trophy) {
  const box = document.createElement("blockquote");
  box.className = "official";
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = "Official description";
  const text = document.createElement("p");
  text.textContent = trophy.description;
  box.append(kicker, text);
  return box;
}

function tagRow(trophy) {
  const list = document.createElement("ul");
  list.className = "tags";
  const tags = [
    chapterTag(trophy.chapter),
    `Stage ${trophy.stage}`,
    ...(trophy.kinds || []),
  ];
  if (trophy.missable && trophy.missable !== "no") tags.push(trophy.missable);
  for (const tag of tags) {
    const item = document.createElement("li");
    item.textContent = tag;
    if (tag === "possibly" || tag === "yes" || tag === "at-risk" || tag === "missable") item.className = "hot";
    list.append(item);
  }
  return list;
}

function chapterTag(chapter) {
  const value = chapter || "—";
  if (value === "Any time" || value === "Post-story") return value;
  return `Chapter · ${value}`;
}

function counterBox(trophy, ctx) {
  const box = document.createElement("div");
  box.className = "counter";
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = "Tracked count";
  const controls = document.createElement("div");
  controls.className = "counter-row";
  const down = document.createElement("button");
  down.type = "button";
  down.textContent = "−";
  down.setAttribute("aria-label", "Decrease count");
  down.disabled = ctx.countValue <= 0;
  down.addEventListener("click", () => ctx.onCount(ctx.countValue - 1));
  const value = document.createElement("strong");
  value.textContent = formatNum(ctx.countValue);
  const of = document.createElement("span");
  of.textContent = `/ ${formatNum(trophy.count)}`;
  const up = document.createElement("button");
  up.type = "button";
  up.textContent = "+";
  up.setAttribute("aria-label", "Increase count");
  up.disabled = ctx.countValue >= trophy.count;
  up.addEventListener("click", () => ctx.onCount(ctx.countValue + 1));
  controls.append(down, value, of, up);
  box.append(kicker, controls);
  return box;
}

function windowBox(trophy) {
  const box = document.createElement("div");
  box.className = "window";
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = "Missable window";
  const text = document.createElement("p");
  text.textContent = trophy.window || "Sources flag this one, but they do not publish a narrower window.";
  box.append(kicker, text);
  if ((trophy.missions || []).length) {
    const tied = document.createElement("p");
    tied.className = "tied";
    tied.textContent = `Tied to ${trophy.missions.join(", ")}`;
    box.append(tied);
  }
  return box;
}

function differBox(trophy, ctx) {
  const box = document.createElement("section");
  box.className = "differ";
  const title = document.createElement("h3");
  title.textContent = "Sources differ";
  box.append(title);
  for (const dispute of trophy.disputes) {
    const question = document.createElement("p");
    question.className = "question";
    question.textContent = dispute.q;
    const pair = document.createElement("div");
    pair.className = "pair";
    pair.append(version("Version A", dispute.a, ctx), version("Version B", dispute.b, ctx));
    const call = document.createElement("p");
    call.className = "call";
    const label = document.createElement("span");
    label.className = "kicker";
    label.textContent = "Our call";
    call.append(label, document.createTextNode(` ${dispute.call}`));
    box.append(question, pair, call);
  }
  return box;
}

function version(label, side, ctx) {
  const cell = document.createElement("div");
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = label;
  const text = document.createElement("p");
  text.textContent = side && side.t ? side.t : "";
  cell.append(kicker, text, renderCitations(side && side.s, ctx.sources, ctx.onCite));
  return cell;
}

function stepsBox(trophy, ctx) {
  const box = document.createElement("section");
  box.className = "steps";
  const title = document.createElement("h3");
  title.textContent = "How to earn it";
  const list = document.createElement("ol");
  for (const step of trophy.steps || []) {
    const item = document.createElement("li");
    item.append(document.createTextNode(step.t), renderCitations(step.s, ctx.sources, ctx.onCite));
    list.append(item);
  }
  box.append(title, list);
  return box;
}

function claimsBox(trophy, ctx) {
  const box = document.createElement("section");
  box.className = "claims";
  const title = document.createElement("h3");
  title.textContent = "Cited claims";
  const list = document.createElement("ul");
  for (const claim of trophy.claims || []) {
    const item = document.createElement("li");
    item.append(document.createTextNode(claim.t), renderCitations(claim.s, ctx.sources, ctx.onCite));
    list.append(item);
  }
  box.append(title, list);
  return box;
}

function badge(grade) {
  const node = document.createElement("span");
  node.className = `badge ${gradeLetter(grade).toLowerCase()}`;
  node.textContent = gradeLetter(grade);
  node.title = grade;
  return node;
}

function formatNum(value) {
  return Number(value).toLocaleString("en-US");
}
