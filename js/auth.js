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
        session = data.session;
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

let containerEl = null;
let outsideClickWired = false;

// Se llama una vez desde js/main.js al arrancar, y de nuevo cada vez que
// cambia la sesión (ver onAuthStateChange arriba).
export function mountAuthControl(el) {
  containerEl = el;
  if (!outsideClickWired) {
    document.addEventListener("click", () => setPanelOpen(false));
    outsideClickWired = true;
  }
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

function setPanelOpen(open) {
  const panel = containerEl?.querySelector("#auth-panel");
  const toggle = containerEl?.querySelector("#auth-toggle");
  if (!panel || !toggle) return;
  panel.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
}

function loggedOutMarkup() {
  return `
    <button type="button" class="auth-btn auth-btn-named" id="auth-toggle" aria-expanded="false" aria-label="Iniciar sesión">
      <i class="fa-solid fa-right-to-bracket"></i>
      <span class="auth-btn-name">Iniciar sesión</span>
    </button>
    <div class="auth-panel" id="auth-panel" hidden>
      <h4>Iniciar sesión</h4>
      <form id="auth-signin-form" class="auth-form">
        <label>Correo<input type="email" name="email" required autocomplete="username"></label>
        <label>Contraseña<input type="password" name="password" required autocomplete="current-password"></label>
        <p class="auth-error" id="auth-error" hidden></p>
        <button type="submit" class="auth-submit">Entrar</button>
      </form>
      <p class="auth-hint">¿No tienes cuenta? Pídesela al coach.</p>
    </div>
  `;
}

function loggedInMarkup() {
  // Con jugador ya identificado, el botón muestra tu nombre y despliega un
  // menú chico (Ir a perfil / Cerrar sesión, y para el coach también Ir al
  // Admin) — no navega directo, así se puede cerrar sesión desde cualquier
  // página sin pasar por el perfil.
  if (playerId) {
    const player = PLAYERS.find((p) => p.id === playerId);
    const label = player ? `#${player.number ?? "-"} - ${player.name}` : "Mi cuenta";
    return `
      <button type="button" class="auth-btn auth-btn-in auth-btn-named" id="auth-toggle" aria-expanded="false" aria-label="Tu cuenta">
        <span class="auth-btn-name">${label}</span>
      </button>
      <div class="auth-panel" id="auth-panel" hidden>
        <a href="#/jugador/${playerId}" class="auth-panel-link" id="auth-profile-link">
          <i class="fa-solid fa-id-card"></i> Ir a perfil
        </a>
        ${
          isCoach()
            ? `<a href="admin.html" class="auth-panel-link" id="auth-admin-link">
                 <i class="fa-solid fa-user-shield"></i> Ir al Admin
               </a>`
            : ""
        }
        <button type="button" class="auth-signout" id="auth-signout-btn">Cerrar sesión</button>
      </div>
    `;
  }
  // Cuenta con sesión pero sin vincular todavía a un jugador (falta la fila
  // en player_whitelist) — no hay a qué perfil mandarla, así que se queda
  // con un panel mínimo solo para poder cerrar sesión.
  return `
    <button type="button" class="auth-btn auth-btn-in auth-btn-named" id="auth-toggle" aria-expanded="false" aria-label="Tu cuenta">
      <i class="fa-solid fa-user-check"></i>
      <span class="auth-btn-name">Mi cuenta</span>
    </button>
    <div class="auth-panel" id="auth-panel" hidden>
      <h4>${session?.user?.email ?? "Cuenta"}</h4>
      <p class="auth-hint">Tu cuenta todavía no está vinculada a un jugador — pídeselo al coach.</p>
      <button type="button" class="auth-signout" id="auth-signout-btn">Salir</button>
    </div>
  `;
}

function wireAuthControl() {
  const toggle = containerEl.querySelector("#auth-toggle");
  const panel = containerEl.querySelector("#auth-panel");
  toggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    setPanelOpen(panel.hidden);
  });
  panel?.addEventListener("click", (e) => e.stopPropagation());

  const signinForm = containerEl.querySelector("#auth-signin-form");
  signinForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = containerEl.querySelector("#auth-error");
    errorEl.hidden = true;
    const { email, password } = Object.fromEntries(new FormData(signinForm));
    try {
      await signIn(email, password);
      setPanelOpen(false);
    } catch (err) {
      errorEl.textContent = "Correo o contraseña incorrectos.";
      errorEl.hidden = false;
    }
  });

  containerEl.querySelector("#auth-signout-btn")?.addEventListener("click", async () => {
    await signOut();
    setPanelOpen(false);
  });

  // El link de "Ir a perfil" navega solo (es un <a href>) — esto nomás
  // cierra el panel para que no se quede abierto sobre la página nueva.
  containerEl.querySelector("#auth-profile-link")?.addEventListener("click", () => setPanelOpen(false));
}
