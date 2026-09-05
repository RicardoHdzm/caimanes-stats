import { SCHEDULE } from "../data.js";
import { currentSeasonGames, gameResult } from "../stats.js";
import { heading, renderSortableTable, renderGlossary } from "../ui.js";

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

  const rows = currentSeasonGames().map((g) => {
    const known = g.scoreUs != null && g.scoreThem != null;
    return {
      id: g.id,
      date: g.date,
      time: g.time ?? "",
      opponent: g.opponent,
      // No es una sede: en esta liga no hay local/visitante, solo en qué
      // parte de la entrada bateamos. Cerrar bateando = batear en la parte
      // baja; si cierra el rival, nosotros bateamos en la alta.
      close: g.weCloseBatting == null ? "?" : g.weCloseBatting ? "Baja" : "Alta",
      score: known ? `${g.scoreUs} - ${g.scoreThem}` : "Pendiente",
      result: gameResult(g) ?? "",
    };
  });

  const tableEl = document.createElement("div");
  container.appendChild(tableEl);

  const resultColumns = [
    { key: "date", label: "Fecha", sticky: true },
    { key: "time", label: "Hora" },
    { key: "opponent", label: "Rival" },
    { key: "close", label: "Entrada", full: "Parte de la entrada en que bateamos — baja = cerramos, alta = abrimos" },
    { key: "score", label: "Marcador" },
    { key: "result", label: "Resultado", render: (value) => RESULT_BADGE[value] ?? UNKNOWN_BADGE },
  ];

  renderSortableTable(tableEl, {
    columns: resultColumns,
    rows,
    defaultSort: "date",
    defaultDir: 1,
    onRowClick: (row) => {
      location.hash = `#/juegos/${row.id}`;
    },
  });

  renderGlossary(container, resultColumns);
}
