import { GAMES, SCHEDULE, TEAM } from "../data.js";
import { teamRecord, battingTotals, pitchingTotals, fieldingTotals, gameResult } from "../stats.js";
import { heading } from "../ui.js";

const FORM_CHIP = {
  W: { letter: "W", cls: "badge-win" },
  L: { letter: "L", cls: "badge-loss" },
  T: { letter: "E", cls: "badge-tie" },
};

function formatGameDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  const text = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Tarjeta de líder con el #1 en grande y el 2do/3er lugar chico debajo.
function leaderCardHtml(icon, title, sortedList, mainFormat, shortFormat) {
  const [first, second, third] = sortedList;
  const mainHtml = first ? `<p>${mainFormat(first)}</p>` : "<p>Sin datos todavía.</p>";
  const runnersUp = [second, third].filter(Boolean);
  const runnersHtml = runnersUp.length
    ? `<ol class="runner-ups" start="2">${runnersUp.map((p) => `<li>${shortFormat(p)}</li>`).join("")}</ol>`
    : "";
  return `
    <div class="leader-card">
      <h3><i class="fa-solid ${icon}"></i>${title}</h3>
      ${mainHtml}
      ${runnersHtml}
    </div>
  `;
}

export function renderResumen(container) {
  heading(container, "Resumen de temporada");

  const rec = teamRecord(GAMES);
  const cards = document.createElement("div");
  cards.className = "cards";
  cards.innerHTML = `
    <div class="card">
      <i class="fa-solid fa-trophy card-icon"></i>
      <span class="card-value">${rec.W}-${rec.L}${rec.T ? `-${rec.T}` : ""}</span>
      <span class="card-label">Récord</span>
    </div>
    <div class="card">
      <i class="fa-solid fa-bolt card-icon"></i>
      <span class="card-value">${rec.RF}</span>
      <span class="card-label">Carreras anotadas</span>
    </div>
    <div class="card">
      <i class="fa-solid fa-shield-halved card-icon"></i>
      <span class="card-value">${rec.RA}</span>
      <span class="card-label">Carreras permitidas</span>
    </div>
    <div class="card">
      <i class="fa-solid fa-calendar-check card-icon"></i>
      <span class="card-value">${rec.G}/${TEAM.gamesInSeason}</span>
      <span class="card-label">Juegos jugados</span>
    </div>
  `;
  container.appendChild(cards);

  const battingList = battingTotals(GAMES);
  const batSorted = [...battingList].sort((a, b) => Number(b.AVG.replace(".", "0.")) - Number(a.AVG.replace(".", "0.")));
  const hrSorted = [...battingList].sort((a, b) => b.HR - a.HR);
  const pitSorted = pitchingTotals(GAMES).sort((a, b) => Number(a.ERA) - Number(b.ERA));
  const fldSorted = fieldingTotals(GAMES).sort((a, b) => Number(b.FPCT.replace(".", "0.")) - Number(a.FPCT.replace(".", "0.")));

  const battingRow = document.createElement("div");
  battingRow.className = "leaders";
  battingRow.innerHTML =
    leaderCardHtml(
      "fa-baseball-bat-ball",
      "Líder de bateo",
      batSorted,
      (p) => `${p.name} — AVG ${p.AVG}, ${p.HR} HR, ${p.RBI} RBI`,
      (p) => `${p.name} — AVG ${p.AVG}`
    ) +
    leaderCardHtml(
      "fa-fire",
      "Líder de jonrones",
      hrSorted,
      (p) => `${p.name} — ${p.HR} HR`,
      (p) => `${p.name} — ${p.HR} HR`
    );
  container.appendChild(battingRow);

  const pitchingRow = document.createElement("div");
  pitchingRow.className = "leaders section-gap";
  pitchingRow.innerHTML =
    leaderCardHtml(
      "fa-baseball",
      "Líder de pitcheo",
      pitSorted,
      (p) => `${p.name} — ERA ${p.ERA}, ${p.SO} K en ${p.IP} IP`,
      (p) => `${p.name} — ERA ${p.ERA}`
    ) +
    leaderCardHtml(
      "fa-shield",
      "Líder de fildeo",
      fldSorted,
      (p) => `${p.name} — FPCT ${p.FPCT}, ${p.PO} PO, ${p.A} A`,
      (p) => `${p.name} — FPCT ${p.FPCT}`
    );
  container.appendChild(pitchingRow);

  const bottomRow = document.createElement("div");
  bottomRow.className = "leaders section-gap";

  const recentGames = [...GAMES].sort((a, b) => a.date.localeCompare(b.date)).slice(-5);
  if (recentGames.length > 0) {
    const form = document.createElement("div");
    form.className = "leader-card form-card";
    form.innerHTML = `
      <h3><i class="fa-solid fa-clock-rotate-left"></i>Racha reciente</h3>
      <div class="form-strip">
        ${recentGames
          .map((g) => {
            const chip = FORM_CHIP[gameResult(g)] ?? { letter: "?", cls: "badge-unknown" };
            return `<span class="badge form-chip ${chip.cls}" title="${g.opponent} — ${g.date}">${chip.letter}</span>`;
          })
          .join("")}
      </div>
    `;
    bottomRow.appendChild(form);
  }

  for (const g of SCHEDULE) {
    const next = document.createElement("div");
    next.className = "leader-card";
    next.innerHTML = `
      <h3><i class="fa-solid fa-calendar-day"></i>Próximo juego</h3>
      <p>${formatGameDate(g.date)}${g.time ? ` — ${g.time}` : ""}<br>vs ${g.opponent}</p>
    `;
    bottomRow.appendChild(next);
  }

  if (bottomRow.children.length > 0) container.appendChild(bottomRow);
}
