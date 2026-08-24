import { GAMES, SCHEDULE } from "../data.js";
import { gameResult } from "../stats.js";
import { heading, renderSortableTable } from "../ui.js";

const RESULT_BADGE = {
  W: '<span class="badge badge-win"><i class="fa-solid fa-check"></i> W</span>',
  L: '<span class="badge badge-loss"><i class="fa-solid fa-xmark"></i> L</span>',
  T: '<span class="badge badge-tie"><i class="fa-solid fa-equals"></i> E</span>',
};
const UNKNOWN_BADGE = '<span class="badge badge-unknown">?</span>';

export function renderJuegos(container) {
  heading(container, "Juegos");

  if (SCHEDULE.length > 0) {
    const scheduleHeading = document.createElement("h3");
    scheduleHeading.textContent = "Próximos juegos";
    container.appendChild(scheduleHeading);

    const scheduleEl = document.createElement("div");
    container.appendChild(scheduleEl);
    renderSortableTable(scheduleEl, {
      columns: [
        { key: "date", label: "Fecha" },
        { key: "time", label: "Hora" },
        { key: "opponent", label: "Rival" },
      ],
      rows: SCHEDULE,
      defaultSort: "date",
      defaultDir: 1,
    });
  }

  const resultsHeading = document.createElement("h3");
  resultsHeading.textContent = "Resultados (clic en un juego para ver el detalle)";
  container.appendChild(resultsHeading);

  const rows = GAMES.map((g) => {
    const known = g.scoreUs != null && g.scoreThem != null;
    return {
      id: g.id,
      date: g.date,
      opponent: g.opponent,
      // No es una sede: en esta liga no hay local/visitante, solo quién
      // batea al final de cada entrada.
      close: g.weCloseBatting == null ? "?" : g.weCloseBatting ? "Nosotros" : "El rival",
      score: known ? `${g.scoreUs} - ${g.scoreThem}` : "Pendiente",
      result: gameResult(g) ?? "",
    };
  });

  const tableEl = document.createElement("div");
  container.appendChild(tableEl);

  renderSortableTable(tableEl, {
    columns: [
      { key: "date", label: "Fecha", sticky: true },
      { key: "opponent", label: "Rival" },
      { key: "close", label: "Cierra bateando" },
      { key: "score", label: "Marcador" },
      { key: "result", label: "Resultado", render: (value) => RESULT_BADGE[value] ?? UNKNOWN_BADGE },
    ],
    rows,
    defaultSort: "date",
    defaultDir: 1,
    onRowClick: (row) => {
      location.hash = `#/juegos/${row.id}`;
    },
  });
}
