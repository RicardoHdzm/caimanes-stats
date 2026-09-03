import { fieldingTotals } from "../stats.js";
import { heading, renderSortableTable, renderGlossary } from "../ui.js";
import { getCurrentPlayerId } from "../auth.js";

export function renderFildeo(container) {
  heading(container, "Estadísticas de fildeo");

  const columns = [
    { key: "name", label: "Jugador", sticky: true },
    { key: "G", label: "J", full: "Juegos jugados", numeric: true },
    { key: "PO", label: "PO", full: "Outs realizados", numeric: true },
    { key: "A", label: "A", full: "Asistencias", numeric: true },
    { key: "E", label: "E", full: "Errores", numeric: true },
    { key: "FPCT", label: "FPCT", full: "Porcentaje de fildeo", numeric: true },
  ];

  const tableEl = document.createElement("div");
  container.appendChild(tableEl);

  renderSortableTable(tableEl, {
    columns,
    rows: fieldingTotals(),
    defaultSort: "FPCT",
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
    rowClass: (row) => (row.playerId === getCurrentPlayerId() ? "row-you" : ""),
  });

  renderGlossary(container, columns);
}
