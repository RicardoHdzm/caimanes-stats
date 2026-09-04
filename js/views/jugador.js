import { PLAYERS, GAMES, SCHEDULE, SEASONS } from "../data.js";
import { battingTotals, pitchingTotals, fieldingTotals, gamesPlayedByPlayer, rankAmong, hitStreaks } from "../stats.js";
import {
  heading,
  renderSortableTable,
  renderGlossary,
  coloredStat,
  renderPositionBadges,
  renderAvatar,
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
} from "../db.js";
import { DEFENSE_POSITIONS } from "../lineup.js";
import { renderLockedComparison } from "./comparar.js";
import { wireRsvp } from "./resumen.js";

// Icono según de dónde venga el link de la canción de entrada.
const WALKUP_PLATFORMS = [
  { match: /(^|\.)spotify\.com$/, icon: "fa-brands fa-spotify" },
  { match: /(^|\.)(youtube\.com|youtu\.be)$/, icon: "fa-brands fa-youtube" },
  { match: /(^|\.)music\.apple\.com$/, icon: "fa-brands fa-apple" },
  { match: /(^|\.)deezer\.com$/, icon: "fa-brands fa-deezer" },
  { match: /(^|\.)soundcloud\.com$/, icon: "fa-brands fa-soundcloud" },
];

// Solo se aceptan links http(s): un `javascript:` en data.js correría al
// abrirlo. Devuelve null si la URL no sirve, y entonces se pinta sin link.
function safeUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

function walkupIcon(parsedUrl) {
  if (!parsedUrl) return "fa-solid fa-music";
  const host = parsedUrl.hostname.toLowerCase();
  return WALKUP_PLATFORMS.find((p) => p.match.test(host))?.icon ?? "fa-solid fa-music";
}

// Canción de entrada (walk-up song): la que suena cuando el jugador va al bat.
// Sin `walkup` en el roster no se pinta nada.
function renderWalkup(walkup) {
  if (!walkup?.title) return "";

  const parsed = safeUrl(walkup.url);
  const icon = walkupIcon(parsed);
  const title = escapeHtml(walkup.title);
  // Formato de un solo renglón: "Walkup Song: [icono] - Título - Artista".
  // Sin artista se corta después del título, sin dejar un guion colgado.
  const artist = walkup.artist
    ? `<span class="walkup-sep">-</span><span class="walkup-artist">${escapeHtml(walkup.artist)}</span>`
    : "";

  const body = `
    <span class="walkup-label">Walkup Song:</span>
    <i class="${icon} walkup-icon"></i>
    <span class="walkup-sep">-</span>
    <span class="walkup-title">${title}</span>
    ${artist}
  `;

  if (!parsed) return `<div class="walkup">${body}</div>`;
  // Mismo icono de play que el botón "Ver replay" del detalle de juego.
  return `<a class="walkup walkup-link" href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer">${body}<i class="fa-solid fa-circle-play walkup-play"></i></a>`;
}

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
// MVP/Debut, que siempre van solos en el suyo — cada logro con su propio
// color (`kind`) para distinguirse de un vistazo.
function renderAchievements(player) {
  const chips = [];
  const seasons = player.seasons ?? [];

  if (seasons.length > 0) {
    const debut = Math.min(...seasons);
    if (debut === 1) {
      chips.push({ icon: "fa-solid fa-landmark", label: "Fundador del equipo", kind: "founder" });
    }

    // seasons.length y no "TEAM.seasonsTotal - debut + 1": esa cuenta
    // asumía que nunca se ausentó desde su debut, seasons.length ya
    // descuenta cualquier temporada que se haya saltado.
    chips.push({
      icon: "fa-solid fa-shield-halved",
      label: `${seasons.length} temporada${seasons.length === 1 ? "" : "s"} en el equipo`,
      kind: "tenure",
    });

    const leagues = new Set(seasons.map((n) => SEASONS[n - 1]?.league).filter(Boolean));
    if (leagues.size > 1) {
      chips.push({ icon: "fa-solid fa-earth-americas", label: `Ha jugado en ${leagues.size} ligas distintas`, kind: "leagues" });
    }
  }

  const streak = hitStreaks(GAMES).find((s) => s.playerId === player.id);
  if (streak?.active && streak.current >= 2) {
    chips.push({ icon: "fa-solid fa-fire", label: `Racha activa: ${streak.current} juegos con hit`, kind: "streak" });
  }

  // ---- Líderes de la temporada — mismo criterio que las insignias de
  // rango en las tarjetas de stats más abajo en este archivo: las rate
  // stats (AVG/ERA) solo cuentan entre quienes califican, para que nadie
  // con una sola jugada perfecta salga "líder". Todas comparten color
  // (dorado): son la misma idea — "eres el #1 del equipo en esto" — como
  // MVP.
  const battingList = battingTotals(GAMES);
  const pitchingList = pitchingTotals(GAMES);
  const fieldingList = fieldingTotals(GAMES);
  const qualifiedBatters = battingList.filter((r) => r.qualified);

  const myBatting = battingList.find((r) => r.playerId === player.id);
  const myPitching = pitchingList.find((r) => r.playerId === player.id);
  const myFielding = fieldingList.find((r) => r.playerId === player.id);

  if (myBatting) {
    if (Number(myBatting.AVG) > 0 && rankAmong(qualifiedBatters, player.id, "AVG", "desc")?.place === 1) {
      chips.push({ icon: "fa-solid fa-medal", label: "Bate de oro · líder de AVG", kind: "leader" });
    }
    if (Number(myBatting.HR) > 0 && rankAmong(battingList, player.id, "HR", "desc")?.place === 1) {
      chips.push({ icon: "fa-solid fa-bomb", label: "Rey de los jonrones", kind: "leader" });
    }
    if (Number(myBatting.SB) > 0 && rankAmong(battingList, player.id, "SB", "desc")?.place === 1) {
      chips.push({ icon: "fa-solid fa-person-running", label: "Ladrón de bases", kind: "leader" });
    }
    // "Expendio" — el chiste ya existía en el "Líder cervecero" de Resumen
    // (SO de bateo × 12 botes): quien más se ponchó, "debe" la cerveza.
    // Mismo SO de bateo, no el de pitcheo (ese es "Máquina de ponches").
    if (Number(myBatting.SO) > 0 && rankAmong(battingList, player.id, "SO", "desc")?.place === 1) {
      chips.push({ icon: "fa-solid fa-beer-mug-empty", label: `Expendio · ${myBatting.SO} ponches`, kind: "leader" });
    }
    if (myBatting.qualified && Number(myBatting.AVG) >= 0.3) {
      chips.push({ icon: "fa-solid fa-baseball-bat-ball", label: `Bateador de ${myBatting.AVG}`, kind: "avg300" });
    }
  }

  if (myPitching && myPitching.outs > 0) {
    if (Number(myPitching.SO) > 0 && rankAmong(pitchingList, player.id, "SO", "desc")?.place === 1) {
      chips.push({ icon: "fa-solid fa-baseball", label: "Máquina de ponches", kind: "leader" });
    }
  }

  if (myFielding && myFielding.PO + myFielding.A + myFielding.E > 0 && myFielding.FPCT === "1.000") {
    chips.push({ icon: "fa-solid fa-hand-fist", label: "Guante de oro · fildeo perfecto", kind: "leader" });
  }

  // ---- Asistencia y versatilidad ----
  const gamesPlayedCount = gamesPlayedByPlayer(GAMES).get(player.id) ?? 0;
  if (GAMES.length > 0 && gamesPlayedCount === GAMES.length) {
    chips.push({ icon: "fa-solid fa-calendar-check", label: "Asistencia perfecta", kind: "attendance" });
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
      icon: "fa-solid fa-people-arrows",
      label: `Multiposición: ${positionsPlayed.size} posiciones distintas`,
      kind: "multi",
    });
  }

  if (chips.length === 0) return "";
  return `
    <div class="achievements-row">
      ${chips
        .map(
          (c) =>
            `<span class="achievement-badge achievement-badge--${c.kind}"><i class="${c.icon}"></i>${escapeHtml(c.label)}</span>`
        )
        .join("")}
    </div>
  `;
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
  // mostrar, para no dejar un encabezado "Logros" vacío.
  const achievementsHtml = renderAchievements(player);
  if (achievementsHtml) {
    const achievementsCard = document.createElement("div");
    achievementsCard.className = "leader-card player-standalone-card";
    achievementsCard.innerHTML = `<h3><i class="fa-solid fa-trophy"></i>Logros</h3>${achievementsHtml}`;
    container.appendChild(achievementsCard);
  }

  // ---- Foto de perfil personalizada: lectura con sesión, edición propia ----
  //
  // El avatar de siempre (foto de data.js o iniciales) ya se pintó arriba,
  // sin esperar a nadie. Si hay sesión Y el jugador tiene una foto propia en
  // Storage, la reemplaza — sin sesión ni se pide (getAvatarUrl regresa null
  // de inmediato), así que quien no tiene cuenta ve exactamente lo de
  // siempre. Ver supabase/schema.sql: el bucket "avatars" es privado.
  const avatarWrap = hero.querySelector("#profile-avatar");
  if (getSession()) {
    getAvatarUrl(player.id).then((url) => {
      if (!url || !avatarWrap) return;
      avatarWrap.innerHTML = `<img class="avatar" src="${url}" alt="${escapeHtml(player.name)}" style="width:120px;height:120px;font-size:48px;">`;
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
        ${rankBadge(activePitchers, "ERA", "asc")}
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
