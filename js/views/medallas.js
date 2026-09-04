// Guía de medallas: catálogo de TODAS las medallas que existen (icono,
// nombre, cómo se ganan) más si TÚ ya la tienes — se llega aquí con el
// botón "Guía de medallas" del Medallero en el perfil (ver
// MEDALLERO_HEADER() en js/views/jugador.js). A diferencia del Medallero,
// que solo pinta lo que YA se ganó, esta vista existe justo para que se
// pueda ver qué falta por ganar. Es la MISMA lista sin importar desde qué
// perfil se haya abierto — lo único que cambia con el perfil de origen es
// a dónde regresa el link de "Volver al perfil"; el "¿la tienes?" siempre
// se calcula contra la sesión iniciada (getCurrentPlayerId()), no contra
// el jugador de la URL.
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
import { getCurrentPlayerId, getSession } from "../auth.js";
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
  { kind: "trajectory", icon: "fa-solid fa-egg", name: "Caimaneggs", how: "Estuvo en el equipo desde la primera temporada.", match: (l) => l === "Caimaneggs" },
  { kind: "trajectory", icon: "fa-solid fa-anchor", name: "Veteran", how: "Ha jugado más de 4 temporadas con el equipo.", match: (l) => l === "Veteran" },
  { kind: "trajectory", icon: "fa-solid fa-earth-americas", name: "Bon voyage", how: "Ha jugado en más de una liga con el equipo.", match: (l) => l === "Bon voyage" },
  // ---- Racha ----
  { kind: "streak", icon: "fa-solid fa-fire", name: "On Fire", how: "Racha activa de 2 o más juegos seguidos con hit.", match: (l) => l === "On Fire" },
  { kind: "streak", icon: "fa-solid fa-bolt", name: "The Streak", how: "Su racha más larga de la temporada fue de más de 5 juegos seguidos con hit (siga activa o no).", match: (l) => l === "The Streak" },
  { kind: "streak", icon: "fa-solid fa-fire-flame-curved", name: "Too Hot!", how: "Racha activa de 2 o más juegos seguidos con multi-hit (2 o más hits por juego).", match: (l) => l === "Too Hot!" },
  { kind: "streak", icon: "fa-solid fa-magnet", name: "Base Magnet", how: "Racha activa de 2 o más juegos seguidos embasándose (hit o base por bolas).", match: (l) => l === "Base Magnet" },
  // ---- Podio del equipo (oro/plata/bronce, según el lugar) ----
  { kind: "gold", icon: "fa-solid fa-baseball-bat-ball", name: "Golden / Silver / Bronze Bat", how: "Top 3 del equipo en promedio de bateo (AVG) esta temporada.", match: (l) => l.endsWith(" Bat") },
  { kind: "gold", icon: "fa-solid fa-bomb", name: "Kaboom!", how: "Top 3 del equipo en jonrones esta temporada.", match: (l) => l === "Kaboom!" },
  { kind: "gold", icon: "fa-solid fa-user-ninja", name: "Ninja", how: "Top 3 del equipo en bases robadas esta temporada.", match: (l) => l === "Ninja" },
  { kind: "gold", icon: "fa-solid fa-tornado", name: "Tornado", how: "Top 3 del equipo en carreras impulsadas (RBI) esta temporada.", match: (l) => l === "Tornado" },
  { kind: "gold", icon: "fa-solid fa-beer-mug-empty", name: "Bartender", how: "Top 3 del equipo en ponches de bateo esta temporada.", match: (l) => l === "Bartender" },
  { kind: "gold", icon: "fa-solid fa-crosshairs", name: "Snipper", how: "Top 3 del equipo en ponches propinados (pitcheo) esta temporada.", match: (l) => l === "Snipper" },
  { kind: "gold", icon: "fa-solid fa-dumbbell", name: "Iron Arm", how: "Top 3 del equipo en entradas lanzadas (IP) esta temporada.", match: (l) => l === "Iron Arm" },
  { kind: "gold", icon: "fa-solid fa-hand-fist", name: "Golden / Silver / Bronze Glove", how: "Top 3 del equipo en porcentaje de fildeo (FPCT) esta temporada.", match: (l) => l.endsWith(" Glove") },
  { kind: "gold", icon: "fa-solid fa-skull-crossbones", name: "Killer", how: "Top 3 del equipo en outs realizados (PO) esta temporada.", match: (l) => l === "Killer" },
  { kind: "gold", icon: "fa-solid fa-dice", name: "Double Trouble", how: "Top 3 del equipo en dobles esta temporada.", match: (l) => l === "Double Trouble" },
  { kind: "gold", icon: "fa-solid fa-chess-knight", name: "Triple Threat", how: "Top 3 del equipo en triples esta temporada.", match: (l) => l === "Triple Threat" },
  { kind: "gold", icon: "fa-solid fa-crow", name: "Eagle Eye", how: "Top 3 del equipo en bases por bolas (BB) esta temporada.", match: (l) => l === "Eagle Eye" },
  { kind: "gold", icon: "fa-solid fa-scale-balanced", name: "Patient", how: "Top 3 del equipo en relación bases por bolas / ponches esta temporada.", match: (l) => l === "Patient" },
  { kind: "gold", icon: "fa-solid fa-star", name: "Starboy", how: "Top 3 del equipo en premios MVP esta temporada.", match: (l) => l === "Starboy" },
  // ---- Umbral fijo ----
  { kind: "threshold", icon: "fa-solid fa-meteor", name: "Estelar", how: "Promedio de bateo (AVG) de .300 o más esta temporada.", match: (l) => l === "Estelar" },
  { kind: "threshold", icon: "fa-solid fa-gem", name: "Diamante", how: "OPS de 1.000 o más esta temporada.", match: (l) => l === "Diamante" },
  { kind: "threshold", icon: "fa-solid fa-circle-notch", name: "Cycle", how: "Conectó sencillo, doble, triple y jonrón en el mismo juego.", match: (l) => l === "Cycle" },
  // ---- Participación ----
  { kind: "participation", icon: "fa-solid fa-calendar-check", name: "Inquebrantable", how: "Asistió a todos los juegos de la temporada.", match: (l) => l === "Inquebrantable" },
  { kind: "participation", icon: "fa-solid fa-hand", name: "Cumplidor", how: "Asistió a más de 5 juegos esta temporada.", match: (l) => l === "Cumplidor" },
  { kind: "participation", icon: "fa-solid fa-cat", name: "Nocturno", how: "Asistió a más de la mitad de los juegos a las 9:00pm de la temporada.", match: (l) => l === "Nocturno" },
  { kind: "participation", icon: "fa-solid fa-recycle", name: "Versátil", how: "Jugó en 3 o más posiciones distintas esta temporada.", match: (l) => l === "Versátil" },
  { kind: "participation", icon: "fa-solid fa-crown", name: "Rey Caimán", how: "Jugó en las 9 posiciones de campo esta temporada.", match: (l) => l === "Rey Caimán" },
  { kind: "participation", icon: "fa-solid fa-up-down", name: "Suplente", how: "Entró o salió de cambio en al menos 2 juegos de la temporada.", match: (l) => l === "Suplente" },
  { kind: "participation", icon: "fa-solid fa-wheelchair", name: "Fragile", how: "Se lesionó durante la temporada.", match: (l) => l === "Fragile" },
  // ---- Social ----
  { kind: "social", icon: "fa-solid fa-heart", name: "Fanático", how: "Le dio like a algún anuncio del equipo.", match: (l) => l === "Fanático", async: true },
  { kind: "social", icon: "fa-solid fa-comment", name: "Comentarista", how: "Comentó en al menos 5 juegos de la temporada.", match: (l) => l === "Comentarista", async: true },
  { kind: "social", icon: "fa-solid fa-thumbs-up", name: "Demócrata", how: "Votó por el MVP en al menos la mitad de los juegos de la temporada.", match: (l) => l === "Demócrata", async: true },
  { kind: "social", icon: "fa-solid fa-camera", name: "Selfie!", how: "Subió una foto de perfil personalizada.", match: (l) => l === "Selfie!", async: true },
  { kind: "social", icon: "fa-solid fa-music", name: "Greatests Hits", how: "Personalizó su canción de entrada (walkup song).", match: (l) => l === "Greatests Hits", async: true },
  // ---- Estado de inscripción ----
  { kind: "dues-paid", icon: "fa-solid fa-sack-dollar", name: "Rich kid", how: "Ya pagó la inscripción de la temporada.", match: (l) => l === "Rich kid", async: true },
  { kind: "dues-unpaid", icon: "fa-solid fa-trash-can", name: "Moroso", how: "Todavía no paga la inscripción de la temporada.", match: (l) => l === "Moroso", async: true },
];

// Mismas comprobaciones que las tarjetas "social"/"dues" del
// Medallero (ver js/views/jugador.js), repetidas aquí porque ahí viven
// mezcladas con el pintado progresivo del perfil (llaman a
// addAchievementMedal() directo) — separar solo la condición sin la parte
// de DOM habría sido más enredo que repetirla en chico.
async function getAsyncLabels(player) {
  const labels = [];

  const [avatarUrl, walkup] = await Promise.all([getAvatarUrl(player.id), getWalkupOverride(player.id)]);
  if (avatarUrl) labels.push("Selfie!");
  if (walkup) labels.push("Greatests Hits");

  if (getSession()) {
    const paid = await getDuesForPlayer(player.id);
    if (paid === true) labels.push("Rich kid");
    if (paid === false) labels.push("Moroso");
  }

  const announcements = await getAnnouncements(1000);
  if (announcements.length > 0) {
    const likes = await getAnnouncementLikes(announcements.map((a) => a.id));
    if (likes.some((l) => l.player_id === player.id)) labels.push("Fanático");
  }

  if (GAMES.length > 0) {
    const perGameComments = await Promise.all(GAMES.map((g) => getComments("game", g.id)));
    const gamesCommented = perGameComments.filter((comments) => comments.some((c) => c.player_id === player.id)).length;
    if (gamesCommented >= 5) labels.push("Comentarista");

    const perGameVotes = await Promise.all(GAMES.map((g) => getMvpVotes(g.id)));
    const minVotes = Math.ceil(GAMES.length / 2);
    const gamesVoted = perGameVotes.filter((votes) => votes.some((v) => v.voter_player_id === player.id)).length;
    if (gamesVoted >= minVotes) labels.push("Demócrata");
  }

  return labels;
}

// `labels`: null mientras se espera la respuesta async (fila en "Cargando…"),
// un array cuando ya se sabe — [] cuenta como "no la tienes", igual que
// cualquier otro array sin el nombre buscado (por ejemplo, sin sesión
// iniciada, ver renderMedallasGuide). Sí/No nomás, sin decir en qué lugar
// (oro/plata/bronce) quedó — eso ya lo dice el Medallero del perfil.
function statusCellHtml(entry, labels) {
  if (labels === null) return `<span class="medalla-status-pending">Cargando…</span>`;
  const obtained = labels.some((l) => entry.match(l));
  return obtained
    ? `<span class="stat-green"><i class="fa-solid fa-check"></i> Sí</span>`
    : `<span class="medalla-status-pending">No</span>`;
}

function rowHtml(entry, index, labels) {
  return `
    <tr data-row="${index}">
      <td>
        <div class="achievement-medal achievement-medal--${entry.kind}">
          <div class="achievement-medal-icon"><i class="${entry.icon}"></i></div>
        </div>
      </td>
      <td>${escapeHtml(entry.name)}</td>
      <td>${escapeHtml(entry.how)}</td>
      <td data-cell="status">${statusCellHtml(entry, labels)}</td>
    </tr>
  `;
}

export function renderMedallasGuide(container, fromPlayerId) {
  // Este id es SOLO para saber a qué perfil regresa el link de arriba — el
  // catálogo y el "¿la tienes?" de abajo son iguales sin importar desde
  // dónde se haya llegado (ver comentario del archivo).
  const fromPlayer = PLAYERS.find((p) => p.id === fromPlayerId);

  const back = document.createElement("a");
  back.href = fromPlayer ? `#/jugador/${fromPlayer.id}` : "#/roster";
  back.className = "back-link back-link--spaced";
  back.innerHTML = `<i class="fa-solid fa-arrow-left"></i> Volver al ${fromPlayer ? "perfil" : "roster"}`;
  container.appendChild(back);

  // "¿La tienes?" siempre es sobre TU cuenta, no sobre el perfil de origen
  // — por eso getCurrentPlayerId() y no fromPlayer.
  const myId = getCurrentPlayerId();
  const me = PLAYERS.find((p) => p.id === myId);

  heading(container, "Guía de medallas");

  // Sin sesión vinculada no hay contra quién comprobar nada: el catálogo se
  // ve completo igual, pero todo en "No" — no hace falta esperar ninguna
  // respuesta de Supabase.
  const syncLabels = me ? renderAchievements(me).map((c) => c.label) : [];

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
        ${CATALOG.map((entry, index) => rowHtml(entry, index, entry.async && me ? null : syncLabels)).join("")}
      </tbody>
    </table>
  `;
  container.appendChild(wrap);

  if (!me) return;

  getAsyncLabels(me).then((asyncLabels) => {
    const allLabels = [...syncLabels, ...asyncLabels];
    CATALOG.forEach((entry, index) => {
      if (!entry.async) return;
      const cell = wrap.querySelector(`tr[data-row="${index}"] [data-cell="status"]`);
      if (cell) cell.innerHTML = statusCellHtml(entry, allLabels);
    });
  });
}
