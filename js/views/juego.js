import { GAMES, TEAM } from "../data.js";
import { playerName, gameResult } from "../stats.js";
import { heading, renderSortableTable, renderGlossary, coloredStat, renderPositionBadge } from "../ui.js";

const RESULT_LABEL = { W: "Victoria", L: "Derrota", T: "Empate" };
const RESULT_BADGE_CLASS = { W: "badge-win", L: "badge-loss", T: "badge-tie" };

function formatAvg(h, ab) {
  if (!ab) return ".000";
  return (h / ab).toFixed(3).replace(/^0\./, ".");
}

export function renderJuegoDetalle(container, gameId) {
  const game = GAMES.find((g) => g.id === gameId);

  if (!game) {
    heading(container, "Juego no encontrado");
    const back = document.createElement("a");
    back.href = "#/juegos";
    back.className = "back-link";
    back.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Volver a juegos';
    container.appendChild(back);
    return;
  }

  const known = game.scoreUs != null && game.scoreThem != null;
  const resultCode = gameResult(game);
  const resultText = RESULT_LABEL[resultCode] ?? "Pendiente";
  const resultBadgeClass = RESULT_BADGE_CLASS[resultCode] ?? "badge-unknown";

  const back = document.createElement("a");
  back.href = "#/juegos";
  back.className = "back-link";
  back.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Volver a juegos';
  container.appendChild(back);

  const hero = document.createElement("div");
  hero.className = "game-hero";
  hero.innerHTML = `
    <div class="game-hero-date">${game.date}</div>
    <div class="game-hero-meta">
      <span class="badge badge-blink ${resultBadgeClass}">${resultText}</span>
    </div>
    <div class="game-hero-teams">
      <span>${TEAM.name}</span>
      <span class="game-hero-vs">vs</span>
      <span class="game-hero-opponent">${game.opponent}</span>
    </div>
    <div class="game-hero-score${known ? "" : " pending"}">
      ${known ? `${game.scoreUs}<span class="sep">-</span>${game.scoreThem}` : "Marcador pendiente"}
    </div>
    ${
      game.replayUrl
        ? `<div class="game-hero-replay"><a href="${game.replayUrl}" target="_blank" rel="noopener" class="replay-btn"><i class="fa-solid fa-circle-play"></i> Ver replay</a></div>`
        : ""
    }
    ${
      game.mvp
        ? `<div class="mvp-badge"><i class="fa-solid fa-star"></i> MVP: ${playerName(game.mvp)}</div>`
        : ""
    }
  `;
  container.appendChild(hero);

  const lineupHeading = document.createElement("h3");
  lineupHeading.textContent = "Line-up y bateo";
  container.appendChild(lineupHeading);

  // Un jugador puede reingresar (solo por quien lo sustituyó), así que un
  // mismo jugador puede tener varios eventos en el juego; el color del turno
  // al bat refleja su ÚLTIMO evento cronológico (si terminó afuera o adentro).
  const substitutions0 = game.substitutions ?? [];
  const subEventsByPlayer = new Map();
  for (const s of substitutions0) {
    if (s.playerOut) {
      const list = subEventsByPlayer.get(s.playerOut) ?? [];
      list.push({ inning: s.inning ?? 0, role: "out" });
      subEventsByPlayer.set(s.playerOut, list);
    }
    if (s.playerIn) {
      const list = subEventsByPlayer.get(s.playerIn) ?? [];
      list.push({ inning: s.inning ?? 0, role: "in" });
      subEventsByPlayer.set(s.playerIn, list);
    }
  }

  function lastSubEvent(playerId) {
    const events = subEventsByPlayer.get(playerId);
    if (!events || events.length === 0) return null;
    return [...events].sort((a, b) => a.inning - b.inning).at(-1);
  }

  const lineupRows = [...(game.batting ?? [])]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map((line) => {
      const lastEvent = lastSubEvent(line.playerId);
      return {
        playerId: line.playerId,
        order: line.order ?? "",
        subStatus: lastEvent?.role ?? "",
        subInning: lastEvent?.inning,
        name: playerName(line.playerId),
        position: line.position ?? "",
        AB: line.AB ?? 0,
        R: line.R ?? 0,
        H: line.H ?? 0,
        "2B": line["2B"] ?? 0,
        "3B": line["3B"] ?? 0,
        HR: line.HR ?? 0,
        HRC: line.HRC ?? 0,
        RBI: line.RBI ?? 0,
        BB: line.BB ?? 0,
        SO: line.SO ?? 0,
        SB: line.SB ?? 0,
        AVG: formatAvg(line.H ?? 0, line.AB ?? 0),
      };
    });

  const lineupColumns = [
    { key: "order", label: "#", full: "Turno al bat", numeric: true },
    {
      key: "name",
      label: "Jugador",
      full: "Flecha verde = entró de cambio, roja = salió",
      render: (value, row) => {
        if (row.subStatus === "in") {
          return `${value} <span class="stat-green" title="Entró en la entrada ${row.subInning}">▲</span>`;
        }
        if (row.subStatus === "out") {
          return `${value} <span class="stat-red" title="Salió en la entrada ${row.subInning}">▼</span>`;
        }
        return value;
      },
    },
    {
      key: "position",
      label: "Pos",
      full: "Posición",
      render: (value) => renderPositionBadge(value),
    },
    { key: "AB", label: "AB", full: "Turnos al bat", numeric: true },
    { key: "H", label: "H", full: "Hits", numeric: true },
    { key: "2B", label: "2B", full: "Dobles", numeric: true },
    { key: "3B", label: "3B", full: "Triples", numeric: true },
    { key: "HR", label: "HR", full: "Home runs", numeric: true },
    { key: "HRC", label: "HRC", full: "Home runs de campo", numeric: true },
    { key: "R", label: "R", full: "Carreras", numeric: true },
    { key: "RBI", label: "RBI", full: "Impulsadas", numeric: true },
    { key: "BB", label: "BB", full: "Bases por bolas", numeric: true },
    { key: "SO", label: "SO", full: "Ponches", numeric: true, render: (v) => coloredStat(v, "stat-red") },
    { key: "SB", label: "SB", full: "Bases robadas", numeric: true },
    { key: "AVG", label: "AVG", full: "Promedio del juego", numeric: true },
  ];

  const lineupEl = document.createElement("div");
  container.appendChild(lineupEl);
  renderSortableTable(lineupEl, {
    columns: lineupColumns,
    rows: lineupRows,
    defaultSort: "order",
    defaultDir: 1,
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
  });
  renderGlossary(container, lineupColumns);

  const pitchingHeading = document.createElement("h3");
  pitchingHeading.textContent = "Pitcheo";
  container.appendChild(pitchingHeading);

  const pitchingRows = (game.pitching ?? []).map((line) => ({
    playerId: line.playerId,
    name: playerName(line.playerId),
    IP: line.IP ?? 0,
    H: line.H ?? 0,
    R: line.R ?? 0,
    ER: line.ER ?? 0,
    BB: line.BB ?? 0,
    SO: line.SO ?? 0,
    HR: line.HR ?? 0,
    decision: line.decision ?? "",
  }));

  const pitchingColumns = [
    { key: "name", label: "Jugador" },
    { key: "IP", label: "IP", full: "Entradas lanzadas", numeric: true },
    { key: "H", label: "H", full: "Hits permitidos", numeric: true },
    { key: "R", label: "R", full: "Carreras permitidas", numeric: true },
    { key: "ER", label: "ER", full: "Carreras limpias", numeric: true },
    { key: "BB", label: "BB", full: "Bases por bolas", numeric: true },
    { key: "SO", label: "SO", full: "Ponches", numeric: true, render: (v) => coloredStat(v, "stat-green") },
    { key: "HR", label: "HR", full: "Home runs permitidos", numeric: true },
    { key: "decision", label: "Decisión" },
  ];

  const pitchingEl = document.createElement("div");
  container.appendChild(pitchingEl);
  renderSortableTable(pitchingEl, {
    columns: pitchingColumns,
    rows: pitchingRows,
    defaultSort: "IP",
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
  });
  renderGlossary(container, pitchingColumns);

  const fieldingHeading = document.createElement("h3");
  fieldingHeading.textContent = "Fildeo";
  container.appendChild(fieldingHeading);

  const fieldingRows = (game.fielding ?? []).map((line) => ({
    playerId: line.playerId,
    name: playerName(line.playerId),
    PO: line.PO ?? 0,
    A: line.A ?? 0,
    E: line.E ?? 0,
  }));

  const fieldingColumns = [
    { key: "name", label: "Jugador" },
    { key: "PO", label: "PO", full: "Outs realizados", numeric: true },
    { key: "A", label: "A", full: "Asistencias", numeric: true },
    { key: "E", label: "E", full: "Errores", numeric: true },
  ];

  const fieldingEl = document.createElement("div");
  container.appendChild(fieldingEl);
  renderSortableTable(fieldingEl, {
    columns: fieldingColumns,
    rows: fieldingRows,
    defaultSort: "PO",
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
  });
  renderGlossary(container, fieldingColumns);

  const substitutions = game.substitutions ?? [];
  if (substitutions.length > 0) {
    const subsHeading = document.createElement("h3");
    subsHeading.textContent = "Cambios";
    container.appendChild(subsHeading);

    const subsRows = [...substitutions]
      .sort((a, b) => (a.inning ?? 99) - (b.inning ?? 99))
      .map((s) => ({
        inning: s.inning ?? "",
        type: s.type === "campo" ? "Campo" : "Bateo",
        playerOut: playerName(s.playerOut),
        playerIn: playerName(s.playerIn),
        position: s.position ?? "",
      }));

    const subsColumns = [
      { key: "inning", label: "Entrada", numeric: true },
      { key: "type", label: "Tipo" },
      { key: "playerOut", label: "Sale" },
      { key: "playerIn", label: "Entra" },
      {
        key: "position",
        label: "Pos",
        full: "Posición",
        render: (value) => renderPositionBadge(value),
      },
    ];

    const subsEl = document.createElement("div");
    container.appendChild(subsEl);
    renderSortableTable(subsEl, {
      columns: subsColumns,
      rows: subsRows,
      defaultSort: "inning",
      defaultDir: 1,
    });
    renderGlossary(container, subsColumns);
  }
}
