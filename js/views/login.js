// Página de "Iniciar sesión" (#/login) — antes vivía como un desplegable
// chico anclado al botón del header (ver loggedOutMarkup() en js/auth.js);
// ahora es su propia ruta, a petición expresa. El botón del header sigue
// siendo la entrada normal (ahora es un link a #/login en vez de un botón
// que abre un panel), pero cualquiera puede llegar aquí directo por URL.
import { getSession, signIn } from "../auth.js";

// A dónde regresar después de iniciar sesión — el link del header guarda
// aquí el hash en el que estabas ANTES de venir a esta página (ver
// wireAuthControl en js/auth.js), así "iniciar sesión desde un juego" te
// regresa a ese juego en vez de mandarte siempre a Resumen. Si no hay nada
// guardado (llegaste por URL directa, o recargaste ya en #/login), Resumen
// es el destino por default.
const RETURN_KEY = "caimanes-login-return";

function consumeReturnTo() {
  const returnTo = sessionStorage.getItem(RETURN_KEY) || "#/resumen";
  sessionStorage.removeItem(RETURN_KEY);
  return returnTo;
}

export function renderLogin(container) {
  // Ya hay sesión iniciada (llegaste por URL directa, o el botón atrás del
  // navegador te trajo aquí después de loguearte) — no tiene caso mostrar
  // el formulario, regresa a donde estabas.
  if (getSession()) {
    location.hash = consumeReturnTo();
    return;
  }

  // Envuelto en .login-page para centrar el título solo aquí (ver
  // css/styles.css) — el h2 normal es inline-block alineado a la
  // izquierda en el resto del sitio, no se toca ese estilo global.
  const page = document.createElement("div");
  page.className = "login-page";
  page.innerHTML = `
    <h2>Iniciar sesión</h2>
    <div class="leader-card player-standalone-card login-card">
      <form id="login-form" class="auth-form">
        <label>Correo<input type="email" name="email" required autocomplete="username"></label>
        <label>Contraseña<input type="password" name="password" required autocomplete="current-password"></label>
        <p class="auth-error" id="login-error" hidden></p>
        <button type="submit" class="auth-submit">Entrar</button>
      </form>
    </div>
  `;
  container.appendChild(page);

  const form = page.querySelector("#login-form");
  const errorEl = page.querySelector("#login-error");
  const submitBtn = form.querySelector(".auth-submit");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;
    const { email, password } = Object.fromEntries(new FormData(form));
    try {
      await signIn(email, password);
      location.hash = consumeReturnTo();
    } catch {
      errorEl.textContent = "Correo o contraseña incorrectos.";
      errorEl.hidden = false;
      submitBtn.disabled = false;
    }
  });
}
