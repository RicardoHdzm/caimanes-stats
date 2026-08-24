import { PLAYERS } from "./data.js";
import { renderPositionBadge } from "./ui.js";
import { primaryPosition, renderLineupResult } from "./lineup.js";

const listEl = document.getElementById("attendee-list");
const countEl = document.getElementById("attendee-count");
const resultEl = document.getElementById("lineup-result");

const roster = [...PLAYERS].sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
const checkboxes = [];

function updateCount() {
  const n = checkboxes.filter((c) => c.checked).length;
  countEl.textContent = `${n} de ${roster.length} seleccionados`;
}

// Arranca con todos marcados: lo normal es que casi todo el equipo asista y
// solo haya que destildar a quien falte, en vez de marcar uno por uno.
for (const player of roster) {
  const row = document.createElement("label");
  row.className = "attendee-row checked";

  const pos = primaryPosition(player);
  row.innerHTML = `
    <span class="attendee-name">
      <span class="num">#${player.number ?? "-"}</span>
      <span class="name">${player.name}</span>
    </span>
    <span class="attendee-badges">${pos ? renderPositionBadge(pos) : ""}</span>
  `;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = player.id;
  checkbox.checked = true;
  checkbox.addEventListener("change", () => {
    row.classList.toggle("checked", checkbox.checked);
    updateCount();
  });
  row.prepend(checkbox);

  listEl.appendChild(row);
  checkboxes.push(checkbox);
}

updateCount();

document.getElementById("select-all-btn").addEventListener("click", () => {
  for (const c of checkboxes) {
    c.checked = true;
    c.closest(".attendee-row").classList.add("checked");
  }
  updateCount();
});

document.getElementById("select-none-btn").addEventListener("click", () => {
  for (const c of checkboxes) {
    c.checked = false;
    c.closest(".attendee-row").classList.remove("checked");
  }
  updateCount();
});

document.getElementById("generate-btn").addEventListener("click", () => {
  const attendingIds = new Set(checkboxes.filter((c) => c.checked).map((c) => c.value));
  const attendees = roster.filter((p) => attendingIds.has(p.id));
  renderLineupResult(resultEl, attendees);
  resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
});
