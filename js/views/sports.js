// Portada del sitio (#/): pantalla dividida para elegir deporte — Softbol
// (Caimanes de Villas, este mismo sitio en #/softbol) o Fútbol (Caimanes FC,
// fc.html). Sin header, barra de juegos ni footer: js/main.js le pone a
// <body> la clase .is-sport-picker mientras esta pantalla está abierta.
import { fcLogoHtml } from "../fc/ui.js";

export function renderSportPicker(container) {
  container.innerHTML = `
    <section class="sport-picker" aria-label="Elige deporte">
      <a class="sport-panel sport-panel--softbol" href="#/softbol" data-sport-switch="softbol">
        <span class="sport-panel-bg" aria-hidden="true"></span>
        <span class="sport-panel-content">
          <img src="assets/logo.png" alt="" class="sport-panel-logo" />
          <span class="sport-panel-sport"><i class="fa-solid fa-baseball-bat-ball" aria-hidden="true"></i> Softbol</span>
          <span class="sport-panel-team">Caimanes de Villas</span>
          <span class="sport-panel-cta">Entrar <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
        </span>
      </a>
      <a class="sport-panel sport-panel--futbol" href="fc.html" data-sport-switch="futbol">
        <span class="sport-panel-bg" aria-hidden="true"></span>
        <span class="sport-panel-content">
          ${fcLogoHtml(220, "sport-panel-logo sport-panel-logo--fc")}
          <span class="sport-panel-sport"><i class="fa-solid fa-futbol" aria-hidden="true"></i> Fútbol</span>
          <span class="sport-panel-team">Caimanes FC</span>
          <span class="sport-panel-cta">Entrar <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
        </span>
      </a>
    </section>`;
}
