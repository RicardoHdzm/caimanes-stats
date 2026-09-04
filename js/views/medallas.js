// Guía de medallas: catálogo de TODAS las medallas que existen (icono,
// nombre, cómo se ganan) más si el jugador de la URL ya la tiene — se llega
// aquí con el botón "Guía de medallas" del Medallero en el perfil (ver
// MEDALLERO_HEADER() en js/views/jugador.js). A diferencia del Medallero,
// que solo pinta lo que YA se ganó, esta vista existe justo para que se
// pueda ver qué falta por ganar.
//
// El catálogo es una lista de texto de mano, separada del cálculo real de
// cada logro (renderAchievements() en js/views/jugador.js, más las
// comprobaciones async de más abajo) — `match(label)` conecta las dos
// cosas: para las de nombre fijo compara exacto, para las de oro/plata/
// bronce con nombre variable (Bate/Guante de oro, plata, bronce) le basta
// con que empiece igual, sin importar el lugar. Si algún día se agrega o
// renombra un logro, hay que actualizar esta lista a mano — no hay forma
// de generarla sola sin duplicar la lógica de cálculo en sentido inverso.
import { PLAYERS, GAMES } from "../data.js";
import { heading, escapeHtml } from "../ui.js";
import { getSession } from "../auth.js";
import {
  getAvatarUrl,
  getWalkupOverride,
  getDuesForPlayer,
  getAnnouncements,
  getAnnouncementLikes,
  getComments,
  getMvpVotes,
} from "../db.js";
import { renderAchievements } from "./jugador.js";

// `async: true` marca las que no salen de renderAchievements() (dependen de
// una respuesta de Supabase) — sus filas empiezan en "Cargando…" y se
// actualizan solas en cuanto contesta getAsyncLabels() más abajo.
const CATALOG = [
  // ---- Trayectoria ----
  { kind: "trajectory", icon: "fa-solid fa-egg", name: "Caiman OG", how: "Estuvo en el equipo desde la primera temporada.", match: (l) => l === "Caiman OG" },
  { kind: "trajectory", icon: "fa-solid fa-shield-halved", name: "Veterano", how: "Ha jugado temporadas con el equipo.", match: (l) => l === "Veterano" },
  { kind: "trajectory", icon: "fa-solid fa-earth-americas", name: "Trotamundos", how: "Ha jugado en más de una liga con el equipo.", match: (l) => l === "Trotamundos" },
  // ---- Racha ----
  { kind: "streak", icon: "fa-solid fa-fire", name: "Caliente", how: "Racha activa de 2 o más juegos seguidos con hit.", match: (l) => l === "Caliente" },
  { kind: "streak", icon: "fa-solid fa-award", name: "Hit Record", how: "Su racha más larga de la temporada fue de más de 5 juegos seguidos con hit (siga activa o no).", match: (l) => l === "Hit Record" },
  { kind: "streak", icon: "fa-solid fa-fire-flame-curved", name: "En llamas", how: "Racha activa de 2 o más juegos seguidos con multi-hit (2 o más hits por juego).", match: (l) => l === "En llamas" },
  { kind: "streak", icon: "fa-solid fa-life-ring", name: "Seguro", how: "Racha activa de 2 o más juegos seguidos embasándose (hit o base por bolas).", match: (l) => l === "Seguro" },
  // ---- Podio del equipo (oro/plata/bronce, según el lugar) ----
  { kind: "gold", icon: "fa-solid fa-medal", name: "Bate de oro / plata / bronce", how: "Top 3 del equipo en promedio de bateo (AVG) esta temporada.", match: (l) => l.startsWith("Bate de ") },
  { kind: "gold", icon: "fa-solid fa-bomb", name: "Bombardero", how: "Top 3 del equipo en jonrones esta temporada.", match: (l) => l === "Bombardero" },
  { kind: "gold", icon: "fa-solid fa-user-ninja", name: "Ninja", how: "Top 3 del equipo en bases robadas esta temporada.", match: (l) => l === "Ninja" },
  { kind: "gold", icon: "fa-solid fa-tornado", name: "Tornado", how: "Top 3 del equipo en carreras impulsadas (RBI) esta temporada.", match: (l) => l === "Tornado" },
  { kind: "gold", icon: "fa-solid fa-beer-mug-empty", name: "Mr. Expendio", how: "Top 3 del equipo en ponches de bateo esta temporada.", match: (l) => l === "Mr. Expendio" },
  { kind: "gold", icon: "fa-solid fa-crosshairs", name: "Francotirador", how: "Top 3 del equipo en ponches propinados (pitcheo) esta temporada.", match: (l) => l === "Francotirador" },
  { kind: "gold", icon: "fa-solid fa-hand-fist", name: "Guante de oro / plata / bronce", how: "Top 3 del equipo en porcentaje de fildeo (FPCT) esta temporada.", match: (l) => l.startsWith("Guante de ") },
  { kind: "gold", icon: "fa-solid fa-broom", name: "Escoba", how: "Top 3 del equipo en outs realizados (PO) esta temporada.", match: (l) => l === "Escoba" },
  { kind: "gold", icon: "fa-solid fa-dice", name: "Double Trouble", how: "Top 3 del equipo en dobles esta temporada.", match: (l) => l === "Double Trouble" },
  { kind: "gold", icon: "fa-solid fa-skull-crossbones", name: "Triple Kill", how: "Top 3 del equipo en triples esta temporada.", match: (l) => l === "Triple Kill" },
  { kind: "gold", icon: "fa-solid fa-eye", name: "Ojo de águila", how: "Top 3 del equipo en bases por bolas (BB) esta temporada.", match: (l) => l === "Ojo de águila" },
  { kind: "gold", icon: "fa-solid fa-bullseye", name: "Selectivo", how: "Top 3 del equipo en relación bases por bolas / ponches esta temporada.", match: (l) => l === "Selectivo" },
  { kind: "gold", icon: "fa-solid fa-star", name: "Estrella", how: "Top 3 del equipo en premios MVP esta temporada.", match: (l) => l === "Estrella" },
  // ---- Umbral fijo ----
  { kind: "threshold", icon: "fa-solid fa-baseball-bat-ball", name: "Estelar", how: "Promedio de bateo (AVG) de .300 o más esta temporada.", match: (l) => l === "Estelar" },
  { kind: "threshold", icon: "fa-solid fa-gem", name: "Fuera de serie", how: "OPS de 1.000 o más esta temporada.", match: (l) => l === "Fuera de serie" },
  // ---- Participación ----
  { kind: "participation", icon: "fa-solid fa-calendar-check", name: "Nerd", how: "Asistió a todos los juegos de la temporada.", match: (l) => l === "Nerd" },
  { kind: "participation", icon: "fa-solid fa-hand", name: "Cumplidor", how: "Asistió a más de 5 juegos esta temporada.", match: (l) => l === "Cumplidor" },
  { kind: "participation", icon: "fa-solid fa-shuffle", name: "Versátil", how: "Jugó en 3 o más posiciones distintas esta temporada.", match: (l) => l === "Versátil" },
  { kind: "participation", icon: "fa-solid fa-crown", name: "Comodín total", how: "Jugó en las 9 posiciones de campo esta temporada.", match: (l) => l === "Comodín total" },
  // ---- Social ----
  { kind: "social", icon: "fa-solid fa-heart", name: "Fan del equipo", how: "Le dio like a algún anuncio del equipo.", match: (l) => l === "Fan del equipo", async: true },
  { kind: "social", icon: "fa-solid fa-comment", name: "Comentarista", how: "Comentó en al menos 5 juegos de la temporada.", match: (l) => l === "Comentarista", async: true },
  { kind: "social", icon: "fa-solid fa-gavel", name: "Buen juez", how: "Votó por el MVP en al menos la mitad de los juegos de la temporada.", match: (l) => l === "Buen juez", async: true },
  // ---- Perfil ----
  { kind: "profile", icon: "fa-solid fa-camera", name: "Say Cheese", how: "Subió una foto de perfil personalizada.", match: (l) => l === "Say Cheese", async: true },
  { kind: "profile", icon: "fa-solid fa-music", name: "Soundtrack", how: "Personalizó su canción de entrada (walkup song).", match: (l) => l === "Soundtrack", async: true },
  // ---- Estado de inscripción ----
  { kind: "dues-paid", icon: "fa-solid fa-sack-dollar", name: "Rich kid", how: "Ya pagó la inscripción de la temporada.", match: (l) => l === "Rich kid", async: true, needsSession: true },
  { kind: "dues-unpaid", icon: "fa-solid fa-trash-can", name: "Moroso", how: "Todavía no paga la inscripción de la temporada.", match: (l) => l === "Moroso", async: true, needsSession: true },
];

// Mismas comprobaciones que las tarjetas "profile"/"social"/"dues" del
// Medallero (ver js/views/jugador.js), repetidas aquí porque ahí viven
// mezcladas con el pintado progresivo del perfil (llaman a
// addAchievementMedal() directo) — separar solo la condición sin la parte
// de DOM habría sido más enredo que repetirla en chico.
async function getAsyncLabels(player) {
  const labels = [];

  const [avatarUrl, walkup] = await Promise.all([getAvatarUrl(player.id), getWalkupOverride(player.id)]);
  if (avatarUrl) labels.push("Say Cheese");
  if (walkup) labels.push("Soundtrack");

  if (getSession()) {
    const paid = await getDuesForPlayer(player.id);
    if (paid === true) labels.push("Rich kid");
    if (paid === false) labels.push("Moroso");
  }

  const announcements = await getAnnouncements(1000);
  if (announcements.length > 0) {
    const likes = await getAnnouncementLikes(announcements.map((a) => a.id));
    if (likes.some((l) => l.player_id === player.id)) labels.push("Fan del equipo");
  }

  if (GAMES.length > 0) {
    const perGameComments = await Promise.all(GAMES.map((g) => getComments("game", g.id)));
    const gamesCommented = perGameComments.filter((comments) => comments.some((c) => c.player_id === player.id)).length;
    if (gamesCommented >= 5) labels.push("Comentarista");

    const perGameVotes = await Promise.all(GAMES.map((g) => getMvpVotes(g.id)));
    const minVotes = Math.ceil(GAMES.length / 2);
    const gamesVoted = perGameVotes.filter((votes) => votes.some((v) => v.voter_player_id === player.id)).length;
    if (gamesVoted >= minVotes) labels.push("Buen juez");
  }

  return labels;
}

function statusCellHtml(entry, labels) {
  if (entry.async && labels === null) {
    return `<span class="medalla-status-pending">Cargando…</span>`;
  }
  if (entry.needsSession && !getSession()) {
    return `<span class="medalla-status-pending">Requiere sesión</span>`;
  }
  const obtained = labels.find((l) => entry.match(l));
  return obtained
    ? `<span class="stat-green"><i class="fa-solid fa-check"></i> Sí — ${escapeHtml(obtained)}</span>`
    : `<span class="medalla-status-pending">Todavía no</span>`;
}

function rowHtml(entry, index, labels) {
  return `
    <tr data-row="${index}">
      <td>
        <div class="achievement-medal achievement-medal--${entry.kind}" style="width:auto;">
          <div class="achievement-medal-icon"><i class="${entry.icon}"></i></div>
        </div>
      </td>
      <td>${escapeHtml(entry.name)}</td>
      <td>${escapeHtml(entry.how)}</td>
      <td data-cell="status">${statusCellHtml(entry, labels)}</td>
    </tr>
  `;
}

export function renderMedallasGuide(container, playerId) {
  const player = PLAYERS.find((p) => p.id === playerId);

  const back = document.createElement("a");
  back.href = player ? `#/jugador/${player.id}` : "#/roster";
  back.className = "back-link";
  back.innerHTML = `<i class="fa-solid fa-arrow-left"></i> Volver al ${player ? "perfil" : "roster"}`;
  container.appendChild(back);

  if (!player) {
    heading(container, "Jugador no encontrado");
    return;
  }

  heading(container, "Guía de medallas", `Todas las medallas del Medallero y cómo se ganan — vista desde el perfil de ${player.name}.`);

  // Las de renderAchievements() ya se saben sin esperar a nadie; las
  // "async" (foto, walkup, inscripción, sociales) arrancan en "Cargando…" y
  // se resuelven solas (ver getAsyncLabels arriba).
  const syncLabels = renderAchievements(player).map((c) => c.label);

  const wrap = document.createElement("div");
  wrap.className = "table-wrap section-gap";
  wrap.innerHTML = `
    <table class="stats-table not-sortable medallas-table">
      <thead>
        <tr>
          <th>Medalla</th>
          <th>Nombre</th>
          <th>Cómo se obtiene</th>
          <th>¿La tienes?</th>
        </tr>
      </thead>
      <tbody>
        ${CATALOG.map((entry, index) => rowHtml(entry, index, entry.async ? null : syncLabels)).join("")}
      </tbody>
    </table>
  `;
  container.appendChild(wrap);

  getAsyncLabels(player).then((asyncLabels) => {
    const allLabels = [...syncLabels, ...asyncLabels];
    CATALOG.forEach((entry, index) => {
      if (!entry.async) return;
      const cell = wrap.querySelector(`tr[data-row="${index}"] [data-cell="status"]`);
      if (cell) cell.innerHTML = statusCellHtml(entry, allLabels);
    });
  });
}
