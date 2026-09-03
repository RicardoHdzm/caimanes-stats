import { PLAYERS, GAMES } from "../data.js";
import { battingTotals, pitchingTotals, fieldingTotals, gamesPlayedByPlayer } from "../stats.js";
import { renderAvatar, renderPositionBadges } from "../ui.js";
import { getSession } from "../auth.js";

// dir: 1 = gana el número más alto, -1 = gana el más bajo (ponches, errores,
// ERA...). `decimals` marca las stats que se comparan como número con punto
// decimal en vez de entero.
const BATTING_ROWS = [
  { key: "G", label: "Juegos", dir: 1 },
  { key: "AB", label: "Turnos al bat", dir: 1 },
  { key: "H", label: "Hits", dir: 1 },
  { key: "2B", label: "Dobles", dir: 1 },
  { key: "3B", label: "Triples", dir: 1 },
  { key: "HR", label: "Home runs", dir: 1 },
  { key: "HRC", label: "HR de campo", dir: 1 },
  { key: "R", label: "Carreras", dir: 1 },
  { key: "RBI", label: "Impulsadas", dir: 1 },
  { key: "BB", label: "Bases por bolas", dir: 1 },
  { key: "SO", label: "Ponches", dir: -1 },
  { key: "SB", label: "Bases robadas", dir: 1 },
  { key: "AVG", label: "AVG", dir: 1, decimals: true },
  { key: "OBP", label: "OBP", dir: 1, decimals: true },
  { key: "SLG", label: "SLG", dir: 1, decimals: true },
  { key: "OPS", label: "OPS", dir: 1, decimals: true },
];

const PITCHING_ROWS = [
  { key: "G", label: "Juegos", dir: 1 },
  { key: "IP", label: "Entradas", dir: 1, decimals: true },
  { key: "H", label: "Hits permitidos", dir: -1 },
  { key: "R", label: "Carreras permitidas", dir: -1 },
  { key: "ER", label: "Carreras limpias", dir: -1 },
  { key: "BB", label: "Bases por bolas", dir: -1 },
  { key: "SO", label: "Ponches", dir: 1 },
  { key: "ERA", label: "ERA", dir: -1, decimals: true },
  { key: "WHIP", label: "WHIP", dir: -1, decimals: true },
];

const FIELDING_ROWS = [
  { key: "PO", label: "Outs (PO)", dir: 1 },
  { key: "A", label: "Asistencias", dir: 1 },
  { key: "E", label: "Errores", dir: -1 },
  { key: "FPCT", label: "FPCT", dir: 1, decimals: true },
];

function playerSelect(id, selectedId) {
  const options = PLAYERS.map(
    (p) => `<option value="${p.id}"${p.id === selectedId ? " selected" : ""}>${p.number != null ? `#${p.number} · ` : ""}${p.name}</option>`
  ).join("");
  return `<select class="compare-select" id="${id}">${options}</select>`;
}

// Una fila de la comparación: valor izquierdo, etiqueta al centro, valor
// derecho, con el ganador resaltado. Empate = nadie resaltado.
function comparisonRow(row, leftStats, rightStats) {
  const rawLeft = leftStats?.[row.key];
  const rawRight = rightStats?.[row.key];
  const left = rawLeft ?? (row.decimals ? "—" : 0);
  const right = rawRight ?? (row.decimals ? "—" : 0);

  const leftNum = Number(rawLeft);
  const rightNum = Number(rawRight);
  const comparable = Number.isFinite(leftNum) && Number.isFinite(rightNum);

  let leftClass = "";
  let rightClass = "";
  if (comparable && leftNum !== rightNum) {
    const leftWins = row.dir === 1 ? leftNum > rightNum : leftNum < rightNum;
    leftClass = leftWins ? "compare-win" : "compare-lose";
    rightClass = leftWins ? "compare-lose" : "compare-win";
  }

  return `
    <div class="compare-row">
      <span class="compare-value ${leftClass}">${left}</span>
      <span class="compare-label">${row.label}</span>
      <span class="compare-value ${rightClass}">${right}</span>
    </div>
  `;
}

function comparisonBlock(title, rows, leftStats, rightStats) {
  // Si ninguno de los dos tiene datos de este rubro, la sección no aparece.
  if (!leftStats && !rightStats) return "";
  return `
    <h3>${title}</h3>
    <div class="compare-block">
      ${rows.map((row) => comparisonRow(row, leftStats, rightStats)).join("")}
    </div>
  `;
}

function playerHeader(player, played) {
  return `
    <div class="compare-player">
      ${renderAvatar(player, 72)}
      <span class="compare-name">${player.name}</span>
      <span class="compare-number">#${player.number ?? "-"}</span>
      <span class="compare-positions">${player.position ? renderPositionBadges(player.position) : ""}</span>
      <span class="compare-games">${played} juego${played === 1 ? "" : "s"}</span>
    </div>
  `;
}

// Cabezas + los 3 bloques de stats — todo lo que hay debajo del picker (o,
// en la versión sin picker de renderLockedComparison, todo lo que hay).
// Compartido para no duplicar esta parte entre las dos vistas.
function comparisonBody(leftId, rightId) {
  const left = PLAYERS.find((p) => p.id === leftId);
  const right = PLAYERS.find((p) => p.id === rightId);
  if (!left || !right) return "";

  const batting = battingTotals(GAMES);
  const pitching = pitchingTotals(GAMES);
  const fielding = fieldingTotals(GAMES);
  const played = gamesPlayedByPlayer(GAMES);
  const find = (list, id) => list.find((r) => r.playerId === id) ?? null;

  return `
    <div class="compare-heads">
      ${playerHeader(left, played.get(left.id) ?? 0)}
      ${playerHeader(right, played.get(right.id) ?? 0)}
    </div>
    ${comparisonBlock("Bateo", BATTING_ROWS, find(batting, left.id), find(batting, right.id))}
    ${comparisonBlock("Pitcheo", PITCHING_ROWS, find(pitching, left.id), find(pitching, right.id))}
    ${comparisonBlock("Fildeo", FIELDING_ROWS, find(fielding, left.id), find(fielding, right.id))}
  `;
}

// Comparación fija tú-vs-él, sin selects — al final del perfil de OTRO
// jugador (nunca el tuyo propio). Misma lógica y estilos que
// renderComparar, solo que no se puede cambiar a quién comparas: ver
// js/views/jugador.js.
export function renderLockedComparison(container, meId, otherId) {
  const h3 = document.createElement("h3");
  h3.textContent = "Comparación contigo";
  container.appendChild(h3);

  const wrap = document.createElement("div");
  wrap.innerHTML = comparisonBody(meId, otherId);
  container.appendChild(wrap);
}

// Se dibuja al final de la vista de Alineación. `leftId`/`rightId` vienen de
// la URL (#/alineacion/p1/p2) para poder compartir una comparación armada.
export function renderComparar(container, leftId, rightId) {
  const h3 = document.createElement("h3");
  h3.textContent = "Comparar jugadores";
  container.appendChild(h3);

  // Solo con cuenta iniciada — a diferencia de RSVP/MVP (públicos para leer,
  // con cuenta solo para participar), aquí ni el propio comparador se
  // muestra sin sesión.
  if (!getSession()) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = "Inicia sesión para comparar jugadores.";
    container.appendChild(p);
    return;
  }

  if (PLAYERS.length < 2) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = "Se necesitan al menos dos jugadores en el roster para comparar.";
    container.appendChild(p);
    return;
  }

  const batting = battingTotals(GAMES);
  const pitching = pitchingTotals(GAMES);
  const fielding = fieldingTotals(GAMES);
  const played = gamesPlayedByPlayer(GAMES);

  const find = (list, id) => list.find((r) => r.playerId === id) ?? null;

  const wrap = document.createElement("div");
  container.appendChild(wrap);

  function draw(wantedLeft, wantedRight) {
    // Sin selección explícita arranca con los dos primeros del roster; así la
    // sección nunca aparece vacía.
    const left = PLAYERS.find((p) => p.id === wantedLeft) ?? PLAYERS[0];
    const right =
      PLAYERS.find((p) => p.id === wantedRight) ?? PLAYERS.find((p) => p.id !== left.id) ?? PLAYERS[1];

    wrap.innerHTML = `
      <div class="compare-picker">
        ${playerSelect("compare-left", left.id)}
        <span class="compare-vs">VS</span>
        ${playerSelect("compare-right", right.id)}
      </div>
      <div class="compare-heads">
        ${playerHeader(left, played.get(left.id) ?? 0)}
        ${playerHeader(right, played.get(right.id) ?? 0)}
      </div>
      ${comparisonBlock("Bateo", BATTING_ROWS, find(batting, left.id), find(batting, right.id))}
      ${comparisonBlock("Pitcheo", PITCHING_ROWS, find(pitching, left.id), find(pitching, right.id))}
      ${comparisonBlock("Fildeo", FIELDING_ROWS, find(fielding, left.id), find(fielding, right.id))}
    `;

    const leftSelect = wrap.querySelector("#compare-left");
    const rightSelect = wrap.querySelector("#compare-right");

    function onChange() {
      // Se redibuja solo esta sección en vez de cambiar el hash: si el router
      // volviera a montar toda la vista, la página saltaría hasta arriba y el
      // comparador vive hasta abajo. La URL se actualiza con replaceState —
      // que no dispara hashchange — para que siga siendo compartible.
      const nextLeft = leftSelect.value;
      const nextRight = rightSelect.value;
      history.replaceState(null, "", `#/alineacion/${nextLeft}/${nextRight}`);
      draw(nextLeft, nextRight);
    }

    leftSelect.addEventListener("change", onChange);
    rightSelect.addEventListener("change", onChange);
  }

  draw(leftId, rightId);
}
