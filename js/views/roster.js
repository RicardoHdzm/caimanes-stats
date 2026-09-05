import { PLAYERS, TEAM } from "../data.js";
import { gamesPlayedByPlayer, currentSeasonGames } from "../stats.js";
import { heading, renderSortableTable, renderGlossary, renderPositionBadges } from "../ui.js";
import { getSession, getCurrentPlayerId } from "../auth.js";
import { getDuesMap, getAllPositionOverrides } from "../db.js";

// Apariciones mínimas para tener derecho a jugar playoffs en esta liga.
const PLAYOFF_MIN_GAMES = 5;

// Grupos del filtro rápido por posición. `codes` se compara contra las
// hasta 3 posiciones registradas del jugador (no solo la principal), para
// que "quién puede jugar infield" encuentre también a quien la trae de
// segunda o tercera opción.
const POSITION_GROUPS = [
  { id: "ALL", label: "Todos" },
  { id: "P", label: "Pitcher", codes: ["P"] },
  { id: "C", label: "Catcher", codes: ["C"] },
  { id: "IF", label: "Infield", codes: ["1B", "2B", "3B", "SS"] },
  { id: "OF", label: "Outfield", codes: ["LF", "CF", "RF"] },
];

function playerPositions(player) {
  return (player.position ?? "").split("/").map((v) => v.trim()).filter(Boolean);
}

// Celda de "Inscripción": un ícono, verde si ya pagó y rojo si no. El
// estado sale de DUES_PAID en js/data.js (ver getDuesMap en js/db.js) — ya
// no de Supabase, así que para cambiarlo hay que editar ese archivo, no
// esta pantalla. `duesMap` null se deja contemplado por si algún día vuelve
// a haber una fuente que pueda fallar; hoy nunca pasa.
function renderDuesCell(playerId, duesMap) {
  if (!duesMap) return '<i class="fa-solid fa-circle-question dues-icon dues-icon-unknown"></i>';
  const paid = duesMap.get(playerId) ?? false;
  return paid
    ? '<i class="fa-solid fa-circle-check dues-icon dues-icon-paid"></i>'
    : '<i class="fa-solid fa-circle-xmark dues-icon dues-icon-unpaid"></i>';
}

export function renderRoster(container) {
  heading(container, "Roster");

  const played = gamesPlayedByPlayer(currentSeasonGames());
  const rows = PLAYERS.map((p) => ({
    ...p,
    gamesPlayed: played.get(p.id) ?? 0,
  }));

  const filterRow = document.createElement("div");
  filterRow.className = "pos-filter-row";
  filterRow.innerHTML = POSITION_GROUPS.map(
    (g) => `<button type="button" class="pos-filter-chip${g.id === "ALL" ? " active" : ""}" data-group="${g.id}">${g.label}</button>`
  ).join("");
  container.appendChild(filterRow);

  const columns = [
    { key: "number", label: "#", full: "Número", numeric: true },
    { key: "name", label: "Nombre" },
    {
      key: "position",
      label: "Pos",
      full: "Posición",
      render: renderPositionBadges,
    },
    {
      key: "gamesPlayed",
      label: "Apariciones",
      full: `Se necesitan ${PLAYOFF_MIN_GAMES} para tener derecho a playoffs`,
      numeric: true,
      render: (value) => {
        const cls = value >= PLAYOFF_MIN_GAMES ? "stat-green" : "stat-red";
        return `<span class="${cls}">${value}</span>/${TEAM.gamesInSeason}</span>`;
      },
    },
  ];

  // La columna de inscripción solo se agrega con sesión iniciada — sin
  // cuenta, el roster se ve exactamente igual que siempre. OJO: se usa
  // getSession() (¿hay cuenta?), no getCurrentPlayerId() (¿a qué jugador
  // corresponde esa cuenta?) — alguien puede tener cuenta antes de que el
  // coach termine de vincularla en player_whitelist, y aun así debe poder
  // verla. `duesMap` arranca vacío y se llena aparte (abajo) porque viene
  // de una consulta a Supabase, no de data.js; el `render` la lee por
  // closure, así que cuando llegue el dato real solo hace falta volver a
  // llamar draw() para que se refleje.
  // null hasta que getDuesMap() resuelva (abajo) — mientras tanto la celda
  // se pinta neutral, no roja (ver renderDuesCell).
  let duesMap = null;
  const loggedIn = !!getSession();
  if (loggedIn) {
    columns.push({
      key: "paid",
      label: "Inscripción",
      full: "Inscripción de temporada pagada",
      render: (_value, row) => renderDuesCell(row.id, duesMap),
    });
  }

  const tableEl = document.createElement("div");
  container.appendChild(tableEl);

  let activeGroup = "ALL";

  function draw() {
    const group = POSITION_GROUPS.find((g) => g.id === activeGroup) ?? POSITION_GROUPS[0];
    const filtered =
      group.id === "ALL" ? rows : rows.filter((row) => playerPositions(row).some((pos) => group.codes.includes(pos)));

    renderSortableTable(tableEl, {
      columns,
      rows: filtered,
      defaultSort: "number",
      defaultDir: 1,
      onRowClick: (row) => {
        location.hash = `#/jugador/${row.id}`;
      },
      rowClass: (row) => (row.id === getCurrentPlayerId() ? "row-you" : ""),
    });
  }

  filterRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".pos-filter-chip");
    if (!btn) return;
    for (const chip of filterRow.querySelectorAll(".pos-filter-chip")) chip.classList.toggle("active", chip === btn);
    activeGroup = btn.dataset.group;
    draw();
  });

  draw();

  if (loggedIn) {
    getDuesMap().then((map) => {
      duesMap = map;
      draw();
    });
  }

  // Posiciones personalizadas: lectura pública (a diferencia de
  // "Inscripción", no depende de sesión). Reemplazan `row.position` de
  // quien haya editado la suya — la columna Pos y el filtro rápido de
  // arriba usan ese mismo campo, así que ambos quedan al día con un solo
  // draw().
  getAllPositionOverrides().then((overrides) => {
    if (overrides.size === 0) return;
    for (const row of rows) {
      if (overrides.has(row.id)) row.position = overrides.get(row.id);
    }
    draw();
  });

  renderGlossary(container, columns);
}
