// Portada estilo lyon.gg (a petición expresa): hero a pantalla completa con
// el logo y el nombre gigante, el próximo juego con cuenta regresiva, una
// franja de números, cinta en movimiento, próximos juegos + resultados
// recientes, la temporada en números, el roster y la historia del equipo.
// Todo sale de data.js — no hay nada que mantener aparte.
import { TEAM, SEASONS, SCHEDULE, ROSTER, CURRENT_SEASON, GAMES, PLAYOFFS, STANDINGS_HISTORY } from "../data.js";
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
  displayPositions,
} from "../stats.js";
import { escapeHtml, renderAvatar, renderPositionBadges, ordinalTemporada } from "../ui.js";

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
function sectionHead(first, accent, bgWord, sub = "") {
  return `
    <div class="home-section-head">
      <span class="home-bg-word" aria-hidden="true">${bgWord}</span>
      <h2 class="home-title">${first} <span>${accent}</span> <i class="home-slashes" aria-hidden="true">///</i></h2>
      ${sub ? `<p class="home-sub">${sub}</p>` : ""}
    </div>
  `;
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
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return `${d ? `${d}d ` : ""}${h}h ${m}m`;
}

// La temporada más reciente que tiene juegos capturados (la actual si ya
// empezó; si no, la anterior).
function referenceSeason() {
  const withGames = [...new Set(GAMES.map((g) => g.season))].sort((a, b) => b - a);
  return withGames.includes(CURRENT_SEASON) ? CURRENT_SEASON : withGames[0] ?? CURRENT_SEASON;
}

function leaguesHistory() {
  // Temporadas consecutivas en la misma liga → un tramo de la historia.
  const spans = [];
  SEASONS.forEach((s, i) => {
    const n = i + 1;
    const last = spans[spans.length - 1];
    if (last && last.league === s.league) {
      last.to = n;
      last.yearTo = s.year;
    } else {
      spans.push({ league: s.league, from: n, to: n, yearFrom: s.year, yearTo: s.year });
    }
  });
  return spans;
}

export function renderHome(container) {
  const season = TEAM.seasonsTotal;
  const leagueLine = `${TEAM.league} · ${ordinalTemporada(TEAM.seasonsInLeague)} Temporada`;
  const next = nextGame();
  const allGames = allStatGames();
  const wins = allGames.filter((g) => gameResult(g) === "W").length;
  const leagues = new Set(SEASONS.map((s) => s.league)).size;

  const root = document.createElement("div");
  root.className = "home";

  // ---- Hero ----
  root.innerHTML = `
    <section class="home-hero">
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
      <div class="home-stat"><b>${season}</b><span>Temporadas del equipo</span></div>
      <div class="home-stat"><b>${leagues}</b><span>Ligas jugadas</span></div>
      <div class="home-stat"><b>${wins}</b><span>Victorias registradas</span></div>
      <div class="home-stat"><b>${ROSTER.length}</b><span>Jugadores en el roster</span></div>
    </section>

    <div class="home-marquee" aria-hidden="true">
      <div class="home-marquee-track">
        ${Array.from({ length: 8 }, () => `<span>Caimanes de Villas</span><span class="home-marquee-ghost">${escapeHtml(TEAM.league)}</span><span>${ordinalTemporada(season)} Temporada</span><span class="home-marquee-ghost">#VamosCaimanes</span>`).join("")}
      </div>
    </div>
  `;

  // ---- Próximos juegos + resultados recientes ----
  const games = document.createElement("section");
  games.className = "home-section";
  games.id = "home-games";
  const upcoming = [...SCHEDULE].sort((a, b) => a.date.localeCompare(b.date));
  const recent = [...allGames].filter((g) => g.date && g.scoreUs != null).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  games.innerHTML = `
    ${sectionHead("Próximos", "juegos", "DIAMANTE", "El calendario del equipo — fecha, hora y rival.")}
    <div class="home-match-grid">
      ${
        upcoming.length
          ? upcoming
              .map(
                (g) => `
        <a class="home-match" href="#/calendario">
          <span class="home-match-league">${escapeHtml(TEAM.league)}</span>
          <div class="home-match-teams">
            <span class="home-match-team"><img src="assets/logo.png" alt="" /> Caimanes</span>
            <span class="home-match-vs">vs</span>
            <span class="home-match-team home-match-team--rival">${escapeHtml(g.opponent ?? "Rival")}</span>
          </div>
          <span class="home-match-when">${escapeHtml(fmtDate(g.date, { weekday: "long", day: "numeric", month: "long" }))}${g.time ? ` · ${fmtTime(g.time)}` : ""}</span>
          <span class="home-match-cta">Ver calendario ▸</span>
        </a>`
              )
              .join("")
          : `<p class="home-empty">No hay juegos programados por ahora.</p>`
      }
    </div>
    ${
      recent.length
        ? `
      <h3 class="home-mini-title">Resultados recientes</h3>
      <div class="home-results">
        ${recent
          .map((g) => {
            const r = gameResult(g);
            return `
          <a class="home-result" href="#/juegos/${g.id}">
            <span class="home-result-badge home-result-badge--${r}">${RESULT_LABEL[r] ?? "—"}</span>
            <b>${g.scoreUs}–${g.scoreThem}</b>
            <span>vs ${escapeHtml(g.opponent ?? "")}${g.playoff ? " · Playoffs" : ""} · ${escapeHtml(fmtDate(g.date))}</span>
          </a>`;
          })
          .join("")}
      </div>`
        : ""
    }
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
      poText = st.status === "campeones" ? "¡Campeones!" : st.status === "eliminados" ? `Playoffs · ${lastRound}` : `Playoffs en curso · ${lastRound}`;
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
  const roster = document.createElement("section");
  roster.className = "home-section";
  roster.innerHTML = `
    ${sectionHead("Nuestro", "roster", "ROSTER", `${ordinalTemporada(season)} Temporada · ${ROSTER.length} jugadores`)}
    <div class="home-roster">
      ${[...ROSTER]
        .sort((a, b) => (a.number ?? 999) - (b.number ?? 999))
        .map((p) => {
          const posText = displayPositions(p.id, p.position);
          return `
        <a class="home-player" href="#/jugador/${p.id}">
          ${renderAvatar(p, 72)}
          <span class="home-player-num">#${p.number ?? "-"}</span>
          <span class="home-player-name">${escapeHtml(p.name)}</span>
          <span class="home-player-pos">${posText ? renderPositionBadges(posText) : ""}</span>
        </a>`;
        })
        .join("")}
    </div>
    <a class="home-btn home-btn--ghost home-center" href="#/roster">Ver roster completo →</a>
  `;
  root.appendChild(roster);

  // ---- Historia ----
  const spans = leaguesHistory();
  const history = document.createElement("section");
  history.className = "home-section";
  history.innerHTML = `
    ${sectionHead("Somos", "Caimanes", "ADN", `Desde ${SEASONS[0]?.year ?? ""} en el diamante: ${season} temporadas en ${leagues} ligas.`)}
    <ol class="home-timeline">
      ${spans
        .map(
          (s) => `
        <li>
          <span class="home-timeline-year">${s.yearFrom}${s.yearTo !== s.yearFrom ? `–${s.yearTo}` : ""}</span>
          <b>${escapeHtml(s.league)}</b>
          <span>${s.from === s.to ? `${ordinalTemporada(s.from)} Temporada` : `${ordinalTemporada(s.from)} a ${ordinalTemporada(s.to)} Temporada`}</span>
        </li>`
        )
        .join("")}
    </ol>
    <a class="home-btn home-btn--ghost home-center" href="#/temporadas">Ver todas las temporadas →</a>
  `;
  root.appendChild(history);

  container.appendChild(root);

  // Botón "Próximos juegos" del hero: baja a la sección.
  root.querySelector('[data-scroll="#home-games"]')?.addEventListener("click", () => {
    root.querySelector("#home-games")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Cuenta regresiva: se refresca cada 30 s mientras la portada siga abierta.
  if (next) {
    const el = root.querySelector("#home-countdown");
    const timer = setInterval(() => {
      if (!el.isConnected) return clearInterval(timer);
      el.textContent = countdownText(next);
    }, 30000);
  }
}
