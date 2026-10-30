// Playlist del equipo: todas las canciones de entrada (walk-up songs) en un
// solo lugar. Pública (antes era solo con sesión; sin Supabase ya no hay
// cuentas) — mismo dato que la canción de cada quien en su perfil (ver
// js/views/jugador.js), aquí nomás juntado. Progresivo, como el resto del
// sitio: primero pinta con lo fijo de data.js, y si llegan personalizadas
// de Supabase (getAllWalkupOverrides) se repinta con esas. Solo salen las
// canciones reales (ver hasRealWalkup en js/ui.js).
import { ROSTER } from "../data.js";
import { heading, renderAvatar, escapeHtml, safeWalkupUrl, hasRealWalkup } from "../ui.js";
import { getAllWalkupOverrides, getAvatarUrl } from "../db.js";

// El link real de Spotify/YouTube/etc. si hay uno válido; sin link, el
// botón se ve pero no hace nada (no hay a dónde mandarlo).
function playButtonHtml(walkup) {
  const parsed = safeWalkupUrl(walkup.url);
  return parsed
    ? `<a class="playlist-card-play" href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer" aria-label="Reproducir"><i class="fa-solid fa-circle-play"></i></a>`
    : `<span class="playlist-card-play playlist-card-play--disabled" aria-hidden="true"><i class="fa-solid fa-circle-play"></i></span>`;
}

// Buscador: cada palabra escrita debe ser el inicio de una palabra del nombre
// o del número, sin importar acentos ni mayúsculas ("munoz", "lu fe", "21").
const normalizeText = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function matchesPlayer(player, query) {
  const tokens = normalizeText(query).replace(/#/g, "").split(/s+/).filter(Boolean);
  const words = normalizeText(`${player.number ?? ""} ${player.name}`).split(/s+/);
  return tokens.every((t) => words.some((w) => w.startsWith(t)));
}

// Tarjeta: foto, jugador, canción, artista y el botón de play.
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
      ${playButtonHtml(walkup)}
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

  const search = document.createElement("label");
  search.className = "playlist-search";
  search.innerHTML = `
    <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
    <input type="search" placeholder="Buscar jugador" aria-label="Buscar jugador" autocomplete="off" enterkeyhint="go" />
  `;
  container.appendChild(search);
  const input = search.querySelector("input");

  const listEl = document.createElement("div");
  listEl.className = "playlist-grid";
  container.appendChild(listEl);

  // Solo se listan quienes de verdad tienen canción — un roster completo
  // con la mitad diciendo "sin canción todavía" sería puro ruido en una
  // playlist.
  let rows = [];

  function drawCards() {
    if (rows.length === 0) {
      listEl.innerHTML = '<p class="subtitle">Nadie ha registrado su canción de entrada todavía.</p>';
      return;
    }
    const shown = rows.filter((r) => matchesPlayer(r.player, input.value));
    listEl.innerHTML = shown.length
      ? shown.map((r) => playlistCard(r.player, r.walkup)).join("")
      : '<p class="subtitle">Ningún jugador coincide con la búsqueda.</p>';
    hydrateAvatars(listEl);
  }

  function draw(walkupMap) {
    rows = ROSTER.map((p) => ({ player: p, walkup: walkupMap.get(p.id) ?? p.walkup })).filter((r) =>
      hasRealWalkup(r.walkup)
    );
    drawCards();
  }

  input.addEventListener("input", drawCards);
  // Enter pone la canción del primer resultado, para no tener que ir por el
  // botón en pleno juego.
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    listEl.querySelector("a.playlist-card-play")?.click();
  });

  draw(new Map());

  getAllWalkupOverrides().then((overrides) => {
    if (overrides.size === 0) return;
    draw(overrides);
  });

  // Listo para escribir en computadora; en celular no, para que no salte el
  // teclado apenas se abre la página.
  if (matchMedia("(hover: hover)").matches) input.focus();
}
