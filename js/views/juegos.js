// Juegos (a petición expresa, con las mismas tarjetas estilo marcador del
// historial de la portada — ver js/scorecards.js — en lugar de tablas):
// los próximos arriba y los resultados de la temporada actual (regular +
// playoffs), del más reciente al más viejo.
import { SCHEDULE, GAMES, CURRENT_SEASON } from "../data.js";
import { seasonStatGames } from "../stats.js";
import { heading } from "../ui.js";
import { upcomingCardHtml, resultCardHtml } from "../scorecards.js";

export function renderJuegos(container) {
  heading(container, "Juegos");

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const upcoming = [...SCHEDULE].filter((g) => g.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length > 0) {
    const h = document.createElement("h3");
    h.textContent = "Próximos juegos";
    container.appendChild(h);
    const played = GAMES.filter((g) => g.season === CURRENT_SEASON && !g.playoff).length;
    const grid = document.createElement("div");
    grid.className = "home-match-grid";
    grid.innerHTML = upcoming.map((g, i) => upcomingCardHtml(g, played + i + 1)).join("");
    container.appendChild(grid);
  }

  const h = document.createElement("h3");
  h.textContent = "Resultados";
  container.appendChild(h);
  const results = seasonStatGames()
    .filter((g) => g.date)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? "").localeCompare(a.time ?? ""));
  const grid = document.createElement("div");
  grid.className = "home-match-grid";
  grid.innerHTML = results.length
    ? results.map(resultCardHtml).join("")
    : '<p class="subtitle">Todavía no hay juegos esta temporada. El caimán está calentando.</p>';
  container.appendChild(grid);
}
