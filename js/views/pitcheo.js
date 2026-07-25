import { pitchingTotals } from "../stats.js";
import { heading, renderSortableTable, renderGlossary, coloredStat } from "../ui.js";

export function renderPitcheo(container) {
  heading(container, "Estadísticas de pitcheo");

  const columns = [
    { key: "name", label: "Jugador" },
    { key: "G", label: "J", full: "Juegos jugados", numeric: true },
    { key: "W", label: "G", full: "Juegos ganados", numeric: true },
    { key: "L", label: "P", full: "Juegos perdidos", numeric: true },
    { key: "SV", label: "SV", full: "Salvamentos", numeric: true },
    { key: "IP", label: "IP", full: "Entradas lanzadas", numeric: true },
    { key: "H", label: "H", full: "Hits permitidos", numeric: true },
    { key: "R", label: "R", full: "Carreras permitidas", numeric: true },
    { key: "ER", label: "ER", full: "Carreras limpias", numeric: true },
    { key: "BB", label: "BB", full: "Bases por bolas", numeric: true },
    { key: "SO", label: "SO", full: "Ponches", numeric: true, render: (v) => coloredStat(v, "stat-green") },
    { key: "HR", label: "HR", full: "Jonrones permitidos", numeric: true },
    { key: "ERA", label: "ERA", full: "Efectividad", numeric: true },
    { key: "WHIP", label: "WHIP", full: "(BB+H) por entrada", numeric: true },
  ];

  const tableEl = document.createElement("div");
  container.appendChild(tableEl);

  renderSortableTable(tableEl, {
    columns,
    rows: pitchingTotals(),
    defaultSort: "ERA",
    defaultDir: 1,
    onRowClick: (row) => {
      location.hash = `#/jugador/${row.playerId}`;
    },
  });

  renderGlossary(container, columns);
}
