// Reacciones con emoji — compartidas entre los comentarios de un juego
// (js/views/comments.js) y el feed de Inicio (js/views/feed.js). UNA
// reacción por persona por ítem; se puede cambiar de emoji o quitar. La
// escritura a Supabase la hace cada llamador (comment_likes /
// announcement_likes / feed_reactions, todas con el mismo shape) — aquí
// solo vive el markup de la barra y el manejo de clics.
//
// Son 7 emojis fijos, así que se muestran TODOS en línea (los que ya tienen
// reacciones con su conteo, el resto atenuados y tappables) — sin menú
// desplegable, que tapaba la tarjeta.
import { getCurrentPlayerId } from "../auth.js";
import { escapeHtml } from "../ui.js";

export const REACTIONS = ["❤️", "🔥", "💀", "⚾", "🐊"];

// `rows` = filas de la tabla de reacciones que corresponda: { player_id,
// reaction }. `itemId` va en data-id para que wireReactionBar() sepa a qué
// ítem pertenece cada barra. Sin `canReact` (invitado) solo se ven los
// emojis que YA tienen conteo, sin poder tocar nada.
export function reactionBarHtml(itemId, rows, { canReact }) {
  const myId = getCurrentPlayerId();
  const counts = new Map();
  let mine = "";
  for (const r of rows) {
    counts.set(r.reaction, (counts.get(r.reaction) ?? 0) + 1);
    if (myId && r.player_id === myId) mine = r.reaction;
  }
  const chips = REACTIONS.map((emoji) => {
    const n = counts.get(emoji) ?? 0;
    if (!canReact && n === 0) return ""; // invitado: solo los que tienen reacciones
    const cls =
      "reaction-chip" +
      (mine === emoji ? " reaction-chip--mine" : "") +
      (n === 0 ? " reaction-chip--empty" : "");
    return `<button type="button" class="${cls}" data-reaction="${emoji}"${canReact ? "" : " disabled"}>${emoji}${
      n ? ` ${n}` : ""
    }</button>`;
  }).join("");
  return `<div class="reaction-bar" data-id="${escapeHtml(String(itemId))}" data-mine="${mine}">${chips}</div>`;
}

// Conecta (delegado, en un contenedor que NUNCA se reemplaza) los clics de
// todas las barras que tenga adentro. `onSet(itemId, emoji)` /
// `onClear(itemId)` hacen la escritura; el llamador repinta al terminar
// (por eso no se restaura `disabled` en el camino feliz — el repintado trae
// botones nuevos).
export function wireReactionBar(container, { onSet, onClear }) {
  container.addEventListener("click", async (e) => {
    const btn = e.target.closest(".reaction-chip");
    if (!btn || btn.disabled) return;
    const bar = btn.closest(".reaction-bar");
    if (!bar) return;
    const id = bar.dataset.id;
    const emoji = btn.dataset.reaction;
    const mine = bar.dataset.mine || "";
    for (const b of bar.querySelectorAll("button")) b.disabled = true;
    try {
      // Tocar el emoji que ya es TUYO = quitar la reacción. Cualquier otro =
      // poner/cambiar.
      if (mine === emoji) await onClear(id);
      else await onSet(id, emoji);
    } catch {
      for (const b of bar.querySelectorAll("button")) b.disabled = false;
    }
  });
}
