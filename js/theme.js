// Tema claro/oscuro. El oscuro es el de siempre (default, sin atributo); el
// claro se activa con [data-theme="light"] en <html> (ver css/styles.css).
// El botón vive en index.html (junto al ícono de Instagram) — admin.html y
// lineup/index.html no lo tienen, pero si el tema guardado es "claro" lo
// respetan igual (cada uno trae su propio script inline en <head> que lo
// aplica antes de que cargue el CSS, para no parpadear oscuro-y-luego-claro;
// ver ese script en cada archivo .html).
const STORAGE_KEY = "caimanes-theme";

function updateToggleIcon(theme) {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const icon = btn.querySelector("i");
  if (theme === "light") {
    icon.className = "fa-solid fa-moon";
    btn.setAttribute("aria-label", "Cambiar a tema oscuro");
  } else {
    icon.className = "fa-solid fa-sun";
    btn.setAttribute("aria-label", "Cambiar a tema claro");
  }
}

function applyTheme(theme) {
  if (theme === "light") {
    document.documentElement.dataset.theme = "light";
  } else {
    delete document.documentElement.dataset.theme;
  }
  updateToggleIcon(theme);
}

// Se llama una vez desde js/main.js al arrancar. No hace nada si la página
// no trae el botón (admin.html, lineup/) más allá de dejar el ícono
// correcto si alguna sí lo trajera en el futuro.
export function initTheme() {
  updateToggleIcon(document.documentElement.dataset.theme === "light" ? "light" : "dark");

  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin localStorage (modo privado, etc.) el cambio sigue funcionando,
      // solo no se recuerda la próxima vez que abran el sitio.
    }
  });
}
