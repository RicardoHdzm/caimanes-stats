// Tema claro/oscuro. El oscuro es el de siempre (default, sin atributo); el
// claro se activa con [data-theme="light"] en <html> (ver css/styles.css).
// El botón vive en index.html (junto al ícono de Instagram) — admin.html y
// lineup/index.html no lo tienen, pero si el tema guardado es "claro" lo
// respetan igual (cada uno trae su propio script inline en <head> que lo
// aplica antes de que cargue el CSS, para no parpadear oscuro-y-luego-claro;
// ver ese script en cada archivo .html).
//
// El interruptor (sol/luna, círculo que se desliza) es puro CSS: los dos
// íconos y el círculo ya están en el HTML siempre, y su color/posición
// cambian solos con el selector [data-theme="light"] — aquí solo se pone y
// quita ese atributo, y se actualiza el aria-label para lectores de pantalla.
const STORAGE_KEY = "caimanes-theme";

function applyTheme(theme) {
  if (theme === "light") {
    document.documentElement.dataset.theme = "light";
  } else {
    delete document.documentElement.dataset.theme;
  }
  document
    .getElementById("theme-toggle")
    ?.setAttribute("aria-label", theme === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro");
}

// Se llama una vez desde js/main.js al arrancar. No hace nada si la página
// no trae el botón (admin.html, lineup/).
export function initTheme() {
  applyTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");

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
