// Service worker: hace que la página abra sin señal (en el campo casi nunca
// hay datos) sin servir stats viejas cuando sí hay internet.
//
// Estrategia por tipo de archivo:
//   - código y datos (html/js/css): red primero, caché solo si la red falla.
//     Así un push a data.js se ve en cuanto haya señal, no dos visitas después.
//   - imágenes y fuentes: caché primero, porque el logo no cambia.
//
// Al cambiar cualquier archivo del proyecto sube CACHE_VERSION: eso tira la
// caché vieja completa y evita mezclas de versiones.
const CACHE_VERSION = "v75";
const CACHE_NAME = `caimanes-${CACHE_VERSION}`;

// Lo mínimo para que la app arranque estando offline desde cero.
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/main.js",
  "./js/data.js",
  "./js/stats.js",
  "./js/ui.js",
  "./js/charts.js",
  "./js/lineup.js",
  "./js/supabase-config.js",
  "./js/auth.js",
  "./js/db.js",
  "./js/views/resumen.js",
  "./js/views/roster.js",
  "./js/views/bateo.js",
  "./js/views/pitcheo.js",
  "./js/views/fildeo.js",
  "./js/views/juegos.js",
  "./js/views/juego.js",
  "./js/views/jugador.js",
  "./js/views/calendario.js",
  "./js/views/standing.js",
  "./js/views/alineacion.js",
  "./js/views/comparar.js",
  "./js/views/comments.js",
  "./js/views/playlist.js",
  "./assets/logo.png",
  "./assets/fonts/barlow-condensed-600.woff2",
  "./assets/fonts/barlow-condensed-700.woff2",
  "./assets/fonts/barlow-condensed-700-italic.woff2",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // addAll falla completo si un solo archivo falla, así que se cachea uno
      // por uno y los que fallen simplemente se piden a la red después.
      .then((cache) => Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isImageOrFont(request, url) {
  return request.destination === "image" || request.destination === "font" || /\.(png|jpe?g|svg|webp|woff2?)$/i.test(url.pathname);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // `no-cache` obliga a revalidar contra el servidor. Sin esto la caché HTTP
    // del navegador puede devolver el archivo viejo sin preguntar (GitHub
    // Pages manda max-age=600) y "red primero" no serviría de nada: un push a
    // data.js tardaría hasta 10 minutos en verse. No implica volver a
    // descargar: si no cambió, el servidor contesta 304.
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Sin red y sin caché: si venían navegando, al menos devuelve el shell.
    if (request.mode === "navigate") {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Font Awesome viene de un CDN; se deja pasar sin tocar para no cachear
  // respuestas opacas de otro origen.
  if (url.origin !== self.location.origin) return;

  event.respondWith(isImageOrFont(request, url) ? cacheFirst(request) : networkFirst(request));
});
