// GoddessEND — AMO Type Resistance Calculator
// Now with:
// - Base type totals (sum of W/R/N/X for each pure type defender)
// - Cup summaries (Meso/Alpha/Omega sums + delta vs base type)

// ===================== EMBEDDED MATRIX (optional) =====================
// Paste your full WRNX CSV (header + rows) between the backticks.
// Tabs/semicolons/commas are fine — parser auto-detects.
const EMBEDDED_MATRIX_CSV = `Attacker	Fire	Ice	Wind	Water	Earth	Poison	Celestial	Dark	Light	Thunder	Artisan	Totem	Spirit	Hero
Fire	R	W	W	R	N	N	R	W	R	N	R	W	N	N
Ice	R	R	N	W	W	N	R	N	W	N	N	W	N	N
Wind	N	N	R	W	W	N	R	N	N	R	N	W	N	N
Water	W	X	R	R	W	R	R	N	N	R	W	N	N	N
Earth	W	N	X	R	N	N	R	N	N	W	N	R	N	N
Poison	N	R	W	W	R	R	W	N	R	N	W	N	X	W
Celestial	N	N	N	N	R	W	W	R	R	W	N	R	N	N
Dark	R	N	N	N	R	N	N	R	W	R	W	N	W	W
Light	X	R	N	N	R	W	N	W	R	R	N	N	W	R
Thunder	N	N	W	W	X	N	R	W	N	R	N	R	N	N
Artisan	W	W	W	R	N	N	W	R	N	N	N	N	X	R
Totem	R	N	N	N	N	W	W	R	N	W	R	R	W	W
Spirit	N	N	N	N	R	N	N	R	W	N	N	W	W	R
Hero	N	W	N	N	N	R	W	W	R	N	N	R	R	N`; // ← your full Eon WRNX matrix here

// ========================= CSV utilities =========================
function detectDelimiter(firstLine) {
  const candidates = [",", ";", "\t"];
  let best = ",", bestCount = 0;
  for (const d of candidates) {
    const c = firstLine.split(d).length;
    if (c > bestCount) { best = d; bestCount = c; }
  }
  return best;
}
function stripBOM(s) { return (s || "").replace(/^\uFEFF/, ""); }
function parseCSV(text) {
  const raw = stripBOM(text || "").trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  const delim = detectDelimiter(lines[0] || ",");
  return lines.map((line) => line.split(delim).map((s) => stripBOM(s).trim()));
}
function toCSV(rows) {
  return rows.map((r) => r.map((v) => (v == null ? "" : String(v))).join(",")).join("\n");
}

// ========================= AMO rules =========================
const reactionScale = {
  "-100": "Immune", "-75": "Tanked", "-50": "Resist", "-25": "Ineffective",
  "0": "Neutral", "25": "Effective", "50": "Weak", "75": "Suffer", "100": "Obliterate",
};
const allowedSteps = Object.keys(reactionScale).map(Number).sort((a, b) => a - b);
function snapLabel(total) {
  let best = allowedSteps[0], bestd = Math.abs(total - best);
  for (const s of allowedSteps) {
    const d = Math.abs(total - s);
    if (d < bestd) { best = s; bestd = d; }
  }
  return reactionScale[String(best)];
}
function normalizeSecondary(sym) { return sym === "X" ? "R" : sym; }
function scoreOf(sym) { return sym === "W" ? 1 : sym === "R" ? -1 : 0; }
function totalToRate(total) { return total <= -100 ? 0.0 : +(1 + total / 100).toFixed(2); }

// ========================= Compute forms =========================
function computeForm(lookup, active, s1, s2, typesNorm, typesDisplay) {
  const rows = [];
  for (let i = 0; i < typesNorm.length; i++) {
    const atkKey = typesNorm[i], atkDisplay = typesDisplay[i];
    const m = (lookup[atkKey] && lookup[atkKey][active.toLowerCase()]) || "N";
    const a = normalizeSecondary((lookup[atkKey] && lookup[atkKey][s1.toLowerCase()]) || "N");
    const o = normalizeSecondary((lookup[atkKey] && lookup[atkKey][s2.toLowerCase()]) || "N");

    let total;
    if (m === "X" || (m === "R" && a === "R" && o === "R")) total = -100;
    else total = scoreOf(m) * 50 + scoreOf(a) * 25 + scoreOf(o) * 25;

    rows.push({ atk: atkDisplay, cups: `${m} ${a} ${o}`, total, reaction: snapLabel(total) });
  }
  return rows;
}

// ========================= Build main table =========================
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
  thead.appendChild(h1); thead.appendChild(h2); table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const badge = (reaction) => {
    const cls = {
      Immune: "rImmune", Tanked: "rTanked", Resist: "rResist", Ineffective: "rIneffective",
      Neutral: "rNeutral", Effective: "rEffective", Weak: "rWeak",
      Suffer: "rSuffer", Obliterate: "rObliterate",
    }[reaction] || "rNeutral";
    return `<span class="badge ${cls}">${reaction}</span>`;
  };

  for (let i = 0; i < meso.length; i++) {
    const tr = document.createElement("tr");
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

// ========================= CSV download =========================
function makeDownloadCSV(name, M, A, O, meso, alpha, omega) {
  const header = [
    "Attack", `${M} / ${A} / ${O}`, "Meso %", "Meso Reaction", "",
    `${A} / ${M} / ${O}`, "Alpha %", "Alpha Reaction", "",
    `${O} / ${M} / ${A}`, "Omega %", "Omega Reaction",
  ];
  const rows = [header];
  for (let i = 0; i < meso.length; i++) {
    rows.push([
      meso[i].atk, meso[i].cups, meso[i].total, meso[i].reaction, "",
      alpha[i].cups, alpha[i].total, alpha[i].reaction, "",
      omega[i].cups, omega[i].total, omega[i].reaction,
    ]);
  }
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${name || "Goddess"}_Triple_Form_Chart.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ========================= Base sums (pure types) =========================
// Compute baseline sum for each defender type (pure monotype).
// Uses the WRNX lookup + types list.
function computeBaseTypeSums(lookup, typesNorm, typesDisplay) {
  const map = {};
  // For each defender type (column)
  for (let j = 0; j < typesNorm.length; j++) {
    const defKey = typesNorm[j];      // lowercased defender
    const defName = typesDisplay[j];  // display name
    let sum = 0;
    // Sum over all attackers
    for (let i = 0; i < typesNorm.length; i++) {
      const atkKey = typesNorm[i];
      const sym = (lookup[atkKey] && lookup[atkKey][defKey]) || "N";
      let val = 0;
      if      (sym === "W")  val = 50;
      else if (sym === "R")  val = -50;
      else if (sym === "X")  val = -100;
      else                   val = 0;
      sum += val;
    }
    map[defName] = sum;
  }
  return map;
}

// Render a small panel listing base sums for all 14 types.
function renderBaseTypePanel(container, baseSums) {
  if (!baseSums) return;
  const box = document.createElement("div");
  box.className = "panel-mini";

  const title = document.createElement("h3");
  title.textContent = "Base Type Totals (pure monotype)";
  box.appendChild(title);

  const list = document.createElement("div");
  list.className = "basesums";

  const keys = Object.keys(baseSums);
  keys.forEach((k) => {
    const row = document.createElement("div");
    row.className = "basesums-row";
    row.innerHTML = `<span class="basesums-type">${k}</span><span class="basesums-val">${baseSums[k]}</span>`;
    list.appendChild(row);
  });

  box.appendChild(list);
  container.appendChild(box);
}

// Render a panel summarizing each Cup vs its base type.
function renderCupSummary(container, name, M, A, O, meso, alpha, omega, baseSums) {
  const box = document.createElement("div");
  box.className = "panel-mini";

  const title = document.createElement("h3");
  title.textContent = `Cup Summary for ${name || "Goddess"}`;
  box.appendChild(title);

  function sumTotals(rows) {
    return rows.reduce((acc, r) => acc + (r.total || 0), 0);
  }

  const mesoSum  = sumTotals(meso);
  const alphaSum = sumTotals(alpha);
  const omegaSum = sumTotals(omega);

  const mesoBase  = baseSums[M] ?? 0;
  const alphaBase = baseSums[A] ?? 0;
  const omegaBase = baseSums[O] ?? 0;

  const mesoDelta  = mesoSum  - mesoBase;
  const alphaDelta = alphaSum - alphaBase;
  const omegaDelta = omegaSum - omegaBase;

  const table = document.createElement("table");
  table.className = "cupsum-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Form</th>
        <th>Primary Type</th>
        <th>Cup Sum</th>
        <th>Base Sum</th>
        <th>Δ vs Base</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Meso</td>
        <td>${M}</td>
        <td>${mesoSum}</td>
        <td>${mesoBase}</td>
        <td>${mesoDelta}</td>
      </tr>
      <tr>
        <td>Alpha</td>
        <td>${A}</td>
        <td>${alphaSum}</td>
        <td>${alphaBase}</td>
        <td>${alphaDelta}</td>
      </tr>
      <tr>
        <td>Omega</td>
        <td>${O}</td>
        <td>${omegaSum}</td>
        <td>${omegaBase}</td>
        <td>${omegaDelta}</td>
      </tr>
    </tbody>
  `;
  box.appendChild(table);

  const note = document.createElement("p");
  note.className = "cupsum-note";
  note.textContent = "Negative Δ means this Cup is more defensively loaded than its pure type archetype. Positive Δ means more exposed.";
  box.appendChild(note);

  container.appendChild(box);
}

// ========================= App state / DOM =========================
let matrix = null;
let typesDisplay = [];
let typesNorm = [];
let lookup = null;
let baseTypeSums = null;

const matrixFile   = document.getElementById("matrixFile");
const useSample    = document.getElementById("useSample");
const statusEl     = document.getElementById("matrixStatus");
const goddessName  = document.getElementById("goddessName");
const mesoSel      = document.getElementById("mesoType");
const alphaSel     = document.getElementById("alphaType");
const omegaSel     = document.getElementById("omegaType");
const computeBtn   = document.getElementById("computeBtn");
const downloadBtn  = document.getElementById("downloadCsvBtn");
const results      = document.getElementById("results");
const err          = document.getElementById("error");
const rememberBtn  = document.getElementById("rememberMatrix");
const forgetBtn    = document.getElementById("forgetMatrix");

// ========================= Matrix handling =========================
function populateSelectors() {
  [mesoSel, alphaSel, omegaSel].forEach((sel) => {
    sel.innerHTML = "";
    typesDisplay.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t; opt.textContent = t;
      sel.appendChild(opt);
    });
  });
}
function buildLookup() {
  const headers = matrix[0].map((h) => stripBOM(String(h || "").trim()));
  const attackerIdx = headers.findIndex((h) => h.toLowerCase() === "attacker");
  if (attackerIdx !== 0) throw new Error(`First column must be "Attacker". Found "${headers[0] || ""}".`);
  typesDisplay = headers.slice(1);
  typesNorm = typesDisplay.map((t) => t.toLowerCase());
  const rows = matrix.slice(1);
  const map = {};
  rows.forEach((row) => {
    if (!row.length) return;
    const atkName = stripBOM(String(row[0] || "").trim());
    if (!atkName) return;
    const atkKey = atkName.toLowerCase();
    map[atkKey] = {};
    for (let i = 1; i < headers.length; i++) {
      const defKey = typesNorm[i - 1];
      const val = String(row[i] || "").trim().toUpperCase(); // W/R/N/X
      map[atkKey][defKey] = val || "N";
    }
  });
  lookup = map;
  // compute base type sums whenever we rebuild lookup
  baseTypeSums = computeBaseTypeSums(lookup, typesNorm, typesDisplay);
}
function loadCSVText(csvText) {
  matrix = parseCSV(csvText);
  if (!matrix || matrix.length < 2) throw new Error("CSV appears empty or missing rows.");
  buildLookup(); populateSelectors();
  statusEl.textContent = `Matrix loaded: ${typesDisplay.length} types, ${matrix.length - 1} rows.`;
  err.textContent = "";
}
function loadCSVFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try { loadCSVText(reader.result); }
    catch (e) { err.textContent = "Failed to parse CSV: " + e.message; statusEl.textContent = "No matrix loaded."; }
  };
  reader.readAsText(file);
}

// ========================= Local storage & init =========================
rememberBtn.addEventListener("click", () => {
  if (!matrix) { err.textContent = "Load a matrix first."; return; }
  localStorage.setItem("GE_matrix_csv", toCSV(matrix));
  statusEl.textContent = "Matrix stored locally (browser).";
});
forgetBtn.addEventListener("click", () => {
  localStorage.removeItem("GE_matrix_csv");
  statusEl.textContent = "Stored matrix cleared.";
});
(function init() {
  const saved = localStorage.getItem("GE_matrix_csv");
  if (saved) {
    try { loadCSVText(saved); return; } catch {}
  }
  if (EMBEDDED_MATRIX_CSV && EMBEDDED_MATRIX_CSV.trim().length > 0) {
    try { loadCSVText(EMBEDDED_MATRIX_CSV); statusEl.textContent = "Embedded matrix loaded."; return; }
    catch { statusEl.textContent = "Embedded matrix found but failed to parse. Please upload."; }
  } else {
    statusEl.textContent = "No matrix loaded. Upload a CSV or embed one in app.js.";
  }
})();

// ========================= UI bindings =========================
matrixFile.addEventListener("change", (e) => {
  if (e.target.files && e.target.files[0]) loadCSVFile(e.target.files[0]);
});
useSample.addEventListener("click", () => {
  matrix = [["Attacker","Fire","Ice","Wind","Water","Earth","Poison","Celestial","Dark","Light","Thunder","Artisan","Totem","Spirit","Hero"]];
  buildLookup(); populateSelectors();
  statusEl.textContent = "Sample header loaded. Please load your real WRNX matrix or embed it in app.js.";
});

computeBtn.addEventListener("click", () => {
  err.textContent = "";
  results.innerHTML = "";
  downloadBtn.disabled = true;

  if (!lookup) { err.textContent = "Load/Embed your WRNX matrix first."; return; }

  const name = goddessName.value.trim() || "Goddess";
  const M = mesoSel.value, A = alphaSel.value, O = omegaSel.value;
  if (!M || !A || !O) { err.textContent = "Select M/A/O types."; return; }

  const meso  = computeForm(lookup, M, A, O, typesNorm, typesDisplay);
  const alpha = computeForm(lookup, A, M, O, typesNorm, typesDisplay);
  const omega = computeForm(lookup, O, M, A, typesNorm, typesDisplay);

  const table = buildCombinedTable(M, A, O, meso, alpha, omega);
  results.appendChild(table);

  // Show base type sums under the table
  if (baseTypeSums) {
    renderBaseTypePanel(results, baseTypeSums);
    renderCupSummary(results, name, M, A, O, meso, alpha, omega, baseTypeSums);
  }

  downloadBtn.disabled = false;
  downloadBtn.onclick = () => makeDownloadCSV(name, M, A, O, meso, alpha, omega);
});
Add index.html
