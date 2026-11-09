// Flyers para compartir en redes (próximo juego, lineup, resultado de un
// juego, y las stats de un jugador: de la temporada o de un juego). Se dibujan en un <canvas> de 1080×1350 ("post", 4:5 de
// Instagram/Facebook, también se ve bien en WhatsApp) o 1080×1920
// ("historia", 9:16) y se abren en una ventanita con la vista previa +
// "Compartir" (menú nativo del celular, con la imagen adjunta) y
// "Descargar". Todo sale de data.js y de assets/ — no hay servidor ni nada
// externo de por medio.
//
// Los colores (fondo, texto, rojo) se eligen en la vista previa: Clásico
// (azul marino) o Moderno (negro) — ver FLYER_COLORS.
//
// Las rutas a assets/ se arman con import.meta.url (no relativas a la
// página) porque esto también lo usa lineup/index.html, que vive en una
// subcarpeta. Las fuentes (Barlow Condensed) ya las declara css/styles.css
// con @font-face; aquí solo se espera a que carguen antes de dibujar.
import { TEAM, SEASONS, CURRENT_SEASON, SPONSORS, PLAYERS, PLAYOFFS, GAMES, SCHEDULE } from "./data.js";
import { gameMvp, battingTotals, pitchingTotals, fieldingTotals } from "./stats.js";
import { ordinalTemporada } from "./ui.js";

const W = 1080;
// H = alto del CONTENIDO (el diseño del post). En historia el lienzo mide
// 1920: el logo crece y va arriba, y el resto del contenido se recorre
// debajo (ver drawHeader y STORY_SHIFT).
const H = 1350;
const FORMAT_HEIGHT = { post: 1350, story: 1920 };
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
const GOLD = "#f5b942";

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

// Colores del flyer: se ELIGEN en la vista previa (Clásico / Moderno, ver
// openFlyer), ya no dependen del tema activo del sitio (a petición
// expresa). Mismos valores que los temas Eclipse y Luna de css/styles.css.
export const FLYER_COLORS = [
  {
    id: "clasico",
    label: "Clásico",
    bg: "#0a0e18",
    text: "#f2f3f4",
    muted: "#a3a5a4",
    accent: "#bf0f35",
    accentDark: "#7d0924",
    accentText: "#e8375c",
  },
  {
    id: "moderno",
    label: "Moderno",
    bg: "#0d0d0d",
    text: "#f2f3f4",
    muted: "#8d96a0",
    accent: "#e2202f",
    accentDark: "#9c1526",
    accentText: "#ff5a6e",
  },
];

function flyerPalette(colorId) {
  const c = FLYER_COLORS.find((x) => x.id === colorId) ?? FLYER_COLORS[0];
  return {
    ...c,
    light: false,
    // Velo sutil para cajas/rayas (blanco: los dos fondos son oscuros).
    tint: (a) => `rgba(255, 255, 255, ${a})`,
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

// Números de los flyers en Teko, la misma letra de los números del sitio
// (a petición expresa; antes Legend M54, que se quedó solo en los
// wallpapers). La declara css/styles.css; si la página no la trae (o no
// cargó), se agrega aquí desde el mismo archivo.
const NUM_FONT = '"Teko", "Barlow Condensed", "Arial Narrow", sans-serif';
async function loadNumberFont() {
  try {
    await document.fonts.load('600 40px "Teko"');
    if (document.fonts.check('600 40px "Teko"')) return;
    const face = new FontFace("Teko", `url("${asset("assets/fonts/teko-600.woff2")}")`, { weight: "400 700" });
    await face.load();
    document.fonts.add(face);
  } catch {
    // Sin la fuente se dibuja con Barlow Condensed (respaldo de NUM_FONT).
  }
}

let assetsPromise = null;
function loadAssets() {
  assetsPromise ??= (async () => {
    await Promise.all([
      ...["600 40px", "700 40px", "italic 700 40px"].map((spec) => document.fonts?.load(`${spec} ${FONT}`).catch(() => null)),
      loadNumberFont(),
    ]);
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

// ---- fondo, encabezado y pie (iguales en todos los flyers) ----
//
// Diseño "con más estilo" (a petición expresa, primero en el resultado y
// luego en todos): piel de caimán de fondo (la de los wallpapers de
// Fanzone), encabezado con el logo a la izquierda y los datos a la derecha,
// un título grande en blanco, franjas rojas con escamas, números en la
// fuente de jersey y, abajo, el Instagram, el sitio y los patrocinadores.
// En historia (1920 de alto) el logo va grande al centro con los datos
// debajo, y el resto del diseño se recorre STORY_SHIFT hacia abajo.

const INSTAGRAM = "@CAIMANES.SB";
const SITE = "CAIMANES.TEAM";
const STORY_SHIFT = 500;

function drawBackground(ctx, CH) {
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, CH);
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(crocSkinLayer(), (W - WALL_W) / 2, (CH - WALL_H) / 2, WALL_W, WALL_H);
  ctx.restore();

  const glow = ctx.createRadialGradient(W / 2, CH * 0.45, 60, W / 2, CH * 0.45, 820);
  glow.addColorStop(0, rgba(P.accent, 0.3));
  glow.addColorStop(1, rgba(P.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, CH);

  const vignette = ctx.createRadialGradient(W / 2, CH / 2, 300, W / 2, CH / 2, CH * 0.8);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.65)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, CH);

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
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 30;
  ctx.drawImage(logo, cx - size / 2, y, size, size);
  ctx.restore();
}

// Instagram + sitio y la tira de patrocinadores, siempre pegados a la orilla
// de abajo del lienzo (también en historia: quita el desplazamiento).
function drawFooter(ctx, sponsors, CH) {
  ctx.setTransform(1, 0, 0, 1, 0, CH - H);
  text(ctx, `${INSTAGRAM} · ${SITE}`, W / 2, H - 200, { size: 34, color: P.muted, weight: 600 });
  if (sponsors.length === 0) return;

  // Mismo criterio que fitSponsorLogo() de la portada: peso visual
  // parejo (alto = base / proporción^0.6) en vez de altura pareja.
  const BASE = 84;
  const GAP = 48;
  let items = sponsors.map((s) => {
    const h = Math.min(BASE / s.ratio ** 0.6, BASE);
    return { c: s.dark, w: h * s.ratio, h };
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

// Lienzo del formato pedido con la paleta elegida y el fondo ya pintado.
// También espera la fuente de jersey y regresa logo + patrocinadores.
async function newFlyer(format, color) {
  const [{ logo, sponsors }] = await Promise.all([loadAssets(), loadWallpaperAssets()]);
  P = flyerPalette(color);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = FORMAT_HEIGHT[format] ?? H;
  const ctx = canvas.getContext("2d");
  drawBackground(ctx, canvas.height);
  return { canvas, ctx, story: format === "story", CH: canvas.height, logo, sponsors };
}

// Encabezado: `title` (blanco), `sub` (gris, opcional) y `league` (rojo, o
// dorado en playoffs). En historia, además, recorre el resto hacia abajo.
function drawHeader(ctx, logo, story, { title, sub, league, leagueColor = P.accentText }) {
  const lines = [
    { str: title, size: story ? 48 : 50, italic: true, color: P.text },
    sub && { str: sub, size: story ? 34 : 32, weight: 600, color: P.muted },
    league && { str: league, size: story ? 32 : 30, color: leagueColor },
  ].filter(Boolean);
  if (story) {
    drawLogo(ctx, logo, W / 2, 110, 380);
    lines.forEach((l, i) => text(ctx, l.str, W / 2, 565 + i * 48, { ...l }));
    ctx.translate(0, STORY_SHIFT);
  } else {
    drawLogo(ctx, logo, 130, 40, 170);
    lines.forEach((l, i) => text(ctx, l.str, W - 70, 98 + i * 46, { ...l, align: "right", maxWidth: 640 }));
  }
}

// Título grande en blanco con brillo rojo (VICTORIA, PRÓXIMO JUEGO…).
function bigTitle(ctx, str, y, size) {
  const s = fitFont(ctx, str, W - 120, size, { italic: true });
  ctx.font = font(s, { italic: true });
  ctx.textAlign = "center";
  ctx.save();
  ctx.shadowColor = rgba(P.accent, 0.55);
  ctx.shadowBlur = 45;
  ctx.fillStyle = "#fff";
  ctx.fillText(str, W / 2, y);
  ctx.restore();
}

// Franja roja de orilla a orilla, con las escamas encima.
function redBand(ctx, y, h) {
  const band = document.createElement("canvas");
  band.width = W;
  band.height = h;
  const bctx = band.getContext("2d");
  const grad = bctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, P.accentDark);
  grad.addColorStop(0.5, P.accent);
  grad.addColorStop(1, P.accentDark);
  bctx.fillStyle = grad;
  bctx.fillRect(0, 0, W, h);
  applySkin(bctx, 0.9);
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 40;
  ctx.drawImage(band, 0, y);
  ctx.restore();
}

// Línea vertical delgada que se desvanece en las puntas.
function fadeLine(ctx, x, y1, y2) {
  const g = ctx.createLinearGradient(0, y1, 0, y2);
  g.addColorStop(0, "rgba(255, 255, 255, 0)");
  g.addColorStop(0.5, "rgba(255, 255, 255, 0.55)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 2, y1, 4, y2 - y1);
}

// Teko se ve ~30% más chica que la fuente de jersey al mismo tamaño: los
// tamaños de abajo se pensaron para aquella, así que aquí se escalan.
function jerseyFont(size) {
  return `600 ${Math.round(size * 1.3)}px ${NUM_FONT}`;
}

// Texto en la fuente de jersey, achicado hasta caber en maxWidth.
function jerseyText(ctx, str, x, y, { size, maxWidth = W - 120, color = "#fff", align = "center", shadow = true }) {
  let s = size;
  ctx.font = jerseyFont(s);
  while (s > 30 && ctx.measureText(str).width > maxWidth) {
    s -= 4;
    ctx.font = jerseyFont(s);
  }
  ctx.save();
  if (shadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 10;
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(str, x, y);
  ctx.restore();
}

// ---- temporada, liga y número de juego ----

function seasonLeague(season = CURRENT_SEASON) {
  return (SEASONS[season - 1]?.league ?? TEAM.league).toUpperCase();
}

function seasonTitle(season = CURRENT_SEASON) {
  return `${ordinalTemporada(season).toUpperCase()} TEMPORADA`;
}

const byDate = (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "");

// Número del juego dentro de la temporada regular (por fecha); 0 si no está.
function regularGameNo(game) {
  const regular = GAMES.filter((g) => g.season === game.season && !g.playoff).sort(byDate);
  return regular.findIndex((g) => g.id === game.id) + 1;
}

// Número que le toca a un juego del calendario (SCHEDULE): los ya jugados
// de la temporada actual + su lugar entre los que faltan.
function scheduledGameNo(entry) {
  const played = GAMES.filter((g) => g.season === CURRENT_SEASON && !g.playoff).length;
  const idx = [...SCHEDULE].sort(byDate).findIndex((s) => s === entry || (s.date === entry.date && s.opponent === entry.opponent));
  return played + Math.max(0, idx) + 1;
}

// Encabezado de un juego ya jugado: "JUEGO 2 · 9NA TEMPORADA" + fecha + liga;
// en playoffs, "PLAYOFFS · 8VA TEMPORADA" + fecha + la ronda en dorado.
function gameHeader(game, playoffRound) {
  const no = regularGameNo(game);
  const season = game.season ? ` · ${seasonTitle(game.season)}` : "";
  return {
    title: playoffRound ? `PLAYOFFS${season}` : no ? `JUEGO ${no}${season}` : `RESULTADO${season}`,
    sub: `${formatDate(game.date)}${game.time ? ` · ${formatTime(game.time)}` : ""}`,
    league: playoffRound ? playoffRound.toUpperCase() : seasonLeague(game.season),
    leagueColor: playoffRound ? GOLD : P.accentText,
  };
}

// ---- próximo juego ----

// `game`: una entrada de SCHEDULE ({ date, time, opponent }).
export async function nextGameFlyer(game, format = "post", color) {
  const { canvas, ctx, story, CH, logo, sponsors } = await newFlyer(format, color);
  drawHeader(ctx, logo, story, {
    title: `JUEGO ${scheduledGameNo(game)} · ${seasonTitle()}`,
    league: seasonLeague(),
  });

  bigTitle(ctx, "PRÓXIMO JUEGO", 395, 180);

  // Franja con los dos equipos y "VS" al centro.
  redBand(ctx, 443, 270);
  text(ctx, "CAIMANES", W * 0.27, 612, { size: 100, italic: true, color: "#fff", maxWidth: 400 });
  text(ctx, (game.opponent ?? "RIVAL").toUpperCase(), W * 0.73, 612, { size: 100, italic: true, color: "#fff", maxWidth: 400 });
  fadeLine(ctx, W / 2, 462, 548);
  fadeLine(ctx, W / 2, 610, 696);
  text(ctx, "VS", W / 2, 598, { size: 52, italic: true, color: "#fff" });

  // Día y hora, grandes.
  text(ctx, formatDate(game.date), W / 2, 850, { size: 78, italic: true, maxWidth: W - 140 });
  if (game.time) jerseyText(ctx, formatTime(game.time), W / 2, 1040, { size: 140, color: P.accentText, shadow: false, maxWidth: W - 200 });

  drawFooter(ctx, sponsors, CH);
  return canvas;
}

// ---- lineup ----

// `order`: filas del orden al bat ({ name, position, slotDisplay }) — la
// última puede ser el pitcher (slot "P"). `game` (opcional): próximo juego
// de SCHEDULE, para el número de juego y el "vs Rival · fecha".
export async function lineupFlyer(order, game = null, format = "post", color) {
  const { canvas, ctx, story, CH, logo, sponsors } = await newFlyer(format, color);
  drawHeader(ctx, logo, story, {
    title: game ? `JUEGO ${scheduledGameNo(game)} · ${seasonTitle()}` : seasonTitle(),
    sub: game
      ? `VS ${(game.opponent ?? "").toUpperCase()} · ${formatDate(game.date)}${game.time ? ` · ${formatTime(game.time)}` : ""}`
      : null,
    league: seasonLeague(),
  });

  bigTitle(ctx, "LINEUP", 345, 170);

  const top = 385;
  const bottom = 1090;
  const rowH = Math.min(76, (bottom - top) / Math.max(order.length, 1));
  const left = 90;
  const right = W - 90;
  order.forEach((row, i) => {
    const y = top + i * rowH;
    const mid = y + rowH / 2;
    // Renglón: caja tenue con una raya roja a la izquierda.
    roundRect(ctx, left, y + 4, right - left, rowH - 8, 12);
    ctx.fillStyle = P.tint(i % 2 === 0 ? 0.07 : 0.04);
    ctx.fill();
    ctx.fillStyle = P.accent;
    ctx.fillRect(left, y + 4, 8, rowH - 8);

    // Turno (o "P" para el pitcher que no batea), en la fuente de jersey.
    const slot = row.slotDisplay ?? String(i + 1);
    jerseyText(ctx, slot, left + 62, mid + rowH * 0.24, { size: Math.round(rowH * 0.66), color: P.accentText, shadow: false, maxWidth: 80 });

    // Nombre.
    const name = (row.name ?? "").toUpperCase();
    text(ctx, name, left + 120, mid + rowH * 0.2, { size: Math.min(46, Math.round(rowH * 0.6)), italic: true, align: "left", maxWidth: right - left - 260 });

    // Posición: badge con contorno blanco.
    const pos = row.position ?? "";
    if (pos) {
      const bw = 86;
      const bh = Math.min(44, rowH - 22);
      const bx = right - 24 - bw;
      roundRect(ctx, bx, mid - bh / 2, bw, bh, 10);
      ctx.fillStyle = P.tint(0.1);
      ctx.fill();
      ctx.strokeStyle = P.text;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = P.text;
      ctx.font = font(30);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pos, bx + bw / 2, mid + 1);
      ctx.textBaseline = "alphabetic";
    }
  });

  drawFooter(ctx, sponsors, CH);
  return canvas;
}

// ---- resultado de un juego ----

// Foto (o iniciales) como en el perfil del sitio (a petición expresa; antes
// en paralelogramo): rectángulo con esquinas redondeadas, marco de color y
// un brillo del mismo color. Ocupa de `x` a `x + w + skew` (el ancho de
// antes, para no mover lo que va alrededor).
function drawSkewedPhoto(ctx, img, name, x, y, w, h, skew, border) {
  const bw = w + skew;
  const radius = Math.round(Math.min(bw, h) * 0.08);
  const path = () => roundRect(ctx, x, y, bw, h, radius);
  ctx.save();
  ctx.shadowColor = rgba(border, 0.45);
  ctx.shadowBlur = 36;
  path();
  ctx.fillStyle = border;
  ctx.fill();
  ctx.restore();
  ctx.save();
  path();
  ctx.clip();
  if (img) {
    const scale = Math.max(bw / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, x + (bw - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = P.tint(0.12);
    ctx.fillRect(x, y, bw, h);
    const initials = (name ?? "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("");
    ctx.fillStyle = P.text;
    ctx.font = font(h * 0.4);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, x + bw / 2, y + h / 2);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
  path();
  ctx.strokeStyle = border;
  ctx.lineWidth = 6;
  ctx.stroke();
}

// Nombre en dos renglones: todo menos el apellido en blanco, el apellido en
// rojo ("AXEL / MEDINA", "LUIS FERNANDO / LUGO").
function twoToneName(ctx, fullName, x, y1, y2, size, maxWidth) {
  const words = (fullName ?? "").toUpperCase().split(" ").filter(Boolean);
  const last = words.length > 1 ? words.pop() : "";
  text(ctx, words.join(" "), x, y1, { size, italic: true, align: "left", maxWidth });
  if (last) text(ctx, last, x, y2, { size, italic: true, align: "left", maxWidth, color: P.accentText });
}

// "4 DE 5 · 7 IMPULSADAS · 4 ROBADAS" — lo que hizo el MVP en ese juego.
function mvpLine(game, playerId) {
  const parts = [];
  const b = battingTotals([game]).find((r) => r.playerId === playerId);
  if (b) {
    parts.push(`${b.H} DE ${b.AB}`);
    if (b.HR) parts.push(`${b.HR} HR`);
    if (b.RBI) parts.push(`${b.RBI} ${b.RBI === 1 ? "IMPULSADA" : "IMPULSADAS"}`);
    if (b.SB) parts.push(`${b.SB} ${b.SB === 1 ? "ROBADA" : "ROBADAS"}`);
  }
  const p = pitchingTotals([game]).find((r) => r.playerId === playerId && r.outs > 0);
  if (p) parts.unshift(`${p.IP} ENTRADAS`);
  return parts.slice(0, 4).join(" · ");
}

// Un lado del marcador: nombre del equipo arriba y las carreras en grande
// (fuente de jersey). Ganador relleno; perdedor solo en contorno.
function scoreSide(ctx, name, score, cx, solid) {
  text(ctx, name, cx, 502, { size: 44, color: "#fff", maxWidth: 400 });
  if (solid) {
    jerseyText(ctx, String(score), cx, 692, { size: 210 });
    return;
  }
  ctx.font = jerseyFont(210);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.fillText(String(score), cx, 692);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 5;
  ctx.strokeText(String(score), cx, 692);
}

// `game`: un juego de GAMES/PLAYOFFS. `playoffRound` (opcional): nombre de
// la ronda si es de playoffs. VICTORIA/DERROTA en blanco (a petición
// expresa: sin verde y sin eco), el marcador sobre la franja roja con una
// línea delgada de separador, y el MVP con foto grande — en derrota no hay
// MVP y van los números del equipo.
export async function resultFlyer(game, playoffRound = null, format = "post", color) {
  const mvpId = gameMvp(game); // derrota = sin MVP (ver gameMvp en js/stats.js)
  const mvp = mvpId ? playerById(mvpId) : null;
  const mvpPhoto = mvpId ? await loadPlayerPhoto(mvpId) : null;
  const { canvas, ctx, story, CH, logo, sponsors } = await newFlyer(format, color);
  drawHeader(ctx, logo, story, gameHeader(game, playoffRound));

  const us = game.scoreUs;
  const them = game.scoreThem;
  bigTitle(ctx, us > them ? "VICTORIA" : us < them ? "DERROTA" : "EMPATE", 395, 210);

  redBand(ctx, 443, 270);
  fadeLine(ctx, W / 2, 468, 690);
  scoreSide(ctx, "CAIMANES", us, W * 0.27, us >= them);
  scoreSide(ctx, (game.opponent ?? "Rival").toUpperCase(), them, W * 0.73, them >= us);

  if (mvpId) {
    drawSkewedPhoto(ctx, mvpPhoto, mvp?.name, 110, 782, 260, 280, 32, GOLD);
    const tx = 440;
    const maxW = W - tx - 70;
    text(ctx, "★ MVP DEL JUEGO", tx, 834, { size: 40, color: GOLD, align: "left", maxWidth: maxW });
    twoToneName(ctx, mvp?.name ?? mvpId, tx, 920, 1002, 92, maxW);
    const line = mvpLine(game, mvpId);
    if (line) text(ctx, line, tx, 1054, { size: 32, color: P.muted, weight: 600, align: "left", maxWidth: maxW });
  } else {
    const rows = battingTotals([game]);
    const sum = (k) => rows.reduce((acc, r) => acc + (r[k] ?? 0), 0);
    statTiles(
      ctx,
      "EL EQUIPO",
      [
        { value: sum("H"), label: "HITS" },
        { value: sum("HR"), label: "HR" },
        { value: sum("RBI"), label: "IMPULSADAS" },
        { value: sum("SB"), label: "ROBADAS" },
      ],
      840
    );
  }

  drawFooter(ctx, sponsors, CH);
  return canvas;
}

// ---- Stats de un jugador (perfil, ver js/views/jugador.js) ----
//
// Mismo esqueleto en los dos: foto grande a la izquierda con número y
// nombre, una franja roja (resultado del juego o juegos jugados) y hasta dos
// bloques de "fichas" (valor grande + etiqueta) — bateo arriba y pitcheo o
// fildeo abajo. En la imagen POR JUEGO los errores no se muestran (a
// petición expresa); en la de la temporada sí.

const TILE_TOP = 690;
const TILE_H = 104;
const TILE_GAP = 18;

function playerHero(ctx, player, photo, bandText) {
  drawSkewedPhoto(ctx, photo, player.name, 90, 232, 240, 270, 30, P.accent);
  const tx = 410;
  const maxW = W - tx - 70;
  // El 0 en data.js es "todavía sin número", no se pinta.
  // Sin "#": la fuente de jersey no lo trae.
  if (player.number) jerseyText(ctx, String(player.number), tx, 318, { size: 92, color: P.accentText, align: "left", maxWidth: maxW });
  twoToneName(ctx, player.name, tx, player.number ? 405 : 360, player.number ? 487 : 450, 84, maxW);
  redBand(ctx, 540, 90);
  text(ctx, bandText, W / 2, 601, { size: 46, italic: true, color: "#fff", maxWidth: W - 120 });
}

// `tiles`: [{ value, label }]. `cols` por fila (4 por default); si la última
// fila queda incompleta, se centra. Regresa dónde terminó.
function statTiles(ctx, label, tiles, top, cols = Math.min(4, tiles.length)) {
  const left = 90;
  const width = W - left * 2;
  const tw = (width - TILE_GAP * (cols - 1)) / cols;
  const lastRowStart = Math.floor((tiles.length - 1) / cols) * cols;
  const lastRowShift = ((cols - (tiles.length - lastRowStart)) * (tw + TILE_GAP)) / 2;
  text(ctx, label, left, top - 18, { size: 34, color: P.accentText, align: "left" });
  tiles.forEach((t, i) => {
    const x = left + (i % cols) * (tw + TILE_GAP) + (i >= lastRowStart ? lastRowShift : 0);
    const y = top + Math.floor(i / cols) * (TILE_H + TILE_GAP);
    roundRect(ctx, x, y, tw, TILE_H, 18);
    ctx.fillStyle = P.tint(0.07);
    ctx.fill();
    ctx.strokeStyle = P.tint(0.12);
    ctx.lineWidth = 2;
    ctx.stroke();
    // Raya roja arriba de cada ficha.
    ctx.fillStyle = P.accent;
    ctx.fillRect(x + 18, y, tw - 36, 4);
    text(ctx, String(t.value), x + tw / 2, y + 64, { size: 64, italic: true, maxWidth: tw - 24 });
    text(ctx, t.label, x + tw / 2, y + TILE_H - 14, { size: 24, color: P.muted, weight: 600, maxWidth: tw - 20 });
  });
  const rows = Math.ceil(tiles.length / cols);
  return top + rows * (TILE_H + TILE_GAP) - TILE_GAP;
}

// Hasta dos bloques, uno debajo del otro.
function statSections(ctx, sections) {
  let top = TILE_TOP;
  for (const s of sections.slice(0, 2)) {
    top = statTiles(ctx, s.label, s.tiles, top, s.cols) + 70;
  }
}

const DECISION_LABEL = { W: "VICTORIA", L: "DERROTA", SV: "SALVAMENTO" };

// `stats`: { player, seasonLabel ("9na Temporada"), gamesPlayed, batting,
// pitching, fielding } — las filas de battingTotals/pitchingTotals/
// fieldingTotals (js/stats.js) del jugador, o null si no tiene.
export async function playerStatsFlyer(stats, format = "post", color) {
  const { player, batting, pitching, fielding } = stats;
  const photo = await loadPlayerPhoto(player.id);
  const { canvas, ctx, story, CH, logo, sponsors } = await newFlyer(format, color);
  drawHeader(ctx, logo, story, { title: "ESTADÍSTICAS", sub: stats.seasonLabel.toUpperCase(), league: seasonLeague() });

  const g = stats.gamesPlayed;
  playerHero(ctx, player, photo, `${g} ${g === 1 ? "JUEGO JUGADO" : "JUEGOS JUGADOS"}`);

  const sections = [];
  if (batting) {
    sections.push({
      label: "BATEO",
      tiles: [
        { value: batting.AVG, label: "AVG" },
        { value: batting.OPS, label: "OPS" },
        { value: batting.H, label: "HITS" },
        { value: batting.HR, label: "HR" },
        { value: batting.RBI, label: "IMPULSADAS" },
        { value: batting.R, label: "CARRERAS" },
        { value: batting.BB, label: "BASES X BOLA" },
        { value: batting.SB, label: "ROBADAS" },
      ],
    });
  }
  if (pitching) {
    sections.push({
      label: "PITCHEO",
      tiles: [
        { value: pitching.IP, label: "ENTRADAS" },
        { value: pitching.SO, label: "PONCHES" },
        { value: `${pitching.W}-${pitching.L}`, label: "RÉCORD" },
        { value: pitching.WHIP, label: "WHIP" },
      ],
    });
  }
  if (fielding) {
    sections.push({
      label: "FILDEO",
      tiles: [
        { value: fielding.FPCT, label: "FPCT" },
        { value: fielding.PO, label: "OUTS (PO)" },
        { value: fielding.A, label: "ASISTENCIAS" },
        { value: fielding.E, label: "ERRORES" },
      ],
    });
  }
  statSections(ctx, sections);

  drawFooter(ctx, sponsors, CH);
  return canvas;
}

// `game`: un juego de GAMES o de PLAYOFFS (con `playoff`), `player`: el
// jugador. Su línea sale de los mismos totales de js/stats.js aplicados a
// ese único juego (así dos salidas del mismo pitcher se suman bien).
export async function playerGameFlyer(player, game, format = "post", color) {
  const photo = await loadPlayerPhoto(player.id);
  const { canvas, ctx, story, CH, logo, sponsors } = await newFlyer(format, color);
  const round = game.playoff
    ? PLAYOFFS.find((e) => e.season === game.season)?.rounds.find((r) => r.games?.some((g) => g.id === game.id))
    : null;
  drawHeader(ctx, logo, story, gameHeader(game, round?.name ?? null));

  const us = game.scoreUs;
  const them = game.scoreThem;
  const result = us > them ? "VICTORIA" : us < them ? "DERROTA" : "EMPATE";
  playerHero(ctx, player, photo, `${result} ${us}-${them} VS ${(game.opponent ?? "Rival").toUpperCase()}`);

  const batting = battingTotals([game]).find((r) => r.playerId === player.id);
  const pitching = pitchingTotals([game]).find((r) => r.playerId === player.id && r.outs + r.H + r.R + r.BB + r.SO > 0);
  const fielding = fieldingTotals([game]).find((r) => r.playerId === player.id);
  const sections = [];
  if (batting) {
    sections.push({
      label: "BATEO",
      // 9 fichas: de 5 en 5 para que quepan en dos filas (con pitcheo abajo
      // no hay espacio para una tercera).
      cols: 5,
      tiles: [
        { value: batting.AVG, label: "AVG" },
        { value: `${batting.H}-${batting.AB}`, label: "H-AB" },
        { value: batting["2B"], label: "DOBLES" },
        { value: batting["3B"], label: "TRIPLES" },
        { value: batting.HR, label: "HR" },
        { value: batting.RBI, label: "IMPULSADAS" },
        { value: batting.R, label: "CARRERAS" },
        { value: batting.BB, label: "BASES X BOLA" },
        { value: batting.SB, label: "ROBADAS" },
      ],
    });
  }
  if (pitching) {
    const lines = (game.pitching ?? []).filter((l) => l.playerId === player.id);
    const decision = lines.map((l) => DECISION_LABEL[l.decision]).find(Boolean);
    sections.push({
      label: `PITCHEO${decision ? ` · ${decision}` : ""}`,
      tiles: [
        { value: pitching.IP, label: "ENTRADAS" },
        { value: pitching.H, label: "HITS" },
        { value: pitching.R, label: "CARRERAS" },
        { value: pitching.SO, label: "PONCHES" },
      ],
    });
  }
  if (fielding) {
    sections.push({
      label: "FILDEO",
      tiles: [
        { value: fielding.PO, label: "OUTS (PO)" },
        { value: fielding.A, label: "ASISTENCIAS" },
      ],
    });
  }
  statSections(ctx, sections);

  drawFooter(ctx, sponsors, CH);
  return canvas;
}

// ---- Líderes de la temporada (Resumen, ver js/views/resumen.js) ----

// Foto del jugador (assets/players/, .jpg o .png) — null si no tiene.
async function loadPlayerPhoto(playerId) {
  for (const ext of ["jpg", "png"]) {
    const img = await loadImage(asset(`assets/players/${playerId}.${ext}`));
    if (img) return img;
  }
  return null;
}

// `data`: { seasonLabel ("9na Temporada"), leaders: [{ label, value,
// playerId, name }] } — el #1 de cada categoría, máximo 6 (dos columnas de
// tres).
export async function leadersFlyer(data, format = "post", color) {
  const leaders = data.leaders.slice(0, 6);
  const photos = await Promise.all(leaders.map((l) => loadPlayerPhoto(l.playerId)));
  const { canvas, ctx, story, CH, logo, sponsors } = await newFlyer(format, color);
  drawHeader(ctx, logo, story, { title: data.seasonLabel.toUpperCase(), league: seasonLeague() });

  bigTitle(ctx, "LÍDERES", 345, 170);

  const left = 90;
  const gap = 22;
  const cols = 2;
  const tw = (W - left * 2 - gap) / cols;
  const th = 214;
  const top = 395;
  leaders.forEach((l, i) => {
    const x = left + (i % cols) * (tw + gap);
    const y = top + Math.floor(i / cols) * (th + gap);
    roundRect(ctx, x, y, tw, th, 22);
    ctx.fillStyle = P.tint(0.07);
    ctx.fill();
    ctx.strokeStyle = P.tint(0.12);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = P.accent;
    ctx.fillRect(x + 22, y, tw - 44, 4);

    const pw = 140;
    const ph = 168;
    drawSkewedPhoto(ctx, photos[i], l.name, x + 22, y + (th - ph) / 2, pw, ph, 18, P.accent);
    const tx = x + 22 + pw + 18 + 28;
    const maxW = x + tw - 20 - tx;
    text(ctx, l.label, tx, y + 58, { size: 30, color: P.accentText, align: "left", maxWidth: maxW });
    text(ctx, String(l.value), tx, y + 140, { size: 80, italic: true, align: "left", maxWidth: maxW });
    text(ctx, (l.name ?? "").toUpperCase(), tx, y + 184, { size: 30, weight: 600, color: P.muted, align: "left", maxWidth: maxW });
  });

  drawFooter(ctx, sponsors, CH);
  return canvas;
}

// ---- Wallpaper de jersey (pestaña Fanzone, ver js/views/fanzone.js) ----
//
// Diseño de Ricardo: fondo con trama de piel de caimán, apellido (sin acentos) y
// número centrados en la fuente
// de jersey Legend M54 (assets/fonts/legend-m54.ttf) y, debajo, la cabeza
// del caimán (assets/logos/: caimanes-white.png en Clásico, caimanes-red.png en Moderno). El
// estilo Clásico lleva una sombra suave en las letras; el Moderno, plano.
// 1170×2532 = proporción de los celulares actuales (19.5:9).
const WALL_W = 1170;
const WALL_H = 2532;
// Fondo de escritorio (a petición expresa): 2560×1440 (16:9, pantallas 2K;
// en 1080p se ve igual de nítido, solo más chico). Mismo diseño que el de
// celular, acomodado al centro de una pantalla ancha.
const DESK_W = 2560;
const DESK_H = 1440;
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
      loadImage(asset("assets/logos/caimanes-white.png")),
      loadImage(asset("assets/logos/caimanes-red.png")),
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
const crocSkinCache = new Map();
function crocSkinLayer(fullW = WALL_W, fullH = WALL_H) {
  const key = `${fullW}x${fullH}`;
  if (crocSkinCache.has(key)) return crocSkinCache.get(key);
  const SW = Math.round(fullW / 2);
  const SH = Math.round(fullH / 2);
  let seed = 20260;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Tamaño de cada escama (a media resolución). Antes 44×34; más grandes
  // a petición expresa.
  const CELL_W = 96;
  const CELL_H = 74;
  const SCALE_UP = CELL_W / 44; // surco y relieve crecen con la escama
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
      const groove = 1.6 * SCALE_UP;
      if (e < groove) {
        // Surco entre escamas.
        data[o + 3] = 120 - (e / groove) * 64;
      } else {
        // Relieve redondeado, con la luz desde arriba: gradual de claro
        // (parte de arriba de la escama, ny < 0) a oscuro (parte de abajo),
        // y más oscuro cerca del surco.
        const dome = Math.min(1, e / (12 * SCALE_UP));
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
  crocSkinCache.set(key, layer);
  return layer;
}

function drawCrocSkin(ctx, alpha = 0.55) {
  const { width: cw, height: ch } = ctx.canvas;
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  // Más transparente (a petición expresa): la piel se insinúa, no se impone.
  ctx.globalAlpha = alpha;
  ctx.drawImage(crocSkinLayer(cw, ch), 0, 0, cw, ch);
  ctx.globalAlpha = 1;
  // Más oscuro en las orillas, para que la piel no se vea plana.
  const reach = Math.max(cw, ch);
  const vignette = ctx.createRadialGradient(cw / 2, ch * 0.47, 250, cw / 2, ch * 0.47, reach * 0.75);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, cw, ch);
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
  const { width: cw, height: ch } = lctx.canvas;
  // Los flyers (1080 de ancho) usan la piel de celular; los wallpapers, la
  // de su propio tamaño.
  const isDesk = cw === DESK_W && ch === DESK_H;
  const tile = isDesk ? crocSkinLayer(DESK_W, DESK_H) : crocSkinLayer();
  const tw = (isDesk ? DESK_W : WALL_W) * scale;
  const th = (isDesk ? DESK_H : WALL_H) * scale;
  for (let y = 0; y < ch; y += th) {
    for (let x = 0; x < cw; x += tw) lctx.drawImage(tile, x, y, tw, th);
  }
  lctx.restore();
}

function wallText(ctx, str, baseline, { size, maxWidth, color, shadow, skin = 0, skinScale = 1 }) {
  const layer = document.createElement("canvas");
  layer.width = ctx.canvas.width;
  layer.height = ctx.canvas.height;
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
  lctx.fillText(str, layer.width / 2, baseline);

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

// Acomodo de cada formato: dónde va la línea base del nombre y del número,
// su tamaño y ancho máximo, y dónde y de qué ancho va el logo.
const WALL_LAYOUTS = {
  phone: { w: WALL_W, h: WALL_H, name: [955, 165, 0.62], number: [1490, 610, 0.72], logo: [1565, 340] },
  desktop: { w: DESK_W, h: DESK_H, name: [455, 150, 0.36], number: [960, 540, 0.36], logo: [1025, 290] },
};

// `name`: apellido (o lo que se quiera). `number`: texto del número.
// `style`: { bg, fg, logo: "white" | "red", shadow, skin, textSkin } — ver STYLES en
// js/views/fanzone.js. `format`: "phone" (celular) o "desktop" (escritorio).
export async function wallpaperCanvas({ name, number, style, format = "phone" }) {
  const { logos } = await loadWallpaperAssets();
  const L = WALL_LAYOUTS[format] ?? WALL_LAYOUTS.phone;
  const canvas = document.createElement("canvas");
  canvas.width = L.w;
  canvas.height = L.h;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, L.w, L.h);
  drawCrocSkin(ctx, style.skin ?? 0.55);

  const nameText = stripAccents(name).trim().toUpperCase();
  // Piel también dentro de las letras (a petición expresa), más marcada que
  // en el fondo para que se lea sobre el color sólido.
  const textSkin = style.textSkin ?? 0.9;
  const [nameY, nameSize, nameMax] = L.name;
  const [numY, numSize, numMax] = L.number;
  if (nameText) wallText(ctx, nameText, nameY, { size: nameSize, maxWidth: L.w * nameMax, color: style.fg, shadow: style.shadow, skin: textSkin });
  const numText = String(number ?? "").trim();
  if (numText) wallText(ctx, numText, numY, { size: numSize, maxWidth: L.w * numMax, color: style.numberFg ?? style.fg, shadow: style.shadow, skin: textSkin });

  const logo = logos[style.logo];
  if (logo) {
    // El logo también con la piel (a petición expresa), igual que las letras.
    const [logoY, w] = L.logo;
    const h = (w * logo.naturalHeight) / logo.naturalWidth;
    const layer = document.createElement("canvas");
    layer.width = L.w;
    layer.height = L.h;
    const lctx = layer.getContext("2d");
    lctx.drawImage(logo, (L.w - w) / 2, logoY, w, h);
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

// `make(format, color)`: función async que regresa el canvas — `format`
// "post" o "story", `color` uno de FLYER_COLORS. `filename`: sin extensión.
const FLYER_COLOR_KEY = "caimanes-flyer-color";
export async function openFlyer(make, filename, shareText = "") {
  closeModal();
  modalEl = document.createElement("div");
  modalEl.className = "flyer-modal";
  modalEl.innerHTML = `
    <div class="flyer-sheet" role="dialog" aria-label="Compartir flyer">
      <button type="button" class="flyer-close" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
      <div class="flyer-options">
        <div class="flyer-formats" data-group="format">
          <button type="button" class="flyer-format active" data-format="post"><i class="fa-regular fa-square"></i> Post</button>
          <button type="button" class="flyer-format" data-format="story"><i class="fa-solid fa-mobile-screen"></i> Historia</button>
        </div>
        <div class="flyer-formats" data-group="color">
          ${FLYER_COLORS.map(
            (c) => `<button type="button" class="flyer-format" data-color="${c.id}"><span class="flyer-color-dot" style="background:${c.bg};border-color:${c.accent}"></span> ${c.label}</button>`
          ).join("")}
        </div>
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
  let format = "post";
  let color = FLYER_COLORS[0].id;
  try {
    const saved = localStorage.getItem(FLYER_COLOR_KEY);
    if (FLYER_COLORS.some((c) => c.id === saved)) color = saved;
  } catch {
    // Sin almacenamiento: Clásico.
  }

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

  async function render() {
    const token = ++renderToken;
    for (const btn of sheet.querySelectorAll("[data-format]")) btn.classList.toggle("active", btn.dataset.format === format);
    for (const btn of sheet.querySelectorAll("[data-color]")) btn.classList.toggle("active", btn.dataset.color === color);
    preview.style.aspectRatio = format === "story" ? "9 / 16" : "4 / 5";
    preview.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
    actions.hidden = true;

    const canvas = await make(format, color);
    const blob = await canvasToBlob(canvas);
    if (modalEl !== sheet || token !== renderToken || !blob) return;
    URL.revokeObjectURL(sheet.dataset.url ?? "");
    const url = URL.createObjectURL(blob);
    sheet.dataset.url = url;
    preview.innerHTML = `<img src="${url}" alt="Flyer">`;

    const name = `${filename}${format === "story" ? "-historia" : ""}-${color}.png`;
    download.href = url;
    download.download = name;
    currentFile = new File([blob], name, { type: "image/png" });
    shareBtn.hidden = !navigator.canShare?.({ files: [currentFile] });
    actions.hidden = false;
  }

  sheet.querySelector(".flyer-options").addEventListener("click", (e) => {
    const btn = e.target.closest(".flyer-format");
    if (!btn || btn.classList.contains("active")) return;
    if (btn.dataset.format) format = btn.dataset.format;
    if (btn.dataset.color) {
      color = btn.dataset.color;
      try {
        localStorage.setItem(FLYER_COLOR_KEY, color);
      } catch {
        // Solo es una comodidad.
      }
    }
    render();
  });

  render();
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
