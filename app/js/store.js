export const STORAGE_KEY = "quire.gta6.progress";

export function emptyProgress() {
  return { v: 1, earned: {}, counts: {}, shield: true, openId: null, revealed: {} };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return emptyProgress();
    return coerce(data);
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadOf(state)));
}

export function exportProgress(state) {
  const blob = new Blob([JSON.stringify(payloadOf(state), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "quire-gta6-progress.json";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function importProgress(text, trophies) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not JSON." };
  }
  const byId = new Map(trophies.map((t) => [t.id, t]));
  const byName = new Map(trophies.map((t) => [t.name, t]));
  if (Array.isArray(data)) return fromNameList(data, byName);
  if (!data || typeof data !== "object") return { ok: false, error: "Progress file must be a JSON object." };
  if (data.v != null && data.v !== 1) return { ok: false, error: "Unsupported progress version." };

  let earned = data.earned;
  if (Array.isArray(earned)) {
    const named = fromNameList(earned, byName);
    if (!named.ok) return named;
    earned = named.state.earned;
  }
  const earnedRead = readFlags(earned, byId, "earned");
  if (!earnedRead.ok) return earnedRead;
  const revealedRead = readFlags(data.revealed, byId, "revealed");
  if (!revealedRead.ok) return revealedRead;
  const countsRead = readCounts(data.counts, byId);
  if (!countsRead.ok) return countsRead;
  if (data.shield != null && typeof data.shield !== "boolean") {
    return { ok: false, error: "shield must be true or false." };
  }
  let openId = null;
  if (data.openId != null) {
    if (!Number.isInteger(data.openId) || !byId.has(data.openId)) {
      return { ok: false, error: "openId is not a known trophy." };
    }
    openId = data.openId;
  }
  return {
    ok: true,
    state: {
      v: 1,
      earned: earnedRead.map,
      counts: countsRead.map,
      shield: data.shield !== false,
      openId,
      revealed: revealedRead.map,
    },
  };
}

function payloadOf(state) {
  return {
    v: 1,
    earned: state.earned,
    counts: state.counts,
    shield: state.shield,
    openId: state.openId,
    revealed: state.revealed,
  };
}

function coerce(data) {
  const state = emptyProgress();
  state.shield = data.shield !== false;
  state.openId = Number.isInteger(data.openId) ? data.openId : null;
  if (data.earned && typeof data.earned === "object" && !Array.isArray(data.earned)) {
    for (const [key, value] of Object.entries(data.earned)) {
      const id = Number(key);
      if (Number.isInteger(id) && value) state.earned[id] = true;
    }
  }
  if (data.revealed && typeof data.revealed === "object" && !Array.isArray(data.revealed)) {
    for (const [key, value] of Object.entries(data.revealed)) {
      const id = Number(key);
      if (Number.isInteger(id) && value) state.revealed[id] = true;
    }
  }
  if (data.counts && typeof data.counts === "object" && !Array.isArray(data.counts)) {
    for (const [key, value] of Object.entries(data.counts)) {
      const id = Number(key);
      if (Number.isInteger(id) && typeof value === "number" && value >= 0) state.counts[id] = Math.floor(value);
    }
  }
  return state;
}

function readFlags(value, byId, label) {
  if (value == null) return { ok: true, map: {} };
  if (typeof value !== "object" || Array.isArray(value)) return { ok: false, error: label + " must be an object." };
  const map = {};
  for (const [key, flag] of Object.entries(value)) {
    if (!/^\d+$/.test(key) || !byId.has(Number(key))) return { ok: false, error: "Unknown trophy in " + label + "." };
    if (typeof flag !== "boolean") return { ok: false, error: label + " values must be true or false." };
    if (flag) map[Number(key)] = true;
  }
  return { ok: true, map };
}

function readCounts(value, byId) {
  if (value == null) return { ok: true, map: {} };
  if (typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "counts must be an object." };
  const map = {};
  for (const [key, n] of Object.entries(value)) {
    if (!/^\d+$/.test(key) || !byId.has(Number(key))) return { ok: false, error: "Unknown trophy in counts." };
    const trophy = byId.get(Number(key));
    if (trophy.count == null) return { ok: false, error: "That trophy has no PlayStation count." };
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
      return { ok: false, error: "counts must be whole numbers, zero or greater." };
    }
    if (n > trophy.count) return { ok: false, error: "A count is above the PlayStation total." };
    map[trophy.id] = n;
  }
  return { ok: true, map };
}

function fromNameList(list, byName) {
  if (!list.every((item) => typeof item === "string")) return { ok: false, error: "Earned list must be trophy names." };
  const earned = {};
  for (const name of list) {
    const trophy = byName.get(name);
    if (!trophy) return { ok: false, error: "Unknown trophy name in earned list." };
    earned[trophy.id] = true;
  }
  return { ok: true, state: { ...emptyProgress(), earned } };
}
