// Congela a la izquierda las columnas marcadas con `sticky` para que la
// identidad de la fila (nombre, fecha) siga a la vista al scrollear la tabla
// en horizontal. Deben ser contiguas desde la primera columna: el `left` de
// cada una es la suma del ancho de las anteriores, y solo se sabe ya que la
// tabla está en el DOM y medida.
function applyStickyOffsets(table, columns) {
  const headCells = table.tHead.rows[0].cells;
  const bodyRows = table.tBodies[0].rows;
  let offset = 0;
  for (let i = 0; i < columns.length && columns[i].sticky; i++) {
    const left = `${offset}px`;
    headCells[i].style.left = left;
    for (const row of bodyRows) {
      // La fila de "sin datos" es una sola celda con colspan.
      if (row.cells.length === columns.length) row.cells[i].style.left = left;
    }
    offset += headCells[i].getBoundingClientRect().width;
  }
}

// Tabla ordenable simple, reutilizada por las vistas de stats.
// columns: [{ key, label, numeric?, render?, sticky? }]
//   render(value, row) puede devolver HTML (ej. para badges) en vez de texto plano.
//   sticky marca la columna como congelada (ver applyStickyOffsets).
// rows: arreglo de objetos con esas keys
// defaultSort: key por la que ordena al cargar (descendente si numeric)
// sortable: false deja las columnas fijas (sin click para reordenar), útil para
// tablas donde el orden importa (ej. line-up de un juego).
// rowClass(row) permite marcar filas concretas (ej. resaltar al equipo propio
// en la tabla de posiciones). Devuelve una clase o nada.
export function renderSortableTable(container, { columns, rows, defaultSort, defaultDir, onRowClick, rowClass, sortable = true }) {
  let sortKey = defaultSort ?? columns[0].key;
  let sortDir = defaultDir ?? -1;

  function sortedRows() {
    const col = columns.find((c) => c.key === sortKey);
    return [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const an = col?.numeric ? Number(av) : av;
      const bn = col?.numeric ? Number(bv) : bv;
      if (an < bn) return -1 * sortDir;
      if (an > bn) return 1 * sortDir;
      return 0;
    });
  }

  const firstLooseIndex = columns.findIndex((c) => !c.sticky);
  const lastStickyIndex = firstLooseIndex === -1 ? columns.length - 1 : firstLooseIndex - 1;

  // Clases de la columna congelada: la primera lleva la barra de acento al
  // pasar el mouse (queda encima de la de la fila) y la última, el filo que
  // la separa de las columnas que sí se mueven.
  function stickyClasses(index) {
    if (!columns[index].sticky) return [];
    const classes = ["sticky-col"];
    if (index === 0) classes.push("sticky-col-first");
    if (index === lastStickyIndex) classes.push("sticky-col-last");
    return classes;
  }

  function draw() {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";

    const table = document.createElement("table");
    table.className = sortable ? "stats-table" : "stats-table not-sortable";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const [index, col] of columns.entries()) {
      const th = document.createElement("th");
      th.textContent = col.label;
      th.dataset.key = col.key;
      if (col.numeric) th.classList.add("numeric");
      th.classList.add(...stickyClasses(index));
      if (sortable) {
        if (col.key === sortKey) th.classList.add(sortDir === 1 ? "sort-asc" : "sort-desc");
        th.addEventListener("click", () => {
          if (sortKey === col.key) sortDir *= -1;
          else {
            sortKey = col.key;
            sortDir = -1;
          }
          draw();
        });
      }
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const row of sortedRows()) {
      const tr = document.createElement("tr");
      for (const [index, col] of columns.entries()) {
        const td = document.createElement("td");
        if (col.numeric) td.classList.add("numeric");
        td.classList.add(...stickyClasses(index));
        const value = row[col.key] ?? "";
        if (col.render) td.innerHTML = col.render(value, row);
        else td.textContent = value;
        tr.appendChild(td);
      }
      if (onRowClick) {
        tr.classList.add("clickable-row");
        tr.addEventListener("click", () => onRowClick(row));
      }
      const extra = rowClass?.(row);
      if (extra) tr.classList.add(extra);
      tbody.appendChild(tr);
    }
    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = columns.length;
      td.className = "empty";
      td.textContent = "Sin datos todavía.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
    if (lastStickyIndex >= 0) applyStickyOffsets(table, columns);
  }

  draw();

  // Al cambiar el ancho de la ventana cambian los anchos de columna, así que
  // los `left` calculados se recalculan. El observer muere junto con la tabla
  // cuando el router reemplaza la vista.
  if (lastStickyIndex >= 0 && typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => {
      const table = container.querySelector("table");
      if (table) applyStickyOffsets(table, columns);
    });
    observer.observe(container);
  }
}

// Escapa texto que va a meterse como HTML. Hace falta para datos libres que
// no controla el código, como títulos de canciones ("Sex & Candy").
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Colorea un valor numérico (ej. rojo para ponches/errores, verde para
// carreras) solo cuando es distinto de 0 — el 0 se queda en blanco.
export function coloredStat(value, colorClass) {
  return Number(value) > 0 ? `<span class="${colorClass}">${value}</span>` : String(value);
}

const INFIELD_POSITIONS = new Set(["1B", "2B", "3B", "SS"]);
const OUTFIELD_POSITIONS = new Set(["LF", "CF", "RF"]);
const SPECIAL_POSITIONS = new Set(["JC"]);

// Clase de color según el tipo de posición: pitcher (azul), catcher (morado),
// infield (amarillo), outfield (verde), JD (naranja), JC (rosa).
// DH/UTIL quedan neutros.
function positionBadgeClass(code) {
  if (code === "P") return "pos-badge-p";
  if (code === "C") return "pos-badge-c";
  if (INFIELD_POSITIONS.has(code)) return "pos-badge-if";
  if (OUTFIELD_POSITIONS.has(code)) return "pos-badge-of";
  if (code === "JD") return "pos-badge-jd";
  if (SPECIAL_POSITIONS.has(code)) return "pos-badge-special";
  return "";
}

export function renderPositionBadge(value) {
  if (!value) return "";
  return `<span class="pos-badge ${positionBadgeClass(value)}">${value}</span>`;
}

// Un jugador puede jugar hasta 3 posiciones en el mismo juego (ej. "2B/SS").
// Convierte ese string en uno o varios pos-badge, uno por posición.
export function renderPositionBadges(value) {
  if (!value) return "";
  return value
    .split("/")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((v) => renderPositionBadge(v))
    .join(" ");
}

// Abreviatura coloquial de ordinal en español ("2da", "8va") — no es un
// ordinal lingüístico estricto, es la misma forma corta que ya usa el pie
// de página para las temporadas ("Liga Valle Alto 4ta Temporada - 8va
// Temporada"). Cubre 1-10; más allá cae en "va" en vez de tronar.
const ORDINAL_SUFFIXES = { 1: "ra", 2: "da", 3: "ra", 4: "ta", 5: "ta", 6: "ta", 7: "ma", 8: "va", 9: "na", 10: "ma" };
export function ordinalTemporada(n) {
  return `${n}${ORDINAL_SUFFIXES[n] ?? "va"}`;
}

// Avatar de un jugador: foto si `player.photo` está definido, si no un
// círculo con sus iniciales. `size` en px (default 40).
export function renderAvatar(player, size = 40) {
  const style = `width:${size}px;height:${size}px;font-size:${size * 0.4}px;`;
  if (player.photo) {
    return `<img class="avatar" src="${player.photo}" alt="${player.name}" style="${style}">`;
  }
  const initials = (player.name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return `<span class="avatar avatar-initials" style="${style}">${initials}</span>`;
}

// Icono según de dónde venga el link de la canción de entrada (walk-up
// song) — usado en el perfil (js/views/jugador.js) y en la playlist del
// equipo (js/views/playlist.js).
const WALKUP_PLATFORMS = [
  { match: /(^|\.)spotify\.com$/, icon: "fa-brands fa-spotify" },
  { match: /(^|\.)(youtube\.com|youtu\.be)$/, icon: "fa-brands fa-youtube" },
  { match: /(^|\.)music\.apple\.com$/, icon: "fa-brands fa-apple" },
  { match: /(^|\.)deezer\.com$/, icon: "fa-brands fa-deezer" },
  { match: /(^|\.)soundcloud\.com$/, icon: "fa-brands fa-soundcloud" },
];

// Solo se aceptan links http(s): un `javascript:` en data.js correría al
// abrirlo. Devuelve null si la URL no sirve, y entonces se pinta sin link.
function safeWalkupUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

function walkupIcon(parsedUrl) {
  if (!parsedUrl) return "fa-solid fa-music";
  const host = parsedUrl.hostname.toLowerCase();
  return WALKUP_PLATFORMS.find((p) => p.match.test(host))?.icon ?? "fa-solid fa-music";
}

// Canción de entrada (walk-up song): la que suena cuando el jugador va al
// bat. Sin `walkup.title` no se pinta nada.
export function renderWalkup(walkup) {
  if (!walkup?.title) return "";

  const parsed = safeWalkupUrl(walkup.url);
  const icon = walkupIcon(parsed);
  const title = escapeHtml(walkup.title);
  // Formato de un solo renglón: "Walkup Song: [icono] - Título - Artista".
  // Sin artista se corta después del título, sin dejar un guion colgado.
  const artist = walkup.artist
    ? `<span class="walkup-sep">-</span><span class="walkup-artist">${escapeHtml(walkup.artist)}</span>`
    : "";

  const body = `
    <span class="walkup-label">Walkup Song:</span>
    <i class="${icon} walkup-icon"></i>
    <span class="walkup-sep">-</span>
    <span class="walkup-title">${title}</span>
    ${artist}
  `;

  if (!parsed) return `<div class="walkup">${body}</div>`;
  // Mismo icono de play que el botón "Ver replay" del detalle de juego.
  return `<a class="walkup walkup-link" href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer">${body}<i class="fa-solid fa-circle-play walkup-play"></i></a>`;
}

// Glosario chiquito debajo de una tabla: "AB = Turnos al bat · H = Hits ...".
// Solo incluye las columnas que traen `full` definido.
export function renderGlossary(container, columns) {
  const withFull = columns.filter((c) => c.full);
  if (withFull.length === 0) return;
  const p = document.createElement("p");
  p.className = "glossary";
  p.innerHTML = withFull.map((c) => `<strong>${c.label}</strong> = ${c.full}`).join(" &nbsp;·&nbsp; ");
  container.appendChild(p);
}

export function heading(container, text, subtitle) {
  const h2 = document.createElement("h2");
  h2.textContent = text;
  container.appendChild(h2);
  if (subtitle) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = subtitle;
    container.appendChild(p);
  }
}
