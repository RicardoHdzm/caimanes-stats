import { PLAYERS, GAMES } from "../data.js";
import { battingTotals, pitchingTotals, fieldingTotals, gamesPlayedByPlayer } from "../stats.js";
import { heading, renderSortableTable, renderGlossary, coloredStat, renderPositionBadges, renderAvatar } from "../ui.js";

function formatAvg(h, ab) {
  if (!ab) return ".000";
  return (h / ab).toFixed(3).replace(/^0\./, ".");
}

export function renderJugadorDetalle(container, playerId) {
  const player = PLAYERS.find((p) => p.id === playerId);

  if (!player) {
    heading(container, "Jugador no encontrado");
    const back = document.createElement("a");
    back.href = "#/roster";
    back.className = "back-link";
    back.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Volver al roster';
    container.appendChild(back);
    return;
  }

  const back = document.createElement("a");
  back.href = "#/roster";
  back.className = "back-link";
  back.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Volver al roster';
  container.appendChild(back);

  const played = gamesPlayedByPlayer(GAMES).get(player.id) ?? 0;
  const hero = document.createElement("div");
  hero.className = "game-hero";
  hero.innerHTML = `
    <div style="margin-bottom: 12px;">${renderAvatar(player, 72)}</div>
    <div class="game-hero-teams">
      <span>#${player.number ?? "-"}</span>
      <span class="game-hero-vs">·</span>
      <span class="game-hero-opponent">${player.name}</span>
    </div>
    <div class="game-hero-meta" style="margin-top: 12px;">
      ${player.position ? renderPositionBadges(player.position) : ""}
    </div>
    <div class="game-hero-date">${played} juego${played === 1 ? "" : "s"} jugado${played === 1 ? "" : "s"} esta temporada</div>
  `;
  container.appendChild(hero);

  const battingSeason = battingTotals(GAMES).find((r) => r.playerId === player.id);
  const pitchingSeason = pitchingTotals(GAMES).find((r) => r.playerId === player.id);
  const fieldingSeason = fieldingTotals(GAMES).find((r) => r.playerId === player.id);

  if (battingSeason) {
    const h3 = document.createElement("h3");
    h3.textContent = "Bateo — temporada";
    container.appendChild(h3);
    const cards = document.createElement("div");
    cards.className = "cards";
    cards.innerHTML = `
      <div class="card">
        <i class="fa-solid fa-baseball-bat-ball card-icon"></i>
        <span class="card-value">${battingSeason.AVG}</span>
        <span class="card-label">AVG</span>
      </div>
      <div class="card">
        <i class="fa-solid fa-fire card-icon"></i>
        <span class="card-value">${battingSeason.HR}</span>
        <span class="card-label">Jonrones</span>
      </div>
      <div class="card">
        <i class="fa-solid fa-tornado card-icon"></i>
        <span class="card-value">${battingSeason.RBI}</span>
        <span class="card-label">Impulsadas</span>
      </div>
      <div class="card">
        <i class="fa-solid fa-chart-line card-icon"></i>
        <span class="card-value">${battingSeason.OPS}</span>
        <span class="card-label">OPS</span>
      </div>
    `;
    container.appendChild(cards);
  }

  if (pitchingSeason) {
    const h3 = document.createElement("h3");
    h3.textContent = "Pitcheo — temporada";
    container.appendChild(h3);
    const cards = document.createElement("div");
    cards.className = "cards";
    cards.innerHTML = `
      <div class="card">
        <i class="fa-solid fa-baseball card-icon"></i>
        <span class="card-value">${pitchingSeason.ERA}</span>
        <span class="card-label">ERA</span>
      </div>
      <div class="card">
        <i class="fa-solid fa-trophy card-icon"></i>
        <span class="card-value">${pitchingSeason.W}-${pitchingSeason.L}</span>
        <span class="card-label">Record</span>
      </div>
      <div class="card">
        <i class="fa-solid fa-fire card-icon"></i>
        <span class="card-value">${pitchingSeason.SO}</span>
        <span class="card-label">Ponches</span>
      </div>
      <div class="card">
        <i class="fa-solid fa-hourglass-half card-icon"></i>
        <span class="card-value">${pitchingSeason.IP}</span>
        <span class="card-label">Entradas</span>
      </div>
    `;
    container.appendChild(cards);
  }

  if (fieldingSeason) {
    const h3 = document.createElement("h3");
    h3.textContent = "Fildeo — temporada";
    container.appendChild(h3);
    const cards = document.createElement("div");
    cards.className = "cards";
    cards.innerHTML = `
      <div class="card">
        <i class="fa-solid fa-shield card-icon"></i>
        <span class="card-value">${fieldingSeason.FPCT}</span>
        <span class="card-label">FPCT</span>
      </div>
      <div class="card">
        <i class="fa-solid fa-mitten card-icon"></i>
        <span class="card-value">${fieldingSeason.PO}</span>
        <span class="card-label">Outs (PO)</span>
      </div>
      <div class="card">
        <i class="fa-solid fa-arrow-right-arrow-left card-icon"></i>
        <span class="card-value">${fieldingSeason.A}</span>
        <span class="card-label">Asistencias</span>
      </div>
      <div class="card">
        <i class="fa-solid fa-xmark card-icon"></i>
        <span class="card-value">${fieldingSeason.E}</span>
        <span class="card-label">Errores</span>
      </div>
    `;
    container.appendChild(cards);
  }

  const gamesSorted = [...GAMES].sort((a, b) => a.date.localeCompare(b.date));

  // ---- Bateo juego por juego ----
  const battingRows = [];
  for (const game of gamesSorted) {
    const line = (game.batting ?? []).find((l) => l.playerId === player.id);
    if (!line) continue;
    battingRows.push({
      gameId: game.id,
      date: game.date,
      opponent: game.opponent,
      AB: line.AB ?? 0,
      H: line.H ?? 0,
      "2B": line["2B"] ?? 0,
      "3B": line["3B"] ?? 0,
      HR: line.HR ?? 0,
      HRC: line.HRC ?? 0,
      RBI: line.RBI ?? 0,
      R: line.R ?? 0,
      BB: line.BB ?? 0,
      SO: line.SO ?? 0,
      SB: line.SB ?? 0,
      AVG: formatAvg(line.H ?? 0, line.AB ?? 0),
    });
  }

  if (battingRows.length > 0) {
    const h3 = document.createElement("h3");
    h3.textContent = "Bateo por juego";
    container.appendChild(h3);

    const battingColumns = [
      { key: "date", label: "Fecha" },
      { key: "opponent", label: "Rival" },
      { key: "AB", label: "AB", full: "Turnos al bat", numeric: true },
      { key: "H", label: "H", full: "Hits", numeric: true },
      { key: "2B", label: "2B", full: "Dobles", numeric: true },
      { key: "3B", label: "3B", full: "Triples", numeric: true },
      { key: "HR", label: "HR", full: "Jonrones", numeric: true },
      { key: "HRC", label: "HRC", full: "Jonrones de campo", numeric: true },
      { key: "R", label: "R", full: "Carreras", numeric: true },
      { key: "RBI", label: "RBI", full: "Impulsadas", numeric: true },
      { key: "BB", label: "BB", full: "Bases por bolas", numeric: true },
      { key: "SO", label: "SO", full: "Ponches", numeric: true, render: (v) => coloredStat(v, "stat-red") },
      { key: "SB", label: "SB", full: "Bases robadas", numeric: true },
      { key: "AVG", label: "AVG", full: "Promedio del juego", numeric: true },
    ];

    const el = document.createElement("div");
    container.appendChild(el);
    renderSortableTable(el, {
      columns: battingColumns,
      rows: battingRows,
      defaultSort: "date",
      defaultDir: 1,
      onRowClick: (row) => {
        location.hash = `#/juegos/${row.gameId}`;
      },
    });
    renderGlossary(container, battingColumns);
  }

  // ---- Pitcheo juego por juego ----
  const pitchingRows = [];
  for (const game of gamesSorted) {
    const line = (game.pitching ?? []).find((l) => l.playerId === player.id);
    if (!line) continue;
    pitchingRows.push({
      gameId: game.id,
      date: game.date,
      opponent: game.opponent,
      IP: line.IP ?? 0,
      H: line.H ?? 0,
      R: line.R ?? 0,
      ER: line.ER ?? 0,
      BB: line.BB ?? 0,
      SO: line.SO ?? 0,
      HR: line.HR ?? 0,
      decision: line.decision ?? "",
    });
  }

  if (pitchingRows.length > 0) {
    const h3 = document.createElement("h3");
    h3.textContent = "Pitcheo por juego";
    container.appendChild(h3);

    const pitchingColumns = [
      { key: "date", label: "Fecha" },
      { key: "opponent", label: "Rival" },
      { key: "IP", label: "IP", full: "Entradas lanzadas", numeric: true },
      { key: "H", label: "H", full: "Hits permitidos", numeric: true },
      { key: "R", label: "R", full: "Carreras permitidas", numeric: true },
      { key: "ER", label: "ER", full: "Carreras limpias", numeric: true },
      { key: "BB", label: "BB", full: "Bases por bolas", numeric: true },
      { key: "SO", label: "SO", full: "Ponches", numeric: true, render: (v) => coloredStat(v, "stat-green") },
      { key: "HR", label: "HR", full: "Jonrones permitidos", numeric: true },
      { key: "decision", label: "Decisión" },
    ];

    const el = document.createElement("div");
    container.appendChild(el);
    renderSortableTable(el, {
      columns: pitchingColumns,
      rows: pitchingRows,
      defaultSort: "date",
      defaultDir: 1,
      onRowClick: (row) => {
        location.hash = `#/juegos/${row.gameId}`;
      },
    });
    renderGlossary(container, pitchingColumns);
  }

  // ---- Fildeo juego por juego ----
  const fieldingRows = [];
  for (const game of gamesSorted) {
    const line = (game.fielding ?? []).find((l) => l.playerId === player.id);
    if (!line) continue;
    fieldingRows.push({
      gameId: game.id,
      date: game.date,
      opponent: game.opponent,
      PO: line.PO ?? 0,
      A: line.A ?? 0,
      E: line.E ?? 0,
    });
  }

  if (fieldingRows.length > 0) {
    const h3 = document.createElement("h3");
    h3.textContent = "Fildeo por juego";
    container.appendChild(h3);

    const fieldingColumns = [
      { key: "date", label: "Fecha" },
      { key: "opponent", label: "Rival" },
      { key: "PO", label: "PO", full: "Outs realizados", numeric: true },
      { key: "A", label: "A", full: "Asistencias", numeric: true },
      { key: "E", label: "E", full: "Errores", numeric: true },
    ];

    const el = document.createElement("div");
    container.appendChild(el);
    renderSortableTable(el, {
      columns: fieldingColumns,
      rows: fieldingRows,
      defaultSort: "date",
      defaultDir: 1,
      onRowClick: (row) => {
        location.hash = `#/juegos/${row.gameId}`;
      },
    });
    renderGlossary(container, fieldingColumns);
  }

  if (!battingSeason && !pitchingSeason && !fieldingSeason) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = "Todavía no tiene stats capturadas esta temporada.";
    container.appendChild(p);
  }
}
