// Muro / feed de Inicio: una lista cronológica de lo que pasa en el equipo.
// EXCLUSIVO de cuentas con sesión (a petición expresa) — js/main.js manda
// al Resumen a los invitados. Las stats que antes vivían en "Inicio"
// (Récord, Líderes, Récords de temporada...) se movieron a la pestaña
// "Resumen", ver js/views/resumen.js y el routing en js/main.js.
//
// Ítems del feed, mezclados y ordenados por fecha (más nuevo arriba):
//   - aviso       (announcements)                + reacciones
//   - resultado   (GAMES + PLAYOFFS de data.js)  + reacciones, link al detalle
//   - comentario  (getRecentComments)            link al juego
//   - cumple      (player_profiles + fecha de hoy) + reacciones
//   - mvp         (1: el juego cerrado más reciente) + reacciones, link al juego
//
// Las reacciones de los avisos usan la tabla announcement_likes (id
// "aviso:<n>"); las de cumple/resultado/mvp usan feed_reactions (id
// sintético "bday:p15:2026", "resultado:g9", "mvp:g9"). onSet/onClear de
// wireReactionBar despachan por prefijo.
import { GAMES, PLAYOFFS, PLAYERS, CURRENT_SEASON } from "../data.js";
import { getCurrentPlayerId, getSession } from "../auth.js";
import {
  getAnnouncements,
  getAnnouncementLikes,
  likeAnnouncement,
  unlikeAnnouncement,
  getFeedReactions,
  setFeedReaction,
  clearFeedReaction,
  getMvpVotes,
  getAvatarUrl,
  cachedProfiles,
} from "../db.js";
import { heading, escapeHtml, renderAvatar } from "../ui.js";
import { reactionBarHtml, wireReactionBar } from "./reactions.js";

const MAX_ITEMS = 30;
const RECENT_RESULTS = 12;

function playerById(id) {
  return PLAYERS.find((p) => p.id === id) ?? null;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long" });
}

function shortDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// Avatar con el gancho [data-avatar] para que hydrateAvatars() lo reemplace
// por la foto de Storage si existe (mismo patrón que Resumen).
function avatarSlot(player, size) {
  if (!player) return "";
  return `<a class="feed-avatar" href="#/jugador/${player.id}" data-avatar="${player.id}" data-size="${size}">${renderAvatar(player, size)}</a>`;
}

async function hydrateAvatars(root) {
  await Promise.all(
    [...root.querySelectorAll("[data-avatar]")].map(async (slot) => {
      const url = await getAvatarUrl(slot.dataset.avatar);
      if (!url) return;
      const s = slot.dataset.size;
      slot.innerHTML = `<img class="avatar" src="${url}" alt="" style="width:${s}px;height:${s}px;font-size:${s * 0.4}px;">`;
    })
  );
}

// Juegos de la temporada actual (regular + playoffs) ya jugados, más nuevo
// primero, topados a RECENT_RESULTS.
function recentGames() {
  return [
    ...GAMES.filter((g) => g.season === CURRENT_SEASON),
    ...PLAYOFFS.filter((e) => e.season === CURRENT_SEASON).flatMap((e) => e.rounds.flatMap((r) => r.games ?? [])),
  ]
    .filter((g) => g.date && g.scoreUs != null && g.scoreThem != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_RESULTS);
}

// Jugadores que cumplen años HOY (día y mes, de player_profiles precargado).
function todaysBirthdays() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const out = [];
  for (const [playerId, prof] of cachedProfiles()) {
    if (prof.birthdayMonth === m && prof.birthdayDay === d) {
      const player = playerById(playerId);
      if (player) out.push({ player, year: now.getFullYear() });
    }
  }
  return out;
}

// El juego CERRADO más reciente de la temporada actual (el "abierto" a
// votación se salta con slice(1) — su MVP todavía no está definido). null
// si no hay o si nadie votó.
async function recentMvp() {
  const closed = GAMES.filter((g) => g.season === CURRENT_SEASON && g.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(1)[0];
  if (!closed) return null;
  const votes = await getMvpVotes(closed.id);
  if (votes.length === 0) return null;
  const tally = new Map();
  for (const v of votes) tally.set(v.voted_player_id, (tally.get(v.voted_player_id) ?? 0) + 1);
  const [leaderId] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  const player = playerById(leaderId);
  return player ? { game: closed, player } : null;
}

export function renderFeed(container) {
  // El feed es exclusivo de cuentas con sesión, a petición expresa.
  // js/main.js ya manda al Resumen a los invitados (ver currentRoute); este
  // chequeo es el candado de respaldo.
  if (!getSession()) return;

  heading(container, "Inicio");

  const canReact = !!getCurrentPlayerId();
  const listEl = document.createElement("div");
  listEl.className = "feed";
  container.appendChild(listEl);

  async function refresh() {
    // 1. Fuentes (el feed es de solo-sesión, ver el guard de arriba). Los
    // comentarios NO van en el feed (a petición expresa) — se leen en el
    // detalle de cada juego.
    const [announcements, mvp] = await Promise.all([getAnnouncements(20), recentMvp()]);
    const games = recentGames();
    const birthdays = todaysBirthdays();

    // 2. Ids de reacción y su carga.
    const feedIds = [
      ...games.map((g) => `resultado:${g.id}`),
      ...birthdays.map((b) => `bday:${b.player.id}:${b.year}`),
      ...(mvp ? [`mvp:${mvp.game.id}`] : []),
    ];
    const [annLikes, feedRx] = await Promise.all([
      announcements.length ? getAnnouncementLikes(announcements.map((a) => a.id)) : Promise.resolve([]),
      feedIds.length ? getFeedReactions(feedIds) : Promise.resolve([]),
    ]);
    const annRows = (id) =>
      annLikes.filter((r) => r.announcement_id === id).map((r) => ({ player_id: r.player_id, reaction: r.reaction }));
    const feedRows = (itemId) =>
      feedRx.filter((r) => r.item_id === itemId).map((r) => ({ player_id: r.player_id, reaction: r.reaction }));

    // 3. Ítems (con la barra de reacciones ya armada donde toca).
    const items = [];

    for (const a of announcements) {
      items.push({
        date: a.created_at,
        kind: "aviso",
        html: `
          <div class="feed-aviso-main">
            <div class="feed-aviso-header">
              <img class="feed-aviso-logo" src="assets/logo.png" alt="">
              <span class="feed-aviso-meta">Anuncio · ${fmtDate(a.created_at)}</span>
            </div>
            ${a.title ? `<p class="feed-aviso-title">${escapeHtml(a.title)}</p>` : ""}
            <p class="feed-aviso-body">${escapeHtml(a.body)}</p>
          </div>
          ${reactionBarHtml(`aviso:${a.id}`, annRows(a.id), { canReact })}`,
      });
    }

    for (const g of games) {
      const tied = g.scoreUs === g.scoreThem;
      const won = g.scoreUs > g.scoreThem;
      const verb = tied ? "Empatamos" : won ? "Ganamos" : "Perdimos";
      const cls = tied ? "tie" : won ? "win" : "loss";
      items.push({
        date: `${g.date}T12:00:00`,
        kind: "resultado",
        html: `
          <a class="feed-result" href="#/juegos/${g.id}">
            <span class="feed-result-icon feed-result-icon--${cls}"><i class="fa-solid fa-baseball"></i></span>
            <span class="feed-result-verb">${verb}</span>
            <span class="feed-result-score">${g.scoreUs}-${g.scoreThem}</span>
            <span class="feed-result-opp">vs ${escapeHtml(g.opponent ?? "rival")}${g.date ? ` · ${shortDate(g.date)}` : ""}</span>
          </a>
          ${reactionBarHtml(`resultado:${g.id}`, feedRows(`resultado:${g.id}`), { canReact })}`,
      });
    }

    for (const b of birthdays) {
      const rid = `bday:${b.player.id}:${b.year}`;
      items.push({
        date: `${b.year}-01-01T23:59:59`, // solo para el orden; se recalcula abajo al "hoy"
        kind: "cumple",
        html: `
          <div class="feed-cumple">
            ${avatarSlot(b.player, 64)}
            <span class="feed-cumple-label"><span class="feed-cumple-emoji">🎂</span> Cumpleaños</span>
            <a href="#/jugador/${b.player.id}" class="feed-cumple-name">${escapeHtml(b.player.name)}</a>
            <span class="feed-cumple-sub">¡Felicítalo!</span>
          </div>
          ${reactionBarHtml(rid, feedRows(rid), { canReact })}`,
      });
    }
    // Los cumpleaños son "de hoy": van hasta arriba del feed.
    const todayIso = new Date().toISOString();
    for (const it of items) if (it.kind === "cumple") it.date = todayIso;

    if (mvp) {
      const rid = `mvp:${mvp.game.id}`;
      items.push({
        date: `${mvp.game.date}T18:00:00`,
        kind: "mvp",
        html: `
          <div class="feed-mvp">
            ${avatarSlot(mvp.player, 64)}
            <span class="feed-mvp-label"><span class="feed-mvp-star">⭐</span> MVP del juego</span>
            <a href="#/jugador/${mvp.player.id}" class="feed-mvp-name">${escapeHtml(mvp.player.name)}</a>
            <span class="feed-mvp-opp">vs ${escapeHtml(mvp.game.opponent ?? "rival")}</span>
          </div>
          ${reactionBarHtml(rid, feedRows(rid), { canReact })}`,
      });
    }

    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    listEl.innerHTML = items.length
      ? items
          .slice(0, MAX_ITEMS)
          .map((it) => `<article class="feed-item feed-item--${it.kind}">${it.html}</article>`)
          .join("")
      : '<p class="subtitle">Todavía no hay nada en el muro.</p>';

    hydrateAvatars(listEl);
  }

  // Clics de reacción — delegado en listEl (solo cambia su innerHTML).
  wireReactionBar(listEl, {
    onSet: async (id, emoji) => {
      if (id.startsWith("aviso:")) await likeAnnouncement(Number(id.slice(6)), emoji);
      else await setFeedReaction(id, emoji);
      await refresh();
    },
    onClear: async (id) => {
      if (id.startsWith("aviso:")) await unlikeAnnouncement(Number(id.slice(6)));
      else await clearFeedReaction(id);
      await refresh();
    },
  });

  refresh();
}
