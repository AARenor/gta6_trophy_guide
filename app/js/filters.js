export const FILTERS = [
  ["all", "All"],
  ["story", "Story"],
  ["missable", "Missable"],
  ["collectibles", "Collectibles"],
  ["activities", "Activities"],
  ["side", "Side"],
  ["crime", "Crime"],
  ["hidden", "Hidden"],
  ["remaining", "Not earned"],
];

export const GRADES = ["platinum", "gold", "silver", "bronze"];

export function applyFilters(trophies, { kind, query, earned, textOf }) {
  const needle = (query || "").trim().toLowerCase();
  return trophies.filter((trophy) => {
    if (!matchesKind(trophy, kind, earned)) return false;
    if (!needle) return true;
    return textOf(trophy).toLowerCase().includes(needle);
  });
}

export function countByKind(trophies, earned) {
  const counts = {};
  for (const [key] of FILTERS) counts[key] = trophies.filter((trophy) => matchesKind(trophy, key, earned)).length;
  for (const grade of GRADES) counts[grade] = trophies.filter((trophy) => trophy.grade === grade).length;
  return counts;
}

export function gradeLetter(grade) {
  if (grade === "platinum") return "P";
  if (grade === "gold") return "G";
  if (grade === "silver") return "S";
  if (grade === "bronze") return "B";
  return "?";
}

export function matchesKind(trophy, kind, earned) {
  const kinds = trophy.kinds || [];
  if (!kind || kind === "all") return true;
  if (kind === "story") return kinds.includes("story");
  if (kind === "missable") return isMissable(trophy);
  if (kind === "collectibles") return kinds.includes("collectibles");
  if (kind === "activities") return kinds.includes("activities");
  if (kind === "side") return kinds.includes("side");
  if (kind === "crime") return kinds.includes("crime");
  if (kind === "hidden") return trophy.hidden === true;
  if (kind === "remaining") return !earned.has(trophy.name);
  if (GRADES.includes(kind)) return trophy.grade === kind;
  return true;
}

function isMissable(trophy) {
  return trophy.missable === "yes" || trophy.missable === "possibly" || trophy.missable === "at-risk" || (trophy.kinds || []).includes("missable");
}
