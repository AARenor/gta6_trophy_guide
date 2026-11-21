export function computeAudit(trophies, sources) {
  const grades = new Set(["platinum", "gold", "silver", "bronze"]);
  const audit = {
    total: trophies.length,
    names: 0,
    descriptions: 0,
    gradeOk: 0,
    claims: 0,
    cited: 0,
    multi: 0,
    guides: 0,
    disputes: 0,
    disputesBoth: 0,
    missYes: 0,
    missPossibly: 0,
    missRisk: 0,
    pages: sources.length,
    sites: new Set(sources.map((source) => source.site)).size,
  };
  for (const trophy of trophies) {
    if (String(trophy.name || "").trim()) audit.names += 1;
    if (String(trophy.description || "").trim()) audit.descriptions += 1;
    if (grades.has(trophy.grade)) audit.gradeOk += 1;
    for (const claim of trophy.claims || []) {
      audit.claims += 1;
      const citedBy = claim.s || [];
      if (citedBy.length) audit.cited += 1;
      if (citedBy.length >= 2) audit.multi += 1;
    }
    const stepsCited = (trophy.steps || []).some((step) => (step.s || []).length);
    const claimsCited = (trophy.claims || []).some((claim) => (claim.s || []).length);
    const guideCited = typeof trophy.guide === "string" && /\[\d+\]/.test(trophy.guide);
    if (stepsCited || claimsCited || guideCited) audit.guides += 1;
    for (const dispute of trophy.disputes || []) {
      audit.disputes += 1;
      const left = dispute.a;
      const right = dispute.b;
      if (left && left.t && right && right.t && (left.s || []).length && (right.s || []).length) audit.disputesBoth += 1;
    }
    if (trophy.missable === "yes") audit.missYes += 1;
    else if (trophy.missable === "possibly") audit.missPossibly += 1;
    else if (trophy.missable === "at-risk") audit.missRisk += 1;
  }
  return audit;
}

export function renderAudit(root, audit) {
  const official = audit.names === audit.total && audit.descriptions === audit.total && audit.gradeOk === audit.total
    ? `${audit.total}/${audit.total}`
    : `${audit.names}/${audit.total} · ${audit.descriptions}/${audit.total} · ${audit.gradeOk}/${audit.total}`;
  const cards = [
    [official, "Names, descriptions, grades"],
    [`${audit.cited}/${audit.claims}`, "Claims cited"],
    [`${audit.multi}/${audit.claims}`, "Backed by 2+ sites"],
    [`${audit.guides}/${audit.total}`, "Guides cite sources"],
    [`${audit.pages} · ${audit.sites}`, "Pages read · sites"],
    [`${audit.disputesBoth}/${audit.disputes}`, "Disputes, both ways"],
    [`${audit.missPossibly + audit.missYes} · ${audit.missRisk}`, "Missable · at risk"],
  ];
  root.replaceChildren();
  for (const [value, label] of cards) {
    const card = document.createElement("article");
    card.className = "audit-card";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    card.append(strong, span);
    root.append(card);
  }
}

export function gradeTotals(trophies, earned) {
  const totals = { platinum: [0, 0], gold: [0, 0], silver: [0, 0], bronze: [0, 0] };
  for (const trophy of trophies) {
    if (!totals[trophy.grade]) continue;
    totals[trophy.grade][1] += 1;
    if (earned.has(trophy.name)) totals[trophy.grade][0] += 1;
  }
  return totals;
}
