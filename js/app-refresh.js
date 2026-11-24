// Botón "Actualizar" junto al menú ☰ — solo en modo app (agregado a la
// pantalla de inicio), donde no hay barra del navegador para recargar ni
// forma de jalar hacia abajo. Fuerza la versión nueva: borra la copia
// guardada del service worker (sw.js), lo da de baja y recarga; al volver
// a cargar, main.js lo registra de nuevo ya con todo fresco. Lo usan
// index.html (js/main.js) y fc.html (js/fc/main.js).
const isApp = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

async function forceRefresh(btn) {
  btn.disabled = true;
  btn.classList.add("is-loading");
  try {
    if ("caches" in window) {
      for (const key of await caches.keys()) await caches.delete(key);
    }
    if ("serviceWorker" in navigator) {
      for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
    }
  } catch {
    // Aunque algo falle, la recarga de abajo igual trae lo más nuevo que se pueda.
  }
  location.reload();
}

export function initAppRefresh() {
  const btn = document.getElementById("app-refresh");
  if (!btn) return;
  btn.hidden = !isApp();
  btn.addEventListener("click", () => forceRefresh(btn));
}
