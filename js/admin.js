import { PLAYERS, GAMES, SEASONS, CURRENT_SEASON, PLAYOFFS } from "./data.js";

// ---- Navegación entre secciones (ver <nav class="admin-tabs"> en
// admin.html) — antes todo vivía junto en una sola página larguísima. Los
// botones son links reales (href="#pagos", etc.), así que cambiar de
// sección es solo cambiar el hash de la URL — funciona el botón atrás del
// navegador y se puede compartir el link directo a una sección. Corre
// siempre (con o sin sesión de coach): #admin-protected sigue oculto por
// separado hasta que admin-dues.js confirma la cuenta; esto solo decide
// CUÁL de las secciones de adentro se ve una vez que ese candado se abre.
const ADMIN_SECTION_IDS = ["pagos", "rsvp", "anuncios", "temporadas", "jugador", "juego"];
const adminTabs = document.getElementById("admin-tabs");

function showAdminSection(id) {
  const validId = ADMIN_SECTION_IDS.includes(id) ? id : ADMIN_SECTION_IDS[0];
  for (const sectionId of ADMIN_SECTION_IDS) {
    const section = document.getElementById(`admin-section-${sectionId}`);
    if (section) section.hidden = sectionId !== validId;
  }
  for (const tab of adminTabs?.querySelectorAll("[data-tab]") ?? []) {
    tab.classList.toggle("active", tab.dataset.tab === validId);
  }
}

window.addEventListener("hashchange", () => showAdminSection(location.hash.slice(1)));
showAdminSection(location.hash.slice(1));

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
  { key: "HRC", label: "HRC", full: "HR Campo", type: "number" },
  { key: "RBI", label: "RBI", full: "Impulsadas", type: "number" },
  { key: "R", label: "R", full: "Carreras", type: "number" },
  { key: "BB", label: "BB", full: "Bases por bolas", type: "number" },
  { key: "SO", label: "SO", full: "Ponches", type: "number" },
  { key: "SB", label: "SB", full: "Bases robadas", type: "number" },
];

// Cómo lo sacaron, más allá del ponche (SO, arriba) — tabla propia (ver
// `outs` en cada juego de js/data.js) porque no todo out es al bat: BO/RO
// pueden pasar sin turno de por medio.
const OUTS_FIELDS = [
  { key: "playerId", label: "Jugador", type: "player" },
  { key: "GO", label: "GO", full: "Out por rodado", type: "number" },
  { key: "FO", label: "FO", full: "Out por elevado", type: "number" },
  { key: "LO", label: "LO", full: "Out por línea", type: "number" },
  { key: "BO", label: "BO", full: "Out en base", type: "number" },
  { key: "RO", label: "RO", full: "Out de regla", type: "number" },
  { key: "SAC", label: "SAC", full: "Out por sacrificio", type: "number" },
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

// ---- Selector de jugador con búsqueda ----
//
// En vez de un <select> con los 26 nombres (lento de recorrer en cada fila),
// cada celda de jugador es un campo de texto: se escribe parte del nombre o
// el número y aparece la lista filtrada (sin importar acentos ni
// mayúsculas: "munoz" encuentra a Muñoz). Flechas para moverse, Enter o Tab
// para elegir (Enter además salta a la siguiente casilla de la fila), Esc
// para cerrar. El id elegido vive en un <input type="hidden" data-key>, así
// que getRows/addRow siguen leyendo/escribiendo `.value` como antes.
//
// La lista es UNA sola, pegada al <body> con position: fixed — dentro de la
// tabla (que tiene scroll horizontal) quedaría recortada.
const normalizeText = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const playerLabel = (p) => `#${p.number ?? "-"} ${p.name}`;
// Los del roster de la temporada actual primero; los demás después.
const PICKER_PLAYERS = [...PLAYERS].sort(
  (a, b) => Number(!!b.seasons?.includes(CURRENT_SEASON)) - Number(!!a.seasons?.includes(CURRENT_SEASON))
);
const PICKER_MAX = 8;

function playerCellHtml(key) {
  return `<input type="hidden" data-key="${key}"><input type="text" class="player-search" placeholder="Escribe un nombre…" autocomplete="off" spellcheck="false">`;
}

function matchingPlayers(query) {
  const tokens = normalizeText(query).replace(/#/g, "").split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return PICKER_PLAYERS;
  return PICKER_PLAYERS.filter((p) => {
    const hay = normalizeText(`${p.number ?? ""} ${p.name}`);
    return tokens.every((t) => hay.split(/\s+/).some((word) => word.startsWith(t)));
  });
}

const pickerList = document.createElement("ul");
pickerList.className = "player-picker-list";
pickerList.hidden = true;
document.body.appendChild(pickerList);
let pickerInput = null;
let pickerMatches = [];
let pickerIndex = 0;

function hiddenFor(input) {
  return input.previousElementSibling;
}

function renderPicker() {
  pickerList.innerHTML = pickerMatches.length
    ? pickerMatches
        .slice(0, PICKER_MAX)
        .map(
          (p, i) =>
            `<li data-id="${p.id}" class="${i === pickerIndex ? "active" : ""}${p.seasons?.includes(CURRENT_SEASON) ? "" : " not-roster"}">${playerLabel(p)}</li>`
        )
        .join("")
    : `<li class="empty">Nadie con ese nombre</li>`;
  const r = pickerInput.getBoundingClientRect();
  pickerList.style.left = `${r.left}px`;
  pickerList.style.top = `${r.bottom + 2}px`;
  pickerList.style.minWidth = `${r.width}px`;
  pickerList.hidden = false;
}

function openPicker(input) {
  pickerInput = input;
  pickerMatches = matchingPlayers(input.value === playerLabelById(hiddenFor(input).value) ? "" : input.value);
  pickerIndex = 0;
  renderPicker();
}

function closePicker() {
  pickerList.hidden = true;
  pickerInput = null;
}

function playerLabelById(id) {
  const p = PLAYERS.find((x) => x.id === id);
  return p ? playerLabel(p) : "";
}

function choosePlayer(input, player) {
  hiddenFor(input).value = player?.id ?? "";
  input.value = player ? playerLabel(player) : "";
  closePicker();
}

// Si se sale del campo sin elegir: se queda con el único que coincide, o se
// limpia (para que nunca quede texto que no corresponde a nadie).
function settlePicker(input) {
  const hidden = hiddenFor(input);
  if (input.value.trim() === "") return choosePlayer(input, null);
  if (input.value === playerLabelById(hidden.value)) return;
  const matches = matchingPlayers(input.value);
  choosePlayer(input, matches.length === 1 ? matches[0] : null);
}

document.addEventListener("focusin", (e) => {
  if (e.target.matches?.(".player-search")) {
    e.target.select();
    openPicker(e.target);
  }
});
document.addEventListener("input", (e) => {
  if (!e.target.matches?.(".player-search")) return;
  hiddenFor(e.target).value = "";
  openPicker(e.target);
});
document.addEventListener("focusout", (e) => {
  if (e.target.matches?.(".player-search")) {
    settlePicker(e.target);
    closePicker();
  }
});
document.addEventListener("keydown", (e) => {
  const input = e.target;
  if (!input.matches?.(".player-search") || pickerList.hidden) return;
  const visible = Math.min(pickerMatches.length, PICKER_MAX);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!visible) return;
    pickerIndex = (pickerIndex + (e.key === "ArrowDown" ? 1 : -1) + visible) % visible;
    renderPicker();
  } else if (e.key === "Enter" || e.key === "Tab") {
    // Sin haber escrito nada nuevo (campo vacío o con el jugador ya elegido),
    // Tab solo avanza y Enter no cambia la elección.
    const untouched = input.value.trim() === "" || input.value === playerLabelById(hiddenFor(input).value);
    const player = untouched ? PLAYERS.find((p) => p.id === hiddenFor(input).value) : pickerMatches[pickerIndex];
    if (!player || (e.key === "Tab" && untouched)) return;
    choosePlayer(input, player);
    if (e.key === "Enter") {
      e.preventDefault();
      // Salta a la siguiente casilla de la misma fila.
      const cells = [...input.closest("tr").querySelectorAll("input:not([type=hidden]), select")];
      cells[cells.indexOf(input) + 1]?.focus();
    }
  } else if (e.key === "Escape") {
    closePicker();
  }
});
// mousedown (no click): si no, el campo pierde el foco antes y la lista se cierra.
pickerList.addEventListener("mousedown", (e) => {
  e.preventDefault();
  const li = e.target.closest("li[data-id]");
  if (li && pickerInput) choosePlayer(pickerInput, PLAYERS.find((p) => p.id === li.dataset.id));
});
window.addEventListener("scroll", () => pickerInput && renderPicker(), true);

function createRowsEditor(container, fields) {
  const wrap = document.createElement("div");
  wrap.className = "rows-table-wrap";
  const table = document.createElement("table");
  table.className = "rows-table";
  table.innerHTML = `<thead><tr>${fields
    .map((f) => `<th><span class="th-abbr">${f.label}</span>${f.full ? `<span class="th-full">${f.full}</span>` : ""}</th>`)
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
            return `<td>${playerCellHtml(f.key)}</td>`;
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
      const el = tr.querySelector(`[data-key="${f.key}"]`);
      el.value = values[f.key];
      if (f.type === "player") el.nextElementSibling.value = playerLabelById(values[f.key]);
    }
    return tr;
  }

  // Ids de jugador ya capturados en esta tabla (primera columna de jugador).
  function playerIds() {
    const key = fields.find((f) => f.type === "player").key;
    return [...tbody.querySelectorAll(`[data-key="${key}"]`)].map((el) => el.value).filter(Boolean);
  }

  // Quita las filas que no tienen ningún jugador elegido.
  function removeEmptyRows() {
    for (const row of [...tbody.querySelectorAll("tr")]) {
      const hasPlayer = fields.some((f) => f.type === "player" && row.querySelector(`[data-key="${f.key}"]`).value);
      if (!hasPlayer) row.remove();
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

  return { addRow, getRows, clearRows, playerIds, removeEmptyRows };
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

// ---- Temporadas por jugador ----
//
// No escribe nada solo (a diferencia de Estado de pago/Anuncios/RSVP, que sí
// van a Supabase) — `seasons` vive en data.js como el resto del roster, así
// que esto solo genera el valor para pegar a mano en cada jugador dentro de
// PLAYERS, igual que "Agregar jugador"/"Agregar juego" abajo. Cada casilla
// es una temporada real (pueden quedar huecos en medio — alguien se pudo
// haber ausentado una temporada y regresado), no solo "desde cuándo": el
// código generado es la lista completa de las marcadas, no un debut solo.
const seasonsList = document.getElementById("seasons-admin-list");
const seasonsOutput = document.getElementById("seasons-output");
const seasonsCode = document.getElementById("seasons-code");

function seasonsRowMarkup(player) {
  const mine = new Set(player.seasons ?? []);
  const checks = SEASONS.map((_season, i) => {
    const n = i + 1;
    return `<label class="season-check"><input type="checkbox" data-season="${n}" ${mine.has(n) ? "checked" : ""}>${n}</label>`;
  }).join("");
  return `
    <div class="seasons-admin-row" data-player="${player.id}">
      <span class="seasons-admin-name">#${player.number ?? "-"} ${player.name}</span>
      <div class="seasons-admin-checks">${checks}</div>
    </div>
  `;
}

seasonsList.innerHTML = PLAYERS.map(seasonsRowMarkup).join("");

// "Mismo arreglo, en el mismo orden" — compara sin que el orden de los
// checkboxes (siempre ascendente aquí) pueda dar un falso "cambió".
function sameSeasons(a, b) {
  const arrA = a ?? [];
  const arrB = b ?? [];
  return arrA.length === arrB.length && arrA.every((v, i) => v === arrB[i]);
}

document.getElementById("generate-seasons-btn").addEventListener("click", () => {
  // Siempre lista a todos los que tengan al menos una marcada, hayan
  // cambiado o no, para que el resultado sea predecible — antes, cuando
  // esto solo generaba un "debutSeason" (la más chica marcada), marcar o
  // desmarcar cualquier otra casilla no movía ese número y esa edición no
  // generaba nada, se sentía como que el botón no hacía caso.
  const lines = [];
  for (const row of seasonsList.querySelectorAll(".seasons-admin-row")) {
    const player = PLAYERS.find((p) => p.id === row.dataset.player);
    const checkedSeasons = [...row.querySelectorAll("input[type=checkbox]:checked")].map((cb) =>
      Number(cb.dataset.season)
    );
    if (checkedSeasons.length === 0) continue; // sin ninguna marcada, no hay nada que generar
    const changed = !sameSeasons(checkedSeasons, player.seasons) ? "  // antes: " + JSON.stringify(player.seasons ?? []) : "";
    lines.push(`${player.id} (${player.name}): seasons: [${checkedSeasons.join(", ")}],${changed}`);
  }
  seasonsCode.textContent = lines.length > 0 ? lines.join("\n") : "Marca al menos una temporada por jugador.";
  seasonsOutput.hidden = false;
});

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
const outsEditor = createRowsEditor(document.getElementById("outs-rows"), OUTS_FIELDS);
const substitutionsEditor = createRowsEditor(document.getElementById("substitutions-rows"), SUBSTITUTION_FIELDS);

for (const btn of document.querySelectorAll(".add-row-btn")) {
  const section = btn.dataset.section;
  const editor = {
    batting: battingEditor,
    pitching: pitchingEditor,
    fielding: fieldingEditor,
    outs: outsEditor,
    substitutions: substitutionsEditor,
  }[section];
  btn.addEventListener("click", () => {
    const tr = editor.addRow();
    tr.querySelector(".player-search, input, select")?.focus();
  });
}

// "Copiar jugadores del bateo": llena Fildeo/Outs con los mismos jugadores
// del line-up (en su orden) para no elegirlos otra vez uno por uno. Solo
// agrega a quien falte, y quita antes las filas vacías. En Fildeo no entra
// el JC (solo batea) y sí entran los pitchers de la tabla de Pitcheo.
for (const btn of document.querySelectorAll(".copy-batting-btn")) {
  btn.addEventListener("click", () => {
    const target = { fielding: fieldingEditor, outs: outsEditor }[btn.dataset.section];
    const batting = battingEditor.getRows();
    let ids = batting
      .filter((r) => btn.dataset.section !== "fielding" || r.position !== "JC")
      .map((r) => r.playerId);
    if (btn.dataset.section === "fielding") ids = [...ids, ...pitchingEditor.getRows().map((r) => r.playerId)];
    target.removeEmptyRows();
    const already = new Set(target.playerIds());
    for (const id of ids) {
      if (already.has(id)) continue;
      already.add(id);
      target.addRow({ playerId: id });
    }
    if (already.size === 0) target.addRow();
  });
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

// Un juego de playoffs no lleva `season` propio (lo hereda de la ronda en
// PLAYOFFS, ver js/data.js) — a cambio pide en qué ronda va y si es la
// final. Alternar el checkbox solo muestra/oculta esos campos; el
// generador de código de más abajo decide qué armar según este estado.
const isPlayoffToggle = document.getElementById("is-playoff-toggle");
const seasonField = document.getElementById("season-field");
const playoffFields = document.getElementById("playoff-fields");
isPlayoffToggle.addEventListener("change", () => {
  const isPlayoff = isPlayoffToggle.checked;
  seasonField.hidden = isPlayoff;
  playoffFields.hidden = !isPlayoff;
});

// El siguiente ID sale del número MÁS ALTO que ya existe, no de cuántos
// juegos hay. Con el conteo, un juego borrado o un ID fuera de secuencia
// hacía que se sugiriera uno ya ocupado — así fue como aparecieron los
// huecos (g-1, g0, g1, g2, g5…) en la numeración vieja.
// Incluye los juegos de playoffs (PLAYOFFS) además de GAMES — comparten la
// misma secuencia global de ids para que nunca choquen entre sí (ver
// PLAYOFFS en js/data.js).
function allGameIds() {
  const playoffGames = PLAYOFFS.flatMap((entry) => entry.rounds.flatMap((round) => round.games ?? []));
  return [...GAMES, ...playoffGames].map((g) => g.id);
}

function nextGameId() {
  const numeros = allGameIds().map((id) => Number(String(id).replace(/^g/, ""))).filter(Number.isFinite);
  const max = numeros.length > 0 ? Math.max(...numeros) : 0;
  return `g${max + 1}`;
}

function resetGameForm() {
  gameIdInput.value = nextGameId();
  isPlayoffToggle.checked = false;
  seasonField.hidden = false;
  playoffFields.hidden = true;
  gameForm.querySelector('[name="season"]').value = CURRENT_SEASON;
  gameForm.querySelector('[name="roundName"]').value = "";
  gameForm.querySelector('[name="isFinal"]').checked = false;
  gameForm.querySelector('[name="date"]').value = "";
  gameForm.querySelector('[name="time"]').value = "";
  gameForm.querySelector('[name="opponent"]').value = "";
  gameForm.querySelector('[name="weCloseBatting"]').value = "unknown";
  scoreKnownSelect.value = "yes";
  scoreFields.hidden = false;
  resultField.hidden = true;
  gameForm.querySelector('[name="scoreUs"]').value = "";
  gameForm.querySelector('[name="scoreThem"]').value = "";
  gameForm.querySelector('[name="replayUrl"]').value = "";

  battingEditor.clearRows();
  battingEditor.addRow();
  pitchingEditor.clearRows();
  pitchingEditor.addRow();
  fieldingEditor.clearRows();
  fieldingEditor.addRow();
  outsEditor.clearRows();
  outsEditor.addRow();
  substitutionsEditor.clearRows();
  substitutionsEditor.addRow();
}

function loadGameIntoForm(game) {
  gameIdInput.value = game.id;
  // "Editar juego existente" solo lista juegos de GAMES (temporada
  // regular) — nunca de PLAYOFFS, así que siempre se sale del modo
  // playoffs al cargar uno.
  isPlayoffToggle.checked = false;
  seasonField.hidden = false;
  playoffFields.hidden = true;
  gameForm.querySelector('[name="season"]').value = game.season ?? CURRENT_SEASON;
  gameForm.querySelector('[name="date"]').value = game.date;
  gameForm.querySelector('[name="time"]').value = game.time ?? "";
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

  battingEditor.clearRows();
  for (const line of game.batting ?? []) battingEditor.addRow(line);
  if (!(game.batting ?? []).length) battingEditor.addRow();

  pitchingEditor.clearRows();
  for (const line of game.pitching ?? []) pitchingEditor.addRow(line);
  if (!(game.pitching ?? []).length) pitchingEditor.addRow();

  fieldingEditor.clearRows();
  for (const line of game.fielding ?? []) fieldingEditor.addRow(line);
  if (!(game.fielding ?? []).length) fieldingEditor.addRow();

  outsEditor.clearRows();
  for (const line of game.outs ?? []) outsEditor.addRow(line);
  if (!(game.outs ?? []).length) outsEditor.addRow();

  substitutionsEditor.clearRows();
  for (const line of game.substitutions ?? []) substitutionsEditor.addRow(line);
  if (!(game.substitutions ?? []).length) substitutionsEditor.addRow();
}

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

// Agrega `extra` espacios al principio de cada línea de `text` — para
// anidar el mismo bloque de juego a distinta profundidad según en dónde
// vaya a pegarse (directo en GAMES, o dentro de rounds/games en PLAYOFFS).
function indentBlock(text, extra) {
  const pad = " ".repeat(extra);
  return text
    .split("\n")
    .map((l) => pad + l)
    .join("\n");
}

document.getElementById("generate-game-btn").addEventListener("click", () => {
  const data = new FormData(document.getElementById("game-form"));
  const id = data.get("id").trim();
  const isPlayoff = isPlayoffToggle.checked;
  const season = Number(data.get("season")) || CURRENT_SEASON;
  const date = data.get("date");
  const time = data.get("time");
  const opponent = data.get("opponent").trim();
  const closeValue = data.get("weCloseBatting");
  const weCloseBatting = closeValue === "unknown" ? "null" : closeValue;
  const scoreKnown = data.get("scoreKnown") === "yes";

  // Campos del juego en sí, sin indentación todavía (se anidan distinto
  // según el caso, ver abajo). Un juego de playoffs no lleva `season`
  // propio — lo hereda de la ronda en PLAYOFFS.
  const fieldLines = [];
  fieldLines.push(`id: ${JSON.stringify(id)},`);
  if (!isPlayoff) fieldLines.push(`season: ${season},`);
  fieldLines.push(`date: ${JSON.stringify(date)},`);
  if (time) fieldLines.push(`time: ${JSON.stringify(time)},`);
  fieldLines.push(`opponent: ${JSON.stringify(opponent)},`);
  fieldLines.push(`weCloseBatting: ${weCloseBatting},`);
  if (scoreKnown) {
    fieldLines.push(`scoreUs: ${Number(data.get("scoreUs") || 0)},`);
    fieldLines.push(`scoreThem: ${Number(data.get("scoreThem") || 0)},`);
  } else {
    fieldLines.push(`result: ${JSON.stringify(data.get("result"))}, // marcador todavía no capturado`);
    fieldLines.push(`scoreUs: null,`);
    fieldLines.push(`scoreThem: null,`);
  }
  fieldLines.push("batting: [");
  for (const row of battingEditor.getRows()) fieldLines.push(`  ${lineToCode(BATTING_FIELDS, row)},`);
  fieldLines.push("],");
  fieldLines.push("pitching: [");
  for (const row of pitchingEditor.getRows()) fieldLines.push(`  ${lineToCode(PITCHING_FIELDS, row)},`);
  fieldLines.push("],");
  fieldLines.push("fielding: [");
  for (const row of fieldingEditor.getRows()) fieldLines.push(`  ${lineToCode(FIELDING_FIELDS, row)},`);
  fieldLines.push("],");
  fieldLines.push("outs: [");
  for (const row of outsEditor.getRows()) fieldLines.push(`  ${lineToCode(OUTS_FIELDS, row)},`);
  fieldLines.push("],");
  fieldLines.push("substitutions: [");
  for (const row of substitutionsEditor.getRows()) fieldLines.push(`  ${lineToCode(SUBSTITUTION_FIELDS, row)},`);
  fieldLines.push("],");
  const replayUrl = data.get("replayUrl").trim();
  if (replayUrl) fieldLines.push(`replayUrl: ${JSON.stringify(replayUrl)},`);

  // "{" + campos indentados 2 + "}," — el objeto del juego, sin indentación
  // de base todavía.
  const gameBlock = ["{", indentBlock(fieldLines.join("\n"), 2), "},"].join("\n");

  const lines = [];
  if (!isPlayoff) {
    if (gameSelect.value) {
      lines.push(`  // Reemplaza el bloque completo del juego "${gameSelect.value}" en GAMES por esto:`);
    }
    lines.push(indentBlock(gameBlock, 2));
  } else {
    // Busca dónde ya va este juego dentro de PLAYOFFS (misma temporada +
    // misma ronda por nombre) para generar solo lo que hace falta agregar
    // — el juego suelto, la ronda completa, o la entrada de temporada
    // completa — igual que "Reemplaza el bloque..." ya hace para GAMES.
    const roundName = data.get("roundName").trim();
    const isFinal = data.get("isFinal") === "on";
    const seasonEntry = PLAYOFFS.find((p) => p.season === CURRENT_SEASON);
    // Sin distinguir mayúsculas ni acentos: "CUARTOS DE FINAL" y "Cuartos de
    // Final" son la misma ronda — antes generaba una ronda nueva duplicada y
    // la serie se partía en dos (cada una con 1 juego).
    const normalize = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    const round = seasonEntry?.rounds.find((r) => normalize(r.name) === normalize(roundName));

    if (round) {
      lines.push(`  // Agrega este juego al arreglo "games" de la ronda "${round.name}" (temporada ${CURRENT_SEASON}) en PLAYOFFS:`);
      lines.push(indentBlock(gameBlock, 2));
    } else if (seasonEntry) {
      lines.push(`  // Agrega esta ronda al arreglo "rounds" de la temporada ${CURRENT_SEASON} en PLAYOFFS:`);
      const roundLines = [
        "{",
        `  name: ${JSON.stringify(roundName)},`,
        `  opponent: ${JSON.stringify(opponent)},`,
        `  isFinal: ${isFinal},`,
        "  games: [",
        indentBlock(gameBlock, 4),
        "  ],",
        "},",
      ].join("\n");
      lines.push(indentBlock(roundLines, 2));
    } else {
      lines.push(`  // Agrega esto como una nueva entrada en PLAYOFFS:`);
      const entryLines = [
        "{",
        `  season: ${CURRENT_SEASON},`,
        "  rounds: [",
        indentBlock(
          [
            "{",
            `  name: ${JSON.stringify(roundName)},`,
            `  opponent: ${JSON.stringify(opponent)},`,
            `  isFinal: ${isFinal},`,
            "  games: [",
            indentBlock(gameBlock, 4),
            "  ],",
            "},",
          ].join("\n"),
          4
        ),
        "  ],",
        "},",
      ].join("\n");
      lines.push(indentBlock(entryLines, 2));
    }
  }

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
