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
import {
  getRsvps,
  setRsvp,
  getAnnouncements,
  getAnnouncementLikes,
  likeAnnouncement,
  unlikeAnnouncement,
  getAvatarUrl,
} from "../db.js";

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
// 2do/3er lugar chico debajo (avatar + nombre + valor). La usa "Líderes de
// la temporada"; el resto de tarjetas basadas en .leader-card (récords,
// stats de equipo, etc.) siguen su propio formato. `list` trae filas de
// stats (battingTotals/pitchingTotals, con `.playerId`) — playerFor() las
// resuelve contra PLAYERS para sacar la foto real. También acepta jugadores
// de PLAYERS tal cual (con `.id` en vez de `.playerId`), por si se vuelve a
// necesitar para algo que no sea una fila de stats.
function playerFor(row) {
  return PLAYERS.find((pl) => pl.id === (row.playerId ?? row.id)) ?? row;
}

// Igual que renderAvatar(), pero como link a su perfil y envuelto en un
// `[data-avatar]` para que hydrateAvatars() (abajo) pueda reemplazarlo por
// la foto de Storage si existe — mismo patrón que ya usan el perfil
// individual y el comparador (ver js/views/jugador.js,
// js/views/comparar.js). Sin esto, un jugador con foto propia subida desde
// su perfil seguiría viéndose con sus iniciales aquí en Resumen.
function avatarSlot(player, size) {
  const id = player.id ?? player.playerId;
  return `<a class="avatar-slot" href="#/jugador/${id}" data-avatar="${id}" data-size="${size}">${renderAvatar(player, size)}</a>`;
}

// Reemplaza los avatares de siempre (foto de data.js o iniciales, ya
// pintados) por la foto personalizada de Storage cuando exista — lectura
// pública (ver getAvatarUrl en js/db.js), así que corre con o sin sesión.
async function hydrateAvatars(root) {
  const slots = [...root.querySelectorAll("[data-avatar]")];
  await Promise.all(
    slots.map(async (slot) => {
      const url = await getAvatarUrl(slot.dataset.avatar);
      if (!url) return;
      const size = slot.dataset.size;
      slot.innerHTML = `<img class="avatar" src="${url}" alt="" style="width:${size}px;height:${size}px;font-size:${size * 0.4}px;">`;
    })
  );
}

// Armazón "hero" para tarjetas de un solo valor, sin 2do/3er lugar (Récord,
// Próximo juego, Racha actual, Racha reciente, Juegos jugados, Stats de
// equipo): mismo encabezado a color que teamLeaderCardHtml, pero sin foto —
// no hay a quién retratar, es un dato del equipo o de la fecha, no de un
// jugador. Tampoco repite el icono en una insignia aparte: ya sale una vez
// en el título, y ponerlo otra vez a la derecha no aporta nada. `mainHtml`
// va junto al título (el valor grande, un párrafo, lo que sea); `bodyHtml`
// (opcional) es contenido extra debajo del encabezado, fuera del degradado
// — barra de progreso, chips de racha, botones de RSVP.
function heroCardInnerHtml(icon, title, mainHtml, bodyHtml = "") {
  return `
    <div class="leader-hero">
      <div class="leader-hero-main">
        <h3><i class="fa-solid ${icon}"></i>${title}</h3>
        ${mainHtml}
      </div>
    </div>
    ${bodyHtml ? `<div class="leader-hero-body">${bodyHtml}</div>` : ""}
  `;
}

function heroCardShell(icon, title, mainHtml, bodyHtml = "") {
  return `<div class="leader-card leader-card--hero">${heroCardInnerHtml(icon, title, mainHtml, bodyHtml)}</div>`;
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
                ${avatarSlot(rp, 26)}
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
        <div class="leader-hero-avatar">${avatarSlot(heroPlayer, 72)}</div>
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
      ${a.title ? `<p class="announcement-title">${escapeHtml(a.title)}</p>` : ""}
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
    const announcementsList = `<div class="announcements-list">${items
      .map((a) => announcementItem(a, likeCounts.get(a.id) ?? 0, likedByMe.has(a.id), !!myId))
      .join("")}</div>`;
    announcementsSlot.innerHTML = `
      <div class="leader-card leader-card--hero announcements-card">
        ${heroCardInnerHtml("fa-bullhorn", "Anuncios", "", announcementsList)}
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

  // Mismas tarjetas "hero" que el resto de Resumen (ver heroCardShell) en
  // vez de .card/.card-icon — esas siguen usándose tal cual en otras
  // páginas (ver js/views/jugador.js, js/lineup.js), así que no se tocan;
  // aquí nomás se cambia qué markup arma esta fila en particular.
  const rec = teamRecord(GAMES);
  const cards = document.createElement("div");
  cards.className = "cards tab-carousel";
  cards.innerHTML =
    heroCardShell("fa-trophy", "Récord", `<span class="leader-hero-value">${rec.W}-${rec.L}${rec.T ? `-${rec.T}` : ""}</span>`) +
    heroCardShell("fa-bolt", "Carreras anotadas", `<span class="leader-hero-value">${rec.RF}</span>`) +
    heroCardShell("fa-shield-halved", "Carreras permitidas", `<span class="leader-hero-value">${rec.RA}</span>`) +
    heroCardShell(
      "fa-ranking-star",
      `Posición en la liga${TEAM.leagueTeams ? ` (de ${TEAM.leagueTeams})` : ""}`,
      `<span class="leader-hero-value">${TEAM.leaguePosition ? `${TEAM.leaguePosition}°` : "—"}</span>`
    );
  container.appendChild(cards);

  const bottomRow = document.createElement("div");
  bottomRow.className = "leaders section-gap tab-carousel";

  // El próximo juego va primero: es lo que más se consulta entre semana, y
  // en celular esta fila es un carrusel — lo importante debe estar a un
  // deslizazo de distancia, no al final.
  for (const g of SCHEDULE) {
    const next = document.createElement("div");
    next.className = "leader-card leader-card--hero";
    next.innerHTML = heroCardInnerHtml(
      "fa-calendar-day",
      "Próximo juego",
      `<p><span class="leader-hero-value">vs</span> ${g.opponent}</p><p class="next-game-info">${formatGameDate(g.date)}${g.time ? ` — ${g.time}` : ""}</p>`,
      `<div class="rsvp-actions"></div>`
    );
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
    streakCard.className = "leader-card leader-card--hero";
    streakCard.innerHTML = heroCardInnerHtml(
      STREAK_ICON[streak.type],
      "Racha actual",
      `<span class="leader-hero-value">${streak.count}</span><span class="leader-hero-detail">${plural} seguida${streak.count === 1 ? "" : "s"}</span>`
    );
    bottomRow.appendChild(streakCard);
  }

  const recentGames = [...GAMES].sort((a, b) => a.date.localeCompare(b.date)).slice(-5);
  if (recentGames.length > 0) {
    const form = document.createElement("div");
    form.className = "leader-card leader-card--hero";
    form.innerHTML = heroCardInnerHtml(
      "fa-clock-rotate-left",
      "Racha reciente",
      "",
      `<div class="form-strip">
        ${recentGames
          .map((g) => {
            const chip = FORM_CHIP[gameResult(g)] ?? { letter: "?", cls: "badge-unknown" };
            return `<span class="badge form-chip ${chip.cls}" title="${g.opponent} — ${g.date}">${chip.letter}</span>`;
          })
          .join("")}
      </div>`
    );
    bottomRow.appendChild(form);
  }

  const gamesPlayedCard = document.createElement("div");
  gamesPlayedCard.className = "leader-card leader-card--hero";
  gamesPlayedCard.innerHTML = heroCardInnerHtml(
    "fa-calendar-check",
    "Juegos jugados",
    `<span class="leader-hero-value">${rec.G}/${TEAM.gamesInSeason}</span>`,
    `<div class="progress-bar">
      <div class="progress-fill" style="width: ${Math.min(100, (rec.G / TEAM.gamesInSeason) * 100)}%"></div>
    </div>`
  );
  bottomRow.appendChild(gamesPlayedCard);

  if (bottomRow.children.length > 0) container.appendChild(bottomRow);

  const teamBat = teamBattingTotals(GAMES);
  const teamPit = teamPitchingTotals(GAMES);
  const teamFld = teamFieldingTotals(GAMES);

  const teamHeading = document.createElement("h3");
  teamHeading.textContent = "Stats de equipo";
  container.appendChild(teamHeading);

  const teamRow = document.createElement("div");
  teamRow.className = "leaders grid-2 team-stats-row tab-carousel";
  teamRow.innerHTML =
    heroCardShell(
      "fa-baseball-bat-ball",
      "Bateo de equipo",
      `<span class="leader-hero-value">${teamBat.AVG}</span><span class="leader-hero-detail">OBP ${teamBat.OBP} · SLG ${teamBat.SLG}</span>`
    ) +
    heroCardShell("fa-bomb", "Home runs de equipo", `<span class="leader-hero-value">${teamBat.HR} HR</span>`) +
    heroCardShell(
      "fa-baseball",
      "Pitcheo de equipo",
      `<span class="leader-hero-value">${teamPit.WHIP} WHIP</span><span class="leader-hero-detail">${teamPit.SO} K</span>`
    ) +
    heroCardShell("fa-shield", "Fildeo de equipo", `<span class="leader-hero-value">${teamFld.FPCT}</span>`);
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
  hydrateAvatars(leadersRow);

  // ---- Récords de temporada ----
  const records = seasonRecords(GAMES);
  if (records.length > 0) {
    const recordsHeading = document.createElement("h3");
    recordsHeading.textContent = "Récords de la temporada";
    container.appendChild(recordsHeading);

    // Mismo estilo "hero" que las tarjetas de líderes: la foto real del
    // dueño del récord a la derecha cuando hay uno solo (r.playerId); con
    // empate o récord de equipo no hay a quién retratar, y como el icono ya
    // sale en el título no hace falta repetirlo en una insignia — el texto
    // ocupa todo el ancho. El 2do/3er lugar (r.runnersUp) va abajo, igual
    // que en Líderes de la temporada.
    const recordsRow = document.createElement("div");
    recordsRow.className = "records-grid tab-carousel";
    recordsRow.innerHTML = records
      .map((r) => {
        // Con un solo dueño, su foto grande; empatados entre jugadores, la
        // foto de cada uno (chica, en fila) — solo un récord de equipo se
        // queda sin nada, porque ahí de verdad no hay jugador que mostrar.
        let visualHtml = "";
        if (r.playerId) {
          visualHtml = `<div class="record-hero-avatar">${avatarSlot(playerFor(r), 72)}</div>`;
        } else if (r.playerIds?.length > 1) {
          const MAX_SHOWN = 4;
          const shown = r.playerIds.slice(0, MAX_SHOWN);
          const extra = r.playerIds.length - shown.length;
          visualHtml = `
            <div class="record-hero-avatar-group">
              ${shown.map((id) => avatarSlot(playerFor({ id }), 40)).join("")}
              ${extra > 0 ? `<span class="avatar-more">+${extra}</span>` : ""}
            </div>
          `;
        }
        const runnersHtml = r.runnersUp?.length
          ? `
            <div class="leader-runners">
              ${r.runnersUp
                .map(
                  (ru) => `
                    <div class="leader-runner-row">
                      ${
                        ru.playerId
                          ? avatarSlot(playerFor(ru), 26)
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
      card.addEventListener("click", (e) => {
        // Un avatar de 2do/3er lugar (u otro jugador empatado) es su propio
        // link a SU perfil — sin esto, este listener lo pisaría y siempre
        // mandaría al dueño principal del récord, sin importar en qué
        // avatar se haya hecho clic.
        if (e.target.closest("a")) return;
        location.hash = player ? `#/jugador/${player}` : `#/juegos/${game}`;
      });
    }

    container.appendChild(recordsRow);
    hydrateAvatars(recordsRow);
  }
}
