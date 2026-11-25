// Portada del sitio (#/): pantalla dividida para elegir deporte — Softbol
// (Caimanes de Villas, este mismo sitio en #/softbol), Fútbol (Caimanes FC,
// fc.html), Pádel (Caimanes Padel Squad) y eSports (Caiman X) — estos dos
// todavía "Próximamente": no son link. El video ligero de pádel
// (assets/hero-padel.mp4) queda listo para cuando tenga página.
// Sin header, barra de juegos ni footer: js/main.js le pone a <body> la clase
// .is-sport-picker mientras esta pantalla está abierta.
import { fcLogoHtml } from "../fc/ui.js";

// Logo de Caimanes Padel Squad, el archivo tal cual. Si se reemplaza con el
// mismo nombre, agregar/subir un "?v=" para que no se quede el viejo en
// caché. Con null se usaría la cabeza blanca del caimán como provisional.
const PADEL_LOGO = "assets/logos/padel.png";

export function renderSportPicker(container) {
  const padelLogo = PADEL_LOGO
    ? `<img src="${PADEL_LOGO}" alt="" class="sport-panel-logo sport-panel-logo--padel" />`
    : `<img src="assets/logos/whitelogo@2x.png" alt="" class="sport-panel-logo sport-panel-logo--padel sport-panel-logo--placeholder" />`;
  container.innerHTML = `
    <section class="sport-picker" aria-label="Elige deporte">
      <a class="sport-panel sport-panel--softbol" href="#/softbol" data-sport-switch="softbol">
        <span class="sport-panel-bg" aria-hidden="true"></span>
        <span class="sport-panel-content">
          <img src="assets/logo.png" alt="" class="sport-panel-logo" />
          <span class="sport-panel-sport">Sóftbol</span>
          <span class="sport-panel-team">Caimanes de Villas</span>
          <span class="sport-panel-cta">Entrar</span>
        </span>
      </a>
      <a class="sport-panel sport-panel--futbol" href="fc.html" data-sport-switch="futbol">
        <span class="sport-panel-bg" aria-hidden="true"></span>
        <span class="sport-panel-content">
          ${fcLogoHtml(220, "sport-panel-logo sport-panel-logo--fc")}
          <span class="sport-panel-sport">Fútbol</span>
          <span class="sport-panel-team">Caimanes FC</span>
          <span class="sport-panel-cta">Entrar</span>
        </span>
      </a>
      <div class="sport-panel sport-panel--padel sport-panel--soon">
        <span class="sport-panel-bg" aria-hidden="true"></span>
        <span class="sport-panel-content">
          ${padelLogo}
          <span class="sport-panel-sport">Pádel</span>
          <span class="sport-panel-team">Caimanes Padel Squad</span>
          <span class="sport-panel-cta sport-panel-cta--soon">Próximamente</span>
        </span>
      </div>
      <div class="sport-panel sport-panel--esports sport-panel--soon">
        <span class="sport-panel-bg" aria-hidden="true"></span>
        <span class="sport-panel-content">
          <img src="assets/logos/caimanx.png" alt="" class="sport-panel-logo sport-panel-logo--esports" />
          <span class="sport-panel-sport">eSports</span>
          <span class="sport-panel-team">Caiman X</span>
          <span class="sport-panel-cta sport-panel-cta--soon">Próximamente</span>
        </span>
      </div>
    </section>`;
}
