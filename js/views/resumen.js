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

  const leaders = document.createElement("div");
  leaders.className = "leaders";

  const battingList = battingTotals(GAMES);
  const bat = [...battingList].sort((a, b) => Number(b.AVG.replace(".", "0.")) - Number(a.AVG.replace(".", "0.")))[0];
  const hrLeader = [...battingList].sort((a, b) => b.HR - a.HR)[0];
  const pit = pitchingTotals(GAMES).sort((a, b) => Number(a.ERA) - Number(b.ERA))[0];
  const fld = fieldingTotals(GAMES).sort((a, b) => Number(b.FPCT.replace(".", "0.")) - Number(a.FPCT.replace(".", "0.")))[0];

  leaders.innerHTML = `
    <div class="leader-card">
      <h3><i class="fa-solid fa-baseball-bat-ball"></i>Líder de bateo</h3>
      ${bat ? `<p>${bat.name} — AVG ${bat.AVG}, ${bat.HR} HR, ${bat.RBI} RBI</p>` : "<p>Sin datos todavía.</p>"}
    </div>
    <div class="leader-card">
      <h3><i class="fa-solid fa-fire"></i>Líder de jonrones</h3>
      ${hrLeader ? `<p>${hrLeader.name} — ${hrLeader.HR} HR</p>` : "<p>Sin datos todavía.</p>"}
    </div>
    <div class="leader-card">
      <h3><i class="fa-solid fa-baseball"></i>Líder de pitcheo</h3>
      ${pit ? `<p>${pit.name} — ERA ${pit.ERA}, ${pit.SO} K en ${pit.IP} IP</p>` : "<p>Sin datos todavía.</p>"}
    </div>
    <div class="leader-card">
      <h3><i class="fa-solid fa-shield"></i>Líder de fildeo</h3>
      ${fld ? `<p>${fld.name} — FPCT ${fld.FPCT}, ${fld.PO} PO, ${fld.A} A</p>` : "<p>Sin datos todavía.</p>"}
    </div>
  `;
  container.appendChild(leaders);

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
