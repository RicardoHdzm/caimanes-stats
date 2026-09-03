// Comentarios en el detalle de un juego. Lectura pública; comentar requiere
// cuenta vinculada a un jugador (cualquiera, no solo quien jugó ese juego).
// Un comentario por jugador por juego — si ya tienes uno, el mismo
// formulario lo pre-llena y lo edita en vez de crear uno nuevo (el `id` no
// cambia al editar, así que sus likes tampoco se pierden). Cada comentario
// tiene su propio like/unlike, uno por jugador (interruptor, no acumula).
import { PLAYERS } from "../data.js";
import { getCurrentPlayerId } from "../auth.js";
import { getComments, upsertComment, getCommentLikes, likeComment, unlikeComment } from "../db.js";
import { escapeHtml } from "../ui.js";

function formatDate(iso) {
  const date = new Date(iso);
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function commentItem(c, likeCount, likedByMe, canLike) {
  const name = PLAYERS.find((p) => p.id === c.player_id)?.name ?? c.player_id;
  return `
    <div class="comment-item">
      <div class="comment-meta">
        <span class="comment-author">${escapeHtml(name)}</span>
        <span class="comment-date">${formatDate(c.created_at)}</span>
      </div>
      <p class="comment-body">${escapeHtml(c.body)}</p>
      <button type="button" class="comment-like-btn${likedByMe ? " active" : ""}" data-comment="${c.id}"${canLike ? "" : " disabled"}>
        <i class="fa-solid fa-heart"></i> <span class="comment-like-count">${likeCount}</span>
      </button>
    </div>
  `;
}

export function renderComments(container, { contextType, contextId }) {
  const h3 = document.createElement("h3");
  h3.textContent = "Comentarios";
  container.appendChild(h3);

  const listEl = document.createElement("div");
  listEl.className = "comments-list";
  container.appendChild(listEl);

  const formSlot = document.createElement("div");
  container.appendChild(formSlot);

  const myId = getCurrentPlayerId();

  function renderForm(existingBody) {
    formSlot.innerHTML = `
      <form class="comment-form">
        <textarea maxlength="1000" placeholder="Escribe un comentario..." required>${escapeHtml(existingBody ?? "")}</textarea>
        <button type="submit" class="auth-submit">${existingBody ? "Guardar cambios" : "Comentar"}</button>
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
        await upsertComment(contextType, contextId, body);
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
    const likeCounts = new Map();
    const likedByMe = new Set();
    for (const like of likes) {
      likeCounts.set(like.comment_id, (likeCounts.get(like.comment_id) ?? 0) + 1);
      if (myId && like.player_id === myId) likedByMe.add(like.comment_id);
    }

    listEl.innerHTML =
      comments.length > 0
        ? comments.map((c) => commentItem(c, likeCounts.get(c.id) ?? 0, likedByMe.has(c.id), !!myId)).join("")
        : '<p class="subtitle">Sin comentarios todavía.</p>';

    if (myId) {
      const mine = comments.find((c) => c.player_id === myId);
      renderForm(mine?.body ?? null);
    }
  }

  // Delegado en listEl (nunca se reemplaza, solo su innerHTML) para que
  // siga funcionando después de cada refresh() — un listener puesto
  // directo en cada botón se perdería en cuanto la lista se repinte.
  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest(".comment-like-btn");
    if (!btn || btn.disabled) return;
    const commentId = Number(btn.dataset.comment);
    const alreadyLiked = btn.classList.contains("active");
    btn.disabled = true;
    try {
      if (alreadyLiked) {
        await unlikeComment(commentId);
      } else {
        await likeComment(commentId);
      }
      await refresh();
    } catch {
      btn.disabled = false;
    }
  });

  if (!myId) {
    formSlot.innerHTML = '<p class="auth-hint">Inicia sesión para comentar.</p>';
  }

  refresh();
}
