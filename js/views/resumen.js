import { GAMES, SCHEDULE, TEAM, PLAYERS } from "../data.js";
import {
  teamRecord,
  battingTotals,
  pitchingTotals,
  gameResult,
  currentStreak,
  teamBattingTotals,
  teamPitchingTotals,
  teamFieldingTotals,
  minPlateAppearances,
  seasonRecords,
} from "../stats.js";
import { heading, escapeHtml, renderAvatar } from "../ui.js";
import { getCurrentPlayerId } from "../auth.js";
import { getRsvps, setRsvp, getAnnouncements, getAnnouncementLikes, likeAnnouncement, unlikeAnnouncement } from "../db.js";

const FORM_CHIP = {
  W: { letter: "W", cls: "badge-win" },
  L: { letter: "L", cls: "badge-loss" },
  T: { letter: "E", cls: "badge-tie" },
};

function formatGameDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  const text = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Tarjeta de líder con el #1 en grande (encabezado a color + su foto) y el
// 2do/3er lugar chico debajo (avatar + nombre + valor). La usan "Líderes de
// la temporada" y "Salón de la fama" (Más veterano, Más MVPs); el resto de
// tarjetas basadas en .leader-card (récords, stats de equipo, etc.) siguen
// su propio formato. `list` acepta tanto filas de stats (con `.playerId`,
// ver stats.js) como jugadores de PLAYERS tal cual (con `.id`, ver
// withSeasons/mvpCounts más abajo) — playerFor() resuelve cualquiera de los
// dos contra PLAYERS para sacar la foto real.
function playerFor(row) {
  return PLAYERS.find((pl) => pl.id === (row.playerId ?? row.id)) ?? row;
}

function teamLeaderCardHtml({ icon, title, list, valueOf, detailOf, note }) {
  const [first, second, third] = list;
  if (!first) {
    return `
      <div class="leader-card leader-card--hero">
        <div class="leader-hero">
          <div class="leader-hero-main">
            <h3><i class="fa-solid ${icon}"></i>${title}</h3>
            <p>Sin datos todavía.</p>
          </div>
        </div>
      </div>
    `;
  }
  const heroPlayer = playerFor(first);
  const runnersUp = [second, third].filter(Boolean);
  const runnersHtml = runnersUp.length
    ? `
      <div class="leader-runners">
        ${runnersUp
          .map((p) => {
            const rp = playerFor(p);
            return `
              <div class="leader-runner-row">
                ${renderAvatar(rp, 26)}
                <span class="leader-runner-name">${escapeHtml(p.name)}</span>
                <span class="leader-runner-value">${valueOf(p)}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    `
    : "";
  const noteHtml = note ? `<p class="leader-note">${note}</p>` : "";
  return `
    <div class="leader-card leader-card--hero">
      <div class="leader-hero">
        <div class="leader-hero-main">
          <h3><i class="fa-solid ${icon}"></i>${title}</h3>
          <span class="leader-hero-value">${valueOf(first)}</span>
          <span class="leader-hero-name">${escapeHtml(first.name)}</span>
          ${detailOf ? `<span class="leader-hero-detail">${detailOf(first)}</span>` : ""}
        </div>
        <div class="leader-hero-avatar">${renderAvatar(heroPlayer, 72)}</div>
      </div>
      ${runnersHtml}
      ${noteHtml}
    </div>
  `;
}

// Botones Sí/No (solo con cuenta vinculada a un jugador) dentro de la
// tarjeta de "Próximo juego" — sin lista de quién ya confirmó, eso vive
// en admin.html (ver js/admin-rsvp.js), no aquí. Se llama una vez por
// tarjeta — en la práctica SCHEDULE casi siempre trae 0 o 1 juego.
export function wireRsvp(cardEl, gameId) {
  const actionsEl = cardEl.querySelector(".rsvp-actions");

  function renderActions(myStatus) {
    if (!getCurrentPlayerId()) {
      actionsEl.innerHTML = `<p class="auth-hint">Inicia sesión para confirmar tu asistencia.</p>`;
      return;
    }
    actionsEl.innerHTML = `
      <button type="button" class="rsvp-btn rsvp-yes${myStatus === "yes" ? " active" : ""}" data-status="yes">
        <i class="fa-solid fa-check"></i> Voy
      </button>
      <button type="button" class="rsvp-btn rsvp-no${myStatus === "no" ? " active" : ""}" data-status="no">
        <i class="fa-solid fa-xmark"></i> No voy
      </button>
    `;
    for (const btn of actionsEl.querySelectorAll(".rsvp-btn")) {
      btn.addEventListener("click", async () => {
        for (const b of actionsEl.querySelectorAll(".rsvp-btn")) b.disabled = true;
        try {
          await setRsvp(gameId, btn.dataset.status);
          await refresh();
        } catch {
          // Silencioso a propósito: un error de red no debe romper la
          // tarjeta, el jugador simplemente puede volver a intentar.
        } finally {
          for (const b of actionsEl.querySelectorAll(".rsvp-btn")) b.disabled = false;
        }
      });
    }
  }

  async function refresh() {
    const rows = await getRsvps(gameId);
    const mine = rows.find((r) => r.player_id === getCurrentPlayerId());
    renderActions(mine?.status ?? null);
  }

  refresh();
}

function formatAnnouncementDate(iso) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long" });
}

// canLike = hay sesión vinculada a un jugador. El contador se ve siempre,
// con o sin cuenta (lectura pública); solo dar/quitar like requiere cuenta.
function announcementItem(a, likeCount, likedByMe, canLike) {
  return `
    <div class="announcement-item">
      <span class="announcement-date">${formatAnnouncementDate(a.created_at)}</span>
      <p class="announcement-body">${escapeHtml(a.body)}</p>
      <button type="button" class="announcement-like-btn${likedByMe ? " active" : ""}" data-announcement="${a.id}"${canLike ? "" : " disabled"}>
        <i class="fa-solid fa-heart"></i> <span class="announcement-like-count">${likeCount}</span>
      </button>
    </div>
  `;
}

export function renderResumen(container) {
  heading(container, "Resumen de temporada");

  // Anuncios del equipo — solo se pintan si hay alguno (el coach los publica
  // desde admin.html, ver js/admin-announcements.js). Van antes que todo lo
  // demás porque son avisos, se quieren ver de inmediato al abrir la app.
  const announcementsSlot = document.createElement("div");
  container.appendChild(announcementsSlot);

  async function refreshAnnouncements() {
    const items = await getAnnouncements(3);
    if (items.length === 0) {
      announcementsSlot.innerHTML = "";
      return;
    }
    const likes = await getAnnouncementLikes(items.map((a) => a.id));
    const myId = getCurrentPlayerId();
    const likeCounts = new Map();
    const likedByMe = new Set();
    for (const like of likes) {
      likeCounts.set(like.announcement_id, (likeCounts.get(like.announcement_id) ?? 0) + 1);
      if (myId && like.player_id === myId) likedByMe.add(like.announcement_id);
    }
    announcementsSlot.innerHTML = `
      <div class="leader-card announcements-card">
        <h3><i class="fa-solid fa-bullhorn"></i>Anuncios</h3>
        <div class="announcements-list">${items
          .map((a) => announcementItem(a, likeCounts.get(a.id) ?? 0, likedByMe.has(a.id), !!myId))
          .join("")}</div>
      </div>
    `;
  }

  // Delegado en announcementsSlot (nunca se reemplaza, solo su innerHTML en
  // cada refresh) — mismo patrón que el like de comentarios en
  // js/views/comments.js.
  announcementsSlot.addEventListener("click", async (e) => {
    const btn = e.target.closest(".announcement-like-btn");
    if (!btn || btn.disabled) return;
    const id = Number(btn.dataset.announcement);
    const alreadyLiked = btn.classList.contains("active");
    btn.disabled = true;
    try {
      if (alreadyLiked) {
        await unlikeAnnouncement(id);
      } else {
        await likeAnnouncement(id);
      }
      await refreshAnnouncements();
    } catch {
      btn.disabled = false;
    }
  });

  refreshAnnouncements();

  const rec = teamRecord(GAMES);
  const cards = document.createElement("div");
  cards.className = "cards tab-carousel";
  cards.innerHTML = `
    <div class="card">
      <i class="fa-solid fa-trophy card-icon"></i>
      <span class="card-value">${rec.W}-${rec.L}${rec.T ? `-${rec.T}` : ""}</span>
      <span class="card-label">Récord</span>
    </div>
    <div class="card">
      <i class="fa-solid fa-bolt card-icon"></i>
      <span class="card-value">${rec.RF}</span>
      <span class="card-label">Carreras anotadas</span>
    </div>
    <div class="card">
      <i class="fa-solid fa-shield-halved card-icon"></i>
      <span class="card-value">${rec.RA}</span>
      <span class="card-label">Carreras permitidas</span>
    </div>
    <div class="card">
      <i class="fa-solid fa-ranking-star card-icon"></i>
      <span class="card-value">${TEAM.leaguePosition ? `${TEAM.leaguePosition}°` : "—"}</span>
      <span class="card-label">Posición en la liga${TEAM.leagueTeams ? ` (de ${TEAM.leagueTeams})` : ""}</span>
    </div>
  `;
  container.appendChild(cards);

  const bottomRow = document.createElement("div");
  bottomRow.className = "leaders section-gap";

  // El próximo juego va primero: es lo que más se consulta entre semana, y
  // en celular esta fila es un carrusel — lo importante debe estar a un
  // deslizazo de distancia, no al final.
  for (const g of SCHEDULE) {
    const next = document.createElement("div");
    next.className = "leader-card";
    next.innerHTML = `
      <h3><i class="fa-solid fa-calendar-day"></i>Próximo juego</h3>
      <p class="next-game-info">${formatGameDate(g.date)}${g.time ? ` — ${g.time}` : ""}<br>vs ${g.opponent}</p>
      <div class="rsvp-actions"></div>
    `;
    bottomRow.appendChild(next);
    wireRsvp(next, g.id);
  }

  const streak = currentStreak(GAMES);
  if (streak) {
    const STREAK_LABEL = { W: "victoria", L: "derrota", T: "empate" };
    const STREAK_ICON = { W: "fa-fire", L: "fa-arrow-trend-down", T: "fa-equals" };
    const word = STREAK_LABEL[streak.type];
    const plural = streak.count === 1 ? word : `${word}s`;
    const streakCard = document.createElement("div");
    streakCard.className = "leader-card";
    streakCard.innerHTML = `
      <h3><i class="fa-solid ${STREAK_ICON[streak.type]}"></i>Racha actual</h3>
      <p>${streak.count} ${plural} seguida${streak.count === 1 ? "" : "s"}</p>
    `;
    bottomRow.appendChild(streakCard);
  }

  const recentGames = [...GAMES].sort((a, b) => a.date.localeCompare(b.date)).slice(-5);
  if (recentGames.length > 0) {
    const form = document.createElement("div");
    form.className = "leader-card form-card";
    form.innerHTML = `
      <h3><i class="fa-solid fa-clock-rotate-left"></i>Racha reciente</h3>
      <div class="form-strip">
        ${recentGames
          .map((g) => {
            const chip = FORM_CHIP[gameResult(g)] ?? { letter: "?", cls: "badge-unknown" };
            return `<span class="badge form-chip ${chip.cls}" title="${g.opponent} — ${g.date}">${chip.letter}</span>`;
          })
          .join("")}
      </div>
    `;
    bottomRow.appendChild(form);
  }

  const gamesPlayedCard = document.createElement("div");
  gamesPlayedCard.className = "leader-card";
  gamesPlayedCard.innerHTML = `
    <h3><i class="fa-solid fa-calendar-check"></i>Juegos jugados</h3>
    <p>${rec.G}/${TEAM.gamesInSeason}</p>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${Math.min(100, (rec.G / TEAM.gamesInSeason) * 100)}%"></div>
    </div>
  `;
  bottomRow.appendChild(gamesPlayedCard);

  if (bottomRow.children.length > 0) container.appendChild(bottomRow);

  const teamBat = teamBattingTotals(GAMES);
  const teamPit = teamPitchingTotals(GAMES);
  const teamFld = teamFieldingTotals(GAMES);

  const teamHeading = document.createElement("h3");
  teamHeading.textContent = "Stats de equipo";
  container.appendChild(teamHeading);

  const teamRow = document.createElement("div");
  teamRow.className = "leaders grid-4 team-stats-row tab-carousel";
  teamRow.innerHTML = `
    <div class="leader-card">
      <h3><i class="fa-solid fa-baseball-bat-ball"></i>Bateo de equipo</h3>
      <p>AVG ${teamBat.AVG} · OBP ${teamBat.OBP} · SLG ${teamBat.SLG}</p>
    </div>
    <div class="leader-card">
      <h3><i class="fa-solid fa-bomb"></i>Home runs de equipo</h3>
      <p>${teamBat.HR} HR</p>
    </div>
    <div class="leader-card">
      <h3><i class="fa-solid fa-baseball"></i>Pitcheo de equipo</h3>
      <p>WHIP ${teamPit.WHIP} · ${teamPit.SO} K</p>
    </div>
    <div class="leader-card">
      <h3><i class="fa-solid fa-shield"></i>Fildeo de equipo</h3>
      <p>FPCT ${teamFld.FPCT}</p>
    </div>
  `;
  container.appendChild(teamRow);

  const battingList = battingTotals(GAMES);
  // El líder de promedio solo sale de entre los que llegan al mínimo de
  // apariciones al plato; los demás siguen en la tabla de bateo completa.
  const minPA = minPlateAppearances(GAMES);
  const batSorted = battingList.filter((p) => p.qualified).sort((a, b) => Number(b.AVG) - Number(a.AVG));
  const hrSorted = [...battingList].sort((a, b) => (b.HR - a.HR) || (b.HRC - a.HRC));
  const rbiSorted = [...battingList].sort((a, b) => b.RBI - a.RBI);
  const sbSorted = [...battingList].sort((a, b) => b.SB - a.SB);
  // WHIP y no ERA: ERA depende de carreras limpias (ER), un dato que nunca
  // se captura en data.js — siempre saldría 0.00 para todos y el "líder"
  // sería un empate sin sentido. WHIP (bases por bolas + hits, por entrada)
  // no depende de ER, así que sí refleja algo real.
  const pitSorted = pitchingTotals(GAMES)
    .filter((p) => p.outs > 0)
    .sort((a, b) => Number(a.WHIP) - Number(b.WHIP));
  const soSorted = [...battingList].sort((a, b) => b.SO - a.SO);

  const leadersHeading = document.createElement("h3");
  leadersHeading.textContent = "Líderes de la temporada";
  container.appendChild(leadersHeading);

  const leadersRow = document.createElement("div");
  leadersRow.className = "leaders grid-2 tab-carousel";
  leadersRow.innerHTML =
    teamLeaderCardHtml({
      icon: "fa-baseball-bat-ball",
      title: "Líder de bateo",
      list: batSorted,
      valueOf: (p) => `${p.AVG}`,
      detailOf: (p) => `${p.HR} HR · ${p.RBI} RBI`,
      note: `Mínimo ${minPA} turnos (AB + BB) para calificar.`,
    }) +
    teamLeaderCardHtml({
      icon: "fa-bomb",
      title: "Líder de home runs",
      list: hrSorted,
      valueOf: (p) => (p.HR > 0 ? `${p.HR} HR` : `${p.HRC} HRC`),
    }) +
    teamLeaderCardHtml({
      icon: "fa-tornado",
      title: "Líder de impulsadas",
      list: rbiSorted,
      valueOf: (p) => `${p.RBI} RBI`,
    }) +
    teamLeaderCardHtml({
      icon: "fa-person-running",
      title: "Líder de robos",
      list: sbSorted,
      valueOf: (p) => `${p.SB} SB`,
    }) +
    teamLeaderCardHtml({
      icon: "fa-baseball",
      title: "Líder de pitcheo",
      list: pitSorted,
      valueOf: (p) => `${p.WHIP} WHIP`,
      detailOf: (p) => `${p.SO} K en ${p.IP} IP`,
    }) +
    teamLeaderCardHtml({
      icon: "fa-beer-mug-empty",
      title: "Líder cervecero",
      list: soSorted,
      valueOf: (p) => `${p.SO * 12} botes`,
      detailOf: (p) => `${p.SO} ponches`,
    });
  container.appendChild(leadersRow);

  // ---- Récords de temporada ----
  const records = seasonRecords(GAMES);
  if (records.length > 0) {
    const recordsHeading = document.createElement("h3");
    recordsHeading.textContent = "Récords de la temporada";
    container.appendChild(recordsHeading);

    // Mismo estilo "hero" que las tarjetas de líderes: la foto real del
    // dueño del récord a la derecha cuando hay uno solo (r.playerId); con
    // empate o récord de equipo no hay a quién retratar, así que se queda
    // con una insignia del icono del récord en su lugar. El 2do/3er lugar
    // (r.runnersUp) va abajo, igual que en Líderes de la temporada — con
    // avatar si es de un jugador, o la misma insignia si es otro juego (los
    // récords de equipo no tienen jugador que mostrar).
    const recordsRow = document.createElement("div");
    recordsRow.className = "records-grid tab-carousel";
    recordsRow.innerHTML = records
      .map((r) => {
        const visualHtml = r.playerId
          ? `<div class="record-hero-avatar">${renderAvatar(playerFor(r), 72)}</div>`
          : `<div class="record-icon-badge"><i class="fa-solid ${r.icon}"></i></div>`;
        const runnersHtml = r.runnersUp?.length
          ? `
            <div class="leader-runners">
              ${r.runnersUp
                .map(
                  (ru) => `
                    <div class="leader-runner-row">
                      ${
                        ru.playerId
                          ? renderAvatar(playerFor(ru), 26)
                          : `<span class="record-runner-icon"><i class="fa-solid ${r.icon}"></i></span>`
                      }
                      <span class="leader-runner-name">${escapeHtml(ru.name)}</span>
                      <span class="leader-runner-value">${ru.value}</span>
                    </div>
                  `
                )
                .join("")}
            </div>
          `
          : "";
        return `
        <div class="record-card record-card--hero"${r.playerId ? ` data-player="${r.playerId}"` : ""}${r.gameId ? ` data-game="${r.gameId}"` : ""}>
          <div class="record-hero">
            <div class="record-hero-main">
              <span class="record-label"><i class="fa-solid ${r.icon}"></i>${r.label}</span>
              <span class="record-value">${r.value}</span>
              <span class="record-detail">${r.detail}</span>
              <span class="record-note">${r.note}</span>
            </div>
            ${visualHtml}
          </div>
          ${runnersHtml}
        </div>
      `;
      })
      .join("");

    // Cada récord lleva al jugador (o al juego) que lo tiene.
    for (const card of recordsRow.querySelectorAll(".record-card")) {
      const { player, game } = card.dataset;
      if (!player && !game) continue;
      card.classList.add("record-clickable");
      card.addEventListener("click", () => {
        location.hash = player ? `#/jugador/${player}` : `#/juegos/${game}`;
      });
    }

    container.appendChild(recordsRow);
  }
}
