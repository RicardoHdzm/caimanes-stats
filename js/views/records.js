import {
  allStatGames,
  seasonStatGames,
  seasonRecords,
  battingTotals,
  pitchingTotals,
  gamesPlayedByPlayer,
  minPlateAppearances,
  playerName,
} from "../stats.js";
import { TEAM } from "../data.js";
import { heading, ordinalTemporada } from "../ui.js";
import { teamLeaderCardHtml, renderRecordCards, hydrateAvatars } from "./resumen.js";

// Pestaña "Récords": las mejores marcas de TODAS las temporadas capturadas
// (regular + playoffs) — en un juego, en una temporada y en la carrera. Las
// de la temporada actual nada más siguen en Resumen.

function sectionHeading(container, icon, text) {
  const h3 = document.createElement("h3");
  h3.innerHTML = `<i class="fa-solid ${icon}"></i> ${text}`;
  container.appendChild(h3);
}

// Una fila de tarjetas de líder (mismo formato que "Líderes de la
// temporada" en Resumen). Las categorías sin nadie arriba de cero no salen.
function leaderRow(container, cards) {
  const shown = cards
    .map((c) => ({ ...c, list: c.list.filter(c.ok ?? (() => true)) }))
    .filter((c) => c.list.length > 0);
  if (shown.length === 0) return;
  const row = document.createElement("div");
  row.className = "leaders grid-2 tab-carousel wide-3col";
  row.innerHTML = shown.map(teamLeaderCardHtml).join("");
  container.appendChild(row);
  hydrateAvatars(row);
}

const byDesc = (key) => (a, b) => b[key] - a[key] || Number(b.AVG ?? 0) - Number(a.AVG ?? 0);
const seasonText = (n) => `${ordinalTemporada(n)} Temporada`;

export function renderRecords(container) {
  heading(container, "Récords");

  const games = allStatGames();
  if (games.length === 0) {
    container.insertAdjacentHTML("beforeend", "<p>Sin juegos capturados todavía.</p>");
    return;
  }

  // ---- En un juego ----
  sectionHeading(container, "fa-bolt", "En un juego");
  renderRecordCards(container, seasonRecords(games));

  // ---- En una temporada ----
  // Una fila por jugador y temporada; el mismo jugador puede salir dos
  // veces si tiene dos de las mejores temporadas.
  // El mejor promedio solo cuenta temporadas de al menos la mitad de los
  // juegos: si no, un 5 de 5 en el primer juego de la temporada sería récord.
  const minSeasonGames = Math.ceil(TEAM.gamesInSeason / 2);
  const seasons = [...new Set(games.map((g) => g.season))];
  const batSeasons = [];
  const pitSeasons = [];
  for (const season of seasons) {
    const sGames = seasonStatGames(season);
    const longEnough = sGames.length >= minSeasonGames;
    for (const row of battingTotals(sGames)) batSeasons.push({ ...row, season, qualified: row.qualified && longEnough });
    for (const row of pitchingTotals(sGames)) pitSeasons.push({ ...row, season });
  }
  const inSeason = (p) => seasonText(p.season);

  sectionHeading(container, "fa-calendar-days", "En una temporada");
  leaderRow(container, [
    {
      icon: "fa-baseball-bat-ball",
      title: "Mejor promedio",
      list: batSeasons.filter((p) => p.qualified).sort((a, b) => Number(b.AVG) - Number(a.AVG)),
      valueOf: (p) => p.AVG,
      detailOf: inSeason,
      note: `Temporadas de ${minSeasonGames}+ juegos, con el mínimo de turnos para calificar.`,
    },
    { icon: "fa-baseball-bat-ball", title: "Más hits", list: [...batSeasons].sort(byDesc("H")), valueOf: (p) => `${p.H} H`, detailOf: inSeason, ok: (p) => p.H > 0 },
    {
      icon: "fa-bomb",
      title: "Más jonrones",
      list: [...batSeasons].sort((a, b) => b.HR + b.HRC - (a.HR + a.HRC)),
      valueOf: (p) => `${p.HR + p.HRC} HR`,
      detailOf: inSeason,
      ok: (p) => p.HR + p.HRC > 0,
    },
    { icon: "fa-tornado", title: "Más impulsadas", list: [...batSeasons].sort(byDesc("RBI")), valueOf: (p) => `${p.RBI} RBI`, detailOf: inSeason, ok: (p) => p.RBI > 0 },
    { icon: "fa-person-running", title: "Más robos", list: [...batSeasons].sort(byDesc("SB")), valueOf: (p) => `${p.SB} SB`, detailOf: inSeason, ok: (p) => p.SB > 0 },
    { icon: "fa-baseball", title: "Más ponches (pitcher)", list: [...pitSeasons].sort(byDesc("SO")), valueOf: (p) => `${p.SO} K`, detailOf: inSeason, ok: (p) => p.SO > 0 },
  ]);

  // ---- Carrera ----
  const career = battingTotals(games);
  const careerPit = pitchingTotals(games);
  const played = gamesPlayedByPlayer(games);
  const gamesList = [...played.entries()]
    .map(([playerId, G]) => ({ playerId, name: playerName(playerId), G }))
    .sort((a, b) => b.G - a.G);

  sectionHeading(container, "fa-crown", "En la carrera");
  leaderRow(container, [
    { icon: "fa-calendar-check", title: "Más juegos", list: gamesList, valueOf: (p) => `${p.G} JJ` },
    {
      icon: "fa-baseball-bat-ball",
      title: "Mejor promedio",
      list: career.filter((p) => p.qualified).sort((a, b) => Number(b.AVG) - Number(a.AVG)),
      valueOf: (p) => p.AVG,
      detailOf: (p) => `${p.H} de ${p.AB}`,
      note: `Mínimo ${minPlateAppearances(games)} turnos (AB + BB) para calificar.`,
    },
    { icon: "fa-baseball-bat-ball", title: "Más hits", list: [...career].sort(byDesc("H")), valueOf: (p) => `${p.H} H`, ok: (p) => p.H > 0 },
    {
      icon: "fa-bomb",
      title: "Más jonrones",
      list: [...career].sort((a, b) => b.HR + b.HRC - (a.HR + a.HRC)),
      valueOf: (p) => `${p.HR + p.HRC} HR`,
      ok: (p) => p.HR + p.HRC > 0,
    },
    { icon: "fa-tornado", title: "Más impulsadas", list: [...career].sort(byDesc("RBI")), valueOf: (p) => `${p.RBI} RBI`, ok: (p) => p.RBI > 0 },
    { icon: "fa-house", title: "Más carreras anotadas", list: [...career].sort(byDesc("R")), valueOf: (p) => `${p.R} C`, ok: (p) => p.R > 0 },
    { icon: "fa-person-running", title: "Más robos", list: [...career].sort(byDesc("SB")), valueOf: (p) => `${p.SB} SB`, ok: (p) => p.SB > 0 },
    {
      icon: "fa-baseball",
      title: "Más entradas lanzadas",
      list: [...careerPit].sort((a, b) => b.outs - a.outs),
      valueOf: (p) => `${p.IP} IP`,
      detailOf: (p) => `${p.W}-${p.L} · ${p.SO} K`,
      ok: (p) => p.outs > 0,
    },
  ]);
}
