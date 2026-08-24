import { PLAYERS, GAMES } from "./data.js";

// P, C, 1B, 2B, 3B, SS, LF, CF, RF, DH, UTIL, JC (jugador de cortesía,
// solo batea) y JD (jugador designado, batea y eventualmente entra al campo).
const POSITION_OPTIONS = ["", "P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "UTIL", "JC", "JD"];

const BATTING_FIELDS = [
  { key: "playerId", label: "Jugador", type: "player" },
  { key: "order", label: "Orden", type: "number" },
  { key: "position", label: "Pos", full: "Posición", type: "select", options: POSITION_OPTIONS },
  { key: "AB", label: "AB", full: "Turnos al bat", type: "number" },
  { key: "H", label: "H", full: "Hits", type: "number" },
  { key: "2B", label: "2B", full: "Dobles", type: "number" },
  { key: "3B", label: "3B", full: "Triples", type: "number" },
  { key: "HR", label: "HR", full: "Home runs", type: "number" },
  { key: "HRC", label: "HRC", full: "Home runs de campo", type: "number" },
  { key: "RBI", label: "RBI", full: "Impulsadas", type: "number" },
  { key: "R", label: "R", full: "Carreras", type: "number" },
  { key: "BB", label: "BB", full: "Bases por bolas", type: "number" },
  { key: "SO", label: "SO", full: "Ponches", type: "number" },
  { key: "SB", label: "SB", full: "Bases robadas", type: "number" },
];

const PITCHING_FIELDS = [
  { key: "playerId", label: "Jugador", type: "player" },
  { key: "IP", label: "IP", full: "Entradas lanzadas", type: "number", step: "0.1" },
  { key: "H", label: "H", full: "Hits permitidos", type: "number" },
  { key: "R", label: "R", full: "Carreras permitidas", type: "number" },
  { key: "ER", label: "ER", full: "Carreras limpias", type: "number" },
  { key: "BB", label: "BB", full: "Bases por bolas", type: "number" },
  { key: "SO", label: "SO", full: "Ponches", type: "number" },
  { key: "HR", label: "HR", full: "Home runs permitidos", type: "number" },
  { key: "decision", label: "Decisión", type: "select", options: ["", "W", "L", "SV"] },
];

const FIELDING_FIELDS = [
  { key: "playerId", label: "Jugador", type: "player" },
  { key: "PO", label: "PO", full: "Outs realizados", type: "number" },
  { key: "A", label: "A", full: "Asistencias", type: "number" },
  { key: "E", label: "E", full: "Errores", type: "number" },
];

const SUBSTITUTION_FIELDS = [
  { key: "inning", label: "Entrada", type: "number" },
  { key: "type", label: "Tipo", type: "select", options: ["bateo", "campo"] },
  { key: "playerOut", label: "Sale", type: "player" },
  { key: "playerIn", label: "Entra", type: "player" },
  { key: "position", label: "Pos", full: "Solo si es cambio de campo", type: "select", options: POSITION_OPTIONS },
];

function playerOptionsHtml() {
  return (
    `<option value="">—</option>` +
    PLAYERS.map((p) => `<option value="${p.id}">#${p.number ?? "-"} ${p.name}</option>`).join("")
  );
}

function createRowsEditor(container, fields) {
  const wrap = document.createElement("div");
  wrap.className = "rows-table-wrap";
  const table = document.createElement("table");
  table.className = "rows-table";
  table.innerHTML = `<thead><tr>${fields
    .map(
      (f) =>
        `<th><span class="th-abbr">${f.label}</span>${f.full ? `<span class="th-full">${f.full}</span>` : ""}</th>`
    )
    .join("")}<th></th></tr></thead>`;
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  wrap.appendChild(table);
  container.appendChild(wrap);

  function addRow(values = {}) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      fields
        .map((f) => {
          if (f.type === "player") {
            return `<td><select data-key="${f.key}">${playerOptionsHtml()}</select></td>`;
          }
          if (f.type === "select") {
            const opts = f.options.map((o) => `<option value="${o}">${o || "—"}</option>`).join("");
            return `<td><select data-key="${f.key}">${opts}</select></td>`;
          }
          const numAttrs = f.type === "number" ? `step="${f.step ?? "1"}"` : "";
          return `<td><input data-key="${f.key}" type="${f.type}" ${numAttrs} /></td>`;
        })
        .join("") + `<td><button type="button" class="remove-row-btn" title="Quitar"><i class="fa-solid fa-xmark"></i></button></td>`;
    tr.querySelector(".remove-row-btn").addEventListener("click", () => tr.remove());
    tbody.appendChild(tr);
    for (const f of fields) {
      if (values[f.key] === undefined) continue;
      tr.querySelector(`[data-key="${f.key}"]`).value = values[f.key];
    }
  }

  function getRows() {
    return [...tbody.querySelectorAll("tr")]
      .map((row) => {
        const values = {};
        for (const f of fields) {
          const el = row.querySelector(`[data-key="${f.key}"]`);
          values[f.key] = el.value;
        }
        return values;
      })
      .filter((v) => fields.some((f) => f.type === "player" && v[f.key]));
  }

  function clearRows() {
    tbody.innerHTML = "";
  }

  return { addRow, getRows, clearRows };
}

function lineToCode(fields, values) {
  const parts = fields.map((f) => {
    const keyStr = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(f.key) ? f.key : JSON.stringify(f.key);
    if (f.type === "number") {
      return `${keyStr}: ${Number(values[f.key] || 0)}`;
    }
    return `${keyStr}: ${JSON.stringify(values[f.key] ?? "")}`;
  });
  return `{ ${parts.join(", ")} }`;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

// ---- Agregar jugador ----
const playerForm = document.getElementById("player-form");
const playerOutput = document.getElementById("player-output");
const playerCode = document.getElementById("player-code");

const playerPositionSelect = document.getElementById("player-position");
for (const pos of POSITION_OPTIONS) {
  if (pos === "") continue;
  const opt = document.createElement("option");
  opt.value = pos;
  opt.textContent = pos;
  playerPositionSelect.appendChild(opt);
}

playerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(playerForm);
  const id = data.get("id").trim();
  const number = data.get("number");
  const name = data.get("name").trim();
  const position = data.get("position").trim();
  const photo = data.get("photo").trim();
  const photoField = photo ? `, photo: ${JSON.stringify(photo)}` : "";

  // La canción de entrada solo se escribe si al menos trae título; artista y
  // link son opcionales dentro de ella.
  const walkupTitle = data.get("walkupTitle").trim();
  const walkupArtist = data.get("walkupArtist").trim();
  const walkupUrl = data.get("walkupUrl").trim();
  const walkupParts = [`title: ${JSON.stringify(walkupTitle)}`];
  if (walkupArtist) walkupParts.push(`artist: ${JSON.stringify(walkupArtist)}`);
  if (walkupUrl) walkupParts.push(`url: ${JSON.stringify(walkupUrl)}`);
  const walkupField = walkupTitle ? `, walkup: { ${walkupParts.join(", ")} }` : "";

  const code = `  { id: ${JSON.stringify(id)}, number: ${number === "" ? "null" : Number(number)}, name: ${JSON.stringify(name)}, position: ${JSON.stringify(position)}${photoField}${walkupField} },`;
  playerCode.textContent = code;
  playerOutput.hidden = false;
});

// ---- Agregar juego ----
const battingEditor = createRowsEditor(document.getElementById("batting-rows"), BATTING_FIELDS);
const pitchingEditor = createRowsEditor(document.getElementById("pitching-rows"), PITCHING_FIELDS);
const fieldingEditor = createRowsEditor(document.getElementById("fielding-rows"), FIELDING_FIELDS);
const substitutionsEditor = createRowsEditor(document.getElementById("substitutions-rows"), SUBSTITUTION_FIELDS);

for (const btn of document.querySelectorAll(".add-row-btn")) {
  const section = btn.dataset.section;
  const editor = {
    batting: battingEditor,
    pitching: pitchingEditor,
    fielding: fieldingEditor,
    substitutions: substitutionsEditor,
  }[section];
  btn.addEventListener("click", () => editor.addRow());
}

const gameForm = document.getElementById("game-form");
const gameIdInput = document.querySelector('#game-form input[name="id"]');

const scoreKnownSelect = document.getElementById("score-known");
const scoreFields = document.getElementById("score-fields");
const resultField = document.getElementById("result-field");
scoreKnownSelect.addEventListener("change", () => {
  const known = scoreKnownSelect.value === "yes";
  scoreFields.hidden = !known;
  resultField.hidden = known;
});

// El siguiente ID sale del número MÁS ALTO que ya existe, no de cuántos
// juegos hay. Con el conteo, un juego borrado o un ID fuera de secuencia
// hacía que se sugiriera uno ya ocupado — así fue como aparecieron los
// huecos (g-1, g0, g1, g2, g5…) en la numeración vieja.
function nextGameId() {
  const numeros = GAMES.map((g) => Number(String(g.id).replace(/^g/, ""))).filter(Number.isFinite);
  const max = numeros.length > 0 ? Math.max(...numeros) : 0;
  return `g${max + 1}`;
}

function resetGameForm() {
  gameIdInput.value = nextGameId();
  gameForm.querySelector('[name="date"]').value = "";
  gameForm.querySelector('[name="opponent"]').value = "";
  gameForm.querySelector('[name="weCloseBatting"]').value = "unknown";
  scoreKnownSelect.value = "yes";
  scoreFields.hidden = false;
  resultField.hidden = true;
  gameForm.querySelector('[name="scoreUs"]').value = "";
  gameForm.querySelector('[name="scoreThem"]').value = "";
  gameForm.querySelector('[name="replayUrl"]').value = "";
  mvpSelect.value = "";

  battingEditor.clearRows();
  battingEditor.addRow();
  pitchingEditor.clearRows();
  pitchingEditor.addRow();
  fieldingEditor.clearRows();
  fieldingEditor.addRow();
  substitutionsEditor.clearRows();
  substitutionsEditor.addRow();
}

function loadGameIntoForm(game) {
  gameIdInput.value = game.id;
  gameForm.querySelector('[name="date"]').value = game.date;
  gameForm.querySelector('[name="opponent"]').value = game.opponent;
  gameForm.querySelector('[name="weCloseBatting"]').value =
    game.weCloseBatting === true ? "true" : game.weCloseBatting === false ? "false" : "unknown";

  const known = game.scoreUs != null && game.scoreThem != null;
  scoreKnownSelect.value = known ? "yes" : "no";
  scoreFields.hidden = !known;
  resultField.hidden = known;
  gameForm.querySelector('[name="scoreUs"]').value = known ? game.scoreUs : "";
  gameForm.querySelector('[name="scoreThem"]').value = known ? game.scoreThem : "";
  gameForm.querySelector('[name="result"]').value = game.result ?? "W";
  gameForm.querySelector('[name="replayUrl"]').value = game.replayUrl ?? "";
  mvpSelect.value = game.mvp ?? "";

  battingEditor.clearRows();
  for (const line of game.batting ?? []) battingEditor.addRow(line);
  if (!(game.batting ?? []).length) battingEditor.addRow();

  pitchingEditor.clearRows();
  for (const line of game.pitching ?? []) pitchingEditor.addRow(line);
  if (!(game.pitching ?? []).length) pitchingEditor.addRow();

  fieldingEditor.clearRows();
  for (const line of game.fielding ?? []) fieldingEditor.addRow(line);
  if (!(game.fielding ?? []).length) fieldingEditor.addRow();

  substitutionsEditor.clearRows();
  for (const line of game.substitutions ?? []) substitutionsEditor.addRow(line);
  if (!(game.substitutions ?? []).length) substitutionsEditor.addRow();
}

const mvpSelect = document.getElementById("mvp-select");
mvpSelect.innerHTML = playerOptionsHtml();

const gameSelect = document.getElementById("game-select");
for (const g of GAMES) {
  const opt = document.createElement("option");
  opt.value = g.id;
  opt.textContent = `${g.date} vs ${g.opponent}`;
  gameSelect.appendChild(opt);
}
gameSelect.addEventListener("change", () => {
  const game = GAMES.find((g) => g.id === gameSelect.value);
  if (game) loadGameIntoForm(game);
  else resetGameForm();
});

resetGameForm();

const gameOutput = document.getElementById("game-output");
const gameCode = document.getElementById("game-code");

document.getElementById("generate-game-btn").addEventListener("click", () => {
  const data = new FormData(document.getElementById("game-form"));
  const id = data.get("id").trim();
  const date = data.get("date");
  const opponent = data.get("opponent").trim();
  const closeValue = data.get("weCloseBatting");
  const weCloseBatting = closeValue === "unknown" ? "null" : closeValue;
  const scoreKnown = data.get("scoreKnown") === "yes";

  const lines = [];
  if (gameSelect.value) {
    lines.push(`  // Reemplaza el bloque completo del juego "${gameSelect.value}" en GAMES por esto:`);
  }
  lines.push("  {");
  lines.push(`    id: ${JSON.stringify(id)},`);
  lines.push(`    date: ${JSON.stringify(date)},`);
  lines.push(`    opponent: ${JSON.stringify(opponent)},`);
  lines.push(`    weCloseBatting: ${weCloseBatting},`);
  if (scoreKnown) {
    lines.push(`    scoreUs: ${Number(data.get("scoreUs") || 0)},`);
    lines.push(`    scoreThem: ${Number(data.get("scoreThem") || 0)},`);
  } else {
    lines.push(`    result: ${JSON.stringify(data.get("result"))}, // marcador todavía no capturado`);
    lines.push(`    scoreUs: null,`);
    lines.push(`    scoreThem: null,`);
  }

  lines.push("    batting: [");
  for (const row of battingEditor.getRows()) lines.push(`      ${lineToCode(BATTING_FIELDS, row)},`);
  lines.push("    ],");
  lines.push("    pitching: [");
  for (const row of pitchingEditor.getRows()) lines.push(`      ${lineToCode(PITCHING_FIELDS, row)},`);
  lines.push("    ],");
  lines.push("    fielding: [");
  for (const row of fieldingEditor.getRows()) lines.push(`      ${lineToCode(FIELDING_FIELDS, row)},`);
  lines.push("    ],");
  lines.push("    substitutions: [");
  for (const row of substitutionsEditor.getRows()) lines.push(`      ${lineToCode(SUBSTITUTION_FIELDS, row)},`);
  lines.push("    ],");
  const replayUrl = data.get("replayUrl").trim();
  if (replayUrl) lines.push(`    replayUrl: ${JSON.stringify(replayUrl)},`);
  const mvp = data.get("mvp");
  if (mvp) lines.push(`    mvp: ${JSON.stringify(mvp)},`);
  lines.push("  },");

  gameCode.textContent = lines.join("\n");
  gameOutput.hidden = false;
});

for (const btn of document.querySelectorAll(".copy-btn")) {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    copyToClipboard(target.textContent);
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado';
    setTimeout(() => (btn.innerHTML = original), 1500);
  });
}
