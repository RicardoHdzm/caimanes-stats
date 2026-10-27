import { heading } from "../ui.js";
import { renderLineupResult, alineacionRoster } from "../lineup.js";
import { renderComparar } from "./comparar.js";

// compareLeft/compareRight vienen de #/alineacion/p1/p2 y solo alimentan al
// comparador del final; sin ellos la alineación se dibuja igual.
export function renderAlineacion(container, compareLeft, compareRight) {
  heading(
    container,
    "Sugerencia de alineación",
    "Calculada solo con stats de bateo y las posiciones más jugadas de cada quien."
  );

  const resultEl = document.createElement("div");
  container.appendChild(resultEl);

  // Roster con las posiciones más jugadas / del perfil (ver alineacionRoster
  // en js/lineup.js — la portada usa el mismo para sus 9 titulares).
  renderLineupResult(resultEl, alineacionRoster());

  renderComparar(container, compareLeft, compareRight);
}
