// Playlist del equipo: todas las canciones de entrada (walk-up songs) en un
// solo lugar. Pública (no depende de sesión) — mismo dato que ya se ve en
// cada perfil individual, aquí nomás juntado. Progresivo, como el resto del
// sitio: primero pinta con lo fijo de data.js, y en cuanto llegan las
// personalizadas de Supabase (getAllWalkupOverrides) se repinta con esas.
import { PLAYERS } from "../data.js";
import { heading, renderAvatar, renderWalkup } from "../ui.js";
import { getAllWalkupOverrides } from "../db.js";

function playlistRow(player, walkup) {
  return `
    <div class="playlist-row">
      <a href="#/jugador/${player.id}" class="playlist-player">
        ${renderAvatar(player, 44)}
        <span class="playlist-name">#${player.number ?? "-"} ${player.name}</span>
      </a>
      ${renderWalkup(walkup)}
    </div>
  `;
}

export function renderPlaylist(container) {
  heading(container, "Playlist del equipo");

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.textContent = "Las canciones de entrada de todo el equipo, en un solo lugar.";
  container.appendChild(subtitle);

  const listEl = document.createElement("div");
  listEl.className = "playlist-list";
  container.appendChild(listEl);

  // Solo se listan quienes de verdad tienen canción — un roster completo
  // con la mitad diciendo "sin canción todavía" sería puro ruido en una
  // playlist.
  function draw(walkupMap) {
    const rows = PLAYERS.map((p) => ({ player: p, walkup: walkupMap.get(p.id) ?? p.walkup })).filter(
      (r) => r.walkup?.title
    );
    listEl.innerHTML =
      rows.length > 0
        ? rows.map((r) => playlistRow(r.player, r.walkup)).join("")
        : '<p class="subtitle">Nadie ha registrado su canción de entrada todavía.</p>';
  }

  draw(new Map());

  getAllWalkupOverrides().then((overrides) => {
    if (overrides.size === 0) return;
    draw(overrides);
  });
}
