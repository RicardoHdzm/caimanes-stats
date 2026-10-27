// Flyers para compartir en redes (próximo juego, lineup, resultado de un
// juego). Se dibujan en un <canvas> de 1080×1350 ("post", 4:5 de
// Instagram/Facebook, también se ve bien en WhatsApp) o 1080×1920
// ("historia", 9:16) y se abren en una ventanita con la vista previa +
// "Compartir" (menú nativo del celular, con la imagen adjunta) y
// "Descargar". Todo sale de data.js y de assets/ — no hay servidor ni nada
// externo de por medio.
//
// Los colores (fondo, texto, rojo) salen del TEMA ACTIVO (Sol / Eclipse /
// Luna, ver js/theme.js) — se leen de las variables CSS al momento de
// dibujar, así que el flyer sale como se ve el sitio en ese momento.
//
// Las rutas a assets/ se arman con import.meta.url (no relativas a la
// página) porque esto también lo usa lineup/index.html, que vive en una
// subcarpeta. Las fuentes (Barlow Condensed) ya las declara css/styles.css
// con @font-face; aquí solo se espera a que carguen antes de dibujar.
import { TEAM, SEASONS, CURRENT_SEASON, SPONSORS, PLAYERS } from "./data.js";
import { gameMvp } from "./stats.js";

const W = 1080;
// H = alto del CONTENIDO (el diseño del post). En historia el lienzo mide
// 1920: el logo crece y va arriba, y el resto del contenido se recorre
// debajo (ver placeLogo).
const H = 1350;
const FORMAT_HEIGHT = { post: 1350, story: 1920 };
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
const WIN = "#3fb56f";
const GOLD = "#f5b942";
const TEAM_NAME = "CAIMANES DE VILLAS";

const asset = (path) => new URL(`../${path}`, import.meta.url).href;

// ---- colores del tema activo ----

// Paleta del flyer que se está dibujando (la pone newFlyer()).
let P = null;

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, alpha) {
  const rgb = hexToRgb(hex) ?? [226, 32, 47];
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function themePalette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  const light = document.documentElement.dataset.theme === "light";
  return {
    light,
    bg: v("--bg", "#0d0d0d"),
    text: v("--text", "#f2f2f2"),
    muted: v("--muted", "#a3a8b0"),
    accent: v("--accent", "#e2202f"),
    accentDark: v("--accent-dark", "#9c1526"),
    // Rojo para TEXTO sobre el fondo (en claro, el más oscuro — contraste).
    accentText: v("--accent-text", "#ff5a6e"),
    // Velo sutil para cajas/rayas: blanco en temas oscuros, negro en claro.
    tint: (a) => (light ? `rgba(0, 0, 0, ${a * 0.7})` : `rgba(255, 255, 255, ${a})`),
  };
}

// ---- carga de recursos ----

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

let assetsPromise = null;
function loadAssets() {
  assetsPromise ??= (async () => {
    await Promise.all(
      ["600 40px", "700 40px", "italic 700 40px"].map((spec) => document.fonts?.load(`${spec} ${FONT}`).catch(() => null))
    );
    const [logo, ...sponsors] = await Promise.all([
      loadImage(asset("assets/logo.png")),
      ...SPONSORS.map((s) => loadImage(asset(s.logo))),
    ]);
    return { logo, sponsors: sponsors.map(sponsorVariants).filter(Boolean) };
  })();
  return assetsPromise;
}

// Logo de patrocinador (negro sobre transparente, ver SPONSORS en data.js)
// → recortado a su contenido, en dos versiones: negro (tema claro) y
// blanco (temas oscuros).
function sponsorVariants(img) {
  if (!img?.naturalWidth) return null;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  let box = { x: 0, y: 0, w, h };
  try {
    const a = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (a[(y * w + x) * 4 + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX >= minX) box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  } catch {
    // Sin lectura de píxeles: se queda sin recortar.
  }
  const make = (color) => {
    const out = document.createElement("canvas");
    out.width = box.w;
    out.height = box.h;
    const o = out.getContext("2d");
    o.drawImage(c, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    o.globalCompositeOperation = "source-in";
    o.fillStyle = color;
    o.fillRect(0, 0, box.w, box.h);
    return out;
  };
  return { dark: make("#ffffff"), light: make("#111111"), ratio: box.w / box.h };
}

// ---- helpers de dibujo ----

function font(size, { weight = 700, italic = false } = {}) {
  return `${italic ? "italic " : ""}${weight} ${size}px ${FONT}`;
}

// Achica el tamaño hasta que el texto quepa en maxWidth.
function fitFont(ctx, str, maxWidth, size, opts) {
  let s = size;
  ctx.font = font(s, opts);
  while (s > 20 && ctx.measureText(str).width > maxWidth) {
    s -= 4;
    ctx.font = font(s, opts);
  }
  return s;
}

function text(ctx, str, x, y, { size, color = P.text, align = "center", maxWidth = W - 120, ...opts }) {
  fitFont(ctx, str, maxWidth, size, opts);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(str, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Píldora de color con texto adentro, centrada en cx.
function pill(ctx, label, cx, y, { bg = P.accent, color = "#fff", size = 40, padX = 34, height = 68 } = {}) {
  ctx.font = font(size);
  const w = ctx.measureText(label).width + padX * 2;
  roundRect(ctx, cx - w / 2, y, w, height, height / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, y + height / 2 + 2);
  ctx.textBaseline = "alphabetic";
}

function leagueLine() {
  return (SEASONS[CURRENT_SEASON - 1]?.league ?? TEAM.league).toUpperCase();
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function playerById(id) {
  return PLAYERS.find((p) => p.id === id) ?? null;
}

// Fondo de marca con los colores del tema: fondo del tema, brillo rojo
// arriba, rayas diagonales sutiles y barras rojas arriba/abajo — mismo
// lenguaje que el sitio. `CH` = alto real del lienzo (post o historia).
function drawBackground(ctx, CH) {
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, CH);

  const glow = ctx.createRadialGradient(W / 2, 120, 40, W / 2, 120, 900);
  glow.addColorStop(0, rgba(P.accent, P.light ? 0.16 : 0.38));
  glow.addColorStop(1, rgba(P.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, CH);

  ctx.save();
  ctx.strokeStyle = P.tint(0.035);
  ctx.lineWidth = 2;
  for (let x = -CH; x < W; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, CH);
    ctx.lineTo(x + CH, 0);
    ctx.stroke();
  }
  ctx.restore();

  if (!P.light) {
    const fade = ctx.createLinearGradient(0, CH - 420, 0, CH);
    fade.addColorStop(0, "rgba(0, 0, 0, 0)");
    fade.addColorStop(1, "rgba(0, 0, 0, 0.6)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, CH - 420, W, 420);
  }

  const bar = ctx.createLinearGradient(0, 0, W, 0);
  bar.addColorStop(0, P.accentDark);
  bar.addColorStop(0.5, P.accent);
  bar.addColorStop(1, P.accentDark);
  ctx.fillStyle = bar;
  ctx.fillRect(0, CH - 14, W, 14);
  ctx.fillRect(0, 0, W, 8);
}

function drawLogo(ctx, logo, cx, y, size) {
  if (!logo) return;
  ctx.save();
  ctx.shadowColor = P.light ? "rgba(0, 0, 0, 0.18)" : "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 30;
  ctx.drawImage(logo, cx - size / 2, y, size, size);
  ctx.restore();
}

// Liga + tira de patrocinadores, pegados abajo.
function drawFooter(ctx, sponsors) {
  text(ctx, leagueLine(), W / 2, H - 200, { size: 34, color: P.muted, weight: 600 });
  if (sponsors.length === 0) return;

  // Mismo criterio que fitSponsorLogo() del pie del sitio: peso visual
  // parejo (alto = base / proporción^0.6) en vez de altura pareja.
  const BASE = 84;
  const GAP = 48;
  let items = sponsors.map((s) => {
    const h = Math.min(BASE / s.ratio ** 0.6, BASE);
    return { c: P.light ? s.light : s.dark, w: h * s.ratio, h };
  });
  const total = items.reduce((sum, i) => sum + i.w, 0) + GAP * (items.length - 1);
  const scale = Math.min(1, (W - 140) / total);
  items = items.map((i) => ({ ...i, w: i.w * scale, h: i.h * scale }));
  let x = (W - total * scale) / 2;
  const midY = H - 105;
  ctx.globalAlpha = 0.85;
  for (const i of items) {
    ctx.drawImage(i.c, x, midY - i.h / 2, i.w, i.h);
    x += i.w + GAP * scale;
  }
  ctx.globalAlpha = 1;
}

// Lienzo del formato pedido, con la paleta del tema activo y el fondo ya
// pintado de orilla a orilla. El logo y el desplazamiento del contenido los
// pone placeLogo() (en historia el logo va más grande, arriba).
function newFlyer(format) {
  P = themePalette();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = FORMAT_HEIGHT[format] ?? H;
  const ctx = canvas.getContext("2d");
  drawBackground(ctx, canvas.height);
  return { canvas, ctx, story: format === "story" };
}

// En post: el logo va donde dice el diseño (`y`, `size`). En historia
// (1920 de alto) sobra espacio: el logo sale MUCHO más grande en la parte
// de arriba y el resto del contenido (que en el diseño empieza en
// `contentTop`) se recorre para quedar justo debajo.
const STORY_LOGO = { y: 140, size: 470, gap: 30 };
function placeLogo(ctx, logo, story, { y, size, contentTop }) {
  if (!story) {
    drawLogo(ctx, logo, W / 2, y, size);
    return;
  }
  drawLogo(ctx, logo, W / 2, STORY_LOGO.y, STORY_LOGO.size);
  ctx.translate(0, STORY_LOGO.y + STORY_LOGO.size + STORY_LOGO.gap - contentTop);
}

// ---- los tres flyers ----

// `game`: una entrada de SCHEDULE ({ date, time, opponent }).
export async function nextGameFlyer(game, format = "post") {
  const { logo, sponsors } = await loadAssets();
  const { canvas, ctx, story } = newFlyer(format);
  placeLogo(ctx, logo, story, { y: 36, size: 340, contentTop: 398 });

  pill(ctx, "PRÓXIMO JUEGO", W / 2, 398, { size: 42 });

  text(ctx, TEAM_NAME, W / 2, 600, { size: 130, italic: true });
  text(ctx, "VS", W / 2, 684, { size: 60, color: P.accentText });
  text(ctx, (game.opponent ?? "Rival").toUpperCase(), W / 2, 822, { size: 112, italic: true });

  roundRect(ctx, 150, 875, W - 300, 180, 28);
  ctx.fillStyle = P.tint(0.06);
  ctx.fill();
  ctx.strokeStyle = P.tint(0.12);
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, formatDate(game.date), W / 2, 950, { size: 58, maxWidth: W - 360 });
  if (game.time) text(ctx, formatTime(game.time), W / 2, 1028, { size: 70, color: P.accentText, italic: true });

  drawFooter(ctx, sponsors);
  return canvas;
}

// `order`: filas del orden al bat ({ name, position, slotDisplay }) — la
// última puede ser el pitcher (slot "P"). `game` (opcional): próximo juego
// de SCHEDULE, para el "vs Rival · fecha".
export async function lineupFlyer(order, game = null, format = "post") {
  const { logo, sponsors } = await loadAssets();
  const { canvas, ctx, story } = newFlyer(format);
  placeLogo(ctx, logo, story, { y: 24, size: 240, contentTop: 285 });

  text(ctx, "LINEUP", W / 2, 360, { size: 110, italic: true });
  if (game) {
    const sub = `VS ${(game.opponent ?? "").toUpperCase()} · ${formatDate(game.date)}${game.time ? ` · ${formatTime(game.time)}` : ""}`;
    text(ctx, sub, W / 2, 412, { size: 38, color: P.accentText, weight: 600 });
  }

  const top = 445;
  const bottom = H - 265;
  const rowH = Math.min(66, (bottom - top) / Math.max(order.length, 1));
  const left = 150;
  const right = W - 150;
  order.forEach((row, i) => {
    const y = top + i * rowH;
    const mid = y + rowH / 2;
    if (i % 2 === 0) {
      roundRect(ctx, left - 30, y + 3, right - left + 60, rowH - 6, 14);
      ctx.fillStyle = P.tint(0.05);
      ctx.fill();
    }
    // Turno (o "P" para el pitcher que no batea).
    const slot = row.slotDisplay ?? String(i + 1);
    ctx.beginPath();
    ctx.arc(left + 22, mid, 24, 0, Math.PI * 2);
    ctx.fillStyle = slot === "P" ? P.tint(0.14) : P.accent;
    ctx.fill();
    ctx.fillStyle = slot === "P" ? P.text : "#fff";
    ctx.font = font(30);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(slot, left + 22, mid + 1);

    // Nombre.
    ctx.textAlign = "left";
    fitFont(ctx, row.name.toUpperCase(), right - left - 200, 42);
    ctx.fillStyle = P.text;
    ctx.fillText(row.name.toUpperCase(), left + 72, mid + 2);

    // Posición: badge en blanco (color del texto del tema) para todas, a
    // petición expresa — ya no con el color de cada posición del sitio.
    const pos = row.position ?? "";
    if (pos) {
      const color = P.text;
      const bw = 86;
      const bh = 44;
      roundRect(ctx, right - bw, mid - bh / 2, bw, bh, 10);
      ctx.fillStyle = P.tint(0.1);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = font(30);
      ctx.textAlign = "center";
      ctx.fillText(pos, right - bw / 2, mid + 1);
    }
    ctx.textBaseline = "alphabetic";
  });

  drawFooter(ctx, sponsors);
  return canvas;
}

// `game`: un juego de GAMES/PLAYOFFS. `playoffRound` (opcional): nombre de
// la ronda si es de playoffs.
export async function resultFlyer(game, playoffRound = null, format = "post") {
  const { logo, sponsors } = await loadAssets();
  const { canvas, ctx, story } = newFlyer(format);
  placeLogo(ctx, logo, story, { y: 24, size: 240, contentTop: 300 });

  const us = game.scoreUs;
  const them = game.scoreThem;
  // VICTORIA / DERROTA en grande y a color (verde / rojo), sin píldora de
  // fondo — es lo primero que se tiene que leer.
  const result = us > them ? "VICTORIA" : us < them ? "DERROTA" : "EMPATE";
  const resultColor = us > them ? WIN : us < them ? P.accentText : P.muted;
  ctx.save();
  ctx.shadowColor = rgba(us > them ? WIN : P.accent, P.light ? 0.25 : 0.45);
  ctx.shadowBlur = 40;
  text(ctx, result, W / 2, 445, { size: 190, italic: true, color: resultColor, maxWidth: W - 140 });
  ctx.restore();
  if (playoffRound) text(ctx, `PLAYOFFS · ${playoffRound.toUpperCase()}`, W / 2, 505, { size: 36, color: P.light ? "#a87412" : GOLD });

  // Marcador: Caimanes a la izquierda, rival a la derecha.
  const colL = W * 0.27;
  const colR = W * 0.73;
  text(ctx, TEAM_NAME, colL, 585, { size: 50, maxWidth: 420 });
  text(ctx, (game.opponent ?? "Rival").toUpperCase(), colR, 585, { size: 50, maxWidth: 420 });
  text(ctx, String(us), colL, 790, { size: 220, italic: true, color: us >= them ? P.text : P.muted });
  text(ctx, String(them), colR, 790, { size: 220, italic: true, color: them > us ? P.text : P.muted });
  text(ctx, "-", W / 2, 750, { size: 130, color: P.accentText });
  text(ctx, `${formatDate(game.date)}${game.time ? ` · ${formatTime(game.time)}` : ""}`, W / 2, 855, { size: 40, color: P.muted, weight: 600 });

  // Solo el MVP (a petición expresa, ya sin "figuras del juego").
  const mvpId = gameMvp(game); // derrota = sin MVP (ver gameMvp en js/stats.js)
  if (mvpId) {
    const mvp = playerById(mvpId);
    const gold = P.light ? "#a87412" : GOLD;
    const y = 905;
    roundRect(ctx, 170, y, W - 340, 104, 52);
    ctx.fillStyle = rgba(GOLD, P.light ? 0.2 : 0.14);
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 3;
    ctx.stroke();
    text(ctx, `★ MVP: ${(mvp?.name ?? mvpId).toUpperCase()}`, W / 2, y + 70, { size: 56, color: gold, maxWidth: W - 420 });
  }

  drawFooter(ctx, sponsors);
  return canvas;
}

// ---- Wallpaper de jersey (pestaña Fanzone, ver js/views/fanzone.js) ----
//
// Diseño de Ricardo: fondo con trama de piel de caimán, apellido (sin acentos) y
// número centrados en la fuente
// de jersey Legend M54 (assets/fonts/legend-m54.ttf) y, debajo, la cabeza
// del caimán (assets/logos/, versión blanca o roja según el estilo). El
// estilo Clásico lleva una sombra suave en las letras; el Moderno, plano.
// 1170×2532 = proporción de los celulares actuales (19.5:9).
const WALL_W = 1170;
const WALL_H = 2532;
const JERSEY_FONT = '"Legend M54", "Barlow Condensed", "Arial Narrow", sans-serif';

let wallAssetsPromise = null;
function loadWallpaperAssets() {
  wallAssetsPromise ??= (async () => {
    try {
      const face = new FontFace("Legend M54", `url("${asset("assets/fonts/legend-m54.ttf")}")`);
      await face.load();
      document.fonts.add(face);
    } catch {
      // Sin la fuente se dibuja con Barlow Condensed (respaldo de JERSEY_FONT).
    }
    const [white, red] = await Promise.all([
      loadImage(asset("assets/logos/whitelogo@2x.png")),
      loadImage(asset("assets/logos/redlogo@2x.png")),
    ]);
    return { logos: { white, red } };
  })();
  return wallAssetsPromise;
}

// Sin acentos ni Ñ (a petición expresa): "HERNÁNDEZ" -> "HERNANDEZ",
// "MUÑOZ" -> "MUNOZ" — quita todas las marcas, tilde de la ñ incluida.
export function stripAccents(str) {
  return (str ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC");
}

// Trama del fondo: piel de caimán. Escamas orgánicas (celdas de Voronoi
// sobre una cuadrícula con jitter, un poco más anchas que altas y más
// grandes al centro que en las orillas), con surco oscuro entre escamas y
// un relieve suave (más claro arriba de cada una). Se calcula píxel por
// píxel a media resolución y se escala — es una capa translúcida encima del
// color de fondo, así que funciona igual en Clásico y Moderno. Semilla
// fija: sale igual cada vez. Se cachea (es lo más pesado del wallpaper).
let crocSkinCache = null;
function crocSkinLayer() {
  if (crocSkinCache) return crocSkinCache;
  const SW = Math.round(WALL_W / 2);
  const SH = Math.round(WALL_H / 2);
  let seed = 20260;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const CELL_W = 44;
  const CELL_H = 34;
  const cols = Math.ceil(SW / CELL_W) + 2;
  const rows = Math.ceil(SH / CELL_H) + 2;
  // Un punto por celda (con jitter); filas impares recorridas media celda.
  const pts = new Float32Array(cols * rows * 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 2;
      pts[i] = (c - 1 + (r % 2 ? 0.5 : 0) + 0.5 + (rand() - 0.5) * 0.55) * CELL_W;
      pts[i + 1] = (r - 1 + 0.5 + (rand() - 0.5) * 0.5) * CELL_H;
    }
  }

  const layer = document.createElement("canvas");
  layer.width = SW;
  layer.height = SH;
  const lctx = layer.getContext("2d");
  const img = lctx.createImageData(SW, SH);
  const data = img.data;
  const ASPECT = 1.3; // escamas más anchas que altas

  for (let y = 0; y < SH; y++) {
    const gr = Math.floor(y / CELL_H) + 1;
    for (let x = 0; x < SW; x++) {
      // Más grandes al centro: se "comprime" la x hacia las orillas.
      const t = (x - SW / 2) / (SW / 2);
      const xs = SW / 2 + (t * Math.abs(t) * 0.18 + t * 0.82) * (SW / 2);
      const gc = Math.floor(xs / CELL_W) + 1;
      let d1 = 1e9;
      let d2 = 1e9;
      let ny = 0;
      for (let r = gr - 1; r <= gr + 1; r++) {
        if (r < 0 || r >= rows) continue;
        for (let c = gc - 2; c <= gc + 2; c++) {
          if (c < 0 || c >= cols) continue;
          const i = (r * cols + c) * 2;
          const dx = (xs - pts[i]) / ASPECT;
          const dy = y - pts[i + 1];
          const d = dx * dx + dy * dy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            ny = dy;
          } else if (d < d2) {
            d2 = d;
          }
        }
      }
      const e = Math.sqrt(d2) - Math.sqrt(d1); // distancia al borde de la escama
      const o = (y * SW + x) * 4;
      if (e < 1.6) {
        // Surco entre escamas.
        data[o + 3] = 120 - e * 40;
      } else {
        // Relieve redondeado, con la luz desde arriba: gradual de claro
        // (parte de arriba de la escama, ny < 0) a oscuro (parte de abajo),
        // y más oscuro cerca del surco.
        const dome = Math.min(1, e / 12);
        const shade = Math.max(-1, Math.min(1, -ny / (CELL_H * 0.55)));
        if (shade > 0) {
          data[o] = data[o + 1] = data[o + 2] = 255;
          data[o + 3] = shade * dome * 20;
        } else {
          data[o] = data[o + 1] = data[o + 2] = 0;
          data[o + 3] = -shade * 34 + (1 - dome) * 22;
        }
      }
    }
  }
  lctx.putImageData(img, 0, 0);
  crocSkinCache = layer;
  return layer;
}

function drawCrocSkin(ctx, alpha = 0.55) {
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  // Más transparente (a petición expresa): la piel se insinúa, no se impone.
  ctx.globalAlpha = alpha;
  ctx.drawImage(crocSkinLayer(), 0, 0, WALL_W, WALL_H);
  ctx.globalAlpha = 1;
  // Más oscuro en las orillas, para que la piel no se vea plana.
  const vignette = ctx.createRadialGradient(WALL_W / 2, WALL_H * 0.47, 250, WALL_W / 2, WALL_H * 0.47, WALL_H * 0.75);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WALL_W, WALL_H);
  ctx.restore();
}


// Texto centrado que se achica hasta caber en `maxWidth`.
//
// `skin` (0-1, opcional): la misma piel de caimán del fondo, encimada SOLO
// dentro de las letras (se dibuja el texto en un lienzo aparte, se le pone
// la piel con "source-atop" y luego se pega con su sombra). `skinScale`
// achica las escamas — en el apellido, con trazos delgados, escamas del
// tamaño del fondo se verían como manchas sueltas.
// Encima la piel de caimán SOLO sobre lo que ya está dibujado en `lctx`
// (letras, logo) — "source-atop" respeta la transparencia de lo de abajo.
function applySkin(lctx, alpha, scale = 1) {
  if (!(alpha > 0)) return;
  lctx.save();
  lctx.globalCompositeOperation = "source-atop";
  lctx.globalAlpha = alpha;
  const tile = crocSkinLayer();
  const tw = WALL_W * scale;
  const th = WALL_H * scale;
  for (let y = 0; y < WALL_H; y += th) {
    for (let x = 0; x < WALL_W; x += tw) lctx.drawImage(tile, x, y, tw, th);
  }
  lctx.restore();
}

function wallText(ctx, str, baseline, { size, maxWidth, color, shadow, skin = 0, skinScale = 1 }) {
  const layer = document.createElement("canvas");
  layer.width = WALL_W;
  layer.height = WALL_H;
  const lctx = layer.getContext("2d");
  let s = size;
  lctx.font = `${s}px ${JERSEY_FONT}`;
  while (s > 40 && lctx.measureText(str).width > maxWidth) {
    s -= 6;
    lctx.font = `${s}px ${JERSEY_FONT}`;
  }
  lctx.fillStyle = color;
  lctx.textAlign = "center";
  lctx.textBaseline = "alphabetic";
  lctx.fillText(str, WALL_W / 2, baseline);

  applySkin(lctx, skin, skinScale);

  ctx.save();
  if (shadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 10;
    ctx.shadowOffsetY = 12;
  }
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

// `name`: apellido (o lo que se quiera). `number`: texto del número.
// `style`: { bg, fg, logo: "white" | "red", shadow, skin, textSkin } — ver STYLES en
// js/views/fanzone.js.
export async function wallpaperCanvas({ name, number, style }) {
  const { logos } = await loadWallpaperAssets();
  const canvas = document.createElement("canvas");
  canvas.width = WALL_W;
  canvas.height = WALL_H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, WALL_W, WALL_H);
  drawCrocSkin(ctx, style.skin ?? 0.55);

  const maxWidth = WALL_W * 0.62;
  const nameText = stripAccents(name).trim().toUpperCase();
  // Piel también dentro de las letras (a petición expresa), más marcada que
  // en el fondo para que se lea sobre el color sólido.
  const textSkin = style.textSkin ?? 0.9;
  if (nameText) wallText(ctx, nameText, 955, { size: 165, maxWidth, color: style.fg, shadow: style.shadow, skin: textSkin });
  const numText = String(number ?? "").trim();
  if (numText) wallText(ctx, numText, 1490, { size: 610, maxWidth: WALL_W * 0.72, color: style.fg, shadow: style.shadow, skin: textSkin });

  const logo = logos[style.logo];
  if (logo) {
    // El logo también con la piel (a petición expresa), igual que las letras.
    const w = 190;
    const h = (w * logo.naturalHeight) / logo.naturalWidth;
    const layer = document.createElement("canvas");
    layer.width = WALL_W;
    layer.height = WALL_H;
    const lctx = layer.getContext("2d");
    lctx.drawImage(logo, (WALL_W - w) / 2, 1565, w, h);
    applySkin(lctx, textSkin);
    ctx.drawImage(layer, 0, 0);
  }
  return canvas;
}

// ---- ventanita de vista previa + compartir / descargar ----

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

let modalEl = null;
function closeModal() {
  if (!modalEl) return;
  URL.revokeObjectURL(modalEl.dataset.url ?? "");
  modalEl.remove();
  modalEl = null;
  document.removeEventListener("keydown", onEsc);
}
function onEsc(e) {
  if (e.key === "Escape") closeModal();
}

// `make(format)`: función async que regresa el canvas ("post" o "story").
// `filename`: sin extensión.
export async function openFlyer(make, filename, shareText = "") {
  closeModal();
  modalEl = document.createElement("div");
  modalEl.className = "flyer-modal";
  modalEl.innerHTML = `
    <div class="flyer-sheet" role="dialog" aria-label="Compartir flyer">
      <button type="button" class="flyer-close" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
      <div class="flyer-formats">
        <button type="button" class="flyer-format active" data-format="post"><i class="fa-regular fa-square"></i> Post</button>
        <button type="button" class="flyer-format" data-format="story"><i class="fa-solid fa-mobile-screen"></i> Historia</button>
      </div>
      <div class="flyer-preview"><span class="spinner" aria-hidden="true"></span></div>
      <div class="flyer-actions" hidden>
        <button type="button" class="flyer-btn flyer-btn--share" hidden><i class="fa-solid fa-share-nodes"></i> Compartir</button>
        <a class="flyer-btn flyer-btn--download"><i class="fa-solid fa-download"></i> Descargar</a>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);
  document.addEventListener("keydown", onEsc);
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl || e.target.closest(".flyer-close")) closeModal();
  });

  const sheet = modalEl;
  const preview = sheet.querySelector(".flyer-preview");
  const actions = sheet.querySelector(".flyer-actions");
  const download = actions.querySelector(".flyer-btn--download");
  const shareBtn = actions.querySelector(".flyer-btn--share");
  let currentFile = null;
  let renderToken = 0;

  // Compartir con la imagen adjunta (menú nativo del celular: WhatsApp,
  // Instagram, Facebook...). Donde no se puede (casi todos los navegadores
  // de escritorio) el botón no aparece y queda "Descargar".
  shareBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    try {
      await navigator.share({ files: [currentFile], text: shareText });
    } catch {
      // Cancelado por el usuario — nada que hacer.
    }
  });

  async function render(format) {
    const token = ++renderToken;
    for (const btn of sheet.querySelectorAll(".flyer-format")) btn.classList.toggle("active", btn.dataset.format === format);
    preview.style.aspectRatio = format === "story" ? "9 / 16" : "4 / 5";
    preview.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
    actions.hidden = true;

    const canvas = await make(format);
    const blob = await canvasToBlob(canvas);
    if (modalEl !== sheet || token !== renderToken || !blob) return;
    URL.revokeObjectURL(sheet.dataset.url ?? "");
    const url = URL.createObjectURL(blob);
    sheet.dataset.url = url;
    preview.innerHTML = `<img src="${url}" alt="Flyer">`;

    const name = `${filename}${format === "story" ? "-historia" : ""}.png`;
    download.href = url;
    download.download = name;
    currentFile = new File([blob], name, { type: "image/png" });
    shareBtn.hidden = !navigator.canShare?.({ files: [currentFile] });
    actions.hidden = false;
  }

  sheet.querySelector(".flyer-formats").addEventListener("click", (e) => {
    const btn = e.target.closest(".flyer-format");
    if (btn && !btn.classList.contains("active")) render(btn.dataset.format);
  });

  render("post");
}

// Botón "Compartir" listo para meter en cualquier vista.
export function shareButton(onClick, label = "Compartir") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "share-flyer-btn";
  btn.innerHTML = `<i class="fa-solid fa-share-nodes"></i> ${label}`;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}
