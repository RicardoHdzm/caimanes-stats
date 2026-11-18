// Pantalla de "Cargando" al cambiar de deporte (softbol ↔ fútbol).
//
// Los links que cambian de deporte llevan data-sport-switch="softbol" o
// "futbol" (selector de la portada, botón del header, menú ☰ y footer). Al
// darles clic:
//   1. aparece .sport-loader (está en index.html y fc.html, oculto) con el
//      logo del deporte al que vas — se muestra con html[data-switch];
//   2. se navega. Si es otra página (index.html ↔ fc.html), se deja el aviso
//      en sessionStorage y el script del <head> de la página nueva vuelve a
//      poner html[data-switch] ANTES de pintar nada, así la pantalla de carga
//      sigue ahí sin corte;
//   3. cuando la vista ya se pintó (evento "caimanes:rendered" que dispara el
//      render() de js/main.js y js/fc/main.js) se desvanece.
const KEY = "caimanes-switch";
const SPORTS = new Set(["softbol", "futbol"]);
const root = document.documentElement;

// Tiempo mínimo en pantalla (desde que se abrió la página o se hizo clic),
// para que no sea un parpadeo; fundido de salida; y un tope por si algo
// nunca termina de pintar.
const MIN_MS = 700;
const FADE_MS = 350;
const MAX_MS = 6000;
// Lo que tarda en aparecer el velo antes de navegar (ver .sport-loader).
const ENTER_MS = 300;

let shownAt = 0;

function hide() {
  if (!root.dataset.switch || root.dataset.switchOut) return;
  root.dataset.switchOut = "1";
  setTimeout(() => {
    delete root.dataset.switch;
    delete root.dataset.switchOut;
    delete root.dataset.switchIn;
  }, FADE_MS);
}

// Espera el siguiente render y el tiempo mínimo; luego se quita.
function hideAfterRender() {
  const done = () => setTimeout(hide, Math.max(0, MIN_MS - (performance.now() - shownAt)));
  window.addEventListener("caimanes:rendered", done, { once: true });
  setTimeout(hide, MAX_MS);
}

function show(sport) {
  delete root.dataset.switchOut;
  root.dataset.switchIn = "1";
  root.dataset.switch = sport;
  shownAt = performance.now();
}

export function initSportSwitch() {
  // Llegando de la otra página: el <head> ya puso html[data-switch].
  if (root.dataset.switch) {
    shownAt = 0; // cuenta desde que empezó a cargar la página
    hideAfterRender();
  }

  document.addEventListener("click", (e) => {
    const link = e.target.closest?.("a[data-sport-switch]");
    if (!link) return;
    // Ctrl/Cmd/Shift + clic o clic medio: nueva pestaña, sin pantalla.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const sport = link.dataset.sportSwitch;
    if (!SPORTS.has(sport)) return;
    e.preventDefault();

    const url = new URL(link.href, location.href);
    const samePage = url.pathname === location.pathname && url.search === location.search;
    show(sport);
    if (samePage && url.hash === location.hash) {
      // Ya estás ahí: no habrá render nuevo, solo el tiempo mínimo.
      setTimeout(hide, MIN_MS);
      return;
    }
    if (samePage) {
      hideAfterRender();
    } else {
      try {
        sessionStorage.setItem(KEY, sport);
      } catch {
        // Sin sessionStorage la página nueva arranca sin pantalla; igual navega.
      }
    }
    setTimeout(() => {
      location.href = url.href;
    }, ENTER_MS);
  });

  // Regresando con "atrás" a una página guardada en memoria (bfcache): se
  // quedó con la pantalla puesta del clic de antes — se quita.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      delete root.dataset.switch;
      delete root.dataset.switchOut;
      delete root.dataset.switchIn;
    }
  });
}
