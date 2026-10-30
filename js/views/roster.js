import { ROSTER, TEAM } from "../data.js";
import { gamesPlayedByPlayer, currentSeasonGames, seasonStatGames, battingTotals, displayPositions } from "../stats.js";
import { heading, renderAvatar, renderGlossary, escapeHtml } from "../ui.js";
import { getCurrentPlayerId } from "../auth.js";
import { getDuesMap, cachedPositionOverrides } from "../db.js";
import { hydrateAvatars } from "./resumen.js";

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

// Tarjeta de un jugador con su foto de protagonista; toda la tarjeta lleva a
// su perfil. El 0 en data.js es "todavía sin número", no se pinta. `data-avatar`
// va en su propio elemento porque hydrateAvatars() reemplaza su contenido, y
// las posiciones, el número y el nombre van encima de la foto.
function rosterCard(player, duesMap) {
  const paid = duesMap.get(player.id) ?? false;
  const stat = (value, label, extra = "") =>
    `<span class="roster-card-stat${extra}"><b>${value}</b><span>${label}</span></span>`;
  const games = `<i class="${player.gamesPlayed >= PLAYOFF_MIN_GAMES ? "stat-green" : ""}">${player.gamesPlayed}</i>/${TEAM.gamesInSeason}`;
  return `
    <a class="roster-card${player.id === getCurrentPlayerId() ? " roster-card--you" : ""}" href="#/jugador/${player.id}">
      <span class="roster-card-photo">
        <span class="roster-card-img" data-avatar="${player.id}" data-size="280">${renderAvatar(player, 280)}</span>
        <span class="roster-card-positions">${playerPositions(player).map((pos) => `<span>${pos}</span>`).join("")}</span>
        ${player.number ? `<span class="roster-card-number">#${player.number}</span>` : ""}
        <span class="roster-card-who">
          <span class="roster-card-name">${escapeHtml(player.name)}</span>
          <span class="roster-card-seasons">Temporadas: ${player.seasons?.length ?? 0}</span>
        </span>
      </span>
      <span class="roster-card-stats">
        ${stat(player.batting?.AVG ?? "—", "AVG")}
        ${stat(paid ? '<i class="stat-green">Pagada</i>' : "Pendiente", "Inscripción")}
        ${stat(games, "Apariciones", " roster-card-stat--games")}
      </span>
    </a>`;
}

export function renderRoster(container) {
  heading(container, "Roster");

  const played = gamesPlayedByPlayer(currentSeasonGames());
  const battingById = new Map(battingTotals(seasonStatGames()).map((r) => [r.playerId, r]));
  // Posiciones personalizadas ya precargadas (durante la pantalla de
  // bienvenida, ver preloadOverrides): se leen SÍNCRONO aquí para que las
  // tarjetas salgan con las del perfil desde el primer render, sin swap. Sin
  // precarga (o sin señal), el Map viene vacío y se usa la de data.js.
  // Lo que se MUESTRA (y filtra) son las más jugadas esta temporada (ver
  // displayPositions en js/stats.js); la registrada solo desempata y sirve
  // de respaldo mientras no haya juegos.
  const positionOverrides = cachedPositionOverrides();
  // Por número; los que todavía no tienen van al final.
  const rows = ROSTER.map((p) => ({
    ...p,
    position: displayPositions(p.id, positionOverrides.get(p.id) ?? p.position, { withDH: true }),
    gamesPlayed: played.get(p.id) ?? 0,
    batting: battingById.get(p.id),
  })).sort((a, b) => (a.number || Infinity) - (b.number || Infinity));

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

  const gridEl = document.createElement("div");
  gridEl.className = "roster-grid";
  container.appendChild(gridEl);

  let activeGroup = "ALL";
  // La inscripción se ve para TODOS (con o sin sesión). Sale de DUES_PAID en
  // js/data.js (ver getDuesMap) y resuelve en el mismo tick, imperceptible.
  let duesMap = new Map();

  function draw() {
    const group = POSITION_GROUPS.find((g) => g.id === activeGroup) ?? POSITION_GROUPS[0];
    const filtered =
      group.id === "ALL" ? rows : rows.filter((row) => playerPositions(row).some((pos) => group.codes.includes(pos)));
    countEl.textContent =
      group.id === "ALL"
        ? `${rows.length} jugador${rows.length === 1 ? "" : "es"}`
        : `${filtered.length} de ${rows.length} jugadores`;

    gridEl.innerHTML = filtered.map((row) => rosterCard(row, duesMap)).join("");
    hydrateAvatars(gridEl);
  }

  filterRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".pos-filter-chip");
    if (!btn) return;
    for (const chip of filterRow.querySelectorAll(".pos-filter-chip")) chip.classList.toggle("active", chip === btn);
    activeGroup = btn.dataset.group;
    draw();
  });

  getDuesMap().then((map) => {
    duesMap = map;
    draw();
  });

  renderGlossary(container, [{ label: "Apariciones", full: `Se necesitan ${PLAYOFF_MIN_GAMES} para tener derecho a playoffs` }]);
  // En celular la tarjeta no lleva Apariciones: la nota no tendría a qué referirse.
  container.lastElementChild.classList.add("roster-glossary");
}
