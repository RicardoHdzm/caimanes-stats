import { PLAYERS, GAMES, TEAM } from "../data.js";
import { gamesPlayedByPlayer } from "../stats.js";
import { heading, renderSortableTable, renderGlossary, renderPositionBadges, renderAvatar } from "../ui.js";

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

  const tableEl = document.createElement("div");
  container.appendChild(tableEl);

  function draw(activeGroup) {
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
    draw(btn.dataset.group);
  });

  draw("ALL");

  renderGlossary(container, columns);
}
