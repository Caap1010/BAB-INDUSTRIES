// predictions.js – renders cards on index, predictions, and match pages

function createBar(percent) {
  const wrap = document.createElement("div");
  wrap.className = "sp-bar-wrap";
  const fill = document.createElement("div");
  fill.className = "sp-bar-fill";
  fill.style.width = Math.max(0, Math.min(100, percent)) + "%";
  wrap.appendChild(fill);
  return wrap;
}

function createMarketRow(label, probability) {
  const row = document.createElement("div");
  row.className = "sp-market-row";

  const lab = document.createElement("div");
  lab.className = "sp-market-label";
  lab.textContent = label;

  const barWrap = createBar(probability);

  const perc = document.createElement("div");
  perc.className = "sp-perc";
  perc.textContent = probability + "%";

  row.appendChild(lab);
  row.appendChild(barWrap);
  row.appendChild(perc);
  return row;
}

function buildMatchCard(match) {
  const card = document.createElement("div");
  card.className = "sp-card";

  const header = document.createElement("div");
  header.className = "sp-card-header";

  const leagueTag = document.createElement("span");
  leagueTag.className = "sp-league-tag";
  leagueTag.textContent = match.league;

  const dt = document.createElement("span");
  dt.className = "sp-date-time";
  dt.textContent = `${match.date} • ${match.time}`;

  header.appendChild(leagueTag);
  header.appendChild(dt);

  const teams = document.createElement("div");
  teams.className = "sp-teams";
  teams.innerHTML = `<strong>${match.home} vs ${match.away}</strong>
    <span>${match.venue}</span>`;

  const bodyMarkets = document.createElement("div");

  const m1x2 =
    match.markets.find((m) => m.type === "1x2" && m.label.includes("Home Win")) ||
    match.markets.find((m) => m.type === "1x2");
  if (m1x2) {
    bodyMarkets.appendChild(createMarketRow(m1x2.label, m1x2.probability));
  }

  const mOver25 = match.markets.find(
    (m) => m.type === "goals" && m.label.toLowerCase().includes("over 2.5")
  );
  if (mOver25) {
    bodyMarkets.appendChild(createMarketRow(mOver25.label, mOver25.probability));
  }

  const mBTTS = match.markets.find(
    (m) => m.type === "goals" && m.label.toLowerCase().includes("btts")
  );
  if (mBTTS) {
    bodyMarkets.appendChild(createMarketRow(mBTTS.label, mBTTS.probability));
  }

  const footer = document.createElement("div");
  footer.className = "sp-card-footer";
  const more = document.createElement("a");
  more.className = "sp-link";
  more.href = `match.html?id=${encodeURIComponent(match.id)}`;
  more.textContent = "View details";

  const marketsCount = document.createElement("span");
  marketsCount.style.fontSize = "0.75rem";
  marketsCount.style.color = "#9ca3af";
  marketsCount.textContent = `${match.markets.length} markets`;

  footer.appendChild(more);
  footer.appendChild(marketsCount);

  card.appendChild(header);
  card.appendChild(teams);
  card.appendChild(bodyMarkets);
  card.appendChild(footer);

  return card;
}

function renderTodayMatches() {
  const container = document.getElementById("today-matches");
  if (!container) return;

  const todays = MATCHES.filter((m) => m.dayCategory === "today");
  container.innerHTML = "";
  todays.forEach((m) => {
    container.appendChild(buildMatchCard(m));
  });
}

function populateLeagueFilter() {
  const select = document.getElementById("filter-league");
  if (!select) return;
  const leagues = Array.from(new Set(MATCHES.map((m) => m.league)));
  leagues.forEach((lg) => {
    const opt = document.createElement("option");
    opt.value = lg;
    opt.textContent = lg;
    select.appendChild(opt);
  });
}

function renderAllMatches() {
  const container = document.getElementById("all-matches");
  if (!container) return;

  const daySelect = document.getElementById("filter-day");
  const leagueSelect = document.getElementById("filter-league");
  const marketSelect = document.getElementById("filter-market");

  const dayVal = daySelect ? daySelect.value : "all";
  const leagueVal = leagueSelect ? leagueSelect.value : "all";
  const marketVal = marketSelect ? marketSelect.value : "all";

  let list = [...MATCHES];

  if (dayVal !== "all") {
    list = list.filter((m) => m.dayCategory === dayVal);
  }
  if (leagueVal !== "all") {
    list = list.filter((m) => m.league === leagueVal);
  }

  container.innerHTML = "";
  list.forEach((m) => {
    const card = buildMatchCard(m);

    if (marketVal !== "all") {
      const hasMarket = m.markets.some((mk) => {
        if (marketVal === "1x2" && mk.type === "1x2") return true;
        if (marketVal === "goals" && mk.type === "goals") return true;
        if (marketVal === "corners" && mk.type === "corners") return true;
        if (marketVal === "cards" && mk.type === "cards") return true;
        return false;
      });
      if (!hasMarket) return;
    }

    container.appendChild(card);
  });
}

function renderMatchDetails() {
  const container = document.getElementById("match-details");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const match = MATCHES.find((m) => m.id === id) || MATCHES[0];

  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "sp-match-header";

  const teams = document.createElement("div");
  teams.className = "sp-match-teams";
  teams.textContent = `${match.home} vs ${match.away}`;

  const meta = document.createElement("div");
  meta.className = "sp-match-meta";
  meta.textContent = `${match.league} • ${match.date} • ${match.time} • ${match.venue}`;

  header.appendChild(teams);
  header.appendChild(meta);

  const cols = document.createElement("div");
  cols.className = "sp-cols";

  const boxMarkets = document.createElement("div");
  boxMarkets.className = "sp-box";
  boxMarkets.innerHTML = "<h3>Markets & Probabilities</h3>";

  match.markets.forEach((mk) => {
    boxMarkets.appendChild(
      createMarketRow(`${mk.label} – ${mk.selection}`, mk.probability)
    );
  });

  const boxStats = document.createElement("div");
  boxStats.className = "sp-box";
  boxStats.innerHTML = "<h3>Match Analysis</h3>";

  const ul = document.createElement("ul");
  ul.className = "sp-list";

  const s = match.stats;
  [
    ["Home form", s.homeForm],
    ["Away form", s.awayForm],
    ["Head to head", s.headToHead],
    ["Attack vs defence", s.attackVsDefence],
    ["Average goals", s.avgGoalsFor + " (for) / " + s.avgGoalsAgainst + " (against)"],
    ["Corners per game", s.avgCorners],
    ["Cards per game", s.avgCards],
    ["Momentum", s.momentum]
  ].forEach(([label, value]) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${label}:</strong> ${value}`;
    ul.appendChild(li);
  });

  boxStats.appendChild(ul);

  cols.appendChild(boxMarkets);
  cols.appendChild(boxStats);

  container.appendChild(header);
  container.appendChild(cols);
}

// Init on load
document.addEventListener("DOMContentLoaded", () => {
  renderTodayMatches();
  populateLeagueFilter();
  renderAllMatches();
  renderMatchDetails();

  const daySelect = document.getElementById("filter-day");
  const leagueSelect = document.getElementById("filter-league");
  const marketSelect = document.getElementById("filter-market");

  [daySelect, leagueSelect, marketSelect].forEach((sel) => {
    if (sel) {
      sel.addEventListener("change", renderAllMatches);
    }
  });
});