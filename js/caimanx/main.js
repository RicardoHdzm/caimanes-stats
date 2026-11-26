// CAIMANX (gaming) — sitio aparte (caimanx.html), con el mismo header,
// menú ☰, temas y estilos que el sóftbol y Caimanes FC (ver js/fc/main.js,
// del que sale este armado). Se llega desde el selector de deporte de la
// portada (index.html#/, ver js/views/sports.js).
import { initAppRefresh } from "../app-refresh.js";
import { initTheme } from "../theme.js";
import { escapeHtml, heading } from "../ui.js";
import { sectionHead, emptyState } from "../fc/ui.js";
import { LINKS, PLAYERS, GAMES, TOURNAMENTS } from "./data.js";
import { renderOverlays, OVERLAY_COUNT } from "./overlays.js";

const NAV = [
  { tab: "home", route: "#/", label: "Inicio", icon: "fa-house" },
  { tab: "equipo", route: "#/equipo", label: "Equipo", icon: "fa-users" },
  { tab: "juegos", route: "#/juegos", label: "Juegos", icon: "fa-gamepad" },
  { tab: "torneos", route: "#/torneos", label: "Torneos", icon: "fa-trophy" },
  { tab: "overlays", route: "#/overlays", label: "Overlays", icon: "fa-display" },
];

const SOCIAL_ICONS = {
  instagram: ["Instagram", "fa-instagram"],
  twitch: ["Twitch", "fa-twitch"],
  youtube: ["YouTube", "fa-youtube"],
  tiktok: ["TikTok", "fa-tiktok"],
  kick: ["Kick", "fa-kickstarter-k"],
};
const socials = Object.entries(LINKS)
  .filter(([key, url]) => url && SOCIAL_ICONS[key])
  .map(([key, url]) => ({ url, label: SOCIAL_ICONS[key][0], icon: SOCIAL_ICONS[key][1] }));

// ---- piezas ----

function playerCard(p) {
  return `
    <article class="cx-player">
      <h3 class="cx-player-tag">${escapeHtml(p.tag)}</h3>
      ${p.name ? `<p class="cx-player-name">${escapeHtml(p.name)}</p>` : ""}
      ${p.games?.length ? `<div class="cx-chips">${p.games.map((g) => `<span class="cx-chip">${escapeHtml(g)}</span>`).join("")}</div>` : ""}
      ${p.twitch ? `<a class="cx-player-link" href="${escapeHtml(p.twitch)}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-twitch"></i> Twitch</a>` : ""}
    </article>`;
}

function gameCard(g) {
  return `
    <a class="cx-game" href="#/overlays/${encodeURIComponent(g.overlay)}">
      <span class="cx-game-name">${escapeHtml(g.name)}</span>
      <span class="cx-game-link">Overlay <i class="fa-solid fa-arrow-right"></i></span>
    </a>`;
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? escapeHtml(iso) : d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function tournamentRow(t) {
  return `
    <div class="cx-tournament">
      <span class="cx-tournament-date">${formatDate(t.date)}</span>
      <span class="cx-tournament-name">${escapeHtml(t.name)}<small>${escapeHtml(t.game)}</small></span>
      <span class="cx-tournament-result${t.result ? "" : " is-pending"}">${t.result ? escapeHtml(t.result) : "Por jugar"}</span>
    </div>`;
}

const playersHtml = () =>
  PLAYERS.length ? `<div class="cx-players">${PLAYERS.map(playerCard).join("")}</div>` : emptyState("fa-users", "Todavía no hay jugadores en la lista.");
const gamesHtml = () =>
  GAMES.length ? `<div class="cx-games">${GAMES.map(gameCard).join("")}</div>` : emptyState("fa-gamepad", "Todavía no hay juegos en la lista.");
const tournamentsHtml = (list = TOURNAMENTS) =>
  list.length ? `<div class="cx-tournaments">${list.map(tournamentRow).join("")}</div>` : emptyState("fa-trophy", "Todavía no hay torneos registrados.");

// ---- vistas ----

function renderHome(container) {
  container.innerHTML = `
    <div class="home cx-home">
      <section class="home-hero home-hero--cx">
        <img class="home-hero-video" src="assets/gaming.jpeg" alt="" aria-hidden="true" />
        <div class="home-hero-bg" aria-hidden="true"></div>
        <div class="home-hero-content">
          <img src="assets/logos/caimanx.png?v=5" alt="" class="home-hero-logo cx-hero-logo" />
          <h1 class="home-hero-name">CaimanX</h1>
          <p class="home-hero-tag">Gaming</p>
          <p class="home-hero-league">Caimanes.Team · Culiacán</p>
          <div class="home-hero-ctas">
            <a href="#/overlays" class="home-btn home-btn--solid">Overlays para OBS</a>
            <a href="#/equipo" class="home-btn home-btn--ghost">Conoce al equipo</a>
          </div>
        </div>
      </section>

      <section class="home-stats">
        <div class="home-stat"><b>${PLAYERS.length}</b><span>Jugadores</span></div>
        <div class="home-stat"><b>${GAMES.length}</b><span>Juegos</span></div>
        <div class="home-stat"><b>${TOURNAMENTS.length}</b><span>Torneos</span></div>
        <div class="home-stat"><b>${OVERLAY_COUNT}</b><span>Overlays</span></div>
      </section>

      <div class="home-marquee" aria-hidden="true">
        <div class="home-marquee-track">
          ${Array.from({ length: 8 }, () => `<span>CaimanX</span><span class="home-marquee-accent">#CaimanX</span><span>Gaming</span><span class="home-marquee-accent">#Caimanation</span>`).join("")}
        </div>
      </div>

      <section class="home-section">
        ${sectionHead("Nuestros", "juegos", "JUEGOS")}
        ${gamesHtml()}
      </section>

      <section class="home-section">
        ${sectionHead("Los", "torneos", "TORNEOS")}
        ${tournamentsHtml(TOURNAMENTS.slice(0, 4))}
      </section>

      <section class="home-section">
        ${sectionHead("El", "equipo", "EQUIPO")}
        ${playersHtml()}
      </section>
    </div>`;
}

function renderEquipo(container) {
  heading(container, "El Equipo");
  container.insertAdjacentHTML("beforeend", playersHtml());
}

function renderJuegos(container) {
  heading(container, "Nuestros Juegos");
  container.insertAdjacentHTML("beforeend", gamesHtml());
}

function renderTorneos(container) {
  heading(container, "Los Torneos");
  container.insertAdjacentHTML("beforeend", tournamentsHtml());
}

function renderOverlaysPage(container, focus) {
  heading(container, "Overlays para OBS");
  renderOverlays(container);
  // Llegando desde un juego (#/overlays/pokemon): brinca a su tarjeta.
  if (focus) requestAnimationFrame(() => document.getElementById(`overlay-${focus}`)?.scrollIntoView({ block: "start" }));
}

function renderNotFound(container) {
  container.innerHTML = `
    <div class="not-found">
      <img src="assets/logos/caimanx.png?v=5" alt="" class="not-found-logo cx-notfound-logo" />
      <h2 class="page-title">Game over</h2>
      <p>Esta página no existe (o ya no).</p>
      <a href="#/" class="home-btn home-btn--solid">Volver al inicio</a>
    </div>`;
}

const routes = { home: renderHome, equipo: renderEquipo, juegos: renderJuegos, torneos: renderTorneos };

function currentRoute() {
  const [first, second] = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  if (!first) return { tab: "home", render: renderHome };
  if (first === "overlays") return { tab: "overlays", render: (c) => renderOverlaysPage(c, second) };
  if (routes[first]) return { tab: first, render: routes[first] };
  return { tab: null, render: renderNotFound };
}

// ---- Header, menú ☰ y footer ----
const app = document.getElementById("app");
const tabs = document.getElementById("tabs");
const moreSheet = document.getElementById("more-sheet");
const menuToggle = document.getElementById("menu-toggle");

tabs.innerHTML = NAV.map((t) => `<a href="${t.route}" data-route="${t.tab}">${t.label}</a>`).join("");

const tile = (t) => `
        <a href="${t.route}" data-tab="${t.tab}">
          <span class="more-app-icon"><i class="fa-solid ${t.icon}"></i></span>
          <span>${t.label}</span>
        </a>`;
moreSheet.innerHTML = `
    <div class="more-sheet-header">
      <h3>Menú</h3>
      <button type="button" class="more-sheet-close" id="more-sheet-close-btn" aria-label="Cerrar">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <h4 class="more-sheet-group">CaimanX</h4>
    <div class="more-sheet-grid">${NAV.map(tile).join("")}</div>
    <h4 class="more-sheet-group">Más</h4>
    <div class="more-sheet-grid">
      <a href="softbol">
        <span class="more-app-icon"><i class="fa-solid fa-baseball-bat-ball"></i></span>
        <span>Sóftbol</span>
      </a>
      <a href="futbol">
        <span class="more-app-icon"><i class="fa-solid fa-futbol"></i></span>
        <span>Fútbol</span>
      </a>
      <a href="./#/">
        <span class="more-app-icon"><i class="fa-solid fa-shuffle"></i></span>
        <span>Cambiar deporte</span>
      </a>
      ${socials
        .map(
          (s) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">
        <span class="more-app-icon"><i class="fa-brands ${s.icon}"></i></span>
        <span>${s.label}</span>
      </a>`
        )
        .join("")}
      <button type="button" id="more-tile-theme">
        <span class="more-app-icon"><i class="fa-solid fa-circle-half-stroke" id="more-tile-theme-icon"></i></span>
        <span>Tema</span>
      </button>
    </div>`;

document.getElementById("footer-nav").innerHTML = `
    <div class="footer-col">
      <h3 class="footer-col-title">CaimanX</h3>
      ${NAV.map((t) => `<a href="${t.route}">${t.label}</a>`).join("")}
    </div>
    <div class="footer-col">
      <h3 class="footer-col-title">Otros deportes</h3>
      <a href="softbol">Sóftbol · Caimanes de Villas</a>
      <a href="futbol">Fútbol · Caimanes FC</a>
      <a href="./#/">Cambiar deporte</a>
    </div>`;
document.getElementById("footer-socials").innerHTML = socials
  .map(
    (s) =>
      `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="footer-social" aria-label="${s.label}"><i class="fa-brands ${s.icon}"></i></a>`
  )
  .join("");
document.getElementById("footer-year").textContent = new Date().getFullYear();

function toggleMoreSheet(forceOpen) {
  const open = forceOpen ?? moreSheet.hidden;
  moreSheet.hidden = !open;
  menuToggle?.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("menu-open", open);
}
menuToggle?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleMoreSheet();
});
moreSheet.querySelector("#more-sheet-close-btn").addEventListener("click", () => toggleMoreSheet(false));
moreSheet.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") toggleMoreSheet(false);
});

// ---- Barra de arriba: próximos torneos / últimos resultados ----
function buildTicker() {
  const el = document.getElementById("match-ticker");
  const items = TOURNAMENTS.slice(0, 5).map(
    (t) =>
      `<span class="ticker-item${t.result ? "" : " ticker-item--next"}"><b>${escapeHtml(t.name)}</b> · ${escapeHtml(t.game)}${t.result ? ` · ${escapeHtml(t.result)}` : ` · ${formatDate(t.date)}`}</span>`
  );
  // Sin torneos todavía: "Próximamente" corriendo, como en Caimanes FC.
  const run = items.length
    ? items.join("").repeat(2)
    : (`<span class="ticker-item ticker-item--next"><b>Próximamente</b></span>` + `<span class="ticker-item"><b>Próximamente</b></span>`).repeat(4);
  el.innerHTML = `<span class="ticker-label">● Torneos</span><div class="ticker-viewport"><div class="ticker-track">${run}${run}</div></div>`;
}

let booted = false;
function render() {
  const route = currentRoute();
  toggleMoreSheet(false);
  for (const link of tabs.querySelectorAll("a")) link.classList.toggle("active", link.dataset.route === route.tab);
  for (const link of moreSheet.querySelectorAll("a[data-tab]")) link.classList.toggle("active", link.dataset.tab === route.tab);
  app.innerHTML = "";
  route.render(app);
  app.classList.remove("page-enter");
  if (booted) {
    void app.offsetWidth;
    app.classList.add("page-enter");
  }
  booted = true;
}

buildTicker();
initTheme();
render();
window.addEventListener("hashchange", () => {
  render();
  if (!location.hash.startsWith("#/overlays/")) window.scrollTo(0, 0);
});

initAppRefresh();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
