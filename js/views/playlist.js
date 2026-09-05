// Playlist del equipo: todas las canciones de entrada (walk-up songs) en un
// solo lugar. Pública (no depende de sesión) — mismo dato que ya se ve en
// cada perfil individual, aquí nomás juntado. Progresivo, como el resto del
// sitio: primero pinta con lo fijo de data.js, y en cuanto llegan las
// personalizadas de Supabase (getAllWalkupOverrides) se repinta con esas.
import { PLAYERS } from "../data.js";
import { heading, renderAvatar, escapeHtml, safeWalkupUrl } from "../ui.js";
import { getAllWalkupOverrides, getAvatarUrl } from "../db.js";

// El placeholder de PLAYERS[].walkup en data.js ("Canción" / "Artista", sin
// url) es el valor por default de quien todavía no ha puesto la suya — no
// cuenta como canción real. Sin este filtro, la playlist se llenaría de
// tarjetas vacías tipo "Canción" / "Artista" para casi todo el roster.
function hasRealWalkup(walkup) {
  if (!walkup?.title) return false;
  if (walkup.title === "Canción" && walkup.artist === "Artista" && !walkup.url) return false;
  return true;
}

// Tarjeta: foto, jugador, canción, artista y un botón de play — el link
// real de Spotify/YouTube/etc. si hay uno válido; sin link, el botón se ve
// pero no hace nada (no hay a dónde mandarlo).
function playlistCard(player, walkup) {
  const parsed = safeWalkupUrl(walkup.url);
  const artist = walkup.artist ? `<p class="playlist-card-artist">${escapeHtml(walkup.artist)}</p>` : "";
  const playButton = parsed
    ? `<a class="playlist-card-play" href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer" aria-label="Reproducir"><i class="fa-solid fa-circle-play"></i></a>`
    : `<span class="playlist-card-play playlist-card-play--disabled" aria-hidden="true"><i class="fa-solid fa-circle-play"></i></span>`;

  return `
    <div class="playlist-card">
      <a href="#/jugador/${player.id}" class="playlist-card-avatar" data-avatar="${player.id}">${renderAvatar(player, 72)}</a>
      <div class="playlist-card-body">
        <a href="#/jugador/${player.id}" class="playlist-card-name">#${player.number ?? "-"} ${escapeHtml(player.name)}</a>
        <p class="playlist-card-title">${escapeHtml(walkup.title)}</p>
        ${artist}
      </div>
      ${playButton}
    </div>
  `;
}

// Reemplaza el avatar de siempre (foto fija de data.js o iniciales) por la
// foto personalizada de Storage cuando exista — mismo patrón que ya usan
// el perfil individual, Roster, Resumen y el comparador.
async function hydrateAvatars(root) {
  const slots = [...root.querySelectorAll("[data-avatar]")];
  await Promise.all(
    slots.map(async (slot) => {
      const url = await getAvatarUrl(slot.dataset.avatar);
      if (!url) return;
      slot.innerHTML = `<img class="avatar" src="${url}" alt="" style="width:72px;height:72px;font-size:28.8px;">`;
    })
  );
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
  listEl.className = "playlist-grid";
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
        ? rows.map((r) => playlistCard(r.player, r.walkup)).join("")
        : '<p class="subtitle">Nadie ha registrado su canción de entrada todavía.</p>';
    hydrateAvatars(listEl);
  }

  draw(new Map());

  getAllWalkupOverrides().then((overrides) => {
    if (overrides.size === 0) return;
    draw(overrides);
  });
}
