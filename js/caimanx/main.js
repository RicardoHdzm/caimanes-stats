// Secciones de caimanx.html que salen de js/caimanx/data.js: redes,
// jugadores, juegos y torneos. Los overlays van aparte (overlays.js).
import { LINKS, PLAYERS, GAMES, TOURNAMENTS } from "./data.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const SOCIAL_ICONS = {
  instagram: ["Instagram", "fa-instagram"],
  twitch: ["Twitch", "fa-twitch"],
  youtube: ["YouTube", "fa-youtube"],
  tiktok: ["TikTok", "fa-tiktok"],
  kick: ["Kick", "fa-kickstarter-k"],
};

function socials() {
  document.getElementById("cx-socials").innerHTML = Object.entries(LINKS)
    .filter(([key, url]) => url && SOCIAL_ICONS[key])
    .map(([key, url]) => {
      const [label, icon] = SOCIAL_ICONS[key];
      return `<a class="cx-social" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}"><i class="fa-brands ${icon}"></i></a>`;
    })
    .join("");
}

const empty = (msg) => `<p class="cx-empty">${msg}</p>`;

function players() {
  const el = document.getElementById("cx-players");
  if (PLAYERS.length === 0) {
    el.innerHTML = empty("Todavía no hay jugadores en la lista.");
    return;
  }
  el.innerHTML = `<div class="cx-players">${PLAYERS.map(
    (p) => `
      <article class="cx-player">
        <h3 class="cx-player-tag">${esc(p.tag)}</h3>
        ${p.name ? `<p class="cx-player-name">${esc(p.name)}</p>` : ""}
        ${p.games?.length ? `<div class="cx-chips">${p.games.map((g) => `<span class="cx-chip">${esc(g)}</span>`).join("")}</div>` : ""}
        ${p.twitch ? `<a class="cx-player-link" href="${esc(p.twitch)}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-twitch"></i> Twitch</a>` : ""}
      </article>`
  ).join("")}</div>`;
}

function games() {
  const el = document.getElementById("cx-games");
  if (GAMES.length === 0) {
    el.innerHTML = empty("Todavía no hay juegos en la lista.");
    return;
  }
  el.innerHTML = `<div class="cx-games">${GAMES.map(
    (g) => `
      <a class="cx-game" href="#overlay-${esc(g.overlay)}">
        <span class="cx-game-name">${esc(g.name)}</span>
        <span class="cx-game-link">Overlay <i class="fa-solid fa-arrow-right"></i></span>
      </a>`
  ).join("")}</div>`;
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? esc(iso) : d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function tournaments() {
  const el = document.getElementById("cx-tournaments");
  if (TOURNAMENTS.length === 0) {
    el.innerHTML = empty("Todavía no hay torneos registrados.");
    return;
  }
  el.innerHTML = `<div class="cx-tournaments">${TOURNAMENTS.map(
    (t) => `
      <div class="cx-tournament">
        <span class="cx-tournament-date">${formatDate(t.date)}</span>
        <span class="cx-tournament-name">${esc(t.name)}<small>${esc(t.game)}</small></span>
        <span class="cx-tournament-result${t.result ? "" : " is-pending"}">${t.result ? esc(t.result) : "Por jugar"}</span>
      </div>`
  ).join("")}</div>`;
}

socials();
players();
games();
tournaments();
