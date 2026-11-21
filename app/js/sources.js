export function backingCounts(trophies) {
  const counts = new Map();
  const add = (ids) => {
    for (const id of ids || []) counts.set(id, (counts.get(id) || 0) + 1);
  };
  for (const trophy of trophies) {
    for (const claim of trophy.claims || []) add(claim.s);
    for (const step of trophy.steps || []) add(step.s);
    for (const dispute of trophy.disputes || []) {
      add(dispute.a && dispute.a.s);
      add(dispute.b && dispute.b.s);
    }
  }
  return counts;
}

export function guideBackings(trophy) {
  const counts = new Map();
  const add = (ids) => {
    for (const id of ids || []) counts.set(id, (counts.get(id) || 0) + 1);
  };
  for (const claim of trophy.claims || []) add(claim.s);
  for (const step of trophy.steps || []) add(step.s);
  for (const dispute of trophy.disputes || []) {
    add(dispute.a && dispute.a.s);
    add(dispute.b && dispute.b.s);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
}

export function renderSources(root, sources, counts, ctx) {
  root.replaceChildren();
  const head = document.createElement("header");
  head.className = "src-head";
  const title = document.createElement("h2");
  title.textContent = "Source matrix";
  const sites = new Set(sources.map((source) => source.site)).size;
  const note = document.createElement("p");
  note.textContent = `${sources.length} pages · ${sites} sites · a link opens only when you follow it`;
  head.append(title, note);
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const row = document.createElement("tr");
  for (const label of ["#", "Site", "Page", "Read", "Updated", "Backs", "Link"]) {
    const cell = document.createElement("th");
    cell.textContent = label;
    row.append(cell);
  }
  thead.append(row);
  const body = document.createElement("tbody");
  for (const source of sources) {
    const line = document.createElement("tr");
    line.id = `source-${source.id}`;
    const cells = [
      String(source.id),
      source.site,
      source.title,
      source.read || "—",
      source.updated || "—",
      String(counts.get(source.id) || 0),
    ];
    for (const value of cells) {
      const cell = document.createElement("td");
      cell.textContent = value;
      line.append(cell);
    }
    const linkCell = document.createElement("td");
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    link.textContent = "Open page";
    link.addEventListener("click", () => ctx.onFollow && ctx.onFollow(source));
    linkCell.append(link);
    line.append(linkCell);
    body.append(line);
  }
  table.append(thead, body);
  root.append(head, table);
}
