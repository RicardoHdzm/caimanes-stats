import { PLAYOFFS, CURRENT_SEASON } from "../data.js";
import { playoffSeasonStatus, gameResult } from "../stats.js";
import { heading } from "../ui.js";

// "2026-09-15" -> "Martes 15 de septiembre". Mismo truco que ya usan
// js/views/resumen.js y js/views/juego.js (T00:00:00 evita que el string
// se interprete como UTC y se recorra un día en husos negativos).
function formatGameDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  const text = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ROUND_STATUS_LABEL = { en_curso: "En curso", ganada: "Ganada", perdida: "Perdida" };

const SEASON_STATUS = {
  en_curso: { label: "En curso", icon: "fa-hourglass-half", cls: "playoff-status--progress" },
  eliminados: { label: "Eliminados", icon: "fa-heart-crack", cls: "playoff-status--out" },
  campeones: { label: "¡Campeones!", icon: "fa-trophy", cls: "playoff-status--champ" },
};

const RESULT_LABEL = { W: "Victoria", L: "Derrota", T: "Empate" };

// Pinta el estatus + las tarjetas de ronda de UNA entrada de PLAYOFFS —
// exportada para que también la use "Temporadas anteriores"
// (js/views/temporadas.js) al mostrar cómo le fue en playoffs a una
// temporada pasada, sin duplicar este bloque.
export function renderPlayoffEntry(container, entry) {
  const seasonStatus = playoffSeasonStatus(entry);
  const info = SEASON_STATUS[seasonStatus.status];
  const statusEl = document.createElement("div");
  statusEl.className = `playoff-season-status ${info.cls}`;
  statusEl.innerHTML = `<i class="fa-solid ${info.icon}"></i> ${info.label}`;
  container.appendChild(statusEl);

  for (const { round, ourWins, theirWins, status } of seasonStatus.rounds) {
    const games = round.games ?? [];
    const gamesHtml = games.length
      ? games
          .map((g) => {
            const result = gameResult(g);
            const resultLabel = result ? RESULT_LABEL[result] ?? "" : "Pendiente";
            const score = g.scoreUs != null && g.scoreThem != null ? `${g.scoreUs}-${g.scoreThem}` : "";
            return `
              <a class="playoff-game-row" href="#/juegos/${g.id}">
                <span class="playoff-game-date">${formatGameDate(g.date)}</span>
                <span class="playoff-game-score">${score}</span>
                <span class="playoff-game-result">${resultLabel}</span>
              </a>
            `;
          })
          .join("")
      : '<p class="subtitle">Sin juegos capturados todavía.</p>';

    const card = document.createElement("div");
    card.className = "leader-card player-standalone-card playoff-round-card";
    card.innerHTML = `
      <h3>${round.name}${round.isFinal ? ' <span class="badge badge-win">Final</span>' : ""}</h3>
      <p class="subtitle">vs ${round.opponent} · Serie ${ourWins}-${theirWins} · ${ROUND_STATUS_LABEL[status]}</p>
      <div class="playoff-games-list">${gamesHtml}</div>
    `;
    container.appendChild(card);
  }
}

export function renderPlayoffs(container) {
  heading(container, "Playoffs");

  // Solo la temporada actual — un playoff de una temporada pasada se ve
  // desde "Temporadas anteriores" (js/views/temporadas.js), no aquí.
  const entry = PLAYOFFS.find((p) => p.season === CURRENT_SEASON);
  if (!entry || entry.rounds.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = "Aún no hay juegos de playoffs capturados esta temporada.";
    container.appendChild(p);
    return;
  }

  renderPlayoffEntry(container, entry);
}
