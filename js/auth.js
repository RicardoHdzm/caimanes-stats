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

// Se llama una sola vez desde js/main.js al arrancar la app. Si Supabase
// todavía no está configurado (Fase 0 del plan sin terminar), no intenta
// conectarse — evita un error de red confuso antes de tener proyecto.
export async function initAuth() {
  if (!SUPABASE_CONFIGURED) return;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data } = await supabase.auth.getSession();
  session = data.session;
  await resolvePlayerId();
  notifyChange();

  supabase.auth.onAuthStateChange(async (_event, newSession) => {
    session = newSession;
    await resolvePlayerId();
    notifyChange();
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

export async function changePassword(newPassword) {
  if (!supabase) throw new Error("Supabase no está configurado todavía.");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
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
    <button type="button" class="auth-btn" id="auth-toggle" aria-expanded="false" aria-label="Iniciar sesión">
      <i class="fa-solid fa-right-to-bracket"></i>
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
  const name = PLAYERS.find((p) => p.id === playerId)?.name ?? session?.user?.email ?? "Cuenta";
  return `
    <button type="button" class="auth-btn auth-btn-in" id="auth-toggle" aria-expanded="false" aria-label="Tu cuenta">
      <i class="fa-solid fa-user-check"></i>
    </button>
    <div class="auth-panel" id="auth-panel" hidden>
      <h4>${name}</h4>
      <form id="auth-password-form" class="auth-form">
        <label>Nueva contraseña<input type="password" name="password" minlength="6" required autocomplete="new-password"></label>
        <p class="auth-error" id="auth-error" hidden></p>
        <p class="auth-ok" id="auth-ok" hidden>Contraseña actualizada.</p>
        <button type="submit" class="auth-submit">Cambiar contraseña</button>
      </form>
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

  const passwordForm = containerEl.querySelector("#auth-password-form");
  passwordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = containerEl.querySelector("#auth-error");
    const okEl = containerEl.querySelector("#auth-ok");
    errorEl.hidden = true;
    okEl.hidden = true;
    const { password } = Object.fromEntries(new FormData(passwordForm));
    try {
      await changePassword(password);
      okEl.hidden = false;
      passwordForm.reset();
    } catch (err) {
      errorEl.textContent = "No se pudo cambiar — intenta de nuevo.";
      errorEl.hidden = false;
    }
  });

  containerEl.querySelector("#auth-signout-btn")?.addEventListener("click", async () => {
    await signOut();
    setPanelOpen(false);
  });
}
