import { PLAYERS, GAMES, SCHEDULE, SEASONS } from "../data.js";
import { battingTotals, pitchingTotals, fieldingTotals, gamesPlayedByPlayer, rankAmong, hitStreaks } from "../stats.js";
import {
  heading,
  renderSortableTable,
  renderGlossary,
  coloredStat,
  renderPositionBadges,
  renderAvatar,
  renderWalkup,
  escapeHtml,
  ordinalTemporada,
} from "../ui.js";
import { renderTrendChart } from "../charts.js";
import { getCurrentPlayerId, getSession, changePassword } from "../auth.js";
import {
  getWalkupOverride,
  setWalkup,
  getPositionOverride,
  setPosition,
  getDuesForPlayer,
  getAvatarUrl,
  uploadAvatar,
  getAnnouncements,
  getAnnouncementLikes,
  getComments,
  getMvpVotes,
} from "../db.js";
import { DEFENSE_POSITIONS } from "../lineup.js";
import { renderLockedComparison } from "./comparar.js";
import { wireRsvp } from "./resumen.js";

function formatAvg(h, ab) {
  if (!ab) return ".000";
  return (h / ab).toFixed(3).replace(/^0\./, ".");
}

// "Debut: 2023 - 2da Temporada - Liga Gaspasa" — solo si el jugador trae
// `seasons` en data.js (opcional, igual que photo/walkup). El debut es la
// más chica de la lista, no necesariamente la primera temporada del
// equipo: alguien pudo haber entrado después.
function renderDebut(seasons) {
  if (!seasons || seasons.length === 0) return "";
  const debut = Math.min(...seasons);
  const season = SEASONS[debut - 1];
  if (!season) return "";
  return `
    <div class="debut-badge">
      <i class="fa-solid fa-baseball-bat-ball"></i>
      Debut: ${season.year} · ${ordinalTemporada(debut)} Temporada · ${escapeHtml(season.league)}
    </div>
  `;
}

// Insignias de logros — hechos chicos calculados de lo que ya hay en
// data.js/GAMES, sin nada nuevo que mantener a mano. Públicas (no dependen
// de sesión): son datos de roster, no información privada. Van en su
// propia tarjeta (ver más abajo), varias por renglón — a diferencia de
// MVP/Debut, que siempre van solos en el suyo. `kind` es la CATEGORÍA, no
// el logro individual — todos los de una misma categoría comparten color
// (ver .achievement-badge--* en css/styles.css):
//   trajectory    (verde oliva) — fundador, temporadas en el equipo, ligas jugadas
//   streak        (verde)  — racha de hits vigente
//   gold/silver/bronze — 1er/2do/3er lugar del equipo en algo esta
//                             temporada (ver podiumChip() justo abajo)
//   threshold     (rosa)   — cruzaste una marca fija (no depende de ser el #1)
//   participation (morado) — asistencia y versatilidad de posiciones
//   social        (rojo rosado) — interacción con el equipo (ej. le dio
//                             like a un anuncio) — no es sobre jugar, por
//                             eso no comparte color con participation.
//   profile       (azul)   — personalizaste tu perfil (foto, walkup song) —
//                             estos dos dependen de Storage/Supabase, así
//                             que no salen de aquí: los agrega
//                             addAchievementMedal() más abajo, en cuanto
//                             getAvatarUrl()/getWalkupOverride() contestan.
//   dues-paid     (verde)  — ya pagó la inscripción de la temporada
//   dues-unpaid   (rojo)   — todavía no la paga — ambos junto al badge
//                             "Estado de inscripción" más abajo, solo con
//                             sesión iniciada (mismo criterio que ese badge).
// `desc` es la explicación que se ve al pasar el mouse (ver
// achievementMedalHtml() justo abajo) — cada logro debe traer uno.
//
// KIND_ORDER agrupa las medallas por categoría al pintarlas (ver
// sortedAchievementsHtml() más abajo) — sin esto salen en el orden en que
// se van evaluando las condiciones de arriba, que no tiene nada que ver con
// categoría y se ve desordenado. Inscripción (dues-*) siempre al final, a
// propósito: es la única que no tiene que ver con jugar.
const KIND_ORDER = [
  "trajectory",
  "streak",
  "gold",
  "silver",
  "bronze",
  "threshold",
  "participation",
  "social",
  "profile",
  "dues-paid",
  "dues-unpaid",
];

function sortedAchievementsHtml(chips) {
  return [...chips]
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    .map(achievementMedalHtml)
    .join("");
}

// Título de la tarjeta de medallas. El botón de la guía completa (ver
// MEDALLERO_GUIDE_BTN más abajo) va aparte, DESPUÉS del grid de medallas —
// en escritorio se ancla en la esquina con position:absolute (no importa
// dónde quede en el HTML), pero en celular pasa a flujo normal, y ahí sí
// importa: tiene que quedar debajo de las medallas, no entre el título y
// el grid.
function MEDALLERO_HEADER() {
  return `<h3><i class="fa-solid fa-medal"></i>Medallero</h3>`;
}

// Botón a la guía completa (ver js/views/medallas.js) — este jugador en
// específico, para que la guía ya sepa a qué perfil regresar. .medallero-card
// (ver css/styles.css) le da position:relative a la tarjeta para poder
// anclarlo en la esquina en escritorio.
function MEDALLERO_GUIDE_BTN(playerId) {
  return `<a href="#/medallas/${playerId}" class="medallero-guide-btn">Guía de medallas</a>`;
}

// Racha ACTIVA (hasta el juego más reciente) de juegos seguidos que cumplen
// `qualifies(line)` — mismo criterio que hitStreaks() en stats.js (un juego
// sin turnos al bat no cuenta ni a favor ni en contra, para no castigar a
// quien no bateó ese día), pero genérica para pedir otra condición además
// de "tuvo hit" (multi-hit, embasarse con hit o base por bolas, etc.). Se
// queda local aquí porque, a diferencia de hitStreaks(), nada más la usa
// esta vista.
function activeGameStreak(games, playerId, qualifies) {
  const ordered = [...games].sort((a, b) => a.date.localeCompare(b.date));
  let current = 0;
  for (const game of ordered) {
    const line = game.batting?.find((b) => b.playerId === playerId);
    if (!line || (line.AB ?? 0) <= 0) continue;
    current = qualifies(line) ? current + 1 : 0;
  }
  return current;
}

function achievementMedalHtml(c) {
  return `
    <div class="achievement-medal achievement-medal--${c.kind}" data-tooltip="${escapeHtml(c.desc)}" tabindex="0">
      <div class="achievement-medal-icon"><i class="${c.icon}"></i></div>
      <span class="achievement-medal-label">${escapeHtml(c.label)}</span>
    </div>
  `;
}

const PODIUM_KIND = { 1: "gold", 2: "silver", 3: "bronze" };
const PODIUM_METAL = { 1: "oro", 2: "plata", 3: "bronce" };

// Medalla de oro/plata/bronce según el lugar del jugador (1/2/3) en una
// estadística del equipo esta temporada — null si no calificó (su valor es
// 0) o no quedó en el podio. `label`/`desc` pueden ser un texto fijo (mismo
// nombre sin importar el lugar — Bombardero, Ninja, etc.) o una función
// `(valor, lugar)` para las que sí cambian de nombre por lugar (Bate/Guante
// de oro, plata, bronce).
function podiumChip(list, playerId, key, { icon, label, desc }) {
  const row = list.find((r) => r.playerId === playerId);
  if (!row || Number(row[key]) <= 0) return null;
  const place = rankAmong(list, playerId, key, "desc")?.place;
  if (!place || place > 3) return null;
  return {
    icon,
    label: typeof label === "function" ? label(row[key], place) : label,
    kind: PODIUM_KIND[place],
    desc: typeof desc === "function" ? desc(row[key], place) : desc,
  };
}

// Exportada para que js/views/medallas.js (la guía de medallas) pueda
// reusar exactamente el mismo cálculo — sin esto tendría que duplicar cada
// condición de logro por separado y desincronizarse con el tiempo.
export function renderAchievements(player) {
  const chips = [];
  // Agrega la medalla de podiumChip() (arriba) solo si el jugador de verdad
  // quedó en el top 3 — evita repetir el `if (chip) chips.push(chip)` en
  // cada estadística de abajo.
  function addPodium(list, key, opts) {
    const chip = podiumChip(list, player.id, key, opts);
    if (chip) chips.push(chip);
  }
  const seasons = player.seasons ?? [];

  if (seasons.length > 0) {
    const debut = Math.min(...seasons);
    if (debut === 1) {
      // Icono de huevo: "desde el cascarón" — estuvo desde la primerísima
      // temporada del equipo, a petición expresa.
      chips.push({
        icon: "fa-solid fa-egg",
        label: "Caimaneggs",
        kind: "trajectory",
        desc: "Estuvo en el equipo desde la primera temporada.",
      });
    }

    // seasons.length y no "TEAM.seasonsTotal - debut + 1": esa cuenta
    // asumía que nunca se ausentó desde su debut, seasons.length ya
    // descuenta cualquier temporada que se haya saltado.
    chips.push({
      icon: "fa-solid fa-hourglass-half",
      label: "Veterano",
      kind: "trajectory",
      desc: `${seasons.length} temporada${seasons.length === 1 ? "" : "s"} jugadas con el equipo.`,
    });

    const leagues = new Set(seasons.map((n) => SEASONS[n - 1]?.league).filter(Boolean));
    if (leagues.size > 1) {
      chips.push({
        icon: "fa-solid fa-earth-americas",
        label: "Trotamundos",
        kind: "trajectory",
        desc: `Ha jugado en ${leagues.size} ligas distintas con el equipo.`,
      });
    }
  }

  const streak = hitStreaks(GAMES).find((s) => s.playerId === player.id);
  if (streak?.active && streak.current >= 2) {
    chips.push({
      icon: "fa-solid fa-fire",
      label: "Caliente",
      kind: "streak",
      desc: `Racha activa de ${streak.current} juegos seguidos con hit.`,
    });
  }
  // "Hit Record" — a diferencia de Caliente, cuenta la racha más larga de
  // TODA la temporada aunque ya haya terminado (streak.longest, no
  // streak.current) — reconoce el logro aunque ya no siga activo.
  if (streak && streak.longest > 5) {
    chips.push({
      icon: "fa-solid fa-award",
      label: "Hit Record",
      kind: "streak",
      desc: `Su racha más larga de la temporada fue de ${streak.longest} juegos seguidos con hit.`,
    });
  }
  const multiHitStreak = activeGameStreak(GAMES, player.id, (line) => (line.H ?? 0) >= 2);
  if (multiHitStreak >= 2) {
    chips.push({
      icon: "fa-solid fa-fire-flame-curved",
      label: "En llamas",
      kind: "streak",
      desc: `Racha activa de ${multiHitStreak} juegos seguidos con multi-hit (2 o más hits).`,
    });
  }
  const onBaseStreak = activeGameStreak(GAMES, player.id, (line) => (line.H ?? 0) > 0 || (line.BB ?? 0) > 0);
  if (onBaseStreak >= 2) {
    chips.push({
      icon: "fa-solid fa-lock",
      label: "Seguro",
      kind: "streak",
      desc: `Racha activa de ${onBaseStreak} juegos seguidos embasándose (hit o base por bolas).`,
    });
  }

  // ---- Líderes de la temporada — top 3 con medalla de oro/plata/bronce
  // (ver podiumChip/addPodium arriba). Las rate stats (AVG/OBP) solo
  // cuentan entre quienes califican (mínimo de turnos), para que nadie con
  // una sola jugada perfecta salga en el podio.
  const battingList = battingTotals(GAMES);
  const pitchingList = pitchingTotals(GAMES);
  const fieldingList = fieldingTotals(GAMES);
  const qualifiedBatters = battingList.filter((r) => r.qualified);
  const fieldersWithPlays = fieldingList.filter((r) => r.PO + r.A + r.E > 0);
  // Relación BB/SO — "Selectivo": a diferencia de Ojo de águila (BB en
  // bruto), esto premia disciplina de verdad, no solo volumen. Se descartan
  // los que no se han ponchado nunca (SO=0): con SO=0 cualquier BB da una
  // razón "infinita" que no refleja nada real.
  const selectiveList = qualifiedBatters.filter((r) => r.SO > 0).map((r) => ({ playerId: r.playerId, ratio: r.BB / r.SO }));

  const myBatting = battingList.find((r) => r.playerId === player.id);
  const myPitching = pitchingList.find((r) => r.playerId === player.id);
  const myFielding = fieldingList.find((r) => r.playerId === player.id);

  if (myBatting) {
    addPodium(qualifiedBatters, "AVG", {
      icon: "fa-solid fa-medal",
      label: (value, place) => `Bate de ${PODIUM_METAL[place]}`,
      desc: (value) => `Promedio de bateo (AVG) del equipo esta temporada (${value}).`,
    });
    addPodium(battingList, "HR", {
      icon: "fa-solid fa-bomb",
      label: "Bombardero",
      desc: (value) => `Jonrones del equipo esta temporada (${value}).`,
    });
    addPodium(battingList, "SB", {
      icon: "fa-solid fa-user-ninja",
      label: "Ninja",
      desc: (value) => `Bases robadas del equipo esta temporada (${value}).`,
    });
    addPodium(battingList, "RBI", {
      icon: "fa-solid fa-tornado",
      label: "Tornado",
      desc: (value) => `Carreras impulsadas (RBI) del equipo esta temporada (${value}).`,
    });
    // "Bartender" — el chiste ya existía en el "Líder cervecero" de Resumen
    // (SO de bateo × 12 botes): quien más se ponchó, "debe" la cerveza —
    // esa coletilla solo aplica al de oro. Mismo SO de bateo, no el de
    // pitcheo (ese es "Francotirador").
    addPodium(battingList, "SO", {
      icon: "fa-solid fa-beer-mug-empty",
      label: "Bartender",
      desc: (value, place) =>
        `Ponches de bateo del equipo esta temporada (${value})${place === 1 ? " — le toca poner la cerveza." : "."}`,
    });
    if (myBatting.qualified && Number(myBatting.AVG) >= 0.3) {
      chips.push({
        icon: "fa-solid fa-baseball-bat-ball",
        label: "Estelar",
        kind: "threshold",
        desc: `Promedio de bateo (AVG) de .300 o más esta temporada (${myBatting.AVG}).`,
      });
    }
    addPodium(battingList, "2B", {
      icon: "fa-solid fa-dice",
      label: "Double Trouble",
      desc: (value) => `Dobles del equipo esta temporada (${value}).`,
    });
    addPodium(battingList, "3B", {
      icon: "fa-solid fa-skull-crossbones",
      label: "Triple Kill",
      desc: (value) => `Triples del equipo esta temporada (${value}).`,
    });
    addPodium(battingList, "BB", {
      icon: "fa-solid fa-eye",
      label: "Ojo de águila",
      desc: (value) => `Bases por bolas (BB) del equipo esta temporada (${value}).`,
    });
    addPodium(selectiveList, "ratio", {
      icon: "fa-solid fa-bullseye",
      label: "Selectivo",
      desc: (value) => `Mejor relación bases por bolas / ponches del equipo esta temporada (${value.toFixed(2)}).`,
    });
    if (myBatting.qualified && Number(myBatting.OPS) >= 1) {
      chips.push({
        icon: "fa-solid fa-gem",
        label: "Fuera de serie",
        kind: "threshold",
        desc: `OPS de 1.000 o más esta temporada (${myBatting.OPS}).`,
      });
    }
  }

  if (myPitching && myPitching.outs > 0) {
    addPodium(pitchingList, "SO", {
      icon: "fa-solid fa-crosshairs",
      label: "Francotirador",
      desc: (value) => `Ponches propinados (pitcheo) del equipo esta temporada (${value}).`,
    });
  }

  if (myFielding) {
    addPodium(fieldersWithPlays, "FPCT", {
      icon: "fa-solid fa-hand-fist",
      label: (value, place) => `Guante de ${PODIUM_METAL[place]}`,
      desc: (value) => `Porcentaje de fildeo (FPCT) del equipo esta temporada (${value}).`,
    });
    addPodium(fieldingList, "PO", {
      icon: "fa-solid fa-broom",
      label: "Escoba",
      desc: (value) => `Outs realizados (PO) del equipo esta temporada (${value}).`,
    });
  }

  // Más MVPs de la temporada — mismo cálculo que usaba "Salón de la fama"
  // en Resumen (ver historial de js/views/resumen.js): cuenta cuántos
  // GAMES.mvp le tocaron a cada jugador y compara contra el resto.
  const mvpList = PLAYERS.map((p) => ({ playerId: p.id, mvpTotal: GAMES.filter((g) => g.mvp === p.id).length })).filter(
    (p) => p.mvpTotal > 0
  );
  addPodium(mvpList, "mvpTotal", {
    icon: "fa-solid fa-star",
    label: "Estrella",
    desc: (value) => `Premios MVP del equipo esta temporada (${value}).`,
  });

  // ---- Asistencia y versatilidad ----
  const gamesPlayedCount = gamesPlayedByPlayer(GAMES).get(player.id) ?? 0;
  if (GAMES.length > 0 && gamesPlayedCount === GAMES.length) {
    chips.push({
      icon: "fa-solid fa-calendar-check",
      label: "Nerd",
      kind: "participation",
      desc: "Asistió a todos los juegos de la temporada.",
    });
  }
  if (gamesPlayedCount > 5) {
    chips.push({
      icon: "fa-solid fa-hand",
      label: "Cumplidor",
      kind: "participation",
      desc: `Ya asistió a más de 5 juegos esta temporada (${gamesPlayedCount}).`,
    });
  }

  // Juegos a las 9:00pm ("nocturnos") — depende del `time` de cada juego en
  // data.js (opcional; juegos sin `time` capturado simplemente no cuentan
  // para ningún lado de esta comparación).
  const nightGames = GAMES.filter((g) => g.time === "21:00");
  if (nightGames.length > 0) {
    const nightGamesPlayed = gamesPlayedByPlayer(nightGames).get(player.id) ?? 0;
    if (nightGamesPlayed > nightGames.length / 2) {
      chips.push({
        icon: "fa-solid fa-cat",
        label: "Nocturno",
        kind: "participation",
        desc: `Asistió a más de la mitad de los juegos a las 9:00pm de la temporada (${nightGamesPlayed} de ${nightGames.length}).`,
      });
    }
  }

  // Posiciones distintas jugadas esta temporada — vienen del `position` de
  // cada línea de bateo (ver GAMES en data.js), no de fildeo (esas líneas
  // no traen posición, solo PO/A/E).
  const positionsPlayed = new Set();
  for (const game of GAMES) {
    const line = game.batting?.find((b) => b.playerId === player.id);
    if (line?.position) positionsPlayed.add(line.position);
  }
  if (positionsPlayed.size >= 3) {
    chips.push({
      icon: "fa-solid fa-shuffle",
      label: "Versátil",
      kind: "participation",
      desc: `Jugó en 3 o más posiciones distintas esta temporada (${positionsPlayed.size}).`,
    });
  }
  // Más exigente que Versátil: las 9 posiciones de campo, no solo 3+.
  if (positionsPlayed.size === DEFENSE_POSITIONS.length) {
    chips.push({
      icon: "fa-solid fa-crown",
      label: "Comodín total",
      kind: "participation",
      desc: `Jugó en las ${DEFENSE_POSITIONS.length} posiciones de campo esta temporada.`,
    });
  }

  return chips;
}

// Comprime la foto de perfil en el navegador antes de subirla — una foto de
// celular pesa varios MB y aquí se ve nomás a 120px, así que no tiene caso
// guardar el original. Reescala (si hace falta) a un máximo de 640px por
// lado y la reconvierte a JPEG con compresión; cualquier formato de entrada
// (PNG, WEBP...) sale como JPEG.
async function compressAvatar(file, maxSize = 640, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen."))), "image/jpeg", quality);
  });
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
  const mvpCount = GAMES.filter((g) => g.mvp === player.id).length;
  const hero = document.createElement("div");
  hero.className = "game-hero";
  hero.innerHTML = `
    <div id="dues-badge"></div>
    <div id="profile-avatar" style="margin-bottom: 12px;">${renderAvatar(player, 120)}</div>
    <div class="game-hero-teams">
      <span>#${player.number ?? "-"}</span>
      <span class="game-hero-vs">·</span>
      <span class="game-hero-opponent">${player.name}</span>
    </div>
    <div class="game-hero-meta" style="margin-top: 12px;">
      <span id="position-display">${player.position ? renderPositionBadges(player.position) : ""}</span>
    </div>
    <div class="game-hero-date">${played} juego${played === 1 ? "" : "s"} jugado${played === 1 ? "" : "s"} esta temporada</div>
    ${
      mvpCount > 0
        ? `<div class="mvp-badge"><i class="fa-solid fa-star"></i> MVP x${mvpCount} esta temporada</div>`
        : ""
    }
    ${renderDebut(player.seasons)}
    <div id="walkup-display">${renderWalkup(player.walkup)}</div>
    <div id="profile-edit-slot"></div>
  `;
  container.appendChild(hero);

  // Tarjeta aparte (no dentro de .game-hero) — solo si hay algo que
  // mostrar, para no dejar un encabezado "Logros" vacío. `achievementChips`
  // se queda vivo (no solo el HTML ya armado) porque addAchievementMedal()
  // de abajo sigue agregándole cosas después del primer pintado, y cada vez
  // hay que reordenar y volver a pintar la tarjeta completa — no solo pegar
  // la nueva al final — para que las de la misma categoría sigan juntas.
  const achievementChips = renderAchievements(player);
  let achievementsCard = null;
  if (achievementChips.length > 0) {
    achievementsCard = document.createElement("div");
    achievementsCard.className = "leader-card player-standalone-card medallero-card";
    achievementsCard.innerHTML = `${MEDALLERO_HEADER()}<div class="achievements-grid">${sortedAchievementsHtml(achievementChips)}</div>${MEDALLERO_GUIDE_BTN(player.id)}`;
    container.appendChild(achievementsCard);
  }

  // Logros "profile"/"social" (foto, walkup y like a un anuncio, ver más
  // abajo): a diferencia de los de renderAchievements(), dependen de una
  // respuesta de Supabase, así que se agregan en cuanto contesta, sin
  // bloquear el primer pintado. Si nadie más calificó para la tarjeta
  // (achievementsCard sigue null), se crea aquí mismo, justo después de
  // .game-hero — para que quede en el mismo lugar de siempre, no importa
  // qué tanto se haya pintado ya debajo para cuando esto responda.
  function addAchievementMedal(chip) {
    achievementChips.push(chip);
    if (!achievementsCard) {
      achievementsCard = document.createElement("div");
      achievementsCard.className = "leader-card player-standalone-card medallero-card";
      achievementsCard.innerHTML = `${MEDALLERO_HEADER()}<div class="achievements-grid"></div>${MEDALLERO_GUIDE_BTN(player.id)}`;
      hero.after(achievementsCard);
    }
    achievementsCard.querySelector(".achievements-grid").innerHTML = sortedAchievementsHtml(achievementChips);
  }

  // ---- Foto de perfil personalizada: lectura pública, edición propia ----
  //
  // El avatar de siempre (foto de data.js o iniciales) ya se pintó arriba,
  // sin esperar a nadie. Si el jugador tiene una foto propia en Storage, la
  // reemplaza — con o sin sesión (la lectura es pública, ver
  // supabase/schema.sql); getAvatarUrl regresa null si no ha subido
  // ninguna, y esta vista se queda con lo de siempre.
  const avatarWrap = hero.querySelector("#profile-avatar");
  getAvatarUrl(player.id).then((url) => {
    if (!url || !avatarWrap) return;
    avatarWrap.innerHTML = `<img class="avatar" src="${url}" alt="${escapeHtml(player.name)}" style="width:120px;height:120px;font-size:48px;">`;
    addAchievementMedal({
      icon: "fa-solid fa-camera",
      label: "1, 2, 3... Flash!",
      kind: "profile",
      desc: "Subió una foto de perfil personalizada.",
    });
  });

  // ---- "Fan del equipo": le dio like a algún anuncio ----
  //
  // Lectura pública (anuncios y likes), corre con o sin sesión. No hay una
  // consulta directa "¿este jugador le dio like a algo?", así que se arma
  // con las mismas dos funciones que ya usa Resumen para los anuncios: se
  // piden todos (sin límite chico) y se busca su player_id entre los likes.
  getAnnouncements(1000).then(async (items) => {
    if (items.length === 0) return;
    const likes = await getAnnouncementLikes(items.map((a) => a.id));
    if (!likes.some((l) => l.player_id === player.id)) return;
    addAchievementMedal({
      icon: "fa-solid fa-heart",
      label: "Fan del equipo",
      kind: "social",
      desc: "Le dio like a algún anuncio del equipo.",
    });
  });

  // ---- "Comentarista": comentó en al menos 5 juegos de la temporada ----
  //
  // Lectura pública. Un comentario por jugador por juego (constraint en
  // supabase/schema.sql), así que basta con contar en cuántos juegos
  // distintos aparece su player_id, no cuántos comentarios en total.
  if (GAMES.length > 0) {
    Promise.all(GAMES.map((g) => getComments("game", g.id))).then((perGame) => {
      const gamesCommented = perGame.filter((comments) => comments.some((c) => c.player_id === player.id)).length;
      if (gamesCommented < 5) return;
      addAchievementMedal({
        icon: "fa-solid fa-comment",
        label: "Comentarista",
        kind: "social",
        desc: `Comentó en ${gamesCommented} juegos de la temporada.`,
      });
    });
  }

  // ---- "Buen juez": votó por el MVP en al menos la mitad de los juegos ----
  //
  // Lectura pública. No exige que haya jugado en cada juego para votar (esa
  // regla la impone la UI de js/views/juego.js, no la base de datos) — este
  // logro es sobre participar en la votación, no sobre elegibilidad. Mitad
  // redondeada hacia arriba (ej. 5 de 9), para que "la mitad" nunca sea
  // menos de la mitad de verdad.
  if (GAMES.length > 0) {
    const minVotes = Math.ceil(GAMES.length / 2);
    Promise.all(GAMES.map((g) => getMvpVotes(g.id))).then((perGame) => {
      const gamesVoted = perGame.filter((votes) => votes.some((v) => v.voter_player_id === player.id)).length;
      if (gamesVoted < minVotes) return;
      addAchievementMedal({
        icon: "fa-solid fa-gavel",
        label: "Buen juez",
        kind: "social",
        desc: `Votó por el MVP en ${gamesVoted} de los ${GAMES.length} juegos de la temporada.`,
      });
    });
  }

  // ---- Tu resumen: solo en tu propio perfil ----
  //
  // Lo único que este perfil no muestra ya en otro lado es tu RSVP al
  // próximo juego (la inscripción ya tiene su badge arriba a la derecha).
  // Mismos botones Sí/No que la tarjeta "Próximo juego" de Resumen
  // (wireRsvp, importado de ahí) — así se puede cambiar la asistencia sin
  // salir del perfil.
  if (getCurrentPlayerId() === player.id && SCHEDULE.length > 0) {
    const g = SCHEDULE[0];
    const summaryEl = document.createElement("div");
    summaryEl.className = "leader-card player-standalone-card";
    summaryEl.innerHTML = `
      <h3><i class="fa-solid fa-clipboard-list"></i>Tu resumen</h3>
      <p>Próximo juego: ${g.date} vs ${g.opponent}</p>
      <div class="rsvp-actions"></div>
    `;
    container.appendChild(summaryEl);
    wireRsvp(summaryEl, g.id);
  }

  // ---- Estado de inscripción: solo visible con sesión iniciada ----
  //
  // Misma regla que la columna "Pagó" en Roster (ver js/views/roster.js) —
  // se comprueba getSession() (¿hay cuenta?), no getCurrentPlayerId(), para
  // que también se vea antes de que el coach termine de vincular la cuenta
  // en player_whitelist. Sin sesión, el badge ni se pide.
  if (getSession()) {
    getDuesForPlayer(player.id).then((paid) => {
      const badge = hero.querySelector("#dues-badge");
      if (!badge) return;
      // `paid` sale null si no se pudo verificar (hipo de red incluso tras
      // reintentar, ver runQuery en js/db.js) — mostrarlo en rojo ahí se
      // vería como "no ha pagado" cuando en realidad no se sabe, así que se
      // deja el badge vacío en vez de arriesgar un falso "sin pagar".
      if (paid === null) return;
      badge.innerHTML = `
        <span class="dues-badge-pill ${paid ? "stat-green" : "stat-red"}">
          Estado de inscripción: ${paid ? "Pagada" : "Sin pagar"}
        </span>
      `;
      addAchievementMedal(
        paid
          ? {
              icon: "fa-solid fa-sack-dollar",
              label: "Rich kid",
              kind: "dues-paid",
              desc: "Ya pagó la inscripción de la temporada.",
            }
          : {
              icon: "fa-solid fa-trash-can",
              label: "Moroso",
              kind: "dues-unpaid",
              desc: "Todavía no paga la inscripción de la temporada.",
            }
      );
    });
  }

  // ---- Posiciones registradas y canción de entrada: valores de arranque ----
  //
  // `player.position`/`player.walkup` (data.js) se pintan primero, sin
  // esperar a nadie; si el jugador ya los personalizó, las filas en
  // player_positions/player_walkups los reemplazan en cuanto llegan
  // (progresivo, no bloquean el primer pintado). Las posiciones, a
  // diferencia de la canción, SÍ alimentan más cosas — Roster y el
  // generador de alineación mezclan player_positions sobre PLAYERS antes de
  // usar la posición (ver js/views/roster.js, js/views/alineacion.js y
  // js/lineup-tool.js).
  let currentPosition = player.position ?? "";
  const positionDisplay = hero.querySelector("#position-display");
  getPositionOverride(player.id).then((override) => {
    if (!override) return;
    currentPosition = override;
    positionDisplay.innerHTML = renderPositionBadges(override);
  });

  let currentWalkup = player.walkup ?? null;
  const walkupDisplay = hero.querySelector("#walkup-display");
  getWalkupOverride(player.id).then((override) => {
    if (!override) return;
    currentWalkup = override;
    walkupDisplay.innerHTML = renderWalkup(override);
    addAchievementMedal({
      icon: "fa-solid fa-music",
      label: "Greatests Hits",
      kind: "profile",
      desc: "Personalizó su canción de entrada.",
    });
  });

  // ---- Editar perfil: un solo botón, un solo panel ----
  //
  // Posiciones, canción de entrada y contraseña vivían cada una detrás de
  // su propio botón — se juntan en un solo "Editar perfil" para no llenar
  // el perfil de botones repetidos. Cada sección conserva su propio botón
  // de guardar (son 3 escrituras independientes a Supabase, no una sola),
  // solo el mostrar/ocultar se comparte. "Salir" ya no vive aquí — está en
  // el menú del botón de cuenta del header (ver js/auth.js).
  if (getCurrentPlayerId() === player.id) {
    const slot = hero.querySelector("#profile-edit-slot");
    slot.innerHTML = `
      <button type="button" class="walkup-edit-btn" id="profile-edit-toggle">
        <i class="fa-solid fa-pen"></i> Editar perfil
      </button>
      <button type="button" class="walkup-edit-btn" id="share-profile-btn">
        <i class="fa-solid fa-share-nodes"></i> Compartir mi perfil
      </button>
      <div id="profile-edit-panel" class="walkup-edit-form auth-form" hidden>
        <p class="profile-edit-heading">Foto de perfil</p>
        <label class="avatar-edit-label">
          <i class="fa-solid fa-camera"></i> Subir foto
          <input type="file" accept="image/*" id="avatar-input" hidden>
        </label>
        <p class="auth-error" id="avatar-error" hidden></p>

        <p class="profile-edit-heading">Posiciones</p>
        <p class="auth-hint">Elige hasta 3, en el orden que prefieras.</p>
        <div class="pos-filter-row" id="position-picker">
          ${DEFENSE_POSITIONS.map((pos) => `<button type="button" class="pos-filter-chip" data-pos="${pos}">${pos}</button>`).join("")}
        </div>
        <p class="auth-error" id="position-error" hidden></p>
        <button type="button" class="auth-submit" id="position-save-btn">Guardar posiciones</button>

        <p class="profile-edit-heading">Canción de entrada</p>
        <label>Título<input type="text" id="walkup-title-input" maxlength="120"></label>
        <label>Artista<input type="text" id="walkup-artist-input" maxlength="120"></label>
        <label>Link (Spotify, YouTube...)<input type="url" id="walkup-url-input" maxlength="500"></label>
        <p class="auth-error" id="walkup-error" hidden></p>
        <button type="button" class="auth-submit" id="walkup-save-btn">Guardar canción</button>

        <p class="profile-edit-heading">Contraseña</p>
        <label>Nueva contraseña<input type="password" id="password-input" minlength="6" autocomplete="new-password"></label>
        <p class="auth-error" id="password-error" hidden></p>
        <p class="auth-ok" id="password-ok" hidden>Contraseña actualizada.</p>
        <button type="button" class="auth-submit" id="password-save-btn">Cambiar contraseña</button>
      </div>
    `;

    // --- Compartir mi perfil ---
    const shareBtn = slot.querySelector("#share-profile-btn");
    shareBtn.addEventListener("click", async () => {
      const url = `${location.origin}${location.pathname}#/jugador/${player.id}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: `${player.name} — Caimanes de Villas`, url });
        } catch {
          // El usuario canceló el share nativo — no es un error real.
        }
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        const original = shareBtn.innerHTML;
        shareBtn.innerHTML = '<i class="fa-solid fa-check"></i> Link copiado';
        setTimeout(() => {
          shareBtn.innerHTML = original;
        }, 1800);
      } catch {
        // Sin Web Share ni Clipboard disponible no hay mucho más que hacer.
      }
    });

    // --- Foto de perfil ---
    const avatarInput = slot.querySelector("#avatar-input");
    const avatarError = slot.querySelector("#avatar-error");
    avatarInput.addEventListener("change", async () => {
      const file = avatarInput.files[0];
      if (!file) return;
      avatarError.hidden = true;
      let toUpload = file;
      try {
        toUpload = await compressAvatar(file);
      } catch {
        // Si no se pudo comprimir (formato raro, navegador viejo) se sube
        // tal cual — mejor una foto pesada que ninguna.
      }
      try {
        await uploadAvatar(player.id, toUpload);
        const url = await getAvatarUrl(player.id);
        if (url) {
          avatarWrap.innerHTML = `<img class="avatar" src="${url}" alt="${escapeHtml(player.name)}" style="width:120px;height:120px;font-size:48px;">`;
        }
      } catch {
        avatarError.textContent = "No se pudo subir la foto — intenta de nuevo.";
        avatarError.hidden = false;
      } finally {
        avatarInput.value = "";
      }
    });

    // --- Posiciones ---
    const posPicker = slot.querySelector("#position-picker");
    const posError = slot.querySelector("#position-error");
    const posSaveBtn = slot.querySelector("#position-save-btn");
    let selectedPositions = [];

    function syncPicker() {
      for (const chip of posPicker.querySelectorAll(".pos-filter-chip")) {
        chip.classList.toggle("active", selectedPositions.includes(chip.dataset.pos));
      }
    }

    posPicker.addEventListener("click", (e) => {
      const chip = e.target.closest(".pos-filter-chip");
      if (!chip) return;
      const pos = chip.dataset.pos;
      if (selectedPositions.includes(pos)) {
        selectedPositions = selectedPositions.filter((p) => p !== pos);
      } else if (selectedPositions.length >= 3) {
        posError.textContent = "Máximo 3 posiciones — quita una para agregar otra.";
        posError.hidden = false;
        return;
      } else {
        selectedPositions.push(pos);
      }
      posError.hidden = true;
      syncPicker();
    });

    posSaveBtn.addEventListener("click", async () => {
      if (selectedPositions.length === 0) {
        posError.textContent = "Elige al menos una posición.";
        posError.hidden = false;
        return;
      }
      posSaveBtn.disabled = true;
      const joined = selectedPositions.join("/");
      try {
        await setPosition(player.id, joined);
        currentPosition = joined;
        positionDisplay.innerHTML = renderPositionBadges(joined);
        posError.hidden = true;
      } catch {
        posError.textContent = "No se pudo guardar — intenta de nuevo.";
        posError.hidden = false;
      } finally {
        posSaveBtn.disabled = false;
      }
    });

    // --- Canción de entrada ---
    const walkupTitleInput = slot.querySelector("#walkup-title-input");
    const walkupArtistInput = slot.querySelector("#walkup-artist-input");
    const walkupUrlInput = slot.querySelector("#walkup-url-input");
    const walkupError = slot.querySelector("#walkup-error");
    const walkupSaveBtn = slot.querySelector("#walkup-save-btn");

    walkupSaveBtn.addEventListener("click", async () => {
      walkupError.hidden = true;
      const saved = {
        title: walkupTitleInput.value.trim(),
        artist: walkupArtistInput.value.trim() || null,
        url: walkupUrlInput.value.trim() || null,
      };
      if (!saved.title) {
        walkupError.textContent = "Ponle un título a tu canción.";
        walkupError.hidden = false;
        return;
      }
      walkupSaveBtn.disabled = true;
      try {
        await setWalkup(player.id, saved);
        currentWalkup = saved;
        walkupDisplay.innerHTML = renderWalkup(saved);
      } catch {
        walkupError.textContent = "No se pudo guardar — intenta de nuevo.";
        walkupError.hidden = false;
      } finally {
        walkupSaveBtn.disabled = false;
      }
    });

    // --- Contraseña ---
    const passwordInput = slot.querySelector("#password-input");
    const passwordError = slot.querySelector("#password-error");
    const passwordOk = slot.querySelector("#password-ok");
    const passwordSaveBtn = slot.querySelector("#password-save-btn");

    passwordSaveBtn.addEventListener("click", async () => {
      passwordError.hidden = true;
      passwordOk.hidden = true;
      if (passwordInput.value.length < 6) {
        passwordError.textContent = "Mínimo 6 caracteres.";
        passwordError.hidden = false;
        return;
      }
      passwordSaveBtn.disabled = true;
      try {
        await changePassword(passwordInput.value);
        passwordOk.hidden = false;
        passwordInput.value = "";
      } catch {
        passwordError.textContent = "No se pudo cambiar — intenta de nuevo.";
        passwordError.hidden = false;
      } finally {
        passwordSaveBtn.disabled = false;
      }
    });

    // --- Un solo interruptor para las 3 secciones de arriba ---
    const toggle = slot.querySelector("#profile-edit-toggle");
    const panel = slot.querySelector("#profile-edit-panel");
    toggle.addEventListener("click", () => {
      selectedPositions = currentPosition ? currentPosition.split("/").filter(Boolean) : [];
      syncPicker();
      posError.hidden = true;
      walkupTitleInput.value = currentWalkup?.title ?? "";
      walkupArtistInput.value = currentWalkup?.artist ?? "";
      walkupUrlInput.value = currentWalkup?.url ?? "";
      walkupError.hidden = true;
      passwordInput.value = "";
      passwordError.hidden = true;
      passwordOk.hidden = true;
      panel.hidden = !panel.hidden;
    });
  }

  const battingList = battingTotals(GAMES);
  const pitchingList = pitchingTotals(GAMES);
  const fieldingList = fieldingTotals(GAMES);
  const battingSeason = battingList.find((r) => r.playerId === player.id);
  const pitchingSeason = pitchingList.find((r) => r.playerId === player.id);
  const fieldingSeason = fieldingList.find((r) => r.playerId === player.id);

  // Insignia "en qué lugar del equipo vas" en la esquina de cada tarjeta —
  // SOLO en tu propio perfil, nunca en el de alguien más (cada quien ve
  // nomás la suya, como pidió el coach). Rate stats (AVG/OPS/ERA/FPCT) se
  // rankean solo entre quienes tienen suficientes datos para que cuenten
  // (mismo filtro `qualified` que ya usa el leaderboard de Resumen para
  // AVG, y su equivalente para pitcheo/fildeo) — si no, alguien con una
  // sola entrada perfecta se vería primero.
  const isOwnProfile = getCurrentPlayerId() === player.id;
  const qualifiedBatters = battingList.filter((r) => r.qualified);
  const activePitchers = pitchingList.filter((r) => r.outs > 0);
  const activeFielders = fieldingList.filter((r) => r.PO + r.A + r.E > 0);

  function rankBadge(list, key, dir) {
    if (!isOwnProfile) return "";
    const rank = rankAmong(list, player.id, key, dir);
    if (!rank) return "";
    return `<span class="card-rank" title="Tu lugar en el equipo en esta estadística">#${rank.place} de ${rank.of}</span>`;
  }

  if (battingSeason) {
    const h3 = document.createElement("h3");
    h3.textContent = "Bateo — temporada";
    container.appendChild(h3);
    const cards = document.createElement("div");
    cards.className = "cards grid-4";
    cards.innerHTML = `
      <div class="card">
        ${rankBadge(qualifiedBatters, "AVG", "desc")}
        <i class="fa-solid fa-baseball-bat-ball card-icon"></i>
        <span class="card-value">${battingSeason.AVG}</span>
        <span class="card-label">AVG</span>
      </div>
      <div class="card">
        ${rankBadge(battingList, "HR", "desc")}
        <i class="fa-solid fa-fire card-icon"></i>
        <span class="card-value">${battingSeason.HR}</span>
        <span class="card-label">Home runs</span>
      </div>
      <div class="card">
        ${rankBadge(battingList, "R", "desc")}
        <i class="fa-solid fa-bolt card-icon"></i>
        <span class="card-value">${battingSeason.R}</span>
        <span class="card-label">Carreras</span>
      </div>
      <div class="card">
        ${rankBadge(battingList, "RBI", "desc")}
        <i class="fa-solid fa-tornado card-icon"></i>
        <span class="card-value">${battingSeason.RBI}</span>
        <span class="card-label">Impulsadas</span>
      </div>
      <div class="card">
        ${rankBadge(battingList, "SB", "desc")}
        <i class="fa-solid fa-person-running card-icon"></i>
        <span class="card-value">${battingSeason.SB}</span>
        <span class="card-label">Bases robadas</span>
      </div>
      <div class="card">
        ${rankBadge(qualifiedBatters, "OPS", "desc")}
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
    cards.className = "cards grid-4";
    cards.innerHTML = `
      <div class="card">
        ${rankBadge(activePitchers, "WHIP", "asc")}
        <i class="fa-solid fa-baseball card-icon"></i>
        <span class="card-value">${pitchingSeason.WHIP}</span>
        <span class="card-label">WHIP</span>
      </div>
      <div class="card">
        <i class="fa-solid fa-trophy card-icon"></i>
        <span class="card-value">${pitchingSeason.W}-${pitchingSeason.L}</span>
        <span class="card-label">Record</span>
      </div>
      <div class="card">
        ${rankBadge(pitchingList, "SO", "desc")}
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
    cards.className = "cards grid-4";
    cards.innerHTML = `
      <div class="card">
        ${rankBadge(activeFielders, "FPCT", "desc")}
        <i class="fa-solid fa-shield card-icon"></i>
        <span class="card-value">${fieldingSeason.FPCT}</span>
        <span class="card-label">FPCT</span>
      </div>
      <div class="card">
        ${rankBadge(fieldingList, "PO", "desc")}
        <i class="fa-solid fa-mitten card-icon"></i>
        <span class="card-value">${fieldingSeason.PO}</span>
        <span class="card-label">Outs (PO)</span>
      </div>
      <div class="card">
        ${rankBadge(fieldingList, "A", "desc")}
        <i class="fa-solid fa-arrow-right-arrow-left card-icon"></i>
        <span class="card-value">${fieldingSeason.A}</span>
        <span class="card-label">Asistencias</span>
      </div>
      <div class="card">
        ${rankBadge(fieldingList, "E", "asc")}
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

  // ---- Tendencia de bateo ----
  // Con un solo juego no hay tendencia que mostrar, solo un dato suelto.
  const battedGames = battingRows.filter((r) => r.AB > 0);
  if (battedGames.length > 1) {
    const h3 = document.createElement("h3");
    h3.textContent = "Tendencia de bateo";
    container.appendChild(h3);

    let cumulativeH = 0;
    let cumulativeAB = 0;
    const points = battedGames.map((row) => {
      cumulativeH += row.H;
      cumulativeAB += row.AB;
      const gameAvg = row.H / row.AB;
      const cumulativeAvg = cumulativeH / cumulativeAB;
      return {
        // La fecha completa no cabe debajo de cada barra; con día/mes basta.
        label: row.date.slice(5).replace("-", "/"),
        gameAvg,
        cumulativeAvg,
        tooltip: `${row.date} vs ${row.opponent} — ${row.H} de ${row.AB} (AVG ${formatAvg(row.H, row.AB)}) · acumulado ${formatAvg(cumulativeH, cumulativeAB)}`,
      };
    });

    renderTrendChart(container, points);
  }

  if (battingRows.length > 0) {
    const h3 = document.createElement("h3");
    h3.textContent = "Bateo por juego";
    container.appendChild(h3);

    const battingColumns = [
      { key: "date", label: "Fecha", sticky: true },
      { key: "opponent", label: "Rival" },
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
      { key: "date", label: "Fecha", sticky: true },
      { key: "opponent", label: "Rival" },
      { key: "IP", label: "IP", full: "Entradas lanzadas", numeric: true },
      { key: "H", label: "H", full: "Hits permitidos", numeric: true },
      { key: "R", label: "R", full: "Carreras permitidas", numeric: true },
      { key: "ER", label: "ER", full: "Carreras limpias", numeric: true },
      { key: "BB", label: "BB", full: "Bases por bolas", numeric: true },
      { key: "SO", label: "SO", full: "Ponches", numeric: true, render: (v) => coloredStat(v, "stat-green") },
      { key: "HR", label: "HR", full: "Home runs permitidos", numeric: true },
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
      { key: "date", label: "Fecha", sticky: true },
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

  // ---- Comparación contigo: solo con sesión y viendo a OTRO jugador ----
  //
  // Misma lógica y estilos que el comparador de Alineación (ver
  // js/views/comparar.js), pero sin selects — aquí siempre es tú contra
  // quien sea que esté viendo el perfil, hasta abajo de la página.
  const myId = getCurrentPlayerId();
  if (myId && myId !== player.id) {
    const compareEl = document.createElement("div");
    container.appendChild(compareEl);
    renderLockedComparison(compareEl, myId, player.id);
  }
}
