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

const app = document.getElementById("app");
const tabs = document.getElementById("tabs");

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

function render() {
  const route = currentRoute();
  for (const link of tabs.querySelectorAll("a")) {
    link.classList.toggle("active", link.dataset.route === route.tab);
  }
  app.innerHTML = "";
  route.render(app);
}

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
