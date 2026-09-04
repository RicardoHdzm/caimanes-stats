// Tres temas: Sol (claro, [data-theme="light"]), Eclipse (navy clásico,
// [data-theme="eclipse"]) y Luna (oscuro, el de siempre — default, sin
// atributo). El botón vive en index.html (junto al ícono de Instagram) —
// admin.html y lineup/index.html no lo tienen, pero si el tema guardado es
// otro que Luna lo respetan igual (cada uno trae su propio script inline en
// <head> que lo aplica antes de que cargue el CSS, para no parpadear con el
// tema por default y luego cambiar; ver ese script en cada archivo .html).
//
// El interruptor (sol → eclipse → luna, círculo que se desliza) es puro
// CSS: los tres íconos y el círculo ya están en el HTML siempre, y su
// color/posición cambian solos con el selector [data-theme] (ver
// css/styles.css) — aquí solo se pone y quita ese atributo, y se actualiza
// el aria-label. Un clic siempre avanza al siguiente tema del ciclo
// (sol → eclipse → luna → sol...).
const STORAGE_KEY = "caimanes-theme";
const THEMES = ["light", "eclipse", "dark"];
const THEME_LABEL = { light: "Sol", eclipse: "Eclipse", dark: "Luna" };

function currentTheme() {
  const attr = document.documentElement.dataset.theme;
  return THEMES.includes(attr) ? attr : "dark";
}

function applyTheme(theme) {
  if (theme === "dark") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  document.getElementById("theme-toggle")?.setAttribute("aria-label", `Tema: ${THEME_LABEL[theme]} — clic para cambiar`);
}

// Se llama una vez desde js/main.js al arrancar. No hace nada si la página
// no trae el botón (admin.html, lineup/).
export function initTheme() {
  applyTheme(currentTheme());

  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin localStorage (modo privado, etc.) el cambio sigue funcionando,
      // solo no se recuerda la próxima vez que abran el sitio.
    }
  });
}
