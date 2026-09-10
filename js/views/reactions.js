// Reacciones con emoji — compartidas entre los comentarios de un juego
// (js/views/comments.js) y el feed de Inicio (js/views/feed.js). UNA
// reacción por persona por ítem; se puede cambiar de emoji o quitar. La
// escritura a Supabase la hace cada llamador (comment_likes /
// announcement_likes / feed_reactions, todas con el mismo shape) — aquí
// solo vive el markup de la barra y el manejo de clics.
import { getCurrentPlayerId } from "../auth.js";
import { escapeHtml } from "../ui.js";

export const REACTIONS = ["❤️", "🔥", "💪", "😂", "👏", "⚾", "🐊"];

// `rows` = filas de la tabla de reacciones que corresponda: { player_id,
// reaction }. `itemId` va en data-id para que wireReactionBar() sepa a qué
// ítem pertenece cada barra. Sin `canReact` (invitado) solo se ven los
// conteos, sin poder tocar nada.
export function reactionBarHtml(itemId, rows, { canReact }) {
  const myId = getCurrentPlayerId();
  const counts = new Map();
  let mine = "";
  for (const r of rows) {
    counts.set(r.reaction, (counts.get(r.reaction) ?? 0) + 1);
    if (myId && r.player_id === myId) mine = r.reaction;
  }
  const chips = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([emoji, n]) =>
        `<button type="button" class="reaction-chip${mine === emoji ? " reaction-chip--mine" : ""}" data-reaction="${emoji}"${
          canReact ? "" : " disabled"
        }>${emoji} ${n}</button>`
    )
    .join("");
  const picker = canReact
    ? `<span class="reaction-add-wrap">
         <button type="button" class="reaction-add" aria-label="Reaccionar"><i class="fa-regular fa-face-smile"></i></button>
         <span class="reaction-menu" hidden>${REACTIONS.map(
           (e) => `<button type="button" data-reaction="${e}">${e}</button>`
         ).join("")}</span>
       </span>`
    : "";
  return `<div class="reaction-bar" data-id="${escapeHtml(String(itemId))}" data-mine="${mine}">${chips}${picker}</div>`;
}

// Conecta (delegado, en un contenedor que NUNCA se reemplaza) los clics de
// todas las barras que tenga adentro. `onSet(itemId, emoji)` /
// `onClear(itemId)` hacen la escritura; el llamador repinta al terminar
// (por eso no se restaura `disabled` en el camino feliz — el repintado trae
// botones nuevos).
export function wireReactionBar(container, { onSet, onClear }) {
  container.addEventListener("click", async (e) => {
    const addBtn = e.target.closest(".reaction-add");
    if (addBtn) {
      const menu = addBtn.parentElement.querySelector(".reaction-menu");
      if (menu) menu.hidden = !menu.hidden;
      return;
    }
    const pick = e.target.closest(".reaction-menu [data-reaction]");
    const chip = e.target.closest(".reaction-chip");
    const btn = pick || chip;
    if (!btn || btn.disabled) return;
    const bar = btn.closest(".reaction-bar");
    if (!bar) return;
    const id = bar.dataset.id;
    const emoji = btn.dataset.reaction;
    const mine = bar.dataset.mine || "";
    for (const b of bar.querySelectorAll("button")) b.disabled = true;
    try {
      // Tocar el chip que ya es TUYO = quitar la reacción. Elegir del menú, o
      // tocar el chip de otro emoji = poner/cambiar.
      if (chip && mine === emoji) {
        await onClear(id);
      } else {
        await onSet(id, emoji);
      }
    } catch {
      for (const b of bar.querySelectorAll("button")) b.disabled = false;
    }
  });
}
