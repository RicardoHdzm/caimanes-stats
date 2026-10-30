// Portada estilo lyon.gg (a petición expresa): hero a pantalla completa con
// el logo y el nombre gigante, el próximo juego con cuenta regresiva, una
// franja de números, cinta en movimiento, historial de juegos (próximos +
// últimos 4), la temporada en números, el roster y los patrocinadores.
// Todo sale de data.js — no hay nada que mantener aparte.
import { TEAM, SEASONS, SCHEDULE, ROSTER, CURRENT_SEASON, GAMES, PLAYOFFS, STANDINGS_HISTORY, SPONSORS } from "../data.js";
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
import { escapeHtml, renderAvatar, ordinalTemporada } from "../ui.js";
import { suggestedStarters } from "../lineup.js";

const RESULT_LABEL = { W: "Victoria", L: "Derrota", T: "Empate" };

function fmtDate(dateStr, opts = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-MX", opts);
}

function fmtTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });
}

// Título de sección: "PRÓXIMOS **JUEGOS** ///" con una palabra gigante y
// tenue detrás (como "ARENA" / "ADN" en lyon.gg).
// "8va Temporada · Juego 9" — número de juego dentro de su temporada (por
// fecha). Los de playoffs se cuentan dentro de su serie, con el nombre de la
// ronda: "8va Temporada · Cuartos de Final · Juego 2".
function gameTag(g) {
  const season = `${ordinalTemporada(g.season)} Temporada`;
  if (g.playoff) {
    const round = PLAYOFFS.find((e) => e.season === g.season)?.rounds.find((r) => r.games?.some((x) => x.id === g.id));
    const n = round ? round.games.findIndex((x) => x.id === g.id) + 1 : 0;
    return [season, round?.name ?? "Playoffs", n ? `Juego ${n}` : ""].filter(Boolean).join(" · ");
  }
  const n = GAMES.filter((x) => x.season === g.season).sort((a, b) => a.date.localeCompare(b.date)).findIndex((x) => x.id === g.id) + 1;
  return n ? `${season} · Juego ${n}` : season;
}

function sectionHead(first, accent, bgWord, sub = "") {
  return `
    <div class="home-section-head">
      <span class="home-bg-word" aria-hidden="true">${bgWord}</span>
      <h2 class="home-title">${first} <span>${accent}</span> <i class="home-slashes" aria-hidden="true">///</i></h2>
      ${sub ? `<p class="home-sub">${sub}</p>` : ""}
    </div>
  `;
}

// "Rockin Roll" -> "RR", "Blockreto" -> "BL": el "logo" del rival (no
// tenemos los escudos de los demás equipos).
function rivalInitials(name) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function nextGame() {
  const today = new Date().toISOString().slice(0, 10);
  return [...SCHEDULE].filter((g) => g.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? SCHEDULE[0] ?? null;
}

function gameStart(g) {
  const [h, m] = (g.time ?? "19:00").split(":").map(Number);
  const [y, mo, d] = g.date.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m);
}

function countdownText(g) {
  const ms = gameStart(g) - Date.now();
  if (ms <= 0) return "¡Hoy se juega!";
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

export function renderHome(container) {
  const season = TEAM.seasonsTotal;
  const leagueLine = `${TEAM.league} · ${ordinalTemporada(TEAM.seasonsInLeague)} Temporada`;
  const next = nextGame();
  const allGames = allStatGames();
  // Franja de números: totales de TODOS los juegos capturados (regular +
  // playoffs, todas las temporadas).
  const runs = allGames.reduce((sum, g) => sum + (g.scoreUs ?? 0), 0);
  const teamBatting = battingTotals(allGames);
  const hits = teamBatting.reduce((sum, r) => sum + (r.H ?? 0), 0);
  const steals = teamBatting.reduce((sum, r) => sum + (r.SB ?? 0), 0);

  const root = document.createElement("div");
  root.className = "home";

  // ---- Hero ----
  root.innerHTML = `
    <section class="home-hero">
      <!-- Fondo: assets/hero.mp4 = copia ligera de assets/video.mp4 (720p,
           sin audio, ~1.5 MB en vez de 34 MB — con el velo encima no se nota
           la diferencia). El poster es su primer cuadro: se ve al instante
           mientras carga el video. Velo del color del tema: .home-hero-bg. -->
      <video class="home-hero-video" src="assets/hero.mp4" poster="assets/hero-poster.jpg" autoplay muted loop playsinline preload="auto" aria-hidden="true"></video>
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
        <a class="home-next" href="#/calendario">
          <span class="home-next-label">Próximo juego</span>
          <span class="home-next-match">Caimanes <em>vs</em> ${escapeHtml(next.opponent ?? "Rival")}</span>
          <span class="home-next-when">${escapeHtml(fmtDate(next.date, { weekday: "long", day: "numeric", month: "long" }))}${next.time ? ` · ${fmtTime(next.time)}` : ""}</span>
          <span class="home-next-countdown" id="home-countdown">${countdownText(next)}</span>
        </a>`
          : ""
      }
    </section>

    <section class="home-stats">
      <div class="home-stat"><b data-count="${season}">${season}</b><span>Temporadas</span></div>
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

  // ---- Historial de juegos: los próximos y los últimos 4 finalizados ----
  const games = document.createElement("section");
  games.className = "home-section";
  games.id = "home-games";
  const upcoming = [...SCHEDULE].sort((a, b) => a.date.localeCompare(b.date));
  const recent = [...allGames].filter((g) => g.date && g.scoreUs != null).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const matchTeams = (opponent, middle) => `
          <div class="home-match-teams">
            <span class="home-match-team"><img src="assets/logo.png" alt="" /> Caimanes</span>
            ${middle}
            <span class="home-match-team home-match-team--rival"><i class="home-match-rival-badge">${escapeHtml(rivalInitials(opponent))}</i>${escapeHtml(opponent ?? "Rival")}</span>
          </div>`;
  // Los programados son de la temporada actual y siguen la numeración de los
  // juegos de temporada regular que ya se capturaron en GAMES.
  const playedThisSeason = GAMES.filter((g) => g.season === CURRENT_SEASON).length;
  const upcomingCards = upcoming.map(
    (g, i) => `
        <a class="home-match home-match--next" href="#/calendario">
          <span class="home-match-league">${escapeHtml(TEAM.league)}</span>
          <span class="home-match-tag">${ordinalTemporada(CURRENT_SEASON)} Temporada · Juego ${playedThisSeason + i + 1}</span>
          ${matchTeams(g.opponent, `<span class="home-match-vs">vs</span>`)}
          <span class="home-match-when">${escapeHtml(fmtDate(g.date, { weekday: "long", day: "numeric", month: "long" }))}${g.time ? ` · ${fmtTime(g.time)}` : ""}</span>
          <span class="home-match-cta">Ver calendario ▸</span>
        </a>`
  );
  const recentCards = recent.map((g) => {
    const r = gameResult(g);
    return `
        <a class="home-match" href="#/juegos/${g.id}">
          <span class="home-match-league">
            ${escapeHtml(TEAM.league)}
            <span class="home-match-badge home-match-badge--${r}">${RESULT_LABEL[r] ?? "—"}</span>
          </span>
          <span class="home-match-tag">${escapeHtml(gameTag(g))}</span>
          ${matchTeams(g.opponent, `<span class="home-match-score">${g.scoreUs}–${g.scoreThem}</span>`)}
          <span class="home-match-when">${escapeHtml(fmtDate(g.date, { weekday: "long", day: "numeric", month: "long" }))}</span>
          <span class="home-match-cta">Ver juego ▸</span>
        </a>`;
  });
  const cards = [...upcomingCards, ...recentCards];
  games.innerHTML = `
    ${sectionHead("Historial de", "juegos", "JUEGOS", "Próximos juegos y resultados recientes")}
    <div class="home-match-grid">
      ${cards.length ? cards.join("") : `<p class="home-empty">No hay juegos todavía.</p>`}
    </div>
  `;
  root.appendChild(games);

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
    let poText = "Sin playoffs";
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
    const meta = SEASONS[ref - 1];

    const nums = document.createElement("section");
    nums.className = "home-section";
    nums.innerHTML = `
      ${sectionHead("La temporada", "en números", "STATS", `${ordinalTemporada(ref)} Temporada · ${escapeHtml(meta?.league ?? "")}`)}
      <div class="home-cards">
        <article class="home-card">
          <span class="home-card-kicker">${escapeHtml(meta?.league ?? "")} · ${ordinalTemporada(ref)} Temporada</span>
          <h3 class="home-card-title">Récord ${rec.W}-${rec.L}${rec.T ? `-${rec.T}` : ""}</h3>
          <ul class="home-card-list">
            ${pos ? `<li>🏅 ${pos}° lugar${teamsCount ? ` de ${teamsCount}` : ""} en la tabla</li>` : ""}
            <li>⚾ ${rec.RF} carreras anotadas · ${rec.RA} permitidas</li>
            <li>🏆 ${escapeHtml(poText)}</li>
          </ul>
          <a class="home-card-link" href="#/temporadas/${ref}">Ver temporada →</a>
        </article>
        <article class="home-card">
          <span class="home-card-kicker">Bateo · mejor OPS</span>
          <h3 class="home-card-title">Top bateadores</h3>
          <ul class="home-card-list home-card-list--rank">
            ${top.map((r, i) => `<li><b>${i + 1}</b> ${escapeHtml(r.name)} <em>${r.OPS} OPS</em></li>`).join("") || "<li>Sin datos todavía.</li>"}
          </ul>
          <a class="home-card-link" href="#/temporadas/${ref}/destacados">Ver top 5 →</a>
        </article>
        <article class="home-card">
          <span class="home-card-kicker">MVP del juego</span>
          <h3 class="home-card-title">Más veces MVP</h3>
          <ul class="home-card-list home-card-list--rank">
            ${mvps.map(([id, n], i) => `<li><b>${i + 1}</b> ${escapeHtml(playerName(id))} <em>${n} MVP${n === 1 ? "" : "s"}</em></li>`).join("") || "<li>Sin MVPs todavía.</li>"}
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
    ${sectionHead("Somos", "Caimanes", "ROSTER", `${ordinalTemporada(season)} Temporada · ${ROSTER.length} jugadores`)}
    <div class="home-roster">
      ${suggestedStarters()
        .map((p) => {
          return `
        <a class="home-player" href="#/jugador/${p.id}">
          ${renderAvatar(p, 72)}
          <span class="home-player-info">
            <span class="home-player-name">${escapeHtml(p.name)}</span>
            <span class="home-player-num">#${p.number ?? "-"}</span>
          </span>
        </a>`;
        })
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
      ${sectionHead("Nuestros", "patrocinadores", "APOYO")}
      <div class="home-sponsors">
        ${SPONSORS.map((s) => {
          const logo = `<img class="home-sponsor-logo" src="${s.logo}" alt="${escapeHtml(s.name)}" loading="lazy">`;
          return s.url
            ? `<a class="home-sponsor-card" href="${s.url}" target="_blank" rel="noopener noreferrer">${logo}</a>`
            : `<div class="home-sponsor-card">${logo}</div>`;
        }).join("")}
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

  // Cuenta regresiva: se refresca cada segundo mientras la portada siga abierta.
  if (next) {
    const el = root.querySelector("#home-countdown");
    const timer = setInterval(() => {
      if (!el.isConnected) return clearInterval(timer);
      el.textContent = countdownText(next);
    }, 1000);
  }
}
