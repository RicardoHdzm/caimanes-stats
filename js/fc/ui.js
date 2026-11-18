// Piezas de interfaz de CAIMANES FC. Las tarjetas de partido usan las mismas
// clases .score-card del softbol (ver js/scorecards.js) para verse iguales.
import { FC_TEAM } from "./data.js";
import { matchResult, isPlayed } from "./stats.js";
import { escapeHtml, formatGameTime } from "../ui.js";

// "Rockin Roll" -> "RR": el "escudo" del rival (no tenemos los de los demás
// equipos). Copia de la de js/scorecards.js — esa importa los datos del
// softbol, que esta página no necesita cargar.
export function rivalInitials(name) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const RESULT_LABEL = { W: "Victoria", L: "Derrota", T: "Empate" };

export function fmtDate(dateStr, opts = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-MX", opts);
}

// Escudo del equipo: el real (FC_TEAM.logo) o, mientras no haya, uno
// provisional hecho con CSS — la cabeza del caimán dentro de un escudo con
// "FC" abajo (ver .fc-crest en css/styles.css). `size` en px de ancho.
export function fcLogoHtml(size = 120, extraClass = "") {
  if (FC_TEAM.logo) {
    return `<img src="${FC_TEAM.logo}" alt="" class="fc-logo-img ${extraClass}" style="--crest-w:${size}px" />`;
  }
  return `
    <span class="fc-crest ${extraClass}" style="--crest-w:${size}px" aria-hidden="true">
      <span class="fc-crest-shield">
        <img src="assets/logos/whitelogo@2x.png" alt="" class="fc-crest-head" />
        <span class="fc-crest-text">FC</span>
      </span>
    </span>`;
}

// Título de sección de la portada, igual al del softbol (js/views/home.js).
export function sectionHead(first, accent, bgWord) {
  return `
    <div class="home-section-head">
      <span class="home-bg-word" aria-hidden="true">${bgWord}</span>
      <h2 class="home-title">${first} <span>${accent}</span> <i class="home-slashes" aria-hidden="true">///</i></h2>
    </div>`;
}

function teamRow(logoHtml, name, goals, state) {
  return `
          <span class="score-row${state ? ` score-row--${state}` : ""}">
            ${logoHtml}
            <span class="score-row-name">${escapeHtml(name)}</span>
            ${goals != null ? `<b class="score-row-runs">${goals}</b>` : ""}
          </span>`;
}

const usLogo = () =>
  FC_TEAM.logo
    ? `<img class="score-row-logo" src="${FC_TEAM.logo}" alt="" />`
    : `<i class="score-row-logo score-row-logo--fc"><img src="assets/logos/whitelogo@2x.png" alt="" /></i>`;
const rivalLogo = (opponent) => `<i class="score-row-logo score-row-logo--rival">${escapeHtml(rivalInitials(opponent))}</i>`;

function matchTag(m) {
  return [m.matchday ? `Jornada ${m.matchday}` : "", m.venue ?? ""].filter(Boolean).map(escapeHtml).join(" · ") || "Fútbol";
}

// Tarjeta de un partido (jugado o próximo).
export function matchCardHtml(m) {
  const link = `#/partidos/${encodeURIComponent(m.id)}`;
  if (!isPlayed(m)) {
    const [time, ampm] = m.time ? formatGameTime(m.time).split(" ") : ["", ""];
    return `
        <a class="score-card score-card--next" href="${link}">
          <span class="score-card-top">
            <span class="score-card-status">Próximo</span>
            <span>${escapeHtml(fmtDate(m.date))}</span>
          </span>
          <span class="score-card-body">
            <span class="score-card-rows">
              ${teamRow(usLogo(), FC_TEAM.name)}
              ${teamRow(rivalLogo(m.opponent), m.opponent ?? "Rival")}
            </span>
            ${time ? `<span class="score-card-time"><b>${time}</b><small>${ampm ?? ""}</small></span>` : ""}
          </span>
          <span class="score-card-foot">
            <span>${matchTag(m)}</span>
            <span class="score-card-cta">Ver partido <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
          </span>
        </a>`;
  }
  const r = matchResult(m);
  const us = r === "W" ? "win" : r === "L" ? "lose" : "";
  const them = r === "L" ? "win" : r === "W" ? "lose" : "";
  return `
        <a class="score-card score-card--${r}" href="${link}">
          <span class="score-card-top">
            <span class="score-card-status">${RESULT_LABEL[r]}</span>
            <span>${escapeHtml(fmtDate(m.date))}</span>
          </span>
          <span class="score-card-body">
            <span class="score-card-rows">
              ${teamRow(usLogo(), FC_TEAM.name, m.goalsFor, us)}
              ${teamRow(rivalLogo(m.opponent), m.opponent ?? "Rival", m.goalsAgainst, them)}
            </span>
          </span>
          <span class="score-card-foot">
            <span>${matchTag(m)}</span>
            <span class="score-card-cta">Ver partido <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
          </span>
        </a>`;
}

// Aviso para cuando una sección todavía no tiene datos capturados.
export function emptyState(icon, text) {
  return `<div class="fc-empty"><i class="fa-solid ${icon}" aria-hidden="true"></i><p>${text}</p></div>`;
}
