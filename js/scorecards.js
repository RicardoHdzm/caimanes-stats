// Tarjetas de juego estilo marcador de transmisión — las usan el historial de
// la portada (js/views/home.js) y la página de Juegos (js/views/juegos.js).
// Un renglón por equipo con su marcador en Teko a la derecha (el ganador en
// blanco, el que pierde apagado), raya del color del resultado a la
// izquierda (verde victoria, roja derrota, ámbar próximo) y arriba el estado
// con la fecha. Los próximos llevan la hora en grande en lugar del marcador.
// Estilos: .score-card en css/styles.css.
import { GAMES, PLAYOFFS, CURRENT_SEASON } from "./data.js";
import { gameResult } from "./stats.js";
import { escapeHtml, ordinalTemporada, formatGameTime } from "./ui.js";

const RESULT_LABEL = { W: "Victoria", L: "Derrota", T: "Empate" };

function shortDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
}

// "Rockin Roll" -> "RR", "Blockreto" -> "BL": el "logo" del rival (no
// tenemos los escudos de los demás equipos).
export function rivalInitials(name) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// "8va Temporada · Juego 9" — número de juego dentro de su temporada (por
// fecha). Los de playoffs se cuentan dentro de su serie, con el nombre de la
// ronda: "8va Temporada · Cuartos de Final · Juego 2".
export function gameTag(g) {
  const season = `${ordinalTemporada(g.season)} Temporada`;
  if (g.playoff) {
    const round = PLAYOFFS.find((e) => e.season === g.season)?.rounds.find((r) => r.games?.some((x) => x.id === g.id));
    const n = round ? round.games.findIndex((x) => x.id === g.id) + 1 : 0;
    return [season, round?.name ?? "Playoffs", n ? `Juego ${n}` : ""].filter(Boolean).join(" · ");
  }
  const n = GAMES.filter((x) => x.season === g.season).sort((a, b) => a.date.localeCompare(b.date)).findIndex((x) => x.id === g.id) + 1;
  return n ? `${season} · Juego ${n}` : season;
}

function teamRow(logoHtml, name, runs, state) {
  return `
          <span class="score-row${state ? ` score-row--${state}` : ""}">
            ${logoHtml}
            <span class="score-row-name">${escapeHtml(name)}</span>
            ${runs != null ? `<b class="score-row-runs">${runs}</b>` : ""}
          </span>`;
}

const US_LOGO = '<img class="score-row-logo" src="assets/logo.png" alt="" />';
const rivalLogo = (opponent) => `<i class="score-row-logo score-row-logo--rival">${escapeHtml(rivalInitials(opponent))}</i>`;

// `g`: una entrada de SCHEDULE. `gameNo`: su número dentro de la temporada.
// `href`/`cta`: a dónde lleva (en el Calendario, a Resumen para confirmar
// asistencia; en los demás, al Calendario).
export function upcomingCardHtml(g, gameNo, { href = "#/calendario", cta = "Calendario" } = {}) {
  const [time, ampm] = g.time ? formatGameTime(g.time).split(" ") : ["", ""];
  return `
        <a class="score-card score-card--next" href="${href}">
          <span class="score-card-top">
            <span class="score-card-status">Próximo</span>
            <span>${escapeHtml(shortDate(g.date))}</span>
          </span>
          <span class="score-card-body">
            <span class="score-card-rows">
              ${teamRow(US_LOGO, "Caimanes")}
              ${teamRow(rivalLogo(g.opponent), g.opponent ?? "Rival")}
            </span>
            ${time ? `<span class="score-card-time"><b>${time}</b><small>${ampm}</small></span>` : ""}
          </span>
          <span class="score-card-foot">
            <span>${ordinalTemporada(CURRENT_SEASON)} Temporada${gameNo ? ` · Juego ${gameNo}` : ""}</span>
            <span class="score-card-cta">${cta} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
          </span>
        </a>`;
}

// `g`: un juego jugado (GAMES o playoffs).
export function resultCardHtml(g) {
  const r = gameResult(g);
  const known = g.scoreUs != null && g.scoreThem != null;
  const us = r === "W" ? "win" : r === "L" ? "lose" : "";
  const them = r === "L" ? "win" : r === "W" ? "lose" : "";
  return `
        <a class="score-card score-card--${r ?? "unknown"}" href="#/juegos/${g.id}">
          <span class="score-card-top">
            <span class="score-card-status">${RESULT_LABEL[r] ?? "Final"}</span>
            <span>${escapeHtml(shortDate(g.date))}</span>
          </span>
          <span class="score-card-body">
            <span class="score-card-rows">
              ${teamRow(US_LOGO, "Caimanes", known ? g.scoreUs : "—", us)}
              ${teamRow(rivalLogo(g.opponent), g.opponent ?? "Rival", known ? g.scoreThem : "—", them)}
            </span>
          </span>
          <span class="score-card-foot">
            <span>${escapeHtml(gameTag(g))}</span>
            <span class="score-card-cta">Ver juego <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
          </span>
        </a>`;
}
