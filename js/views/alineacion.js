import { ROSTER } from "../data.js";
import { heading } from "../ui.js";
import { displayPositions } from "../stats.js";
import { renderLineupResult } from "../lineup.js";
import { renderComparar } from "./comparar.js";
import { cachedPositionOverrides } from "../db.js";

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

  // Posiciones personalizadas (ver "Editar mis posiciones" en el perfil):
  // ya vienen del cache precargado (durante la pantalla de bienvenida, ver
  // preloadOverrides en js/db.js), se leen SÍNCRONO — así la alineación se
  // calcula de una con las del perfil, sin recalcular a la vista. Sin
  // precarga/señal, el Map viene vacío y se usa la de data.js.
  //
  // `position` = las MÁS JUGADAS (ver displayPositions en js/stats.js), a
  // petición expresa; la registrada queda en `registeredPosition` como
  // último recurso del motor (ver assignDefense en js/lineup.js).
  const overrides = cachedPositionOverrides();
  const players = ROSTER.map((p) => {
    const registered = overrides.get(p.id) ?? p.position ?? "";
    return { ...p, registeredPosition: registered, position: displayPositions(p.id, registered) };
  });
  renderLineupResult(resultEl, players);

  renderComparar(container, compareLeft, compareRight);
}
