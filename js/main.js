import { TEAM } from "./data.js";
import { renderResumen } from "./views/resumen.js";
import { renderRoster } from "./views/roster.js";
import { renderBateo } from "./views/bateo.js";
import { renderPitcheo } from "./views/pitcheo.js";
import { renderFildeo } from "./views/fildeo.js";
import { renderJuegos } from "./views/juegos.js";
import { renderCalendario } from "./views/calendario.js";
import { renderStanding } from "./views/standing.js";
import { renderAlineacion } from "./views/alineacion.js";
import { renderPlaylist } from "./views/playlist.js";
import { renderJuegoDetalle } from "./views/juego.js";
import { renderJugadorDetalle } from "./views/jugador.js";
import { renderMedallasGuide } from "./views/medallas.js";
import { renderLogin } from "./views/login.js";
import { initAuth, mountAuthControl, getCurrentPlayerId } from "./auth.js";
import { ordinalTemporada } from "./ui.js";
import { initTheme } from "./theme.js";

const routes = {
  resumen: renderResumen,
  roster: renderRoster,
  bateo: renderBateo,
  pitcheo: renderPitcheo,
  fildeo: renderFildeo,
  juegos: renderJuegos,
  calendario: renderCalendario,
  standing: renderStanding,
  alineacion: renderAlineacion,
  playlist: renderPlaylist,
  login: renderLogin,
};

// Barra de pestañas de abajo (solo celular — ver @media en styles.css). La
// nav de arriba sigue intacta y es la real en escritorio; esta es aparte
// porque en 9 rutas no caben cómodas 5 botones de pulgar, así que solo van
// al frente las 4 de "vistazo rápido" y el resto vive detrás de "Más".
const BOTTOM_TABS = [
  { tab: "resumen", route: "#/resumen", label: "Resumen", icon: "fa-house" },
  { tab: "roster", route: "#/roster", label: "Roster", icon: "fa-users" },
  { tab: "juegos", route: "#/juegos", label: "Juegos", icon: "fa-flag-checkered" },
  { tab: "standing", route: "#/standing", label: "Standing", icon: "fa-ranking-star" },
];

// Calendario primero: es lo que más se consulta entre semana. Las 3 tablas
// de stats detalladas (consulta más ocasional) y Alineación van al final.
const MORE_TABS = [
  { tab: "calendario", route: "#/calendario", label: "Calendario", icon: "fa-calendar-day" },
  { tab: "bateo", route: "#/bateo", label: "Bateo", icon: "fa-baseball-bat-ball" },
  { tab: "pitcheo", route: "#/pitcheo", label: "Pitcheo", icon: "fa-baseball" },
  { tab: "fildeo", route: "#/fildeo", label: "Fildeo", icon: "fa-shield" },
  { tab: "alineacion", route: "#/alineacion", label: "Alineación", icon: "fa-clipboard-list" },
  // Playlist: oculta por el momento (a petición) — la ruta en `routes`
  // sigue activa, solo no aparece en el menú "Más" del celular. Descomentar
  // regresa el botón.
  // { tab: "playlist", route: "#/playlist", label: "Playlist", icon: "fa-music" },
];

// Todo lo navegable en celular, para el panel de "Más" — ya no es solo las
// 5 rutas que no caben en la barra de abajo: ahora es una pantalla completa
// tipo "apps del celular" con TODO, incluidas Resumen/Mi Perfil/Roster/
// Juegos/Standing (que ya están abajo, pero repetidas aquí no estorban y
// así "Más" es de verdad un mapa completo del sitio). Se arma recorriendo
// BOTTOM_TABS en vez de copiarlo a mano, para no desincronizarse si cambia
// esa lista — mismo criterio (buscar "resumen" por tab, no por posición)
// que ya usa buildBottomTabs() de abajo para insertar Mi Perfil.
const APPS_GRID = [];
for (const t of BOTTOM_TABS) {
  APPS_GRID.push(t);
  if (t.tab === "resumen") {
    APPS_GRID.push({ tab: "mi-perfil", route: "#", label: "Mi Perfil", icon: "fa-id-card" });
  }
}
APPS_GRID.push(...MORE_TABS);

const app = document.getElementById("app");
const tabs = document.getElementById("tabs");
const miPerfilLink = document.getElementById("nav-mi-perfil");
const bottomTabs = document.getElementById("bottom-tabs");
const moreSheet = document.getElementById("more-sheet");

document.getElementById("season-label").textContent =
  `${TEAM.league} ${ordinalTemporada(TEAM.seasonsInLeague)} Temporada - ${ordinalTemporada(TEAM.seasonsTotal)} Temporada`;

document.getElementById("footer-year").textContent = new Date().getFullYear();

function currentRoute() {
  const hash = location.hash.replace(/^#\//, "");
  const [first, second, third] = hash.split("/");
  if (first === "juegos" && second) {
    return { tab: "juegos", render: (container) => renderJuegoDetalle(container, second) };
  }
  if (first === "jugador" && second) {
    // Tu propio perfil resalta la pestaña "Mi Perfil" (ver #nav-mi-perfil
    // más abajo) en vez de "Roster" — el perfil de cualquier otro jugador
    // sigue resaltando Roster, de donde normalmente se llega a él.
    const tab = second === getCurrentPlayerId() ? "mi-perfil" : "roster";
    return { tab, render: (container) => renderJugadorDetalle(container, second) };
  }
  // `second` (id del jugador de origen) es opcional — solo decide a dónde
  // regresa el botón de "Volver al perfil" (ver js/views/medallas.js); la
  // guía en sí es la misma lista sin importar de dónde se haya llegado.
  if (first === "medallas") {
    return { tab: "roster", render: (container) => renderMedallasGuide(container, second) };
  }
  // #/alineacion/p1/p2 — los dos jugadores del comparador que va al final de
  // esa vista viven en la URL para poder compartir la comparación armada.
  if (first === "alineacion") {
    return { tab: "alineacion", render: (container) => renderAlineacion(container, second, third) };
  }
  const tab = routes[first] ? first : "resumen";
  return { tab, render: routes[tab] };
}

// Arma la barra de abajo una sola vez: los 4 botones de ruta directa más
// "Más", que no navega — abre el panel con las 5 rutas restantes.
function buildBottomTabs() {
  bottomTabs.innerHTML = "";
  for (const t of BOTTOM_TABS) {
    const a = document.createElement("a");
    a.href = t.route;
    a.className = "bottom-tab";
    a.dataset.tab = t.tab;
    a.innerHTML = `<i class="fa-solid ${t.icon}"></i><span>${t.label}</span>`;
    bottomTabs.appendChild(a);

    // Mi Perfil va justo después de Resumen — mismo lugar que en la nav de
    // escritorio (ver #nav-mi-perfil en index.html). Empieza oculta: render()
    // le pone el href y la muestra en cuanto hay sesión iniciada.
    if (t.tab === "resumen") {
      const miPerfil = document.createElement("a");
      miPerfil.href = "#";
      miPerfil.className = "bottom-tab";
      miPerfil.id = "bottom-tab-mi-perfil";
      miPerfil.dataset.tab = "mi-perfil";
      miPerfil.hidden = true;
      miPerfil.innerHTML = `<i class="fa-solid fa-id-card"></i><span>Mi Perfil</span>`;
      bottomTabs.appendChild(miPerfil);
    }
  }

  const moreBtn = document.createElement("button");
  moreBtn.type = "button";
  moreBtn.className = "bottom-tab";
  moreBtn.dataset.tab = "more";
  moreBtn.setAttribute("aria-expanded", "false");
  moreBtn.innerHTML = `<i class="fa-solid fa-ellipsis"></i><span>Menú</span>`;
  moreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMoreSheet();
  });
  bottomTabs.appendChild(moreBtn);

  // Pantalla completa tipo "apps del celular" (ver APPS_GRID arriba) — con
  // encabezado y botón de cerrar porque, a diferencia del panelito chico de
  // antes, ya no queda nada de la página debajo para tocar "afuera" y
  // cerrarlo así.
  moreSheet.innerHTML = `
    <div class="more-sheet-header">
      <h3>Menú</h3>
      <button type="button" class="more-sheet-close" id="more-sheet-close-btn" aria-label="Cerrar">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="more-sheet-grid">
      ${APPS_GRID.map(
        (t) => `
        <a href="${t.route}" data-tab="${t.tab}"${t.tab === "mi-perfil" ? ' id="more-tile-mi-perfil" hidden' : ""}>
          <span class="more-app-icon"><i class="fa-solid ${t.icon}"></i></span>
          <span>${t.label}</span>
        </a>
      `
      ).join("")}
    </div>
  `;
  moreSheet.querySelector("#more-sheet-close-btn").addEventListener("click", () => toggleMoreSheet(false));
}

function toggleMoreSheet(forceOpen) {
  const open = forceOpen ?? moreSheet.hidden;
  moreSheet.hidden = !open;
  bottomTabs.querySelector('[data-tab="more"]')?.setAttribute("aria-expanded", String(open));
}

// Ya no hay "afuera" que tocar (es pantalla completa, ver CSS) — esto se
// deja solo por si algún día vuelve a haber espacio alrededor; cerrar de
// verdad es el botón de la X (ver #more-sheet-close-btn arriba) o navegar a
// un tile (dispara render(), que ya cierra el panel más abajo).
moreSheet.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", () => toggleMoreSheet(false));

const MORE_TAB_IDS = new Set(MORE_TABS.map((t) => t.tab));

function render() {
  const myId = getCurrentPlayerId();
  // Los 3 lugares donde puede aparecer "Mi Perfil" (nav de escritorio,
  // barra de abajo, y ahora también el grid de "Más" — ver APPS_GRID
  // arriba): mismo trato para los tres, oculto sin sesión.
  for (const el of [miPerfilLink, bottomTabs.querySelector('[data-tab="mi-perfil"]'), moreSheet.querySelector('[data-tab="mi-perfil"]')]) {
    if (!el) continue;
    el.hidden = !myId;
    if (myId) el.href = `#/jugador/${myId}`;
  }

  const route = currentRoute();
  toggleMoreSheet(false);

  for (const link of tabs.querySelectorAll("a")) {
    link.classList.toggle("active", link.dataset.route === route.tab);
  }

  for (const el of bottomTabs.querySelectorAll("[data-tab]")) {
    const isMore = el.dataset.tab === "more";
    el.classList.toggle("active", isMore ? MORE_TAB_IDS.has(route.tab) : el.dataset.tab === route.tab);
  }
  for (const link of moreSheet.querySelectorAll("a")) {
    link.classList.toggle("active", link.dataset.tab === route.tab);
  }

  app.innerHTML = "";
  route.render(app);
}

buildBottomTabs();
initTheme();
mountAuthControl(document.getElementById("auth-slot"));
// Al cambiar de ruta (clic en un link, botón "atrás") se sube al tope —
// sin esto, un link a mitad de una página larga (ej. el avatar de un
// jugador en Resumen) deja la página nueva scrolleada a la mitad, en vez de
// abrir desde arriba como se espera de cualquier página nueva. No va dentro
// de render() porque esa misma función también se llama al cambiar la
// sesión (ver más abajo), y ahí sí se quiere mantener el scroll donde
// estaba.
window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
});
// Se dispara desde js/auth.js cada vez que cambia la sesión (login, logout,
// se resuelve el player_id) — la vista actual se repinta con el estado
// nuevo, mismo tratamiento que un cambio de hash.
window.addEventListener("caimanes:auth-changed", render);

// Cada vista pide sus datos de Supabase UNA sola vez, al pintarse (avatares,
// anuncios, RSVP, comentarios...) — runQuery/runMutation en js/db.js ya
// reintentan solas ante un hipo de red, pero si la señal se cae varios
// segundos seguidos (típico en el campo) se rinden igual, y la vista se
// queda así hasta que alguien la vuelva a pintar. Sin esto, la única forma
// de recuperarse era cambiar de pestaña y volver, o recargar a mano — lo
// cual para un jugador cualquiera (a diferencia de quien está viendo esto
// en código) se siente como que "la app no jala". Repintar la vista actual
// en cuanto vuelve la señal (evento "online" del navegador) o en cuanto la
// pestaña vuelve a estar visible (se minimizó, se cambió de app en el
// celular y se regresó) cubre ambos casos sin que nadie tenga que hacer
// nada — mismo tratamiento que un cambio de sesión, no se toca el scroll.
window.addEventListener("online", render);

// Repintar en CUALQUIER cambio de pestaña (por chico que sea) resultó ser
// peor que el problema que arreglaba: un alt-tab de un segundo, o abrir
// otro programa encima por un momento, disparaba un repintado completo —
// re-pidiendo avatar, medallas, RSVP, comentarios, todo desde cero a
// Supabase — que se sentía como que "los datos se desconectan" nada más
// cambiar de ventana. Solo vale la pena recuperarse así cuando la pestaña
// estuvo oculta el tiempo suficiente para que la conexión realmente se
// haya podido caer (celular bloqueado, cambio de app prolongado) — un
// minuto es buen punto medio: cubre ese caso sin disparar en cada clic
// fuera de la ventana.
const STALE_AFTER_MS = 60_000;
let hiddenAt = null;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    hiddenAt = Date.now();
    return;
  }
  if (hiddenAt !== null && Date.now() - hiddenAt > STALE_AFTER_MS) render();
  hiddenAt = null;
});

render();
// No se espera a que termine para pintar la primera vez: initAuth() resuelve
// la sesión de forma async y avisa por "caimanes:auth-changed" cuando esté
// lista, así la app no se queda en blanco esperando red.
initAuth();

// Service worker: deja abrir la página sin señal (en el campo casi nunca hay
// datos). Si falla el registro la app sigue funcionando normal, solo pierde
// el modo offline — por eso el catch silencioso.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
