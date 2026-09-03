import { PLAYERS } from "../data.js";
import { heading } from "../ui.js";
import { renderLineupResult } from "../lineup.js";
import { renderComparar } from "./comparar.js";
import { getAllPositionOverrides } from "../db.js";

// compareLeft/compareRight vienen de #/alineacion/p1/p2 y solo alimentan al
// comparador del final; sin ellos la alineación se dibuja igual.
export function renderAlineacion(container, compareLeft, compareRight) {
  heading(
    container,
    "Sugerencia de alineación",
    "Calculada solo con stats de bateo y las posiciones registradas en el roster."
  );

  const resultEl = document.createElement("div");
  container.appendChild(resultEl);
  renderLineupResult(resultEl, PLAYERS);

  // Posiciones personalizadas (ver "Editar mis posiciones" en el perfil):
  // se pintan primero con las de data.js (sin esperar red) y, si alguien ya
  // las cambió, se vuelve a calcular la alineación completa con esas —
  // renderLineupResult se puede volver a llamar sin problema, limpia su
  // contenedor solo. Sin overrides no hace falta ni tocarla de nuevo.
  getAllPositionOverrides().then((overrides) => {
    if (overrides.size === 0) return;
    const patched = PLAYERS.map((p) => (overrides.has(p.id) ? { ...p, position: overrides.get(p.id) } : p));
    renderLineupResult(resultEl, patched);
  });

  renderComparar(container, compareLeft, compareRight);
}
