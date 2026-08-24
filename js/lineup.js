// Motor de alineación: arma las 9 posiciones defensivas y el orden al bat a
// partir de un roster candidato. Es el mismo cálculo que usa la pestaña
// "Alineación" (con todo el equipo) y la herramienta lineup.html (con solo
// los jugadores que asisten a un juego) — viven aquí para no duplicarlo.
import { GAMES } from "./data.js";
import { battingTotals, playerName } from "./stats.js";
import { renderSortableTable, renderPositionBadge } from "./ui.js";

export const DEFENSE_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

export function positionsOf(value) {
  if (!value) return [];
  return value.split("/").map((v) => v.trim()).filter(Boolean);
}

function emptyStats(playerId) {
  return { playerId, name: playerName(playerId), G: 0, AVG: ".000", OBP: ".000", SLG: ".000", OPS: ".000", HR: 0, RBI: 0, SB: 0 };
}

// La primera posición listada en el roster (ej. "SS" en "SS/LF/CF") es la
// posición principal del jugador.
export function primaryPosition(player) {
  return positionsOf(player.position)[0] ?? null;
}

// Las posiciones de campo (de las 9) que el jugador tiene registradas en el
// roster. Filtra códigos que no son posición de campo (DH, UTIL, JC, JD) —
// esos no cuentan como elegibles para un lugar defensivo.
export function registeredFieldPositions(player) {
  return positionsOf(player.position).filter((pos) => DEFENSE_POSITIONS.includes(pos));
}

// Asigna las 9 posiciones en dos pasadas, usando solo candidatos de `roster`
// (todo el equipo, o el subconjunto que asiste a un juego):
// 1) cada jugador va a su posición principal si está libre (mejor OPS decide
//    cuando dos jugadores comparten la misma posición principal).
// 2) las posiciones que quedaron vacías se llenan con posiciones secundarias
//    disponibles, resolviendo primero las que tengan menos candidatos.
export function assignDefense(roster, statsById) {
  const used = new Set();
  const assignment = {};

  function statsFor(p) {
    return statsById.get(p.id) ?? emptyStats(p.id);
  }

  for (const pos of DEFENSE_POSITIONS) {
    const candidates = roster
      .filter((p) => primaryPosition(p) === pos && !used.has(p.id))
      .map(statsFor)
      .sort((a, b) => Number(b.OPS) - Number(a.OPS));
    if (candidates.length > 0) {
      assignment[pos] = candidates[0];
      used.add(candidates[0].playerId);
    }
  }

  const remaining = new Set(DEFENSE_POSITIONS.filter((pos) => !assignment[pos]));
  while (remaining.size > 0) {
    let bestPos = null;
    let bestCandidates = null;
    for (const pos of remaining) {
      const candidates = roster
        .filter((p) => positionsOf(p.position).includes(pos) && !used.has(p.id))
        .map(statsFor)
        .sort((a, b) => Number(b.OPS) - Number(a.OPS));
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

// Variante de assignDefense para lineup.html: en vez de derivar la posición
// del roster, cada jugador ya trae una posición elegida para ESTE juego
// (`gamePositionById`) — su principal por default, pero el usuario puede
// cambiarla a cualquier otra o dejarla en null ("sin posición", que decida
// el algoritmo). Al ser una sola posición explícita por jugador, no hay
// pasada de "posición secundaria": si dos coinciden en la misma posición,
// el que pierde no se reacomoda solo, pasa a la banca (a menos que el
// usuario le haya puesto otra posición a mano).
//
// Las posiciones que quedan vacías se llenan con quienes se dejaron en "sin
// posición", del mejor OPS hacia abajo. Esto es bateo, no fildeo — es el
// único dato que hay; no es una evaluación defensiva real, solo evita dejar
// la posición vacía si hay alguien disponible.
export function assignDefenseByChoice(roster, gamePositionById, statsById) {
  const used = new Set();
  const assignment = {};

  function statsFor(p) {
    return statsById.get(p.id) ?? emptyStats(p.id);
  }

  for (const pos of DEFENSE_POSITIONS) {
    const candidates = roster
      .filter((p) => gamePositionById.get(p.id) === pos && !used.has(p.id))
      .map(statsFor)
      .sort((a, b) => Number(b.OPS) - Number(a.OPS));
    if (candidates.length > 0) {
      assignment[pos] = candidates[0];
      used.add(candidates[0].playerId);
    }
  }

  const flexible = roster
    .filter((p) => !gamePositionById.get(p.id) && !used.has(p.id))
    .map(statsFor)
    .sort((a, b) => Number(b.OPS) - Number(a.OPS));

  for (const pos of DEFENSE_POSITIONS) {
    if (assignment[pos]) continue;
    const next = flexible.shift();
    if (next) {
      assignment[pos] = next;
      used.add(next.playerId);
    }
  }

  return assignment;
}

// Heurística clásica simplificada: el 4to bat (cleanup) se reserva primero
// para el líder de home runs, sin importar su OBP. Luego 1-2 mejor OBP
// (table-setters) y 3 mejor OPS (mejor bateador) salen del resto del grupo;
// el resto se acomoda por OPS.
export function battingOrder(rows) {
  const pool = [...rows];

  function takeBestBy(scoreFn) {
    if (pool.length === 0) return null;
    let bestIdx = 0;
    let bestScore = scoreFn(pool[0]);
    for (let i = 1; i < pool.length; i++) {
      const score = scoreFn(pool[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return pool.splice(bestIdx, 1)[0];
  }

  const cleanup = takeBestBy((r) => r.HR * 1000 + Number(r.OPS));
  const slot1 = takeBestBy((r) => Number(r.OBP));
  const slot2 = takeBestBy((r) => Number(r.OBP));
  const slot3 = takeBestBy((r) => Number(r.OPS));

  const order = [slot1, slot2, slot3, cleanup].filter(Boolean);
  while (pool.length > 0) order.push(takeBestBy((r) => Number(r.OPS)));
  return order;
}

// A partir de una asignación defensiva YA HECHA (por assignDefense o por
// assignDefenseByChoice), arma el resto: banca y orden al bat. El pitcher no
// batea en esta liga: el mejor bateador de banca disponible (un JD, Jugador
// Designado) toma su turno, y el siguiente mejor de banca entra como JC
// (Jugador de Cortesía) — ninguno de los dos juega campo. Sin banca, el
// pitcher batea por su cuenta.
export function buildLineupFromAssignment(roster, statsById, assignment) {
  const usedIds = new Set(Object.values(assignment).filter(Boolean).map((r) => r.playerId));

  function bestBenchPlayer() {
    return (
      roster
        .filter((p) => !usedIds.has(p.id))
        .map((p) => statsById.get(p.id) ?? emptyStats(p.id))
        .sort((a, b) => Number(b.OPS) - Number(a.OPS))[0] ?? null
    );
  }

  const batterLabel = new Map();
  const starters = [];

  for (const pos of DEFENSE_POSITIONS.filter((p) => p !== "P")) {
    const row = assignment[pos];
    if (row) {
      starters.push(row);
      batterLabel.set(row.playerId, pos);
    }
  }

  const jd = bestBenchPlayer();
  let pitcherBats = false;
  if (jd) {
    usedIds.add(jd.playerId);
    starters.push(jd);
    batterLabel.set(jd.playerId, "JD");
  } else if (assignment.P) {
    starters.push(assignment.P);
    batterLabel.set(assignment.P.playerId, "P");
    pitcherBats = true;
  }

  const jc = bestBenchPlayer();
  if (jc) {
    usedIds.add(jc.playerId);
    starters.push(jc);
    batterLabel.set(jc.playerId, "JC");
  }

  const order = battingOrder(starters);
  return { assignment, order, batterLabel, pitcherBats };
}

// Arma la alineación completa (defensa + orden al bat) derivando la defensa
// de las posiciones registradas en el roster — lo que usa la pestaña
// Alineación con todo el equipo, sin elección manual por jugador.
export function buildLineup(roster, statsById) {
  return buildLineupFromAssignment(roster, statsById, assignDefense(roster, statsById));
}

// Pinta las dos secciones (orden al bat + posiciones sugeridas) dentro de
// `container` a partir de un roster candidato. `container` se limpia
// primero — se puede volver a llamar para regenerar con otro roster.
//
// `gamePositionById` es opcional: un Map playerId -> posición elegida para
// este juego (o null/"" para "sin posición"). Si se omite, la defensa se
// deriva de las posiciones registradas en el roster (lo que usa la pestaña
// Alineación); si se da, cada jugador va a la posición que se le eligió a
// mano (lo que usa lineup.html).
export function renderLineupResult(container, roster, gamePositionById = null) {
  container.innerHTML = "";

  if (roster.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = "No hay jugadores seleccionados.";
    container.appendChild(p);
    return;
  }

  const statsById = new Map(battingTotals(GAMES).map((r) => [r.playerId, r]));
  const assignment = gamePositionById
    ? assignDefenseByChoice(roster, gamePositionById, statsById)
    : assignDefense(roster, statsById);
  const { order, batterLabel, pitcherBats } = buildLineupFromAssignment(roster, statsById, assignment);

  const orderHeading = document.createElement("h3");
  orderHeading.textContent = "Orden al bat sugerido";
  container.appendChild(orderHeading);

  const orderRows = order.map((row, i) => ({
    slot: i + 1,
    slotDisplay: String(i + 1),
    name: row.name,
    position: batterLabel.get(row.playerId) ?? "",
    AVG: row.AVG,
    OBP: row.OBP,
    SLG: row.SLG,
    OPS: row.OPS,
    HR: row.HR,
    RBI: row.RBI,
  }));

  // El pitcher no batea, pero se muestra al final como referencia de quién
  // ocupa esa posición defensiva.
  if (!pitcherBats && assignment.P) {
    const pitcherStats = statsById.get(assignment.P.playerId) ?? emptyStats(assignment.P.playerId);
    orderRows.push({
      slot: orderRows.length + 1,
      slotDisplay: "P",
      name: pitcherStats.name,
      position: "P",
      AVG: pitcherStats.AVG,
      OBP: pitcherStats.OBP,
      SLG: pitcherStats.SLG,
      OPS: pitcherStats.OPS,
      HR: pitcherStats.HR,
      RBI: pitcherStats.RBI,
    });
  }

  const orderColumns = [
    { key: "slot", label: "#", full: "Turno al bat", numeric: true, sticky: true, render: (_v, row) => row.slotDisplay },
    { key: "name", label: "Jugador", sticky: true },
    { key: "position", label: "Pos", full: "Posición", render: (v) => renderPositionBadge(v) },
    { key: "AVG", label: "AVG", full: "Promedio", numeric: true },
    { key: "OBP", label: "OBP", full: "Porcentaje de embasado", numeric: true },
    { key: "SLG", label: "SLG", full: "Porcentaje de slugging", numeric: true },
    { key: "OPS", label: "OPS", full: "OBP + SLG", numeric: true },
    { key: "HR", label: "HR", full: "Home runs", numeric: true },
    { key: "RBI", label: "RBI", full: "Impulsadas", numeric: true },
  ];

  const orderEl = document.createElement("div");
  container.appendChild(orderEl);
  renderSortableTable(orderEl, {
    columns: orderColumns,
    rows: orderRows,
    defaultSort: "slot",
    defaultDir: 1,
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
        <span class="card-label">${row ? `OPS ${row.OPS}` : "No hay nadie disponible en esta posición"}</span>
      </div>
    `;
  }).join("");
  container.appendChild(defenseGrid);

  // Banca: del roster candidato, quien no quedó en el campo ni bateando
  // (ni titular, ni JD, ni JC, ni el pitcher). Antes desaparecían del
  // resultado sin más — así queda claro quién sigue disponible para entrar.
  const playingIds = new Set([...order.map((r) => r.playerId), assignment.P?.playerId].filter(Boolean));
  const bench = roster
    .filter((p) => !playingIds.has(p.id))
    .map((p) => statsById.get(p.id) ?? emptyStats(p.id))
    .sort((a, b) => Number(b.OPS) - Number(a.OPS));

  if (bench.length > 0) {
    const benchHeading = document.createElement("h3");
    benchHeading.textContent = "Banca";
    container.appendChild(benchHeading);

    const benchGrid = document.createElement("div");
    benchGrid.className = "bench-grid";
    benchGrid.innerHTML = bench
      .map((row) => {
        const pos = primaryPosition(roster.find((p) => p.id === row.playerId));
        return `
          <div class="card">
            ${pos ? `<div style="margin-bottom: 6px;">${renderPositionBadge(pos)}</div>` : ""}
            <span class="card-value" style="font-size: 1.1rem;">${row.name}</span>
            <span class="card-label">OPS ${row.OPS}</span>
          </div>
        `;
      })
      .join("");
    container.appendChild(benchGrid);
  }
}
