// Controla el acceso a admin.html completo (no solo el estado de pago) —
// solo la cuenta del coach puede ver/usar los formularios de adentro. Es un
// candado de UI, no de seguridad real: admin.js nunca escribe en Supabase
// (solo genera texto para pegar a mano en data.js) — y el estado de pago
// (ver abajo) tampoco escribe nada, ya no depende de Supabase en absoluto.
import { ROSTER, DUES_FEE, GAME_COST, LEAGUE_FEE, TEAM, CURRENT_SEASON } from "./data.js";
import { initAuth, mountAuthControl, isCoach } from "./auth.js";
import { getDuesDetail } from "./db.js";
import { currentSeasonGames } from "./stats.js";
import { duesFlyer, openFlyer, shareButton } from "./flyers.js";
import { ordinalTemporada } from "./ui.js";
import { SUPABASE_CONFIGURED } from "./supabase-config.js";

const gate = document.getElementById("admin-gate");
const protectedEl = document.getElementById("admin-protected");
const listEl = document.getElementById("dues-admin-list");
const summaryEl = document.getElementById("dues-admin-summary");
const shareEl = document.getElementById("dues-admin-share");

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

// Recaudado, inscripción a la liga, juegos ya pagados (los jugados de la
// temporada, GAME_COST c/u, salen solos de GAMES) y lo que queda en caja.
function duesTotals(detail) {
  const amounts = [...detail.values()].map((d) => d.amount);
  const total = amounts.reduce((sum, a) => sum + (a ?? 0), 0);
  const unknown = amounts.filter((a) => a === null).length;
  const played = currentSeasonGames().length;
  const spent = played * GAME_COST;
  return { total, unknown, played, spent, left: total - LEAGUE_FEE - spent };
}

function summaryMarkup(detail) {
  const { total, unknown, played, spent, left } = duesTotals(detail);
  const more = Math.floor(Math.max(left, 0) / GAME_COST);
  const stat = (label, value, note = "") =>
    `<div class="dues-admin-stat"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ""}</div>`;
  return [
    stat("Recaudado", money(total), unknown ? `sin contar ${unknown} abono${unknown === 1 ? "" : "s"} sin cantidad` : `de ${money(ROSTER.length * DUES_FEE)}`),
    stat("Inscripción liga", money(LEAGUE_FEE)),
    stat("Juegos pagados", `${played} de ${TEAM.gamesInSeason}`, `${money(spent)} (${money(GAME_COST)} por juego)`),
    stat(
      "Restante",
      left < 0 ? `−${money(-left)}` : money(left),
      left < 0 ? "Recaudado − inscripción − juegos · falta dinero" : `Recaudado − inscripción − juegos · alcanza para ${more} juego${more === 1 ? "" : "s"} más`
    ),
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
  if (!shareEl.hasChildNodes()) shareEl.append(shareButton(openDuesFlyer, "Imagen para el grupo"));
}

// Imagen tipo anuncio para el grupo de WhatsApp (js/flyers.js): totales +
// cada jugador con su cantidad. Pendientes primero, luego abonando y al
// final los que ya pagaron.
const STATUS_ORDER = (s) => (s === false ? 0 : s === "saldo" ? 1 : 2);
function openDuesFlyer() {
  const detail = getDuesDetail(ROSTER.map((p) => p.id));
  const { total, played, left } = duesTotals(detail);
  const rows = ROSTER.map((p) => ({ name: p.name, ...detail.get(p.id) })).sort(
    (a, b) => STATUS_ORDER(a.status) - STATUS_ORDER(b.status) || a.name.localeCompare(b.name, "es")
  );
  const today = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long" }).toUpperCase();
  const data = { dateLabel: `CORTE AL ${today}`, total, leagueFee: LEAGUE_FEE, played, gamesInSeason: TEAM.gamesInSeason, left, rows };
  openFlyer(
    (format, color) => duesFlyer(data, format, color),
    "estado-de-pago",
    `Estado de pago · ${ordinalTemporada(CURRENT_SEASON)} Temporada`
  );
}

// { loginVariant: "inline" }: admin.html no tiene la pantalla de
// bienvenida de js/splash.js (esa es solo de la app normal) — aquí el
// login sigue viviendo en el header, es la única forma de entrar (ver
// loggedOutMarkup en js/auth.js).
mountAuthControl(document.getElementById("auth-slot"), { loginVariant: "inline" });
window.addEventListener("caimanes:auth-changed", render);
render();
initAuth();
