import { heading, renderAvatar, escapeHtml } from "../ui.js";
import { publicLineup } from "../lineup.js";
import { renderComparar } from "./comparar.js";

// Pestaña pública "Alineación": el line-up sugerido como lo vería un
// aficionado — los 9 en el campo con su foto, el orden al bat y la banca,
// sin las stats con las que se calculó (a petición expresa: eso es info del
// coach y vive en el Generador de alineación, lineup/index.html, con
// js/lineup.js renderLineupResult).
//
// compareLeft/compareRight vienen de #/alineacion/p1/p2 y solo alimentan al
// comparador del final; sin ellos la alineación se dibuja igual.

// Dónde va cada posición sobre el dibujo del campo (en % del cuadro).
const FIELD_SPOTS = {
  CF: [50, 13],
  LF: [17, 27],
  RF: [83, 27],
  SS: [33, 46],
  "2B": [67, 46],
  "3B": [17, 64],
  "1B": [83, 64],
  P: [50, 62],
  C: [50, 89],
};

// Campo visto desde atrás de home: jardín (abanico), diamante y home.
const FIELD_SVG = `
  <svg class="field-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <path class="field-grass" d="M50 96 L1 47 A50 50 0 0 1 99 47 Z" />
    <path class="field-infield" d="M50 92 L24 66 L50 40 L76 66 Z" />
    <circle class="field-mound" cx="50" cy="66" r="3.2" />
    <path class="field-plate" d="M48.4 91 h3.2 v1.4 l-1.6 1.4 l-1.6 -1.4 z" />
  </svg>
`;

function shortName(name) {
  const parts = (name ?? "").trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0] ?? "";
}

function fieldPlayer(pos, player) {
  const [x, y] = FIELD_SPOTS[pos];
  if (!player) {
    return `<div class="field-spot field-spot--empty" style="left:${x}%;top:${y}%"><span class="field-pos">${pos}</span></div>`;
  }
  return `
    <a class="field-spot" href="#/jugador/${player.id}" style="left:${x}%;top:${y}%">
      ${renderAvatar(player, 58)}
      <span class="field-pos">${pos}</span>
      <span class="field-name">${escapeHtml(player.name)}</span>
    </a>`;
}

export function renderAlineacion(container, compareLeft, compareRight) {
  heading(container, "Alineación sugerida");

  const { defense, order, bench } = publicLineup();

  const field = document.createElement("section");
  field.className = "lineup-field";
  field.innerHTML = `${FIELD_SVG}${Object.keys(FIELD_SPOTS)
    .map((pos) => fieldPlayer(pos, defense[pos]))
    .join("")}`;
  container.appendChild(field);

  const orderHeading = document.createElement("h3");
  orderHeading.textContent = "Orden al bat";
  container.appendChild(orderHeading);

  let turn = 0;
  const orderList = document.createElement("ol");
  orderList.className = "lineup-order";
  orderList.innerHTML = order
    .map(
      (row) => `
      <li>
        <a href="#/jugador/${row.player.id}" class="lineup-order-row">
          <span class="lineup-order-slot${row.pitcherOnly ? " lineup-order-slot--p" : ""}">${row.pitcherOnly ? "P" : ++turn}</span>
          ${renderAvatar(row.player, 42)}
          <span class="lineup-order-name">${escapeHtml(row.player.name)}${row.player.number ? ` <small>#${row.player.number}</small>` : ""}</span>
          <span class="lineup-order-pos">${escapeHtml(row.label)}</span>
        </a>
      </li>`
    )
    .join("");
  container.appendChild(orderList);

  if (bench.length) {
    const benchHeading = document.createElement("h3");
    benchHeading.textContent = "Banca";
    container.appendChild(benchHeading);
    const benchEl = document.createElement("div");
    benchEl.className = "lineup-bench";
    benchEl.innerHTML = bench
      .map(
        (p) => `
        <a href="#/jugador/${p.id}" class="lineup-bench-player">
          ${renderAvatar(p, 56)}
          <span>${escapeHtml(shortName(p.name))}</span>
        </a>`
      )
      .join("");
    container.appendChild(benchEl);
  }

  renderComparar(container, compareLeft, compareRight);
}
