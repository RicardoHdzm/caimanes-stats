// Portada estilo lyon.gg (a petición expresa): hero a pantalla completa con
// el logo y el nombre gigante, el próximo juego con cuenta regresiva, una
// franja de números, cinta en movimiento, historial de juegos (próximos +
// últimos 4), la temporada en números, el roster y los patrocinadores.
// Todo sale de data.js — no hay nada que mantener aparte.
import { TEAM, SCHEDULE, PLAYERS, CURRENT_SEASON, GAMES, PLAYOFFS, STANDINGS_HISTORY, SPONSORS } from "../data.js";
import {
  allStatGames,
  gameResult,
  teamRecord,
  battingTotals,
  gamesPlayedByPlayer,
  seasonStatGames,
  gameMvp,
  playoffSeasonStatus,
  playerName,
} from "../stats.js";
import { escapeHtml, renderAvatar, ordinalTemporada, formatGameTime, POSITION_NAMES } from "../ui.js";
import { suggestedStartersWithPos } from "../lineup.js";
import { nextGameFlyer, openFlyer, shareButton } from "../flyers.js";
import { powerRankingTopHtml } from "./powerranking.js";
import { upcomingCardHtml, resultCardHtml } from "../scorecards.js";


function fmtDate(dateStr, opts = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-MX", opts);
}

// Título de sección: "PRÓXIMOS **JUEGOS** ///" con una palabra gigante y
// tenue detrás (como "ARENA" / "ADN" en lyon.gg).
function sectionHead(first, accent, bgWord, sub = "") {
  return `
    <div class="home-section-head">
      <span class="home-bg-word" aria-hidden="true">${bgWord}</span>
      <h2 class="home-title">${first} <span>${accent}</span> <i class="home-slashes" aria-hidden="true">///</i></h2>
      ${sub ? `<p class="home-sub">${sub}</p>` : ""}
    </div>
  `;
}

// "2026-11-13" de HOY en la hora de aquí (no UTC: con toISOString, desde las
// 5 pm de Culiacán ya era "mañana" y el juego del día desaparecía).
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nextGame() {
  const today = localToday();
  return [...SCHEDULE].filter((g) => g.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? SCHEDULE[0] ?? null;
}

function gameStart(g) {
  const [h, m] = (g.time ?? "19:00").split(":").map(Number);
  const [y, mo, d] = g.date.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m);
}

function countdownText(g) {
  const ms = gameStart(g) - Date.now();
  if (ms <= 0) return "¡En juego!";
  const secs = Math.floor(ms / 1000);
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${d ? `${d}d ` : ""}${h}h ${m}m ${String(s).padStart(2, "0")}s`;
}

// La temporada más reciente que tiene juegos capturados (la actual si ya
// empezó; si no, la anterior).
function referenceSeason() {
  const withGames = [...new Set(GAMES.map((g) => g.season))].sort((a, b) => b - a);
  return withGames.includes(CURRENT_SEASON) ? CURRENT_SEASON : withGames[0] ?? CURRENT_SEASON;
}

// Los números de la franja suben de 0 a su valor la primera vez que la
// franja entra en pantalla (~1.4 s, frenando al final). Sin animación si el
// sistema pide menos movimiento: ahí se quedan con su valor desde el inicio.
function countUpWhenVisible(section) {
  if (!section || !("IntersectionObserver" in window)) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const nums = [...section.querySelectorAll("[data-count]")];
  nums.forEach((el) => (el.textContent = "0"));
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    observer.disconnect();
    const start = performance.now();
    const DURATION = 1400;
    function tick(now) {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      nums.forEach((el) => (el.textContent = String(Math.round(Number(el.dataset.count) * eased))));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, { threshold: 0.4 });
  observer.observe(section);
}

// Logos de patrocinadores — ver SPONSORS en js/data.js y .home-sponsor-logo
// en css/styles.css (se invierten a blanco solos en los temas oscuros).
//
// Los logos vienen de todas formas (cuadrados, 6:1, con mucho margen
// transparente...), así que a la misma altura se ven disparejos. Al cargar
// cada uno: (1) se recorta su margen transparente (canvas, mismo origen) y
// (2) se le da un tamaño de peso visual parejo en vez de altura pareja —
// un logo ancho queda más bajito y uno cuadrado más alto. Alto = BASE /
// proporción^0.6 (con 0.5 sería área idéntica; 0.6 encoge un poco más a
// los muy horizontales, que por ser letras gruesas "pesan" más).
const SPONSOR_LOGO_BASE_H = 80; // alto de un logo cuadrado
const SPONSOR_LOGO_EXPONENT = 0.6;

function fitSponsorLogo(img) {
  if (img.dataset.fitted) return;
  img.dataset.fitted = "1";
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return;
  let box = { x: 0, y: 0, w, h };
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const alpha = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (alpha[(y * w + x) * 4 + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX >= minX && (minX > 0 || minY > 0 || maxX < w - 1 || maxY < h - 1)) {
      box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      const crop = document.createElement("canvas");
      crop.width = box.w;
      crop.height = box.h;
      crop.getContext("2d").drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      img.src = crop.toDataURL("image/png");
    }
  } catch {
    // Sin canvas (o la imagen no se puede leer): se queda sin recortar,
    // nomás con el tamaño parejo de abajo.
  }
  const ratio = box.w / box.h;
  const height = Math.min(SPONSOR_LOGO_BASE_H / ratio ** SPONSOR_LOGO_EXPONENT, SPONSOR_LOGO_BASE_H);
  img.style.height = `${height.toFixed(1)}px`;
  img.style.width = `${(height * ratio).toFixed(1)}px`;
}

// ---- Festejo después de una victoria ----
//
// La primera vez que alguien abre la portada en los 2 días siguientes a una
// victoria: confeti rojo y blanco + un aviso "¡Ganamos!" con link al juego.
// Una sola vez por juego y por navegador (localStorage). Sin confeti si el
// sistema pide menos movimiento (el aviso sí sale).
const CELEBRATED_KEY = "caimanes-festejo-";

function maybeCelebrate(allGames) {
  const last = [...allGames].filter((g) => gameResult(g)).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!last || gameResult(last) !== "W") return;
  const days = (new Date(`${localToday()}T00:00:00`) - new Date(`${last.date}T00:00:00`)) / 86400000;
  if (days < 0 || days > 2) return;
  try {
    if (localStorage.getItem(CELEBRATED_KEY + last.id)) return;
    localStorage.setItem(CELEBRATED_KEY + last.id, "1");
  } catch {
    return; // Sin almacenamiento saldría en cada visita: mejor nada.
  }

  const toast = document.createElement("div");
  toast.className = "win-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <span class="win-toast-title">¡Ganamos!</span>
    <span class="win-toast-score">Caimanes ${last.scoreUs}-${last.scoreThem} ${escapeHtml(last.opponent ?? "")}</span>
    <a class="win-toast-link" href="#/juegos/${last.id}">Ver juego</a>
    <button type="button" class="win-toast-close" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>`;
  document.body.appendChild(toast);
  const close = () => toast.remove();
  toast.querySelector(".win-toast-close").addEventListener("click", close);
  toast.querySelector(".win-toast-link").addEventListener("click", close);
  setTimeout(close, 9000);
  window.addEventListener("hashchange", close, { once: true });

  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) launchConfetti();
}

// Confeti en un <canvas> encima de todo, ~3.5 s, y se quita solo.
function launchConfetti() {
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const colors = ["#e2202f", "#bf0f35", "#ffffff", "#ff5a6e", "#f2f3f4"];
  const pieces = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 16,
    vy: -Math.random() * 15 - 5,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = t > 2600 ? Math.max(0, 1 - (t - 2600) / 900) : 1;
    for (const p of pieces) {
      p.vy += 0.38;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < 3500) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

export function renderHome(container) {
  const leagueLine = `${TEAM.league} · ${ordinalTemporada(TEAM.seasonsInLeague)} Temporada`;
  const next = nextGame();
  // Modo "día de juego" (a petición expresa): el día del partido la portada
  // lo anuncia con una franja roja arriba del hero y la tarjeta del próximo
  // juego en rojo.
  const gameDay = next?.date === localToday();
  const allGames = allStatGames();
  // Franja de números: los 4 hablan de lo mismo — TODOS los juegos
  // capturados, regular + playoffs (antes el primero era "9 Temporadas", la historia completa,
  // y parecía que carreras/hits/robadas eran de las 9; a petición expresa).
  const gamesLogged = allGames.filter((g) => g.scoreUs != null).length;
  const runs = allGames.reduce((sum, g) => sum + (g.scoreUs ?? 0), 0);
  const teamBatting = battingTotals(allGames);
  const hits = teamBatting.reduce((sum, r) => sum + (r.H ?? 0), 0);
  const steals = teamBatting.reduce((sum, r) => sum + (r.SB ?? 0), 0);

  const root = document.createElement("div");
  root.className = "home";

  // ---- Hero ----
  root.innerHTML = `
    <section class="home-hero${gameDay ? " home-hero--gameday" : ""}">
      ${
        gameDay
          ? `<div class="home-gameday" role="status">
        <b>Hoy jugamos</b>
        <span>vs ${escapeHtml(next.opponent ?? "Rival")}${next.time ? ` · ${formatGameTime(next.time)}` : ""}</span>
      </div>`
          : ""
      }
      <!-- Fondo: assets/hero.mp4 = copia ligera de assets/web-hero.mp4 (720p,
           24 fps, sin audio, ~4 MB en vez de 183 MB — con el velo encima no
           se nota la diferencia). El poster es su primer cuadro: se ve al
           instante mientras carga el video. "?v=2": el video cambió y así
           nadie se queda con el viejo en caché. Velo: .home-hero-bg. -->
      <video class="home-hero-video" src="assets/hero.mp4?v=2" poster="assets/hero-poster.jpg?v=2" autoplay muted loop playsinline preload="auto" aria-hidden="true"></video>
      <div class="home-hero-bg" aria-hidden="true"></div>
      <div class="home-hero-content">
        <img src="assets/logo.png" alt="" class="home-hero-logo" />
        <h1 class="home-hero-name">Caimanes</h1>
        <p class="home-hero-tag">De Villas</p>
        <p class="home-hero-league">${escapeHtml(leagueLine)}</p>
        <div class="home-hero-ctas">
          <a href="#/roster" class="home-btn home-btn--solid">Conoce al equipo</a>
          <button type="button" class="home-btn home-btn--ghost" data-scroll="#home-games">Próximos juegos</button>
        </div>
      </div>
      ${
        next
          ? `
        <div class="home-next${gameDay ? " home-next--gameday" : ""}">
          <a class="home-next-link" href="#/calendario" aria-label="Ver calendario"></a>
          <span class="home-next-label">${gameDay ? "Hoy · Día de juego" : "Próximo juego"}</span>
          <span class="home-next-match">Caimanes <em>vs</em> ${escapeHtml(next.opponent ?? "Rival")}</span>
          <span class="home-next-when">${escapeHtml(fmtDate(next.date, { weekday: "long", day: "numeric", month: "long" }))}${next.time ? ` · ${formatGameTime(next.time)}` : ""}</span>
          <span class="home-next-countdown" id="home-countdown">${countdownText(next)}</span>
        </div>`
          : ""
      }
    </section>

    <section class="home-stats">
      <div class="home-stat"><b data-count="${gamesLogged}">${gamesLogged}</b><span>Juegos registrados</span></div>
      <div class="home-stat"><b data-count="${runs}" data-plus>${runs}</b><span>Carreras anotadas</span></div>
      <div class="home-stat"><b data-count="${hits}" data-plus>${hits}</b><span>Hits</span></div>
      <div class="home-stat"><b data-count="${steals}" data-plus>${steals}</b><span>Bases robadas</span></div>
    </section>

    <div class="home-marquee" aria-hidden="true">
      <div class="home-marquee-track">
        ${Array.from({ length: 8 }, () => `<span>Caimanes de Villas</span><span class="home-marquee-accent">#CaimaWin</span><span>Muerde Caiman</span><span class="home-marquee-accent">#Caimanation</span>`).join("")}
      </div>
    </div>
  `;

  // Flyer para redes (ver js/flyers.js).
  if (next) {
    const shareBtn = shareButton(() =>
      openFlyer((format, color) => nextGameFlyer(next, format, color), `proximo-juego-${next.date}`, `Próximo juego: Caimanes de Villas vs ${next.opponent}`)
    );
    // Solo la palabra, sin el ícono del botón normal.
    shareBtn.textContent = "Compartir";
    shareBtn.classList.add("home-next-share");
    root.querySelector(".home-next").appendChild(shareBtn);
  }

  // ---- Historial de juegos: los próximos y los últimos 4 finalizados ----
  const games = document.createElement("section");
  games.className = "home-section";
  games.id = "home-games";
  const upcoming = [...SCHEDULE].sort((a, b) => a.date.localeCompare(b.date));
  const recent = [...allGames].filter((g) => g.date && g.scoreUs != null).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  // Tarjetas estilo marcador (ver js/scorecards.js, las mismas de Juegos).
  // Los programados son de la temporada actual y siguen la numeración de los
  // juegos de temporada regular que ya se capturaron en GAMES.
  const playedThisSeason = GAMES.filter((g) => g.season === CURRENT_SEASON).length;
  const upcomingCards = upcoming.map((g, i) => upcomingCardHtml(g, playedThisSeason + i + 1));
  const recentCards = recent.map(resultCardHtml);
  const cards = [...upcomingCards, ...recentCards];
  games.innerHTML = `
    ${sectionHead("Historial de", "juegos", "JUEGOS")}
    <div class="home-match-grid">
      ${cards.length ? cards.join("") : `<p class="home-empty">No hay juegos todavía.</p>`}
    </div>
  `;
  root.appendChild(games);

  // ---- Power Ranking: top 5 (ver js/views/powerranking.js) ----
  const prHtml = powerRankingTopHtml();
  if (prHtml) {
    const pr = document.createElement("section");
    pr.className = "home-section";
    pr.innerHTML = `${sectionHead("Power", "Ranking", "TOP 5")}${prHtml}`;
    root.appendChild(pr);
  }

  // ---- La temporada en números ----
  const ref = referenceSeason();
  const refGames = GAMES.filter((g) => g.season === ref);
  if (refGames.length) {
    const statGames = seasonStatGames(ref);
    const rec = teamRecord(refGames);
    const table = ref === CURRENT_SEASON ? null : STANDINGS_HISTORY[ref];
    const pos = ref === CURRENT_SEASON ? TEAM.leaguePosition : table?.teams.find((t) => t.us)?.pos;
    const teamsCount = ref === CURRENT_SEASON ? TEAM.leagueTeams : table?.teams.length;
    const po = PLAYOFFS.find((p) => p.season === ref);
    // A media temporada todavía no hay playoffs que decir: "por jugarse".
    const seasonOver = ref < CURRENT_SEASON || refGames.length >= TEAM.gamesInSeason;
    let poText = seasonOver ? "Sin playoffs" : "Playoffs: por jugarse";
    if (po?.rounds.length) {
      const st = playoffSeasonStatus(po);
      const lastRound = st.rounds[st.rounds.length - 1]?.round?.name ?? "";
      poText = st.status === "campeones" ? "¡Campeones!" : st.status === "eliminados" ? `Playoffs · eliminados en ${lastRound}` : `Playoffs en curso · ${lastRound}`;
    }
    const played = gamesPlayedByPlayer(statGames);
    const top = battingTotals(statGames)
      .filter((r) => (played.get(r.playerId) ?? 0) >= statGames.length / 2 && r.AB > 0)
      .sort((a, b) => Number(b.OPS) - Number(a.OPS) || b.AB - a.AB)
      .slice(0, 3);
    const mvpCounts = new Map();
    for (const g of statGames) {
      const id = gameMvp(g);
      if (id) mvpCounts.set(id, (mvpCounts.get(id) ?? 0) + 1);
    }
    const mvps = [...mvpCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Rediseño (a petición expresa): íconos en lugar de emojis, el récord en
    // grande con a favor / en contra / diferencia, y los tops con foto y el
    // número en Teko (el #1 en dorado), como el Power Ranking.
    const diff = rec.RF - rec.RA;
    const rankRow = (i, playerId, name, value, unit) => {
      const player = PLAYERS.find((p) => p.id === playerId) ?? { id: playerId, name };
      return `
            <li class="home-rank${i === 0 ? " home-rank--first" : ""}">
              <b class="home-rank-n">${i + 1}</b>
              <span class="home-rank-photo">${renderAvatar(player, 34)}</span>
              <span class="home-rank-name">${escapeHtml(name)}</span>
              <span class="home-rank-val">${value}<small>${unit}</small></span>
            </li>`;
    };

    const nums = document.createElement("section");
    nums.className = "home-section";
    nums.innerHTML = `
      ${sectionHead("La temporada", "en números", "STATS")}
      <div class="home-cards">
        <article class="home-card">
          <i class="fa-solid fa-trophy leader-hero-watermark" aria-hidden="true"></i>
          <span class="home-card-kicker">Récord</span>
          <b class="home-card-big">${rec.W}-${rec.L}${rec.T ? `-${rec.T}` : ""}</b>
          <div class="home-card-stats">
            <span><b>${rec.RF}</b><small>A favor</small></span>
            <span><b>${rec.RA}</b><small>En contra</small></span>
            <span class="home-card-diff home-card-diff--${diff > 0 ? "up" : diff < 0 ? "down" : "even"}"><b>${diff > 0 ? "+" : ""}${diff}</b><small>Diferencia</small></span>
          </div>
          <ul class="home-card-lines">
            ${pos ? `<li><i class="fa-solid fa-ranking-star"></i> ${pos}° lugar${teamsCount ? ` de ${teamsCount}` : ""} en la tabla</li>` : ""}
            <li><i class="fa-solid fa-trophy"></i> ${escapeHtml(poText)}</li>
          </ul>
          <a class="home-card-link" href="#/temporadas/${ref}">Ver temporada →</a>
        </article>
        <article class="home-card">
          <i class="fa-solid fa-baseball-bat-ball leader-hero-watermark" aria-hidden="true"></i>
          <span class="home-card-kicker">Bateo · OPS</span>
          <h3 class="home-card-title">Top bateadores</h3>
          <ul class="home-rank-list">
            ${top.map((r, i) => rankRow(i, r.playerId, r.name, r.OPS, "OPS")).join("") || '<li class="home-rank-empty">Sin datos todavía.</li>'}
          </ul>
          <a class="home-card-link" href="#/temporadas/${ref}/destacados">Ver top 5 →</a>
        </article>
        <article class="home-card">
          <i class="fa-solid fa-star leader-hero-watermark" aria-hidden="true"></i>
          <span class="home-card-kicker">MVP</span>
          <h3 class="home-card-title">Más veces MVP</h3>
          <ul class="home-rank-list">
            ${mvps.map(([id, n], i) => rankRow(i, id, playerName(id), n, n === 1 ? "MVP" : "MVPs")).join("") || '<li class="home-rank-empty">Sin MVPs todavía.</li>'}
          </ul>
          <a class="home-card-link" href="#/temporadas/${ref}/destacados">Ver destacados →</a>
        </article>
      </div>
    `;
    root.appendChild(nums);
  }

  // ---- Roster ----
  // Solo los 9 titulares de "Posiciones sugeridas" (pestaña Alineación, sin
  // JD ni JC), en orden P, C, 1B…; el resto vive en "Ver roster completo".
  const roster = document.createElement("section");
  roster.className = "home-section";
  roster.innerHTML = `
    ${sectionHead("Somos", "Caimanes", "ROSTER")}
    <div class="home-roster">
      ${suggestedStartersWithPos()
        .map(
          ({ player: p, pos }) => `
        <a class="home-player" href="#/jugador/${p.id}">
          <span class="home-player-photo">
            ${renderAvatar(p, 220)}
            ${p.number ? `<span class="home-player-num">${p.number}</span>` : ""}
          </span>
          <span class="home-player-info">
            <span class="home-player-name">${escapeHtml(p.name)}</span>
            <span class="home-player-pos">${escapeHtml(POSITION_NAMES[pos] ?? pos)}</span>
          </span>
        </a>`
        )
        .join("")}
    </div>
    <a class="home-btn home-btn--ghost home-center" href="#/roster">Ver roster completo →</a>
  `;
  root.appendChild(roster);

  // ---- Patrocinadores ----
  if (SPONSORS.length > 0) {
    const sponsors = document.createElement("section");
    sponsors.className = "home-section";
    sponsors.innerHTML = `
      ${sectionHead("Nuestros", "patrocinadores", "SPONSORS")}
      <div class="home-sponsors">
        ${SPONSORS.map((s) => {
          const logo = `<img class="home-sponsor-logo" src="${s.logo}" alt="${escapeHtml(s.name)}" loading="lazy">`;
          return s.url
            ? `<a class="home-sponsor-card" href="${s.url}" target="_blank" rel="noopener noreferrer">${logo}</a>`
            : `<div class="home-sponsor-card">${logo}</div>`;
        }).join("")}
        <a class="home-sponsor-card home-sponsor-cta" href="https://ig.me/m/caimanes.sb" target="_blank" rel="noopener noreferrer">
          <i class="fa-brands fa-instagram" aria-hidden="true"></i>
          <b>¿Quieres apoyar al equipo?</b>
          <span>Escríbenos</span>
        </a>
      </div>
    `;
    root.appendChild(sponsors);
    for (const img of sponsors.querySelectorAll("img")) {
      if (img.complete && img.naturalWidth) fitSponsorLogo(img);
      else img.addEventListener("load", () => fitSponsorLogo(img), { once: true });
    }
  }

  container.appendChild(root);

  // Botón "Próximos juegos" del hero: baja a la sección.
  root.querySelector('[data-scroll="#home-games"]')?.addEventListener("click", () => {
    root.querySelector("#home-games")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  countUpWhenVisible(root.querySelector(".home-stats"));
  maybeCelebrate(allGames);

  // Cuenta regresiva: se refresca cada segundo mientras la portada siga abierta.
  if (next) {
    const el = root.querySelector("#home-countdown");
    const timer = setInterval(() => {
      if (!el.isConnected) return clearInterval(timer);
      el.textContent = countdownText(next);
    }, 1000);
  }
}
