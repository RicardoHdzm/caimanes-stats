// Overlays de stream para OBS (caimanx.html). Cada uno se dibuja en un
// <canvas> de 1920×1080 con fondo transparente y se descarga como PNG: en OBS
// va como fuente de Imagen encima del juego y la cámara. Los huecos
// (cámara, juego) quedan transparentes; los recuadros vacíos (marcador,
// récord, equipo) son para encimarles texto o imágenes en OBS.
//
// Para agregar otro tipo: una entrada más en OVERLAYS (o SCREENS) con su
// `draw`.

const W = 1920;
const H = 1080;
const FONT = '"Saira", "Arial Narrow", sans-serif';
const RED = "#d31545";
const RED_DARK = "#8a0d2c";
const PANEL = "rgba(10, 14, 24, 0.9)";
const LOGO_SRC = "assets/logos/caimanx.png?v=2";
// Parte con tinta del logo (el PNG cuadrado trae margen): x 6–94 %, y 11–89 %.
const LOGO_CROP = { x: 0.06, y: 0.113, w: 0.88, h: 0.774 };

// ---- recursos ----

let assetsPromise = null;
function loadAssets() {
  assetsPromise ??= Promise.all([
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = LOGO_SRC;
    }),
    document.fonts?.load(`800 40px ${FONT}`).catch(() => null),
    document.fonts?.load(`600 20px ${FONT}`).catch(() => null),
  ]).then(([logo]) => ({ logo }));
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

// Placa con el logo a la izquierda (sobre rojo), el nombre y "CAIMAN X GAMING".
function namePlate(ctx, logo, x, y, w, h, tag) {
  panel(ctx, x, y, w, h);
  ctx.save();
  roundRect(ctx, x, y, w, h, 10);
  ctx.clip();
  const grad = ctx.createLinearGradient(x, 0, x + h * 1.3, 0);
  grad.addColorStop(0, RED);
  grad.addColorStop(1, RED_DARK);
  ctx.fillStyle = grad;
  slant(ctx, x - 20, y, h * 1.3 + 20, h, 0);
  ctx.fill();
  ctx.restore();
  // Logo en blanco sobre el rojo: se pinta en una capa aparte y se tiñe.
  if (logo) {
    const lh = h * 0.62;
    const layer = document.createElement("canvas");
    layer.width = Math.ceil(lh * 1.2);
    layer.height = Math.ceil(lh);
    const lctx = layer.getContext("2d");
    drawLogo(lctx, logo, layer.width / 2, layer.height / 2, lh);
    lctx.globalCompositeOperation = "source-in";
    lctx.fillStyle = "#fff";
    lctx.fillRect(0, 0, layer.width, layer.height);
    ctx.drawImage(layer, x + (h * 1.3 - layer.width) / 2, y + (h - layer.height) / 2);
  }
  const tx = x + h * 1.3 + 18;
  const maxW = w - h * 1.3 - 34;
  if (h >= 70) {
    text(ctx, tag, tx, y + h * 0.42, { size: Math.round(h * 0.4), italic: true, maxWidth: maxW });
    text(ctx, "CAIMAN X GAMING", tx, y + h * 0.76, { size: Math.round(h * 0.17), weight: 700, color: "#e8375c", maxWidth: maxW, spacing: 3 });
  } else {
    text(ctx, tag, tx, y + h / 2 + 1, { size: Math.round(h * 0.5), italic: true, maxWidth: maxW });
  }
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
// resplandor rojo suave y rayas diagonales muy tenues.
function fullBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0b0f1a");
  g.addColorStop(1, "#141a2b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, H * 0.9, 50, W * 0.85, H * 0.9, 900);
  glow.addColorStop(0, "rgba(211, 21, 69, 0.18)");
  glow.addColorStop(1, "rgba(211, 21, 69, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
  ctx.lineWidth = 2;
  for (let i = -H; i < W; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, H);
    ctx.lineTo(i + H, 0);
    ctx.stroke();
  }
  ctx.restore();
}

// ---- los overlays (durante el juego) ----
//
// Por TIPO de juego, no por juego: lo que cambia entre uno y otro es dónde
// pone cada juego su marcador, minimapa y controles. `id` es el que usa
// GAMES en js/caimanx/data.js para llevar a su tarjeta.

// Cámara + placa con el nombre justo debajo.
function camWithPlate(ctx, logo, tag, x, y, w, h) {
  frame(ctx, x, y, w, h);
  namePlate(ctx, logo, x - 6, y + h + 16, w + 12, 60, tag);
}

const OVERLAYS = [
  {
    id: "general",
    name: "General",
    desc: "Cualquier juego en pantalla completa: cámara abajo a la izquierda.",
    draw(ctx, { logo, tag }) {
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
    draw(ctx, { logo, tag, rival }) {
      frame(ctx, 30, 30, 352, 198, { corner: 24 });
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
      text(ctx, "CAIMAN X GAMING", 960, y + h + 15, { size: 16, weight: 700, color: "#e8375c", align: "center", spacing: 3 });
    },
  },
  {
    id: "deportes",
    name: "Deportes",
    desc: "EA FC (FIFA), NBA 2K y similares: el juego trae su marcador arriba a la izquierda, la cámara va a la derecha.",
    draw(ctx, { logo, tag }) {
      camWithPlate(ctx, logo, tag, 1490, 30, 400, 225);
    },
  },
  {
    id: "shooters",
    name: "Shooters",
    desc: "Fortnite, Warzone, Valorant y similares: cámara a media altura a la izquierda, lejos del minimapa y las armas.",
    draw(ctx, { logo, tag }) {
      camWithPlate(ctx, logo, tag, 30, 380, 384, 216);
    },
  },
  {
    id: "moba",
    name: "MOBA",
    desc: "League of Legends: cámara a la izquierda, lejos del chat, el minimapa y los controles.",
    draw(ctx, { logo, tag }) {
      camWithPlate(ctx, logo, tag, 30, 210, 400, 225);
    },
  },
  {
    id: "pokemon",
    name: "Pokémon",
    desc: "Juego en el recuadro grande, cámara y tu equipo a la derecha, récord abajo.",
    draw(ctx, { logo, tag }) {
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
      // Abajo: nombre y récord.
      namePlate(ctx, logo, 36, 862, 1404, 182, tag);
      panel(ctx, 1476, 862, 408, 182);
      text(ctx, "RÉCORD", 1680, 900, { size: 24, weight: 700, color: "#e8375c", align: "center", spacing: 4 });
      slot(ctx, 1500, 926, 160, 96, "V");
      slot(ctx, 1700, 926, 160, 96, "D");
      text(ctx, "–", 1680, 975, { size: 48, align: "center", color: "rgba(255, 255, 255, 0.5)" });
    },
  },
];

// ---- pantallas (escenas sin juego) ----
//
// Imagen completa: logo al centro, título en dos tonos, tu nombre abajo.

function screen(ctx, logo, tag, custom, [white, red]) {
  fullBackground(ctx);
  const glow = ctx.createRadialGradient(W / 2, 380, 40, W / 2, 380, 620);
  glow.addColorStop(0, "rgba(211, 21, 69, 0.22)");
  glow.addColorStop(1, "rgba(211, 21, 69, 0)");
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
  text(ctx, red, x0 + w1 + gap, 640, { size, italic: true, color: "#e8375c" });
  ctx.restore();
  ctx.fillStyle = RED;
  ctx.fillRect(W / 2 - 70, 730, 140, 6);

  // Sin nombre escrito, solo "CAIMAN X GAMING" (si no, se repetiría).
  if (custom) text(ctx, tag, W / 2, 800, { size: 56, italic: true, align: "center", maxWidth: 1200 });
  text(ctx, "CAIMAN X GAMING", W / 2, custom ? 858 : 800, { size: 26, weight: 700, color: "#e8375c", align: "center", spacing: 8 });
  text(ctx, "CAIMANES.TEAM", W / 2, 1030, { size: 22, weight: 700, color: "rgba(255, 255, 255, 0.45)", align: "center", spacing: 8 });
}

const SCREENS = [
  { id: "empezando", name: "Empezando pronto", words: ["EMPEZANDO", "PRONTO"] },
  { id: "regreso", name: "Ahorita regreso", words: ["AHORITA", "REGRESO"] },
  { id: "fin", name: "Fin del stream", words: ["FIN DEL", "STREAM"] },
].map((s) => ({ ...s, draw: (ctx, { logo, tag, custom }) => screen(ctx, logo, tag, custom, s.words) }));

// ---- página ----

const tagInput = document.getElementById("cx-tag");
const rivalInput = document.getElementById("cx-rival");
const groups = [
  { el: document.getElementById("cx-overlays"), items: OVERLAYS, prefix: "caimanx-overlay-" },
  { el: document.getElementById("cx-screens"), items: SCREENS, prefix: "caimanx-" },
];

function values() {
  return {
    tag: (tagInput.value.trim() || "CAIMAN X").toUpperCase(),
    rival: rivalInput.value.trim().toUpperCase(),
    custom: tagInput.value.trim() !== "",
  };
}

for (const { el, items, prefix } of groups) {
  el.innerHTML = items
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

  // La descarga se arma al hacer clic, con lo que haya en el lienzo.
  el.addEventListener("click", (e) => {
    const link = e.target.closest(".cx-download");
    if (!link) return;
    const canvas = link.closest(".cx-overlay").querySelector("canvas");
    link.href = canvas.toDataURL("image/png");
  });
}

async function render() {
  const { logo } = await loadAssets();
  const v = values();
  for (const { el, items } of groups) {
    for (const o of items) {
      const canvas = el.querySelector(`[data-id="${o.id}"] canvas`);
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, W, H);
      o.draw(ctx, { logo, ...v });
    }
  }
}

let timer = 0;
for (const input of [tagInput, rivalInput]) {
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(render, 150);
  });
}

render();
