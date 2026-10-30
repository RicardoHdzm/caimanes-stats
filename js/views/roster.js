import { ROSTER, TEAM } from "../data.js";
import { gamesPlayedByPlayer, currentSeasonGames, displayPositions } from "../stats.js";
import { heading, renderAvatar, renderGlossary, renderPositionBadges, escapeHtml } from "../ui.js";
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

// "Inscripción": en verde si ya pagó; si no, texto normal (la mayoría está
// pendiente, y en rojo la página entera se veía como una alerta). El
// estado sale de DUES_PAID en js/data.js (ver getDuesMap en js/db.js) — ya
// no de Supabase, así que para cambiarlo hay que editar ese archivo, no
// esta pantalla. `duesMap` null se deja contemplado por si algún día vuelve
// a haber una fuente que pueda fallar; hoy nunca pasa.
const DUES_CHECK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3 5 8.7 9.5 3.6"/></svg>';

function renderDuesStatus(playerId, duesMap) {
  if (!duesMap) return "Sin dato";
  const paid = duesMap.get(playerId) ?? false;
  return paid ? `<span class="stat-green">${DUES_CHECK} Pagada</span>` : "Pendiente";
}

// Tarjeta de un jugador; toda la tarjeta lleva a su perfil. El 0 en data.js
// es "todavía sin número", no se pinta.
function rosterCard(player, duesMap) {
  const cls = player.gamesPlayed >= PLAYOFF_MIN_GAMES ? "stat-green" : "";
  return `
    <a class="roster-card${player.id === getCurrentPlayerId() ? " roster-card--you" : ""}" href="#/jugador/${player.id}">
      <span class="roster-card-main">
        <span class="roster-card-photo" data-avatar="${player.id}" data-size="72">${renderAvatar(player, 72)}</span>
        <span class="roster-card-who">
          ${player.number ? `<span class="roster-card-number">#${player.number}</span>` : ""}
          <span class="roster-card-name">${escapeHtml(player.name)}</span>
          <span class="roster-card-positions">${renderPositionBadges(player.position)}</span>
        </span>
      </span>
      <span class="roster-card-foot">
        <span class="roster-card-stat">
          <span class="roster-card-stat-label">Apariciones</span>
          <span class="roster-card-stat-value"><span><span class="${cls}">${player.gamesPlayed}</span>/${TEAM.gamesInSeason}</span></span>
        </span>
        <span class="roster-card-stat">
          <span class="roster-card-stat-label">Inscripción</span>
          <span class="roster-card-stat-value">${renderDuesStatus(player.id, duesMap)}</span>
        </span>
      </span>
    </a>`;
}

export function renderRoster(container) {
  heading(container, "Roster");

  const played = gamesPlayedByPlayer(currentSeasonGames());
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

  // La inscripción se ve para TODOS (con o sin sesión), a petición expresa.
  // Sale de DUES_PAID en js/data.js (ver getDuesMap).
  let duesMap = null;
  let activeGroup = "ALL";

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

  // Las posiciones ya vienen del cache precargado (ver rows arriba), así que
  // se dibuja de una. La inscripción (getDuesMap) sale de DUES_PAID en
  // data.js — resuelve en el mismo tick, imperceptible.
  draw();
  getDuesMap().then((map) => {
    duesMap = map;
    draw();
  });

  renderGlossary(container, [{ label: "Apariciones", full: `Se necesitan ${PLAYOFF_MIN_GAMES} para tener derecho a playoffs` }]);
}
