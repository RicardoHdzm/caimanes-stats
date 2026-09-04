// Controla el acceso a admin.html completo (no solo el estado de pago) —
// solo la cuenta del coach puede ver/usar los formularios de adentro. Es un
// candado de UI, no de seguridad real: admin.js nunca escribe en Supabase
// (solo genera texto para pegar a mano en data.js) — y el estado de pago
// (ver abajo) tampoco escribe nada, ya no depende de Supabase en absoluto.
import { PLAYERS } from "./data.js";
import { initAuth, mountAuthControl, isCoach } from "./auth.js";
import { getDuesMap } from "./db.js";

const gate = document.getElementById("admin-gate");
const protectedEl = document.getElementById("admin-protected");
const listEl = document.getElementById("dues-admin-list");

// Solo lectura: el estado de pago ya no vive en Supabase (ver DUES_PAID en
// js/data.js y getDuesMap en js/db.js), así que aquí no hay nada que
// guardar — un checkbox editable sería mentira (se vería marcado/desmarcado
// pero no pasaría nada al recargar). Esta lista es nomás para confirmar de
// un vistazo el estado actual antes de tocar el código.
function rowMarkup(player, paid) {
  return `
    <div class="dues-admin-row${paid ? " paid" : ""}">
      <span>#${player.number ?? "-"} ${player.name}</span>
      <span class="dues-admin-status">${paid ? "Pagado" : "Pendiente"}</span>
    </div>
  `;
}

async function render() {
  if (!isCoach()) {
    protectedEl.hidden = true;
    gate.hidden = false;
    return;
  }
  gate.hidden = true;
  protectedEl.hidden = false;

  const duesMap = await getDuesMap();
  listEl.innerHTML = PLAYERS.map((p) => rowMarkup(p, duesMap.get(p.id) ?? true)).join("");
}

mountAuthControl(document.getElementById("auth-slot"));
window.addEventListener("caimanes:auth-changed", render);
render();
initAuth();
