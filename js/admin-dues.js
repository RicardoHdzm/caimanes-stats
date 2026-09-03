// Sección de "Estado de pago" en admin.html — aparte de js/admin.js (que
// solo genera código para pegar en data.js y nunca habla con Supabase)
// porque esto sí necesita sesión y escribe directo en player_dues. Se
// muestra nada más si quien inició sesión es la cuenta del coach
// (isCoach() en js/auth.js) — el resto de admin.html sigue siendo público
// y funciona igual sin login, como siempre.
import { PLAYERS } from "./data.js";
import { initAuth, mountAuthControl, isCoach } from "./auth.js";
import { getDuesMap, setDuesPaid } from "./db.js";

const section = document.getElementById("dues-admin-section");
const gate = document.getElementById("dues-admin-gate");
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
    section.hidden = true;
    gate.hidden = false;
    return;
  }
  gate.hidden = true;
  section.hidden = false;

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
