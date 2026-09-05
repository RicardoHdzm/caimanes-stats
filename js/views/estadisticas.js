// Bateo, Pitcheo y Fildeo unificados en una sola pestaña — antes eran tres
// rutas/pestañas separadas (js/views/bateo.js, pitcheo.js, fildeo.js), que
// siguen intactas tal cual (cada una sigue siendo su propia tabla completa,
// con su glosario) — esta vista solo las envuelve con un selector arriba y
// monta la que corresponda, una a la vez.
import { heading } from "../ui.js";
import { renderBateo } from "./bateo.js";
import { renderPitcheo } from "./pitcheo.js";
import { renderFildeo } from "./fildeo.js";

const STATS = [
  { id: "bateo", label: "Bateo", icon: "fa-baseball-bat-ball", render: renderBateo },
  { id: "pitcheo", label: "Pitcheo", icon: "fa-baseball", render: renderPitcheo },
  { id: "fildeo", label: "Fildeo", icon: "fa-shield", render: renderFildeo },
];

// `tipo` viene de la URL (#/estadisticas/bateo, o #/bateo·#/pitcheo·#/fildeo
// por compatibilidad con los links viejos — ver js/main.js). Sin uno válido,
// arranca en Bateo.
export function renderEstadisticas(container, tipo) {
  const initial = STATS.some((s) => s.id === tipo) ? tipo : "bateo";

  heading(container, "Estadísticas");

  const switcher = document.createElement("div");
  switcher.className = "stats-switcher";
  switcher.innerHTML = STATS.map(
    (s) => `
      <button type="button" class="stats-switcher-btn" data-stat="${s.id}">
        <span class="stats-switcher-icon"><i class="fa-solid ${s.icon}"></i></span>
        <span>${s.label}</span>
      </button>
    `
  ).join("");
  container.appendChild(switcher);

  const subContainer = document.createElement("div");
  container.appendChild(subContainer);

  function draw(statId) {
    // replaceState (no dispara hashchange) en vez de cambiar el hash de
    // verdad — evita un remount completo de toda la vista (que saltaría
    // hasta arriba de la página) y de paso deja la URL compartible, mismo
    // patrón que el picker del comparador (ver js/views/comparar.js).
    history.replaceState(null, "", `#/estadisticas/${statId}`);
    for (const btn of switcher.querySelectorAll(".stats-switcher-btn")) {
      btn.classList.toggle("active", btn.dataset.stat === statId);
    }
    subContainer.innerHTML = "";
    STATS.find((s) => s.id === statId).render(subContainer);
  }

  switcher.addEventListener("click", (e) => {
    const btn = e.target.closest(".stats-switcher-btn");
    if (!btn || btn.classList.contains("active")) return;
    draw(btn.dataset.stat);
  });

  draw(initial);
}
