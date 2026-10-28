// Playlist del equipo: todas las canciones de entrada (walk-up songs) en un
// solo lugar. Pública (antes era solo con sesión; sin Supabase ya no hay
// cuentas) — mismo dato que la canción de cada quien en su perfil (ver
// js/views/jugador.js), aquí nomás juntado. Progresivo, como el resto del
// sitio: primero pinta con lo fijo de data.js, y si llegan personalizadas
// de Supabase (getAllWalkupOverrides) se repinta con esas. Solo salen las
// canciones reales (ver hasRealWalkup en js/ui.js).
import { ROSTER } from "../data.js";
import { heading, renderAvatar, renderSortableTable, escapeHtml, safeWalkupUrl, hasRealWalkup } from "../ui.js";
import { getAllWalkupOverrides, getAvatarUrl } from "../db.js";

// El link real de Spotify/YouTube/etc. si hay uno válido; sin link, el
// botón se ve pero no hace nada (no hay a dónde mandarlo). Compartido entre
// la tabla de arriba y las tarjetas de abajo, `cls` es la clase base de
// cada una (mismo look, tamaño distinto por CSS).
function playButtonHtml(walkup, cls) {
  const parsed = safeWalkupUrl(walkup.url);
  return parsed
    ? `<a class="${cls}" href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer" aria-label="Reproducir"><i class="fa-solid fa-circle-play"></i></a>`
    : `<span class="${cls} ${cls}--disabled" aria-hidden="true"><i class="fa-solid fa-circle-play"></i></span>`;
}

// Tarjeta: foto, jugador, canción, artista y el botón de play — de QUIÉN es
// cada canción, con foto (la tabla de arriba también dice de quién es, pero
// en una columna de texto).
function playlistCard(player, walkup) {
  const artist = walkup.artist ? `<p class="playlist-card-artist">${escapeHtml(walkup.artist)}</p>` : "";
  return `
    <div class="playlist-card">
      <a href="#/jugador/${player.id}" class="playlist-card-avatar" data-avatar="${player.id}">${renderAvatar(player, 72)}</a>
      <div class="playlist-card-body">
        <a href="#/jugador/${player.id}" class="playlist-card-name">#${player.number ?? "-"} ${escapeHtml(player.name)}</a>
        <p class="playlist-card-title">${escapeHtml(walkup.title)}</p>
        ${artist}
      </div>
      ${playButtonHtml(walkup, "playlist-card-play")}
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

const TRACK_COLUMNS = [
  { key: "track", label: "#", numeric: true },
  {
    key: "player",
    label: "Jugador",
    render: (_, row) => `<a href="#/jugador/${row.playerId}" class="playlist-track-player">${escapeHtml(row.player)}</a>`,
  },
  { key: "title", label: "Canción" },
  { key: "artist", label: "Artista" },
  { key: "play", label: "", render: (_, row) => playButtonHtml(row.walkup, "playlist-track-play") },
];

export function renderPlaylist(container) {
  heading(container, "Playlist del equipo");

  const tableEl = document.createElement("div");
  container.appendChild(tableEl);

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
    const rows = ROSTER.map((p) => ({ player: p, walkup: walkupMap.get(p.id) ?? p.walkup })).filter((r) =>
      hasRealWalkup(r.walkup)
    );

    if (rows.length === 0) {
      tableEl.innerHTML = "";
      listEl.innerHTML = '<p class="subtitle">Nadie ha registrado su canción de entrada todavía.</p>';
      return;
    }

    // La tabla de arriba (la playlist en sí, numerada) — orden fijo: el
    // mismo en el que aparecen en el roster, no se reordena solo (no es
    // sortable, ver renderSortableTable). Track number = su lugar en esta
    // lista, no un dato guardado en ningún lado.
    renderSortableTable(tableEl, {
      columns: TRACK_COLUMNS,
      rows: rows.map((r, i) => ({ track: i + 1, title: r.walkup.title, artist: r.walkup.artist ?? "", player: r.player.name, playerId: r.player.id, walkup: r.walkup })),
      sortable: false,
      defaultSort: "track",
      defaultDir: 1,
    });

    listEl.innerHTML = rows.map((r) => playlistCard(r.player, r.walkup)).join("");
    hydrateAvatars(listEl);
  }

  draw(new Map());

  getAllWalkupOverrides().then((overrides) => {
    if (overrides.size === 0) return;
    draw(overrides);
  });
}
