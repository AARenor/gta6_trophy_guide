import { gradeLetter } from "./filters.js";
import { concealedLabel, missableTag } from "./spoiler.js";

export function renderCitations(text) {
  const frag = document.createDocumentFragment();
  const re = /\[(\d+)\]/g;
  let last = 0;
  let match;
  while ((match = re.exec(text))) {
    if (match.index > last) frag.append(text.slice(last, match.index));
    frag.append(citeLink(match[1]));
    last = match.index + match[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}

export function renderGuide(root, trophy, ctx) {
  root.replaceChildren();
  if (!trophy) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Select a trophy.";
    root.append(empty);
    return;
  }
  if (ctx.concealed) {
    renderSealed(root, trophy);
    return;
  }
  root.append(head(trophy));
  root.append(officialBox(trophy.description));
  root.append(tagRow(trophy));
  if (trophy.count != null) root.append(counter(trophy, ctx.count || 0));
  if (trophy.window || (trophy.missable && trophy.missable !== "no")) root.append(windowBox(trophy));
  for (const dispute of trophy.disputes || []) root.append(differPanel(dispute, ctx.sourceById));
  root.append(stepsBlock(trophy));
  root.append(claimsBlock(trophy));
}

export function renderSealed(root, trophy) {
  const wrap = document.createElement("div");
  wrap.className = "sealed";
  const badge = gradeBadge(trophy.grade);
  const title = document.createElement("h2");
  title.textContent = concealedLabel(trophy);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "reveal";
  button.dataset.reveal = String(trophy.id);
  button.textContent = "Reveal this one";
  wrap.append(badge, title, button);
  root.append(wrap);
}

function head(trophy) {
  const row = document.createElement("div");
  row.className = "guide-head";
  const title = document.createElement("h2");
  title.textContent = trophy.name;
  row.append(gradeBadge(trophy.grade), title);
  return row;
}

function officialBox(description) {
  const box = document.createElement("blockquote");
  box.className = "official";
  const label = document.createElement("span");
  label.textContent = "Official description";
  const quote = document.createElement("p");
  quote.textContent = description;
  box.append(label, quote);
  return box;
}

function tagRow(trophy) {
  const row = document.createElement("div");
  row.className = "tag-row";
  for (const label of [trophy.chapter, "Stage " + trophy.stage, ...trophy.kinds]) {
    row.append(tag(label, "tag"));
  }
  const flag = missableTag(trophy.missable);
  if (flag) row.append(tag(flag, trophy.missable === "at-risk" ? "tag tag-risk" : "tag tag-miss"));
  return row;
}

function counter(trophy, count) {
  const box = document.createElement("div");
  box.className = "counter";
  const label = document.createElement("span");
  label.textContent = "Count";
  const minus = document.createElement("button");
  minus.type = "button";
  minus.dataset.count = "-1";
  minus.textContent = "−";
  minus.setAttribute("aria-label", "Decrease count");
  minus.disabled = count <= 0;
  const value = document.createElement("strong");
  value.textContent = String(count);
  const of = document.createElement("span");
  of.textContent = "/ " + trophy.count;
  const plus = document.createElement("button");
  plus.type = "button";
  plus.dataset.count = "1";
  plus.textContent = "+";
  plus.setAttribute("aria-label", "Increase count");
  plus.disabled = count >= trophy.count;
  box.append(label, minus, value, of, plus);
  return box;
}

function windowBox(trophy) {
  const box = document.createElement("section");
  box.className = "missable-window";
  const title = document.createElement("h3");
  title.textContent = "Missable window";
  const text = document.createElement("p");
  text.textContent = trophy.window || "Flagged " + trophy.missable + " in the file, with no window note stored.";
  box.append(title, text);
  return box;
}

function differPanel(dispute, sourceById) {
  const panel = document.createElement("section");
  panel.className = "sources-differ";
  const title = document.createElement("h3");
  title.textContent = "Sources differ";
  const question = document.createElement("p");
  question.className = "differ-q";
  question.textContent = dispute.q;
  panel.append(title, question, versionLine("Version A", dispute.a, sourceById), versionLine("Version B", dispute.b, sourceById));
  const call = document.createElement("p");
  call.className = "our-call";
  const label = document.createElement("b");
  label.textContent = "Our call. ";
  call.append(label, dispute.call || "");
  panel.append(call);
  return panel;
}

function versionLine(label, side, sourceById) {
  const p = document.createElement("p");
  p.className = "version";
  const strong = document.createElement("b");
  strong.textContent = label + siteSuffix(side && side.s, sourceById);
  p.append(strong, " " + ((side && side.t) || ""));
  p.append(document.createTextNode(" "));
  p.append(renderCitations(markers(side && side.s)));
  return p;
}

function siteSuffix(ids, sourceById) {
  if (!sourceById || !ids) return "";
  const names = [];
  for (const id of ids) {
    const source = sourceById.get(id);
    if (source && !names.includes(source.site)) names.push(source.site);
  }
  return names.length ? " · " + names.join(", ") : "";
}

function stepsBlock(trophy) {
  const section = document.createElement("section");
  const title = document.createElement("h3");
  title.textContent = "How to earn it";
  const list = document.createElement("ol");
  list.className = "steps";
  for (const step of trophy.steps || []) {
    const item = document.createElement("li");
    item.append(step.t);
    item.append(" ");
    item.append(renderCitations(markers(step.s)));
    list.append(item);
  }
  section.append(title, list);
  return section;
}

function claimsBlock(trophy) {
  const section = document.createElement("section");
  section.className = "claims";
  const title = document.createElement("h3");
  title.textContent = "Cited claims";
  const list = document.createElement("ul");
  for (const claim of trophy.claims || []) {
    const item = document.createElement("li");
    item.append(claim.t);
    item.append(" ");
    item.append(renderCitations(markers(claim.s)));
    list.append(item);
  }
  section.append(title, list);
  return section;
}

function gradeBadge(grade) {
  const badge = document.createElement("span");
  badge.className = "badge b-" + grade;
  badge.textContent = gradeLetter(grade);
  badge.title = grade;
  return badge;
}

function tag(text, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function citeLink(id) {
  const link = document.createElement("a");
  link.className = "cite";
  link.href = "#source-" + id;
  link.dataset.source = id;
  link.textContent = "[" + id + "]";
  return link;
}

function markers(ids) {
  return (ids || []).map((id) => "[" + id + "]").join("");
}
