export function claimsBySource(trophies) {
  const counts = new Map();
  const add = (ids) => {
    for (const id of ids || []) counts.set(id, (counts.get(id) || 0) + 1);
  };
  for (const trophy of trophies) {
    for (const claim of trophy.claims || []) add(claim.s);
    for (const step of trophy.steps || []) add(step.s);
    for (const dispute of trophy.disputes || []) {
      if (dispute.a) add(dispute.a.s);
      if (dispute.b) add(dispute.b.s);
    }
  }
  return counts;
}

export function sourcesForGuide(trophy, sources) {
  if (!trophy) return [];
  const counts = new Map();
  const add = (ids) => {
    for (const id of ids || []) counts.set(id, (counts.get(id) || 0) + 1);
  };
  for (const claim of trophy.claims || []) add(claim.s);
  for (const step of trophy.steps || []) add(step.s);
  for (const dispute of trophy.disputes || []) {
    if (dispute.a) add(dispute.a.s);
    if (dispute.b) add(dispute.b.s);
  }
  const byId = new Map(sources.map((source) => [source.id, source]));
  return [...counts.entries()]
    .map(([id, n]) => ({ source: byId.get(id), n }))
    .filter((row) => row.source)
    .sort((a, b) => b.n - a.n || a.source.id - b.source.id);
}

export function renderSources(root, sources, trophies) {
  root.replaceChildren();
  const counts = claimsBySource(trophies);
  const sites = new Set(sources.map((source) => source.site)).size;
  const head = document.createElement("header");
  head.className = "page-head";
  const title = document.createElement("h2");
  title.textContent = "Sources";
  const note = document.createElement("p");
  note.textContent = sources.length + " pages · " + sites + " sites. A link opens only when you follow it. Backs counts cited claims, steps, and dispute sides.";
  head.append(title, note);
  const table = document.createElement("table");
  table.className = "source-table";
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  for (const label of ["#", "Site", "Page", "Read", "Backs"]) {
    const th = document.createElement("th");
    th.textContent = label;
    hr.append(th);
  }
  thead.append(hr);
  const tbody = document.createElement("tbody");
  for (const source of sources.slice().sort((a, b) => a.id - b.id)) {
    const tr = document.createElement("tr");
    tr.id = "source-" + source.id;
    tr.append(cell(String(source.id)), cell(source.site), titleCell(source), cell(source.read), cell(String(counts.get(source.id) || 0)));
    tbody.append(tr);
  }
  table.append(thead, tbody);
  root.append(head, table);
}

export function renderGuideSources(root, trophy, sources, concealed) {
  root.replaceChildren();
  const title = document.createElement("h2");
  title.textContent = "Sources for this guide";
  root.append(title);
  if (!trophy || concealed) {
    const note = document.createElement("p");
    note.className = "side-note";
    note.textContent = concealed ? "Guide sources stay hidden with this story trophy." : "Open a trophy to see its sources.";
    root.append(note);
    return;
  }
  const rows = sourcesForGuide(trophy, sources);
  if (!rows.length) {
    const note = document.createElement("p");
    note.className = "side-note";
    note.textContent = "No cited source is stored for this guide.";
    root.append(note);
    return;
  }
  const list = document.createElement("ul");
  list.className = "source-side";
  for (const row of rows) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "cite";
    link.href = "#source-" + row.source.id;
    link.dataset.source = String(row.source.id);
    link.textContent = row.source.site;
    const meta = document.createElement("span");
    meta.className = "source-meta";
    meta.textContent = row.source.title + " · read " + row.source.read + " · backs " + row.n;
    item.append(link, meta);
    list.append(item);
  }
  root.append(list);
}

function titleCell(source) {
  const td = document.createElement("td");
  const link = document.createElement("a");
  if (typeof source.url === "string" && source.url.startsWith("https://")) {
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  link.textContent = source.title;
  td.append(link);
  return td;
}

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}
