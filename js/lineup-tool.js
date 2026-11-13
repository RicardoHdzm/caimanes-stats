// Generador de alineación por juego (lineup/index.html). Se marca a quien
// viene, se le elige posición a cada quien y el motor de js/lineup.js arma
// defensa + orden al bat. Encima del motor, aquí vive (a petición expresa):
// - lo último se guarda en este navegador (selección y alineación) y se
//   recupera al volver a abrir la página;
// - avisos en vivo de posiciones vacías o repetidas antes de generar;
// - candados: un jugador fijado conserva turno y posición al regenerar;
// - compartir como imagen (flyer) o como texto para WhatsApp;
// - la vista de campo con cada quien en su posición.
import { ROSTER, SCHEDULE, INJURED } from "./data.js";
import {
  DEFENSE_POSITIONS,
  EDITABLE_POSITIONS,
  registeredFieldPositions,
  primaryPosition,
  assignDefenseByChoice,
  buildLineupFromAssignment,
  lineupStatsById,
  emptyStats,
  byRegularThenOps,
  enableRowDrag,
} from "./lineup.js";
import { initAuth } from "./auth.js";
import { displayPositions } from "./stats.js";
import { getAllPositionOverrides } from "./db.js";
import { escapeHtml, renderAvatar, renderSortableTable, formatGameTime } from "./ui.js";
import { lineupFlyer, openFlyer, shareButton } from "./flyers.js";

const listEl = document.getElementById("attendee-list");
const countEl = document.getElementById("attendee-count");
const resultEl = document.getElementById("lineup-result");
const coverageEl = document.getElementById("lu-coverage");
const generateBtn = document.getElementById("generate-btn");
const generateLabel = document.getElementById("generate-label");

// Lo que depende de internet (sesión y posiciones del perfil) se espera
// con TOPE: en el campo casi nunca hay buena señal y, sin tope, una
// petición colgada dejaba la página sin lista ni alineación (y el botón
// de generar sin responder). Pasado el tope se sigue con lo de data.js.
const NET_TIMEOUT_MS = 3500;
function withTimeout(promise, fallback) {
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback), NET_TIMEOUT_MS)),
  ]);
}

// Esta página no es parte del router del sitio (ver index.html/js/main.js),
// así que nadie más llama initAuth() aquí — hace falta antes de leer
// player_positions, si no getClient() sigue en null.
await withTimeout(initAuth(), null);

// Posiciones personalizadas (ver "Editar mis posiciones" en el perfil) se
// mezclan ANTES de armar la lista de asistentes. `position` = las MÁS
// JUGADAS (ver displayPositions en js/stats.js); la registrada queda en
// `registeredPosition`.
const positionOverrides = (await withTimeout(getAllPositionOverrides(), null)) ?? new Map();
const roster = ROSTER.map((p) => {
  const registered = positionOverrides.get(p.id) ?? p.position ?? "";
  return { ...p, registeredPosition: registered, position: displayPositions(p.id, registered) };
}).sort((a, b) => a.name.localeCompare(b.name, "es"));
const playerById = new Map(roster.map((p) => [p.id, p]));

// ---- Lo que se guarda en este navegador ----
// `selection`: playerId -> posición elegida para este juego ("" = sin
// posición, que decida el motor). Solo están los que sí vienen.
// `result`: la última alineación — renglones en orden al bat
// ({ playerId, position, pitcherOnly }) y los fijados con candado.
const STORAGE_KEY = "caimanes-lineup-tool";
const selection = new Map();
let result = null;

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        selection: [...selection],
        result: result && {
          rows: result.rows.map((r) => ({ playerId: r.playerId, position: r.position, pitcherOnly: !!r.pitcherOnly })),
          locked: [...result.locked],
        },
      })
    );
  } catch {}
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!saved || saved.v !== 1) return;
    for (const [id, pos] of saved.selection ?? []) if (playerById.has(id)) selection.set(id, pos ?? "");
    const rows = (saved.result?.rows ?? []).filter((r) => playerById.has(r.playerId));
    if (rows.length) result = { rows, locked: new Set((saved.result.locked ?? []).filter((id) => playerById.has(id))) };
  } catch {}
}

// ---- Lista de asistentes ----

// El selector de posición: primero sus posiciones más jugadas (lo más
// probable), luego el resto por si hoy juega en otro lado, JD/JC para
// reservarle a alguien ese turno a propósito, y al final "sin posición"
// para dejarle la decisión al algoritmo.
function positionSelectHtml(player) {
  const registered = registeredFieldPositions(player);
  const others = DEFENSE_POSITIONS.filter((pos) => !registered.includes(pos));
  const opts = (list) => list.map((pos) => `<option value="${pos}">${pos}</option>`).join("");
  return `
    <select class="lu-card-pos" aria-label="Posición de ${escapeHtml(player.name)} en este juego">
      ${registered.length ? `<optgroup label="Más jugadas">${opts(registered)}</optgroup>` : ""}
      <optgroup label="Otras">${opts(others)}</optgroup>
      <optgroup label="Banca">
        <option value="JD">JD — Jugador Designado</option>
        <option value="JC">JC — Jugador de Cortesía</option>
      </optgroup>
      <option value="">Sin posición</option>
    </select>`;
}

const cards = new Map(); // playerId -> { card, checkbox, select }

// Lesionados (INJURED en js/data.js, los de la medalla "Fragile"): marca
// en su tarjeta, en la tabla y en la banca para no alinearlos sin querer.
const INJURED_TAG = '<span class="lu-injured"><i class="fa-solid fa-user-injured" aria-hidden="true"></i> Lesionado</span>';
const injuredIcon = (id) =>
  INJURED.includes(id) ? ' <i class="fa-solid fa-user-injured lu-injured-icon" title="Lesionado" aria-label="Lesionado"></i>' : "";

for (const player of roster) {
  // Tocar cualquier parte de la tarjeta marca/desmarca (el checkbox queda
  // oculto). El selector de posición va FUERA del <label>: dentro, en
  // iPhone tocarlo también desmarcaba al jugador.
  const injured = INJURED.includes(player.id);
  const card = document.createElement("div");
  card.className = `lu-card${injured ? " is-injured" : ""}`;
  card.innerHTML = `
    <label class="lu-card-hit">
      <input type="checkbox" class="lu-card-check-input" />
      <span class="lu-card-photo">${renderAvatar(player, 46)}</span>
      <span class="lu-card-info">
        <b class="lu-card-num">#${player.number ?? "-"}</b>
        <span class="lu-card-name">${escapeHtml(player.name)}</span>
        ${injured ? INJURED_TAG : ""}
      </span>
      <span class="lu-card-check" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
    </label>
    ${positionSelectHtml(player)}`;
  const checkbox = card.querySelector("input");
  const select = card.querySelector("select");
  // El selector apagado (jugador sin marcar) no recibe toques: ese toque
  // también marca al jugador.
  card.addEventListener("click", (e) => {
    if (e.target.closest(".lu-card-hit") || (e.target.closest("select") && !select.disabled)) return;
    checkbox.click();
  });
  const defaultPos = registeredFieldPositions(player)[0] ?? "";
  select.value = selection.get(player.id) ?? defaultPos;

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) selection.set(player.id, select.value);
    else selection.delete(player.id);
    syncCard(player.id);
    onSelectionChange();
  });
  select.addEventListener("change", () => {
    if (selection.has(player.id)) selection.set(player.id, select.value);
    onSelectionChange();
  });

  listEl.appendChild(card);
  cards.set(player.id, { card, checkbox, select });
}

function syncCard(id) {
  const { card, checkbox, select } = cards.get(id);
  const on = selection.has(id);
  checkbox.checked = on;
  card.classList.toggle("is-on", on);
  select.disabled = !on;
  if (on) select.value = selection.get(id);
}

function onSelectionChange() {
  updateBar();
  save();
  renderCoverage();
}

function updateBar() {
  const n = selection.size;
  countEl.innerHTML = `<b>${n}</b> ${n === 1 ? "seleccionado" : "seleccionados"}`;
  generateBtn.disabled = n === 0;
  generateLabel.textContent = result ? "Volver a generar" : "Generar alineación";
}

document.getElementById("select-all-btn").addEventListener("click", () => {
  for (const p of roster) if (!selection.has(p.id)) selection.set(p.id, cards.get(p.id).select.value);
  for (const id of cards.keys()) syncCard(id);
  onSelectionChange();
});

document.getElementById("select-none-btn").addEventListener("click", () => {
  selection.clear();
  for (const id of cards.keys()) syncCard(id);
  onSelectionChange();
});

// ---- Avisos antes de generar ----
// Cuántos eligieron cada una de las 9 posiciones: vacía (nadie), cubierta
// (uno) o repetida (varios — solo uno juega ahí, ver assignDefenseByChoice).
// Los que quedaron "sin posición" rellenan las vacías.
function renderCoverage() {
  if (selection.size === 0) {
    coverageEl.hidden = true;
    return;
  }
  coverageEl.hidden = false;
  const count = new Map(DEFENSE_POSITIONS.map((pos) => [pos, 0]));
  let flexible = 0;
  for (const pos of selection.values()) {
    if (count.has(pos)) count.set(pos, count.get(pos) + 1);
    else if (!pos) flexible += 1;
  }
  const empty = DEFENSE_POSITIONS.filter((pos) => count.get(pos) === 0);
  const dup = DEFENSE_POSITIONS.filter((pos) => count.get(pos) > 1);
  const covered = DEFENSE_POSITIONS.length - empty.length;
  const uncovered = Math.max(0, empty.length - flexible);

  const warnings = [];
  if (selection.size < DEFENSE_POSITIONS.length) {
    const missing = DEFENSE_POSITIONS.length - selection.size;
    warnings.push({ level: "bad", text: `Faltan ${missing} ${missing === 1 ? "jugador" : "jugadores"} para llenar las 9 posiciones.` });
  }
  if (empty.length && flexible > 0) {
    const filled = empty.length - uncovered;
    warnings.push({
      level: "info",
      text: `${filled === 1 ? "1 jugador sin posición cubrirá" : `${filled} jugadores sin posición cubrirán`} ${uncovered ? `${filled} de ${empty.length} vacías` : empty.length === 1 ? "la vacía" : "las vacías"}.`,
    });
  }
  if (uncovered > 0 && selection.size >= DEFENSE_POSITIONS.length) {
    warnings.push({ level: "bad", text: `Nadie para ${listJoin(empty)}: cámbiale la posición a alguien o déjalo sin posición.` });
  }
  for (const pos of dup) {
    warnings.push({ level: "warn", text: `${pos}: ${count.get(pos)} jugadores — juega uno, los demás van a la banca.` });
  }

  const chipClass = (pos) => (count.get(pos) === 0 ? "is-empty" : count.get(pos) > 1 ? "is-dup" : "is-ok");
  coverageEl.innerHTML = `
    <div class="lu-coverage-head">
      <span class="lu-coverage-title">Posiciones cubiertas</span>
      <b class="lu-coverage-count${covered === 9 ? " is-full" : ""}">${covered}<small>/9</small></b>
    </div>
    <div class="lu-coverage-chips">
      ${DEFENSE_POSITIONS.map((pos) => `<span class="lu-pos-chip ${chipClass(pos)}" title="${count.get(pos)} ${count.get(pos) === 1 ? "jugador" : "jugadores"}">${pos}${count.get(pos) > 1 ? `<small>×${count.get(pos)}</small>` : ""}</span>`).join("")}
    </div>
    ${
      warnings.length
        ? `<ul class="lu-warnings">${warnings
            .map((w) => `<li class="lu-warn lu-warn--${w.level}"><i class="fa-solid ${w.level === "info" ? "fa-circle-info" : "fa-triangle-exclamation"}" aria-hidden="true"></i> ${escapeHtml(w.text)}</li>`)
            .join("")}</ul>`
        : ""
    }`;
}

function listJoin(items) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

// ---- Generar (respetando candados) ----
// Un jugador fijado conserva su posición y su turno al bat. Para eso se le
// "elige" su posición fijada para este juego, y a cualquier otro que haya
// elegido esa misma posición se le marca como ocupada (TAKEN no coincide con
// ninguna) — así el motor no le puede ganar el lugar al fijado. Después del
// orden calculado, los fijados vuelven a su turno y el resto llena los huecos.
const TAKEN = "__taken";
// Valor de "A la banca" en el selector de posición de la tabla.
const TO_BENCH = "__bench";

function generate() {
  const attendees = roster.filter((p) => selection.has(p.id));
  if (!attendees.length) return;
  const statsById = lineupStatsById(attendees);

  const prevRows = result?.rows ?? [];
  const lockedIds = new Set([...(result?.locked ?? [])].filter((id) => selection.has(id)));
  const lockedPos = new Map(prevRows.filter((r) => lockedIds.has(r.playerId)).map((r) => [r.playerId, r.position]));
  const lockedSlot = new Map();
  prevRows.filter((r) => !r.pitcherOnly).forEach((r, i) => {
    if (lockedIds.has(r.playerId)) lockedSlot.set(r.playerId, i);
  });
  const takenPositions = new Set(lockedPos.values());

  const gamePositionById = new Map(
    attendees.map((p) => {
      if (lockedPos.has(p.id)) return [p.id, lockedPos.get(p.id)];
      const choice = selection.get(p.id) || null;
      return [p.id, choice && takenPositions.has(choice) ? TAKEN : choice];
    })
  );

  const assignment = assignDefenseByChoice(attendees, gamePositionById, statsById);
  const { order, batterLabel, pitcherBats } = buildLineupFromAssignment(attendees, statsById, assignment, gamePositionById);

  let batters = order.map((r) => ({ playerId: r.playerId, position: batterLabel.get(r.playerId) ?? "" }));
  const slots = new Array(batters.length).fill(null);
  const free = [];
  for (const row of batters) {
    const s = lockedSlot.get(row.playerId);
    if (s != null && s < slots.length && !slots[s]) slots[s] = row;
    else free.push(row);
  }
  batters = slots.map((row) => row ?? free.shift());

  const rows = [...batters];
  if (!pitcherBats && assignment.P) rows.push({ playerId: assignment.P.playerId, position: "P", pitcherOnly: true });
  result = { rows, locked: new Set([...lockedIds].filter((id) => rows.some((r) => r.playerId === id))) };
  save();
  updateBar();
  renderResult();
  // Scroll calculado a mano (scrollIntoView suave fallaba en algunos
  // celulares) y ya con la alineación pintada.
  requestAnimationFrame(() => {
    const top = resultEl.getBoundingClientRect().top + window.scrollY - 76;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  });
}

generateBtn.addEventListener("click", generate);

// ---- Resultado ----

const upcomingGame = (() => {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [...SCHEDULE].filter((g) => g.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
})();

// "Axel Medina Ruiz" -> "Axel M." — cabe en la vista de campo.
function shortName(name) {
  const [first, second] = String(name ?? "").trim().split(/\s+/);
  return second ? `${first} ${second[0]}.` : first ?? "";
}

// Renglones del orden al bat con sus stats (para la tabla y el flyer).
// Es el mismo arreglo que reacomoda el arrastre (enableRowDrag).
function tableRowsFrom(rows, statsById) {
  let n = 0;
  return rows.map((r) => {
    const s = statsById.get(r.playerId) ?? emptyStats(r.playerId);
    const slotDisplay = r.pitcherOnly ? "P" : String(++n);
    return {
      playerId: r.playerId,
      position: r.position,
      pitcherOnly: !!r.pitcherOnly,
      slot: r.pitcherOnly ? rows.length : n,
      slotDisplay,
      name: s.name,
      AVG: s.AVG,
      OBP: s.OBP,
      SLG: s.SLG,
      OPS: s.OPS,
      HR: s.HR,
      RBI: s.RBI,
      JJ: s.seasonGP,
    };
  });
}

function lineupText(rows, bench) {
  const g = upcomingGame;
  const lines = ["⚾ CAIMANES DE VILLAS — LINEUP"];
  if (g) {
    const date = new Date(`${g.date}T00:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
    lines.push(`vs ${g.opponent ?? "Rival"} · ${date}${g.time ? ` · ${formatGameTime(g.time)}` : ""}`);
  }
  lines.push("");
  for (const r of rows) {
    lines.push(r.pitcherOnly ? `P: ${r.name}` : `${r.slotDisplay}. ${r.name} — ${r.position}`);
  }
  if (bench.length) lines.push("", `Banca: ${bench.map((b) => b.name).join(", ")}`);
  return lines.join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Sin permiso de portapapeles (o sin HTTPS): un textarea temporal.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

// Coordenadas (en % del campo) de cada posición en la vista de campo.
const FIELD_SPOTS = {
  CF: [50, 13],
  LF: [19, 27],
  RF: [81, 27],
  SS: [36, 45],
  "2B": [64, 45],
  "3B": [19, 58],
  "1B": [81, 58],
  P: [50, 64],
  C: [50, 90],
};

function fieldHtml(rows) {
  const byPos = new Map(rows.map((r) => [r.position, r]));
  const spot = (pos) => {
    const r = byPos.get(pos);
    const p = r && playerById.get(r.playerId);
    const [x, y] = FIELD_SPOTS[pos];
    return `
      <span class="lu-spot${p ? "" : " is-empty"}" style="left:${x}%;top:${y}%">
        <span class="lu-spot-pos">${pos}</span>
        <span class="lu-spot-name">${p ? `<b>${p.number ?? ""}</b> ${escapeHtml(shortName(p.name))}` : "Sin jugador"}</span>
      </span>`;
  };
  const extra = ["JD", "JC"]
    .map((pos) => {
      const r = byPos.get(pos);
      const p = r && playerById.get(r.playerId);
      return p ? `<span class="lu-extra"><span class="lu-spot-pos">${pos}</span> <b>${p.number ?? ""}</b> ${escapeHtml(p.name)}</span>` : "";
    })
    .join("");
  return `
    <div class="lu-field">
      <svg class="lu-field-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path class="lu-field-grass" d="M50 97 L4 51 A46 47 0 0 1 96 51 Z" />
        <path class="lu-field-infield" d="M50 92 L76 66 L50 40 L24 66 Z" />
        <circle class="lu-field-mound" cx="50" cy="66" r="3.2" />
        <rect class="lu-field-base" x="73.6" y="63.6" width="4.8" height="4.8" transform="rotate(45 76 66)" />
        <rect class="lu-field-base" x="47.6" y="37.6" width="4.8" height="4.8" transform="rotate(45 50 40)" />
        <rect class="lu-field-base" x="21.6" y="63.6" width="4.8" height="4.8" transform="rotate(45 24 66)" />
      </svg>
      ${DEFENSE_POSITIONS.map(spot).join("")}
    </div>
    ${extra ? `<div class="lu-extras">${extra}</div>` : ""}`;
}

// Repinta la alineación. Mientras se vuelve a pintar se conserva el alto:
// al vaciar el contenedor la página se encogía y, en celular, el scroll
// brincaba a la lista de jugadores (parecía que la alineación se había
// borrado). Si algo falla al pintar, se avisa en lugar de dejar el hueco.
function renderResult() {
  const h = resultEl.offsetHeight;
  if (h) resultEl.style.minHeight = `${h}px`;
  try {
    drawResult();
  } catch (err) {
    console.error(err);
    result = null;
    save();
    updateBar();
    resultEl.innerHTML = '<p class="lu-error"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> No se pudo mostrar la alineación. Vuelve a generarla.</p>';
  } finally {
    resultEl.style.minHeight = "";
  }
}

function drawResult() {
  resultEl.innerHTML = "";
  if (!result?.rows.length) return;

  const ids = new Set([...result.rows.map((r) => r.playerId), ...selection.keys()]);
  const statsById = lineupStatsById([...ids].map((id) => playerById.get(id)).filter(Boolean));
  const rows = tableRowsFrom(result.rows, statsById);
  const playing = new Set(rows.map((r) => r.playerId));
  const bench = [...selection.keys()]
    .filter((id) => !playing.has(id))
    .map((id) => statsById.get(id) ?? emptyStats(id))
    .sort(byRegularThenOps);

  const head = document.createElement("div");
  head.className = "lu-result-head";
  head.innerHTML = `<h3>Orden al bat</h3><div class="lu-result-actions"></div>`;
  const actions = head.querySelector(".lu-result-actions");
  actions.appendChild(
    shareButton(
      () =>
        openFlyer(
          (format, color) => lineupFlyer(rows, upcomingGame, format, color),
          `lineup${upcomingGame ? `-${upcomingGame.date}` : ""}`,
          "Lineup de Caimanes de Villas"
        ),
      "Imagen"
    )
  );
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "share-flyer-btn";
  copyBtn.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i> <span>Copiar texto</span>';
  copyBtn.addEventListener("click", async () => {
    const ok = await copyText(lineupText(rows, bench));
    const label = copyBtn.querySelector("span");
    label.textContent = ok ? "¡Copiado!" : "No se pudo copiar";
    setTimeout(() => (label.textContent = "Copiar texto"), 2000);
  });
  actions.appendChild(copyBtn);
  resultEl.appendChild(head);

  const columns = [
    {
      key: "drag",
      label: "",
      sticky: true,
      render: (_v, row) => (row.pitcherOnly ? "" : '<span class="drag-handle" title="Arrastra para cambiar el orden"><i class="fa-solid fa-grip-vertical"></i></span>'),
    },
    { key: "slot", label: "#", full: "Turno al bat", numeric: true, sticky: true, render: (_v, row) => row.slotDisplay },
    { key: "name", label: "Jugador", sticky: true, render: (v, row) => `${escapeHtml(v)}${injuredIcon(row.playerId)}` },
    {
      key: "lock",
      label: "Fijar",
      full: "Fijar: conserva turno y posición al volver a generar",
      render: (_v, row) => {
        const on = result.locked.has(row.playerId);
        return `<button type="button" class="lu-lock${on ? " is-on" : ""}" data-player="${row.playerId}" aria-pressed="${on}" title="${on ? "Fijado — no se mueve al volver a generar" : "Fijar turno y posición"}"><i class="fa-solid ${on ? "fa-lock" : "fa-lock-open"}"></i></button>`;
      },
    },
    {
      key: "position",
      label: "Pos",
      full: "Posición",
      // La posición se puede CAMBIAR desde aquí (si otro la tenía, se
      // intercambian) o mandar al jugador a la banca. El pitcher no cambia
      // de posición (se elige en la lista), pero sí puede irse a la banca.
      render: (v, row) =>
        `<select class="pos-select" data-player="${row.playerId}" aria-label="Posición de ${escapeHtml(row.name)}">${(v === "P" ? ["P"] : EDITABLE_POSITIONS)
          .map((p) => `<option value="${p}"${p === v ? " selected" : ""}>${p}</option>`)
          .join("")}<option value="${TO_BENCH}">A la banca</option></select>`,
    },
    { key: "AVG", label: "AVG", full: "Promedio", numeric: true },
    { key: "OBP", label: "OBP", full: "Porcentaje de embasado", numeric: true },
    { key: "OPS", label: "OPS", full: "OBP + SLG", numeric: true },
    { key: "HR", label: "HR", full: "Home runs", numeric: true },
    { key: "RBI", label: "RBI", full: "Impulsadas", numeric: true },
    { key: "JJ", label: "JJ", full: "Juegos jugados en temporada regular", numeric: true },
  ];

  const tableEl = document.createElement("div");
  resultEl.appendChild(tableEl);
  const fieldWrap = document.createElement("div");

  // Tras arrastrar o cambiar una posición: renumerar, guardar y repintar.
  function commit() {
    let n = 0;
    for (const r of rows) {
      if (r.pitcherOnly) continue;
      r.slot = ++n;
      r.slotDisplay = String(n);
    }
    result.rows = rows.map((r) => ({ playerId: r.playerId, position: r.position, pitcherOnly: r.pitcherOnly }));
    save();
    drawTable();
    fieldWrap.innerHTML = fieldHtml(rows);
  }

  function drawTable() {
    renderSortableTable(tableEl, {
      columns,
      rows,
      defaultSort: "slot",
      defaultDir: 1,
      sortable: false,
      rowClass: (row) => [row.pitcherOnly ? "row-locked" : "", result.locked.has(row.playerId) ? "row-pinned" : ""].filter(Boolean).join(" "),
    });
  }
  drawTable();
  enableRowDrag(tableEl, rows, commit);

  tableEl.addEventListener("change", (e) => {
    const select = e.target.closest(".pos-select");
    if (!select) return;
    const row = rows.find((r) => r.playerId === select.dataset.player);
    if (!row) return;
    // A la banca: sale del orden al bat (y pierde su candado); su posición
    // queda vacía para meter a alguien desde la banca.
    if (select.value === TO_BENCH) {
      result.rows = rows.filter((r) => r !== row).map((r) => ({ playerId: r.playerId, position: r.position, pitcherOnly: r.pitcherOnly }));
      result.locked.delete(row.playerId);
      save();
      renderResult();
      return;
    }
    const other = rows.find((r) => r !== row && r.position === select.value);
    if (other) other.position = row.position;
    row.position = select.value;
    commit();
  });

  tableEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".lu-lock");
    if (!btn) return;
    const id = btn.dataset.player;
    if (result.locked.has(id)) result.locked.delete(id);
    else result.locked.add(id);
    save();
    drawTable();
  });

  const fieldHead = document.createElement("h3");
  fieldHead.textContent = "En el campo";
  resultEl.appendChild(fieldHead);
  fieldWrap.innerHTML = fieldHtml(rows);
  resultEl.appendChild(fieldWrap);

  if (bench.length) {
    const benchHead = document.createElement("h3");
    benchHead.textContent = "Banca";
    resultEl.appendChild(benchHead);
    // Cada quien en la banca puede entrar: en lugar de alguien alineado
    // (toma su turno y su posición; el otro pasa a la banca) o en una
    // posición que haya quedado vacía.
    const taken = new Set(rows.map((r) => r.position));
    const emptyPositions = [...DEFENSE_POSITIONS, "JD", "JC"].filter((pos) => !taken.has(pos));
    const subOptions = `
      <option value="" selected disabled>Entrar…</option>
      <optgroup label="En lugar de">${rows
        .map((r) => `<option value="row:${r.playerId}">${escapeHtml(shortName(r.name))} (${r.position})</option>`)
        .join("")}</optgroup>
      ${emptyPositions.length ? `<optgroup label="Posición vacía">${emptyPositions.map((pos) => `<option value="pos:${pos}">${pos}</option>`).join("")}</optgroup>` : ""}`;

    const benchEl = document.createElement("div");
    benchEl.className = "lu-bench";
    benchEl.innerHTML = bench
      .map((s) => {
        const p = playerById.get(s.playerId);
        const pos = p && primaryPosition(p);
        return `
          <span class="lu-bench-item">
            ${p ? renderAvatar(p, 34) : ""}
            <span class="lu-bench-info">
              <b>${escapeHtml(s.name)}${injuredIcon(s.playerId)}</b>
              <small>${pos ? `${pos} · ` : ""}OPS ${s.OPS} · ${s.seasonGP} JJ</small>
            </span>
            <select class="lu-sub" data-player="${s.playerId}" aria-label="Meter a ${escapeHtml(s.name)} a la alineación">${subOptions}</select>
          </span>`;
      })
      .join("");
    benchEl.addEventListener("change", (e) => {
      const select = e.target.closest(".lu-sub");
      if (!select?.value) return;
      const inId = select.dataset.player;
      const [kind, value] = select.value.split(":");
      const next = rows.map((r) => ({ playerId: r.playerId, position: r.position, pitcherOnly: r.pitcherOnly }));
      if (kind === "row") {
        const target = next.find((r) => r.playerId === value);
        if (!target) return;
        target.playerId = inId;
        result.locked.delete(value);
      } else if (value === "P" && next.some((r) => r.position === "JD")) {
        // Con JD el pitcher no batea: va al final, fuera del orden.
        next.push({ playerId: inId, position: "P", pitcherOnly: true });
      } else {
        // Al final del orden al bat (antes del pitcher que no batea).
        const at = next.findIndex((r) => r.pitcherOnly);
        next.splice(at < 0 ? next.length : at, 0, { playerId: inId, position: value, pitcherOnly: false });
      }
      result.rows = next;
      save();
      renderResult();
    });
    resultEl.appendChild(benchEl);
  }
}

// ---- Arranque: recuperar lo guardado ----
// Cada paso por separado: si uno falla, los demás igual se pintan.
for (const step of [load, () => cards.forEach((_c, id) => syncCard(id)), updateBar, renderCoverage, renderResult]) {
  try {
    step();
  } catch (err) {
    console.error(err);
  }
}
