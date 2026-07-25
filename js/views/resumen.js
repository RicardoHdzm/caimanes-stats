import { GAMES, SCHEDULE, TEAM } from "../data.js";
import {
  teamRecord,
  battingTotals,
  pitchingTotals,
  fieldingTotals,
  gameResult,
  currentStreak,
  teamBattingTotals,
  teamPitchingTotals,
  teamFieldingTotals,
} from "../stats.js";
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
      <i class="fa-solid fa-ranking-star card-icon"></i>
      <span class="card-value">${TEAM.leaguePosition ? `${TEAM.leaguePosition}°` : "—"}</span>
      <span class="card-label">Posición en la liga${TEAM.leagueTeams ? ` (de ${TEAM.leagueTeams})` : ""}</span>
    </div>
  `;
  container.appendChild(cards);

  const bottomRow = document.createElement("div");
  bottomRow.className = "leaders section-gap";

  const streak = currentStreak(GAMES);
  if (streak) {
    const STREAK_LABEL = { W: "victoria", L: "derrota", T: "empate" };
    const STREAK_ICON = { W: "fa-fire", L: "fa-arrow-trend-down", T: "fa-equals" };
    const word = STREAK_LABEL[streak.type];
    const plural = streak.count === 1 ? word : `${word}s`;
    const streakCard = document.createElement("div");
    streakCard.className = "leader-card";
    streakCard.innerHTML = `
      <h3><i class="fa-solid ${STREAK_ICON[streak.type]}"></i>Racha actual</h3>
      <p>${streak.count} ${plural} seguida${streak.count === 1 ? "" : "s"}</p>
    `;
    bottomRow.appendChild(streakCard);
  }

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

  const gamesPlayedCard = document.createElement("div");
  gamesPlayedCard.className = "leader-card";
  gamesPlayedCard.innerHTML = `
    <h3><i class="fa-solid fa-calendar-check"></i>Juegos jugados</h3>
    <p>${rec.G}/${TEAM.gamesInSeason}</p>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${Math.min(100, (rec.G / TEAM.gamesInSeason) * 100)}%"></div>
    </div>
  `;
  bottomRow.appendChild(gamesPlayedCard);

  if (bottomRow.children.length > 0) container.appendChild(bottomRow);

  const teamBat = teamBattingTotals(GAMES);
  const teamPit = teamPitchingTotals(GAMES);
  const teamFld = teamFieldingTotals(GAMES);

  const teamHeading = document.createElement("h3");
  teamHeading.className = "team-stats-heading";
  teamHeading.textContent = "Stats de equipo";
  container.appendChild(teamHeading);

  const teamRow = document.createElement("div");
  teamRow.className = "leaders grid-3";
  teamRow.innerHTML = `
    <div class="leader-card">
      <h3><i class="fa-solid fa-baseball-bat-ball"></i>Bateo de equipo</h3>
      <p>AVG ${teamBat.AVG} · OBP ${teamBat.OBP} · SLG ${teamBat.SLG}</p>
    </div>
    <div class="leader-card">
      <h3><i class="fa-solid fa-baseball"></i>Pitcheo de equipo</h3>
      <p>ERA ${teamPit.ERA} · WHIP ${teamPit.WHIP}</p>
    </div>
    <div class="leader-card">
      <h3><i class="fa-solid fa-shield"></i>Fildeo de equipo</h3>
      <p>FPCT ${teamFld.FPCT}</p>
    </div>
  `;
  container.appendChild(teamRow);

  const battingList = battingTotals(GAMES);
  const batSorted = [...battingList].sort((a, b) => Number(b.AVG.replace(".", "0.")) - Number(a.AVG.replace(".", "0.")));
  const hrSorted = [...battingList].sort((a, b) => b.HR - a.HR);
  const pitSorted = pitchingTotals(GAMES).sort((a, b) => Number(a.ERA) - Number(b.ERA));
  const fldSorted = fieldingTotals(GAMES).sort((a, b) => Number(b.FPCT.replace(".", "0.")) - Number(a.FPCT.replace(".", "0.")));
  const soSorted = [...battingList].sort((a, b) => b.SO - a.SO);
  const sbSorted = [...battingList].sort((a, b) => b.SB - a.SB);

  const leadersRow = document.createElement("div");
  leadersRow.className = "leaders grid-3 section-gap";
  leadersRow.innerHTML =
    leaderCardHtml(
      "fa-baseball-bat-ball",
      "Líder de bateo",
      batSorted,
      (p) => `${p.name} — AVG ${p.AVG}, ${p.HR} HR, ${p.RBI} RBI`,
      (p) => `${p.name} — AVG ${p.AVG}`
    ) +
    leaderCardHtml(
      "fa-bomb",
      "Líder de jonrones",
      hrSorted,
      (p) => `${p.name} — ${p.HR} HR`,
      (p) => `${p.name} — ${p.HR} HR`
    ) +
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
    ) +
    leaderCardHtml(
      "fa-person-running",
      "Líder de robo de bases",
      sbSorted,
      (p) => `${p.name} — ${p.SB} SB`,
      (p) => `${p.name} — ${p.SB} SB`
    ) +
    leaderCardHtml(
      "fa-beer-mug-empty",
      "Líder de ponches",
      soSorted,
      (p) => `${p.name} — ${p.SO} ponches`,
      (p) => `${p.name} — ${p.SO} ponches`
    );
  container.appendChild(leadersRow);
}
