import { PLAYERS, GAMES, TEAM } from "../data.js";
import { gamesPlayedByPlayer } from "../stats.js";
import { heading, renderSortableTable, renderGlossary, renderPositionBadges, renderAvatar } from "../ui.js";
import { getSession, isCoach } from "../auth.js";
import { getDuesMap, setDuesPaid, getAllPositionOverrides } from "../db.js";

// Apariciones mínimas para tener derecho a jugar playoffs en esta liga.
const PLAYOFF_MIN_GAMES = 5;

// Grupos del filtro rápido por posición. `codes` se compara contra las
// hasta 3 posiciones registradas del jugador (no solo la principal), para
// que "quién puede jugar infield" encuentre también a quien la trae de
// segunda o tercera opción.
const POSITION_GROUPS = [
  { id: "ALL", label: "Todos" },
  { id: "P", label: "Pitcher", codes: ["P"] },
  { id: "C", label: "Catcher", codes: ["C"] },
  { id: "IF", label: "Infield", codes: ["1B", "2B", "3B", "SS"] },
  { id: "OF", label: "Outfield", codes: ["LF", "CF", "RF"] },
];

function playerPositions(player) {
  return (player.position ?? "").split("/").map((v) => v.trim()).filter(Boolean);
}

// Celda de "Inscripción": un ícono, verde si ya pagó y rojo si no. Para el
// coach es además un botón clicable (mismo ícono, toggle); para cualquier
// otro jugador con sesión es de solo lectura. `duesMap` llega por closure
// porque se llena aparte, async — ver comentario en renderRoster.
function renderDuesCell(playerId, duesMap) {
  const paid = duesMap.get(playerId) ?? false;
  const icon = paid
    ? '<i class="fa-solid fa-circle-check dues-icon dues-icon-paid"></i>'
    : '<i class="fa-solid fa-circle-xmark dues-icon dues-icon-unpaid"></i>';
  if (!isCoach()) return icon;
  return `<button type="button" class="dues-toggle-btn" data-player="${playerId}" data-paid="${paid}">${icon}</button>`;
}

export function renderRoster(container) {
  heading(container, "Roster");

  const played = gamesPlayedByPlayer(GAMES);
  const rows = PLAYERS.map((p) => ({
    ...p,
    gamesPlayed: played.get(p.id) ?? 0,
  }));

  const filterRow = document.createElement("div");
  filterRow.className = "pos-filter-row";
  filterRow.innerHTML = POSITION_GROUPS.map(
    (g) => `<button type="button" class="pos-filter-chip${g.id === "ALL" ? " active" : ""}" data-group="${g.id}">${g.label}</button>`
  ).join("");
  container.appendChild(filterRow);

  const columns = [
    {
      key: "photo",
      label: "",
      render: (_value, row) => renderAvatar(row, 32),
    },
    { key: "number", label: "#", full: "Número", numeric: true },
    { key: "name", label: "Nombre" },
    {
      key: "position",
      label: "Pos",
      full: "Posición",
      render: renderPositionBadges,
    },
    {
      key: "gamesPlayed",
      label: "Apariciones",
      full: `Se necesitan ${PLAYOFF_MIN_GAMES} para tener derecho a playoffs`,
      numeric: true,
      render: (value) => {
        const cls = value >= PLAYOFF_MIN_GAMES ? "stat-green" : "stat-red";
        return `<span class="${cls}">${value}</span>/${TEAM.gamesInSeason}</span>`;
      },
    },
  ];

  // La columna de pago solo se agrega con sesión iniciada — sin cuenta, el
  // roster se ve exactamente igual que siempre. OJO: se usa getSession()
  // (¿hay cuenta?), no getCurrentPlayerId() (¿a qué jugador corresponde esa
  // cuenta?) — alguien puede tener cuenta antes de que el coach termine de
  // vincularla en player_whitelist, y aun así debe poder ver esto (y si es
  // el coach, editarlo) sin depender de ese paso. `duesMap` arranca vacío y
  // se llena aparte (abajo) porque viene de una consulta a Supabase, no de
  // data.js; el `render` la lee por closure, así que cuando llegue el dato
  // real solo hace falta volver a llamar draw() para que se refleje.
  let duesMap = new Map();
  const loggedIn = !!getSession();
  if (loggedIn) {
    columns.push({
      key: "paid",
      label: "Inscripción",
      full: "Inscripción de temporada pagada",
      render: (_value, row) => renderDuesCell(row.id, duesMap),
    });
  }

  const tableEl = document.createElement("div");
  container.appendChild(tableEl);

  let activeGroup = "ALL";

  function draw() {
    const group = POSITION_GROUPS.find((g) => g.id === activeGroup) ?? POSITION_GROUPS[0];
    const filtered =
      group.id === "ALL" ? rows : rows.filter((row) => playerPositions(row).some((pos) => group.codes.includes(pos)));

    renderSortableTable(tableEl, {
      columns,
      rows: filtered,
      defaultSort: "number",
      defaultDir: 1,
      onRowClick: (row) => {
        location.hash = `#/jugador/${row.id}`;
      },
    });
  }

  filterRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".pos-filter-chip");
    if (!btn) return;
    for (const chip of filterRow.querySelectorAll(".pos-filter-chip")) chip.classList.toggle("active", chip === btn);
    activeGroup = btn.dataset.group;
    draw();
  });

  // Delegado en tableEl (nunca se reemplaza, solo sus hijos) para que siga
  // funcionando después de que renderSortableTable vuelva a dibujar la
  // tabla al ordenar por otra columna — un listener puesto directo en cada
  // checkbox se perdería en cuanto eso pase.
  if (loggedIn) {
    tableEl.addEventListener("change", async (e) => {
      const input = e.target.closest(".dues-toggle input");
      if (!input) return;
      const playerId = input.dataset.player;
      const next = input.checked;
      input.disabled = true;
      try {
        await setDuesPaid(playerId, next);
        duesMap.set(playerId, next);
      } catch {
        input.checked = !next;
      } finally {
        draw();
      }
    });
  }

  draw();

  if (loggedIn) {
    getDuesMap().then((map) => {
      duesMap = map;
      draw();
    });
  }

  // Posiciones personalizadas: lectura pública (a diferencia de "Pagó", no
  // depende de sesión). Reemplazan `row.position` de quien haya editado la
  // suya — la columna Pos y el filtro rápido de arriba usan ese mismo campo,
  // así que ambos quedan al día con un solo draw().
  getAllPositionOverrides().then((overrides) => {
    if (overrides.size === 0) return;
    for (const row of rows) {
      if (overrides.has(row.id)) row.position = overrides.get(row.id);
    }
    draw();
  });

  renderGlossary(container, columns);
}
