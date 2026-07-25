// Tabla ordenable simple, reutilizada por las vistas de stats.
// columns: [{ key, label, numeric?, render? }]
//   render(value, row) puede devolver HTML (ej. para badges) en vez de texto plano.
// rows: arreglo de objetos con esas keys
// defaultSort: key por la que ordena al cargar (descendente si numeric)
export function renderSortableTable(container, { columns, rows, defaultSort, defaultDir, onRowClick }) {
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

  function draw() {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";

    const table = document.createElement("table");
    table.className = "stats-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const col of columns) {
      const th = document.createElement("th");
      th.textContent = col.label;
      th.dataset.key = col.key;
      if (col.numeric) th.classList.add("numeric");
      if (col.key === sortKey) th.classList.add(sortDir === 1 ? "sort-asc" : "sort-desc");
      th.addEventListener("click", () => {
        if (sortKey === col.key) sortDir *= -1;
        else {
          sortKey = col.key;
          sortDir = -1;
        }
        draw();
      });
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const row of sortedRows()) {
      const tr = document.createElement("tr");
      for (const col of columns) {
        const td = document.createElement("td");
        if (col.numeric) td.classList.add("numeric");
        const value = row[col.key] ?? "";
        if (col.render) td.innerHTML = col.render(value, row);
        else td.textContent = value;
        tr.appendChild(td);
      }
      if (onRowClick) {
        tr.classList.add("clickable-row");
        tr.addEventListener("click", () => onRowClick(row));
      }
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
  }

  draw();
}

// Colorea un valor numérico (ej. rojo para ponches/errores, verde para
// carreras) solo cuando es distinto de 0 — el 0 se queda en blanco.
export function coloredStat(value, colorClass) {
  return Number(value) > 0 ? `<span class="${colorClass}">${value}</span>` : String(value);
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
    .map((v) => `<span class="pos-badge">${v}</span>`)
    .join(" ");
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
