import { battingTotals, outsTotals } from "../stats.js";
import { heading, renderSortableTable, renderGlossary, coloredStat } from "../ui.js";
import { getCurrentPlayerId } from "../auth.js";

export function renderBateo(container) {
  heading(container, "Estadísticas de bateo");

  const columns = [
    { key: "name", label: "Jugador", sticky: true },
    { key: "G", label: "J", full: "Juegos jugados", numeric: true },
    { key: "AB", label: "AB", full: "Turnos al bat", numeric: true },
    { key: "H", label: "H", full: "Hits", numeric: true },
    { key: "2B", label: "2B", full: "Dobles", numeric: true },
    { key: "3B", label: "3B", full: "Triples", numeric: true },
    { key: "HR", label: "HR", full: "Home runs", numeric: true },
    { key: "HRC", label: "HRC", full: "HR Campo", numeric: true },
    { key: "R", label: "R", full: "Carreras", numeric: true },
    { key: "RBI", label: "RBI", full: "Impulsadas", numeric: true },
    { key: "BB", label: "BB", full: "Bases por bolas", numeric: true },
    { key: "SO", label: "SO", full: "Ponches", numeric: true, render: (v) => coloredStat(v, "stat-red") },
    { key: "SB", label: "SB", full: "Bases robadas", numeric: true },
    { key: "AVG", label: "AVG", full: "Promedio de bateo", numeric: true },
    { key: "OBP", label: "OBP", full: "Porcentaje de embasado", numeric: true },
    { key: "SLG", label: "SLG", full: "Porcentaje de slugging", numeric: true },
    { key: "OPS", label: "OPS", full: "OBP + SLG", numeric: true },
  ];

  const tableEl = document.createElement("div");
  container.appendChild(tableEl);

  renderSortableTable(tableEl, {
    columns,
    rows: battingTotals(),
    defaultSort: "AVG",
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
    rowClass: (row) => (row.playerId === getCurrentPlayerId() ? "row-you" : ""),
  });

  renderGlossary(container, columns);

  // Cómo lo sacaron, más allá del ponche (ya está arriba) — tabla propia
  // porque no todo out es al bat (BO/RO, ver outsTotals en js/stats.js).
  const outsHeading = document.createElement("h3");
  outsHeading.textContent = "Outs por tipo";
  container.appendChild(outsHeading);

  const outsColumns = [
    { key: "name", label: "Jugador", sticky: true },
    { key: "G", label: "J", full: "Juegos con outs capturados", numeric: true },
    { key: "GO", label: "GO", full: "Out por rodado", numeric: true },
    { key: "FO", label: "FO", full: "Out por elevado", numeric: true },
    { key: "LO", label: "LO", full: "Out por línea", numeric: true },
    { key: "BO", label: "BO", full: "Out en base", numeric: true },
    { key: "RO", label: "RO", full: "Out de regla", numeric: true },
    { key: "SAC", label: "SAC", full: "Out por sacrificio", numeric: true },
    { key: "TOTAL", label: "Total", numeric: true },
  ];

  const outsTableEl = document.createElement("div");
  container.appendChild(outsTableEl);

  renderSortableTable(outsTableEl, {
    columns: outsColumns,
    rows: outsTotals(),
    defaultSort: "TOTAL",
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
    rowClass: (row) => (row.playerId === getCurrentPlayerId() ? "row-you" : ""),
  });

  renderGlossary(container, outsColumns);
}
