import { GAMES, SCHEDULE, TEAM, PLAYERS } from "../data.js";
import {
  teamRecord,
  battingTotals,
  pitchingTotals,
  gameResult,
  currentStreak,
  teamBattingTotals,
  teamPitchingTotals,
  teamFieldingTotals,
  minPlateAppearances,
  seasonRecords,
} from "../stats.js";
import { heading } from "../ui.js";
import { getCurrentPlayerId } from "../auth.js";
import { getRsvps, setRsvp } from "../db.js";

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
// `note` es una línea chica al pie (ej. el mínimo de turnos para calificar).
function leaderCardHtml(icon, title, sortedList, mainFormat, shortFormat, note) {
  const [first, second, third] = sortedList;
  const mainHtml = first ? `<p>${mainFormat(first)}</p>` : "<p>Sin datos todavía.</p>";
  const runnersUp = [second, third].filter(Boolean);
  const runnersHtml = runnersUp.length
    ? `<ol class="runner-ups" start="2">${runnersUp.map((p) => `<li>${shortFormat(p)}</li>`).join("")}</ol>`
    : "";
  const noteHtml = note ? `<p class="leader-note">${note}</p>` : "";
  return `
    <div class="leader-card">
      <h3><i class="fa-solid ${icon}"></i>${title}</h3>
      ${mainHtml}
      ${runnersHtml}
      ${noteHtml}
    </div>
  `;
}

// Conteo público (siempre) + botones Sí/No (solo con cuenta vinculada a un
// jugador) dentro de la tarjeta de "Próximo juego". Se llama una vez por
// tarjeta — en la práctica SCHEDULE casi siempre trae 0 o 1 juego.
function wireRsvp(cardEl, gameId) {
  const tallyEl = cardEl.querySelector(".rsvp-tally");
  const actionsEl = cardEl.querySelector(".rsvp-actions");

  function renderActions(myStatus) {
    if (!getCurrentPlayerId()) {
      actionsEl.innerHTML = `<p class="auth-hint">Inicia sesión para confirmar tu asistencia.</p>`;
      return;
    }
    actionsEl.innerHTML = `
      <button type="button" class="rsvp-btn rsvp-yes${myStatus === "yes" ? " active" : ""}" data-status="yes">
        <i class="fa-solid fa-check"></i> Voy
      </button>
      <button type="button" class="rsvp-btn rsvp-no${myStatus === "no" ? " active" : ""}" data-status="no">
        <i class="fa-solid fa-xmark"></i> No voy
      </button>
    `;
    for (const btn of actionsEl.querySelectorAll(".rsvp-btn")) {
      btn.addEventListener("click", async () => {
        for (const b of actionsEl.querySelectorAll(".rsvp-btn")) b.disabled = true;
        try {
          await setRsvp(gameId, btn.dataset.status);
          await refresh();
        } catch {
          // Silencioso a propósito: un error de red no debe romper la
          // tarjeta, el jugador simplemente puede volver a intentar.
        } finally {
          for (const b of actionsEl.querySelectorAll(".rsvp-btn")) b.disabled = false;
        }
      });
    }
  }

  async function refresh() {
    const rows = await getRsvps(gameId);
    const yesNames = rows
      .filter((r) => r.status === "yes")
      .map((r) => PLAYERS.find((p) => p.id === r.player_id)?.name ?? r.player_id);
    tallyEl.innerHTML =
      yesNames.length > 0
        ? `<strong>${yesNames.length} confirmado${yesNames.length === 1 ? "" : "s"}:</strong> ${yesNames.join(", ")}`
        : "Nadie ha confirmado todavía.";
    const mine = rows.find((r) => r.player_id === getCurrentPlayerId());
    renderActions(mine?.status ?? null);
  }

  refresh();
}

export function renderResumen(container) {
  heading(container, "Resumen de temporada");

  const rec = teamRecord(GAMES);
  const cards = document.createElement("div");
  cards.className = "cards tab-carousel";
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

  // El próximo juego va primero: es lo que más se consulta entre semana, y
  // en celular esta fila es un carrusel — lo importante debe estar a un
  // deslizazo de distancia, no al final.
  for (const g of SCHEDULE) {
    const next = document.createElement("div");
    next.className = "leader-card";
    next.innerHTML = `
      <h3><i class="fa-solid fa-calendar-day"></i>Próximo juego</h3>
      <p>${formatGameDate(g.date)}${g.time ? ` — ${g.time}` : ""}<br>vs ${g.opponent}</p>
      <p class="rsvp-tally">Cargando asistencia…</p>
      <div class="rsvp-actions"></div>
    `;
    bottomRow.appendChild(next);
    wireRsvp(next, g.id);
  }

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
  teamHeading.textContent = "Stats de equipo";
  container.appendChild(teamHeading);

  const teamRow = document.createElement("div");
  teamRow.className = "leaders grid-4 team-stats-row tab-carousel";
  teamRow.innerHTML = `
    <div class="leader-card">
      <h3><i class="fa-solid fa-baseball-bat-ball"></i>Bateo de equipo</h3>
      <p>AVG ${teamBat.AVG} · OBP ${teamBat.OBP} · SLG ${teamBat.SLG}</p>
    </div>
    <div class="leader-card">
      <h3><i class="fa-solid fa-bomb"></i>Home runs de equipo</h3>
      <p>${teamBat.HR} HR</p>
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
  // El líder de promedio solo sale de entre los que llegan al mínimo de
  // apariciones al plato; los demás siguen en la tabla de bateo completa.
  const minPA = minPlateAppearances(GAMES);
  const batSorted = battingList.filter((p) => p.qualified).sort((a, b) => Number(b.AVG) - Number(a.AVG));
  const hrSorted = [...battingList].sort((a, b) => (b.HR - a.HR) || (b.HRC - a.HRC));
  const pitSorted = pitchingTotals(GAMES).sort((a, b) => Number(a.ERA) - Number(b.ERA));
  const soSorted = [...battingList].sort((a, b) => b.SO - a.SO);

  const leadersHeading = document.createElement("h3");
  leadersHeading.textContent = "Líderes de la temporada";
  container.appendChild(leadersHeading);

  const leadersRow = document.createElement("div");
  leadersRow.className = "leaders grid-4 tab-carousel";
  leadersRow.innerHTML =
    leaderCardHtml(
      "fa-baseball-bat-ball",
      "Líder de bateo",
      batSorted,
      (p) => `${p.name} — AVG ${p.AVG}, ${p.HR} HR, ${p.RBI} RBI`,
      (p) => `${p.name} — AVG ${p.AVG}`,
      `Mínimo ${minPA} turnos (AB + BB) para calificar.`
    ) +
    leaderCardHtml(
      "fa-bomb",
      "Líder de home runs",
      hrSorted,
      (p) => (p.HR > 0 ? `${p.name} — ${p.HR} HR` : `${p.name} — ${p.HRC} HRC`),
      (p) => (p.HR > 0 ? `${p.name} — ${p.HR} HR` : `${p.name} — ${p.HRC} HRC`)
    ) +
    leaderCardHtml(
      "fa-baseball",
      "Líder de pitcheo",
      pitSorted,
      (p) => `${p.name} — ERA ${p.ERA}, ${p.SO} K en ${p.IP} IP`,
      (p) => `${p.name} — ERA ${p.ERA}`
    ) +
    leaderCardHtml(
      "fa-beer-mug-empty",
      "Líder cervecero",
      soSorted,
      (p) => `${p.name} — ${p.SO * 12} botes`,
      (p) => `${p.name} — ${p.SO * 12} botes`
    );
  container.appendChild(leadersRow);

  // ---- Récords de temporada ----
  const records = seasonRecords(GAMES);
  if (records.length > 0) {
    const recordsHeading = document.createElement("h3");
    recordsHeading.textContent = "Récords de la temporada";
    container.appendChild(recordsHeading);

    const recordsRow = document.createElement("div");
    recordsRow.className = "records-grid tab-carousel";
    recordsRow.innerHTML = records
      .map(
        (r) => `
        <div class="record-card"${r.playerId ? ` data-player="${r.playerId}"` : ""}${r.gameId ? ` data-game="${r.gameId}"` : ""}>
          <i class="fa-solid ${r.icon} record-icon"></i>
          <div class="record-body">
            <span class="record-label">${r.label}</span>
            <span class="record-value">${r.value}</span>
            <span class="record-detail">${r.detail}</span>
            <span class="record-note">${r.note}</span>
          </div>
        </div>
      `
      )
      .join("");

    // Cada récord lleva al jugador (o al juego) que lo tiene.
    for (const card of recordsRow.querySelectorAll(".record-card")) {
      const { player, game } = card.dataset;
      if (!player && !game) continue;
      card.classList.add("record-clickable");
      card.addEventListener("click", () => {
        location.hash = player ? `#/jugador/${player}` : `#/juegos/${game}`;
      });
    }

    container.appendChild(recordsRow);
  }
}
