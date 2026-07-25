import { battingTotals } from "../stats.js";
import { heading, renderSortableTable, renderGlossary, coloredStat } from "../ui.js";

export function renderBateo(container) {
  heading(container, "Estadísticas de bateo");

  const columns = [
    { key: "name", label: "Jugador" },
    { key: "G", label: "J", full: "Juegos jugados", numeric: true },
    { key: "AB", label: "AB", full: "Turnos al bat", numeric: true },
    { key: "H", label: "H", full: "Hits", numeric: true },
    { key: "2B", label: "2B", full: "Dobles", numeric: true },
    { key: "3B", label: "3B", full: "Triples", numeric: true },
    { key: "HR", label: "HR", full: "Jonrones", numeric: true },
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
  });

  renderGlossary(container, columns);
}
