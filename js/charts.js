// Gráficas en SVG puro, sin librerías.
//
// El viewBox se arma con el ancho real del contenedor en píxeles, no con un
// tamaño fijo: así una unidad de SVG es un píxel y el texto de los ejes se ve
// del mismo tamaño en celular que en escritorio. Con un viewBox fijo, en un
// teléfono la gráfica se escala a ~0.4 y las etiquetas quedan ilegibles.

const MIN_WIDTH = 300;
const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 30, left: 42 };

// Ancho mínimo por etiqueta del eje X para que no se encimen.
const LABEL_SLOT = 52;

function fmt3(n) {
  return n.toFixed(3).replace(/^0\./, ".");
}

// Redondea el techo del eje Y a la décima de arriba para que la línea no
// toque el borde y las marcas caigan en números redondos.
function niceMax(value) {
  const capped = Math.min(1, Math.max(0.1, value));
  return Math.min(1, Math.ceil(capped * 10) / 10);
}

function escapeAttr(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function trendSvg(points, width) {
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const maxValue = Math.max(...points.map((p) => Math.max(p.gameAvg, p.cumulativeAvg)));
  const yMax = niceMax(maxValue);

  const y = (value) => PAD.top + plotH - (Math.min(value, yMax) / yMax) * plotH;
  // Cada punto vive en el centro de su franja, para que las barras queden
  // repartidas parejo aunque solo haya una.
  const slot = plotW / points.length;
  const x = (index) => PAD.left + slot * (index + 0.5);

  const barWidth = Math.min(28, slot * 0.5);

  const gridLines = [0, 0.5, 1]
    .map((ratio) => {
      const value = yMax * ratio;
      const yPos = y(value);
      return `
        <line class="chart-grid" x1="${PAD.left}" y1="${yPos}" x2="${width - PAD.right}" y2="${yPos}" />
        <text class="chart-axis-label" x="${PAD.left - 8}" y="${yPos + 4}" text-anchor="end">${fmt3(value)}</text>
      `;
    })
    .join("");

  const bars = points
    .map(
      (p, i) => `
        <rect class="chart-bar" x="${x(i) - barWidth / 2}" y="${y(p.gameAvg)}"
              width="${barWidth}" height="${Math.max(0, PAD.top + plotH - y(p.gameAvg))}" rx="2">
          <title>${escapeAttr(p.tooltip)}</title>
        </rect>
      `
    )
    .join("");

  const linePoints = points.map((p, i) => `${x(i)},${y(p.cumulativeAvg)}`).join(" ");
  const line = points.length > 1 ? `<polyline class="chart-line" points="${linePoints}" />` : "";

  const dots = points
    .map(
      (p, i) => `
        <circle class="chart-dot" cx="${x(i)}" cy="${y(p.cumulativeAvg)}" r="4">
          <title>${escapeAttr(p.tooltip)}</title>
        </circle>
      `
    )
    .join("");

  // En pantallas angostas no caben todas las fechas, así que se van salteando.
  const maxLabels = Math.max(2, Math.floor(plotW / LABEL_SLOT));
  const labelStep = Math.ceil(points.length / maxLabels);
  const xLabels = points
    .map((p, i) =>
      i % labelStep === 0
        ? `<text class="chart-axis-label" x="${x(i)}" y="${HEIGHT - 10}" text-anchor="middle">${escapeAttr(p.label)}</text>`
        : ""
    )
    .join("");

  return `
    <svg class="chart" viewBox="0 0 ${width} ${HEIGHT}"
         role="img" aria-label="Tendencia de promedio de bateo por juego">
      ${gridLines}
      ${bars}
      ${line}
      ${dots}
      ${xLabels}
    </svg>
  `;
}

// Gráfica de tendencia de bateo: barras con el AVG de cada juego y una línea
// con el AVG acumulado. Las barras dicen cómo viene ahorita, la línea dice
// dónde está parada la temporada.
//
// points: [{ label, gameAvg, cumulativeAvg, tooltip }]
export function renderTrendChart(container, points) {
  if (points.length === 0) return;

  const wrap = document.createElement("div");
  wrap.className = "chart-wrap";
  container.appendChild(wrap);

  const plot = document.createElement("div");
  wrap.appendChild(plot);

  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = `
    <span class="chart-legend-item"><span class="chart-swatch chart-swatch-bar"></span>AVG del juego</span>
    <span class="chart-legend-item"><span class="chart-swatch chart-swatch-line"></span>AVG acumulado</span>
  `;
  wrap.appendChild(legend);

  let lastWidth = 0;

  function draw() {
    const width = Math.max(MIN_WIDTH, Math.round(plot.clientWidth));
    // Redibujar por cambios de un pixel solo haría trabajo de más (y podría
    // realimentar al observer), así que se ignoran los ajustes mínimos.
    if (Math.abs(width - lastWidth) < 4) return;
    lastWidth = width;
    plot.innerHTML = trendSvg(points, width);
  }

  draw();

  // Al girar el teléfono o cambiar el ancho de ventana se vuelve a armar el
  // viewBox para que el texto conserve su tamaño real.
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(draw).observe(plot);
  }
}
