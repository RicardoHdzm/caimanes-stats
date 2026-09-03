// Sección "Próximo juego" en admin.html — quién confirmó asistencia, quién
// dijo que no, y quién no ha respondido. En Resumen (el sitio público) solo
// se ven los botones Sí/No, sin esta lista — vive aquí, no allá.
//
// No hace falta comprobar isCoach(): esta sección entera vive dentro de
// #admin-protected, que ya está oculto para cualquiera que no sea el coach
// (ver js/admin-dues.js). game_rsvps además es de lectura pública por RLS
// (igual que en Resumen), así que ni siquiera hace falta sesión para leerla
// — solo para verla, que ya lo resuelve el contenedor.
import { SCHEDULE, PLAYERS } from "./data.js";
import { getRsvps } from "./db.js";

const contentEl = document.getElementById("admin-rsvp-content");

function playerChip(player) {
  return `<span class="rsvp-admin-chip">#${player.number ?? "-"} ${player.name}</span>`;
}

function columnMarkup(title, cls, players) {
  return `
    <div class="rsvp-admin-col">
      <h4 class="${cls}">${title} (${players.length})</h4>
      ${players.length > 0 ? players.map(playerChip).join("") : '<p class="subtitle">Nadie.</p>'}
    </div>
  `;
}

async function renderGame(game) {
  const rows = await getRsvps(game.id);
  const yesIds = new Set(rows.filter((r) => r.status === "yes").map((r) => r.player_id));
  const noIds = new Set(rows.filter((r) => r.status === "no").map((r) => r.player_id));
  const yes = PLAYERS.filter((p) => yesIds.has(p.id));
  const no = PLAYERS.filter((p) => noIds.has(p.id));
  const pending = PLAYERS.filter((p) => !yesIds.has(p.id) && !noIds.has(p.id));

  const el = document.getElementById(`rsvp-admin-${game.id}`);
  if (!el) return;
  el.innerHTML =
    columnMarkup("Van", "stat-green", yes) + columnMarkup("No van", "stat-red", no) + columnMarkup("Sin responder", "", pending);
}

async function render() {
  if (!contentEl) return;
  if (SCHEDULE.length === 0) {
    contentEl.innerHTML = '<p class="subtitle">No hay ningún juego programado todavía.</p>';
    return;
  }
  contentEl.innerHTML = SCHEDULE.map(
    (g) => `
      <div class="rsvp-admin-game">
        <h3>${g.date}${g.time ? ` — ${g.time}` : ""} vs ${g.opponent}</h3>
        <div id="rsvp-admin-${g.id}" class="rsvp-admin-cols"></div>
      </div>
    `
  ).join("");
  for (const g of SCHEDULE) await renderGame(g);
}

// initAuth() (llamado desde js/admin-dues.js, que carga antes) es async —
// si este primer render() corre antes de que termine, getRsvps() todavía no
// tiene cliente y regresa []. Se vuelve a pintar solo cuando esté listo.
window.addEventListener("caimanes:auth-changed", render);
render();
