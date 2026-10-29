import { ROSTER, TEAM } from "../data.js";
import { gamesPlayedByPlayer, currentSeasonGames, displayPositions } from "../stats.js";
import { heading, renderSortableTable, renderGlossary, renderPositionBadges } from "../ui.js";
import { getCurrentPlayerId } from "../auth.js";
import { getDuesMap, cachedPositionOverrides } from "../db.js";

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
  { id: "BAT", label: "Bateadores", codes: ["JD", "JC"] },
];

function playerPositions(player) {
  return (player.position ?? "").split("/").map((v) => v.trim()).filter(Boolean);
}

// Celda de "Inscripción": un ícono, verde si ya pagó y rojo si no. El
// estado sale de DUES_PAID en js/data.js (ver getDuesMap en js/db.js) — ya
// no de Supabase, así que para cambiarlo hay que editar ese archivo, no
// esta pantalla. `duesMap` null se deja contemplado por si algún día vuelve
// a haber una fuente que pueda fallar; hoy nunca pasa.
//
// La ✓ / ✕ van en SVG (no ícono de Font Awesome): el glifo de la fuente
// trae sus propias métricas y quedaba un pelo descentrado dentro del
// círculo; dibujado en un viewBox de 12×12 queda exacto.
const DUES_SVG = {
  check: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3 5 8.7 9.5 3.6"/></svg>',
  x: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.2 3.2 8.8 8.8M8.8 3.2 3.2 8.8"/></svg>',
};

function renderDuesCell(playerId, duesMap) {
  if (!duesMap) return '<span class="dues-icon dues-icon-unknown" title="Sin dato">?</span>';
  const paid = duesMap.get(playerId) ?? false;
  return paid
    ? `<span class="dues-icon dues-icon-paid" title="Pagada">${DUES_SVG.check}</span>`
    : `<span class="dues-icon dues-icon-unpaid" title="Pendiente">${DUES_SVG.x}</span>`;
}

export function renderRoster(container) {
  heading(container, "Roster");

  const played = gamesPlayedByPlayer(currentSeasonGames());
  // Posiciones personalizadas ya precargadas (durante la pantalla de
  // bienvenida, ver preloadOverrides): se leen SÍNCRONO aquí para que la
  // tabla salga con las del perfil desde el primer render, sin swap. Sin
  // precarga (o sin señal), el Map viene vacío y se usa la de data.js.
  // Lo que se MUESTRA (y filtra) son las más jugadas esta temporada (ver
  // displayPositions en js/stats.js); la registrada solo desempata y sirve
  // de respaldo mientras no haya juegos.
  const positionOverrides = cachedPositionOverrides();
  const rows = ROSTER.map((p) => ({
    ...p,
    position: displayPositions(p.id, positionOverrides.get(p.id) ?? p.position, { withDH: true }),
    gamesPlayed: played.get(p.id) ?? 0,
  }));

  const filterRow = document.createElement("div");
  filterRow.className = "pos-filter-row";
  filterRow.innerHTML = POSITION_GROUPS.map(
    (g) => `<button type="button" class="pos-filter-chip${g.id === "ALL" ? " active" : ""}" data-group="${g.id}">${g.label}</button>`
  ).join("");
  // Cuántos jugadores hay en el roster de la temporada (ROSTER, ver
  // js/data.js) — al filtrar por posición dice "5 de 16".
  const countEl = document.createElement("span");
  countEl.className = "roster-count";
  filterRow.appendChild(countEl);
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

  // Columna de inscripción — visible para TODOS (con o sin sesión), a
  // petición expresa. Sale de DUES_PAID en js/data.js (ver getDuesMap).
  let duesMap = null;
  columns.push({
    key: "paid",
    label: "Inscripción",
    full: "Inscripción de temporada pagada",
    render: (_value, row) => renderDuesCell(row.id, duesMap),
  });

  const tableEl = document.createElement("div");
  container.appendChild(tableEl);

  let activeGroup = "ALL";

  function draw() {
    const group = POSITION_GROUPS.find((g) => g.id === activeGroup) ?? POSITION_GROUPS[0];
    const filtered =
      group.id === "ALL" ? rows : rows.filter((row) => playerPositions(row).some((pos) => group.codes.includes(pos)));
    countEl.textContent =
      group.id === "ALL"
        ? `${rows.length} jugador${rows.length === 1 ? "" : "es"}`
        : `${filtered.length} de ${rows.length} jugadores`;

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

  // Las posiciones ya vienen del cache precargado (ver rows arriba), así que
  // se dibuja de una. La inscripción (getDuesMap) sale de DUES_PAID en
  // data.js — resuelve en el mismo tick, imperceptible.
  draw();
  getDuesMap().then((map) => {
    duesMap = map;
    draw();
  });

  renderGlossary(container, columns);
}
