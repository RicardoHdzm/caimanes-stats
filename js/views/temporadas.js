import { GAMES, PLAYOFFS, SEASONS, CURRENT_SEASON, STANDINGS, STANDINGS_HISTORY, TEAM, PLAYERS } from "../data.js";
import {
  battingTotals,
  pitchingTotals,
  fieldingTotals,
  gameResult,
  seasonStatGames,
  gamesPlayedByPlayer,
  playerName,
  rankAmong,
} from "../stats.js";
import { heading, renderSortableTable, renderGlossary, coloredStat, ordinalTemporada, escapeHtml } from "../ui.js";
import { renderPlayoffEntry } from "./playoffs.js";
import { renderStandingsTable } from "./standing.js";
import { renderSeasonCards, avatarSlot, hydrateAvatars } from "./resumen.js";
import { renderAchievements, sortedAchievementsHtml } from "./jugador.js";

// "2026-07-21" -> "21 jul 2026" — chico a propósito, esta tabla es solo un
// índice de juegos hacia su detalle real, no el box score.
function formatShortDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

const RESULT_LABEL = { W: "Victoria", L: "Derrota", T: "Empate" };

// La temporada más reciente que de verdad tiene juegos capturados — el
// roster de temporadas (SEASONS) llega hasta CURRENT_SEASON, pero de las
// anteriores a esta (temporada 8) todavía no hay box scores completos
// guardados, solo el año/liga para el "Debut" del perfil.
function defaultSeason() {
  const withGames = [...new Set(GAMES.map((g) => g.season))].sort((a, b) => b - a);
  return withGames[0] ?? CURRENT_SEASON;
}

function seasonLabel(n) {
  const meta = SEASONS[n - 1];
  return meta ? `${ordinalTemporada(n)} Temporada: ${meta.league}` : `${ordinalTemporada(n)} Temporada`;
}

function sectionHeading(container, icon, text) {
  const h3 = document.createElement("h3");
  h3.innerHTML = `<i class="fa-solid ${icon}"></i> ${text}`;
  container.appendChild(h3);
}

// MVPs de la temporada: el campo `mvp` de cada juego (MVP oficial, ver
// GAMES en js/data.js) — la lista juego por juego. Sin ningún MVP
// capturado no se pinta nada.
function renderMvpSummary(container, statGames) {
  const withMvp = statGames.filter((g) => g.mvp).sort((a, b) => a.date.localeCompare(b.date));
  if (withMvp.length === 0) return;

  sectionHeading(container, "fa-star", "MVPs de la temporada");
  const tableEl = document.createElement("div");
  container.appendChild(tableEl);
  renderSortableTable(tableEl, {
    columns: [
      { key: "date", label: "Fecha", sticky: true, render: (v) => formatShortDate(v) },
      {
        key: "opponent",
        label: "Rival",
        render: (v, row) =>
          `${escapeHtml(v ?? "")}${row.playoff ? ' <span class="playoff-tag"><i class="fa-solid fa-trophy"></i> Playoffs</span>' : ""}`,
      },
      { key: "name", label: "MVP" },
    ],
    rows: withMvp.map((g) => ({ id: g.id, date: g.date, opponent: g.opponent, playoff: !!g.playoff, name: playerName(g.mvp) })),
    defaultSort: "date",
    defaultDir: 1,
    onRowClick: (row) => {
      location.hash = `#/juegos/${row.id}`;
    },
  });
}

// Top 5 de la temporada: mejor OPS entre los que jugaron la MITAD O MÁS de
// los juegos de la temporada — contando playoffs (a petición expresa), igual
// que los números (OPS, HR...). Ojo: la sugerencia de alineación usa solo
// temporada regular para su criterio de "regular" (ver byRegularThenOps en
// js/lineup.js) — aquí no.
function renderTopFive(container, statGames) {
  const played = gamesPlayedByPlayer(statGames);
  const minGames = statGames.length / 2;
  const mvpCounts = new Map();
  for (const g of statGames) if (g.mvp) mvpCounts.set(g.mvp, (mvpCounts.get(g.mvp) ?? 0) + 1);
  const top = battingTotals(statGames)
    .filter((r) => (played.get(r.playerId) ?? 0) >= minGames && r.AB > 0)
    // Empate de OPS: gana quien tiene más turnos al bat (un 1.000 en 19 AB
    // pesa más que uno en 2).
    .sort((a, b) => Number(b.OPS) - Number(a.OPS) || b.AB - a.AB)
    .slice(0, 5)
    .map((r, i) => ({ ...r, rank: i + 1, JJ: played.get(r.playerId) ?? 0, MVP: mvpCounts.get(r.playerId) ?? 0 }));
  if (top.length === 0) return;

  sectionHeading(container, "fa-ranking-star", "Top 5 de la temporada");
  const columns = [
    { key: "rank", label: "#", numeric: true, sticky: true },
    { key: "name", label: "Jugador", sticky: true },
    { key: "JJ", label: "JJ", full: "Juegos jugados (temporada regular + playoffs)", numeric: true },
    { key: "AVG", label: "AVG", full: "Promedio de bateo", numeric: true },
    { key: "OPS", label: "OPS", full: "OBP + SLG", numeric: true },
    { key: "HR", label: "HR", full: "Home runs", numeric: true },
    { key: "RBI", label: "RBI", full: "Impulsadas", numeric: true },
    { key: "R", label: "R", full: "Carreras", numeric: true },
    { key: "SB", label: "SB", full: "Bases robadas", numeric: true },
    { key: "MVP", label: "MVP", full: "Veces MVP del juego", numeric: true },
  ];
  const tableEl = document.createElement("div");
  container.appendChild(tableEl);
  renderSortableTable(tableEl, {
    columns,
    rows: top,
    defaultSort: "rank",
    defaultDir: 1,
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
  });
}

// Medallas de la temporada: las de cada jugador con los juegos de ESA
// temporada (renderAchievements de js/views/jugador.js), sin las de
// trayectoria/perfil que no dependen de la temporada (Veteran, Bon
// voyage, Manager...) — se detectan corriendo el mismo cálculo sin juegos
// y quitando lo que sale ahí. Starboy (top 3 en MVPs) se agrega aparte,
// porque en el perfil sale de forma asíncrona.
function renderSeasonMedals(container, statGames) {
  const mvpCounts = new Map();
  for (const g of statGames) if (g.mvp) mvpCounts.set(g.mvp, (mvpCounts.get(g.mvp) ?? 0) + 1);
  const mvpList = [...mvpCounts.entries()].map(([playerId, mvpTotal]) => ({ playerId, mvpTotal }));
  const PODIUM = { 1: "gold", 2: "silver", 3: "bronze" };

  const rows = PLAYERS.map((player) => {
    const timeless = new Set(renderAchievements(player, []).map((c) => c.label));
    const chips = renderAchievements(player, statGames).filter((c) => !timeless.has(c.label));
    const place = rankAmong(mvpList, player.id, "mvpTotal", "desc")?.place;
    if (place && place <= 3) {
      chips.push({
        icon: "fa-solid fa-star",
        label: "Starboy",
        kind: PODIUM[place],
        desc: `Premios MVP ganados esta temporada (${mvpCounts.get(player.id)}).`,
      });
    }
    return { player, chips };
  })
    .filter((r) => r.chips.length > 0)
    .sort((a, b) => b.chips.length - a.chips.length);
  if (rows.length === 0) return;

  sectionHeading(container, "fa-medal", "Medallas de la temporada");
  const grid = document.createElement("div");
  grid.className = "season-medals-grid";
  grid.innerHTML = rows
    .map(
      ({ player, chips }) => `
        <div class="leader-card season-medals-card">
          <div class="season-medals-head">
            ${avatarSlot(player, 40)}
            <a class="season-medals-name" href="#/jugador/${player.id}">#${player.number ?? "-"} ${escapeHtml(player.name)}</a>
            <span class="season-medals-count" title="Medallas">${chips.length}</span>
          </div>
          <div class="achievements-grid">${sortedAchievementsHtml(chips)}</div>
        </div>
      `
    )
    .join("");
  container.appendChild(grid);
  hydrateAvatars(grid);
}

export function renderTemporadas(container, seasonParam, tabParam) {
  heading(container, "Temporadas anteriores");

  const requested = Number(seasonParam);
  const season = Number.isInteger(requested) && requested >= 1 && requested <= SEASONS.length ? requested : defaultSeason();

  const picker = document.createElement("div");
  picker.className = "temporada-picker";
  const pickerLabel = document.createElement("label");
  pickerLabel.setAttribute("for", "temporada-select");
  pickerLabel.textContent = "Temporada";
  const select = document.createElement("select");
  select.id = "temporada-select";
  select.className = "temporada-select";
  for (let n = SEASONS.length; n >= 1; n--) {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = seasonLabel(n) + (n === CURRENT_SEASON ? " (actual)" : "");
    opt.selected = n === season;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => {
    location.hash = `#/temporadas/${select.value}`;
  });
  picker.append(pickerLabel, select);
  container.appendChild(picker);

  const games = GAMES.filter((g) => g.season === season);
  if (games.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = "No hay juegos capturados para esta temporada.";
    container.appendChild(p);
    return;
  }

  const statGames = seasonStatGames(season);
  const isCurrent = season === CURRENT_SEASON;

  // Pestañas para no mostrar todo de una (a petición expresa), cada una con
  // lo que va relacionado: Resumen (las tarjetas de Resumen a como quedaron)
  // · Destacados (MVPs, top 5, medallas) · Liga (playoffs + tabla de
  // posiciones) · Estadísticas (bateo, pitcheo, fildeo) · Juegos. Mismo
  // selector que la pestaña Estadísticas (.stats-switcher). Se pinta todo de
  // una vez y solo se muestra/oculta cada panel; la pestaña elegida va en la
  // URL (#/temporadas/8/destacados) para poder compartirla.
  const TABS = [
    { id: "resumen", label: "Resumen", icon: "fa-chart-line" },
    { id: "destacados", label: "Destacados", icon: "fa-star" },
    { id: "liga", label: "Liga", icon: "fa-ranking-star" },
    { id: "stats", label: "Estadísticas", icon: "fa-chart-simple" },
    { id: "juegos", label: "Juegos", icon: "fa-baseball-bat-ball" },
  ];
  const switcher = document.createElement("div");
  switcher.className = "stats-switcher temporada-tabs";
  switcher.innerHTML = TABS.map(
    (t) => `
      <button type="button" class="stats-switcher-btn" data-tab="${t.id}">
        <span class="stats-switcher-icon"><i class="fa-solid ${t.icon}"></i></span>
        <span>${t.label}</span>
      </button>
    `
  ).join("");
  container.appendChild(switcher);
  const panels = {};
  for (const t of TABS) {
    panels[t.id] = document.createElement("div");
    panels[t.id].className = "temporada-panel";
    container.appendChild(panels[t.id]);
  }
  function showTab(id) {
    history.replaceState(null, "", `#/temporadas/${season}/${id}`);
    for (const btn of switcher.querySelectorAll(".stats-switcher-btn")) btn.classList.toggle("active", btn.dataset.tab === id);
    for (const t of TABS) panels[t.id].hidden = t.id !== id;
  }
  switcher.addEventListener("click", (e) => {
    const btn = e.target.closest(".stats-switcher-btn");
    if (btn && !btn.classList.contains("active")) showTab(btn.dataset.tab);
  });

  // ---- Las mismas tarjetas de Resumen, a como quedaron al final ----
  // (récord, rachas, stats de equipo, líderes, récords — ver
  // renderSeasonCards en js/views/resumen.js). La posición en la liga sale
  // de la tabla final guardada (STANDINGS_HISTORY, fila `us`).
  const finalTable = isCurrent ? null : STANDINGS_HISTORY[season];
  renderSeasonCards(panels.resumen, {
    games,
    statGames,
    final: !isCurrent,
    leaguePosition: isCurrent ? TEAM.leaguePosition : finalTable?.teams.find((t) => t.us)?.pos ?? null,
    leagueTeams: isCurrent ? TEAM.leagueTeams : finalTable?.teams.length ?? null,
    // Una temporada cerrada ya jugó todos sus juegos: el total es lo que
    // hay capturado (TEAM.gamesInSeason es solo el de la actual).
    gamesInSeason: isCurrent ? TEAM.gamesInSeason : games.length,
  });

  // ---- Resumen: MVPs, top 5 y medallas ----
  renderMvpSummary(panels.destacados, statGames);
  renderTopFive(panels.destacados, statGames);
  renderSeasonMedals(panels.destacados, statGames);

  // ---- Playoffs de esa temporada, si los hubo ----
  const playoffEntry = PLAYOFFS.find((p) => p.season === season);
  if (playoffEntry && playoffEntry.rounds.length > 0) {
    const h3 = document.createElement("h3");
    h3.innerHTML = '<i class="fa-solid fa-trophy"></i> Playoffs';
    panels.liga.appendChild(h3);
    renderPlayoffEntry(panels.liga, playoffEntry);
  }

  // ---- Tabla de posiciones ----
  // La actual (STANDINGS) es la de la temporada en curso; una ya cerrada
  // solo tiene tabla si se guardó a mano en STANDINGS_HISTORY antes de
  // reemplazar STANDINGS con la de la temporada nueva (ver el checklist
  // junto a CURRENT_SEASON en js/data.js) — de ahí el mensaje distinto
  // cuando no hay una capturada.
  const standingsHeading = document.createElement("h3");
  standingsHeading.textContent = "Tabla de posiciones";
  panels.liga.appendChild(standingsHeading);
  renderStandingsTable(
    panels.liga,
    season === CURRENT_SEASON ? STANDINGS : STANDINGS_HISTORY[season],
    season === CURRENT_SEASON
      ? undefined
      : "No se guardó la tabla de posiciones final de esta temporada."
  );

  // ---- Bateo ----
  const battingHeading = document.createElement("h3");
  battingHeading.textContent = "Bateo";
  panels.stats.appendChild(battingHeading);
  const battingColumns = [
    { key: "name", label: "Jugador", sticky: true },
    { key: "G", label: "J", full: "Juegos jugados", numeric: true },
    { key: "AB", label: "AB", full: "Turnos al bat", numeric: true },
    { key: "H", label: "H", full: "Hits", numeric: true },
    { key: "HR", label: "HR", full: "Home runs", numeric: true },
    { key: "RBI", label: "RBI", full: "Impulsadas", numeric: true },
    { key: "R", label: "R", full: "Carreras", numeric: true },
    { key: "SO", label: "SO", full: "Ponches", numeric: true, render: (v) => coloredStat(v, "stat-red") },
    { key: "AVG", label: "AVG", full: "Promedio de bateo", numeric: true },
    { key: "OPS", label: "OPS", full: "OBP + SLG", numeric: true },
  ];
  const battingEl = document.createElement("div");
  panels.stats.appendChild(battingEl);
  renderSortableTable(battingEl, {
    columns: battingColumns,
    rows: battingTotals(seasonStatGames(season)),
    defaultSort: "AVG",
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
  });
  renderGlossary(panels.stats, battingColumns);

  // ---- Pitcheo ----
  const pitchingHeading = document.createElement("h3");
  pitchingHeading.textContent = "Pitcheo";
  panels.stats.appendChild(pitchingHeading);
  const pitchingColumns = [
    { key: "name", label: "Jugador", sticky: true },
    { key: "G", label: "J", full: "Juegos jugados", numeric: true },
    { key: "W", label: "G", full: "Juegos ganados", numeric: true },
    { key: "SV", label: "SV", full: "Salvamentos", numeric: true },
    { key: "IP", label: "IP", full: "Entradas lanzadas", numeric: true },
    { key: "SO", label: "SO", full: "Ponches", numeric: true, render: (v) => coloredStat(v, "stat-green") },
    { key: "ERA", label: "ERA", full: "Efectividad", numeric: true },
  ];
  const pitchingEl = document.createElement("div");
  panels.stats.appendChild(pitchingEl);
  renderSortableTable(pitchingEl, {
    columns: pitchingColumns,
    rows: pitchingTotals(seasonStatGames(season)),
    defaultSort: "ERA",
    defaultDir: 1,
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
  });
  renderGlossary(panels.stats, pitchingColumns);

  // ---- Fildeo ----
  const fieldingHeading = document.createElement("h3");
  fieldingHeading.textContent = "Fildeo";
  panels.stats.appendChild(fieldingHeading);
  const fieldingColumns = [
    { key: "name", label: "Jugador", sticky: true },
    { key: "G", label: "J", full: "Juegos jugados", numeric: true },
    { key: "PO", label: "PO", full: "Outs realizados", numeric: true },
    { key: "A", label: "A", full: "Asistencias", numeric: true },
    { key: "E", label: "E", full: "Errores", numeric: true },
    { key: "FPCT", label: "FPCT", full: "Porcentaje de fildeo", numeric: true },
  ];
  const fieldingEl = document.createElement("div");
  panels.stats.appendChild(fieldingEl);
  renderSortableTable(fieldingEl, {
    columns: fieldingColumns,
    rows: fieldingTotals(seasonStatGames(season)),
    defaultSort: "FPCT",
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
  });
  renderGlossary(panels.stats, fieldingColumns);

  // ---- Juegos de la temporada ----
  const gamesHeading = document.createElement("h3");
  gamesHeading.textContent = "Juegos (clic en uno para ver el detalle)";
  panels.juegos.appendChild(gamesHeading);
  const gamesColumns = [
    // `date` se guarda como ISO (ordena bien como string) — formatShortDate
    // solo cambia cómo se VE, vía `render`, igual que coloredStat en otras
    // tablas (ver bateo.js).
    { key: "date", label: "Fecha", render: (v) => formatShortDate(v) },
    { key: "opponent", label: "Rival" },
    { key: "score", label: "Marcador" },
    { key: "result", label: "Resultado" },
  ];
  const gamesRows = games.map((g) => {
    const known = g.scoreUs != null && g.scoreThem != null;
    return {
      id: g.id,
      date: g.date,
      opponent: g.opponent,
      score: known ? `${g.scoreUs} - ${g.scoreThem}` : "Pendiente",
      result: RESULT_LABEL[gameResult(g)] ?? "",
    };
  });
  const gamesEl = document.createElement("div");
  panels.juegos.appendChild(gamesEl);
  renderSortableTable(gamesEl, {
    columns: gamesColumns,
    rows: gamesRows,
    defaultSort: "date",
    defaultDir: 1,
    onRowClick: (row) => {
      location.hash = `#/juegos/${row.id}`;
    },
  });

  showTab(TABS.some((t) => t.id === tabParam) ? tabParam : "resumen");
}
