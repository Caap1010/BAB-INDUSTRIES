// imagePredictor.js
// Allows uploading fixture images, selecting the match, and showing predictions & stats.
// NOTE: This does NOT read text from the image. You manually pick the match from the list.

function createMatchOptionsSelect() {
  const select = document.createElement("select");
  select.innerHTML = "";

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "Select match for this image...";
  select.appendChild(defaultOpt);

  MATCHES.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.league} • ${m.home} vs ${m.away} (${m.date})`;
    select.appendChild(opt);
  });

  return select;
}

function renderImagePrediction(match, container) {
  container.innerHTML = "";

  if (!match) {
    const p = document.createElement("p");
    p.textContent = "No match selected yet.";
    p.style.color = "#9ca3af";
    p.style.fontSize = "0.75rem";
    container.appendChild(p);
    return;
  }

  const title = document.createElement("div");
  title.style.fontWeight = "600";
  title.style.fontSize = "0.8rem";
  title.textContent = "Predictions & Analysis";

  const meta = document.createElement("div");
  meta.style.fontSize = "0.75rem";
  meta.style.color = "#9ca3af";
  meta.textContent = `${match.league} • ${match.date} • ${match.time}`;

  const marketsBlock = document.createElement("div");
  marketsBlock.style.marginTop = "4px";

  const keyMarkets = ["1x2", "goals", "corners", "cards"];

  keyMarkets.forEach((type) => {
    const mk = match.markets.find((m) => m.type === type);
    if (!mk) return;
    const line = document.createElement("div");
    line.style.marginBottom = "2px";
    line.innerHTML = `<strong>${mk.label}</strong> – ${mk.selection} 
      <span style="color:#22c55e;">(${mk.probability}% • ${mk.confidence})</span>`;
    marketsBlock.appendChild(line);
  });

  const statBlock = document.createElement("div");
  statBlock.style.marginTop = "4px";
  statBlock.style.fontSize = "0.75rem";
  statBlock.style.color = "#cbd5e1";

  const s = match.stats;
  statBlock.innerHTML = `
    <div><strong>Home form:</strong> ${s.homeForm}</div>
    <div><strong>Away form:</strong> ${s.awayForm}</div>
    <div><strong>Head-to-head:</strong> ${s.headToHead}</div>
    <div><strong>Attack vs defence:</strong> ${s.attackVsDefence}</div>
    <div><strong>Avg goals:</strong> ${s.avgGoalsFor} (for) / ${s.avgGoalsAgainst} (against)</div>
    <div><strong>Corners per game:</strong> ${s.avgCorners}</div>
    <div><strong>Cards per game:</strong> ${s.avgCards}</div>
    <div><strong>Momentum:</strong> ${s.momentum}</div>
  `;

  container.appendChild(title);
  container.appendChild(meta);
  container.appendChild(marketsBlock);
  container.appendChild(statBlock);
}

function handleImageUpload(files) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  Array.from(files).forEach((file) => {
    const card = document.createElement("div");
    card.className = "sp-image-card";

    const img = document.createElement("img");
    img.className = "sp-image-preview";
    img.src = URL.createObjectURL(file);
    img.alt = file.name;

    const meta = document.createElement("div");
    meta.className = "sp-image-meta";

    const nameLine = document.createElement("div");
    nameLine.style.fontSize = "0.78rem";
    nameLine.style.color = "#cbd5e1";
    nameLine.textContent = file.name;

    const selectLabel = document.createElement("div");
    selectLabel.style.fontSize = "0.75rem";
    selectLabel.style.color = "#9ca3af";
    selectLabel.textContent = "Match for this image:";

    const select = createMatchOptionsSelect();

    const predictionContainer = document.createElement("div");
    predictionContainer.className = "sp-image-predictions";

    select.addEventListener("change", () => {
      const matchId = select.value;
      const match = MATCHES.find((m) => m.id === matchId);
      renderImagePrediction(match, predictionContainer);
    });

    meta.appendChild(nameLine);
    meta.appendChild(selectLabel);
    meta.appendChild(select);

    card.appendChild(img);
    card.appendChild(meta);
    card.appendChild(predictionContainer);

    gallery.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fixture-images");
  if (!fileInput) return;

  fileInput.addEventListener("change", (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleImageUpload(files);
      fileInput.value = ""; // allow re-upload of same file names if needed
    }
  });
});