import { PLAYERS } from "./data.js";
import { DEFENSE_POSITIONS, registeredFieldPositions, renderLineupResult } from "./lineup.js";

const listEl = document.getElementById("attendee-list");
const countEl = document.getElementById("attendee-count");
const resultEl = document.getElementById("lineup-result");

const roster = [...PLAYERS].sort((a, b) => a.name.localeCompare(b.name, "es"));
const entries = []; // { player, checkbox, select }

function updateCount() {
  const n = entries.filter((e) => e.checkbox.checked).length;
  countEl.textContent = `${n} de ${roster.length} seleccionados`;
}

// El selector de posición: primero sus posiciones registradas en el roster
// (lo más probable), luego el resto por si hoy juega en otro lado, y al
// final "sin posición" para dejarle la decisión al algoritmo.
function buildPositionSelect(player) {
  const select = document.createElement("select");
  select.className = "attendee-position";

  const registered = registeredFieldPositions(player);
  const others = DEFENSE_POSITIONS.filter((pos) => !registered.includes(pos));

  if (registered.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "Registradas";
    for (const pos of registered) {
      const opt = document.createElement("option");
      opt.value = pos;
      opt.textContent = pos;
      group.appendChild(opt);
    }
    select.appendChild(group);
  }

  const otherGroup = document.createElement("optgroup");
  otherGroup.label = "Otras";
  for (const pos of others) {
    const opt = document.createElement("option");
    opt.value = pos;
    opt.textContent = pos;
    otherGroup.appendChild(opt);
  }
  select.appendChild(otherGroup);

  const none = document.createElement("option");
  none.value = "";
  none.textContent = "Sin posición";
  select.appendChild(none);

  // Por default, su posición principal registrada — o "sin posición" si no
  // tiene ninguna de las 9 de campo registrada.
  select.value = registered[0] ?? "";
  return select;
}

// Arranca con todos desmarcados: hay que marcar a mano a quien sí va.
for (const player of roster) {
  const row = document.createElement("label");
  row.className = "attendee-row";
  row.innerHTML = `
    <span class="attendee-name">
      <span class="num">#${player.number ?? "-"}</span>
      <span class="name">${player.name}</span>
    </span>
  `;

  const select = buildPositionSelect(player);
  select.disabled = true;
  row.appendChild(select);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = false;
  checkbox.addEventListener("change", () => {
    row.classList.toggle("checked", checkbox.checked);
    select.disabled = !checkbox.checked;
    updateCount();
  });
  row.prepend(checkbox);

  listEl.appendChild(row);
  entries.push({ player, checkbox, select });
}

updateCount();

document.getElementById("select-all-btn").addEventListener("click", () => {
  for (const e of entries) {
    e.checkbox.checked = true;
    e.select.disabled = false;
    e.checkbox.closest(".attendee-row").classList.add("checked");
  }
  updateCount();
});

document.getElementById("select-none-btn").addEventListener("click", () => {
  for (const e of entries) {
    e.checkbox.checked = false;
    e.select.disabled = true;
    e.checkbox.closest(".attendee-row").classList.remove("checked");
  }
  updateCount();
});

document.getElementById("generate-btn").addEventListener("click", () => {
  const attending = entries.filter((e) => e.checkbox.checked);
  const attendees = attending.map((e) => e.player);
  const gamePositionById = new Map(attending.map((e) => [e.player.id, e.select.value || null]));

  renderLineupResult(resultEl, attendees, gamePositionById);
  resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
});
