// ingest.js – handles custom text/file input to build TEAM_STATS and show summary
// Expected line format:
// league,date,homeTeam,awayTeam,homeGoals,awayGoals

window.TEAM_STATS = window.TEAM_STATS || {};

function resetTeamStats() {
  window.TEAM_STATS = {};
}

function addResultToStats(league, date, home, away, hg, ag) {
  const homeName = home.trim();
  const awayName = away.trim();
  const homeGoals = Number(hg);
  const awayGoals = Number(ag);

  if (!homeName || !awayName || isNaN(homeGoals) || isNaN(awayGoals)) return;

  const ensure = (team) => {
    if (!window.TEAM_STATS[team]) {
      window.TEAM_STATS[team] = {
        team,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0
      };
    }
    return window.TEAM_STATS[team];
  };

  const homeStats = ensure(homeName);
  const awayStats = ensure(awayName);

  homeStats.played++;
  awayStats.played++;

  homeStats.goalsFor += homeGoals;
  homeStats.goalsAgainst += awayGoals;

  awayStats.goalsFor += awayGoals;
  awayStats.goalsAgainst += homeGoals;

  if (homeGoals > awayGoals) {
    homeStats.wins++;
    awayStats.losses++;
  } else if (homeGoals < awayGoals) {
    awayStats.wins++;
    homeStats.losses++;
  } else {
    homeStats.draws++;
    awayStats.draws++;
  }
}

function processTextBlock(text) {
  resetTeamStats();

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  lines.forEach((line) => {
    const parts = line.split(",");
    if (parts.length < 6) return;
    const [league, date, home, away, hg, ag] = parts;
    addResultToStats(league, date, home, away, hg, ag);
  });

  renderStatsSummary();
}

function renderStatsSummary() {
  const container = document.getElementById("data-summary");
  if (!container) return;

  const teams = Object.values(window.TEAM_STATS);
  container.innerHTML = "";

  if (!teams.length) {
    container.textContent =
      "No valid results processed yet. Add text or upload a file in the required format.";
    return;
  }

  const title = document.createElement("h3");
  title.textContent = "Imported Team Form (from your data)";
  container.appendChild(title);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML =
    "<tr><th>Team</th><th>Played</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Form%</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  teams
    .sort((a, b) => b.played - a.played)
    .forEach((t) => {
      const row = document.createElement("tr");
      const points = t.wins * 3 + t.draws;
      const formPercent = t.played ? ((points / (t.played * 3)) * 100).toFixed(1) : "0.0";

      row.innerHTML = `
        <td>${t.team}</td>
        <td>${t.played}</td>
        <td>${t.wins}</td>
        <td>${t.draws}</td>
        <td>${t.losses}</td>
        <td>${t.goalsFor}</td>
        <td>${t.goalsAgainst}</td>
        <td>${formPercent}%</td>
      `;
      tbody.appendChild(row);
    });

  table.appendChild(tbody);
  container.appendChild(table);

  const note = document.createElement("p");
  note.style.fontSize = "0.75rem";
  note.style.color = "#9ca3af";
  note.style.marginTop = "4px";
  note.textContent =
    "These stats influence slip selection by boosting teams with better form.";
  container.appendChild(note);
}

document.addEventListener("DOMContentLoaded", () => {
  const textBtn = document.getElementById("process-text");
  const textArea = document.getElementById("custom-text");
  const fileInput = document.getElementById("custom-file");

  if (textBtn && textArea) {
    textBtn.addEventListener("click", () => {
      const text = textArea.value.trim();
      if (!text) {
        alert("Please paste some text first.");
        return;
      }
      processTextBlock(text);
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = String(evt.target.result || "");
        processTextBlock(content);
      };
      reader.readAsText(file);

      fileInput.value = "";
    });
  }
});