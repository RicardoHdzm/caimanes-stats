import { GAMES, TEAM, PLAYERS } from "../data.js";
import { playerName, gameResult } from "../stats.js";
import { heading, renderSortableTable, renderGlossary, coloredStat, renderPositionBadge, renderAvatar, escapeHtml } from "../ui.js";
import { getCurrentPlayerId } from "../auth.js";
import { getMvpVotes, setMvpVote, deleteMvpVote, getAvatarUrl } from "../db.js";
import { renderComments } from "./comments.js";

const RESULT_LABEL = { W: "Victoria", L: "Derrota", T: "Empate" };
const RESULT_BADGE_CLASS = { W: "badge-win", L: "badge-loss", T: "badge-tie" };
const FIELD_ORDER = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

function formatAvg(h, ab) {
  if (!ab) return ".000";
  return (h / ab).toFixed(3).replace(/^0\./, ".");
}

// "2026-09-01" -> "Martes 1 de septiembre de 2026". `T00:00:00` evita que
// el string se interprete como UTC y se recorra un día en husos negativos
// (mismo truco que ya usa formatGameDate en js/views/resumen.js).
function formatGameDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  const text = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "19:00" -> "7:00 pm". Solo se usa para mostrar; el valor crudo (24h) es
// el que se sigue guardando/capturando en Admin.
function formatGameTime(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const date = new Date(2000, 0, 1, h, m);
  return date.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
}

// El voto de MVP solo se acepta en el juego MÁS RECIENTE — en cuanto se
// agrega un juego posterior, el anterior se congela con lo que ya se votó
// (el badge/medallas siguen contando ese resultado, nomás ya no se puede
// cambiar). Por fecha (string ISO, ordena bien con localeCompare) y, si
// empatan (doble cartelera el mismo día), por el número más alto del id.
function isLatestGame(game) {
  if (GAMES.length === 0) return false;
  const latest = [...GAMES]
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return Number(String(a.id).replace(/^g/, "")) - Number(String(b.id).replace(/^g/, ""));
    })
    .at(-1);
  return latest?.id === game.id;
}

// Voto de MVP del equipo — es el ÚNICO MVP que existe (ya no se captura a
// mano en Admin): el líder claro del voto (más votos que cualquier otro,
// sin empate) es "el oficial" — se usa para el badge debajo de "Ver
// replay" (mvpBadgeSlot) y, en el perfil de cada jugador, para la medalla
// "Starboy" y el conteo de "MVP x N" (ver mvpCountsFromVotes, exportada de
// js/views/jugador.js). El conteo de votos es público; votar solo aparece
// habilitado si quien tiene sesión apareció en el line-up de ESTE juego
// (bateo, pitcheo o fildeo) — `participantIds` ya viene filtrado así.
//
// Antes era un <select> con nombres nada más; ahora cada candidato es una
// tarjeta con su foto y sus números DE ESTE JUEGO (no de temporada) — así
// se vota viendo quién de verdad la rompió ese día, sin tener que
// adivinar o irse a buscar el box score aparte. No se muestran TODOS los
// que jugaron: solo hasta MAX_MVP_CANDIDATES, por mejor desempeño (ver
// rankParticipants) — salvo un pitcher con decisión de Victoria o Salvamento,
// que siempre aparece aunque su noche al bat/campo haya sido floja.
const MAX_MVP_CANDIDATES = 6;

function mvpCardStats(game, playerId) {
  const batting = game.batting?.find((l) => l.playerId === playerId);
  const fielding = game.fielding?.find((l) => l.playerId === playerId);
  return {
    avg: formatAvg(batting?.H ?? 0, batting?.AB ?? 0),
    r: batting?.R ?? 0,
    rbi: batting?.RBI ?? 0,
    po: fielding?.PO ?? 0,
    a: fielding?.A ?? 0,
    h: batting?.H ?? 0,
  };
}

// Qué tan buena fue la noche de cada quien, en un solo número — hits +
// carreras + impulsadas + outs realizados + asistencias. Nada científico,
// nomás para separar a quien de verdad influyó en el juego de quien tuvo
// una noche tranquila, y no llenar la votación con 15+ tarjetas.
function performanceScore(game, playerId) {
  const { h, r, rbi, po, a } = mvpCardStats(game, playerId);
  return h + r + rbi + po + a;
}

// Quiénes entran a la boleta: hasta MAX_MVP_CANDIDATES por mejor
// desempeño, más cualquier pitcher con decisión W/SV (siempre entra, sin
// contar contra ese límite) — un cerrador que salvó el juego pudo no
// haber bateado ni fildeado nada esa noche, pero se ganó estar en la
// boleta igual. El orden final es de mejor a peor desempeño.
function rankParticipants(game, participantIds) {
  const guaranteedIds = new Set(
    (game.pitching ?? []).filter((l) => l.decision === "W" || l.decision === "SV").map((l) => l.playerId)
  );
  const scoreOf = new Map([...participantIds].map((id) => [id, performanceScore(game, id)]));
  const ranked = [...participantIds].sort((a, b) => scoreOf.get(b) - scoreOf.get(a));

  const candidateIds = new Set(guaranteedIds);
  for (const id of ranked) {
    if (candidateIds.size >= MAX_MVP_CANDIDATES) break;
    candidateIds.add(id);
  }
  return [...candidateIds].sort((a, b) => scoreOf.get(b) - scoreOf.get(a));
}

// Quiénes PUDIERON aparecer en la boleta de un juego — mismo cálculo que
// rankParticipants(), pero armando primero el participantIds desde cero.
// Exportada para que jugador.js/medallas.js puedan filtrar con esto los
// votos guardados: si se edita el box score de un juego DESPUÉS de que ya
// se votó (llega el capture real, se agrega una sustitución, etc.), un
// voto por alguien que ya no entra en el top 6 se queda huérfano en la
// base de datos — sin este filtro seguiría contando para el líder/medallas
// aunque su tarjeta ya ni se muestre (fue justo lo que pasó en g9: un voto
// por Javier Urquiza sobrevivió a que su noche dejara de ser top 6).
export function mvpCandidateIds(game) {
  const participantIds = new Set([
    ...(game.batting ?? []).map((l) => l.playerId),
    ...(game.pitching ?? []).map((l) => l.playerId),
    ...(game.fielding ?? []).map((l) => l.playerId),
  ]);
  return new Set(rankParticipants(game, participantIds));
}

// `mvpBadgeSlot` es el badge de "MVP: nombre" debajo de "Ver replay" (ver
// hero.innerHTML en renderJuegoDetalle) — se actualiza solo para reflejar
// al líder claro del voto; sin un líder claro (empate, o nadie ha votado
// todavía) se queda vacío.
function renderMvpVote(container, game, participantIds, mvpBadgeSlot, isLatest) {
  const gameId = game.id;
  const heading3 = document.createElement("h3");
  heading3.innerHTML = '<i class="fa-solid fa-star"></i>MVP del equipo';
  container.appendChild(heading3);

  // Sin hint cuando la votación sigue abierta — las tarjetas ya se explican
  // solas (botón vs. tarjeta informativa). Cerrada, sí se avisa por qué ya
  // no se puede votar.
  if (!isLatest) {
    const hint = document.createElement("p");
    hint.className = "subtitle";
    hint.textContent = "La votación de este juego ya cerró.";
    container.appendChild(hint);
  }

  const gridEl = document.createElement("div");
  gridEl.className = "mvp-vote-grid";
  gridEl.textContent = "Cargando votos…";
  container.appendChild(gridEl);

  const candidateIds = rankParticipants(game, participantIds);
  const pitchingByPlayer = new Map((game.pitching ?? []).map((l) => [l.playerId, l]));

  function cardHtml(playerId, voteCount, myVote, myId, isLeader) {
    const player = PLAYERS.find((p) => p.id === playerId);
    if (!player) return "";
    const isMine = playerId === myVote;
    // No puedes votar por ti mismo, y ya no se puede votar en absoluto si
    // este ya no es el juego más reciente (isLatest) — tu propia tarjeta
    // (o todas, si la votación cerró) se queda como informativa (<div>, no
    // <button>).
    const interactive = isLatest && !!myId && participantIds.has(myId) && playerId !== myId;
    const tag = interactive ? "button" : "div";
    const attrs = interactive ? `type="button" data-vote-for="${playerId}"` : "";
    const countBadge =
      voteCount > 0
        ? isLeader
          ? `<span class="mvp-vote-count mvp-vote-count--leader" title="Va ganando la votación"><i class="fa-solid fa-star"></i></span>`
          : `<span class="mvp-vote-count">${voteCount}</span>`
        : "";
    // Decisión de pitcheo (si tuvo) — sin esto, un cerrador que entró a la
    // boleta solo por su Salvamento se vería con puros ceros, sin ninguna
    // pista de por qué está ahí. Victoria en verde, Salvamento en amarillo.
    const pitchingLine = pitchingByPlayer.get(playerId);
    const decision = pitchingLine?.decision;
    const decisionClass = decision === "W" ? " mvp-vote-decision--win" : decision === "SV" ? " mvp-vote-decision--save" : "";
    const decisionBadge = decision ? `<span class="mvp-vote-decision${decisionClass}">${decision}</span>` : "";
    // Si pitcheó en este juego, sus números son de pitcheo (carreras
    // permitidas, bases por bolas, ponches, jonrones permitidos) — el AVG/
    // RBI/PO/A de bateo no dicen nada de una buena salida en la lomita.
    const statsHtml = pitchingLine
      ? `
        <span class="mvp-vote-stat"><b>${pitchingLine.R ?? 0}</b><small>R</small></span>
        <span class="mvp-vote-stat"><b>${pitchingLine.BB ?? 0}</b><small>BB</small></span>
        <span class="mvp-vote-stat"><b>${pitchingLine.SO ?? 0}</b><small>SO</small></span>
        <span class="mvp-vote-stat"><b>${pitchingLine.HR ?? 0}</b><small>HR</small></span>
      `
      : (() => {
          const { avg, r, rbi, po, a } = mvpCardStats(game, playerId);
          return `
            <span class="mvp-vote-stat"><b>${avg}</b><small>AVG</small></span>
            <span class="mvp-vote-stat"><b>${r}</b><small>R</small></span>
            <span class="mvp-vote-stat"><b>${rbi}</b><small>RBI</small></span>
            <span class="mvp-vote-stat"><b>${po}</b><small>PO</small></span>
            <span class="mvp-vote-stat"><b>${a}</b><small>A</small></span>
          `;
        })();
    return `
      <${tag} class="mvp-vote-card${isMine ? " active" : ""}" ${attrs}>
        ${decisionBadge}
        ${countBadge}
        <span class="mvp-vote-avatar" data-avatar-player="${playerId}">${renderAvatar(player, 52)}</span>
        <span class="mvp-vote-name">${escapeHtml(player.name)}</span>
        <div class="mvp-vote-stats">${statsHtml}</div>
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

  const candidateIdSet = new Set(candidateIds);

  async function refresh() {
    // Un voto por alguien que ya no está en la boleta (juego editado después
    // de votado — ver mvpCandidateIds) no debe contar ni para el líder ni
    // para el conteo de nadie: se descarta aquí, no solo al no dibujarlo.
    const rows = (await getMvpVotes(gameId)).filter((r) => candidateIdSet.has(r.voted_player_id));
    const counts = new Map();
    for (const r of rows) counts.set(r.voted_player_id, (counts.get(r.voted_player_id) ?? 0) + 1);
    const myId = getCurrentPlayerId();
    const myVote = rows.find((r) => r.voter_player_id === myId)?.voted_player_id ?? null;

    // Líder = quien tiene MÁS votos que cualquier otro — con empate (o sin
    // ningún voto) no hay líder claro, y el badge se queda vacío.
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const leaderId = sorted.length > 0 && (sorted.length === 1 || sorted[1][1] < sorted[0][1]) ? sorted[0][0] : null;

    // La estrella dorada y el pill de "MVP: nombre" son el resultado FINAL,
    // no un marcador en vivo — mientras la votación sigue abierta (isLatest)
    // el número de votos se ve normal en la tarjeta de quien va ganando,
    // pero sin adelantar quién es el MVP: eso solo se revela al cerrar,
    // cuando llega un juego más reciente y este deja de aceptar votos.
    const displayLeaderId = isLatest ? null : leaderId;

    gridEl.innerHTML = candidateIds
      .map((id) => cardHtml(id, counts.get(id) ?? 0, myVote, myId, id === displayLeaderId))
      .join("");

    if (mvpBadgeSlot) {
      mvpBadgeSlot.innerHTML = displayLeaderId
        ? `<div class="mvp-badge"><i class="fa-solid fa-star"></i> MVP: ${playerName(displayLeaderId)}</div>`
        : "";
    }

    // La foto de siempre (fija de data.js o iniciales) ya se pintó arriba
    // sin esperar a nadie — si alguien subió una foto propia a Storage, la
    // reemplaza (mismo patrón que el perfil y los comentarios). Solo para
    // quien de verdad está en la boleta (candidateIds), no todo participantIds.
    for (const id of candidateIds) {
      getAvatarUrl(id).then((url) => {
        if (!url) return;
        const slot = gridEl.querySelector(`[data-avatar-player="${id}"]`);
        if (!slot) return;
        const player = PLAYERS.find((p) => p.id === id);
        slot.innerHTML = `<img class="avatar" src="${url}" alt="${escapeHtml(player?.name ?? id)}" style="width:52px;height:52px;font-size:20.8px;">`;
      });
    }
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
    <div class="game-hero-date">${formatGameDate(game.date)}${game.time ? ` · ${formatGameTime(game.time)}` : ""}</div>
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
    <div id="mvp-badge-slot"></div>
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
    renderMvpVote(container, game, participantIds, hero.querySelector("#mvp-badge-slot"), isLatestGame(game));
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

  const outsRows = (game.outs ?? []).map((line) => {
    const GO = line.GO ?? 0;
    const FO = line.FO ?? 0;
    const LO = line.LO ?? 0;
    const BO = line.BO ?? 0;
    const RO = line.RO ?? 0;
    const SAC = line.SAC ?? 0;
    return {
      playerId: line.playerId,
      name: playerName(line.playerId),
      GO,
      FO,
      LO,
      BO,
      RO,
      SAC,
      TOTAL: GO + FO + LO + BO + RO + SAC,
    };
  });

  if (outsRows.length > 0) {
    const outsHeading = document.createElement("h3");
    outsHeading.textContent = "Outs";
    container.appendChild(outsHeading);

    const outsColumns = [
      { key: "name", label: "Jugador", sticky: true },
      { key: "GO", label: "GO", full: "Out por rodado", numeric: true },
      { key: "FO", label: "FO", full: "Out por elevado", numeric: true },
      { key: "LO", label: "LO", full: "Out por línea", numeric: true },
      { key: "BO", label: "BO", full: "Out en base", numeric: true },
      { key: "RO", label: "RO", full: "Out de regla", numeric: true },
      { key: "SAC", label: "SAC", full: "Out por sacrificio", numeric: true },
      { key: "TOTAL", label: "Total", numeric: true },
    ];

    const outsEl = document.createElement("div");
    container.appendChild(outsEl);
    renderSortableTable(outsEl, {
      columns: outsColumns,
      rows: outsRows,
      defaultSort: "TOTAL",
      onRowClick: (row) => {
        location.hash = `#/jugador/${row.playerId}`;
      },
      rowClass: (row) => (row.playerId === getCurrentPlayerId() ? "row-you" : ""),
    });
    renderGlossary(container, outsColumns);
  }

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
