import { PLAYERS } from "../data.js";
import { heading } from "../ui.js";
import { renderLineupResult } from "../lineup.js";
import { renderComparar } from "./comparar.js";

// compareLeft/compareRight vienen de #/alineacion/p1/p2 y solo alimentan al
// comparador del final; sin ellos la alineación se dibuja igual.
export function renderAlineacion(container, compareLeft, compareRight) {
  heading(
    container,
    "Sugerencia de alineación",
    "Calculada solo con stats de bateo y las posiciones registradas en el roster — no considera condición física, lesiones ni criterio del cuerpo técnico. Para armarla solo con quienes asisten a un juego en particular, usa lineup.html."
  );

  const resultEl = document.createElement("div");
  container.appendChild(resultEl);
  renderLineupResult(resultEl, PLAYERS);

  renderComparar(container, compareLeft, compareRight);
}
