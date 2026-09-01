import { TEAM } from "./data.js";
import { renderResumen } from "./views/resumen.js";
import { renderRoster } from "./views/roster.js";
import { renderBateo } from "./views/bateo.js";
import { renderPitcheo } from "./views/pitcheo.js";
import { renderFildeo } from "./views/fildeo.js";
import { renderJuegos } from "./views/juegos.js";
import { renderCalendario } from "./views/calendario.js";
import { renderStanding } from "./views/standing.js";
import { renderAlineacion } from "./views/alineacion.js";
import { renderJuegoDetalle } from "./views/juego.js";
import { renderJugadorDetalle } from "./views/jugador.js";

const routes = {
  resumen: renderResumen,
  roster: renderRoster,
  bateo: renderBateo,
  pitcheo: renderPitcheo,
  fildeo: renderFildeo,
  juegos: renderJuegos,
  calendario: renderCalendario,
  standing: renderStanding,
  alineacion: renderAlineacion,
};

// Barra de pestañas de abajo (solo celular — ver @media en styles.css). La
// nav de arriba sigue intacta y es la real en escritorio; esta es aparte
// porque en 9 rutas no caben cómodas 5 botones de pulgar, así que solo van
// al frente las 4 de "vistazo rápido" y el resto vive detrás de "Más".
const BOTTOM_TABS = [
  { tab: "resumen", route: "#/resumen", label: "Resumen", icon: "fa-house" },
  { tab: "roster", route: "#/roster", label: "Roster", icon: "fa-users" },
  { tab: "juegos", route: "#/juegos", label: "Juegos", icon: "fa-flag-checkered" },
  { tab: "standing", route: "#/standing", label: "Standing", icon: "fa-ranking-star" },
];

const MORE_TABS = [
  { tab: "bateo", route: "#/bateo", label: "Bateo", icon: "fa-baseball-bat-ball" },
  { tab: "pitcheo", route: "#/pitcheo", label: "Pitcheo", icon: "fa-baseball" },
  { tab: "fildeo", route: "#/fildeo", label: "Fildeo", icon: "fa-shield" },
  { tab: "calendario", route: "#/calendario", label: "Calendario", icon: "fa-calendar-day" },
  { tab: "alineacion", route: "#/alineacion", label: "Alineación", icon: "fa-clipboard-list" },
];

const app = document.getElementById("app");
const tabs = document.getElementById("tabs");
const bottomTabs = document.getElementById("bottom-tabs");
const moreSheet = document.getElementById("more-sheet");

document.getElementById("season-label").textContent =
  `${TEAM.league} ${TEAM.seasonsInLeague}ta Temporada - ${TEAM.seasonsTotal}va Temporada`;

document.getElementById("footer-year").textContent = new Date().getFullYear();

function currentRoute() {
  const hash = location.hash.replace(/^#\//, "");
  const [first, second, third] = hash.split("/");
  if (first === "juegos" && second) {
    return { tab: "juegos", render: (container) => renderJuegoDetalle(container, second) };
  }
  if (first === "jugador" && second) {
    return { tab: "roster", render: (container) => renderJugadorDetalle(container, second) };
  }
  // #/alineacion/p1/p2 — los dos jugadores del comparador que va al final de
  // esa vista viven en la URL para poder compartir la comparación armada.
  if (first === "alineacion") {
    return { tab: "alineacion", render: (container) => renderAlineacion(container, second, third) };
  }
  const tab = routes[first] ? first : "resumen";
  return { tab, render: routes[tab] };
}

// Arma la barra de abajo una sola vez: los 4 botones de ruta directa más
// "Más", que no navega — abre el panel con las 5 rutas restantes.
function buildBottomTabs() {
  bottomTabs.innerHTML = "";
  for (const t of BOTTOM_TABS) {
    const a = document.createElement("a");
    a.href = t.route;
    a.className = "bottom-tab";
    a.dataset.tab = t.tab;
    a.innerHTML = `<i class="fa-solid ${t.icon}"></i><span>${t.label}</span>`;
    bottomTabs.appendChild(a);
  }

  const moreBtn = document.createElement("button");
  moreBtn.type = "button";
  moreBtn.className = "bottom-tab";
  moreBtn.dataset.tab = "more";
  moreBtn.setAttribute("aria-expanded", "false");
  moreBtn.innerHTML = `<i class="fa-solid fa-ellipsis"></i><span>Más</span>`;
  moreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMoreSheet();
  });
  bottomTabs.appendChild(moreBtn);

  moreSheet.innerHTML = MORE_TABS.map(
    (t) => `<a href="${t.route}" data-tab="${t.tab}"><i class="fa-solid ${t.icon}"></i>${t.label}</a>`
  ).join("");
}

function toggleMoreSheet(forceOpen) {
  const open = forceOpen ?? moreSheet.hidden;
  moreSheet.hidden = !open;
  bottomTabs.querySelector('[data-tab="more"]')?.setAttribute("aria-expanded", String(open));
}

// Tocar fuera del panel lo cierra — el panel mismo detiene la propagación
// para que tocar un link adentro no cuente como "afuera".
moreSheet.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", () => toggleMoreSheet(false));

const MORE_TAB_IDS = new Set(MORE_TABS.map((t) => t.tab));

function render() {
  const route = currentRoute();
  toggleMoreSheet(false);

  for (const link of tabs.querySelectorAll("a")) {
    link.classList.toggle("active", link.dataset.route === route.tab);
  }

  for (const el of bottomTabs.querySelectorAll("[data-tab]")) {
    const isMore = el.dataset.tab === "more";
    el.classList.toggle("active", isMore ? MORE_TAB_IDS.has(route.tab) : el.dataset.tab === route.tab);
  }
  for (const link of moreSheet.querySelectorAll("a")) {
    link.classList.toggle("active", link.dataset.tab === route.tab);
  }

  app.innerHTML = "";
  route.render(app);
}

buildBottomTabs();
window.addEventListener("hashchange", render);
render();

// Service worker: deja abrir la página sin señal (en el campo casi nunca hay
// datos). Si falla el registro la app sigue funcionando normal, solo pierde
// el modo offline — por eso el catch silencioso.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
