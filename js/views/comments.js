// Comentarios en el detalle de un juego. Leer y comentar requieren cuenta
// vinculada a un jugador (cualquiera, no solo quien jugó ese juego) — a
// petición expresa, la lectura ya no es pública. Un comentario por jugador
// por juego — no se editan: para "cambiar" el tuyo hay que borrarlo y
// escribir uno nuevo. El dueño puede borrar el suyo; el coach puede borrar
// cualquiera (moderación). Cada comentario tiene su propio like/unlike,
// uno por jugador (interruptor, no acumula).
import { PLAYERS } from "../data.js";
import { getCurrentPlayerId, isCoach } from "../auth.js";
import { getComments, addComment, deleteComment, getCommentLikes, likeComment, unlikeComment, getAvatarUrl } from "../db.js";
import { escapeHtml, renderAvatar } from "../ui.js";
import { reactionBarHtml, wireReactionBar } from "./reactions.js";

function formatDate(iso) {
  const date = new Date(iso);
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// Formato "burbuja de chat" (Instagram/Facebook), no la caja con borde de
// antes: avatar a la izquierda, nombre + texto dentro de una burbuja
// redondeada a la derecha, y like/borrar como texto chico DEBAJO de la
// burbuja (el "Me gusta · Responder" de Instagram) — a petición expresa, el
// sitio se ve más "red social" con sesión iniciada (esta sección ya es
// exclusiva de cuenta, ver renderComments() más abajo, así que no hace
// falta condicionar nada aquí).
function commentItem(c, reactionRows, canReact, canDelete) {
  const player = PLAYERS.find((p) => p.id === c.player_id);
  // Sin jugador que resolver (dato huérfano) se queda sin avatar ni link,
  // mismo criterio que antes. El span con data-avatar-player es el gancho
  // para reemplazar esto por la foto subida a Storage, si tiene una — ver
  // el .then(getAvatarUrl) en refresh() más abajo. Sin eso, se queda con lo
  // de siempre (foto fija de data.js o iniciales).
  const avatar = player
    ? `<a href="#/jugador/${player.id}" class="comment-avatar" data-avatar-player="${player.id}">${renderAvatar(player, 36)}</a>`
    : `<span class="comment-avatar"></span>`;
  const authorName = player
    ? `<a href="#/jugador/${player.id}" class="comment-author-name">${escapeHtml(player.name)}</a>`
    : `<span class="comment-author-name">${escapeHtml(c.player_id)}</span>`;
  return `
    <div class="comment-item">
      ${avatar}
      <div class="comment-main">
        <div class="comment-bubble">
          ${authorName}
          <p class="comment-body">${escapeHtml(c.body)}</p>
        </div>
        <div class="comment-actions">
          <span class="comment-date">${formatDate(c.created_at)}</span>
          ${reactionBarHtml(c.id, reactionRows, { canReact })}
          ${canDelete ? `<button type="button" class="comment-delete-btn" data-delete="${c.id}">Borrar</button>` : ""}
        </div>
      </div>
    </div>
  `;
}

export function renderComments(container, { contextType, contextId }) {
  // Comentarios (leer y escribir) son exclusivos de cuentas con sesión, a
  // petición expresa — sin cuenta la sección entera se omite: ni el
  // encabezado se pinta, no se deja un "inicia sesión para ver".
  const myId = getCurrentPlayerId();
  if (!myId) return;
  const coach = isCoach();

  const h3 = document.createElement("h3");
  h3.textContent = "Comentarios";
  container.appendChild(h3);

  const listEl = document.createElement("div");
  listEl.className = "comments-list";
  container.appendChild(listEl);

  const formSlot = document.createElement("div");
  container.appendChild(formSlot);

  function renderForm() {
    formSlot.innerHTML = `
      <form class="comment-form">
        <textarea maxlength="1000" placeholder="Escribe un comentario..." required></textarea>
        <button type="submit" class="auth-submit">Comentar</button>
      </form>
    `;
    const form = formSlot.querySelector("form");
    const textarea = form.querySelector("textarea");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = textarea.value.trim();
      if (!body) return;
      const btn = form.querySelector("button");
      btn.disabled = true;
      try {
        await addComment(contextType, contextId, body);
        await refresh();
      } catch {
        // Silencioso a propósito: un error de red no debe romper la
        // sección, se puede reintentar comentando de nuevo.
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function refresh() {
    const comments = await getComments(contextType, contextId);
    const likes = await getCommentLikes(comments.map((c) => c.id));
    const rowsByComment = new Map();
    for (const like of likes) {
      if (!rowsByComment.has(like.comment_id)) rowsByComment.set(like.comment_id, []);
      rowsByComment.get(like.comment_id).push({ player_id: like.player_id, reaction: like.reaction });
    }

    listEl.innerHTML =
      comments.length > 0
        ? comments
            .map((c) => commentItem(c, rowsByComment.get(c.id) ?? [], !!myId, coach || c.player_id === myId))
            .join("")
        : '<p class="subtitle">Sin comentarios todavía.</p>';

    // El avatar ya pintado arriba es el de siempre (foto fija de data.js o
    // iniciales, ver renderAvatar) — si alguien subió una foto propia a
    // Storage, la reemplaza aquí (mismo patrón que el perfil, ver
    // js/views/jugador.js). Un comentario por jugador por juego, así que no
    // hay ids repetidos que pedir dos veces.
    for (const c of comments) {
      getAvatarUrl(c.player_id).then((url) => {
        if (!url) return;
        const slot = listEl.querySelector(`[data-avatar-player="${c.player_id}"]`);
        if (!slot) return;
        const player = PLAYERS.find((p) => p.id === c.player_id);
        slot.innerHTML = `<img class="avatar" src="${url}" alt="${escapeHtml(player?.name ?? c.player_id)}" style="width:36px;height:36px;font-size:14.4px;">`;
      });
    }

    if (myId) {
      // Un comentario por jugador por juego: si ya tienes uno, no se
      // muestra el formulario (bórralo desde la lista para escribir otro).
      const mine = comments.some((c) => c.player_id === myId);
      if (mine) {
        formSlot.innerHTML = "";
      } else {
        renderForm();
      }
    }
  }

  // Reacciones — delegado en listEl (nunca se reemplaza, solo su innerHTML),
  // así sigue vivo después de cada refresh().
  wireReactionBar(listEl, {
    onSet: async (id, emoji) => {
      await likeComment(Number(id), emoji);
      await refresh();
    },
    onClear: async (id) => {
      await unlikeComment(Number(id));
      await refresh();
    },
  });

  // Borrar comentario — delegado en el mismo contenedor.
  listEl.addEventListener("click", async (e) => {
    const deleteBtn = e.target.closest(".comment-delete-btn");
    if (!deleteBtn) return;
    if (!confirm("¿Borrar este comentario?")) return;
    deleteBtn.disabled = true;
    try {
      await deleteComment(Number(deleteBtn.dataset.delete));
      await refresh();
    } catch {
      deleteBtn.disabled = false;
    }
  });

  refresh();
}
