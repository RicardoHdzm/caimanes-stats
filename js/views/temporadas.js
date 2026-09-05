import { GAMES, PLAYOFFS, SEASONS, CURRENT_SEASON } from "../data.js";
import { battingTotals, pitchingTotals, fieldingTotals, teamRecord, gameResult } from "../stats.js";
import { heading, renderSortableTable, renderGlossary, coloredStat, ordinalTemporada } from "../ui.js";
import { renderPlayoffEntry } from "./playoffs.js";

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
  return meta ? `${ordinalTemporada(n)} Temporada — ${meta.year} · ${meta.league}` : `${ordinalTemporada(n)} Temporada`;
}

// Mismo armazón "hero" que usa Resumen para Récord/Carreras/etc. (ver
// heroCardShell en js/views/resumen.js) — se duplica chico aquí en vez de
// exportarlo, mismo criterio que ya usan formatGameDate y compañía en cada
// vista.
function heroCard(icon, title, value, detail) {
  return `
    <div class="leader-card leader-card--hero">
      <div class="leader-hero">
        <div class="leader-hero-main">
          <h3><i class="fa-solid ${icon}"></i>${title}</h3>
          <span class="leader-hero-value">${value}</span>
          ${detail ? `<span class="leader-hero-detail">${detail}</span>` : ""}
        </div>
      </div>
    </div>
  `;
}

export function renderTemporadas(container, seasonParam) {
  heading(container, "Temporadas anteriores", "Los datos de cada temporada se conservan aquí, aparte de la actual.");

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

  // ---- Récord ----
  const rec = teamRecord(games);
  const recordRow = document.createElement("div");
  recordRow.className = "leaders section-gap";
  recordRow.innerHTML =
    heroCard("fa-trophy", "Récord", `${rec.W}-${rec.L}${rec.T ? `-${rec.T}` : ""}`, `${rec.G} juego${rec.G === 1 ? "" : "s"}`) +
    heroCard("fa-bolt", "Carreras anotadas", rec.RF) +
    heroCard("fa-shield-halved", "Carreras permitidas", rec.RA);
  container.appendChild(recordRow);

  // ---- Playoffs de esa temporada, si los hubo ----
  const playoffEntry = PLAYOFFS.find((p) => p.season === season);
  if (playoffEntry && playoffEntry.rounds.length > 0) {
    const h3 = document.createElement("h3");
    h3.innerHTML = '<i class="fa-solid fa-trophy"></i> Playoffs';
    container.appendChild(h3);
    renderPlayoffEntry(container, playoffEntry);
  }

  // ---- Bateo ----
  const battingHeading = document.createElement("h3");
  battingHeading.textContent = "Bateo";
  container.appendChild(battingHeading);
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
  container.appendChild(battingEl);
  renderSortableTable(battingEl, {
    columns: battingColumns,
    rows: battingTotals(games),
    defaultSort: "AVG",
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
  });
  renderGlossary(container, battingColumns);

  // ---- Pitcheo ----
  const pitchingHeading = document.createElement("h3");
  pitchingHeading.textContent = "Pitcheo";
  container.appendChild(pitchingHeading);
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
  container.appendChild(pitchingEl);
  renderSortableTable(pitchingEl, {
    columns: pitchingColumns,
    rows: pitchingTotals(games),
    defaultSort: "ERA",
    defaultDir: 1,
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
  });
  renderGlossary(container, pitchingColumns);

  // ---- Fildeo ----
  const fieldingHeading = document.createElement("h3");
  fieldingHeading.textContent = "Fildeo";
  container.appendChild(fieldingHeading);
  const fieldingColumns = [
    { key: "name", label: "Jugador", sticky: true },
    { key: "G", label: "J", full: "Juegos jugados", numeric: true },
    { key: "PO", label: "PO", full: "Outs realizados", numeric: true },
    { key: "A", label: "A", full: "Asistencias", numeric: true },
    { key: "E", label: "E", full: "Errores", numeric: true },
    { key: "FPCT", label: "FPCT", full: "Porcentaje de fildeo", numeric: true },
  ];
  const fieldingEl = document.createElement("div");
  container.appendChild(fieldingEl);
  renderSortableTable(fieldingEl, {
    columns: fieldingColumns,
    rows: fieldingTotals(games),
    defaultSort: "FPCT",
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
  });
  renderGlossary(container, fieldingColumns);

  // ---- Juegos de la temporada ----
  const gamesHeading = document.createElement("h3");
  gamesHeading.textContent = "Juegos (clic en uno para ver el detalle)";
  container.appendChild(gamesHeading);
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
  container.appendChild(gamesEl);
  renderSortableTable(gamesEl, {
    columns: gamesColumns,
    rows: gamesRows,
    defaultSort: "date",
    defaultDir: 1,
    onRowClick: (row) => {
      location.hash = `#/juegos/${row.id}`;
    },
  });
}
