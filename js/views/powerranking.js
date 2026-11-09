// Power Ranking (a petición expresa): quién viene más fuerte ahora. El
// cálculo vive en powerRanking() de js/stats.js; aquí solo se pinta — la
// lista completa (página Stats > Power Ranking) y el top 5 de la portada
// (powerRankingTopHtml, ver js/views/home.js).
import { PLAYERS, CURRENT_SEASON } from "../data.js";
import { powerRanking, battingTotals, pitchingTotals, POWER_WEIGHTS } from "../stats.js";
import { heading, renderAvatar, escapeHtml, ordinalTemporada } from "../ui.js";
import { openFlyer, shareButton, powerRankingFlyer } from "../flyers.js";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// "vs Gallos: 3 de 4 · 2 triples · 2 impulsadas" — su último juego.
export function lastGameLine(row) {
  const game = row.last?.game;
  if (!game) return "";
  const b = battingTotals([game]).find((r) => r.playerId === row.playerId);
  const p = pitchingTotals([game]).find((r) => r.playerId === row.playerId && r.outs > 0);
  const parts = [
    p ? plural(p.IP, "entrada", "entradas") : "",
    p?.W ? "victoria" : "",
    b && b.AB + b.BB > 0 ? `${b.H} de ${b.AB}` : "",
    b && b.HR + b.HRC ? plural(b.HR + b.HRC, "HR", "HR") : "",
    b?.["3B"] ? plural(b["3B"], "triple", "triples") : "",
    b?.["2B"] ? plural(b["2B"], "doble", "dobles") : "",
    b?.RBI ? plural(b.RBI, "impulsada", "impulsadas") : "",
    b?.SB ? plural(b.SB, "robada", "robadas") : "",
  ]
    .filter(Boolean)
    .slice(0, 4);
  return `vs ${game.opponent ?? "Rival"}${parts.length ? `: ${parts.join(" · ")}` : ""}`;
}

// Flecha de movimiento contra el ranking del juego anterior.
export function moveHtml(row) {
  if (row.move == null) return '<span class="pr-move pr-move--new">Nuevo</span>';
  if (row.move > 0) return `<span class="pr-move pr-move--up" title="Subió ${row.move}"><i class="fa-solid fa-caret-up"></i>${row.move}</span>`;
  if (row.move < 0) return `<span class="pr-move pr-move--down" title="Bajó ${-row.move}"><i class="fa-solid fa-caret-down"></i>${-row.move}</span>`;
  return '<span class="pr-move pr-move--same" title="Sin cambio">=</span>';
}

function playerOf(row) {
  return PLAYERS.find((p) => p.id === row.playerId) ?? { id: row.playerId, name: row.name };
}

function rowHtml(row) {
  const player = playerOf(row);
  return `
    <a class="pr-row${row.rank <= 3 ? ` pr-row--top pr-row--${row.rank}` : ""}" href="#/jugador/${row.playerId}">
      <span class="pr-rank">${row.rank}</span>
      ${moveHtml(row)}
      <span class="pr-photo">${renderAvatar(player, 56)}</span>
      <span class="pr-who">
        <span class="pr-name">${escapeHtml(row.name)}</span>
        <span class="pr-line">${escapeHtml(lastGameLine(row))}</span>
      </span>
      <span class="pr-score">
        <b>${row.score}</b>
        <span class="pr-bar"><span style="width:${row.score}%"></span></span>
      </span>
    </a>`;
}

// Top 5 compacto para la portada.
export function powerRankingTopHtml() {
  const { rows } = powerRanking();
  if (!rows.length) return "";
  return `
    <div class="pr-list pr-list--compact">${rows.slice(0, 5).map(rowHtml).join("")}</div>
    <a class="home-btn home-btn--ghost home-center" href="#/power-ranking">Ver ranking completo →</a>`;
}

export function renderPowerRanking(container) {
  heading(container, "Power Ranking");
  const { rows, gamesCount, early } = powerRanking();

  const meta = document.createElement("p");
  meta.className = "pr-meta";
  meta.innerHTML = `${ordinalTemporada(CURRENT_SEASON)} Temporada · después de ${plural(gamesCount, "juego", "juegos")}${
    early ? ' <span class="pr-early">Temporada temprana: el ranking se mueve mucho</span>' : ""
  }`;
  container.appendChild(meta);

  // Compartir el top 5 como imagen (ver powerRankingFlyer en js/flyers.js).
  if (rows.length) {
    const seasonLabel = `${ordinalTemporada(CURRENT_SEASON)} Temporada`;
    const shareRow = document.createElement("div");
    shareRow.className = "share-flyer-row";
    shareRow.appendChild(
      shareButton(() =>
        openFlyer(
          (format, color) =>
            powerRankingFlyer(
              { seasonLabel, gamesCount, early, rows: rows.map((r) => ({ ...r, line: lastGameLine(r) })) },
              format,
              color
            ),
          `power-ranking-temporada-${CURRENT_SEASON}-juego-${gamesCount}`,
          `Power Ranking de la ${seasonLabel} — Caimanes de Villas`
        )
      )
    );
    container.appendChild(shareRow);
  }

  const list = document.createElement("div");
  list.className = "pr-list";
  list.innerHTML = rows.length
    ? rows.map(rowHtml).join("")
    : '<p class="subtitle">Todavía no hay juegos esta temporada. El caimán está calentando.</p>';
  container.appendChild(list);

  // Cómo se calcula — plegado, para quien tenga curiosidad.
  const how = document.createElement("details");
  how.className = "pr-how";
  const pct = (n) => `${Math.round(n * 100)}%`;
  how.innerHTML = `
    <summary>¿Cómo se calcula?</summary>
    <p>Cada juego suma puntos por lo que hizo cada jugador:</p>
    <ul>
      <li><b>Bateo:</b> hit +1, doble +1 extra, triple +2 extra, HR +3 extra, impulsada +1, carrera, robada o base por bolas +0.5, ponche −0.5.</li>
      <li><b>Fildeo:</b> out hecho +0.15, asistencia +0.25, error −0.5.</li>
      <li><b>Pitcheo:</b> +0.5 por entrada, victoria +2, salvamento +1, carrera limpia permitida −0.5.</li>
      <li><b>MVP del juego:</b> +2.</li>
    </ul>
    <p>La puntuación (0 a 100) es <b>${pct(POWER_WEIGHTS.form)}</b> forma reciente (sus últimos 4 juegos, el más reciente pesa más), <b>${pct(
      POWER_WEIGHTS.season
    )}</b> su promedio de toda la temporada y <b>${pct(POWER_WEIGHTS.attendance)}</b> asistencia. Entran todos los que han jugado; quien lleva menos de la mitad de los juegos recibe un 20% de descuento. La flecha compara contra el ranking antes del último juego.</p>`;
  container.appendChild(how);
}
