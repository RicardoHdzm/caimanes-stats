import { SCHEDULE, GAMES, CURRENT_SEASON } from "../data.js";
import { allStatGames, gameResult } from "../stats.js";
import { heading, escapeHtml, formatGameTime } from "../ui.js";
import { upcomingCardHtml } from "../scorecards.js";

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
// Incluye TODAS las temporadas (las pasadas también, a petición expresa) y
// sus playoffs (allStatGames los marca con `playoff`) — el día de un juego
// de playoffs lleva borde y trofeo dorados.
function buildEventsByDate() {
  const map = new Map();
  for (const g of allStatGames()) {
    map.set(g.date, { type: "played", game: g });
  }
  for (const s of SCHEDULE) {
    if (!map.has(s.date)) map.set(s.date, { type: "scheduled", game: s });
  }
  return map;
}

// Próximos juegos con la misma tarjeta de marcador del resto del sitio (ver
// js/scorecards.js; antes un boleto y luego una tarjeta propia). Llevan a
// Resumen, donde vive el RSVP (igual que los días programados del calendario).
function upcomingHtml(todayStr) {
  const upcoming = [...SCHEDULE].filter((s) => s.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) return "";
  const played = GAMES.filter((g) => g.season === CURRENT_SEASON && !g.playoff).length;
  return `
    <section class="cal-upcoming">
      <h3>Próximos juegos</h3>
      <div class="home-match-grid">${upcoming
        .map((s, i) => upcomingCardHtml(s, played + i + 1, { href: "#/resumen", cta: "Asistencia" }))
        .join("")}</div>
    </section>`;
}

export function renderCalendario(container) {
  heading(container, "Calendario");

  const events = buildEventsByDate();
  const today = new Date();
  container.insertAdjacentHTML("beforeend", upcomingHtml(formatDate(today)));

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

      // Día con juego (a petición expresa, como las tarjetas de marcador):
      // la celda se pinta del color del resultado (o ámbar si está
      // programado) y lleva el marcador — o la hora — en Teko.
      let inner = `<span class="cal-daynum">${day}</span>`;
      if (event?.type === "played") {
        const result = gameResult(event.game);
        const cls = RESULT_CLASS[result] ?? "cal-unknown";
        if (result) cell.classList.add(`cal-day--${result}`);
        const g = event.game;
        const score = g.scoreUs != null && g.scoreThem != null ? `<span class="cal-score">${g.scoreUs}-${g.scoreThem}</span>` : "";
        inner += `<span class="cal-dot ${cls}"></span>${score}<span class="cal-opponent">${escapeHtml(g.opponent ?? "")}</span>`;
        if (event.game.playoff) {
          cell.classList.add("cal-day-playoff");
          inner += `<i class="fa-solid fa-trophy cal-playoff-icon" aria-label="Playoffs"></i>`;
        }
        cell.classList.add("cal-clickable");
        cell.addEventListener("click", () => {
          location.hash = `#/juegos/${event.game.id}`;
        });
      } else if (event?.type === "scheduled") {
        cell.classList.add("cal-day--next");
        const time = event.game.time ? formatGameTime(event.game.time).split(" ")[0] : "";
        inner += `<span class="cal-dot cal-scheduled"></span>${time ? `<span class="cal-score">${time}</span>` : ""}<span class="cal-opponent">${escapeHtml(event.game.opponent ?? "")}</span>`;
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
      <span><i class="fa-solid fa-trophy cal-playoff-icon"></i> Playoffs</span>
    `;
    wrap.appendChild(legend);
  }

  draw();
}
