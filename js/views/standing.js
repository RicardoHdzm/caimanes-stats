import { STANDINGS } from "../data.js";
import { heading, renderSortableTable, renderGlossary } from "../ui.js";

function formatDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  const text = date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  return text;
}

export function renderStanding(container) {
  heading(container, "Tabla de posiciones");

  const teams = STANDINGS.teams ?? [];

  if (teams.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = "Todavía no se ha capturado la tabla de posiciones.";
    container.appendChild(p);
    return;
  }

  if (STANDINGS.updated) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = `Como la publicó la liga al ${formatDate(STANDINGS.updated)}.`;
    container.appendChild(p);
  }

  const columns = [
    { key: "pos", label: "#", full: "Lugar en la tabla", numeric: true, sticky: true },
    { key: "team", label: "Equipo", sticky: true },
    { key: "JJ", label: "JJ", full: "Juegos jugados", numeric: true },
    { key: "JG", label: "JG", full: "Juegos ganados", numeric: true },
    { key: "JE", label: "JE", full: "Juegos empatados", numeric: true },
    { key: "JP", label: "JP", full: "Juegos perdidos", numeric: true },
    { key: "CF", label: "CF", full: "Carreras a favor", numeric: true },
    { key: "CC", label: "CC", full: "Carreras en contra", numeric: true },
  ];

  const tableEl = document.createElement("div");
  container.appendChild(tableEl);

  renderSortableTable(tableEl, {
    columns,
    rows: teams,
    defaultSort: "pos",
    defaultDir: 1,
    rowClass: (row) => (row.us ? "standings-us" : ""),
  });

  renderGlossary(container, columns);
}
