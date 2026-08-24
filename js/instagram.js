// Feed de Instagram vía el embed oficial (el mismo que da el botón "..." →
// Insertar de un post). No hay API key ni token: se procesa client-side y
// necesita cargar un script desde instagram.com, así que a diferencia del
// resto del sitio ESTA parte no funciona sin internet.

const EMBED_SCRIPT_SRC = "https://www.instagram.com/embed.js";

// El script solo se inyecta una vez; se reutiliza la misma promesa aunque el
// usuario navegue fuera de Resumen y regrese (el <script> vive en <head>, que
// el router nunca limpia — solo vacía #app).
let scriptPromise = null;

function ensureEmbedScript() {
  if (window.instgrm) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = EMBED_SCRIPT_SRC;
      // Sin internet el script nunca carga: se resuelve igual para no dejar
      // la promesa colgada — los blockquotes se quedan en su estado de
      // respaldo (el link plano de abajo) en vez de convertirse en tarjeta.
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

function escapeAttr(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// urls: arreglo de links a posts de Instagram (INSTAGRAM_POSTS en data.js).
// Sin posts, no se pinta nada — así el Resumen no muestra una sección vacía.
export function renderInstagramFeed(container, urls) {
  if (urls.length === 0) return;

  const wrap = document.createElement("div");
  wrap.className = "instagram-feed";
  wrap.innerHTML = urls
    .map(
      (url) => `
      <blockquote class="instagram-media" data-instgrm-permalink="${escapeAttr(url)}" data-instgrm-version="14">
        <a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" class="instagram-fallback-link">
          <i class="fa-brands fa-instagram"></i> Ver publicación
        </a>
      </blockquote>
    `
    )
    .join("");
  container.appendChild(wrap);

  // Los blockquotes ya están en el DOM; falta que embed.js los convierta en
  // las tarjetas reales. Si window.instgrm ya existía (segunda visita a la
  // vista), process() corre de inmediato.
  ensureEmbedScript().then(() => window.instgrm?.Embeds.process());
}
