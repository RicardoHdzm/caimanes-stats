// Overlays de stream para OBS (caimanx.html#/overlays). Cada uno se dibuja en un
// <canvas> de 1920×1080 con fondo transparente y se descarga como PNG: en OBS
// va como fuente de Imagen encima del juego y la cámara. Los huecos
// (cámara, juego) quedan transparentes; los recuadros vacíos (marcador,
// equipo) son para encimarles texto o imágenes en OBS. Los patrocinadores
// (SPONSORS en js/caimanx/data.js) salen en todos, en blanco.
//
// Para agregar otro tipo: una entrada más en OVERLAYS (o SCREENS) con su
// `draw`.
import { SPONSORS } from "./data.js";

const W = 1920;
const H = 1080;
const FONT = '"Saira", "Arial Narrow", sans-serif';
// Rojo del logo (assets/logos/caimanx.png): rgb(191, 15, 53).
const RED = "#bf0f35";
const PANEL = "rgba(10, 14, 24, 0.9)";
const LOGO_SRC = "assets/logos/caimanx.png?v=5";
// Parte del PNG que se usa (el escudo actual no trae margen: todo).
const LOGO_CROP = { x: 0, y: 0, w: 1, h: 1 };

// ---- recursos ----

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Logo de patrocinador listo para pintar: recortado a su parte con tinta
// (los PNG traen margen) y en blanco, para que se lea sobre lo oscuro.
function prepareSponsor(img) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const cx = c.getContext("2d");
  cx.drawImage(img, 0, 0);
  const { data } = cx.getImageData(0, 0, c.width, c.height);
  let x0 = c.width;
  let y0 = c.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  const oc = out.getContext("2d");
  oc.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  oc.globalCompositeOperation = "source-in";
  oc.fillStyle = "#fff";
  oc.fillRect(0, 0, out.width, out.height);
  return { img: out, ratio: out.width / out.height };
}

let assetsPromise = null;
function loadAssets() {
  assetsPromise ??= Promise.all([
    loadImage(LOGO_SRC),
    Promise.all(SPONSORS.map((s) => loadImage(s.logo))),
    document.fonts?.load(`800 40px ${FONT}`).catch(() => null),
    document.fonts?.load(`600 20px ${FONT}`).catch(() => null),
  ]).then(([logo, imgs]) => ({ logo, sponsors: imgs.filter(Boolean).map(prepareSponsor).filter(Boolean) }));
  return assetsPromise;
}

// ---- helpers de dibujo ----

function font(size, weight = 800, italic = false) {
  return `${italic ? "italic " : ""}${weight} ${size}px ${FONT}`;
}

// Texto que se achica hasta caber en maxWidth.
function text(ctx, str, x, y, { size, weight = 800, italic = false, color = "#fff", align = "left", maxWidth = 9999, spacing = 0 }) {
  let s = size;
  ctx.font = font(s, weight, italic);
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
  while (s > 12 && ctx.measureText(str).width > maxWidth) {
    s -= 2;
    ctx.font = font(s, weight, italic);
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(str, x, y);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
}

// "CAIMANX GAMING" en rojo con la X en blanco, para que destaque. Mismas
// opciones que text() (siempre peso 700).
function brandText(ctx, x, y, { size, align = "left", maxWidth = 9999, spacing = 0 }) {
  const parts = [
    ["CAIMAN", RED],
    ["X", "#fff"],
    [" GAMING", RED],
  ];
  let s = size;
  const measure = () => {
    ctx.font = font(s, 700);
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
    return parts.reduce((sum, [str]) => sum + ctx.measureText(str).width, 0);
  };
  let total = measure();
  while (s > 12 && total > maxWidth) {
    s -= 2;
    total = measure();
  }
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const [str, color] of parts) {
    ctx.fillStyle = color;
    ctx.fillText(str, cx, y);
    cx += ctx.measureText(str).width;
  }
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Paralelogramo (orillas inclinadas `skew` px), para las placas de Smash.
function slant(ctx, x, y, w, h, skew) {
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - skew, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function drawLogo(ctx, logo, cx, cy, height) {
  if (!logo) return;
  const sw = logo.naturalWidth * LOGO_CROP.w;
  const sh = logo.naturalHeight * LOGO_CROP.h;
  const w = height * (sw / sh);
  ctx.drawImage(logo, logo.naturalWidth * LOGO_CROP.x, logo.naturalHeight * LOGO_CROP.y, sw, sh, cx - w / 2, cy - height / 2, w, height);
}

// Panel oscuro con raya roja arriba.
function panel(ctx, x, y, w, h, r = 10) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 20;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.fillStyle = RED;
  ctx.fillRect(x, y, w, 4);
  ctx.restore();
}

// Marco de un hueco transparente (cámara o juego): raya roja y esquinas
// blancas.
function frame(ctx, x, y, w, h, { thick = 6, corner = 34 } = {}) {
  ctx.clearRect(x, y, w, h);
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 16;
  ctx.strokeStyle = RED;
  ctx.lineWidth = thick;
  ctx.strokeRect(x - thick / 2, y - thick / 2, w + thick, h + thick);
  ctx.restore();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  const o = thick + 2;
  const corners = [
    [x - o, y - o, 1, 1],
    [x + w + o, y - o, -1, 1],
    [x - o, y + h + o, 1, -1],
    [x + w + o, y + h + o, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * corner, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * corner);
    ctx.stroke();
  }
}

// Placa con el logo a la izquierda (en su recuadro oscuro, con raya roja),
// el nombre y "CAIMANX GAMING".
function namePlate(ctx, logo, x, y, w, h, tag, reserve = 0) {
  panel(ctx, x, y, w, h);
  ctx.save();
  roundRect(ctx, x, y, w, h, 10);
  ctx.clip();
  // El escudo es rojo y blanco: va sobre oscuro para que se lea completo.
  ctx.fillStyle = "#06080f";
  ctx.fillRect(x, y, h * 1.3, h);
  ctx.fillStyle = RED;
  ctx.fillRect(x + h * 1.3 - 4, y, 4, h);
  ctx.restore();
  drawLogo(ctx, logo, x + (h * 1.3) / 2, y + h / 2 + 1, h * 0.7);
  const tx = x + h * 1.3 + 18;
  const maxW = w - h * 1.3 - 34 - reserve;
  if (h >= 70) {
    text(ctx, tag, tx, y + h * 0.42, { size: Math.round(h * 0.4), italic: true, maxWidth: maxW });
    brandText(ctx, tx, y + h * 0.76, { size: Math.round(h * 0.17), maxWidth: maxW, spacing: 3 });
  } else {
    text(ctx, tag, tx, y + h / 2 + 1, { size: Math.round(h * 0.5), italic: true, maxWidth: maxW });
  }
}

// ---- patrocinadores ----

// Logos en fila, de `h` de alto, centrados en `cy`; se achican si no caben
// en maxW. `align`: de dónde parte `x` (left, center, right).
function sponsorLogos(ctx, sponsors, x, cy, h, maxW, align = "left") {
  const gap = h * 0.6;
  const total = sponsors.reduce((sum, s) => sum + h * s.ratio, 0) + gap * (sponsors.length - 1);
  const k = Math.min(1, maxW / total);
  let cx = align === "center" ? x - (total * k) / 2 : align === "right" ? x - total * k : x;
  for (const s of sponsors) {
    const w = h * s.ratio * k;
    ctx.drawImage(s.img, cx, cy - (h * k) / 2, w, h * k);
    cx += w + gap * k;
  }
}

// Barrita oscura con "SPONSORS" y los logos.
function sponsorBar(ctx, sponsors, x, y, w, h) {
  if (!sponsors.length) return;
  panel(ctx, x, y, w, h, 8);
  text(ctx, "SPONSORS", x + 14, y + h / 2 + 2, { size: 14, weight: 700, color: RED, spacing: 2 });
  ctx.font = font(14, 700);
  const lx = x + 14 + ctx.measureText("SPONSORS").width + 44;
  sponsorLogos(ctx, sponsors, lx, y + h / 2 + 2, h * 0.5, x + w - 14 - lx);
}

// Recuadro vacío con su etiqueta arriba (para texto/imagen en OBS).
function slot(ctx, x, y, w, h, label) {
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 2;
  ctx.stroke();
  if (label) text(ctx, label, x + 14, y + 20, { size: 18, weight: 700, color: "rgba(255, 255, 255, 0.45)", spacing: 2 });
}

// Fondo para los overlays de pantalla completa: azul marino con un
// resplandor rojo suave y cuadrícula tipo pantalla/HUD (fina cada 40 px,
// más marcada cada 200 px, con una cruz roja en cada cruce grande).
function fullBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0b0f1a");
  g.addColorStop(1, "#141a2b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, H * 0.9, 50, W * 0.85, H * 0.9, 900);
  glow.addColorStop(0, "rgba(191, 15, 53, 0.18)");
  glow.addColorStop(1, "rgba(191, 15, 53, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  const lines = (step, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = step; x < W; x += step) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
    }
    for (let y = step; y < H; y += step) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();
  };
  lines(40, "rgba(255, 255, 255, 0.035)");
  lines(200, "rgba(255, 255, 255, 0.07)");
  ctx.strokeStyle = "rgba(191, 15, 53, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 200; x < W; x += 200) {
    for (let y = 200; y < H; y += 200) {
      ctx.moveTo(x - 7, y + 0.5);
      ctx.lineTo(x + 8, y + 0.5);
      ctx.moveTo(x + 0.5, y - 7);
      ctx.lineTo(x + 0.5, y + 8);
    }
  }
  ctx.stroke();
  ctx.restore();
}

// ---- los overlays (durante el juego) ----
//
// Por TIPO de juego, no por juego: lo que cambia entre uno y otro es dónde
// pone cada juego su marcador, minimapa y controles. `id` es el que usa
// GAMES en js/caimanx/data.js para llevar a su tarjeta.

// Cámara + placa con el nombre justo debajo.
function camWithPlate(ctx, logo, tag, x, y, w, h, sponsors = []) {
  frame(ctx, x, y, w, h);
  namePlate(ctx, logo, x - 6, y + h + 16, w + 12, 60, tag);
  sponsorBar(ctx, sponsors, x - 6, y + h + 16 + 60 + 8, w + 12, 44);
}

const OVERLAYS = [
  {
    id: "general",
    name: "General",
    desc: "Cualquier juego en pantalla completa: cámara abajo a la izquierda.",
    draw(ctx, { logo, tag, sponsors }) {
      sponsorBar(ctx, sponsors, 34, 634, 492, 44);
      frame(ctx, 40, 694, 480, 270);
      namePlate(ctx, logo, 34, 982, 492, 64, tag);
      // Logo chico arriba a la derecha.
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = 18;
      drawLogo(ctx, logo, W - 110, 82, 96);
      ctx.restore();
    },
  },
  {
    id: "peleas",
    name: "Peleas (1 vs 1)",
    desc: "Smash Bros y juegos de peleas: marcador arriba al centro y cámara arriba a la izquierda.",
    draw(ctx, { logo, tag, rival, sponsors }) {
      frame(ctx, 30, 30, 352, 198, { corner: 24 });
      sponsorBar(ctx, sponsors, 24, 246, 364, 44);
      const y = 18;
      const h = 72;
      // Placas de nombre.
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = PANEL;
      slant(ctx, 430, y, 410, h, 26);
      ctx.fill();
      slant(ctx, 1080, y, 410, h, 26);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = RED;
      slant(ctx, 430, y + h - 5, 410, 5, 2);
      ctx.fill();
      slant(ctx, 1080, y + h - 5, 410, 5, 2);
      ctx.fill();
      text(ctx, tag, 812, y + h / 2, { size: 38, italic: true, align: "right", maxWidth: 330 });
      // Sin rival, la placa queda vacía para ponerle texto en OBS.
      if (rival) text(ctx, rival, 1108, y + h / 2, { size: 38, italic: true, align: "left", maxWidth: 330 });
      // Puntos (vacíos) y logo al centro.
      for (const x of [840, 1000]) {
        ctx.fillStyle = RED;
        ctx.fillRect(x, y, 80, h);
        ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
        ctx.fillRect(x, y + h / 2, 80, h / 2);
      }
      ctx.fillStyle = "#0a0e18";
      ctx.fillRect(920, y, 80, h);
      drawLogo(ctx, logo, 960, y + h / 2, 52);
      // Pestaña con el nombre del equipo.
      ctx.fillStyle = PANEL;
      slant(ctx, 840, y + h, 240, 30, 10);
      ctx.fill();
      brandText(ctx, 960, y + h + 15, { size: 16, align: "center", spacing: 3 });
    },
  },
  {
    id: "deportes",
    name: "Deportes",
    desc: "EA FC (FIFA), NBA 2K y similares: el juego trae su marcador arriba a la izquierda, la cámara va a la derecha.",
    draw(ctx, { logo, tag, sponsors }) {
      camWithPlate(ctx, logo, tag, 1490, 30, 400, 225, sponsors);
    },
  },
  {
    id: "shooters",
    name: "Shooters",
    desc: "Fortnite, Warzone, Valorant y similares: cámara a media altura a la izquierda, lejos del minimapa y las armas.",
    draw(ctx, { logo, tag, sponsors }) {
      camWithPlate(ctx, logo, tag, 30, 380, 384, 216, sponsors);
    },
  },
  {
    id: "moba",
    name: "MOBA",
    desc: "League of Legends: cámara a la izquierda, lejos del chat, el minimapa y los controles.",
    draw(ctx, { logo, tag, sponsors }) {
      camWithPlate(ctx, logo, tag, 30, 210, 400, 225, sponsors);
    },
  },
  {
    id: "pokemon",
    name: "Pokémon",
    desc: "Juego en el recuadro grande, cámara y tu equipo a la derecha, tu nombre abajo.",
    draw(ctx, { logo, tag, sponsors }) {
      fullBackground(ctx);
      // Juego (16:9) y cámara.
      frame(ctx, 36, 36, 1404, 790);
      frame(ctx, 1476, 36, 408, 230, { corner: 26 });
      // Equipo: 6 lugares.
      text(ctx, "EQUIPO", 1476, 312, { size: 30, italic: true, spacing: 2 });
      ctx.fillStyle = RED;
      ctx.fillRect(1476, 334, 60, 4);
      const sw = (408 - 16) / 2;
      const sh = 152;
      for (let i = 0; i < 6; i++) {
        slot(ctx, 1476 + (i % 2) * (sw + 16), 356 + Math.floor(i / 2) * (sh + 12), sw, sh, String(i + 1));
      }
      // Abajo, a todo lo ancho: nombre y, a la derecha, patrocinadores.
      const reserve = sponsors.length ? 440 : 0;
      namePlate(ctx, logo, 36, 862, 1848, 182, tag, reserve);
      if (sponsors.length) {
        const cx = 1884 - reserve / 2 - 10;
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fillRect(1884 - reserve, 894, 2, 118);
        text(ctx, "SPONSORS", cx, 914, { size: 18, weight: 700, color: RED, align: "center", spacing: 3 });
        sponsorLogos(ctx, sponsors, cx, 968, 64, reserve - 70, "center");
      }
    },
  },
];

// ---- pantallas (escenas sin juego) ----
//
// Imagen completa: logo al centro, título en dos tonos, tu nombre abajo.

function screen(ctx, logo, tag, custom, sponsors, [white, red]) {
  fullBackground(ctx);
  const glow = ctx.createRadialGradient(W / 2, 380, 40, W / 2, 380, 620);
  glow.addColorStop(0, "rgba(191, 15, 53, 0.22)");
  glow.addColorStop(1, "rgba(191, 15, 53, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 40;
  drawLogo(ctx, logo, W / 2, 330, 300);
  ctx.restore();

  // Título: primera parte en blanco, segunda en rojo, centrado como un todo.
  const size = 150;
  ctx.font = font(size, 800, true);
  const gap = 34;
  const w1 = ctx.measureText(white).width;
  const w2 = ctx.measureText(red).width;
  const x0 = (W - (w1 + gap + w2)) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 30;
  text(ctx, white, x0, 640, { size, italic: true });
  text(ctx, red, x0 + w1 + gap, 640, { size, italic: true, color: RED });
  ctx.restore();
  ctx.fillStyle = RED;
  ctx.fillRect(W / 2 - 70, 730, 140, 6);

  // Sin nombre escrito, solo "CAIMANX GAMING" (si no, se repetiría).
  if (custom) text(ctx, tag, W / 2, 800, { size: 56, italic: true, align: "center", maxWidth: 1200 });
  brandText(ctx, W / 2, custom ? 858 : 800, { size: 26, align: "center", spacing: 8 });
  if (sponsors.length) {
    text(ctx, "SPONSORS", W / 2, 934, { size: 18, weight: 700, color: "rgba(255, 255, 255, 0.55)", align: "center", spacing: 6 });
    sponsorLogos(ctx, sponsors, W / 2, 978, 52, 1200, "center");
  }
  text(ctx, "CAIMANES.TEAM", W / 2, 1040, { size: 22, weight: 700, color: "rgba(255, 255, 255, 0.45)", align: "center", spacing: 8 });
}

const SCREENS = [
  { id: "empezando", name: "Empezando pronto", words: ["EMPEZANDO", "PRONTO"] },
  { id: "regreso", name: "Ahorita regreso", words: ["AHORITA", "REGRESO"] },
  { id: "fin", name: "Fin del stream", words: ["FIN DEL", "STREAM"] },
].map((s) => ({ ...s, draw: (ctx, { logo, tag, custom, sponsors }) => screen(ctx, logo, tag, custom, sponsors, s.words) }));

// ---- página (#/overlays, la pinta js/caimanx/main.js) ----

export const OVERLAY_COUNT = OVERLAYS.length + SCREENS.length;

// Lo escrito se recuerda mientras la página esté abierta (al ir a otra
// sección y volver).
const typed = { tag: "", rival: "" };

function cardsHtml(items, prefix) {
  return items
    .map(
      (o) => `
    <article class="cx-overlay" id="overlay-${o.id}" data-id="${o.id}">
      <div class="cx-overlay-preview"><canvas width="${W}" height="${H}" aria-label="Vista previa: ${o.name}"></canvas></div>
      <div class="cx-overlay-body">
        <div>
          <h3 class="cx-overlay-name">${o.name}</h3>
          ${o.desc ? `<p class="cx-overlay-desc">${o.desc}</p>` : ""}
        </div>
        <a class="cx-download" href="#" download="${prefix}${o.id}.png"><i class="fa-solid fa-download"></i> PNG</a>
      </div>
    </article>`
    )
    .join("");
}

export function renderOverlays(container) {
  const root = document.createElement("div");
  root.className = "cx-overlays-page";
  root.innerHTML = `
    <div class="cx-fields">
      <label class="cx-field">
        <span>Tu nombre o tag</span>
        <input type="text" data-field="tag" maxlength="20" placeholder="CAIMANX" autocomplete="off" />
      </label>
      <label class="cx-field">
        <span>Rival (peleas)</span>
        <input type="text" data-field="rival" maxlength="20" placeholder="Opcional" autocomplete="off" />
      </label>
    </div>

    <h3 class="cx-subtitle">Durante el juego</h3>
    <div class="cx-overlays">${cardsHtml(OVERLAYS, "caimanx-overlay-")}</div>

    <h3 class="cx-subtitle">Pantallas</h3>
    <div class="cx-overlays">${cardsHtml(SCREENS, "caimanx-")}</div>

    <div class="cx-howto">
      <h3>Cómo ponerlo en OBS</h3>
      <ol>
        <li>Descarga el PNG (1920×1080). Los de juego traen fondo transparente.</li>
        <li>En OBS, en <b>Fuentes</b>, toca <b>+</b> → <b>Imagen</b> y elige el archivo.</li>
        <li>Déjalo hasta arriba de la lista de fuentes, encima de la captura del juego y de la cámara.</li>
        <li>Acomoda tu cámara dentro del marco rojo. En Pokémon, mete la captura del juego en el recuadro grande.</li>
        <li>Para el marcador o tu equipo, agrega fuentes de <b>Texto</b> o <b>Imagen</b> encima de los recuadros vacíos.</li>
        <li>Las pantallas (empezando, regreso, fin) van cada una en su propia escena.</li>
      </ol>
    </div>`;
  container.appendChild(root);

  const inputs = root.querySelectorAll("input[data-field]");
  for (const input of inputs) input.value = typed[input.dataset.field];

  async function draw() {
    const { logo, sponsors } = await loadAssets();
    if (!root.isConnected) return;
    const v = {
      tag: (typed.tag.trim() || "CAIMANX").toUpperCase(),
      rival: typed.rival.trim().toUpperCase(),
      custom: typed.tag.trim() !== "",
    };
    for (const o of [...OVERLAYS, ...SCREENS]) {
      const canvas = root.querySelector(`[data-id="${o.id}"] canvas`);
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, W, H);
      o.draw(ctx, { logo, sponsors, ...v });
    }
  }

  let timer = 0;
  for (const input of inputs) {
    input.addEventListener("input", () => {
      typed[input.dataset.field] = input.value;
      clearTimeout(timer);
      timer = setTimeout(draw, 150);
    });
  }

  // La descarga se arma al hacer clic, con lo que haya en el lienzo.
  root.addEventListener("click", (e) => {
    const link = e.target.closest(".cx-download");
    if (!link) return;
    const canvas = link.closest(".cx-overlay").querySelector("canvas");
    link.href = canvas.toDataURL("image/png");
  });

  draw();
}
