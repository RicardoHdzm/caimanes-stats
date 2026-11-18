// Vistas de CAIMANES FC (fc.html). Reusan las clases de la portada y de las
// tablas del softbol para que los dos sitios se vean como uno solo.
import { FC_TEAM, FC_PLAYERS, FC_POSITIONS, FC_STANDINGS, FC_MATCHES, FC_SPONSORS } from "./data.js";
import { fitSponsorLogo } from "../sponsors.js";
import {
  playedMatches,
  upcomingMatches,
  findMatch,
  findPlayer,
  playerName,
  teamRecord,
  playerStats,
  leaders,
  matchResult,
  matchesOfPlayer,
  isPlayed,
  localToday,
} from "./stats.js";
import { fcLogoHtml, sectionHead, matchCardHtml, emptyState, fmtDate, RESULT_LABEL, rivalInitials } from "./ui.js";
import { escapeHtml, heading, renderSortableTable, renderGlossary, renderAvatar, formatGameTime } from "../ui.js";

const POSITION_ORDER = ["POR", "DEF", "MED", "DEL"];

// Avatar sin buscar foto en assets/players/ (esa carpeta es la del softbol):
// la foto de data.js si hay, si no las iniciales/número.
const avatar = (p, size) => renderAvatar({ name: p.name, number: p.number, photo: p.photo }, size);

function playerLink(id) {
  const p = findPlayer(id);
  if (!p) return escapeHtml(playerName(id));
  return `<a href="#/jugador/${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a>`;
}

function gameStart(m) {
  const [h, min] = (m.time ?? "20:00").split(":").map(Number);
  const [y, mo, d] = m.date.split("-").map(Number);
  return new Date(y, mo - 1, d, h, min);
}

function countdownText(m) {
  const ms = gameStart(m) - Date.now();
  if (ms <= 0) return "¡En juego!";
  const secs = Math.floor(ms / 1000);
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const min = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${d ? `${d}d ` : ""}${h}h ${min}m ${String(s).padStart(2, "0")}s`;
}

// ============================== INICIO ==============================
export function renderFcHome(container) {
  const next = upcomingMatches()[0] ?? null;
  const played = playedMatches();
  const last = next ? null : played[0] ?? null;
  const lastRes = last ? matchResult(last) : null;
  const rec = teamRecord(played);
  const leagueLine = [FC_TEAM.sport, FC_TEAM.league, FC_TEAM.season].filter(Boolean).join(" · ");
  const gameDay = next?.date === localToday();

  const root = document.createElement("div");
  root.className = "home fc-home";
  root.innerHTML = `
    <section class="home-hero home-hero--fc">
      <div class="fc-pitch" aria-hidden="true"></div>
      <div class="home-hero-bg" aria-hidden="true"></div>
      <div class="home-hero-content">
        ${fcLogoHtml(220, "home-hero-logo fc-hero-logo")}
        <h1 class="home-hero-name">Caimanes</h1>
        <p class="home-hero-tag">Fútbol Club</p>
        <p class="home-hero-league">${escapeHtml(leagueLine)}</p>
        <div class="home-hero-ctas">
          <a href="#/plantilla" class="home-btn home-btn--solid">Conoce al equipo</a>
          <a href="#/partidos" class="home-btn home-btn--ghost">${next ? "Próximos partidos" : "Partidos"}</a>
        </div>
      </div>
      ${
        next
          ? `
        <div class="home-next${gameDay ? " home-next--gameday" : ""}">
          <a class="home-next-link" href="#/partidos/${encodeURIComponent(next.id)}" aria-label="Ver partido"></a>
          <span class="home-next-label">${gameDay ? "Hoy · Día de partido" : "Próximo partido"}</span>
          <span class="home-next-match">Caimanes <em>vs</em> ${escapeHtml(next.opponent ?? "Rival")}</span>
          <span class="home-next-when">${escapeHtml(fmtDate(next.date, { weekday: "long", day: "numeric", month: "long" }))}${next.time ? ` · ${formatGameTime(next.time)}` : ""}</span>
          <span class="home-next-countdown" id="fc-countdown">${countdownText(next)}</span>
        </div>`
          : last
            ? `
        <div class="home-next home-next--last home-next--${lastRes}">
          <a class="home-next-link" href="#/partidos/${encodeURIComponent(last.id)}" aria-label="Ver partido"></a>
          <span class="home-next-label">Último partido · ${RESULT_LABEL[lastRes]}</span>
          <span class="home-next-match">Caimanes <em>vs</em> ${escapeHtml(last.opponent ?? "Rival")}</span>
          <span class="home-next-when">${escapeHtml(fmtDate(last.date, { weekday: "long", day: "numeric", month: "long" }))}</span>
          <span class="home-next-countdown home-next-score">${last.goalsFor}<small>–</small>${last.goalsAgainst}</span>
        </div>`
            : ""
      }
    </section>

    <section class="home-stats">
      <div class="home-stat"><b>${rec.PJ}</b><span>Partidos jugados</span></div>
      <div class="home-stat"><b>${rec.G}</b><span>Victorias</span></div>
      <div class="home-stat"><b>${rec.GF}</b><span>Goles a favor</span></div>
      <div class="home-stat"><b>${rec.cleanSheets}</b><span>Porterías en cero</span></div>
    </section>

    <div class="home-marquee" aria-hidden="true">
      <div class="home-marquee-track">
        ${Array.from({ length: 8 }, () => `<span>Caimanes FC</span><span class="home-marquee-accent">#CaimaGol</span><span>Fútbol 7</span><span class="home-marquee-accent">#Caimanation</span>`).join("")}
      </div>
    </div>
  `;

  // ---- Partidos: próximos + últimos 4 ----
  const cards = [...upcomingMatches(), ...played.slice(0, 4)].map(matchCardHtml);
  const games = document.createElement("section");
  games.className = "home-section";
  games.innerHTML = `
    ${sectionHead("Nuestros", "partidos", "PARTIDOS")}
    ${cards.length ? `<div class="home-match-grid">${cards.join("")}</div>` : emptyState("fa-futbol", "La temporada está por comenzar.")}
  `;
  root.appendChild(games);

  // ---- La temporada en números ----
  if (played.length) {
    const rankRow = (i, r, value, unit) => {
      const p = findPlayer(r.playerId) ?? { name: r.name };
      return `
            <li class="home-rank${i === 0 ? " home-rank--first" : ""}">
              <b class="home-rank-n">${i + 1}</b>
              <span class="home-rank-photo">${avatar(p, 34)}</span>
              <span class="home-rank-name"><a href="#/jugador/${encodeURIComponent(r.playerId)}">${escapeHtml(r.name)}</a></span>
              <span class="home-rank-val">${value}<small>${unit}</small></span>
            </li>`;
    };
    const list = (rows, key, one, many) =>
      rows.map((r, i) => rankRow(i, r, r[key], r[key] === 1 ? one : many)).join("") || '<li class="home-rank-empty">Sin datos todavía.</li>';
    const diffClass = rec.DIF > 0 ? "up" : rec.DIF < 0 ? "down" : "even";
    const nums = document.createElement("section");
    nums.className = "home-section";
    nums.innerHTML = `
      ${sectionHead("La temporada", "en números", "STATS")}
      <div class="home-cards">
        <article class="home-card">
          <i class="fa-solid fa-trophy leader-hero-watermark" aria-hidden="true"></i>
          <span class="home-card-kicker">Récord · G-E-P</span>
          <b class="home-card-big">${rec.G}-${rec.E}-${rec.P}</b>
          <div class="home-card-stats">
            <span><b>${rec.GF}</b><small>Goles a favor</small></span>
            <span><b>${rec.GC}</b><small>En contra</small></span>
            <span class="home-card-diff home-card-diff--${diffClass}"><b>${rec.DIF > 0 ? "+" : ""}${rec.DIF}</b><small>Diferencia</small></span>
          </div>
          <ul class="home-card-lines">
            <li><i class="fa-solid fa-star"></i> ${rec.PTS} puntos</li>
            ${(() => {
              const us = FC_STANDINGS.teams.find((t) => t.us);
              return us ? `<li><i class="fa-solid fa-ranking-star"></i> ${us.pos}° lugar de ${FC_STANDINGS.teams.length} en la tabla</li>` : "";
            })()}
          </ul>
          <a class="home-card-link" href="#/tabla">Ver tabla →</a>
        </article>
        <article class="home-card">
          <i class="fa-solid fa-futbol leader-hero-watermark" aria-hidden="true"></i>
          <span class="home-card-kicker">Goles</span>
          <h3 class="home-card-title">Goleadores</h3>
          <ul class="home-rank-list">${list(leaders("G", 3), "G", "gol", "goles")}</ul>
          <a class="home-card-link" href="#/estadisticas">Ver estadísticas →</a>
        </article>
        <article class="home-card">
          <i class="fa-solid fa-hands-holding leader-hero-watermark" aria-hidden="true"></i>
          <span class="home-card-kicker">Asistencias</span>
          <h3 class="home-card-title">Asistidores</h3>
          <ul class="home-rank-list">${list(leaders("A", 3), "A", "asist.", "asist.")}</ul>
          <a class="home-card-link" href="#/estadisticas">Ver estadísticas →</a>
        </article>
      </div>
    `;
    root.appendChild(nums);
  }

  // ---- Plantilla ----
  const squad = document.createElement("section");
  squad.className = "home-section";
  squad.innerHTML = `
    ${sectionHead("Somos", "Caimanes", "PLANTILLA")}
    ${FC_PLAYERS.length ? `<div class="home-roster">${sortedSquad().slice(0, 7).map(playerCardHtml).join("")}</div>
    <a class="home-btn home-btn--ghost home-center" href="#/plantilla">Ver plantilla completa →</a>` : emptyState("fa-users", "La plantilla todavía no está capturada.")}
  `;
  root.appendChild(squad);

  // ---- Patrocinadores (mismas tarjetas que la portada del softbol) ----
  if (FC_SPONSORS.length) {
    const sponsors = document.createElement("section");
    sponsors.className = "home-section";
    sponsors.innerHTML = `
      ${sectionHead("Nuestros", "patrocinadores", "SPONSORS")}
      <div class="home-sponsors">
        ${FC_SPONSORS.map((s) => {
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

  if (next) {
    const el = root.querySelector("#fc-countdown");
    const timer = setInterval(() => {
      if (!el.isConnected) return clearInterval(timer);
      el.textContent = countdownText(next);
    }, 1000);
  }
}

function sortedSquad() {
  return [...FC_PLAYERS].sort(
    (a, b) =>
      POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || (a.number ?? 99) - (b.number ?? 99) || a.name.localeCompare(b.name)
  );
}

function playerCardHtml(p) {
  return `
        <a class="home-player" href="#/jugador/${encodeURIComponent(p.id)}">
          <span class="home-player-photo">
            ${avatar(p, 220)}
            ${p.number ? `<span class="home-player-num">${p.number}</span>` : ""}
          </span>
          <span class="home-player-info">
            <span class="home-player-name">${escapeHtml(p.name)}</span>
            <span class="home-player-pos">${escapeHtml(FC_POSITIONS[p.position] ?? p.position ?? "")}</span>
          </span>
        </a>`;
}

// ============================== PARTIDOS ==============================
export function renderFcPartidos(container) {
  heading(container, "Partidos");
  const upcoming = upcomingMatches();
  const played = playedMatches();
  // Ya pasó la fecha pero todavía no se captura el marcador.
  const pending = FC_MATCHES.filter((m) => !isPlayed(m) && m.date < localToday()).sort((a, b) => b.date.localeCompare(a.date));
  if (!upcoming.length && !played.length && !pending.length) {
    container.insertAdjacentHTML("beforeend", emptyState("fa-futbol", "La temporada está por comenzar."));
    return;
  }
  const block = (title, list) =>
    list.length ? `<h3>${title}</h3><div class="home-match-grid fc-match-grid">${list.map(matchCardHtml).join("")}</div>` : "";
  container.insertAdjacentHTML("beforeend", block("Próximos", upcoming) + block("Sin resultado capturado", pending) + block("Resultados", played));
}

export function renderFcPartido(container, id) {
  const m = findMatch(id);
  if (!m) {
    renderFcNotFound(container);
    return;
  }
  const played = isPlayed(m);
  const r = matchResult(m);
  const when = `${fmtDate(m.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${m.time ? ` · ${formatGameTime(m.time)}` : ""}`;

  const goals = [...(m.goals ?? [])].sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
  const cards = m.cards ?? [];
  const lineup = (m.lineup ?? []).map(findPlayer).filter(Boolean);

  container.innerHTML = `
    <a class="fc-back" href="#/partidos"><i class="fa-solid fa-arrow-left"></i> Partidos</a>
    <section class="fc-match-hero fc-match-hero--${r ?? "next"}">
      <span class="fc-match-status">${played ? RESULT_LABEL[r] : "Próximo"}</span>
      <div class="fc-match-score">
        <div class="fc-match-team">${fcLogoHtml(72)}<span>${escapeHtml(FC_TEAM.name)}</span></div>
        <div class="fc-match-goals">${played ? `<b>${m.goalsFor}</b><i>–</i><b>${m.goalsAgainst}</b>` : `<i>vs</i>`}</div>
        <div class="fc-match-team"><span class="fc-rival-badge">${escapeHtml(rivalInitials(m.opponent))}</span><span>${escapeHtml(m.opponent ?? "Rival")}</span></div>
      </div>
      <p class="fc-match-meta">${escapeHtml(when)}${m.venue ? ` · ${escapeHtml(m.venue)}` : ""}${m.matchday ? ` · Jornada ${m.matchday}` : ""}</p>
    </section>
    ${
      played
        ? `
    <div class="fc-match-cols">
      <section class="home-card fc-panel">
        <span class="home-card-kicker">Goles</span>
        ${
          goals.length
            ? `<ul class="fc-events">${goals
                .map(
                  (g) =>
                    `<li><i class="fa-solid fa-futbol"></i><span>${playerLink(g.player)}${g.assist ? ` <small>asist. ${playerLink(g.assist)}</small>` : ""}</span>${g.minute != null ? `<b>${g.minute}'</b>` : ""}</li>`
                )
                .join("")}</ul>`
            : `<p class="home-empty">${m.goalsFor ? "Sin detalle de goleadores." : "Sin goles."}</p>`
        }
      </section>
      <section class="home-card fc-panel">
        <span class="home-card-kicker">Tarjetas</span>
        ${
          cards.length
            ? `<ul class="fc-events">${cards
                .map((c) => `<li><i class="fc-card fc-card--${c.type === "red" ? "red" : "yellow"}"></i><span>${playerLink(c.player)}</span>${c.minute != null ? `<b>${c.minute}'</b>` : ""}</li>`)
                .join("")}</ul>`
            : `<p class="home-empty">Sin tarjetas.</p>`
        }
        ${m.mvp ? `<span class="home-card-kicker fc-mvp-kicker">Jugador del partido</span><p class="fc-mvp"><i class="fa-solid fa-star"></i> ${playerLink(m.mvp)}</p>` : ""}
      </section>
    </div>
    ${
      lineup.length
        ? `<h3>Alineación</h3><div class="fc-lineup">${lineup
            .map((p) => `<a href="#/jugador/${encodeURIComponent(p.id)}">${avatar(p, 36)}<span>${escapeHtml(p.name)}</span><small>${escapeHtml(p.position ?? "")}</small></a>`)
            .join("")}</div>`
        : ""
    }`
        : ""
    }
  `;
}

// ============================== TABLA ==============================
export function renderFcTabla(container) {
  heading(container, "Tabla de posiciones");
  const teams = FC_STANDINGS.teams ?? [];
  if (!teams.length) {
    container.insertAdjacentHTML("beforeend", emptyState("fa-ranking-star", "Todavía no se ha capturado la tabla de posiciones."));
    return;
  }
  if (FC_STANDINGS.updated) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = `Como la publicó la liga al ${fmtDate(FC_STANDINGS.updated, { day: "numeric", month: "long", year: "numeric" })}.`;
    container.appendChild(p);
  }
  const rows = teams.map((t) => ({ ...t, DIF: t.DIF ?? (t.GF ?? 0) - (t.GC ?? 0) }));
  const columns = [
    { key: "pos", label: "#", full: "Lugar en la tabla", numeric: true, sticky: true },
    { key: "team", label: "Equipo", sticky: true },
    { key: "PJ", label: "PJ", full: "Partidos jugados", numeric: true },
    { key: "PG", label: "PG", full: "Partidos ganados", numeric: true },
    { key: "PE", label: "PE", full: "Partidos empatados", numeric: true },
    { key: "PP", label: "PP", full: "Partidos perdidos", numeric: true },
    { key: "GF", label: "GF", full: "Goles a favor", numeric: true },
    { key: "GC", label: "GC", full: "Goles en contra", numeric: true },
    { key: "DIF", label: "DIF", full: "Diferencia de goles", numeric: true },
    { key: "PTS", label: "PTS", full: "Puntos", numeric: true },
  ];
  const tableEl = document.createElement("div");
  container.appendChild(tableEl);
  renderSortableTable(tableEl, { columns, rows, defaultSort: "pos", defaultDir: 1, rowClass: (row) => (row.us ? "standings-us" : "") });
  renderGlossary(container, columns);
}

// ============================== PLANTILLA ==============================
export function renderFcPlantilla(container) {
  heading(container, "Plantilla");
  if (!FC_PLAYERS.length) {
    container.insertAdjacentHTML("beforeend", emptyState("fa-users", "La plantilla todavía no está capturada."));
    return;
  }
  const groups = POSITION_ORDER.map((pos) => ({ pos, players: sortedSquad().filter((p) => p.position === pos) }));
  const other = sortedSquad().filter((p) => !POSITION_ORDER.includes(p.position));
  if (other.length) groups.push({ pos: null, players: other });
  if (other.length === FC_PLAYERS.length) {
    container.insertAdjacentHTML("beforeend", `<div class="home-roster fc-roster">${other.map(playerCardHtml).join("")}</div>`);
    return;
  }
  container.insertAdjacentHTML(
    "beforeend",
    groups
      .filter((g) => g.players.length)
      .map((g) => `<h3>${g.pos ? `${FC_POSITIONS[g.pos]}s` : "Posición por definir"}</h3><div class="home-roster fc-roster">${g.players.map(playerCardHtml).join("")}</div>`)
      .join("")
  );
}

export function renderFcJugador(container, id) {
  const p = findPlayer(id);
  if (!p) {
    renderFcNotFound(container);
    return;
  }
  const s = playerStats().find((r) => r.playerId === p.id);
  const tile = (value, label) => `<span class="fc-tile"><b>${value}</b><small>${label}</small></span>`;
  const log = matchesOfPlayer(p.id);
  container.innerHTML = `
    <a class="fc-back" href="#/plantilla"><i class="fa-solid fa-arrow-left"></i> Plantilla</a>
    <section class="fc-player-hero">
      <span class="fc-player-photo">${avatar(p, 160)}</span>
      <div>
        ${p.number ? `<span class="fc-player-num">#${p.number}</span>` : ""}
        <h2 class="page-title">${escapeHtml(p.name)}</h2>
        <p class="subtitle">${escapeHtml(FC_POSITIONS[p.position] ?? p.position ?? "")}</p>
      </div>
    </section>
    <div class="fc-tiles">
      ${tile(s.PJ, "Partidos")}
      ${tile(s.G, "Goles")}
      ${tile(s.A, "Asistencias")}
      ${p.position === "POR" ? tile(s.CS, "En cero") : tile(s.MVP, "MVP")}
      ${tile(s.TA, "Amarillas")}
      ${tile(s.TR, "Rojas")}
    </div>
    <h3>Partidos</h3>
    ${
      log.length
        ? `<div class="home-match-grid">${log.map(matchCardHtml).join("")}</div>`
        : emptyState("fa-futbol", "Todavía no tiene partidos registrados.")
    }
  `;
}

// ============================== ESTADÍSTICAS ==============================
export function renderFcEstadisticas(container) {
  heading(container, "Estadísticas");
  if (!FC_PLAYERS.length) {
    container.insertAdjacentHTML("beforeend", emptyState("fa-chart-simple", "Las estadísticas aparecen en cuanto se capture la plantilla y los partidos."));
    return;
  }
  const columns = [
    { key: "name", label: "Jugador", sticky: true },
    { key: "position", label: "Pos", full: "Posición" },
    { key: "PJ", label: "PJ", full: "Partidos jugados", numeric: true },
    { key: "G", label: "G", full: "Goles", numeric: true },
    { key: "A", label: "A", full: "Asistencias", numeric: true },
    { key: "GA", label: "G+A", full: "Goles + asistencias", numeric: true },
    { key: "MVP", label: "MVP", full: "Jugador del partido", numeric: true },
    { key: "CS", label: "PC", full: "Porterías en cero (porteros)", numeric: true },
    { key: "TA", label: "TA", full: "Tarjetas amarillas", numeric: true },
    { key: "TR", label: "TR", full: "Tarjetas rojas", numeric: true },
  ];
  const rows = playerStats().map((r) => ({ ...r, GA: r.G + r.A }));
  const tableEl = document.createElement("div");
  container.appendChild(tableEl);
  renderSortableTable(tableEl, { columns, rows, defaultSort: "G", onRowClick: (row) => (location.hash = `#/jugador/${encodeURIComponent(row.playerId)}`) });
  renderGlossary(container, columns);
}

export function renderFcNotFound(container) {
  container.innerHTML = `
    <div class="not-found">
      ${fcLogoHtml(140, "not-found-logo")}
      <h2 class="page-title">Fuera de lugar</h2>
      <p>Esta página no existe (o ya no).</p>
      <a href="#/" class="home-btn home-btn--solid">Volver al inicio</a>
    </div>`;
}
