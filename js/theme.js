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
//
// En celular ese interruptor se esconde (ver @media en css/styles.css) y su
// lugar lo toma #more-tile-theme, un tile más dentro del menú de "apps" de
// js/main.js — mismo ciclo, un solo ícono que va cambiando en vez del
// círculo deslizante (no hay espacio para ese widget dentro de un tile
// cuadrado). Ambos controles, si están presentes, avanzan el mismo ciclo.
const STORAGE_KEY = "caimanes-theme";
const THEMES = ["light", "eclipse", "dark"];
const THEME_LABEL = { light: "Sol", eclipse: "Eclipse", dark: "Luna" };
const THEME_ICON = { light: "fa-sun", eclipse: "fa-circle-half-stroke", dark: "fa-moon" };

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

  const mobileIcon = document.getElementById("more-tile-theme-icon");
  if (mobileIcon) {
    mobileIcon.className = `fa-solid ${THEME_ICON[theme]}`;
  }
  document.getElementById("more-tile-theme")?.setAttribute("aria-label", `Tema: ${THEME_LABEL[theme]} — toca para cambiar`);
}

function advanceTheme() {
  const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
  applyTheme(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Sin localStorage (modo privado, etc.) el cambio sigue funcionando,
    // solo no se recuerda la próxima vez que abran el sitio.
  }
}

// Se llama una vez desde js/main.js al arrancar. No hace nada si la página
// no trae el botón (admin.html, lineup/). #more-tile-theme vive dentro del
// menú de "apps" (ver moreSheet.innerHTML en js/main.js), que se reconstruye
// una sola vez al arrancar igual que el botón de escritorio — por eso basta
// con conectar el listener aquí también, una sola vez.
export function initTheme() {
  applyTheme(currentTheme());
  document.getElementById("theme-toggle")?.addEventListener("click", advanceTheme);
  document.getElementById("more-tile-theme")?.addEventListener("click", advanceTheme);
}
