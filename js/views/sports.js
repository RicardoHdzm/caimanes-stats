// Portada del sitio (#/): "lista tipográfica" para elegir deporte — los
// nombres en grande, uno debajo del otro; el que señalas se pinta sólido,
// cambia el fondo a su foto y a la derecha sale su logo. Con el mouse
// encima, el nombre del deporte rueda hacia arriba y entra el del equipo. Sóftbol (Caimanes de Villas, #/softbol) y Fútbol
// (Caimanes FC, fc.html) y Gaming (CaimanX, caimanx.html) son link; Pádel
// (Caimanes Padel Squad) todavía no. Mientras nadie señala, el fondo va
// rotando solo entre los cuatro; la línea roja debajo del nombre activo se
// va llenando y, al llenarse, pasa al siguiente.
// Sin header, barra de juegos ni footer: js/main.js le pone a <body> la clase
// .is-sport-picker mientras esta pantalla está abierta.
import { fcLogoHtml } from "../fc/ui.js";

// Nombre de la organización, arriba a la izquierda.
const ORG_NAME = "Caimanes.Team";

// Redes de la organización, arriba a la derecha. Para agregar otra, copiar
// una línea: el icono es el nombre de Font Awesome (fa-facebook, fa-tiktok,
// fa-whatsapp, fa-youtube...).
const SOCIALS = [{ label: "Instagram", icon: "fa-instagram", url: "https://www.instagram.com/caimanes.sb/" }];

// Los cuatro deportes, en orden. `href: null` = todavía "Próximamente".
// `teamLines`: el nombre del equipo partido en dos renglones — es lo que
// aparece en lugar del deporte al pasar el mouse (el segundo, en rojo).
// Las fotos de fondo van en css/styles.css (.sp-media--<key>). Si se reemplaza un logo con el mismo
// nombre de archivo, agregar/subir un "?v=" para que no se quede el viejo.
const SPORTS = [
  {
    key: "softbol",
    name: "Sóftbol",
    team: "Caimanes de Villas",
    teamLines: ["Caimanes", "de Villas"],
    href: "#/softbol",
    logo: `<img src="assets/logo.png" alt="" class="sp-logo" />`,
  },
  {
    key: "futbol",
    name: "Fútbol",
    team: "Caimanes Football Club",
    teamLines: ["Caimanes", "Football Club"],
    href: "fc.html",
    logo: fcLogoHtml(220, "sp-logo sp-logo--fc"),
  },
  {
    key: "padel",
    name: "Pádel",
    team: "Caimanes Padel Squad",
    teamLines: ["Caimanes", "Padel Squad"],
    href: null,
    logo: `<img src="assets/logos/padel.png" alt="" class="sp-logo sp-logo--padel" />`,
  },
  {
    key: "esports",
    name: "Gaming",
    team: "CaimanX Gaming",
    teamLines: ["CaimanX", "Gaming"],
    href: "caimanx.html",
    logo: `<img src="assets/logos/caimanx.png?v=4" alt="" class="sp-logo sp-logo--esports" />`,
  },
];

const ROTATE_MS = 5000;

function rowHtml(s, i) {
  const num = String(i + 1).padStart(2, "0");
  const inner = `
      <span class="sp-row-num">${num}</span>
      <span class="sp-row-bar" aria-hidden="true"></span>
      <span class="sp-row-name">
        <span class="sp-name-sport">${s.name}</span>
        <span class="sp-name-team"><span>${s.teamLines[0]}</span><span>${s.teamLines[1]}</span></span>
      </span>
      <span class="sp-row-info">
        <span class="sp-row-logo">${s.logo}</span>
        <span class="sp-row-team">${s.team}</span>
      </span>`;
  return s.href
    ? `<a class="sp-row" href="${s.href}" data-key="${s.key}" data-sport-switch="${s.key}">${inner}</a>`
    : `<div class="sp-row sp-row--soon" data-key="${s.key}" tabindex="0">${inner}</div>`;
}

export function renderSportPicker(container) {
  const socials = SOCIALS.map(
    (s) =>
      `<a class="sp-social" href="${s.url}" target="_blank" rel="noopener noreferrer" aria-label="${s.label}" title="${s.label}"><i class="fa-brands ${s.icon}"></i></a>`
  ).join("");
  container.innerHTML = `
    <section class="sport-picker" aria-label="Elige deporte">
      <div class="sp-media" aria-hidden="true">
        ${SPORTS.map((s) => `<div class="sp-media-item sp-media--${s.key}" data-key="${s.key}"></div>`).join("")}
      </div>
      <header class="sp-top">
        <span class="sp-org">
          <span>${ORG_NAME}</span>
        </span>
        <span class="sp-socials">${socials}</span>
      </header>
      <nav class="sp-list" aria-label="Deportes">
        ${SPORTS.map(rowHtml).join("")}
      </nav>
      <div class="sp-stage" aria-hidden="true">
        ${SPORTS.map((s) => `<div class="sp-stage-item" data-key="${s.key}">${s.logo}</div>`).join("")}
      </div>
    </section>`;
  wire(container.querySelector(".sport-picker"));
}

function wire(root) {
  const keys = SPORTS.map((s) => s.key);
  let current = null;

  function setActive(key) {
    if (key === current) return;
    current = key;
    for (const el of root.querySelectorAll("[data-key]")) el.classList.toggle("is-active", el.dataset.key === key);
  }

  setActive(keys[0]);

  // Rotación: la lleva la animación de la barrita del activo (css/styles.css,
  // sp-progress, dura ROTATE_MS). Al terminar, pasa al siguiente. Con el mouse
  // o el foco en la lista se pausa (.is-paused) y la barrita se congela. Con
  // "reducir movimiento" no hay animación, así que tampoco rota.
  root.style.setProperty("--sp-rotate", `${ROTATE_MS}ms`);
  root.addEventListener("animationend", (e) => {
    if (e.animationName !== "sp-progress") return;
    setActive(keys[(keys.indexOf(current) + 1) % keys.length]);
  });

  const list = root.querySelector(".sp-list");
  for (const row of list.querySelectorAll(".sp-row")) {
    row.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") setActive(row.dataset.key);
    });
    row.addEventListener("focus", () => setActive(row.dataset.key));
  }
  const pause = (on) => root.classList.toggle("is-paused", on);
  list.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse") pause(true);
  });
  list.addEventListener("pointerleave", () => pause(false));
  list.addEventListener("focusin", () => pause(true));
  list.addEventListener("focusout", () => pause(false));
}
