import { gradeLetter } from "./filters.js";
import { missableTag } from "./spoiler.js";
import { renderCitations } from "./guide.js";

export function renderMissables(root, trophies, ctx) {
  const flagged = trophies.filter((trophy) => missableTag(trophy));
  const rest = trophies.length - flagged.length;
  const cites = availabilityCites(trophies);
  root.replaceChildren();
  const head = document.createElement("header");
  head.className = "miss-head";
  const title = document.createElement("h2");
  title.textContent = "Missable windows";
  const tally = document.createElement("p");
  tally.className = "tally";
  const yes = flagged.filter((trophy) => trophy.missable === "yes").length;
  const possibly = flagged.filter((trophy) => trophy.missable === "possibly").length;
  const risk = flagged.filter((trophy) => trophy.missable === "at-risk").length;
  tally.textContent = `${yes} confirmed yes · ${possibly} possibly · ${risk} at risk · ${rest} not flagged`;
  head.append(title, tally);
  root.append(head, rail(flagged), cards(flagged, ctx), availability(rest, cites, ctx));
}

function rail(flagged) {
  const row = document.createElement("ol");
  row.className = "rail";
  const chapters = [1, 2, 3, 4, 5];
  for (const number of chapters) {
    const item = document.createElement("li");
    const hits = flagged.filter((trophy) => new RegExp(`Chapter ${number}`).test(trophy.window || ""));
    item.className = hits.length ? "hot" : "";
    const label = document.createElement("strong");
    label.textContent = `Chapter ${number}`;
    item.append(label);
    if (!hits.length) {
      const clear = document.createElement("span");
      clear.textContent = "No window closes";
      item.append(clear);
    }
    for (const trophy of hits) {
      const name = document.createElement("span");
      name.textContent = `${trophy.name} · ${trophy.missable}`;
      item.append(name);
    }
    row.append(item);
  }
  const after = document.createElement("li");
  const label = document.createElement("strong");
  label.textContent = "After credits";
  const note = document.createElement("span");
  note.textContent = "Rest stay available";
  after.append(label, note);
  row.append(after);
  return row;
}

function cards(flagged, ctx) {
  const wrap = document.createElement("div");
  wrap.className = "miss-cards";
  for (const trophy of flagged) wrap.append(card(trophy, ctx));
  return wrap;
}

function card(trophy, ctx) {
  const node = document.createElement("article");
  node.className = "window-card";
  const head = document.createElement("header");
  const badge = document.createElement("span");
  badge.className = `badge ${gradeLetter(trophy.grade).toLowerCase()}`;
  badge.textContent = gradeLetter(trophy.grade);
  const title = document.createElement("h3");
  title.textContent = trophy.name;
  const flag = document.createElement("span");
  flag.className = trophy.missable === "at-risk" ? "flag risk" : "flag miss";
  flag.textContent = missableTag(trophy);
  head.append(badge, title, flag);
  const official = document.createElement("blockquote");
  official.className = "official";
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = "Official description";
  const desc = document.createElement("p");
  desc.textContent = trophy.description;
  official.append(kicker, desc);
  const window = document.createElement("p");
  window.className = "window-copy";
  window.textContent = trophy.window || "";
  const act = document.createElement("p");
  act.className = "act";
  const chapter = /Chapter \d+/.exec(trophy.window || "");
  act.textContent = `Act before ${chapter ? chapter[0] + " ends" : "the window closes"}${trophy.missions && trophy.missions.length ? ` · ${trophy.missions.join(", ")}` : ""}`;
  const box = document.createElement("label");
  box.className = "earn-line";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = ctx.state.earned.includes(trophy.name);
  input.addEventListener("change", () => ctx.onToggle(trophy, input.checked));
  box.append(input, document.createTextNode(input.checked ? " Earned" : " Not earned yet"));
  const cites = renderCitations(stepCites(trophy), ctx.sources, ctx.onCite);
  node.append(head, official, window, act, box, cites);
  return node;
}

function availability(rest, cites, ctx) {
  const note = document.createElement("p");
  note.className = "still";
  note.append(document.createTextNode(`The other ${rest} are not flagged. Sources that discuss the checklist say nothing on it is missable and that free roam continues after the story, so those stay available once the credits roll. `));
  note.append(renderCitations(cites, ctx.sources, ctx.onCite));
  return note;
}

function availabilityCites(trophies) {
  const ids = [];
  for (const trophy of trophies) {
    for (const claim of trophy.claims || []) {
      if (/nothing on the checklist is missable|free roam continues|free roam after/i.test(claim.t || "")) {
        ids.push(...(claim.s || []));
      }
    }
  }
  return [...new Set(ids)];
}

function stepCites(trophy) {
  const ids = [];
  for (const step of trophy.steps || []) ids.push(...(step.s || []));
  for (const dispute of trophy.disputes || []) {
    ids.push(...((dispute.a && dispute.a.s) || []), ...((dispute.b && dispute.b.s) || []));
  }
  return [...new Set(ids)];
}
