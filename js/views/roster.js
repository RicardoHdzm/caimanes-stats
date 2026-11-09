import { ROSTER, TEAM, CURRENT_SEASON } from "../data.js";
import { gamesPlayedByPlayer, currentSeasonGames, displayPositions, seasonStatGames, battingTotals, pitchingTotals } from "../stats.js";
import { heading, renderAvatar, renderGlossary, escapeHtml, ordinalTemporada } from "../ui.js";
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

// Qué temporada lleva el jugador en el equipo, en palabras. El roster solo
// trae a quien juega la actual, así que siempre es al menos la primera. De la
// décima en adelante, abreviado ("11va").
const SEASON_ORDINALS = ["Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Sexta", "Séptima", "Octava", "Novena", "Décima"];

function playerSeasonLabel(player) {
  const count = player.seasons.length;
  return `${SEASON_ORDINALS[count - 1] ?? ordinalTemporada(count)} Temporada`;
}

function playerPositions(player) {
  return (player.position ?? "").split("/").map((v) => v.trim()).filter(Boolean);
}

// Tarjeta de un jugador tipo barajita (a petición expresa): al frente su foto
// de protagonista; al tocarla se voltea y atrás trae sus números de la
// temporada, con el botón para ir a su perfil. El 0 en data.js es "todavía
// sin número", no se pinta. `data-avatar` va en su propio elemento porque
// hydrateAvatars() reemplaza su contenido, y las posiciones, el número y el
// nombre van encima de la foto. `stats`: { bat, pit } de la temporada.
function rosterCard(player, duesMap, stats) {
  const paid = duesMap.get(player.id) ?? false;
  const stat = (value, label) => `<span class="roster-card-stat"><b>${value}</b><span>${label}</span></span>`;
  const games = `<i class="${player.gamesPlayed >= PLAYOFF_MIN_GAMES ? "stat-green" : ""}">${player.gamesPlayed}</i>/${TEAM.gamesInSeason}`;
  const tile = (value, label) => `<span class="roster-back-tile"><b>${value}</b><span>${label}</span></span>`;
  const { bat, pit } = stats;
  const tiles = [
    tile(player.gamesPlayed, "Juegos"),
    tile(bat?.AVG ?? ".000", "AVG"),
    tile(bat?.H ?? 0, "Hits"),
    tile((bat?.HR ?? 0) + (bat?.HRC ?? 0), "HR"),
    tile(bat?.RBI ?? 0, "Impulsadas"),
    tile(bat?.SB ?? 0, "Robadas"),
    ...(pit ? [tile(pit.IP, "Entradas"), tile(pit.SO, "Ponches"), tile(`${pit.W}-${pit.L}`, "Récord")] : []),
  ];
  return `
    <div class="roster-card${player.id === getCurrentPlayerId() ? " roster-card--you" : ""}" data-player="${player.id}">
      <div class="roster-card-inner">
        <div class="roster-card-face roster-card-front" role="button" tabindex="0" aria-label="Ver los números de ${escapeHtml(player.name)}">
          <span class="roster-card-photo">
            <span class="roster-card-img" data-avatar="${player.id}" data-size="280">${renderAvatar(player, 280)}</span>
            <span class="roster-card-positions">${playerPositions(player).map((pos) => `<span>${pos}</span>`).join("")}</span>
            ${player.number ? `<span class="roster-card-number">${player.number}</span>` : ""}
            <span class="roster-card-who">
              <span class="roster-card-name">${escapeHtml(player.name)}</span>
              <span class="roster-card-seasons">${playerSeasonLabel(player)}</span>
            </span>
            <span class="roster-card-flip-hint" aria-hidden="true"><i class="fa-solid fa-rotate"></i></span>
          </span>
          <span class="roster-card-stats">
            ${stat(paid ? '<i class="stat-green">Pagada</i>' : "Pendiente", "Inscripción")}
            ${stat(games, "Apariciones")}
          </span>
        </div>
        <div class="roster-card-face roster-card-back" aria-hidden="true">
          <div class="roster-back-head">
            ${player.number ? `<span class="roster-back-number">${player.number}</span>` : ""}
            <span class="roster-back-who">
              <span class="roster-back-name">${escapeHtml(player.name)}</span>
              <span class="roster-back-season">${ordinalTemporada(CURRENT_SEASON)} Temporada</span>
            </span>
          </div>
          <div class="roster-back-grid">${tiles.join("")}</div>
          <a class="roster-back-link" href="#/jugador/${player.id}" tabindex="-1">Ver perfil <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
        </div>
      </div>
    </div>`;
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
  // Números de la temporada para la parte de atrás de las tarjetas.
  const statGames = seasonStatGames();
  const batById = new Map(battingTotals(statGames).map((r) => [r.playerId, r]));
  const pitById = new Map(pitchingTotals(statGames).filter((r) => r.outs > 0).map((r) => [r.playerId, r]));
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

    gridEl.innerHTML = filtered.map((row) => rosterCard(row, duesMap, { bat: batById.get(row.id), pit: pitById.get(row.id) })).join("");
    hydrateAvatars(gridEl);
  }

  // Voltear: tocar la tarjeta (o Enter/espacio) la gira; el botón "Ver
  // perfil" de atrás sí navega. Solo una volteada a la vez.
  function flip(card) {
    const flipped = !card.classList.contains("is-flipped");
    for (const other of gridEl.querySelectorAll(".roster-card.is-flipped")) if (other !== card) setFlipped(other, false);
    setFlipped(card, flipped);
  }
  function setFlipped(card, flipped) {
    card.classList.toggle("is-flipped", flipped);
    card.querySelector(".roster-card-back").setAttribute("aria-hidden", String(!flipped));
    card.querySelector(".roster-back-link").tabIndex = flipped ? 0 : -1;
  }
  gridEl.addEventListener("click", (e) => {
    if (e.target.closest(".roster-back-link")) return;
    const card = e.target.closest(".roster-card");
    if (card) flip(card);
  });
  gridEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const front = e.target.closest(".roster-card-front");
    if (!front) return;
    e.preventDefault();
    flip(front.closest(".roster-card"));
  });

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
}
