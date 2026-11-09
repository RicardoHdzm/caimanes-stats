// Caimavlogs (antes "Vlogs"): los videos de YouTube de los juegos. No hay
// lista aparte — sale de GAMES: todo juego con `vlogUrl` (ver data.js) es un
// vlog. El número (#001, #002…) va por fecha, el más viejo es el #001, y la
// página los muestra del más nuevo al más viejo.
import { GAMES } from "../data.js";
import { gameResult } from "../stats.js";
import { escapeHtml } from "../ui.js";

// Saca el id del video de cualquier link de YouTube: watch?v=, youtu.be/,
// shorts/, live/ o embed/. Sin id válido el juego simplemente no sale.
export function youtubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, "");
    let id = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1] ?? null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

// Juegos con vlog, ya numerados, del más viejo al más nuevo.
export function vlogGames(games = GAMES) {
  return games
    .filter((g) => youtubeId(g.vlogUrl))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
    .map((g, i) => ({ game: g, number: i + 1, videoId: youtubeId(g.vlogUrl) }));
}

const RESULT_LABEL = { W: "Victoria", L: "Derrota", T: "Empate" };

function formatVlogDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

// Tarjeta: el video (se carga hasta que llega a pantalla) y abajo de qué
// juego es, con link al juego.
function vlogCard({ game, number, videoId }) {
  const result = gameResult(game);
  const score = result ? `${RESULT_LABEL[result]} ${game.scoreUs}-${game.scoreThem}` : "";
  return `
    <article class="vlog-card">
      <div class="vlog-card-video">
        <iframe src="https://www.youtube-nocookie.com/embed/${videoId}" title="Vlog #${String(number).padStart(3, "0")} vs ${escapeHtml(game.opponent)}"
          loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </div>
      <div class="vlog-card-body">
        <span class="vlog-card-number">Vlog #${String(number).padStart(3, "0")}</span>
        <h3 class="vlog-card-title">vs ${escapeHtml(game.opponent)}</h3>
        <p class="vlog-card-meta">${formatVlogDate(game.date)}${score ? ` · <span class="vlog-card-result vlog-card-result--${result}">${score}</span>` : ""}</p>
        <a class="vlog-card-link" href="#/juegos/${game.id}">Ver juego <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
      </div>
    </article>
  `;
}

export function renderVlogs(container) {
  // Título a mano (heading() pinta en rojo la última PALABRA y aquí es una
  // sola): "Caima" normal y "vlogs" en rojo, a petición expresa.
  const title = document.createElement("h2");
  title.className = "page-title";
  title.innerHTML = 'Caima<span class="page-title-accent">vlogs</span> <i class="page-title-slashes" aria-hidden="true">///</i>';
  container.appendChild(title);

  const vlogs = vlogGames().reverse();
  const grid = document.createElement("div");
  grid.className = "vlog-grid";
  grid.innerHTML = vlogs.length
    ? vlogs.map(vlogCard).join("")
    : '<p class="subtitle">Todavía no hay vlogs. Pronto, desde la banca.</p>';
  container.appendChild(grid);
}
