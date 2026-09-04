// Sección "Anuncios" en admin.html — publicar y borrar. Vive dentro de
// #admin-protected (ver js/admin-dues.js), así que ya está oculta para
// cualquiera que no sea el coach; no hace falta comprobar isCoach() aquí,
// solo dejar que RLS rechace la escritura si algo se coló.
import { getAnnouncements, postAnnouncement, deleteAnnouncement, getAnnouncementLikes } from "./db.js";

const form = document.getElementById("announcement-form");
const listEl = document.getElementById("announcements-admin-list");

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long" });
}

// Solo lectura aquí (el coach no necesita darle like a su propio anuncio) —
// el conteo es nomás para que vea qué tanto "pegó" cada aviso.
function rowMarkup(a, likeCount) {
  const titleHtml = a.title ? `<strong>${a.title.replace(/</g, "&lt;")}</strong><br>` : "";
  return `
    <div class="announcement-admin-row" data-id="${a.id}">
      <p>
        <span class="announcement-date">${formatDate(a.created_at)}</span>${titleHtml}${a.body.replace(/</g, "&lt;")}
        <span class="announcement-admin-likes"><i class="fa-solid fa-heart"></i> ${likeCount}</span>
      </p>
      <button type="button" class="remove-row-btn" title="Borrar"><i class="fa-solid fa-trash"></i></button>
    </div>
  `;
}

async function render() {
  if (!listEl) return;
  const items = await getAnnouncements(20);
  if (items.length === 0) {
    listEl.innerHTML = '<p class="subtitle">Sin anuncios todavía.</p>';
    return;
  }
  const likes = await getAnnouncementLikes(items.map((a) => a.id));
  const likeCounts = new Map();
  for (const like of likes) likeCounts.set(like.announcement_id, (likeCounts.get(like.announcement_id) ?? 0) + 1);
  listEl.innerHTML = items.map((a) => rowMarkup(a, likeCounts.get(a.id) ?? 0)).join("");
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const title = data.get("title")?.toString().trim();
  const body = data.get("body")?.toString().trim();
  if (!body) return;
  const btn = form.querySelector("button");
  btn.disabled = true;
  try {
    await postAnnouncement(title, body);
    form.reset();
    await render();
  } catch {
    // Silencioso: el coach puede reintentar publicando de nuevo.
  } finally {
    btn.disabled = false;
  }
});

listEl?.addEventListener("click", async (e) => {
  const btn = e.target.closest(".remove-row-btn");
  if (!btn) return;
  const row = btn.closest(".announcement-admin-row");
  const id = row?.dataset.id;
  if (!id) return;
  btn.disabled = true;
  try {
    await deleteAnnouncement(id);
    await render();
  } catch {
    btn.disabled = false;
  }
});

// initAuth() (llamado desde js/admin-dues.js, que carga antes) es async —
// si este primer render() corre antes de que termine, getAnnouncements()
// todavía no tiene cliente y regresa []. Se vuelve a pintar cuando esté listo.
window.addEventListener("caimanes:auth-changed", render);
render();
