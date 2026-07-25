import { PLAYERS, GAMES } from "../data.js";
import { gamesPlayedByPlayer } from "../stats.js";
import { heading, renderSortableTable, renderGlossary, renderPositionBadges, renderAvatar } from "../ui.js";

export function renderRoster(container) {
  heading(container, "Roster");

  const played = gamesPlayedByPlayer(GAMES);
  const rows = PLAYERS.map((p) => ({
    ...p,
    gamesPlayed: played.get(p.id) ?? 0,
  }));

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
    { key: "gamesPlayed", label: "Asistencias", numeric: true },
  ];

  const tableEl = document.createElement("div");
  container.appendChild(tableEl);

  renderSortableTable(tableEl, {
    columns,
    rows,
    defaultSort: "number",
    defaultDir: 1,
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.id}`;
    },
  });

  renderGlossary(container, columns);
}
