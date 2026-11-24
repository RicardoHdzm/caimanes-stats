// CAIMANES FC (fútbol) — sitio aparte del softbol (fc.html), con el mismo
// header, menú ☰, temas y estilos. Se llega desde el selector de deporte de
// la portada (index.html#/, ver js/views/sports.js).
import { initAppRefresh } from "../app-refresh.js";
import { FC_TEAM } from "./data.js";
import { playedMatches, upcomingMatches, matchResult } from "./stats.js";
import { fmtDate, RESULT_LABEL, fcLogoHtml } from "./ui.js";
import {
  renderFcHome,
  renderFcPartidos,
  renderFcPartido,
  renderFcTabla,
  renderFcPlantilla,
  renderFcJugador,
  renderFcEstadisticas,
  renderFcNotFound,
  renderFcMedallas,
} from "./views.js";
import { escapeHtml, formatGameTime } from "../ui.js";
import { initTheme } from "../theme.js";
import { initSportSwitch } from "../sport-switch.js";

const NAV = [
  { tab: "home", route: "#/", label: "Inicio", icon: "fa-house" },
  { tab: "partidos", route: "#/partidos", label: "Partidos", icon: "fa-futbol" },
  { tab: "tabla", route: "#/tabla", label: "Tabla", icon: "fa-ranking-star" },
  { tab: "plantilla", route: "#/plantilla", label: "Plantilla", icon: "fa-users" },
  { tab: "estadisticas", route: "#/estadisticas", label: "Estadísticas", icon: "fa-chart-simple" },
];

const routes = {
  home: renderFcHome,
  partidos: renderFcPartidos,
  tabla: renderFcTabla,
  plantilla: renderFcPlantilla,
  estadisticas: renderFcEstadisticas,
};

const app = document.getElementById("app");
const tabs = document.getElementById("tabs");
const moreSheet = document.getElementById("more-sheet");
const menuToggle = document.getElementById("menu-toggle");

function currentRoute() {
  const [first, second] = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  if (!first) return { tab: "home", render: routes.home };
  if (first === "partidos" && second) return { tab: "partidos", render: (c) => renderFcPartido(c, second) };
  if (first === "jugador" && second) return { tab: "plantilla", render: (c) => renderFcJugador(c, second) };
  // Guía de medallas; el id (opcional) es el perfil desde el que se llegó.
  if (first === "medallas") return { tab: "plantilla", render: (c) => renderFcMedallas(c, second) };
  if (routes[first]) return { tab: first, render: routes[first] };
  return { tab: null, render: renderFcNotFound };
}

// ---- Header, menú ☰ y footer ----
const brandLogo = FC_TEAM.logoWhite ? `<img src="${FC_TEAM.logoWhite}" alt="" class="site-brand-logo fc-brand-white" />` : fcLogoHtml(40, "fc-brand-logo");
// Solo el escudo, sin el nombre al lado (igual que el header del softbol).
document.getElementById("fc-brand").innerHTML = brandLogo;
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
    <h4 class="more-sheet-group">Caimanes FC</h4>
    <div class="more-sheet-grid">${NAV.map(tile).join("")}</div>
    <h4 class="more-sheet-group">Más</h4>
    <div class="more-sheet-grid">
      <a href="./#/softbol" data-sport-switch="softbol">
        <span class="more-app-icon"><i class="fa-solid fa-baseball-bat-ball"></i></span>
        <span>Sóftbol</span>
      </a>
      <a href="./#/">
        <span class="more-app-icon"><i class="fa-solid fa-shuffle"></i></span>
        <span>Cambiar deporte</span>
      </a>
      ${
        FC_TEAM.instagram
          ? `<a href="${FC_TEAM.instagram}" target="_blank" rel="noopener noreferrer">
        <span class="more-app-icon"><i class="fa-brands fa-instagram"></i></span>
        <span>Instagram</span>
      </a>`
          : ""
      }
      <button type="button" id="more-tile-theme">
        <span class="more-app-icon"><i class="fa-solid fa-circle-half-stroke" id="more-tile-theme-icon"></i></span>
        <span>Tema</span>
      </button>
    </div>`;

document.getElementById("footer-nav").innerHTML = `
    <div class="footer-col">
      <h3 class="footer-col-title">Caimanes FC</h3>
      ${NAV.map((t) => `<a href="${t.route}">${t.label}</a>`).join("")}
    </div>
    <div class="footer-col">
      <h3 class="footer-col-title">Otros deportes</h3>
      <a href="./#/softbol" data-sport-switch="softbol">Sóftbol · Caimanes de Villas</a>
      <a href="./#/">Cambiar deporte</a>
    </div>`;
document.getElementById("footer-year").textContent = new Date().getFullYear();
document.getElementById("footer-logo").innerHTML = fcLogoHtml(44);
const leagueLabel = [FC_TEAM.league, FC_TEAM.season].filter(Boolean).join(" · ");
const seasonLabel = document.getElementById("season-label");
seasonLabel.textContent = leagueLabel;
seasonLabel.hidden = !leagueLabel;

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

// ---- Barra "Match Center": próximo partido + últimos resultados ----
function buildTicker() {
  const el = document.getElementById("match-ticker");
  const items = [];
  const next = upcomingMatches()[0];
  if (next) {
    const time = next.time ? formatGameTime(next.time) : "";
    items.push(
      `<span class="ticker-item ticker-item--next">Próximo: <b>Caimanes FC vs ${escapeHtml(next.opponent ?? "")}</b> · ${fmtDate(next.date)}${time ? `, ${time}` : ""}</span>`
    );
  }
  for (const m of playedMatches().slice(0, 4)) {
    const r = matchResult(m);
    items.push(
      `<a class="ticker-item" href="#/partidos/${encodeURIComponent(m.id)}"><b>Caimanes FC <i class="ticker-score ticker-score--${r}">${m.goalsFor}–${m.goalsAgainst}</i> ${escapeHtml(m.opponent ?? "")}</b> · ${RESULT_LABEL[r]}</a>`
    );
  }
  // Sin partidos todavía (la temporada no empieza): la misma cinta, nomás
  // con "Próximamente" corriendo, una vez en rojo (--next) y otra en blanco.
  // Pares completos (8 = 4 pares) para que cada mitad de la cinta sea igual
  // y la vuelta no rompa la alternancia.
  if (!items.length) {
    const pair =
      `<span class="ticker-item ticker-item--next"><b>Próximamente</b></span>` +
      `<span class="ticker-item"><b>Próximamente</b></span>`;
    const run = pair.repeat(4);
    el.innerHTML = `<span class="ticker-label">● Partidos</span><div class="ticker-viewport"><div class="ticker-track">${run}${run}</div></div>`;
    return;
  }
  const run = items.join("").repeat(2);
  el.innerHTML = `<span class="ticker-label">● Partidos</span><div class="ticker-viewport"><div class="ticker-track">${run}${run}</div></div>`;
}

let booted = false;
function render() {
  const route = currentRoute();
  toggleMoreSheet(false);
  for (const link of tabs.querySelectorAll("a")) link.classList.toggle("active", link.dataset.route === route.tab);
  for (const link of moreSheet.querySelectorAll("a[data-tab]")) link.classList.toggle("active", link.dataset.tab === route.tab);
  app.innerHTML = "";
  route.render(app);
  // La primera pintada (al abrir la página o al cambiar de deporte) va sin
  // animación: el fundido desde transparente dejaba ver el fondo de la
  // página (claro en el tema Sol) antes que el hero.
  app.classList.remove("page-enter");
  if (booted) {
    void app.offsetWidth;
    app.classList.add("page-enter");
  }
  booted = true;
  // Ya pintó: se quita el "cascarón" de carga (ver el script del <head>).
  delete document.documentElement.dataset.boot;
  // Aviso para la pantalla de "Cargando" al cambiar de deporte.
  window.dispatchEvent(new Event("caimanes:rendered"));
}

buildTicker();
initTheme();
initSportSwitch();
render();
window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
});

initAppRefresh();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
