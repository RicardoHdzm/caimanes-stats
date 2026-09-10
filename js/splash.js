// Pantalla de bienvenida (#splash-gate en index.html) — video de fondo,
// logo grande y dos botones: "Soy jugador" abre el login AQUÍ MISMO (ya no
// hay una página #/login aparte — ver showLogin() abajo); "Soy invitado"
// entra directo al sitio.
//
// Es una pantalla INDEPENDIENTE, no un overlay: js/main.js NO pinta la app
// hasta que esta pantalla llama a `onEnter` (ver initSplash abajo y
// startApp() en js/main.js). Mientras se ve la bienvenida, #app está vacío.
//
// Solo aparece una vez por sesión del navegador (sessionStorage, no
// localStorage — vuelve a aparecer si cierras la pestaña/navegador y
// regresas, o si cierras sesión — ver signOut() en js/auth.js — pero no cada
// vez que navegas dentro del sitio).
import { signIn, getSession, resetPassword, loginErrorMessage } from "./auth.js";
import { preloadOverrides } from "./db.js";
import { SUPABASE_CONFIGURED } from "./supabase-config.js";

const STORAGE_KEY = "caimanes-entered";

// Cuánto esperar como mucho a que initAuth() resuelva la sesión antes de
// entrar igual. Sin señal Supabase puede tardar; la app maneja bien sesión
// null y se repinta sola con "caimanes:auth-changed" cuando por fin llegue.
const AUTH_WAIT_MS = 3500;

function hasEntered() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Sin sessionStorage (modo privado, etc.) se muestra siempre — no es
    // ideal, pero tampoco rompe nada.
    return false;
  }
}

function markEntered() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Ver hasEntered() — sin storage simplemente no se recuerda.
  }
}

// Espera a "caimanes:auth-ready" (lo dispara initAuth() en js/auth.js cuando
// la sesión ya se resolvió, pase lo que pase) o a que se acabe el tiempo.
// Sin Supabase configurado no hay nada que esperar.
function waitForAuth() {
  if (!SUPABASE_CONFIGURED) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("caimanes:auth-ready", finish);
      resolve();
    };
    window.addEventListener("caimanes:auth-ready", finish);
    setTimeout(finish, AUTH_WAIT_MS);
  });
}

// Se llama una vez desde js/main.js al arrancar. `onEnter` arranca la app
// (startApp() → render()). js/main.js solo vive en index.html, que siempre
// trae el gate; el guard es por si acaso — sin gate, arranca la app directo
// para no dejarla sin pintar nunca.
export function initSplash(onEnter) {
  const gate = document.getElementById("splash-gate");
  if (!gate) {
    onEnter?.();
    return;
  }

  const actions = gate.querySelector("#splash-actions");

  // Volviendo del correo de "olvidé mi contraseña" — Supabase manda el
  // token de recuperación en el hash de la URL (#access_token=...&type=
  // recovery). Esa pantalla la atiende #recovery-gate (ver js/recovery.js),
  // que tapa todo igual que este gate. Se arranca la app por debajo de una
  // vez: si por lo que sea el token nunca llega (Supabase caído), mejor ver
  // la app que una pantalla en blanco.
  if (location.hash.includes("type=recovery")) {
    gate.remove();
    onEnter?.();
    return;
  }

  let entering = false;

  // Quita el gate (con un fundido corto) y arranca la app. Antes, mostrando
  // el spinner, espera a: (1) que la sesión se resuelva, y (2) que se
  // precarguen las posiciones personalizadas del roster — así la app se
  // revela ya completa, sin que se vea "cargar" nada entre pestañas (a
  // petición expresa). Las dos esperas tienen su propio tope de tiempo: sin
  // señal, se entra igual y la app cae de vuelta a los datos de data.js.
  async function enterApp() {
    if (entering) return;
    entering = true;
    markEntered();
    showLoading();
    await waitForAuth();
    await Promise.race([
      preloadOverrides().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
    onEnter?.();
    gate.classList.add("splash-gate--leaving");
    const done = () => gate.remove();
    gate.addEventListener("transitionend", done, { once: true });
    // Respaldo por si transitionend no dispara (prefers-reduced-motion
    // apaga la transición, ver css/styles.css).
    setTimeout(done, 500);
  }

  // Estado de carga: se quita el video y los botones, queda el logo (ya
  // está en .splash-content) + un spinner. Lo usa enterApp() y también el
  // regreso a media sesión de abajo.
  function showLoading() {
    gate.querySelector(".splash-video")?.remove();
    actions.innerHTML = `
      <div class="splash-loading">
        <span class="spinner" aria-hidden="true"></span>
        <span>Entrando…</span>
      </div>
    `;
  }

  // Ya se entró esta sesión, o ya hay sesión activa de una visita anterior
  // (Supabase la recuerda entre visitas aunque "ya elegí algo esta sesión"
  // no): no se muestran los botones, se va directo — pero con el spinner,
  // no de golpe, para no dejar ver el sitio a medio pintar.
  if (hasEntered() || getSession()) {
    enterApp();
    return;
  }

  // initAuth() resuelve async: si había sesión guardada y llega tarde,
  // también se auto-entra.
  function skipIfAlreadySignedIn() {
    if (!gate.isConnected) {
      window.removeEventListener("caimanes:auth-changed", skipIfAlreadySignedIn);
      return;
    }
    if (getSession()) enterApp();
  }
  window.addEventListener("caimanes:auth-changed", skipIfAlreadySignedIn);

  // Recién ahora vale la pena pedir el video (el <video> no trae `src` en el
  // HTML justo para esto — si se entró directo arriba, nunca se descarga).
  const video = gate.querySelector(".splash-video");
  if (video) video.src = "assets/video.mp4";

  function showButtons() {
    actions.innerHTML = `
      <button type="button" class="splash-btn splash-btn--accent" id="splash-player">Soy jugador</button>
      <button type="button" class="splash-btn" id="splash-guest">Soy invitado</button>
    `;
    actions.querySelector("#splash-player").addEventListener("click", showLogin);
    actions.querySelector("#splash-guest").addEventListener("click", enterApp);
  }

  // El mismo formulario que antes vivía en #/login (ver js/views/login.js,
  // ya no existe) — ahora aparece aquí mismo al elegir "Soy jugador", en
  // vez de mandarte a otra página.
  function showLogin() {
    actions.innerHTML = `
      <form id="splash-login-form" class="splash-login-form">
        <label>Correo<input type="email" name="email" required autocomplete="username"></label>
        <label>Contraseña<input type="password" name="password" required autocomplete="current-password"></label>
        <p class="splash-login-error" id="splash-login-error" hidden></p>
        <button type="submit" class="splash-btn splash-btn--accent">Entrar</button>
        <button type="button" class="splash-forgot-btn" id="splash-forgot">¿Olvidaste tu contraseña?</button>
        <button type="button" class="splash-back-btn" id="splash-back">← Volver</button>
      </form>
    `;
    const form = actions.querySelector("#splash-login-form");
    const errorEl = actions.querySelector("#splash-login-error");
    const submitBtn = form.querySelector(".splash-btn--accent");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      const { email, password } = Object.fromEntries(new FormData(form));
      try {
        await signIn(email, password);
        enterApp();
      } catch (error) {
        submitBtn.classList.remove("is-loading");
        submitBtn.disabled = false;
        errorEl.className = "splash-login-error";
        errorEl.textContent = loginErrorMessage(error);
        errorEl.hidden = false;
      }
    });

    // Manda el correo de recuperación de Supabase al que esté escrito
    // arriba — no pide un campo aparte, reusa el de correo del login.
    actions.querySelector("#splash-forgot").addEventListener("click", async () => {
      const email = form.querySelector('[name="email"]').value.trim();
      errorEl.hidden = true;
      if (!email) {
        errorEl.className = "splash-login-error";
        errorEl.textContent = "Escribe tu correo arriba primero.";
        errorEl.hidden = false;
        return;
      }
      try {
        await resetPassword(email);
        errorEl.className = "splash-login-ok";
        errorEl.textContent = "Te mandamos un correo para restablecer tu contraseña.";
        errorEl.hidden = false;
      } catch (error) {
        errorEl.className = "splash-login-error";
        errorEl.textContent = loginErrorMessage(error);
        errorEl.hidden = false;
      }
    });

    actions.querySelector("#splash-back").addEventListener("click", showButtons);
  }

  // Si skipIfAlreadySignedIn() de arriba ya alcanzó a arrancar enterApp()
  // (sesión resuelta y activa desde el primer chequeo), no hay nada más que
  // pintar.
  if (gate.isConnected && !entering) showButtons();
}
