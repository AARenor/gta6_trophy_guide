import { spoilerShield, concealedLabel } from "./spoiler.js";

export const FILTERS = [
  { id: "all", label: "All" },
  { id: "story", label: "Story" },
  { id: "missable", label: "Missable" },
  { id: "collectibles", label: "Collectibles" },
  { id: "activities", label: "Activities" },
  { id: "side", label: "Side" },
  { id: "crime", label: "Crime" },
  { id: "hidden", label: "Hidden" },
  { id: "unearned", label: "Not earned" },
];

export const GRADES = ["platinum", "gold", "silver", "bronze"];

export function gradeLetter(grade) {
  if (grade === "platinum") return "P";
  if (grade === "gold") return "G";
  if (grade === "silver") return "S";
  if (grade === "bronze") return "B";
  return "?";
}

export function primaryKind(trophy) {
  const order = ["story", "collectibles", "activities", "side", "crime", "completion"];
  for (const kind of order) {
    if (trophy.kinds.includes(kind)) return kind;
  }
  return trophy.kinds[0] || "";
}

export function applyFilters(trophies, state) {
  const query = (state.query || "").trim().toLowerCase();
  return trophies.filter((trophy) => {
    if (!matchesKind(trophy, state.filter, state)) return false;
    if (state.grade && state.grade !== "all" && trophy.grade !== state.grade) return false;
    if (!query) return true;
    return haystack(trophy, state).includes(query);
  });
}

export function countByKind(trophies, state) {
  const counts = {};
  for (const filter of FILTERS) {
    counts[filter.id] = trophies.filter((trophy) => matchesKind(trophy, filter.id, state)).length;
  }
  counts.grades = {};
  for (const grade of GRADES) {
    counts.grades[grade] = trophies.filter((trophy) => trophy.grade === grade).length;
  }
  return counts;
}

function matchesKind(trophy, filterId, state) {
  if (filterId === "all" || !filterId) return true;
  if (filterId === "story") return trophy.kinds.includes("story");
  if (filterId === "missable") return trophy.missable !== "no" || trophy.kinds.includes("missable");
  if (filterId === "collectibles") return trophy.kinds.includes("collectibles");
  if (filterId === "activities") return trophy.kinds.includes("activities");
  if (filterId === "side") return trophy.kinds.includes("side");
  if (filterId === "crime") return trophy.kinds.includes("crime");
  if (filterId === "hidden") return trophy.hidden === true;
  if (filterId === "unearned") return !state.earned[trophy.id];
  return true;
}

function haystack(trophy, state) {
  if (spoilerShield(trophy, state)) return concealedLabel(trophy).toLowerCase();
  return [trophy.name, trophy.description, trophy.chapter, ...(trophy.kinds || [])].join(" ").toLowerCase();
}
