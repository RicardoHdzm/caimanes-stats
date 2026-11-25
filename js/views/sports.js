// Portada del sitio (#/): "lista tipográfica" para elegir deporte — los
// nombres en grande, uno debajo del otro; el que señalas se pinta sólido,
// cambia el fondo a su foto (y a su video, en computadora con mouse) y a la
// derecha sale su logo. Sóftbol (Caimanes de Villas, #/softbol) y Fútbol
// (Caimanes FC, fc.html) son link; Pádel (Caimanes Padel Squad) y eSports
// (Caiman X) todavía "Próximamente". Mientras nadie señala, el fondo va
// rotando solo entre los cuatro.
// Sin header, barra de juegos ni footer: js/main.js le pone a <body> la clase
// .is-sport-picker mientras esta pantalla está abierta.
import { fcLogoHtml } from "../fc/ui.js";

// Nombre de la organización, arriba a la izquierda.
const ORG_NAME = "Caimanes";

// Redes de la organización, arriba a la derecha. Para agregar otra, copiar
// una línea: el icono es el nombre de Font Awesome (fa-facebook, fa-tiktok,
// fa-whatsapp, fa-youtube...).
const SOCIALS = [{ label: "Instagram", icon: "fa-instagram", url: "https://www.instagram.com/caimanes.sb/" }];

// Los cuatro deportes, en orden. `href: null` = todavía "Próximamente".
// `video`: se reproduce de fondo al señalarlo con el mouse (solo
// computadora; se descarga hasta ese momento). Las fotos de fondo van en
// css/styles.css (.sp-media--<key>). Si se reemplaza un logo con el mismo
// nombre de archivo, agregar/subir un "?v=" para que no se quede el viejo.
const SPORTS = [
  {
    key: "softbol",
    name: "Sóftbol",
    team: "Caimanes de Villas",
    href: "#/softbol",
    logo: `<img src="assets/logo.png" alt="" class="sp-logo" />`,
    video: "assets/hero-softbol.mp4",
  },
  {
    key: "futbol",
    name: "Fútbol",
    team: "Caimanes FC",
    href: "fc.html",
    logo: fcLogoHtml(220, "sp-logo sp-logo--fc"),
    video: "assets/hero-futbol.mp4",
  },
  {
    key: "padel",
    name: "Pádel",
    team: "Caimanes Padel Squad",
    href: null,
    logo: `<img src="assets/logos/padel.png" alt="" class="sp-logo sp-logo--padel" />`,
    video: "assets/hero-padel.mp4",
  },
  {
    key: "esports",
    name: "eSports",
    team: "Caiman X",
    href: null,
    logo: `<img src="assets/logos/caimanx.png" alt="" class="sp-logo sp-logo--esports" />`,
    video: null,
  },
];

const ROTATE_MS = 5000;

function rowHtml(s, i) {
  const num = String(i + 1).padStart(2, "0");
  const inner = `
      <span class="sp-row-num">${num}</span>
      <span class="sp-row-name">${s.name}</span>
      <span class="sp-row-info">
        <span class="sp-row-logo">${s.logo}</span>
        <span class="sp-row-team">${s.team}</span>
        ${
          s.href
            ? `<span class="sp-row-cta">Entrar <i class="fa-solid fa-arrow-right"></i></span>`
            : `<span class="sp-row-cta sp-row-cta--soon">Próximamente</span>`
        }
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
          <img src="assets/logos/whitelogo@2x.png" alt="" class="sp-org-logo" />
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
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover) and (min-width: 761px)").matches;
  const keys = SPORTS.map((s) => s.key);
  const videos = {};
  let current = null;
  let paused = false;

  function playVideo(key) {
    for (const [k, v] of Object.entries(videos)) {
      if (k !== key) {
        v.classList.remove("is-on");
        v.pause();
      }
    }
    const src = SPORTS.find((s) => s.key === key)?.video;
    if (!src || !canHover || reduce) return;
    let v = videos[key];
    if (!v) {
      v = document.createElement("video");
      v.className = "sp-video";
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.src = src;
      v.addEventListener("playing", () => {
        if (current === key) v.classList.add("is-on");
      });
      root.querySelector(`.sp-media-item[data-key="${key}"]`).append(v);
      videos[key] = v;
    } else {
      v.classList.add("is-on");
    }
    v.play().catch(() => {});
  }

  // fromUser: lo señaló alguien (no la rotación automática) — solo entonces
  // se descarga/reproduce el video, para no bajar los tres solos.
  function setActive(key, fromUser = false) {
    if (key === current && !fromUser) return;
    current = key;
    for (const el of root.querySelectorAll("[data-key]")) el.classList.toggle("is-active", el.dataset.key === key);
    playVideo(fromUser ? key : null);
  }

  setActive(keys[0]);

  const list = root.querySelector(".sp-list");
  for (const row of list.querySelectorAll(".sp-row")) {
    row.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") setActive(row.dataset.key, true);
    });
    row.addEventListener("focus", () => setActive(row.dataset.key, canHover));
  }
  list.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse") paused = true;
  });
  list.addEventListener("pointerleave", () => {
    paused = false;
  });
  list.addEventListener("focusin", () => (paused = true));
  list.addEventListener("focusout", () => (paused = false));

  if (reduce) return;
  const timer = setInterval(() => {
    // Se salió de la portada: se apaga.
    if (!document.body.contains(root)) {
      clearInterval(timer);
      for (const v of Object.values(videos)) v.pause();
      return;
    }
    if (paused || document.hidden) return;
    setActive(keys[(keys.indexOf(current) + 1) % keys.length]);
  }, ROTATE_MS);
}
