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
import { renderAvatar } from "./ui.js";

let supabase = null;
let session = null;
let playerId = null; // se resuelve aparte (rpc a Supabase), no viene en la sesión

// Estado por default para css/styles.css (html[data-session="in"] da el look
// "red social"): "out" desde ya, para que un invitado nunca alcance a ver
// ese look aunque Supabase tarde en responder o ni cargue (initAuth() puede
// rendirse en silencio sin señal, ver abajo). notifyChange() lo actualiza a
// "in" en cuanto de verdad haya sesión.
document.documentElement.dataset.session = "out";

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
//
// `document.documentElement.dataset.session` ("in"/"out") es el mismo
// truco que ya usa el tema (ver document.documentElement.dataset.theme en
// js/theme.js): un solo interruptor en el <html> que css/styles.css lee
// con `html[data-session="in"] ...` para dar un look más "red social" a
// quien tiene sesión iniciada, sin que cada vista tenga que preguntar
// getSession() por su cuenta — a petición expresa, ese look nunca debe
// filtrarse a un invitado.
function notifyChange() {
  document.documentElement.dataset.session = session ? "in" : "out";
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
  // "caimanes:auth-ready" = la sesión ya se resolvió lo que se iba a
  // resolver (haya sesión, no haya, o haya fallado la red / no esté
  // configurado Supabase). Se dispara SIEMPRE, una sola vez — js/splash.js
  // lo espera para no revelar la app a medio cargar (ver enterApp()).
  const announceReady = () => window.dispatchEvent(new CustomEvent("caimanes:auth-ready"));

  if (!SUPABASE_CONFIGURED) {
    announceReady();
    return;
  }
  try {
    await bootAuth();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      await bootAuth();
    } catch {
      announceReady();
      return;
    }
  }
  notifyChange();
  announceReady();

  supabase.auth.onAuthStateChange(async (event, newSession) => {
    session = newSession;
    await resolvePlayerId();
    notifyChange();
    // Volviste del correo de "olvidé mi contraseña" (ver resetPassword más
    // abajo) — el cliente detecta el token de recuperación solo en la URL
    // (detectSessionInUrl, default) y dispara esto. js/recovery.js escucha
    // este evento para mostrar el formulario de contraseña nueva.
    if (event === "PASSWORD_RECOVERY") {
      window.dispatchEvent(new CustomEvent("caimanes:password-recovery"));
    }
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

// "¿Olvidaste tu contraseña?" (ver js/splash.js y el formulario inline de
// admin.html) — manda el correo de recuperación de Supabase. `redirectTo`
// siempre apunta a la raíz del sitio (nunca a admin.html, aunque se pida
// desde ahí): ahí es donde vive #recovery-gate (ver js/recovery.js), que
// es quien de verdad atrapa el link y pide la contraseña nueva. OJO: esa
// URL tiene que estar en la lista de "Redirect URLs" del proyecto de
// Supabase (Authentication → URL Configuration) o el correo no va a
// funcionar — es una config aparte, no algo que el código pueda forzar.
export async function resetPassword(email) {
  if (!supabase) throw new Error("Supabase no está configurado todavía.");
  const redirectTo = new URL("./", location.href).href;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

// Un solo mensaje de error para los dos formularios de login (splash.js y
// el inline de admin.html) — antes siempre decía "correo o contraseña
// incorrectos" pasara lo que pasara, hasta si era un hipo de red o
// Supabase frenando por demasiados intentos seguidos (nos pasó de verdad
// probando esto: varios 429 seguidos). `error.status` es el código HTTP
// que regresa gotrue (la parte de auth de Supabase); sin status del todo
// es que ni siquiera hubo respuesta (sin señal, CORS, etc.).
export function loginErrorMessage(error) {
  const status = error?.status;
  if (status === 429) return "Demasiados intentos seguidos — espera un momento y vuelve a intentar.";
  if (!status) return "No se pudo conectar — revisa tu señal e intenta de nuevo.";
  return "Correo o contraseña incorrectos.";
}

// Salida de la app hacia la pantalla de bienvenida — la usan "Cerrar
// sesión" (signOut, abajo) y "Iniciar sesión" (que también te regresa a la
// bienvenida a loguearte ahí). Un velo cubre todo con un fundido rápido
// ANTES de la recarga, para que no se sienta un corte seco. Se recarga (en
// vez de solo re-renderizar) porque #splash-gate es un elemento estático de
// index.html que splash.js ya quitó del DOM al entrar — hace falta una
// carga fresca para que vuelva a estar ahí. Mismo storage key que usa
// initSplash() para saber si ya se entró esta sesión; quitarlo hace que
// vuelva a aparecer.
function showPageVeil() {
  const veil = document.createElement("div");
  veil.className = "page-veil";
  document.body.appendChild(veil);
  requestAnimationFrame(() => veil.classList.add("page-veil--on"));
}

// "Iniciar sesión" (te regresa a la bienvenida a loguearte ahí) — no hay
// sesión que cerrar, solo se quita la marca de "ya entré esta sesión" y se
// recarga. El velo es solo para que no se sienta un corte seco.
export function leaveToSplash() {
  try {
    sessionStorage.removeItem("caimanes-entered");
  } catch {
    // Sin sessionStorage no hay nada que limpiar; igual recarga.
  }
  showPageVeil();
  // El fundido dura 0.28s (ver .page-veil en css/styles.css); se recarga un
  // pelín después para que se alcance a ver completo.
  setTimeout(() => {
    location.href = "./";
  }, 320);
}

export async function signOut() {
  if (!supabase) return;
  showPageVeil();
  // `scope: "local"` NO hace la llamada de red a /logout — solo borra el
  // token guardado, que es lo único que importa para volver a la bienvenida.
  // Con el scope global (el default) y sin await, si la red estaba lenta el
  // token local no alcanzaba a borrarse antes de la recarga y "cerrar
  // sesión" te regresaba con la sesión TODAVÍA activa ("a veces no me deja
  // cerrar sesión"). Ahora se espera, y como no hay red de por medio es
  // instantáneo aunque no haya señal.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Ni así; se limpia igual lo local a mano abajo, por si el cliente dejó
    // el token colgado.
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("sb-") && key.includes("-auth-token")) localStorage.removeItem(key);
      }
    } catch {
      // Sin localStorage no hay nada que forzar.
    }
  }
  try {
    sessionStorage.removeItem("caimanes-entered");
  } catch {
    // Ver leaveToSplash().
  }
  // Un respiro para que el velo alcance a subir (el signOut local de arriba
  // es casi instantáneo).
  setTimeout(() => {
    location.href = "./";
  }, 280);
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
// "splash" (default, js/main.js): sin sesión, el link de abajo te regresa
// a la pantalla de bienvenida (ver js/splash.js) para loguearte ahí — la
// app normal no tiene su propio formulario. "inline" (admin.html, vía
// js/admin-dues.js): esa página no tiene pantalla de bienvenida, así que
// aquí sí hace falta el formulario completo, en el mismo lugar.
let loginVariant = "splash";

// Se llama una vez desde js/main.js/js/admin-dues.js al arrancar, y de
// nuevo cada vez que cambia la sesión (ver onAuthStateChange arriba).
export function mountAuthControl(el, { loginVariant: variant = "splash" } = {}) {
  containerEl = el;
  loginVariant = variant;
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

// Sin sesión: en la app normal (variant "splash") el login ya no tiene su
// propio formulario aquí — este link nomás te regresa a la pantalla de
// bienvenida (ver js/splash.js, "Soy jugador"), que es donde de verdad se
// hace. admin.html (variant "inline", ver mountAuthControl) sí necesita el
// formulario completo en el mismo lugar — es una página aparte, sin esa
// pantalla de bienvenida, y sin router de rutas (solo de secciones), así
// que un link a "otra página" nunca hubiera funcionado ahí.
function loggedOutMarkup() {
  if (loginVariant === "inline") {
    return `
      <form id="auth-login-form" class="auth-login-inline">
        <input type="email" name="email" placeholder="Correo" required autocomplete="username">
        <input type="password" name="password" placeholder="Contraseña" required autocomplete="current-password">
        <button type="submit" class="auth-btn auth-btn-icon" aria-label="Entrar"><i class="fa-solid fa-right-to-bracket"></i></button>
      </form>
      <button type="button" id="auth-forgot-btn" class="auth-forgot-link">¿Olvidaste tu contraseña?</button>
      <p class="auth-error" id="auth-login-error" hidden></p>
    `;
  }
  return `
    <a href="#" class="auth-btn auth-btn-named" id="splash-login-link" aria-label="Iniciar sesión">
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
  // Chip con tu foto (o iniciales) junto al nombre — foto fija de data.js
  // nomás, sin la personalizada de Storage: js/auth.js no puede importar
  // getAvatarUrl() de js/db.js (import circular, db.js ya importa de
  // aquí — ver el comentario de changePassword() más abajo). La foto
  // subida a Storage sí se refleja aquí, pero la hidrata js/main.js desde
  // afuera (mismo patrón que hydrateAvatars() en otras vistas) en cuanto
  // dispara "caimanes:auth-changed".
  const pill = player
    ? `<a href="#/jugador/${playerId}" class="auth-btn auth-btn-in auth-btn-named" aria-label="Ir a tu perfil">
         <span class="auth-btn-avatar" data-avatar="${playerId}">${renderAvatar(player, 28)}</span>
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

  // "Iniciar sesión" de la app normal (variant "splash", ver
  // loggedOutMarkup) — te regresa a la pantalla de bienvenida a loguearte
  // ahí (mismo velo de salida que signOut, ver leaveToSplash arriba).
  containerEl.querySelector("#splash-login-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    leaveToSplash();
  });

  // Formulario inline de admin.html (ver loggedOutMarkup) — no existe en
  // la app normal (variant "splash").
  const loginForm = containerEl.querySelector("#auth-login-form");
  if (loginForm) {
    const errorEl = containerEl.querySelector("#auth-login-error");
    const submitBtn = loginForm.querySelector("button");
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      const { email, password } = Object.fromEntries(new FormData(loginForm));
      try {
        await signIn(email, password);
        // Éxito: onAuthStateChange repinta el header solo; el spinner se va
        // con el re-render, no hace falta quitarlo a mano.
      } catch (error) {
        submitBtn.classList.remove("is-loading");
        submitBtn.disabled = false;
        errorEl.textContent = loginErrorMessage(error);
        errorEl.hidden = false;
      }
    });

    containerEl.querySelector("#auth-forgot-btn")?.addEventListener("click", async () => {
      const email = loginForm.querySelector('[name="email"]').value.trim();
      errorEl.hidden = true;
      if (!email) {
        errorEl.textContent = "Escribe tu correo arriba primero.";
        errorEl.hidden = false;
        return;
      }
      try {
        await resetPassword(email);
        errorEl.className = "auth-ok";
        errorEl.textContent = "Te mandamos un correo para restablecer tu contraseña.";
        errorEl.hidden = false;
      } catch (error) {
        errorEl.className = "auth-error";
        errorEl.textContent = loginErrorMessage(error);
        errorEl.hidden = false;
      }
    });
  }
}
