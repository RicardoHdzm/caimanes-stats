import { TEAM, SPONSORS } from "./data.js";
import { renderFeed } from "./views/feed.js";
import { renderResumen } from "./views/resumen.js";
import { renderRoster } from "./views/roster.js";
import { renderEstadisticas } from "./views/estadisticas.js";
import { renderJuegos } from "./views/juegos.js";
import { renderPlayoffs } from "./views/playoffs.js";
import { renderTemporadas } from "./views/temporadas.js";
import { renderCalendario } from "./views/calendario.js";
import { renderStanding } from "./views/standing.js";
import { renderAlineacion } from "./views/alineacion.js";
import { renderPlaylist } from "./views/playlist.js";
import { renderJuegoDetalle } from "./views/juego.js";
import { renderJugadorDetalle } from "./views/jugador.js";
import { renderMedallasGuide } from "./views/medallas.js";
import { initAuth, mountAuthControl, getCurrentPlayerId, getSession, isCoach, signOut, leaveToSplash } from "./auth.js";
import { getAvatarUrl } from "./db.js";
import { SUPABASE_CONFIGURED } from "./supabase-config.js";
import { ordinalTemporada } from "./ui.js";
import { initTheme } from "./theme.js";
import { initSplash } from "./splash.js";
import { initRecovery } from "./recovery.js";

const routes = {
  inicio: renderFeed,
  resumen: renderResumen,
  roster: renderRoster,
  estadisticas: renderEstadisticas,
  juegos: renderJuegos,
  playoffs: renderPlayoffs,
  calendario: renderCalendario,
  standing: renderStanding,
  alineacion: renderAlineacion,
  playlist: renderPlaylist,
};

// Barra de pestañas de abajo (solo celular — ver @media en styles.css). La
// nav de arriba sigue intacta y es la real en escritorio; esta es aparte y
// se queda solo con lo esencial de un vistazo rápido — Inicio, Perfil,
// Roster — el resto (Juegos y Standing incluidos) vive detrás de "Menú",
// a petición expresa (antes Juegos/Standing también estaban aquí abajo).
const BOTTOM_TABS = [
  { tab: "inicio", route: "#/inicio", label: "Inicio", icon: "fa-house" },
  { tab: "roster", route: "#/roster", label: "Roster", icon: "fa-users" },
];

// Mismo orden que la nav de escritorio (ver <nav class="tabs"> en
// index.html): lo del día a día primero (Juegos, Calendario, Standing),
// luego lo de playoffs/stats (consulta más ocasional) y las herramientas
// extra (Alineación, Playlist) al final.
const MORE_TABS = [
  { tab: "resumen", route: "#/resumen", label: "Resumen", icon: "fa-chart-line" },
  { tab: "juegos", route: "#/juegos", label: "Juegos", icon: "fa-flag-checkered" },
  { tab: "calendario", route: "#/calendario", label: "Calendario", icon: "fa-calendar-day" },
  { tab: "standing", route: "#/standing", label: "Standing", icon: "fa-ranking-star" },
  { tab: "playoffs", route: "#/playoffs", label: "Playoffs", icon: "fa-trophy" },
  { tab: "estadisticas", route: "#/estadisticas", label: "Estadísticas", icon: "fa-chart-simple" },
  { tab: "temporadas", route: "#/temporadas", label: "Temporadas", icon: "fa-calendar-days" },
  { tab: "alineacion", route: "#/alineacion", label: "Alineación", icon: "fa-clipboard-list" },
  { tab: "playlist", route: "#/playlist", label: "Playlist", icon: "fa-music" },
];

// Todo lo navegable en celular, para el panel de "Menú" — no es solo las
// rutas que no caben en la barra de abajo: es una pantalla completa tipo
// "apps del celular" con TODO, incluidas Resumen/Mi Perfil/Roster (que ya
// están abajo, pero repetidas aquí no estorban y así "Menú" es de verdad
// un mapa completo del sitio). Se arma recorriendo BOTTOM_TABS en vez de
// copiarlo a mano, para no desincronizarse si cambia esa lista — mismo
// criterio (buscar "resumen" por tab, no por posición) que ya usa
// buildBottomTabs() de abajo para insertar Mi Perfil.
const APPS_GRID = [];
for (const t of BOTTOM_TABS) {
  APPS_GRID.push(t);
  if (t.tab === "inicio") {
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

// Logos de patrocinadores en el pie de página — ver SPONSORS en js/data.js
// y .footer-sponsor-logo en css/styles.css (se invierten a blanco solos en
// los temas oscuros). `escapeHtml` no hace falta aquí: el nombre/ruta salen
// de data.js, no de un usuario.
const footerSponsors = document.getElementById("footer-sponsors");
if (footerSponsors && SPONSORS.length > 0) {
  footerSponsors.innerHTML = SPONSORS.map(
    (s) => `<img class="footer-sponsor-logo" src="${s.logo}" alt="${s.name}" loading="lazy">`
  ).join("");
  // El título ("Patrocinadores") arranca oculto en el HTML — solo tiene
  // caso mostrarlo si de verdad hay logos que ponerle encima.
  const footerSponsorsTitle = document.getElementById("footer-sponsors-title");
  if (footerSponsorsTitle) footerSponsorsTitle.hidden = false;
}

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
  // #/temporadas/8 — el número de temporada es opcional (sin él, se
  // muestra la más reciente con juegos capturados, ver defaultSeason en
  // js/views/temporadas.js).
  if (first === "temporadas") {
    return { tab: "temporadas", render: (container) => renderTemporadas(container, second) };
  }
  // #/estadisticas/bateo — Bateo, Pitcheo y Fildeo unificados en una sola
  // pestaña con selector (ver js/views/estadisticas.js). Los links viejos
  // #/bateo, #/pitcheo y #/fildeo se siguen abriendo en el tipo que
  // corresponde, por si quedó alguno guardado.
  if (first === "estadisticas") {
    return { tab: "estadisticas", render: (container) => renderEstadisticas(container, second) };
  }
  if (first === "bateo" || first === "pitcheo" || first === "fildeo") {
    return { tab: "estadisticas", render: (container) => renderEstadisticas(container, first) };
  }
  const tab = routes[first] ? first : "inicio";

  // Inicio (el feed, js/views/feed.js) y Playlist son exclusivos de cuentas
  // con sesión, a petición expresa. Sin sesión el invitado ve el Resumen de
  // stats en lugar del feed — y para él "Inicio" ES ese resumen (por eso el
  // tab se queda en "inicio", para que resalte en la nav). getSession()
  // puede tardar en resolver: el primer render() sin sesión cae al Resumen,
  // y el re-render por "caimanes:auth-changed" ya muestra el feed real
  // cuando la sesión resuelve.
  if ((tab === "inicio" || tab === "playlist") && !getSession()) {
    return { tab: "inicio", render: routes.resumen };
  }

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

    // Mi Perfil va justo después de Inicio — mismo lugar que en la nav de
    // escritorio (ver #nav-mi-perfil en index.html). Empieza oculta: render()
    // le pone el href y la muestra en cuanto hay sesión iniciada.
    if (t.tab === "inicio") {
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
      <a href="https://www.instagram.com/caimanes.sb/" target="_blank" rel="noopener noreferrer" id="more-tile-instagram" aria-label="Instagram del equipo">
        <span class="more-app-icon"><i class="fa-brands fa-instagram"></i></span>
        <span>Instagram</span>
      </a>
      <button type="button" id="more-tile-theme">
        <span class="more-app-icon"><i class="fa-solid fa-moon" id="more-tile-theme-icon"></i></span>
        <span>Tema</span>
      </button>
      <a href="admin.html" id="more-tile-admin" hidden>
        <span class="more-app-icon"><i class="fa-solid fa-user-gear"></i></span>
        <span>Admin</span>
      </a>
      <a href="#" id="more-tile-login">
        <span class="more-app-icon"><i class="fa-solid fa-right-to-bracket"></i></span>
        <span>Iniciar sesión</span>
      </a>
      <button type="button" id="more-tile-logout" hidden>
        <span class="more-app-icon"><i class="fa-solid fa-right-from-bracket"></i></span>
        <span>Cerrar sesión</span>
      </button>
    </div>
  `;
  moreSheet.querySelector("#more-sheet-close-btn").addEventListener("click", () => toggleMoreSheet(false));

  // "Iniciar sesión" del menú te regresa a la pantalla de bienvenida (ver
  // js/splash.js) — mismo mecanismo (y mismo velo de salida) que el link
  // del header, ver leaveToSplash() en js/auth.js.
  moreSheet.querySelector("#more-tile-login").addEventListener("click", (e) => {
    e.preventDefault();
    leaveToSplash();
  });
  // Cierra el menú de inmediato en vez de esperar a que signOut() (async)
  // dispare el re-render por "caimanes:auth-changed" — mismo trato que el
  // botón de cerrar sesión del header (ver wireAuthControl en js/auth.js).
  moreSheet.querySelector("#more-tile-logout").addEventListener("click", () => {
    toggleMoreSheet(false);
    signOut();
  });
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

  // Iniciar/Cerrar sesión y Admin (solo coach) en el menú de "apps" — mismo
  // estado que ya calcula js/auth.js para el botón del header, nomás
  // reflejado aquí también. Sin Supabase configurado no hay cuentas de
  // ningún tipo, así que los tres se quedan ocultos siempre.
  const session = SUPABASE_CONFIGURED && getSession();
  const loginTile = moreSheet.querySelector("#more-tile-login");
  const logoutTile = moreSheet.querySelector("#more-tile-logout");
  const adminTile = moreSheet.querySelector("#more-tile-admin");
  if (loginTile) loginTile.hidden = !SUPABASE_CONFIGURED || !!session;
  if (logoutTile) logoutTile.hidden = !session;
  if (adminTile) adminTile.hidden = !session || !isCoach();

  // Playlist: pestaña exclusiva de cuentas con sesión (a petición expresa) —
  // el link se esconde sin sesión, en la nav de escritorio y en el grid de
  // "Más" (no está en la barra de abajo). currentRoute() ya manda a Inicio
  // si se llega por URL directa.
  for (const el of [tabs.querySelector('[data-route="playlist"]'), moreSheet.querySelector('[data-tab="playlist"]')]) {
    if (el) el.hidden = !session;
  }

  // "Resumen" (las stats) — para un invitado es un duplicado: su "Inicio" ya
  // muestra el Resumen (el feed es exclusivo de cuenta, ver currentRoute).
  // Así que ese link separado solo se muestra con sesión iniciada.
  for (const el of [tabs.querySelector('[data-route="resumen"]'), moreSheet.querySelector('[data-tab="resumen"]')]) {
    if (el) el.hidden = !session;
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
initRecovery();
mountAuthControl(document.getElementById("auth-slot"));

// La app NO se pinta hasta que la pantalla de bienvenida (js/splash.js)
// llama a startApp() — antes de eso #app queda vacío, la bienvenida es una
// pantalla independiente, no un overlay sobre el sitio ya pintado. Los
// listeners de abajo que repintan no hacen nada hasta entonces.
let appStarted = false;
function startApp() {
  if (appStarted) return;
  appStarted = true;
  render();
}

// Al cambiar de ruta (clic en un link, botón "atrás") se sube al tope —
// sin esto, un link a mitad de una página larga (ej. el avatar de un
// jugador en Resumen) deja la página nueva scrolleada a la mitad, en vez de
// abrir desde arriba como se espera de cualquier página nueva. No va dentro
// de render() porque esa misma función también se llama al cambiar la
// sesión (ver más abajo), y ahí sí se quiere mantener el scroll donde
// estaba.
window.addEventListener("hashchange", () => {
  if (!appStarted) return;
  render();
  window.scrollTo(0, 0);
});
// Se dispara desde js/auth.js cada vez que cambia la sesión (login, logout,
// se resuelve el player_id) — la vista actual se repinta con el estado
// nuevo, mismo tratamiento que un cambio de hash.
window.addEventListener("caimanes:auth-changed", () => {
  if (appStarted) render();
});

// Foto personalizada de Storage para el chip de tu cuenta en el header (ver
// loggedInMarkup() en js/auth.js) — mismo "pinta fijo, luego hidrata" que ya
// usan hydrateAvatars() en resumen.js/playlist.js/comments.js/jugador.js.
// Aparte de render(): el chip vive en #auth-slot (fuera de `app`), que
// renderAuthControl() ya repinta solo en cada cambio de sesión — esto nomás
// lo completa cuando sí hay foto en Storage. js/auth.js no puede llamar a
// getAvatarUrl() directo (import circular con js/db.js, ver el comentario
// junto a loggedInMarkup()), por eso vive aquí.
function hydrateAuthAvatar() {
  const id = getCurrentPlayerId();
  if (!id) return;
  const slot = document.querySelector(`#auth-slot [data-avatar="${id}"]`);
  if (!slot) return;
  getAvatarUrl(id).then((url) => {
    if (!url) return;
    slot.innerHTML = `<img class="avatar" src="${url}" alt="" style="width:28px;height:28px;font-size:11.2px;">`;
  });
}
window.addEventListener("caimanes:auth-changed", hydrateAuthAvatar);

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
window.addEventListener("online", () => {
  if (appStarted) render();
});

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
  if (appStarted && hiddenAt !== null && Date.now() - hiddenAt > STALE_AFTER_MS) render();
  hiddenAt = null;
});

// initAuth() resuelve la sesión de forma async (import del cliente de
// Supabase por CDN + getSession + RPC) y avisa por "caimanes:auth-ready"
// cuando termina. initSplash() espera ese aviso (con un tope de tiempo)
// antes de llamar startApp(), así la app arranca ya con la sesión resuelta
// en vez de aparecer a medio poblar. Se lanzan en este orden pero corren en
// paralelo.
initAuth();
initSplash(startApp);

// Service worker: deja abrir la página sin señal (en el campo casi nunca hay
// datos). Si falla el registro la app sigue funcionando normal, solo pierde
// el modo offline — por eso el catch silencioso.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
