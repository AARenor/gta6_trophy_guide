export function saveProgress(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    earned: state.earned,
    counters: state.counters,
    shield: state.shield,
    open: state.open,
    revealed: state.revealed,
  }));
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return blankProgress();
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return blankProgress();
    return {
      earned: Array.isArray(data.earned) ? data.earned.filter((name) => typeof name === "string") : [],
      counters: data.counters && typeof data.counters === "object" && !Array.isArray(data.counters) ? data.counters : {},
      shield: data.shield !== false,
      open: Number.isInteger(data.open) ? data.open : null,
      revealed: Array.isArray(data.revealed) ? data.revealed.filter((id) => Number.isInteger(id)) : [],
    };
  } catch {
    return blankProgress();
  }
}

export function exportProgress(state) {
  const payload = {
    version: 1,
    app: "plate-clerk",
    earned: state.earned,
    counters: state.counters,
    shield: state.shield,
    open: state.open,
    revealed: state.revealed,
  };
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  link.download = "plate-clerk-progress.json";
  link.click();
  URL.revokeObjectURL(link.href);
  return payload;
}

export function importProgress(text, trophies) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (Array.isArray(data)) data = { earned: data };
  if (!data || typeof data !== "object") return { ok: false, error: "Expected a progress object." };
  const names = new Set(trophies.map((trophy) => trophy.name));
  const byId = new Map(trophies.map((trophy) => [trophy.id, trophy]));
  if (data.earned != null && !Array.isArray(data.earned)) {
    return { ok: false, error: "earned must be a list of official trophy names." };
  }
  const earned = [];
  const seen = new Set();
  for (const name of data.earned || []) {
    if (typeof name !== "string" || !names.has(name)) {
      return { ok: false, error: "Unknown trophy name in the earned list." };
    }
    if (!seen.has(name)) {
      seen.add(name);
      earned.push(name);
    }
  }
  if (data.counters != null && (typeof data.counters !== "object" || Array.isArray(data.counters))) {
    return { ok: false, error: "counters must be an object." };
  }
  const counters = {};
  for (const [key, value] of Object.entries(data.counters || {})) {
    const trophy = byId.get(Number(key));
    if (!trophy || typeof trophy.count !== "number") {
      return { ok: false, error: "A counter does not match a counted trophy." };
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > trophy.count) {
      return { ok: false, error: "A counter is outside its published range." };
    }
    counters[trophy.id] = Math.round(value);
  }
  if (data.shield != null && typeof data.shield !== "boolean") {
    return { ok: false, error: "shield must be true or false." };
  }
  let open = null;
  if (data.open != null) {
    if (!byId.has(Number(data.open))) return { ok: false, error: "The open trophy is not on this list." };
    open = Number(data.open);
  }
  const revealed = [];
  if (data.revealed != null) {
    if (!Array.isArray(data.revealed)) return { ok: false, error: "revealed must be a list of trophy ids." };
    for (const id of data.revealed) {
      if (!byId.has(id)) return { ok: false, error: "A revealed id is not on this list." };
      revealed.push(id);
    }
  }
  return {
    ok: true,
    state: {
      earned,
      counters,
      shield: data.shield !== false,
      open,
      revealed,
    },
  };
}

const STORAGE_KEY = "plate-clerk-v1";

function blankProgress() {
  return { earned: [], counters: {}, shield: true, open: null, revealed: [] };
}
