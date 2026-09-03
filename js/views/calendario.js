import { GAMES, SCHEDULE } from "../data.js";
import { gameResult } from "../stats.js";
import { heading } from "../ui.js";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const RESULT_CLASS = { W: "cal-win", L: "cal-loss", T: "cal-tie" };

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Un evento por fecha: juego jugado (con resultado) o juego programado.
function buildEventsByDate() {
  const map = new Map();
  for (const g of GAMES) {
    map.set(g.date, { type: "played", game: g });
  }
  for (const s of SCHEDULE) {
    if (!map.has(s.date)) map.set(s.date, { type: "scheduled", game: s });
  }
  return map;
}

export function renderCalendario(container) {
  heading(container, "Calendario de temporada");

  const events = buildEventsByDate();
  const today = new Date();

  // Arranca en el mes del próximo juego programado; si no hay, en el de hoy.
  const upcoming = [...SCHEDULE].sort((a, b) => a.date.localeCompare(b.date))[0];
  const initial = upcoming ? parseDate(upcoming.date) : today;

  let viewYear = initial.getFullYear();
  let viewMonth = initial.getMonth();

  const wrap = document.createElement("div");
  container.appendChild(wrap);

  function draw() {
    wrap.innerHTML = "";

    const header = document.createElement("div");
    header.className = "cal-header";
    header.innerHTML = `
      <button class="cal-nav" aria-label="Mes anterior" type="button"><i class="fa-solid fa-chevron-left"></i></button>
      <span class="cal-title">${MONTHS[viewMonth]} ${viewYear}</span>
      <button class="cal-nav" aria-label="Mes siguiente" type="button"><i class="fa-solid fa-chevron-right"></i></button>
    `;
    wrap.appendChild(header);

    const [prevBtn, nextBtn] = header.querySelectorAll(".cal-nav");
    prevBtn.addEventListener("click", () => {
      viewMonth -= 1;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear -= 1;
      }
      draw();
    });
    nextBtn.addEventListener("click", () => {
      viewMonth += 1;
      if (viewMonth > 11) {
        viewMonth = 0;
        viewYear += 1;
      }
      draw();
    });

    const grid = document.createElement("div");
    grid.className = "cal-grid";
    for (const wd of WEEKDAYS) {
      const wdEl = document.createElement("div");
      wdEl.className = "cal-weekday";
      wdEl.textContent = wd;
      grid.appendChild(wdEl);
    }

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = firstOfMonth.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayStr = formatDate(today);

    for (let i = 0; i < startOffset; i++) {
      const empty = document.createElement("div");
      empty.className = "cal-day cal-day-empty";
      grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const event = events.get(dateStr);

      const cell = document.createElement("div");
      cell.className = "cal-day";
      if (dateStr === todayStr) cell.classList.add("cal-day-today");

      let inner = `<span class="cal-daynum">${day}</span>`;
      if (event?.type === "played") {
        const cls = RESULT_CLASS[gameResult(event.game)] ?? "cal-unknown";
        inner += `<span class="cal-dot ${cls}"></span><span class="cal-opponent">${event.game.opponent}</span>`;
        cell.classList.add("cal-clickable");
        cell.addEventListener("click", () => {
          location.hash = `#/juegos/${event.game.id}`;
        });
      } else if (event?.type === "scheduled") {
        inner += `<span class="cal-dot cal-scheduled"></span><span class="cal-opponent">${event.game.opponent}</span>`;
        // El RSVP vive en Resumen (ver js/views/resumen.js), no aquí — evita
        // inventar una segunda pantalla de detalle solo para confirmar
        // asistencia.
        cell.classList.add("cal-clickable");
        cell.addEventListener("click", () => {
          location.hash = "#/resumen";
        });
      }
      cell.innerHTML = inner;
      grid.appendChild(cell);
    }

    wrap.appendChild(grid);

    const legend = document.createElement("div");
    legend.className = "cal-legend";
    legend.innerHTML = `
      <span><span class="cal-dot cal-win"></span> Victoria</span>
      <span><span class="cal-dot cal-loss"></span> Derrota</span>
      <span><span class="cal-dot cal-tie"></span> Empate</span>
      <span><span class="cal-dot cal-scheduled"></span> Programado</span>
    `;
    wrap.appendChild(legend);
  }

  draw();
}
