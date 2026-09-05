// Autenticación de jugadores con Supabase. Todo lo que tiene que ver con
// "¿quién soy y con qué sesión?" vive aquí — el resto del código nunca habla
// con Supabase directo, solo importa lo que expone este módulo (mismo
// criterio que ya separa js/stats.js de js/ui.js). js/db.js hace lo mismo
// para las consultas de datos (RSVP, votos, walkup, pagos, comentarios).
//
// No hay auto-registro: las cuentas las da de alta el coach a mano desde el
// panel de Supabase (correo + contraseña temporal). Un jugador solo puede
// iniciar sesión y, ya adentro, cambiar su contraseña.
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_CONFIGURED } from "./supabase-config.js";
import { PLAYERS } from "./data.js";

let supabase = null;
let session = null;
let playerId = null; // se resuelve aparte (rpc a Supabase), no viene en la sesión

// Único correo con permiso de editar player_dues (estado de pago) — debe
// coincidir EXACTO con el que usa la política "dues_write_coach_only" en
// supabase/schema.sql. Si algún día cambia quién administra el sitio, hay
// que actualizar los dos lugares.
const COACH_EMAIL = "jrhm95@gmail.com";

// Solo decide si mostrar controles de edición (ej. la columna de pagos en
// Roster) — no es la seguridad real, esa la impone Supabase con RLS
// comparando el mismo correo del lado del servidor.
export function isCoach() {
  return session?.user?.email === COACH_EMAIL;
}

// Le avisa a js/main.js que algo cambió, para que vuelva a pintar la vista
// actual con el estado nuevo — mismo patrón que ya usa el router con
// "hashchange" (ver js/main.js). También repinta el propio botón del
// header aquí (no en cada llamador): así ningún caso — la sesión inicial
// recuperada al abrir la página, un login, un logout — se olvida de
// refrescarlo.
function notifyChange() {
  renderAuthControl();
  window.dispatchEvent(new CustomEvent("caimanes:auth-changed"));
}

async function resolvePlayerId() {
  if (!session) {
    playerId = null;
    return;
  }
  const { data, error } = await supabase.rpc("current_player_id");
  playerId = error ? null : data ?? null;
}

// Carga el cliente de Supabase por CDN y resuelve la sesión guardada — la
// parte que puede fallar por un hipo de red, separada de initAuth() de abajo
// para poder reintentarla entera si hace falta.
async function bootAuth() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data } = await supabase.auth.getSession();
  session = data.session;
  await resolvePlayerId();
}

// Se llama una sola vez desde js/main.js al arrancar la app. Si Supabase
// todavía no está configurado (Fase 0 del plan sin terminar), no intenta
// conectarse — evita un error de red confuso antes de tener proyecto.
//
// Reintenta una vez tras un hipo de red — mismo criterio que runQuery/
// runMutation en js/db.js, pero aquí hace más falta todavía: esto es lo
// primero que corre al abrir la página, así que si truena y no se
// reintenta, TODO lo que depende de Supabase (avatares, anuncios, RSVP,
// comentarios...) se queda sin datos hasta que alguien recargue la página a
// mano ("a veces no carga hasta que actualizo"). Si el segundo intento
// también falla, se rinde en silencio — sin red no hay nada más que hacer,
// pero al menos ya no depende de la mala suerte de un solo intento.
export async function initAuth() {
  if (!SUPABASE_CONFIGURED) return;
  try {
    await bootAuth();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      await bootAuth();
    } catch {
      return;
    }
  }
  notifyChange();

  supabase.auth.onAuthStateChange(async (_event, newSession) => {
    session = newSession;
    await resolvePlayerId();
    notifyChange();
  });

  // El token de sesión expira cada cierto tiempo (típicamente 1 hora) y se
  // refresca solo con un temporizador interno — pero los navegadores
  // PAUSAN esos temporizadores cuando la pestaña está en segundo plano
  // (celular bloqueado, se cambió de app). Al volver, el token ya expiró y
  // nadie lo refrescó: las consultas protegidas por RLS empiezan a fallar
  // en silencio, aunque runQuery ya reintente (reintentar con un token
  // vencido no arregla nada). Esto es justo la causa de "después de un
  // rato deja de mostrar cosas" que un simple re-render (ver el listener
  // de "visibilitychange" en js/main.js) no resuelve por sí solo.
  // startAutoRefresh()/stopAutoRefresh() es la solución que la propia
  // documentación de Supabase recomienda para este caso — y de paso,
  // forzar un getSession() fresco al volver detecta si el token ya se
  // venció o cambió mientras tanto y avisa al resto de la app.
  document.addEventListener("visibilitychange", () => {
    if (!supabase) return;
    if (document.visibilityState === "visible") {
      supabase.auth.startAutoRefresh();
      supabase.auth.getSession().then(async ({ data }) => {
        // Antes esto avisaba SIEMPRE, así hubiera cambiado algo o no — un
        // simple alt-tab de un segundo terminaba repintando toda la vista
        // actual (y volviendo a pedir avatar/medallas/RSVP/comentarios a
        // Supabase desde cero), lo que se sentía como que "los datos se
        // desconectan" nada más cambiar de pestaña. Ahora solo avisa si la
        // sesión de verdad cambió (se refrescó el token, se cerró sesión en
        // otra pestaña, etc.) — que es el único caso real que justifica
        // repintar. onAuthStateChange (arriba) ya cubre el refresh normal del
        // token; esto es solo para detectar que se venció mientras la
        // pestaña estaba oculta y el refresh automático no alcanzó a correr.
        const changed = data.session?.access_token !== session?.access_token;
        session = data.session;
        if (!changed) return;
        await resolvePlayerId();
        notifyChange();
      });
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export function getSession() {
  return session;
}

// Síncrono a propósito: las vistas lo llaman durante su render normal (igual
// que leen PLAYERS o TEAM), sin esperar una promesa. Refleja el último valor
// ya resuelto, no dispara una consulta nueva.
export function getCurrentPlayerId() {
  return playerId;
}

// Cliente ya inicializado, para que js/db.js pueda hacer sus propias
// consultas sin que cada módulo cree el suyo. null si Supabase no está
// configurado o initAuth() no ha terminado.
export function getClient() {
  return supabase;
}

export async function signIn(email, password) {
  if (!supabase) throw new Error("Supabase no está configurado todavía.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// Reintenta una vez tras un hipo de red — es un update (cambiar la
// contraseña dos veces al mismo valor no hace nada raro), así que a
// diferencia de un insert es seguro reintentarlo sin arriesgar nada
// duplicado. Mismo patrón que runQuery/runMutation en js/db.js, repetido
// aquí en chico para no crear un import circular (db.js ya importa de este
// archivo).
export async function changePassword(newPassword) {
  if (!supabase) throw new Error("Supabase no está configurado todavía.");
  let { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    ({ error } = await supabase.auth.updateUser({ password: newPassword }));
  }
  if (error) throw error;
}

// ---- Control de login en el header (#auth-slot en index.html) ----
//
// Ya no es un botón que despliega un menú (ver historial) — a petición
// expresa, el pill con tu nombre ahora navega directo a tu perfil, y
// Cerrar sesión (y Admin, para el coach) son botones redondos aparte, al
// lado — mismo lenguaje visual que Instagram/tema del otro lado del
// header, no un menú escondido. En celular todo #auth-slot se oculta (ver
// css/styles.css): esas mismas acciones viven en el menú de "apps" de
// js/main.js.

let containerEl = null;

// Se llama una vez desde js/main.js al arrancar, y de nuevo cada vez que
// cambia la sesión (ver onAuthStateChange arriba).
export function mountAuthControl(el) {
  containerEl = el;
  renderAuthControl();
}

export function renderAuthControl() {
  if (!containerEl) return;
  if (!SUPABASE_CONFIGURED) {
    containerEl.innerHTML = "";
    return;
  }
  containerEl.innerHTML = session ? loggedInMarkup() : loggedOutMarkup();
  wireAuthControl();
}

// Antes era un botón que abría un desplegable con el formulario ahí mismo
// (ver historial) — ahora "Iniciar sesión" es su propia página (#/login,
// ver js/views/login.js), así que aquí solo hace falta un link normal.
function loggedOutMarkup() {
  return `
    <a href="#/login" class="auth-btn auth-btn-named" id="login-link" aria-label="Iniciar sesión">
      <i class="fa-solid fa-right-to-bracket"></i>
      <span class="auth-btn-name">Iniciar sesión</span>
    </a>
  `;
}

function loggedInMarkup() {
  const player = playerId ? PLAYERS.find((p) => p.id === playerId) : null;
  // Con jugador ya identificado el pill es un link directo a tu perfil. Sin
  // vincular todavía (falta la fila en player_whitelist) no hay a qué
  // perfil mandarte, así que se queda como una etiqueta fija — el `title`
  // explica por qué en vez del texto que antes vivía en el panel.
  const pill = player
    ? `<a href="#/jugador/${playerId}" class="auth-btn auth-btn-in auth-btn-named" aria-label="Ir a tu perfil">
         <span class="auth-btn-name">#${player.number ?? "-"} - ${player.name}</span>
       </a>`
    : `<span class="auth-btn auth-btn-in auth-btn-named" title="Tu cuenta todavía no está vinculada a un jugador — pídeselo al coach.">
         <i class="fa-solid fa-user-check"></i>
         <span class="auth-btn-name">Mi cuenta</span>
       </span>`;

  return `
    <div class="auth-controls">
      ${pill}
      ${
        isCoach()
          ? `<a href="admin.html" class="auth-btn auth-btn-icon" id="auth-admin-btn" aria-label="Ir al Admin">
               <i class="fa-solid fa-user-gear"></i>
             </a>`
          : ""
      }
      <button type="button" class="auth-btn auth-btn-icon" id="auth-signout-btn" aria-label="Cerrar sesión">
        <i class="fa-solid fa-right-from-bracket"></i>
      </button>
    </div>
  `;
}

function wireAuthControl() {
  containerEl.querySelector("#auth-signout-btn")?.addEventListener("click", () => signOut());

  // "Iniciar sesión" (solo existe deslogueado, ver loggedOutMarkup) guarda
  // en qué página estabas ANTES de ir a #/login — la lee js/views/login.js
  // al terminar, para regresarte ahí en vez de mandarte siempre a Resumen.
  // Se lee location.hash aquí, ANTES de que el navegador procese el click
  // del link (el listener corre primero), así que todavía es el hash VIEJO.
  containerEl.querySelector("#login-link")?.addEventListener("click", () => {
    sessionStorage.setItem("caimanes-login-return", location.hash || "#/resumen");
  });
}
