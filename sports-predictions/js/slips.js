// slips.js – builds slips from MATCHES and optional TEAM_STATS (from ingest.js)

// TEAM_STATS is created by ingest.js if user imports data
window.TEAM_STATS = window.TEAM_STATS || {};

// Helper: compute a form score 0–1 from TEAM_STATS
function getFormScore(teamName) {
  const s = window.TEAM_STATS[teamName];
  if (!s || s.played === 0) return 0.5; // neutral
  const points = s.wins * 3 + s.draws;
  return points / (s.played * 3); // 0–1
}

// Compute a "score" for each selection:
// base probability + small adjustment based on form difference (if available)
function getSelectionScore(match, market) {
  let score = market.probability || 0;

  const homeForm = getFormScore(match.home);
  const awayForm = getFormScore(match.away);

  // Adjust only if we have any custom stats
  const hasStats =
    window.TEAM_STATS[match.home] || window.TEAM_STATS[match.away];
  if (!hasStats) return score;

  if (market.type === "1x2") {
    const label = market.label.toLowerCase();
    if (label.includes("home")) {
      score += (homeForm - awayForm) * 15;
    } else if (label.includes("away")) {
      score += (awayForm - homeForm) * 15;
    } else if (label.includes("double chance")) {
      // reward more when better team is included
      if (label.includes("1x")) {
        score += (homeForm - awayForm) * 10;
      } else if (label.includes("x2")) {
        score += (awayForm - homeForm) * 10;
      }
    }
  } else if (market.type === "goals") {
    // Use "attacking" form: both teams good form -> boost goals bets
    const avgForm = (homeForm + awayForm) / 2;
    if (market.label.toLowerCase().includes("over")) {
      score += (avgForm - 0.5) * 20;
    } else if (market.label.toLowerCase().includes("under")) {
      score -= (avgForm - 0.5) * 20;
    } else if (market.label.toLowerCase().includes("btts")) {
      score += (avgForm - 0.5) * 10;
    }
  }

  // Clamp
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return score;
}

function pickSelectionsByConfig(configKey) {
  const cfg = SLIP_CONFIG[configKey];
  if (!cfg) return [];

  const allMarkets = MATCHES.flatMap((m) =>
    m.markets.map((mk) => ({
      match: m,
      market: mk,
      score: getSelectionScore(m, mk)
    }))
  );

  const candidates = allMarkets
    .filter((x) => x.market.probability >= cfg.minProb)
    .sort((a, b) => b.score - a.score);

  return candidates.slice(0, cfg.maxSelections);
}

function marketFilterForKey(mk, typeKey) {
  const label = mk.label.toLowerCase();
  if (typeKey === "over25") {
    return mk.type === "goals" && label.includes("over 2.5");
  }
  if (typeKey === "btts") {
    return mk.type === "goals" && label.includes("btts");
  }
  if (typeKey === "corners") {
    return mk.type === "corners";
  }
  if (typeKey === "doubleChance") {
    return mk.type === "1x2" && label.includes("double");
  }
  return false;
}

function pickSelectionsByMarketType(typeKey, minProb) {
  const threshold = minProb || 60;

  const all = MATCHES.flatMap((m) =>
    m.markets
      .filter((mk) => marketFilterForKey(mk, typeKey) && mk.probability >= threshold)
      .map((mk) => ({
        match: m,
        market: mk,
        score: getSelectionScore(m, mk)
      }))
  );

  return all.sort((a, b) => b.score - a.score).slice(0, 6);
}

function confidenceTag(confidence) {
  const c = (confidence || "").toLowerCase();
  if (c === "high") return "high";
  if (c === "medium") return "medium";
  return "low";
}

function renderSlip(title, selections) {
  const output = document.getElementById("slip-output");
  if (!output) return;
  output.innerHTML = "";

  const heading = document.createElement("h3");
  heading.textContent = title;
  heading.style.fontSize = "0.95rem";
  heading.style.marginBottom = "6px";
  output.appendChild(heading);

  if (!selections.length) {
    const p = document.createElement("p");
    p.textContent = "No suitable selections found with the current thresholds.";
    p.style.fontSize = "0.8rem";
    p.style.color = "#9ca3af";
    output.appendChild(p);
    return;
  }

  selections.forEach(({ match, market }, index) => {
    const slip = document.createElement("div");
    slip.className = "sp-slip";

    const header = document.createElement("div");
    header.className = "sp-slip-header";

    const main = document.createElement("div");
    main.innerHTML = `<strong>${index + 1}. ${
      match.home
    } vs ${match.away}</strong><br/><span style="color:#9ca3af;font-size:0.75rem;">${
      match.league
    } • ${match.date} • ${match.time}</span>`;

    const tag = document.createElement("span");
    tag.className = "sp-tag " + confidenceTag(market.confidence);
    tag.textContent = `${market.confidence || "N/A"} • ${
      market.probability
    }%`;

    header.appendChild(main);
    header.appendChild(tag);

    const body = document.createElement("div");
    body.style.marginTop = "6px";
    body.innerHTML = `
      <div><strong>Market:</strong> ${market.label}</div>
      <div><strong>Selection:</strong> ${market.selection}</div>
      <div><strong>Reasoning:</strong> ${market.reasoning}</div>
    `;

    slip.appendChild(header);
    slip.appendChild(body);
    output.appendChild(slip);
  });

  const note = document.createElement("p");
  note.style.fontSize = "0.75rem";
  note.style.color = "#9ca3af";
  note.style.marginTop = "4px";
  note.textContent =
    "These probabilities and slips are for demo/testing only and are not financial advice.";
  output.appendChild(note);
}

// Event handlers
document.addEventListener("DOMContentLoaded", () => {
  const riskButtons = document.querySelectorAll(".sp-btn[data-type]");
  const marketButtons = document.querySelectorAll(".sp-btn-outline[data-market]");

  riskButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-type");
      const selections = pickSelectionsByConfig(type);
      const title =
        type === "safe"
          ? "Safe Slip (high probability selections, boosted by form)"
          : type === "medium"
          ? "Medium Slip (balanced risk, form‑aware)"
          : "High-Risk Jackpot Slip (aggressive picks)";
      renderSlip(title, selections);
    });
  });

  marketButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const marketKey = btn.getAttribute("data-market");
      const selections = pickSelectionsByMarketType(marketKey);
      let title = "Market Slip";
      if (marketKey === "over25") title = "Best Over 2.5 Goals Slip";
      if (marketKey === "btts") title = "Best BTTS Slip";
      if (marketKey === "corners") title = "Best Corners Slip";
      if (marketKey === "doubleChance") title = "Best Double Chance Slip";
      renderSlip(title, selections);
    });
  });
});