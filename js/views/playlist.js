// Playlist del equipo: todas las canciones de entrada (walk-up songs) en un
// solo lugar. Pública (no depende de sesión) — mismo dato que ya se ve en
// cada perfil individual, aquí nomás juntado. Progresivo, como el resto del
// sitio: primero pinta con lo fijo de data.js, y en cuanto llegan las
// personalizadas de Supabase (getAllWalkupOverrides) se repinta con esas.
import { PLAYERS } from "../data.js";
import { heading, renderAvatar, renderWalkup } from "../ui.js";
import { getAllWalkupOverrides } from "../db.js";

// El placeholder de PLAYERS[].walkup en data.js ("Canción" / "Artista", sin
// url) es el valor por default de quien todavía no ha puesto la suya — no
// cuenta como canción real. Sin este filtro, la playlist se llenaría de
// filas vacías tipo "Walkup Song: - Canción - Artista" para casi todo el
// roster.
function hasRealWalkup(walkup) {
  if (!walkup?.title) return false;
  if (walkup.title === "Canción" && walkup.artist === "Artista" && !walkup.url) return false;
  return true;
}

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

  // Playlist real de Spotify con todas las canciones — el iframe viene tal
  // cual del botón "Compartir > Insertar" de Spotify, solo envuelto en un
  // contenedor propio para el margen.
  const embedWrap = document.createElement("div");
  embedWrap.className = "playlist-embed";
  embedWrap.innerHTML = `
    <iframe
      data-testid="embed-iframe"
      style="border-radius: 12px"
      src="https://open.spotify.com/embed/playlist/0VxLvZORg84K42UUqv3a2i?utm_source=generator&si=511797c306f74d83"
      width="100%"
      height="352"
      frameBorder="0"
      allowfullscreen=""
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    ></iframe>
  `;
  container.appendChild(embedWrap);

  const listHeading = document.createElement("h3");
  listHeading.textContent = "Canción de cada quien";
  container.appendChild(listHeading);

  const listEl = document.createElement("div");
  listEl.className = "playlist-list";
  container.appendChild(listEl);

  // Solo se listan quienes de verdad tienen canción — un roster completo
  // con la mitad diciendo "sin canción todavía" sería puro ruido en una
  // playlist.
  function draw(walkupMap) {
    const rows = PLAYERS.map((p) => ({ player: p, walkup: walkupMap.get(p.id) ?? p.walkup })).filter((r) =>
      hasRealWalkup(r.walkup)
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
