// Flyers para compartir en redes (próximo juego, lineup, resultado de un
// juego). Se dibujan en un <canvas> de 1080×1350 ("post", 4:5 de
// Instagram/Facebook, también se ve bien en WhatsApp) o 1080×1920
// ("historia", 9:16) y se abren en una
// ventanita con la vista previa + "Compartir" (menú nativo del celular, con
// la imagen adjunta) y "Descargar". Todo sale de data.js y de assets/ — no
// hay servidor ni nada externo de por medio.
//
// Las rutas a assets/ se arman con import.meta.url (no relativas a la
// página) porque esto también lo usa lineup/index.html, que vive en una
// subcarpeta. Las fuentes (Barlow Condensed) ya las declara css/styles.css
// con @font-face; aquí solo se espera a que carguen antes de dibujar.
import { TEAM, SEASONS, CURRENT_SEASON, SPONSORS, PLAYERS } from "./data.js";
import { ordinalTemporada } from "./ui.js";

const W = 1080;
// H = alto del CONTENIDO (el diseño del post). En historia el lienzo mide
// 1920 y ese mismo contenido va centrado — los ~285 px que sobran arriba y
// abajo quedan de fondo, justo donde Instagram/WhatsApp ponen sus botones.
const H = 1350;
const FORMAT_HEIGHT = { post: 1350, story: 1920 };
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
const RED = "#e2202f";
const RED_DARK = "#9c1526";
const WIN = "#3fb56f";
const GOLD = "#f5b942";
const MUTED = "#a3a8b0";

const POS_COLOR = {
  P: "#4a9eff",
  C: "#a855f7",
  "1B": "#e2c93f",
  "2B": "#e2c93f",
  "3B": "#e2c93f",
  SS: "#e2c93f",
  LF: "#3fb56f",
  CF: "#3fb56f",
  RF: "#3fb56f",
  JD: "#ff8c33",
  JC: "#ff6fb5",
};

const asset = (path) => new URL(`../${path}`, import.meta.url).href;

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
    return { logo, sponsors: sponsors.map(whiteTrimmed).filter(Boolean) };
  })();
  return assetsPromise;
}

// Logo de patrocinador (negro sobre transparente, ver SPONSORS en data.js)
// → recortado a su contenido y pintado en blanco, para el fondo oscuro.
function whiteTrimmed(img) {
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
  const out = document.createElement("canvas");
  out.width = box.w;
  out.height = box.h;
  const o = out.getContext("2d");
  o.drawImage(c, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  o.globalCompositeOperation = "source-in";
  o.fillStyle = "#ffffff";
  o.fillRect(0, 0, box.w, box.h);
  return out;
}

// ---- helpers de dibujo ----

function font(size, { weight = 700, italic = false } = {}) {
  return `${italic ? "italic " : ""}${weight} ${size}px ${FONT}`;
}

// Achica el tamaño hasta que el texto quepa en maxWidth.
function fitFont(ctx, text, maxWidth, size, opts) {
  let s = size;
  ctx.font = font(s, opts);
  while (s > 20 && ctx.measureText(text).width > maxWidth) {
    s -= 4;
    ctx.font = font(s, opts);
  }
  return s;
}

function text(ctx, str, x, y, { size, color = "#fff", align = "center", maxWidth = W - 120, ...opts }) {
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
function pill(ctx, label, cx, y, { bg = RED, color = "#fff", size = 40, padX = 34, height = 68 } = {}) {
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

function seasonLine() {
  const meta = SEASONS[CURRENT_SEASON - 1];
  const league = meta?.league ?? TEAM.league;
  return `${league} · ${ordinalTemporada(TEAM.seasonsInLeague)} Temporada`.toUpperCase();
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

// Fondo de marca: negro, brillo rojo arriba, rayas diagonales sutiles y
// barra roja abajo — mismo lenguaje que el sitio en tema Luna.
function drawBackground(ctx, CH) {
  ctx.fillStyle = "#0b0b0c";
  ctx.fillRect(0, 0, W, CH);

  const glow = ctx.createRadialGradient(W / 2, 120, 40, W / 2, 120, 900);
  glow.addColorStop(0, "rgba(226, 32, 47, 0.38)");
  glow.addColorStop(1, "rgba(226, 32, 47, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, CH);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  ctx.lineWidth = 2;
  for (let x = -CH; x < W; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, CH);
    ctx.lineTo(x + CH, 0);
    ctx.stroke();
  }
  ctx.restore();

  const fade = ctx.createLinearGradient(0, CH - 420, 0, CH);
  fade.addColorStop(0, "rgba(0, 0, 0, 0)");
  fade.addColorStop(1, "rgba(0, 0, 0, 0.75)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, CH - 420, W, 420);

  const bar = ctx.createLinearGradient(0, 0, W, 0);
  bar.addColorStop(0, RED_DARK);
  bar.addColorStop(0.5, RED);
  bar.addColorStop(1, RED_DARK);
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

// Liga/temporada + tira de patrocinadores, pegados abajo.
function drawFooter(ctx, sponsors) {
  text(ctx, seasonLine(), W / 2, H - 200, { size: 34, color: MUTED, weight: 600 });
  if (sponsors.length === 0) return;

  // Mismo criterio que fitSponsorLogo() del pie del sitio: peso visual
  // parejo (alto = base / proporción^0.6) en vez de altura pareja.
  const BASE = 84;
  const GAP = 48;
  let items = sponsors.map((c) => {
    const ratio = c.width / c.height;
    const h = Math.min(BASE / ratio ** 0.6, BASE);
    return { c, w: h * ratio, h };
  });
  const total = items.reduce((s, i) => s + i.w, 0) + GAP * (items.length - 1);
  const scale = Math.min(1, (W - 140) / total);
  items = items.map((i) => ({ ...i, w: i.w * scale, h: i.h * scale }));
  let x = (W - (total * scale)) / 2;
  const midY = H - 105;
  ctx.globalAlpha = 0.85;
  for (const i of items) {
    ctx.drawImage(i.c, x, midY - i.h / 2, i.w, i.h);
    x += i.w + GAP * scale;
  }
  ctx.globalAlpha = 1;
}

// Lienzo del formato pedido, con el fondo ya pintado de orilla a orilla y
// el contexto desplazado para que el contenido (diseñado a 1350 de alto)
// quede centrado.
function newFlyer(format) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = FORMAT_HEIGHT[format] ?? H;
  const ctx = canvas.getContext("2d");
  drawBackground(ctx, canvas.height);
  ctx.translate(0, (canvas.height - H) / 2);
  return { canvas, ctx };
}

// ---- los tres flyers ----

// `game`: una entrada de SCHEDULE ({ date, time, opponent }).
export async function nextGameFlyer(game, format = "post") {
  const { logo, sponsors } = await loadAssets();
  const { canvas, ctx } = newFlyer(format);
  drawLogo(ctx, logo, W / 2, 60, 250);

  pill(ctx, "PRÓXIMO JUEGO", W / 2, 345, { size: 42 });

  text(ctx, "CAIMANES", W / 2, 560, { size: 160, italic: true });
  text(ctx, "VS", W / 2, 650, { size: 64, color: RED });
  text(ctx, (game.opponent ?? "Rival").toUpperCase(), W / 2, 800, { size: 160, italic: true });

  roundRect(ctx, 150, 860, W - 300, 190, 28);
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, formatDate(game.date), W / 2, 940, { size: 60, maxWidth: W - 360 });
  if (game.time) text(ctx, formatTime(game.time), W / 2, 1020, { size: 72, color: RED, italic: true });

  drawFooter(ctx, sponsors);
  return canvas;
}

// `order`: filas del orden al bat ({ name, position }) — la última puede
// ser el pitcher (slot "P"). `game` (opcional): próximo juego de SCHEDULE,
// para el "vs Rival · fecha".
export async function lineupFlyer(order, game = null, format = "post") {
  const { logo, sponsors } = await loadAssets();
  const { canvas, ctx } = newFlyer(format);
  drawLogo(ctx, logo, W / 2, 40, 170);

  text(ctx, "LINEUP", W / 2, 320, { size: 120, italic: true });
  if (game) {
    const sub = `VS ${(game.opponent ?? "").toUpperCase()} · ${formatDate(game.date)}${game.time ? ` · ${formatTime(game.time)}` : ""}`;
    text(ctx, sub, W / 2, 375, { size: 38, color: RED, weight: 600 });
  }

  const top = 415;
  const bottom = H - 265;
  const rowH = Math.min(66, (bottom - top) / Math.max(order.length, 1));
  const left = 150;
  const right = W - 150;
  order.forEach((row, i) => {
    const y = top + i * rowH;
    const mid = y + rowH / 2;
    if (i % 2 === 0) {
      roundRect(ctx, left - 30, y + 3, right - left + 60, rowH - 6, 14);
      ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
      ctx.fill();
    }
    // Turno (o "P" para el pitcher que no batea).
    const slot = row.slotDisplay ?? String(i + 1);
    ctx.beginPath();
    ctx.arc(left + 22, mid, 24, 0, Math.PI * 2);
    ctx.fillStyle = slot === "P" ? "rgba(255, 255, 255, 0.12)" : RED;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = font(30);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(slot, left + 22, mid + 1);

    // Nombre.
    ctx.textAlign = "left";
    fitFont(ctx, row.name.toUpperCase(), right - left - 200, 42);
    ctx.fillStyle = "#fff";
    ctx.fillText(row.name.toUpperCase(), left + 72, mid + 2);

    // Posición (badge con su color, igual que en el sitio).
    const pos = row.position ?? "";
    if (pos) {
      const color = POS_COLOR[pos] ?? MUTED;
      const bw = 86;
      const bh = 44;
      roundRect(ctx, right - bw, mid - bh / 2, bw, bh, 10);
      ctx.fillStyle = `${color}26`;
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

// Figuras del juego: los 3 mejores bateadores de ESE juego (hits, carreras,
// impulsadas y extra-bases pesan) — texto tipo "3-4 · 2 RBI · 1 HR".
function topPerformers(game, n = 3) {
  const score = (l) => (l.H ?? 0) * 2 + (l.RBI ?? 0) * 1.5 + (l.R ?? 0) + (l.HR ?? 0) * 3 + (l.HRC ?? 0) * 3 + (l["2B"] ?? 0) + (l["3B"] ?? 0) * 2;
  return [...(game.batting ?? [])]
    .filter((l) => (l.H ?? 0) + (l.RBI ?? 0) + (l.R ?? 0) > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, n)
    .map((l) => {
      const bits = [`${l.H ?? 0}-${l.AB ?? 0}`];
      const hr = (l.HR ?? 0) + (l.HRC ?? 0);
      if (hr) bits.push(`${hr} HR`);
      if (l["3B"]) bits.push(`${l["3B"]} 3B`);
      if (l["2B"]) bits.push(`${l["2B"]} 2B`);
      if (l.RBI) bits.push(`${l.RBI} RBI`);
      if (l.R) bits.push(`${l.R} C`);
      return { name: playerById(l.playerId)?.name ?? l.playerId, line: bits.join(" · ") };
    });
}

// `game`: un juego de GAMES/PLAYOFFS. `playoffRound` (opcional): nombre de
// la ronda si es de playoffs.
export async function resultFlyer(game, playoffRound = null, format = "post") {
  const { logo, sponsors } = await loadAssets();
  const { canvas, ctx } = newFlyer(format);
  drawLogo(ctx, logo, W / 2, 40, 160);

  const us = game.scoreUs;
  const them = game.scoreThem;
  const result = us > them ? "VICTORIA" : us < them ? "DERROTA" : "EMPATE";
  const resultBg = us > them ? WIN : us < them ? RED : "#5b6470";
  pill(ctx, result, W / 2, 222, { bg: resultBg, size: 46, height: 74 });
  if (playoffRound) text(ctx, `PLAYOFFS · ${playoffRound.toUpperCase()}`, W / 2, 348, { size: 36, color: GOLD });

  // Marcador: Caimanes a la izquierda, rival a la derecha.
  const colL = W * 0.27;
  const colR = W * 0.73;
  text(ctx, "CAIMANES", colL, 425, { size: 52, maxWidth: 400 });
  text(ctx, (game.opponent ?? "Rival").toUpperCase(), colR, 425, { size: 52, maxWidth: 400 });
  text(ctx, String(us), colL, 640, { size: 240, italic: true, color: us >= them ? "#fff" : "#d6d8dc" });
  text(ctx, String(them), colR, 640, { size: 240, italic: true, color: them > us ? "#fff" : "#8e939b" });
  text(ctx, "-", W / 2, 600, { size: 140, color: RED });
  text(ctx, `${formatDate(game.date)}${game.time ? ` · ${formatTime(game.time)}` : ""}`, W / 2, 705, { size: 40, color: MUTED, weight: 600 });

  let y = 745;
  if (game.mvp) {
    const mvp = playerById(game.mvp);
    roundRect(ctx, 200, y, W - 400, 90, 45);
    ctx.fillStyle = "rgba(245, 185, 66, 0.14)";
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    text(ctx, `★ MVP: ${(mvp?.name ?? game.mvp).toUpperCase()}`, W / 2, y + 60, { size: 46, color: GOLD, maxWidth: W - 460 });
    y += 125;
  } else {
    y += 20;
  }

  const performers = topPerformers(game);
  if (performers.length) {
    text(ctx, "FIGURAS DEL JUEGO", W / 2, y + 10, { size: 34, color: RED });
    performers.forEach((p, i) => {
      const ry = y + 62 + i * 58;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      fitFont(ctx, p.name.toUpperCase(), 440, 40);
      ctx.fillStyle = "#fff";
      ctx.fillText(p.name.toUpperCase(), 170, ry);
      ctx.textAlign = "right";
      fitFont(ctx, p.line, 420, 36, { weight: 600 });
      ctx.fillStyle = MUTED;
      ctx.fillText(p.line, W - 170, ry);
    });
  }

  drawFooter(ctx, sponsors);
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
