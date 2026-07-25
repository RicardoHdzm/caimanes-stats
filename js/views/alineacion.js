import { PLAYERS, GAMES } from "../data.js";
import { battingTotals, playerName } from "../stats.js";
import { heading, renderSortableTable, renderPositionBadge } from "../ui.js";

const DEFENSE_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

function positionsOf(value) {
  if (!value) return [];
  return value.split("/").map((v) => v.trim()).filter(Boolean);
}

function emptyStats(playerId) {
  return { playerId, name: playerName(playerId), G: 0, AVG: ".000", OBP: ".000", SLG: ".000", OPS: ".000", HR: 0, RBI: 0, SB: 0 };
}

// Asigna cada una de las 9 posiciones al mejor candidato disponible (por OPS),
// resolviendo primero las posiciones con menos candidatos elegibles para no
// dejarlas sin cubrir por un jugador multi-posición tomado antes en otro lado.
function assignDefense(statsById) {
  const used = new Set();
  const remaining = new Set(DEFENSE_POSITIONS);
  const assignment = {};

  function candidatesFor(pos) {
    return PLAYERS.filter((p) => positionsOf(p.position).includes(pos) && !used.has(p.id))
      .map((p) => statsById.get(p.id) ?? emptyStats(p.id))
      .sort((a, b) => Number(b.OPS) - Number(a.OPS));
  }

  while (remaining.size > 0) {
    let bestPos = null;
    let bestCandidates = null;
    for (const pos of remaining) {
      const candidates = candidatesFor(pos);
      if (bestCandidates === null || candidates.length < bestCandidates.length) {
        bestPos = pos;
        bestCandidates = candidates;
      }
    }
    assignment[bestPos] = bestCandidates[0] ?? null;
    if (bestCandidates[0]) used.add(bestCandidates[0].playerId);
    remaining.delete(bestPos);
  }
  return assignment;
}

// Heurística clásica simplificada: 1-2 mejor OBP (table-setters), 3 mejor OPS
// (mejor bateador), 4 mejor SLG (poder/cuarto bat), el resto por OPS.
function battingOrder(rows) {
  const pool = [...rows];

  function takeBest(key) {
    if (pool.length === 0) return null;
    let bestIdx = 0;
    for (let i = 1; i < pool.length; i++) {
      if (Number(pool[i][key]) > Number(pool[bestIdx][key])) bestIdx = i;
    }
    return pool.splice(bestIdx, 1)[0];
  }

  const order = [];
  for (const key of ["OBP", "OBP", "OPS", "SLG"]) {
    const picked = takeBest(key);
    if (picked) order.push(picked);
  }
  while (pool.length > 0) order.push(takeBest("OPS"));
  return order;
}

export function renderAlineacion(container) {
  heading(
    container,
    "Sugerencia de alineación",
    "Calculada solo con stats de bateo y las posiciones registradas en el roster — no considera condición física, lesiones ni criterio del cuerpo técnico."
  );

  const battingList = battingTotals(GAMES);
  const statsById = new Map(battingList.map((r) => [r.playerId, r]));

  const assignment = assignDefense(statsById);
  const positionByPlayer = new Map();
  for (const [pos, row] of Object.entries(assignment)) {
    if (row) positionByPlayer.set(row.playerId, pos);
  }

  const starters = Object.values(assignment).filter(Boolean);
  const order = battingOrder(starters);

  const orderHeading = document.createElement("h3");
  orderHeading.textContent = "Orden al bat sugerido";
  container.appendChild(orderHeading);

  const orderRows = order.map((row, i) => ({
    slot: i + 1,
    name: row.name,
    position: positionByPlayer.get(row.playerId) ?? "",
    AVG: row.AVG,
    OBP: row.OBP,
    SLG: row.SLG,
    OPS: row.OPS,
    HR: row.HR,
    RBI: row.RBI,
  }));

  const orderColumns = [
    { key: "slot", label: "#", full: "Turno al bat", numeric: true },
    { key: "name", label: "Jugador" },
    { key: "position", label: "Pos", full: "Posición", render: (v) => renderPositionBadge(v) },
    { key: "AVG", label: "AVG", full: "Promedio", numeric: true },
    { key: "OBP", label: "OBP", full: "Porcentaje de embasado", numeric: true },
    { key: "SLG", label: "SLG", full: "Porcentaje de slugging", numeric: true },
    { key: "OPS", label: "OPS", full: "OBP + SLG", numeric: true },
    { key: "HR", label: "HR", full: "Jonrones", numeric: true },
    { key: "RBI", label: "RBI", full: "Impulsadas", numeric: true },
  ];

  const orderEl = document.createElement("div");
  container.appendChild(orderEl);
  renderSortableTable(orderEl, {
    columns: orderColumns,
    rows: orderRows,
    defaultSort: "slot",
    defaultDir: 1,
    onRowClick: undefined,
  });

  const defenseHeading = document.createElement("h3");
  defenseHeading.textContent = "Posiciones sugeridas";
  container.appendChild(defenseHeading);

  const defenseGrid = document.createElement("div");
  defenseGrid.className = "cards grid-3";
  defenseGrid.innerHTML = DEFENSE_POSITIONS.map((pos) => {
    const row = assignment[pos];
    return `
      <div class="card">
        <div style="margin-bottom: 6px;">${renderPositionBadge(pos)}</div>
        <span class="card-value" style="font-size: 1.2rem;">${row ? row.name : "Sin jugador"}</span>
        <span class="card-label">${row ? `OPS ${row.OPS}` : "No hay nadie registrado en esta posición"}</span>
      </div>
    `;
  }).join("");
  container.appendChild(defenseGrid);
}
