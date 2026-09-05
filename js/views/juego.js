import { GAMES, TEAM, PLAYERS } from "../data.js";
import { playerName, gameResult } from "../stats.js";
import { heading, renderSortableTable, renderGlossary, coloredStat, renderPositionBadge, renderAvatar, escapeHtml } from "../ui.js";
import { getCurrentPlayerId } from "../auth.js";
import { getMvpVotes, setMvpVote, deleteMvpVote } from "../db.js";
import { renderComments } from "./comments.js";

const RESULT_LABEL = { W: "Victoria", L: "Derrota", T: "Empate" };
const RESULT_BADGE_CLASS = { W: "badge-win", L: "badge-loss", T: "badge-tie" };
const FIELD_ORDER = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

function formatAvg(h, ab) {
  if (!ab) return ".000";
  return (h / ab).toFixed(3).replace(/^0\./, ".");
}

// Voto de MVP del equipo — distinto del `game.mvp` fijo que capturas a mano
// en data.js (ese sigue siendo "el oficial"; este es el que vota el
// equipo, se muestran los dos). El conteo es público; votar solo aparece
// habilitado si quien tiene sesión apareció en el line-up de ESTE juego
// (bateo, pitcheo o fildeo) — `participantIds` ya viene filtrado así.
//
// Antes era un <select> con nombres nada más; ahora cada candidato es una
// tarjeta con su foto y sus números DE ESTE JUEGO (no de temporada) — así
// se vota viendo quién de verdad la rompió ese día, sin tener que
// adivinar o irse a buscar el box score aparte.
function mvpCardStats(game, playerId) {
  const batting = game.batting?.find((l) => l.playerId === playerId);
  const fielding = game.fielding?.find((l) => l.playerId === playerId);
  return {
    avg: formatAvg(batting?.H ?? 0, batting?.AB ?? 0),
    r: batting?.R ?? 0,
    rbi: batting?.RBI ?? 0,
    po: fielding?.PO ?? 0,
    a: fielding?.A ?? 0,
  };
}

function renderMvpVote(container, game, participantIds) {
  const gameId = game.id;
  const heading3 = document.createElement("h3");
  heading3.innerHTML = '<i class="fa-solid fa-star"></i>MVP del equipo (votado)';
  container.appendChild(heading3);

  const hint = document.createElement("p");
  hint.className = "subtitle";
  hint.textContent = "Toca a un jugador para votar por él. Vuelve a tocar tu voto actual para quitarlo.";
  container.appendChild(hint);

  const gridEl = document.createElement("div");
  gridEl.className = "mvp-vote-grid";
  gridEl.textContent = "Cargando votos…";
  container.appendChild(gridEl);

  function cardHtml(playerId, voteCount, myVote, canVote) {
    const player = PLAYERS.find((p) => p.id === playerId);
    if (!player) return "";
    const { avg, r, rbi, po, a } = mvpCardStats(game, playerId);
    const isMine = playerId === myVote;
    const tag = canVote ? "button" : "div";
    const attrs = canVote ? `type="button" data-vote-for="${playerId}"` : "";
    return `
      <${tag} class="mvp-vote-card${isMine ? " active" : ""}" ${attrs}>
        ${voteCount > 0 ? `<span class="mvp-vote-count">${voteCount}</span>` : ""}
        <span class="mvp-vote-avatar">${renderAvatar(player, 52)}</span>
        <span class="mvp-vote-name">${escapeHtml(player.name)}</span>
        <div class="mvp-vote-stats">
          <span class="mvp-vote-stat"><b>${avg}</b><small>AVG</small></span>
          <span class="mvp-vote-stat"><b>${r}</b><small>R</small></span>
          <span class="mvp-vote-stat"><b>${rbi}</b><small>RBI</small></span>
          <span class="mvp-vote-stat"><b>${po}</b><small>PO</small></span>
          <span class="mvp-vote-stat"><b>${a}</b><small>A</small></span>
        </div>
      </${tag}>
    `;
  }

  gridEl.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-vote-for]");
    if (!card || card.disabled) return;
    const votedId = card.dataset.voteFor;
    card.disabled = true;
    try {
      if (card.classList.contains("active")) {
        await deleteMvpVote(gameId);
      } else {
        await setMvpVote(gameId, votedId);
      }
      await refresh();
    } catch {
      // Silencioso a propósito: un error de red no debe romper la
      // sección, se puede reintentar votando de nuevo.
      card.disabled = false;
    }
  });

  async function refresh() {
    const rows = await getMvpVotes(gameId);
    const counts = new Map();
    for (const r of rows) counts.set(r.voted_player_id, (counts.get(r.voted_player_id) ?? 0) + 1);
    const myId = getCurrentPlayerId();
    const myVote = rows.find((r) => r.voter_player_id === myId)?.voted_player_id ?? null;
    const canVote = !!myId && participantIds.has(myId);
    gridEl.innerHTML = [...participantIds]
      .map((id) => cardHtml(id, counts.get(id) ?? 0, myVote, canVote))
      .join("");
  }

  refresh();
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
    <div class="game-hero-date">${game.date}${game.time ? ` — ${game.time}` : ""}</div>
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

  // Sin marcador todavía no hay a quién votar — el line-up ni siquiera
  // existe hasta que se captura el juego.
  if (known) {
    const participantIds = new Set([
      ...(game.batting ?? []).map((l) => l.playerId),
      ...(game.pitching ?? []).map((l) => l.playerId),
      ...(game.fielding ?? []).map((l) => l.playerId),
    ]);
    renderMvpVote(container, game, participantIds);
  }

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
        GO: line.GO ?? 0,
        FO: line.FO ?? 0,
        LO: line.LO ?? 0,
        SB: line.SB ?? 0,
        AVG: formatAvg(line.H ?? 0, line.AB ?? 0),
      };
    });

  const lineupColumns = [
    {
      key: "order",
      label: "#",
      full: "Turno al bat (flecha verde = entró de cambio, roja = salió)",
      numeric: true,
      sticky: true,
      render: (value, row) => {
        if (row.subStatus === "in") {
          return `${value} <span class="stat-green" title="Entró en la entrada ${row.subInning}">▲</span>`;
        }
        if (row.subStatus === "out") {
          return `${value} <span class="stat-red" title="Salió en la entrada ${row.subInning}">▼</span>`;
        }
        return String(value);
      },
    },
    { key: "name", label: "Jugador", sticky: true },
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
    { key: "HRC", label: "HRC", full: "HR Campo", numeric: true },
    { key: "R", label: "R", full: "Carreras", numeric: true },
    { key: "RBI", label: "RBI", full: "Impulsadas", numeric: true },
    { key: "BB", label: "BB", full: "Bases por bolas", numeric: true },
    { key: "SO", label: "SO", full: "Ponches", numeric: true, render: (v) => coloredStat(v, "stat-red") },
    { key: "SB", label: "SB", full: "Bases robadas", numeric: true },
    { key: "GO", label: "GO", full: "Out por rodado", numeric: true },
    { key: "FO", label: "FO", full: "Out por elevado", numeric: true },
    { key: "LO", label: "LO", full: "Out por línea", numeric: true },
    { key: "AVG", label: "AVG", full: "Promedio del juego", numeric: true },
  ];

  const lineupEl = document.createElement("div");
  container.appendChild(lineupEl);
  renderSortableTable(lineupEl, {
    columns: lineupColumns,
    rows: lineupRows,
    defaultSort: "order",
    defaultDir: 1,
    sortable: false,
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
    rowClass: (row) => (row.playerId === getCurrentPlayerId() ? "row-you" : ""),
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
    { key: "name", label: "Jugador", sticky: true },
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
    sortable: false,
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
    rowClass: (row) => (row.playerId === getCurrentPlayerId() ? "row-you" : ""),
  });
  renderGlossary(container, pitchingColumns);

  const fieldingHeading = document.createElement("h3");
  fieldingHeading.textContent = "Fildeo";
  container.appendChild(fieldingHeading);

  const battingPositionByPlayer = new Map((game.batting ?? []).map((l) => [l.playerId, l.position]));
  const pitcherIds = new Set((game.pitching ?? []).map((l) => l.playerId));

  const fieldingRows = (game.fielding ?? [])
    .map((line) => {
      const position = battingPositionByPlayer.get(line.playerId) || (pitcherIds.has(line.playerId) ? "P" : "");
      return {
        playerId: line.playerId,
        name: playerName(line.playerId),
        position,
        positionOrder: FIELD_ORDER.includes(position) ? FIELD_ORDER.indexOf(position) : 99,
        PO: line.PO ?? 0,
        A: line.A ?? 0,
        E: line.E ?? 0,
      };
    })
    .sort((a, b) => a.positionOrder - b.positionOrder);

  const fieldingColumns = [
    { key: "name", label: "Jugador", sticky: true },
    {
      key: "position",
      label: "Pos",
      full: "Posición en el campo",
      render: (value) => renderPositionBadge(value),
    },
    { key: "PO", label: "PO", full: "Outs realizados", numeric: true },
    { key: "A", label: "A", full: "Asistencias", numeric: true },
    { key: "E", label: "E", full: "Errores", numeric: true },
  ];

  const fieldingEl = document.createElement("div");
  container.appendChild(fieldingEl);
  renderSortableTable(fieldingEl, {
    columns: fieldingColumns,
    rows: fieldingRows,
    defaultSort: "positionOrder",
    defaultDir: 1,
    sortable: false,
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
    rowClass: (row) => (row.playerId === getCurrentPlayerId() ? "row-you" : ""),
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
      sortable: false,
    });
    renderGlossary(container, subsColumns);
  }

  renderComments(container, { contextType: "game", contextId: game.id });
}
