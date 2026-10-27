// Motor de alineación: arma las 9 posiciones defensivas y el orden al bat a
// partir de un roster candidato. Es el mismo cálculo que usa la pestaña
// "Alineación" (con todo el equipo) y la herramienta lineup/ (con solo
// los jugadores que asisten a un juego) — viven aquí para no duplicarlo.
import { battingTotals, playerName, allStatGames, currentSeasonGames, gamesPlayedByPlayer } from "./stats.js";
import { renderSortableTable, renderPositionBadge } from "./ui.js";
import { getCurrentPlayerId } from "./auth.js";
import { SCHEDULE } from "./data.js";
import { lineupFlyer, openFlyer, shareButton } from "./flyers.js";

export const DEFENSE_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
// Lo que se puede elegir en el selector de posición del orden al bat en
// lineup/ — todo menos P (el pitcher se elige en la lista de asistentes).
const EDITABLE_POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "JD", "JC"];

export function positionsOf(value) {
  if (!value) return [];
  return value.split("/").map((v) => v.trim()).filter(Boolean);
}

function emptyStats(playerId) {
  return { playerId, name: playerName(playerId), G: 0, AVG: ".000", OBP: ".000", SLG: ".000", OPS: ".000", HR: 0, RBI: 0, SB: 0, seasonGP: 0, regular: false };
}

// Criterio principal de TODA elección del motor (quién se queda con una
// posición, JD/JC, orden de la banca): primero los "regulares" — jugaron
// la MITAD O MÁS de los juegos de temporada regular hasta el momento (ver
// `regular` en renderLineupResult) — y ya entre iguales, mejor OPS. A
// petición expresa: alguien que casi no viene no le gana el lugar a uno
// constante solo por un par de buenos juegos.
function byRegularThenOps(a, b) {
  if (a.regular !== b.regular) return a.regular ? -1 : 1;
  return Number(b.OPS) - Number(a.OPS);
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
//
// Todo esto corre en DOS rondas: primero solo con los regulares (la mitad
// o más de los juegos, ver byRegularThenOps) y luego, para las posiciones
// que sigan vacías, con el resto. Así un regular que tiene la posición como
// secundaria le gana el lugar a un no-regular que la tiene como principal.
export function assignDefense(roster, statsById) {
  const used = new Set();
  const assignment = {};

  function statsFor(p) {
    return statsById.get(p.id) ?? emptyStats(p.id);
  }

  function fillWith(pool) {
    for (const pos of DEFENSE_POSITIONS) {
      if (assignment[pos]) continue;
      const candidates = pool
        .filter((p) => primaryPosition(p) === pos && !used.has(p.id))
        .map(statsFor)
        .sort(byRegularThenOps);
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
        const candidates = pool
          .filter((p) => positionsOf(p.position).includes(pos) && !used.has(p.id))
          .map(statsFor)
          .sort(byRegularThenOps);
        if (bestCandidates === null || candidates.length < bestCandidates.length) {
          bestPos = pos;
          bestCandidates = candidates;
        }
      }
      if (bestCandidates[0]) {
        assignment[bestPos] = bestCandidates[0];
        used.add(bestCandidates[0].playerId);
      }
      remaining.delete(bestPos);
    }
  }

  fillWith(roster.filter((p) => statsFor(p).regular));
  fillWith(roster);

  // Último recurso: `position` trae las posiciones MÁS JUGADAS (ver
  // displayPositions en js/stats.js), que pueden ser solo 1 o 2 — si con
  // eso alguna posición se quedó sin nadie, se intenta con las REGISTRADAS
  // (`registeredPosition`, data.js/perfil) de quien siga libre.
  for (const pos of DEFENSE_POSITIONS) {
    if (assignment[pos]) continue;
    const candidates = roster
      .filter((p) => positionsOf(p.registeredPosition).includes(pos) && !used.has(p.id))
      .map(statsFor)
      .sort(byRegularThenOps);
    if (candidates[0]) {
      assignment[pos] = candidates[0];
      used.add(candidates[0].playerId);
    }
  }
  for (const pos of DEFENSE_POSITIONS) assignment[pos] ??= null;
  return assignment;
}

// Variante de assignDefense para lineup/: en vez de derivar la posición
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
      .sort(byRegularThenOps);
    if (candidates.length > 0) {
      assignment[pos] = candidates[0];
      used.add(candidates[0].playerId);
    }
  }

  const flexible = roster
    .filter((p) => !gamePositionById.get(p.id) && !used.has(p.id))
    .map(statsFor)
    .sort(byRegularThenOps);

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
// batea en esta liga: alguien de banca toma su turno como JD (Jugador
// Designado), y otro más puede entrar como JC (Jugador de Cortesía) —
// ninguno de los dos juega campo. Sin banca, el pitcher batea por su cuenta.
//
// `gamePositionById` es opcional: si viene (desde lineup/), un jugador
// puede haber elegido "JD" o "JC" a propósito para este juego — ese elige
// primero, mejor OPS gana empates. Si nadie lo eligió a propósito (o viene
// de la pestaña Alineación, que no tiene ese selector), se rellena con el
// mejor bate que siga libre, como siempre.
export function buildLineupFromAssignment(roster, statsById, assignment, gamePositionById = null) {
  const usedIds = new Set(Object.values(assignment).filter(Boolean).map((r) => r.playerId));

  function statsFor(p) {
    return statsById.get(p.id) ?? emptyStats(p.id);
  }

  function pickBenchRole(role) {
    if (gamePositionById) {
      const explicit = roster
        .filter((p) => gamePositionById.get(p.id) === role && !usedIds.has(p.id))
        .map(statsFor)
        .sort(byRegularThenOps)[0];
      if (explicit) return explicit;
    }
    return (
      roster
        .filter((p) => !usedIds.has(p.id))
        .map(statsFor)
        .sort(byRegularThenOps)[0] ?? null
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

  const jd = pickBenchRole("JD");
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

  const jc = pickBenchRole("JC");
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
// mano (lo que usa lineup/).
// `share` (opcional): agrega el botón de flyer para redes. `reorder`
// (opcional): el orden al bat se puede reacomodar ARRASTRANDO las filas
// (de la agarradera ⠿). Los dos solo los usa la herramienta de alineación
// por juego (lineup/, js/lineup-tool.js) — la sugerencia de la pestaña
// Alineación no los lleva, a petición expresa.
export function renderLineupResult(container, roster, gamePositionById = null, { share = false, reorder = false } = {}) {
  container.innerHTML = "";

  if (roster.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = "No hay jugadores seleccionados.";
    container.appendChild(p);
    return;
  }

  // Stats de bateo de carrera (todas las temporadas) + juegos jugados de
  // ESTA temporada — solo temporada REGULAR, sin playoffs (a petición
  // expresa) — para el criterio de "regular" (ver byRegularThenOps): la
  // mitad o más de los juegos de temporada regular jugados hasta hoy (5 de
  // 10 ya cuenta).
  const careerById = new Map(battingTotals(allStatGames()).map((r) => [r.playerId, r]));
  const seasonGames = currentSeasonGames();
  const seasonPlayed = gamesPlayedByPlayer(seasonGames);
  const statsById = new Map(
    roster.map((p) => {
      const seasonGP = seasonPlayed.get(p.id) ?? 0;
      const base = careerById.get(p.id) ?? emptyStats(p.id);
      return [p.id, { ...base, seasonGP, regular: seasonGP >= seasonGames.length / 2 }];
    })
  );
  const assignment = gamePositionById
    ? assignDefenseByChoice(roster, gamePositionById, statsById)
    : assignDefense(roster, statsById);
  const { order, batterLabel, pitcherBats } = buildLineupFromAssignment(roster, statsById, assignment, gamePositionById);

  const orderHeading = document.createElement("h3");
  orderHeading.textContent = "Orden al bat sugerido";
  container.appendChild(orderHeading);

  const orderRows = order.map((row, i) => ({
    slot: i + 1,
    slotDisplay: String(i + 1),
    playerId: row.playerId,
    name: row.name,
    position: batterLabel.get(row.playerId) ?? "",
    AVG: row.AVG,
    OBP: row.OBP,
    SLG: row.SLG,
    OPS: row.OPS,
    HR: row.HR,
    RBI: row.RBI,
    JJ: row.seasonGP,
  }));

  // El pitcher no batea (batea el JD en su lugar), pero se muestra al final
  // como referencia de quién ocupa esa posición defensiva.
  if (!pitcherBats && assignment.P) {
    const pitcherStats = statsById.get(assignment.P.playerId) ?? emptyStats(assignment.P.playerId);
    orderRows.push({
      slot: orderRows.length + 1,
      slotDisplay: "P",
      playerId: assignment.P.playerId,
      name: pitcherStats.name,
      position: "P",
      AVG: pitcherStats.AVG,
      OBP: pitcherStats.OBP,
      SLG: pitcherStats.SLG,
      OPS: pitcherStats.OPS,
      HR: pitcherStats.HR,
      RBI: pitcherStats.RBI,
      JJ: pitcherStats.seasonGP,
    });
  }

  // Flyer del lineup para redes (ver js/flyers.js) — con el próximo juego
  // de SCHEDULE, si hay uno, para el "vs Rival · fecha".
  if (share) {
    const nextGame = [...SCHEDULE].sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    const shareRow = document.createElement("div");
    shareRow.className = "share-flyer-row";
    shareRow.appendChild(
      shareButton(() =>
        openFlyer((format) => lineupFlyer(orderRows, nextGame, format), `lineup${nextGame ? `-${nextGame.date}` : ""}`, "Lineup de Caimanes de Villas")
      )
    );
    container.appendChild(shareRow);
  }

  const orderColumns = [
    ...(reorder
      ? [
          {
            key: "drag",
            label: "",
            sticky: true,
            render: (_v, row) =>
              row.slotDisplay === "P" ? "" : '<span class="drag-handle" title="Arrastra para cambiar el orden"><i class="fa-solid fa-grip-vertical"></i></span>',
          },
        ]
      : []),
    { key: "slot", label: "#", full: "Turno al bat", numeric: true, sticky: true, render: (_v, row) => row.slotDisplay },
    { key: "name", label: "Jugador", sticky: true },
    {
      key: "position",
      label: "Pos",
      full: "Posición",
      // En lineup/ (reorder) la posición se puede CAMBIAR desde aquí — ver
      // el listener de "change" más abajo. El pitcher se queda fijo (se
      // elige en la lista de asistentes).
      render: (v, row) =>
        reorder && v !== "P"
          ? `<select class="pos-select" data-player="${row.playerId}" aria-label="Posición de ${row.name}">${EDITABLE_POSITIONS.map(
              (p) => `<option value="${p}"${p === v ? " selected" : ""}>${p}</option>`
            ).join("")}</select>`
          : renderPositionBadge(v),
    },
    { key: "AVG", label: "AVG", full: "Promedio", numeric: true },
    { key: "OBP", label: "OBP", full: "Porcentaje de embasado", numeric: true },
    { key: "SLG", label: "SLG", full: "Porcentaje de slugging", numeric: true },
    { key: "OPS", label: "OPS", full: "OBP + SLG", numeric: true },
    { key: "HR", label: "HR", full: "Home runs", numeric: true },
    { key: "RBI", label: "RBI", full: "Impulsadas", numeric: true },
    { key: "JJ", label: "JJ", full: "Juegos jugados en temporada regular", numeric: true },
  ];

  const orderEl = document.createElement("div");
  container.appendChild(orderEl);
  function drawOrder() {
    renderSortableTable(orderEl, {
      columns: orderColumns,
      rows: orderRows,
      defaultSort: "slot",
      defaultDir: 1,
      // Con arrastre, los encabezados no reordenan (si no, ordenar por OPS
      // "deshace" lo que se acomodó a mano).
      sortable: !reorder,
      rowClass: (row) => (row.slotDisplay === "P" ? "row-locked" : row.playerId === getCurrentPlayerId() ? "row-you" : ""),
    });
  }
  drawOrder();
  if (reorder) {
    enableRowDrag(orderEl, orderRows, drawOrder);
    // Cambiar la posición de alguien: si otro ya la tenía, se intercambian
    // (así nunca quedan dos en la misma). Se repintan la tabla y las
    // tarjetas de "Posiciones sugeridas"; el flyer lee estas mismas filas.
    orderEl.addEventListener("change", (e) => {
      const select = e.target.closest(".pos-select");
      if (!select) return;
      const row = orderRows.find((r) => r.playerId === select.dataset.player);
      if (!row) return;
      const newPos = select.value;
      const other = orderRows.find((r) => r !== row && r.position === newPos);
      if (other) other.position = row.position;
      row.position = newPos;
      drawOrder();
      drawDefense();
    });
  }

  const defenseHeading = document.createElement("h3");
  defenseHeading.textContent = "Posiciones sugeridas";
  container.appendChild(defenseHeading);

  const defenseGrid = document.createElement("div");
  defenseGrid.className = "cards grid-3";
  // En lineup/ (reorder) las posiciones pueden cambiar a mano desde la
  // tabla — entonces las tarjetas salen de orderRows (quién trae cada
  // posición ahora), no de la asignación original.
  function defenseRowFor(pos) {
    if (!reorder) return assignment[pos] ? { ...assignment[pos], JJ: assignment[pos].seasonGP } : null;
    return orderRows.find((r) => r.position === pos) ?? null;
  }
  function drawDefense() {
    defenseGrid.innerHTML = DEFENSE_POSITIONS.map((pos) => {
      const row = defenseRowFor(pos);
      // Sin marca "eres tú" aquí a propósito (a diferencia de Roster/tablas de
      // stats): estas tarjetas son una PROPUESTA de alineación, no un listado
      // de jugadores — resaltar la tuya no aporta nada y solo distrae.
      return `
        <div class="card">
          <div style="margin-bottom: 6px;">${renderPositionBadge(pos)}</div>
          <span class="card-value" style="font-size: 1.2rem;">${row ? row.name : "Sin jugador"}</span>
          <span class="card-label">${row ? `OPS ${row.OPS} · ${row.JJ} JJ` : "No hay nadie disponible en esta posición"}</span>
        </div>
      `;
    }).join("");
  }
  drawDefense();
  container.appendChild(defenseGrid);

  // Banca: del roster candidato, quien no quedó en el campo ni bateando
  // (ni titular, ni JD, ni JC, ni el pitcher). Antes desaparecían del
  // resultado sin más — así queda claro quién sigue disponible para entrar.
  const playingIds = new Set([...order.map((r) => r.playerId), assignment.P?.playerId].filter(Boolean));
  const bench = roster
    .filter((p) => !playingIds.has(p.id))
    .map((p) => statsById.get(p.id) ?? emptyStats(p.id))
    .sort(byRegularThenOps);

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
            <span class="card-label">OPS ${row.OPS} · ${row.seasonGP} JJ</span>
          </div>
        `;
      })
      .join("");
    container.appendChild(benchGrid);
  }
}

// Arrastrar para reacomodar el orden al bat (solo lineup/, ver `reorder` en
// renderLineupResult). Con pointer events — funciona igual con mouse y con
// el dedo (el drag & drop nativo de HTML no sirve en celular). La fila del
// pitcher ("P", no batea) se queda fija al final. `rows` es el MISMO
// arreglo que lee el flyer de compartir: se reacomoda en su lugar y se
// renumeran los turnos, así el flyer sale con el orden nuevo.
function enableRowDrag(tableContainer, rows, redraw) {
  tableContainer.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest(".drag-handle");
    if (!handle) return;
    const tr = handle.closest("tr");
    const tbody = tr?.parentElement;
    if (!tbody) return;
    const from = [...tbody.children].indexOf(tr);
    if (from < 0) return;
    e.preventDefault();
    tr.classList.add("row-dragging");
    document.body.classList.add("is-row-dragging");

    function onMove(ev) {
      const locked = tbody.querySelector(".row-locked");
      const others = [...tbody.children].filter((r) => r !== tr && r !== locked);
      const before = others.find((r) => {
        const box = r.getBoundingClientRect();
        return ev.clientY < box.top + box.height / 2;
      });
      tbody.insertBefore(tr, before ?? locked ?? null);
    }

    function onEnd() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      tr.classList.remove("row-dragging");
      document.body.classList.remove("is-row-dragging");
      const to = [...tbody.children].indexOf(tr);
      if (to !== from && to >= 0) {
        const [moved] = rows.splice(from, 1);
        rows.splice(to, 0, moved);
        let n = 0;
        for (const r of rows) {
          if (r.slotDisplay === "P") continue;
          n += 1;
          r.slot = n;
          r.slotDisplay = String(n);
        }
        const pitcher = rows.find((r) => r.slotDisplay === "P");
        if (pitcher) pitcher.slot = n + 1;
      }
      redraw();
    }

    // En la VENTANA, no en la agarradera: al reacomodar la fila en el DOM
    // el navegador suelta el "capture" del mouse y la agarradera deja de
    // recibir el movimiento (por eso no arrastraba en escritorio).
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  });
}
