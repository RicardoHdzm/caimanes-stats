// Comentarios en el detalle de un juego. Lectura pública; comentar requiere
// cuenta vinculada a un jugador (cualquiera, no solo quien jugó ese juego).
// Un comentario por jugador por juego — si ya tienes uno, el mismo
// formulario lo pre-llena y lo edita en vez de crear uno nuevo.
import { PLAYERS } from "../data.js";
import { getCurrentPlayerId } from "../auth.js";
import { getComments, upsertComment } from "../db.js";
import { escapeHtml } from "../ui.js";

function formatDate(iso) {
  const date = new Date(iso);
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function commentItem(c) {
  const name = PLAYERS.find((p) => p.id === c.player_id)?.name ?? c.player_id;
  return `
    <div class="comment-item">
      <div class="comment-meta">
        <span class="comment-author">${escapeHtml(name)}</span>
        <span class="comment-date">${formatDate(c.created_at)}</span>
      </div>
      <p class="comment-body">${escapeHtml(c.body)}</p>
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
    listEl.innerHTML =
      comments.length > 0
        ? comments.map(commentItem).join("")
        : '<p class="subtitle">Sin comentarios todavía.</p>';

    if (myId) {
      const mine = comments.find((c) => c.player_id === myId);
      renderForm(mine?.body ?? null);
    }
  }

  if (!myId) {
    formSlot.innerHTML = '<p class="auth-hint">Inicia sesión para comentar.</p>';
  }

  refresh();
}
