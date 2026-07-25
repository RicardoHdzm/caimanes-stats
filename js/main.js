import { TEAM } from "./data.js";
import { renderResumen } from "./views/resumen.js";
import { renderRoster } from "./views/roster.js";
import { renderBateo } from "./views/bateo.js";
import { renderPitcheo } from "./views/pitcheo.js";
import { renderFildeo } from "./views/fildeo.js";
import { renderJuegos } from "./views/juegos.js";
import { renderCalendario } from "./views/calendario.js";
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
};

const app = document.getElementById("app");
const tabs = document.getElementById("tabs");

document.getElementById("season-label").textContent =
  `Temporada ${TEAM.season} - ${TEAM.league} ${TEAM.seasonsInLeague}ta Temporada - ${TEAM.seasonsTotal}va Temporada de Caimanes`;

document.getElementById("footer-year").textContent = new Date().getFullYear();

function currentRoute() {
  const hash = location.hash.replace(/^#\//, "");
  const [first, second] = hash.split("/");
  if (first === "juegos" && second) {
    return { tab: "juegos", render: (container) => renderJuegoDetalle(container, second) };
  }
  if (first === "jugador" && second) {
    return { tab: "roster", render: (container) => renderJugadorDetalle(container, second) };
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
