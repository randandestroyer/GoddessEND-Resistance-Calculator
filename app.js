// GoddessEND — AMO Type Resistance Calculator
// In-browser CSV load (WRNX matrix) → M/A/O selection → triple-form table + CSV download

// ---------- CSV utils ----------
function parseCSV(text) {
  // Simple parser for our predictable WRNX format (no embedded commas/quotes)
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((s) => s.trim()));
}

function toCSV(rows) {
  return rows.map((r) => r.map((v) => (v == null ? "" : String(v))).join(",")).join("\n");
}

// ---------- AMO rules ----------
const reactionScale = {
  "-100": "Immune",
  "-75": "Tanked",
  "-50": "Resist",
  "-25": "Ineffective",
  "0": "Neutral",
  "25": "Effective",
  "50": "Weak",
  "75": "Suffer",
  "100": "Obliterate",
};
const allowedSteps = Object.keys(reactionScale).map(Number).sort((a, b) => a - b);

function snapLabel(total) {
  // Snap to closest canonical step
  let best = allowedSteps[0];
  let bestd = Math.abs(total - best);
  for (const s of allowedSteps) {
    const d = Math.abs(total - s);
    if (d < bestd) {
      best = s;
      bestd = d;
    }
  }
  return reactionScale[String(best)];
}

function normalizeSecondary(sym) {
  // Non-active X counts as Resist
  return sym === "X" ? "R" : sym;
}

function computeForm(lookup, active, s1, s2, types) {
  const rows = [];
  for (const atk of types) {
    const m = lookup[atk][active]; // active cup symbol
    const a = normalizeSecondary(lookup[atk][s1]); // secondary 1
    const o = normalizeSecondary(lookup[atk][s2]); // secondary 2

    let total;
    if (m === "X" || (m === "R" && a === "R" && o === "R")) {
      total = -100; // Active X or Triple-R => Immune
    } else {
      const score = { W: 1, R: -1, N: 0 };
      total = (score[m] || 0) * 50 + (score[a] || 0) * 25 + (score[o] || 0) * 25; // additive
    }

    rows.push({ atk, cups: `${m} ${a} ${o}`, total, reaction: snapLabel(total) });
  }
  return rows;
}

function buildCombinedTable(M, A, O, meso, alpha, omega) {
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const h1 = document.createElement("tr");
  h1.innerHTML = `
    <th class="attack" rowspan="2">Attack</th>
    <th colspan="3">${M} / ${A} / ${O}</th>
    <th class="sep"></th>
    <th colspan="3">${A} / ${M} / ${O}</th>
    <th class="sep"></th>
    <th colspan="3">${O} / ${M} / ${A}</th>
  `;
  const h2 = document.createElement("tr");
  h2.innerHTML = `
    <th>Cups</th><th>%</th><th>Reaction</th>
    <th class="sep"></th>
    <th>Cups</th><th>%</th><th>Reaction</th>
    <th class="sep"></th>
    <th>Cups</th><th>%</th><th>Reaction</th>
  `;
  thead.appendChild(h1);
  thead.appendChild(h2);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let i = 0; i < meso.length; i++) {
    const tr = document.createElement("tr");

    function badge(reaction) {
      const clsMap = {
        Immune: "rImmune",
        Tanked: "rTanked",
        Resist: "rResist",
        Ineffective: "rIneffective",
        Neutral: "rNeutral",
        Effective: "rEffective",
        Weak: "rWeak",
        Suffer: "rSuffer",
        Obliterate: "rObliterate",
      };
      const cls = clsMap[reaction] || "rNeutral";
      return `<span class="badge ${cls}">${reaction}</span>`;
    }

    tr.innerHTML = `
      <td class="attack"><span class="typepill">${meso[i].atk}</span></td>

      <td>${meso[i].cups}</td><td>${meso[i].total}</td><td>${badge(meso[i].reaction)}</td>
      <td class="sep"></td>
      <td>${alpha[i].cups}</td><td>${alpha[i].total}</td><td>${badge(alpha[i].reaction)}</td>
      <td class="sep"></td>
      <td>${omega[i].cups}</td><td>${omega[i].total}</td><td>${badge(omega[i].reaction)}</td>
    `;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

function makeDownloadCSV(name, M, A, O, meso, alpha, omega) {
  const header = [
    "Attack",
    `${M} / ${A} / ${O}`,
    "Meso %",
    "Meso Reaction",
    "",
    `${A} / ${M} / ${O}`,
    "Alpha %",
    "Alpha Reaction",
    "",
    `${O} / ${M} / ${A}`,
    "Omega %",
    "Omega Reaction",
  ];
  const rows = [header];
  for (let i = 0; i < meso.length; i++) {
    rows.push([
      meso[i].atk,
      meso[i].cups,
      meso[i].total,
      meso[i].reaction,
      "",
      alpha[i].cups,
      alpha[i].total,
      alpha[i].reaction,
      "",
      omega[i].cups,
      omega[i].total,
      omega[i].reaction,
    ]);
  }
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name || "Goddess"}_Triple_Form_Chart.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- App state ----------
let matrix = null; // 2D array
let types = [];
let lookup = null;

// ---------- DOM refs ----------
const matrixFile = document.getElementById("matrixFile");
const useSample = document.getElementById("useSample");
const statusEl = document.getElementById("matrixStatus");
const goddessName = document.getElementById("goddessName");
const mesoSel = document.getElementById("mesoType");
const alphaSel = document.getElementById("alphaType");
const omegaSel = document.getElementById("omegaType");
const computeBtn = document.getElementById("computeBtn");
const downloadBtn = document.getElementById("downloadCsvBtn");
const results = document.getElementById("results");
const err = document.getElementById("error");
const rememberBtn = document.getElementById("rememberMatrix");
const forgetBtn = document.getElementById("forgetMatrix");

// ---------- Matrix handling ----------
function populateSelectors() {
  [mesoSel, alphaSel, omegaSel].forEach((sel) => {
    sel.innerHTML = "";
    types.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      sel.appendChild(opt);
    });
  });
}

function buildLookup() {
  const headers = matrix[0];
  const attackerIdx = headers.indexOf("Attacker");
  if (attackerIdx !== 0) {
    throw new Error('First column must be "Attacker"');
  }
  types = headers.slice(1);
  const rows = matrix.slice(1);
  const map = {};
  rows.forEach((row) => {
    const atk = row[0];
    map[atk] = {};
    for (let i = 1; i < headers.length; i++) {
      const key = headers[i];
      map[atk][key] = (row[i] || "").toString().trim().toUpperCase(); // W/R/N/X
    }
  });
  lookup = map;
}

function loadCSVFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      matrix = parseCSV(reader.result);
      buildLookup();
      populateSelectors();
      statusEl.textContent = `Matrix loaded: ${types.length} types, ${matrix.length - 1} rows.`;
      err.textContent = "";
    } catch (e) {
      err.textContent = "Failed to parse CSV: " + e.message;
    }
  };
  reader.readAsText(file);
}

// ---------- Local storage ----------
rememberBtn.addEventListener("click", () => {
  if (!matrix) {
    err.textContent = "Load a matrix first.";
    return;
  }
  localStorage.setItem("GE_matrix_csv", toCSV(matrix));
  statusEl.textContent = "Matrix stored locally (browser).";
});

forgetBtn.addEventListener("click", () => {
  localStorage.removeItem("GE_matrix_csv");
  statusEl.textContent = "Stored matrix cleared.";
});

// Try to restore a remembered matrix on load
(function init() {
  const saved = localStorage.getItem("GE_matrix_csv");
  if (saved) {
    try {
      matrix = parseCSV(saved);
      buildLookup();
      populateSelectors();
      statusEl.textContent = `Restored matrix from local storage: ${types.length} types.`;
    } catch (e) {
      // ignore restoration errors
    }
  }
})();

// ---------- UI bindings ----------
matrixFile.addEventListener("change", (e) => {
  if (e.target.files && e.target.files[0]) loadCSVFile(e.target.files[0]);
});

useSample.addEventListener("click", () => {
  // Header-only sample to demonstrate expected structure (user must load real matrix)
  matrix = [
    [
      "Attacker",
      "Fire",
      "Ice",
      "Wind",
      "Water",
      "Earth",
      "Poison",
      "Celestial",
      "Dark",
      "Light",
      "Thunder",
      "Artisan",
      "Totem",
      "Spirit",
      "Hero",
    ],
  ];
  buildLookup();
  populateSelectors();
  statusEl.textContent = "Sample header loaded. Please load your real WRNX matrix.";
});

computeBtn.addEventListener("click", () => {
  err.textContent = "";
  results.innerHTML = "";
  downloadBtn.disabled = true;

  if (!lookup) {
    err.textContent = "Load your WRNX matrix first.";
    return;
  }
  const name = goddessName.value.trim() || "Goddess";
  const M = mesoSel.value;
  const A = alphaSel.value;
  const O = omegaSel.value;
  if (!M || !A || !O) {
    err.textContent = "Select M/A/O types.";
    return;
  }

  // Compute three forms using the matrix
  const typeList = types.slice(); // 14 types in header order
  const meso = computeForm(lookup, M, A, O, typeList);
  const alpha = computeForm(lookup, A, M, O, typeList);
  const omega = computeForm(lookup, O, M, A, typeList);

  // Render and enable CSV download
  const table = buildCombinedTable(M, A, O, meso, alpha, omega);
  results.appendChild(table);

  downloadBtn.disabled = false;
  downloadBtn.onclick = () => makeDownloadCSV(name, M, A, O, meso, alpha, omega);
});
Add input.html
