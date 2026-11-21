export function spoilerShield(trophy, state) {
  if (!state || !state.shield) return false;
  if (!trophy.kinds || !trophy.kinds.includes("story")) return false;
  if (state.earned[trophy.id]) return false;
  if (state.revealed[trophy.id]) return false;
  return true;
}

export function concealedLabel(trophy) {
  return "Story trophy · " + trophy.chapter + " · hidden until earned";
}

export function missableTag(level) {
  if (level === "at-risk") return "AT RISK";
  if (level === "possibly" || level === "yes") return "MISSABLE";
  return "";
}
