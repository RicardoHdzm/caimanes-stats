// Controla el acceso a admin.html completo (no solo el estado de pago) —
// solo la cuenta del coach puede ver/usar los formularios de adentro. Es un
// candado de UI, no de seguridad real: admin.js nunca escribe en Supabase
// (solo genera texto para pegar a mano en data.js), así que no hay nada que
// proteger ahí más que el orden — lo único que sí escribe (player_dues) ya
// está protegido de verdad por RLS del lado del servidor (ver
// supabase/schema.sql), pase lo que pase aquí.
import { PLAYERS } from "./data.js";
import { initAuth, mountAuthControl, isCoach } from "./auth.js";
import { getDuesMap, setDuesPaid } from "./db.js";

const gate = document.getElementById("admin-gate");
const protectedEl = document.getElementById("admin-protected");
const listEl = document.getElementById("dues-admin-list");

function rowMarkup(player, paid) {
  return `
    <label class="dues-admin-row${paid ? " paid" : ""}" data-player="${player.id}">
      <span>#${player.number ?? "-"} ${player.name}</span>
      <input type="checkbox" ${paid ? "checked" : ""}>
    </label>
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
  listEl.innerHTML = PLAYERS.map((p) => rowMarkup(p, duesMap.get(p.id) ?? false)).join("");
}

listEl.addEventListener("change", async (e) => {
  const row = e.target.closest(".dues-admin-row");
  if (!row) return;
  const playerId = row.dataset.player;
  const checkbox = row.querySelector("input");
  const next = checkbox.checked;
  checkbox.disabled = true;
  try {
    await setDuesPaid(playerId, next);
    row.classList.toggle("paid", next);
  } catch {
    checkbox.checked = !next;
  } finally {
    checkbox.disabled = false;
  }
});

mountAuthControl(document.getElementById("auth-slot"));
window.addEventListener("caimanes:auth-changed", render);
render();
initAuth();
