// Pantalla de bienvenida (#splash-gate en index.html) — video de fondo,
// logo grande y dos botones: "Soy jugador" abre el login AQUÍ MISMO (ya no
// hay una página #/login aparte — ver showLogin() abajo); "Soy invitado"
// entra directo al sitio de siempre. Solo se ve una vez por sesión del
// navegador (sessionStorage, no localStorage — vuelve a aparecer si cierras
// la pestaña/navegador y regresas, o si cierras sesión — ver signOut() en
// js/auth.js — pero no cada vez que navegas dentro del sitio).
import { signIn, getSession } from "./auth.js";

const STORAGE_KEY = "caimanes-entered";

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

// Se llama una vez desde js/main.js al arrancar. No hace nada si la página
// no trae el gate (admin.html, lineup/).
export function initSplash() {
  const gate = document.getElementById("splash-gate");
  if (!gate) return;

  // Ya se eligió una opción esta sesión — se quita ANTES de que el
  // navegador llegue a pedir el video (por eso el <video> no trae `src`
  // en el HTML, se lo pone aquí abajo solo cuando sí hace falta mostrarlo).
  if (hasEntered()) {
    gate.remove();
    return;
  }

  const video = gate.querySelector(".splash-video");
  if (video) video.src = "assets/video.mp4";

  const actions = gate.querySelector("#splash-actions");

  function enter() {
    markEntered();
    gate.remove();
  }

  // Supabase recuerda tu sesión entre visitas (sobrevive cerrar el
  // navegador) aunque "ya elegiste algo esta sesión" no — sin esto, un
  // jugador que ya había iniciado sesión antes tendría que volver a elegir
  // cada vez que abre una pestaña nueva, aunque su sesión sigue activa. Al
  // arrancar la página initAuth() (js/main.js) todavía no ha resuelto la
  // sesión guardada, así que se checa aquí (por si acaso) y de nuevo cada
  // vez que avisa que terminó (o cambió) — "caimanes:auth-changed" dispara
  // igual con sesión null, por eso el chequeo real vive adentro.
  function skipIfAlreadySignedIn() {
    if (!gate.isConnected) {
      window.removeEventListener("caimanes:auth-changed", skipIfAlreadySignedIn);
      return;
    }
    if (getSession()) enter();
  }
  skipIfAlreadySignedIn();
  window.addEventListener("caimanes:auth-changed", skipIfAlreadySignedIn);

  function showButtons() {
    actions.innerHTML = `
      <button type="button" class="splash-btn splash-btn--accent" id="splash-player">Soy jugador</button>
      <button type="button" class="splash-btn" id="splash-guest">Soy invitado</button>
    `;
    actions.querySelector("#splash-player").addEventListener("click", showLogin);
    actions.querySelector("#splash-guest").addEventListener("click", enter);
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
      const { email, password } = Object.fromEntries(new FormData(form));
      try {
        await signIn(email, password);
        enter();
      } catch {
        errorEl.textContent = "Correo o contraseña incorrectos.";
        errorEl.hidden = false;
        submitBtn.disabled = false;
      }
    });
    actions.querySelector("#splash-back").addEventListener("click", showButtons);
  }

  // Si skipIfAlreadySignedIn() de arriba ya alcanzó a quitar el gate (sesión
  // ya resuelta y activa desde el primer chequeo), no hay nada más que
  // pintar.
  if (gate.isConnected) showButtons();
}
