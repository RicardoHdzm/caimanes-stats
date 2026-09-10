// Restablecer contraseña (#recovery-gate en index.html) — "¿Olvidaste tu
// contraseña?" en js/splash.js (o en el login inline de admin.html) manda
// un correo con un link de recuperación; Supabase regresa aquí mismo con
// un token en la URL. El cliente lo detecta solo (detectSessionInUrl,
// default) y dispara "PASSWORD_RECOVERY" en onAuthStateChange (ver
// initAuth en js/auth.js), que a su vez avisa con
// "caimanes:password-recovery" — eso es lo que destapa esta pantalla.
// Mientras está abierta tapa todo lo demás: no tiene caso dejar navegar el
// sitio a medio poner la contraseña nueva.
import { changePassword } from "./auth.js";

// Se llama una vez desde js/main.js al arrancar. No hace nada si la página
// no trae el gate (admin.html, lineup/).
export function initRecovery() {
  const gate = document.getElementById("recovery-gate");
  if (!gate) return;

  const form = gate.querySelector("#recovery-form");
  const errorEl = gate.querySelector("#recovery-error");
  const submitBtn = form.querySelector("button");

  window.addEventListener("caimanes:password-recovery", () => {
    gate.hidden = false;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const { password, password2 } = Object.fromEntries(new FormData(form));
    if (password !== password2) {
      errorEl.textContent = "Las contraseñas no coinciden.";
      errorEl.hidden = false;
      return;
    }
    submitBtn.disabled = true;
    try {
      await changePassword(password);
      // Recarga limpia a la portada (sin el token de recuperación en la
      // URL): ya quedaste con sesión, así que el flujo normal de la
      // bienvenida (js/splash.js) te auto-entra. Recargar en vez de solo
      // quitar el gate porque ahora la app no se pinta hasta "entrar" (ver
      // startApp() en js/main.js) — este gate se mostró en su lugar.
      location.href = "./";
    } catch {
      errorEl.textContent = "No se pudo guardar — intenta de nuevo.";
      errorEl.hidden = false;
      submitBtn.disabled = false;
    }
  });
}
