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
import { playTrack, currentTrackId } from "../miniplayer.js";

// Con link válido, el play abre el minireproductor (ver js/miniplayer.js;
// YouTube, Spotify, Apple Music y SoundCloud suenan aquí mismo, lo demás se
// abre afuera). Sin link, el botón se ve pero no hace nada.
function playButtonHtml(player, walkup) {
  if (!safeWalkupUrl(walkup.url)) {
    return `<span class="playlist-card-play playlist-card-play--disabled" aria-hidden="true"><i class="fa-solid fa-circle-play"></i></span>`;
  }
  const playing = currentTrackId() === player.id;
  return `<button type="button" class="playlist-card-play${playing ? " is-playing" : ""}" data-play="${player.id}" aria-label="${playing ? "Sonando" : "Reproducir"}: ${escapeHtml(walkup.title)}">
      <i class="fa-solid fa-circle-play"></i><span class="playlist-card-eq" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>`;
}

// Lo que necesita el minireproductor de cada fila.
const toTrack = (r) => ({
  id: r.player.id,
  url: r.walkup.url,
  title: r.walkup.title,
  artist: r.walkup.artist,
  who: `#${r.player.number || "-"} ${r.player.name}`,
});

// Buscador: cada palabra escrita debe ser el inicio de una palabra del nombre
// o del número, sin importar acentos ni mayúsculas ("munoz", "lu fe", "21").
const normalizeText = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function matchesPlayer(player, query) {
  const tokens = normalizeText(query).replace(/#/g, "").split(/\s+/).filter(Boolean);
  const words = normalizeText(`${player.number ?? ""} ${player.name}`).split(/\s+/);
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
      ${playButtonHtml(player, walkup)}
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
  let shown = [];

  function drawCards() {
    if (rows.length === 0) {
      listEl.innerHTML = '<p class="subtitle">Nadie ha subido su canción de entrada todavía. ¿Quién abre el bat?</p>';
      return;
    }
    shown = rows.filter((r) => matchesPlayer(r.player, input.value));
    listEl.innerHTML = shown.length
      ? shown.map((r) => playlistCard(r.player, r.walkup)).join("")
      : '<p class="subtitle">Ese caimán no está en el roster.</p>';
    hydrateAvatars(listEl);
  }

  function draw(walkupMap) {
    rows = ROSTER.map((p) => ({ player: p, walkup: walkupMap.get(p.id) ?? p.walkup })).filter((r) =>
      hasRealWalkup(r.walkup)
    );
    drawCards();
  }

  // Play: la cola es lo que se ve en ese momento (respeta el buscador).
  function play(id) {
    const row = shown.find((r) => r.player.id === id);
    if (row) playTrack(toTrack(row), shown.filter((r) => safeWalkupUrl(r.walkup.url)).map(toTrack));
  }

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-play]");
    if (btn) play(btn.dataset.play);
  });

  // Marca cuál está sonando sin repintar todo (el reproductor avisa al
  // cambiar de canción, cerrar o avanzar con ⏮ ⏭). Si ya no estás en la
  // Playlist, se suelta solo.
  const onPlayer = (e) => {
    if (!listEl.isConnected) {
      window.removeEventListener("caimanes:miniplayer", onPlayer);
      return;
    }
    listEl.querySelectorAll("[data-play]").forEach((btn) => btn.classList.toggle("is-playing", btn.dataset.play === e.detail.id));
  };
  window.addEventListener("caimanes:miniplayer", onPlayer);

  input.addEventListener("input", drawCards);
  // Enter pone la canción del primer resultado, para no tener que ir por el
  // botón en pleno juego.
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    listEl.querySelector("button.playlist-card-play")?.click();
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
