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
  // verla.
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

  // Se espera a las posiciones personalizadas (y a la inscripción) ANTES del
  // primer draw() — a petición expresa: las posiciones que cada quien eligió
  // en su perfil (player_positions) son las definitivas, y no debe verse
  // cómo la tabla "cambia" de las de data.js a esas un instante después.
  // Mientras tanto, spinner (ver tableEl arriba). getDuesMap() sale de
  // DUES_PAID en data.js, así que resuelve al toque; getAllPositionOverrides()
  // sí consulta a Supabase (con reintentos, ver runQuery en js/db.js).
  Promise.all([getAllPositionOverrides(), loggedIn ? getDuesMap() : Promise.resolve(null)]).then(
    ([overrides, map]) => {
      for (const row of rows) {
        if (overrides.has(row.id)) row.position = overrides.get(row.id);
      }
      duesMap = map;
      draw();
    }
  );

  renderGlossary(container, columns);
}
