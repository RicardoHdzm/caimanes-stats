// Minireproductor flotante (mismo comportamiento que el de la app de
// Yazric): al darle play a una canción se abre abajo con el video/reproductor
// del servicio, y sigue sonando aunque cambies de sección — vive en <body>,
// fuera de #app, así que el router no lo borra. Con cola (la lista de la
// Playlist), ⏮ ⏭ recorren esa lista. Si el link no se puede incrustar, se
// abre afuera en otra pestaña, como antes.
import { escapeHtml } from "./ui.js";

// "1m30s", "90s" o "90" → segundos (el ?t= de los links de YouTube).
function parseStart(t) {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

// Link de la canción → { src, video, service } para el iframe, o null si
// ese servicio no deja ponerlo dentro del sitio.
export function embedFor(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^(www|m)\./, "");

  // YouTube y YouTube Music: watch?v=ID, youtu.be/ID, shorts/ID, live/ID.
  // Respeta el ?t= del link, para arrancar en la parte buena de la canción.
  if (host === "youtube.com" || host === "music.youtube.com" || host === "youtu.be") {
    const id = host === "youtu.be" ? u.pathname.slice(1).split("/")[0] : u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    const start = parseStart(u.searchParams.get("t") ?? u.searchParams.get("start"));
    return {
      src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0${start ? `&start=${start}` : ""}`,
      video: true,
      service: host === "music.youtube.com" ? "YouTube Music" : "YouTube",
    };
  }

  // Spotify: open.spotify.com/(intl-es/)track/ID
  if (host === "open.spotify.com") {
    const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
    if (!m) return null;
    return {
      src: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`,
      uri: `spotify:${m[1]}:${m[2]}`,
      height: 152,
      service: "Spotify",
    };
  }

  // Apple Music: el mismo link en embed.music.apple.com
  if (host === "music.apple.com") {
    return { src: `https://embed.music.apple.com${u.pathname}${u.search}`, height: 175, service: "Apple Music" };
  }

  if (host === "soundcloud.com") {
    return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.href)}&auto_play=true&visual=false`, height: 166, service: "SoundCloud" };
  }

  return null;
}

// track: { id, url, title, artist?, who? }  (who = quién la usa, ej. "#24 Ricardo")
let current = null;
let queue = [];
let small = false;
let root = null;

export function currentTrackId() {
  return current?.id ?? null;
}

function notify() {
  window.dispatchEvent(new CustomEvent("caimanes:miniplayer", { detail: { id: currentTrackId() } }));
}

function ensureRoot() {
  if (root) return root;
  root = document.createElement("div");
  root.className = "mini-player";
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "Reproductor");
  root.hidden = true;
  document.body.appendChild(root);
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mp]");
    if (!btn) return;
    const action = btn.dataset.mp;
    if (action === "prev") move(-1);
    else if (action === "next") move(1);
    else if (action === "size") {
      small = !small;
      render(false);
    } else if (action === "close") close();
  });
  return root;
}

const iframeHtml = (embed, track) => `
  <iframe src="${escapeHtml(embed.src)}" title="Reproductor: ${escapeHtml(track.title)}"
    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    ${embed.video ? 'class="is-video"' : `style="height:${embed.height}px"`}></iframe>`;

// Spotify: con su iFrame API oficial (en vez del <iframe> pelón) se le
// puede dar play desde aquí, así suena con un solo toque. Sin ella (no
// cargó, bloqueada) cae al <iframe> normal y hay que darle play adentro.
// Sin sesión de Spotify suena la muestra de 30 s — justo lo que dura ir a
// batear (a propósito).
let spotifyApi = null;
let spotifyController = null;

export function loadSpotifyApi() {
  if (!spotifyApi) {
    spotifyApi = new Promise((resolve, reject) => {
      window.onSpotifyIframeApiReady = resolve;
      const s = document.createElement("script");
      s.src = "https://open.spotify.com/embed/iframe-api/v1";
      s.async = true;
      s.onerror = () => {
        spotifyApi = null;
        reject(new Error("Spotify iFrame API"));
      };
      document.head.appendChild(s);
    });
  }
  return spotifyApi;
}

function destroySpotify() {
  try {
    spotifyController?.destroy();
  } catch {
    // ya no estaba en la página
  }
  spotifyController = null;
}

function mountSpotify(frame, embed, track) {
  const slot = document.createElement("div");
  frame.appendChild(slot);
  const fallback = () => {
    if (current === track && frame.isConnected) frame.innerHTML = iframeHtml(embed, track);
  };
  const timer = setTimeout(fallback, 6000);
  loadSpotifyApi()
    .then((api) => {
      // Ya cambiaron de canción (o cerraron) mientras cargaba.
      if (current !== track || !slot.isConnected) return clearTimeout(timer);
      api.createController(slot, { uri: embed.uri, width: "100%", height: embed.height }, (controller) => {
        clearTimeout(timer);
        if (current !== track) return controller.destroy();
        spotifyController = controller;
        controller.addListener("ready", () => controller.play());
      });
    })
    .catch(() => {
      clearTimeout(timer);
      fallback();
    });
}

const iconBtn = (action, icon, label) =>
  `<button type="button" class="mini-player-btn" data-mp="${action}" aria-label="${label}" title="${label}"><i class="fa-solid ${icon}"></i></button>`;

// reload=false: solo cambia la barra (minimizar) sin recargar el iframe,
// para que la música no se corte.
function render(reload = true) {
  const el = ensureRoot();
  if (!current) {
    destroySpotify();
    el.hidden = true;
    el.innerHTML = "";
    document.body.classList.remove("mini-player-open");
    return;
  }
  const embed = embedFor(current.url);
  const many = queue.length > 1;
  const sub = [current.artist, current.who].filter(Boolean).map(escapeHtml).join(" · ");
  const bar = `
    <div class="mini-player-bar">
      <span class="mini-player-eq" aria-hidden="true"><i></i><i></i><i></i></span>
      <div class="mini-player-info">
        <p class="mini-player-title">${escapeHtml(current.title)}</p>
        ${sub ? `<p class="mini-player-sub">${sub}</p>` : ""}
      </div>
      ${many ? iconBtn("prev", "fa-backward-step", "Anterior") + iconBtn("next", "fa-forward-step", "Siguiente") : ""}
      ${iconBtn("size", small ? "fa-chevron-up" : "fa-chevron-down", small ? "Mostrar reproductor" : "Hacer chico")}
      ${iconBtn("close", "fa-xmark", "Cerrar reproductor")}
    </div>`;

  if (reload || !el.querySelector(".mini-player-frame")) {
    destroySpotify();
    el.innerHTML = `${bar}<div class="mini-player-frame"></div>`;
    const frame = el.querySelector(".mini-player-frame");
    if (embed.uri) mountSpotify(frame, embed, current);
    else frame.innerHTML = iframeHtml(embed, current);
  } else {
    el.querySelector(".mini-player-bar").outerHTML = bar;
  }
  // Al hacerlo chico solo se esconde el video: la música sigue.
  el.classList.toggle("is-small", small);
  el.hidden = false;
  document.body.classList.add("mini-player-open");
}

// Pone una canción. Con `list`, ⏮ ⏭ recorren esa lista (solo las que se
// pueden poner aquí). Si el link no se puede incrustar, lo abre afuera.
export function playTrack(track, list) {
  if (!embedFor(track.url)) {
    window.open(track.url, "_blank", "noopener");
    return;
  }
  if (list) queue = list.filter((t) => embedFor(t.url));
  // La misma que ya suena: solo vuelve a mostrar el reproductor si estaba chico.
  if (current?.id === track.id) {
    small = false;
    render(false);
    return;
  }
  current = track;
  small = false;
  render();
  notify();
}

function move(step) {
  if (!current || queue.length < 2) return;
  const i = queue.findIndex((t) => t.id === current.id);
  current = queue[(i + step + queue.length) % queue.length];
  render();
  notify();
}

export function close() {
  current = null;
  render();
  notify();
}
