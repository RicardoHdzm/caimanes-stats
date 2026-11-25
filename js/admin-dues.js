// Controla el acceso a admin.html completo (no solo el estado de pago) —
// solo la cuenta del coach puede ver/usar los formularios de adentro. Es un
// candado de UI, no de seguridad real: admin.js nunca escribe en Supabase
// (solo genera texto para pegar a mano en data.js) — y el estado de pago
// (ver abajo) tampoco escribe nada, ya no depende de Supabase en absoluto.
import { ROSTER, DUES_FEE, GAME_COST, TEAM } from "./data.js";
import { initAuth, mountAuthControl, isCoach } from "./auth.js";
import { getDuesDetail } from "./db.js";
import { SUPABASE_CONFIGURED } from "./supabase-config.js";

const gate = document.getElementById("admin-gate");
const protectedEl = document.getElementById("admin-protected");
const listEl = document.getElementById("dues-admin-list");
const summaryEl = document.getElementById("dues-admin-summary");

const money = (n) => `$${n.toLocaleString("es-MX")}`;

// Solo lectura: el estado de pago ya no vive en Supabase (ver DUES_PAID en
// js/data.js y getDuesMap en js/db.js), así que aquí no hay nada que
// guardar — un checkbox editable sería mentira (se vería marcado/desmarcado
// pero no pasaría nada al recargar). Esta lista es nomás para confirmar de
// un vistazo el estado actual antes de tocar el código.
function rowMarkup(player, { status: paid, amount }) {
  return `
    <div class="dues-admin-row${paid === "saldo" ? " partial" : paid ? " paid" : ""}">
      <span>#${player.number ?? "-"} ${player.name}</span>
      <span class="dues-admin-status">${paid === "saldo" ? "Abonando" : paid ? "Pagado" : "Pendiente"}<span class="dues-admin-amount">${amount === null ? "¿?" : money(amount)}</span></span>
    </div>
  `;
}

// Recaudado, para cuántos juegos alcanza (GAME_COST c/u) y cuánto sobra.
function summaryMarkup(detail) {
  const amounts = [...detail.values()].map((d) => d.amount);
  const total = amounts.reduce((sum, a) => sum + (a ?? 0), 0);
  const unknown = amounts.filter((a) => a === null).length;
  const games = Math.floor(total / GAME_COST);
  const left = total - games * GAME_COST;
  const stat = (label, value, note = "") =>
    `<div class="dues-admin-stat"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ""}</div>`;
  return [
    stat("Recaudado", money(total), unknown ? `sin contar ${unknown} abono${unknown === 1 ? "" : "s"} sin cantidad` : `de ${money(ROSTER.length * DUES_FEE)}`),
    stat("Juegos pagados", `${games} de ${TEAM.gamesInSeason}`, `${money(GAME_COST)} por juego`),
    stat("Sobrante", money(left), left > 0 ? `faltan ${money(GAME_COST - left)} para otro juego` : ""),
  ].join("");
}

async function render() {
  // Con Supabase pausado no hay forma de iniciar sesión, así que el candado
  // se levanta (ver SUPABASE_PAUSED en js/supabase-config.js).
  if (SUPABASE_CONFIGURED && !isCoach()) {
    protectedEl.hidden = true;
    gate.hidden = false;
    return;
  }
  gate.hidden = true;
  protectedEl.hidden = false;

  const detail = getDuesDetail(ROSTER.map((p) => p.id));
  summaryEl.innerHTML = summaryMarkup(detail);
  listEl.innerHTML = ROSTER.map((p) => rowMarkup(p, detail.get(p.id))).join("");
}

// { loginVariant: "inline" }: admin.html no tiene la pantalla de
// bienvenida de js/splash.js (esa es solo de la app normal) — aquí el
// login sigue viviendo en el header, es la única forma de entrar (ver
// loggedOutMarkup en js/auth.js).
mountAuthControl(document.getElementById("auth-slot"), { loginVariant: "inline" });
window.addEventListener("caimanes:auth-changed", render);
render();
initAuth();
