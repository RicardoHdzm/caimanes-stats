import { STANDINGS } from "../data.js";
import { heading, renderSortableTable, renderGlossary } from "../ui.js";

function formatDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  const text = date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  return text;
}

// La tabla en sí, sin el <h2> — exportada para que "Temporadas anteriores"
// (js/views/temporadas.js) también la use con STANDINGS_HISTORY[n] en vez
// de STANDINGS (la de la temporada actual, ver js/data.js). `emptyMessage`
// es distinto en cada caso: aquí siempre es "todavía no se ha capturado"
// (puede llegar en cualquier momento); en una temporada ya cerrada el
// mensaje correcto es otro (esa tabla ya no va a llegar).
export function renderStandingsTable(container, standings, emptyMessage = "Todavía no se ha capturado la tabla de posiciones.") {
  const teams = standings?.teams ?? [];

  if (teams.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = emptyMessage;
    container.appendChild(p);
    return;
  }

  if (standings.updated) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = `Como la publicó la liga al ${formatDate(standings.updated)}.`;
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

export function renderStanding(container) {
  heading(container, "Tabla de posiciones");
  renderStandingsTable(container, STANDINGS);
}
