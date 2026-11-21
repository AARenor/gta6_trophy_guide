export function spoilerShield(trophy, state) {
  if (!state.shield) return false;
  if (!(trophy.kinds || []).includes("story")) return false;
  if (state.earned.includes(trophy.name)) return false;
  if ((state.revealed || []).includes(trophy.id)) return false;
  return true;
}

export function hiddenLabel(trophy) {
  const chapter = typeof trophy.chapter === "string" && trophy.chapter.startsWith("Chapter") ? trophy.chapter : "Chapter ?";
  return `Story trophy · ${chapter} · hidden until earned`;
}

export function missableTag(trophy) {
  if (trophy.missable === "at-risk") return "AT RISK";
  if (trophy.missable === "yes" || trophy.missable === "possibly" || (trophy.kinds || []).includes("missable")) return "MISSABLE";
  return "";
}
