export function computeAudit(trophies, sources) {
  const siteOf = new Map(sources.map((source) => [source.id, source.site]));
  let official = 0;
  let claims = 0;
  let cited = 0;
  let twoSites = 0;
  let guides = 0;
  let disputes = 0;
  let both = 0;
  const miss = { yes: 0, possibly: 0, "at-risk": 0, no: 0 };
  for (const trophy of trophies) {
    if (trophy.name && trophy.description && trophy.grade) official += 1;
    miss[trophy.missable] = (miss[trophy.missable] || 0) + 1;
    let guideCited = /\[\d+\]/.test(trophy.guide || "");
    for (const claim of trophy.claims || []) {
      claims += 1;
      const ids = claim.s || [];
      if (ids.length) cited += 1;
      const sites = new Set(ids.map((id) => siteOf.get(id)).filter(Boolean));
      if (sites.size >= 2) twoSites += 1;
      if (ids.length) guideCited = true;
    }
    for (const step of trophy.steps || []) {
      if ((step.s || []).length) guideCited = true;
    }
    if (guideCited) guides += 1;
    for (const dispute of trophy.disputes || []) {
      disputes += 1;
      if (dispute.a && dispute.a.t && dispute.b && dispute.b.t) both += 1;
    }
  }
  return {
    official,
    total: trophies.length,
    claims,
    cited,
    twoSites,
    guides,
    pages: sources.length,
    sites: new Set(sources.map((source) => source.site)).size,
    disputes,
    both,
    miss,
  };
}

export function renderAudit(root, audit) {
  root.replaceChildren();
  const cards = [
    [audit.official + "/" + audit.total, "Official names", "Names, descriptions and grades present"],
    [audit.cited + "/" + audit.claims, "Claims cited", "Claims with at least one source"],
    [audit.twoSites + "/" + audit.claims, "2+ sites", "Claims backed by two or more sites"],
    [audit.guides + "/" + audit.total, "Guides cited", "Guides that cite a source"],
    [audit.pages + " · " + audit.sites, "Pages · sites", "Pages read and distinct sites"],
    [audit.both + "/" + audit.disputes, "Disputes both ways", "Disputes that record both versions"],
    [audit.miss.possibly + " · " + audit.miss["at-risk"], "Possibly · at risk", "Missable flags that are not no"],
  ];
  cards.forEach(([value, label, title], index) => {
    const card = document.createElement("div");
    card.className = "stat" + (index === 6 ? " stat-miss" : "");
    card.title = title + ": " + value;
    const strong = document.createElement("b");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    card.append(strong, span);
    root.append(card);
  });
}
