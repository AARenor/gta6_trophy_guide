import { gradeLetter } from "./filters.js";
import { renderCitations } from "./guide.js";
import { windowChapter } from "./roadmap.js";

export function renderMissables(root, trophies) {
  root.replaceChildren();
  const flagged = trophies
    .filter((trophy) => trophy.missable === "yes" || trophy.missable === "possibly" || trophy.missable === "at-risk")
    .slice()
    .sort((a, b) => chapterRank(windowChapter(a)) - chapterRank(windowChapter(b)) || a.id - b.id);
  const head = document.createElement("header");
  head.className = "page-head";
  const title = document.createElement("h2");
  title.textContent = "Missables";
  const note = document.createElement("p");
  note.textContent = flagged.length + " trophies are stored as yes, possibly, or at-risk. Act before the window in the file closes.";
  head.append(title, note);
  const grid = document.createElement("div");
  grid.className = "miss-grid";
  for (const trophy of flagged) grid.append(card(trophy));
  root.append(head, grid, remainder(trophies, flagged.length));
}

function card(trophy) {
  const article = document.createElement("article");
  article.className = "miss-card";
  const top = document.createElement("div");
  top.className = "guide-head";
  const badge = document.createElement("span");
  badge.className = "badge b-" + trophy.grade;
  badge.textContent = gradeLetter(trophy.grade);
  const name = document.createElement("h3");
  name.textContent = trophy.name;
  const flag = document.createElement("span");
  flag.className = trophy.missable === "at-risk" ? "tag tag-risk" : "tag tag-miss";
  flag.textContent = trophy.missable === "at-risk" ? "AT RISK" : "MISSABLE";
  top.append(badge, name, flag);
  const official = document.createElement("blockquote");
  official.className = "official";
  const label = document.createElement("span");
  label.textContent = "Official description";
  const quote = document.createElement("p");
  quote.textContent = trophy.description;
  official.append(label, quote);
  const act = document.createElement("p");
  act.className = "act-before";
  act.textContent = "Act before: " + actBefore(trophy);
  const box = document.createElement("section");
  box.className = "missable-window";
  const heading = document.createElement("h3");
  heading.textContent = "Missable window";
  const text = document.createElement("p");
  text.textContent = trophy.window || "No window note is stored.";
  box.append(heading, text);
  article.append(top, official, act, box);
  if (trophy.missions && trophy.missions.length && trophy.chapter !== "Any time") {
    const missions = document.createElement("p");
    missions.className = "missions";
    missions.textContent = "Missions in the file: " + trophy.missions.join(", ");
    article.append(missions);
  }
  return article;
}

function remainder(trophies, flaggedCount) {
  const aside = document.createElement("aside");
  aside.className = "remain";
  const title = document.createElement("h3");
  title.textContent = "After the story";
  const line = document.createElement("p");
  const rest = trophies.length - flaggedCount;
  line.textContent = "The other " + rest + " trophies are stored as missable: no. Where the sources say work remains after the story, it is cited below.";
  aside.append(title, line);
  const list = document.createElement("ul");
  for (const trophy of trophies) {
    for (const claim of trophy.claims || []) {
      if (!/remain after the story|remains after the story|after the credits the game returns|stays available after the credits/i.test(claim.t)) continue;
      const item = document.createElement("li");
      item.append(claim.t);
      item.append(" ");
      item.append(renderCitations((claim.s || []).map((id) => "[" + id + "]").join("")));
      list.append(item);
    }
  }
  aside.append(list);
  return aside;
}

function actBefore(trophy) {
  const chapter = windowChapter(trophy);
  if (/^Chapter \d+$/.test(trophy.chapter) && trophy.missions && trophy.missions.length) {
    return chapter + " · " + trophy.missions.join(", ");
  }
  return chapter;
}

function chapterRank(chapter) {
  const match = /^Chapter (\d+)$/.exec(chapter || "");
  if (match) return Number(match[1]);
  return 80;
}
