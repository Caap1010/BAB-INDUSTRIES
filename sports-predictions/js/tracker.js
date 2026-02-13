// tracker.js – allows marking predictions as Win/Loss/Push, tracks hit rate using localStorage

const STORAGE_KEY = "babSportsTracker";

function loadTrackerState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function saveTrackerState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Choose a "main prediction" per match:
// priority: Over 2.5 goals, then BTTS, then best 1X2
function getMainPrediction(match) {
    let candidate =
        match.markets.find(
            (m) => m.type === "goals" && m.label.toLowerCase().includes("over 2.5")
        ) || match.markets.find((m) => m.type === "goals" && m.label.toLowerCase().includes("btts"));

    if (!candidate) {
        // choose highest-probability 1x2
        const oneX2 = match.markets.filter((m) => m.type === "1x2");
        if (oneX2.length) {
            candidate = [...oneX2].sort((a, b) => b.probability - a.probability)[0];
        }
    }
    return candidate || match.markets[0];
}

function buildTrackerRow(match, mainMarket, state) {
    const tr = document.createElement("tr");

    const key = `${match.id}::${mainMarket.label}`;
    const stored = state[key] || { result: "pending" };

    const tdMatch = document.createElement("td");
    tdMatch.innerHTML = `<strong>${match.home} vs ${match.away}</strong>`;

    const tdMeta = document.createElement("td");
    tdMeta.innerHTML = `${match.league}<br/><span style="color:#9ca3af;font-size:0.75rem;">${match.date} • ${match.time}</span>`;

    const tdMarket = document.createElement("td");
    tdMarket.innerHTML = `<strong>${mainMarket.label}</strong><br/><span style="color:#9ca3af;font-size:0.75rem;">${mainMarket.selection}</span>`;

    const tdProb = document.createElement("td");
    tdProb.textContent = `${mainMarket.probability}%`;

    const tdResult = document.createElement("td");
    const select = document.createElement("select");
    select.className = "sp-tracker-select";

    [
        ["pending", "Pending"],
        ["win", "Win"],
        ["loss", "Loss"],
        ["push", "Push / Void"]
    ].forEach(([val, label]) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = label;
        if (stored.result === val) opt.selected = true;
        select.appendChild(opt);
    });

    select.addEventListener("change", () => {
        state[key] = { result: select.value };
        saveTrackerState(state);
        renderSummary(state);
    });

    tdResult.appendChild(select);

    tr.appendChild(tdMatch);
    tr.appendChild(tdMeta);
    tr.appendChild(tdMarket);
    tr.appendChild(tdProb);
    tr.appendChild(tdResult);

    return tr;
}

function renderSummary(state) {
    const container = document.getElementById("tracker-summary");
    if (!container) return;

    const values = Object.values(state);
    const counted = values.filter((v) => v.result && v.result !== "pending");

    const wins = counted.filter((v) => v.result === "win").length;
    const losses = counted.filter((v) => v.result === "loss").length;
    const pushes = counted.filter((v) => v.result === "push").length;
    const total = counted.length;
    const hitRate =
        total > 0 ? ((wins / total) * 100).toFixed(1) + "%" : "0.0%";

    container.innerHTML = `
    <p><strong>Total graded predictions:</strong> ${total}</p>
    <p><strong>Wins:</strong> ${wins} • <strong>Losses:</strong> ${losses} • <strong>Pushes:</strong> ${pushes}</p>
    <p><strong>Hit rate:</strong> <span>${hitRate}</span></p>
    <p style="font-size:0.75rem;color:#9ca3af;">
      This tracker only lives in your browser (localStorage). Clearing site data or changing device will reset it.
    </p>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.getElementById("tracker-body");
    if (!tbody) return;

    const state = loadTrackerState();

    MATCHES.forEach((match) => {
        const mainMarket = getMainPrediction(match);
        const row = buildTrackerRow(match, mainMarket, state);
        tbody.appendChild(row);
    });

    renderSummary(state);
});