// Medallas de Caimanes FC — las mismas categorías y colores que el medallero
// del sóftbol (ver renderAchievements en js/views/jugador.js y
// .achievement-medal--* en css/styles.css), pero con logros de fútbol.
//
// A diferencia del sóftbol, aquí el catálogo y el cálculo viven JUNTOS: cada
// medalla trae su `check(ctx)`, así la guía (#/medallas) y el medallero del
// perfil nunca se desincronizan. `check` regresa null si no la tiene, o
// { label?, desc } si sí (label cambia solo en las de oro/plata/bronce).
// Todo sale de js/fc/data.js; no depende de sesión.
import { FC_PLAYERS, FC_MATCHES } from "./data.js";
import { isPlayed, playerStats, localToday } from "./stats.js";
import { escapeHtml } from "../ui.js";

// Mismo orden de categorías que el sóftbol (KIND_ORDER en js/views/jugador.js).
const KIND_ORDER = ["trajectory", "streak", "gold", "silver", "bronze", "ice", "neg-gold", "neg-silver", "neg-bronze", "threshold", "participation"];
const PODIUM_KIND = { 1: "gold", 2: "silver", 3: "bronze" };
const NEG_PODIUM_KIND = { 1: "neg-gold", 2: "neg-silver", 3: "neg-bronze" };
const METAL = { 1: "Golden", 2: "Silver", 3: "Bronze" };

// Partidos jugados, del más viejo al más reciente.
function playedAsc() {
  return FC_MATCHES.filter(isPlayed).sort((a, b) => a.date.localeCompare(b.date));
}

// Quién jugó un partido: alineación + quien anotó, asistió o vio tarjeta.
function appearedIn(m) {
  const ids = new Set(m.lineup ?? []);
  for (const g of m.goals ?? []) {
    if (g.player && g.player !== "og") ids.add(g.player);
    if (g.assist) ids.add(g.assist);
  }
  for (const c of m.cards ?? []) ids.add(c.player);
  return ids;
}

const goalsIn = (m, id) => (m.goals ?? []).filter((g) => g.player === id).length;
const assistsIn = (m, id) => (m.goals ?? []).filter((g) => g.assist === id).length;

// Racha (activa y más larga) de partidos JUGADOS seguidos que cumplen
// `qualifies(m)`; los partidos en que no jugó no cortan ni suman.
function streaks(matches, id, qualifies) {
  let current = 0;
  let longest = 0;
  for (const m of matches) {
    if (!appearedIn(m).has(id)) continue;
    current = qualifies(m) ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return { current, longest };
}

// Racha de partidos jugados seguidos (aquí un partido sin jugar SÍ la corta).
function attendanceStreak(matches, id) {
  let current = 0;
  let longest = 0;
  for (const m of matches) {
    current = appearedIn(m).has(id) ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

// Lugar en el equipo (1 = el que más) — empates comparten lugar. null si su
// valor es 0 (no cuenta para el podio).
function placeOf(rows, id, key) {
  const mine = rows.find((r) => r.playerId === id)?.[key] ?? 0;
  if (mine <= 0) return null;
  return 1 + rows.filter((r) => r[key] > mine).length;
}

function podium(ctx, key, { label, desc, negative, onlyKeepers }) {
  const rows = onlyKeepers ? ctx.stats.filter((r) => r.position === "POR") : ctx.stats;
  const place = placeOf(rows, ctx.player.id, key);
  if (!place || place > 3) return null;
  const value = rows.find((r) => r.playerId === ctx.player.id)[key];
  return {
    kind: (negative ? NEG_PODIUM_KIND : PODIUM_KIND)[place],
    label: typeof label === "function" ? label(place) : label,
    desc: desc(value, place),
  };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const FC_MEDALS = [
  // ---- Trayectoria ----
  {
    kind: "trajectory", icon: "fa-solid fa-egg", name: "Caimaneggs",
    how: "Estuvo en el equipo desde la primera temporada.",
    check: ({ player }) => ((player.firstSeason ?? 1) === 1 ? { desc: "Está en Caimanes FC desde la primera temporada." } : null),
  },
  {
    kind: "trajectory", icon: "fa-solid fa-baseball-bat-ball", name: "Two-Way",
    how: "También juega sóftbol con Caimanes de Villas.",
    check: ({ player }) => (player.softbolId ? { desc: "Juega fútbol y sóftbol con los Caimanes." } : null),
  },
  {
    kind: "trajectory", icon: "fa-solid fa-copyright", name: "Captain",
    how: "Capitán del equipo.",
    check: ({ player }) => (player.captain ? { desc: "Capitán de Caimanes FC." } : null),
  },
  {
    kind: "trajectory", icon: "fa-solid fa-anchor", name: "Veteran",
    how: "Ha jugado más de 4 temporadas con el equipo.",
    check: ({ player }) => ((player.seasons ?? 1) > 4 ? { desc: `${player.seasons} temporadas con el equipo.` } : null),
  },
  // ---- Racha ----
  {
    kind: "streak", icon: "fa-solid fa-fire", name: "On Fire",
    how: "Racha activa de 2 o más partidos seguidos anotando gol.",
    check: ({ matches, player }) => {
      const s = streaks(matches, player.id, (m) => goalsIn(m, player.id) > 0);
      return s.current >= 2 ? { desc: `Racha activa de ${s.current} partidos seguidos con gol.` } : null;
    },
  },
  {
    kind: "streak", icon: "fa-solid fa-bolt", name: "The Streak",
    how: "Su racha más larga de la temporada fue de más de 3 partidos seguidos con gol (siga activa o no).",
    check: ({ matches, player }) => {
      const s = streaks(matches, player.id, (m) => goalsIn(m, player.id) > 0);
      return s.longest > 3 ? { desc: `Su racha más larga fue de ${s.longest} partidos seguidos con gol.` } : null;
    },
  },
  {
    kind: "streak", icon: "fa-solid fa-link", name: "Ironman",
    how: "Su racha más larga de la temporada fue de más de 5 partidos seguidos jugados.",
    check: ({ matches, player }) => {
      const n = attendanceStreak(matches, player.id);
      return n > 5 ? { desc: `Jugó ${n} partidos seguidos.` } : null;
    },
  },
  // ---- Podio del equipo (oro/plata/bronce, según el lugar) ----
  {
    kind: "gold", icon: "fa-solid fa-shoe-prints", name: "Golden / Silver / Bronze Boot",
    how: "Top 3 del equipo en goles esta temporada.",
    match: (l) => l.endsWith(" Boot"),
    check: (ctx) => podium(ctx, "G", { label: (p) => `${METAL[p]} Boot`, desc: (v, p) => `${p}° lugar del equipo en goles (${v}).` }),
  },
  {
    kind: "gold", icon: "fa-solid fa-wand-magic-sparkles", name: "Playmaker",
    how: "Top 3 del equipo en asistencias esta temporada.",
    check: (ctx) => podium(ctx, "A", { label: "Playmaker", desc: (v, p) => `${p}° lugar del equipo en asistencias (${v}).` }),
  },
  {
    kind: "gold", icon: "fa-solid fa-tornado", name: "Tornado",
    how: "Top 3 del equipo en goles + asistencias esta temporada.",
    check: (ctx) => podium(ctx, "GA", { label: "Tornado", desc: (v, p) => `${p}° lugar del equipo en goles + asistencias (${v}).` }),
  },
  {
    kind: "gold", icon: "fa-solid fa-star", name: "Starboy",
    how: "Top 3 del equipo en premios de jugador del partido esta temporada.",
    check: (ctx) => podium(ctx, "MVP", { label: "Starboy", desc: (v, p) => `${p}° lugar del equipo en jugador del partido (${plural(v, "vez", "veces")}).` }),
  },
  {
    kind: "gold", icon: "fa-solid fa-hand", name: "Golden / Silver / Bronze Glove",
    how: "Top 3 de los porteros en porterías en cero esta temporada.",
    match: (l) => l.endsWith(" Glove"),
    check: (ctx) => podium(ctx, "CS", { onlyKeepers: true, label: (p) => `${METAL[p]} Glove`, desc: (v, p) => `${p}° lugar en porterías en cero (${v}).` }),
  },
  {
    kind: "gold", icon: "fa-solid fa-person-running", name: "Workhorse",
    how: "Top 3 del equipo en partidos jugados esta temporada.",
    check: (ctx) => podium(ctx, "PJ", { label: "Workhorse", desc: (v, p) => `${p}° lugar del equipo en partidos jugados (${v}).` }),
  },
  // ---- Podio negativo (ser el #1 es un chiste) ----
  {
    kind: "ice", icon: "fa-solid fa-snowflake", name: "Ice Cold",
    how: "Delantero con racha activa de 3 o más partidos seguidos sin anotar.",
    check: ({ matches, player }) => {
      if (player.position !== "DEL") return null;
      const s = streaks(matches, player.id, (m) => goalsIn(m, player.id) === 0);
      return s.current >= 3 ? { desc: `Lleva ${s.current} partidos seguidos sin anotar.` } : null;
    },
  },
  {
    kind: "neg-gold", icon: "fa-solid fa-face-angry", name: "Hot Head",
    how: "Top 3 del equipo en tarjetas (amarillas + rojas) esta temporada.",
    check: (ctx) => podium(ctx, "cards", { negative: true, label: "Hot Head", desc: (v, p) => `${p}° lugar del equipo en tarjetas (${v}).` }),
  },
  {
    kind: "neg-gold", icon: "fa-solid fa-square", name: "Red Card",
    how: "Lo expulsaron (tarjeta roja) en algún partido de la temporada.",
    check: ({ stats, player }) => {
      const r = stats.find((x) => x.playerId === player.id);
      return r?.TR ? { desc: `Expulsado ${plural(r.TR, "vez", "veces")} esta temporada.` } : null;
    },
  },
  // ---- Marca fija ----
  {
    kind: "threshold", icon: "fa-solid fa-futbol", name: "Brace",
    how: "Anotó 2 o más goles en un mismo partido.",
    check: ({ matches, player }) => {
      const n = matches.filter((m) => goalsIn(m, player.id) >= 2).length;
      return n ? { desc: `Doblete (o más) en ${plural(n, "partido", "partidos")}.` } : null;
    },
  },
  {
    kind: "threshold", icon: "fa-solid fa-hat-cowboy", name: "Hat-trick",
    how: "Anotó 3 o más goles en un mismo partido.",
    check: ({ matches, player }) => {
      const n = matches.filter((m) => goalsIn(m, player.id) >= 3).length;
      return n ? { desc: `Hat-trick en ${plural(n, "partido", "partidos")}.` } : null;
    },
  },
  {
    kind: "threshold", icon: "fa-solid fa-handshake-angle", name: "Maestro",
    how: "Dio 3 o más asistencias en un mismo partido.",
    check: ({ matches, player }) => (matches.some((m) => assistsIn(m, player.id) >= 3) ? { desc: "3 o más asistencias en un partido." } : null),
  },
  {
    kind: "threshold", icon: "fa-solid fa-shield-halved", name: "The Wall",
    how: "Portero con 3 o más porterías en cero esta temporada.",
    check: ({ stats, player }) => {
      const r = stats.find((x) => x.playerId === player.id);
      return player.position === "POR" && r?.CS >= 3 ? { desc: `${r.CS} porterías en cero esta temporada.` } : null;
    },
  },
  {
    kind: "threshold", icon: "fa-solid fa-droplet", name: "First Blood",
    how: "Anotó gol en su primer partido con el equipo.",
    check: ({ matches, player }) => {
      const first = matches.find((m) => appearedIn(m).has(player.id));
      return first && goalsIn(first, player.id) > 0 ? { desc: `Anotó en su debut, vs ${first.opponent ?? "el rival"}.` } : null;
    },
  },
  // ---- Participación ----
  {
    kind: "participation", icon: "fa-solid fa-calendar-check", name: "It's a date!",
    how: "Jugó todos los partidos de la temporada (con al menos 3 jugados).",
    check: ({ matches, stats, player }) => {
      const r = stats.find((x) => x.playerId === player.id);
      return matches.length >= 3 && r?.PJ === matches.length ? { desc: `Jugó los ${matches.length} partidos de la temporada.` } : null;
    },
  },
  {
    kind: "participation", icon: "fa-solid fa-hand", name: "High Five!",
    how: "Jugó más de 5 partidos esta temporada.",
    check: ({ stats, player }) => {
      const r = stats.find((x) => x.playerId === player.id);
      return r?.PJ > 5 ? { desc: `${r.PJ} partidos jugados esta temporada.` } : null;
    },
  },
];

export const FC_TOTAL_MEDALS = FC_MEDALS.length;

// Datos que comparten todas las condiciones (se calculan una sola vez).
function context(player) {
  const stats = playerStats().map((r) => ({ ...r, GA: r.G + r.A, cards: r.TA + r.TR }));
  return { player, matches: playedAsc(), stats, today: localToday() };
}

// Medallas que tiene un jugador: [{ icon, label, kind, desc, name }].
export function fcMedalsFor(player) {
  const ctx = context(player);
  const chips = [];
  for (const m of FC_MEDALS) {
    const got = m.check(ctx);
    if (got) chips.push({ icon: m.icon, name: m.name, label: got.label ?? m.name, kind: got.kind ?? m.kind, desc: got.desc });
  }
  return chips.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

// ¿Tiene esta medalla del catálogo? (para la guía)
export function hasMedal(chips, medal) {
  return chips.some((c) => (medal.match ? medal.match(c.label) : c.name === medal.name));
}

// Misma pieza visual que el sóftbol (achievementMedalHtml en js/views/jugador.js).
export function medalHtml(c) {
  return `
    <div class="achievement-medal achievement-medal--${c.kind}" data-tooltip="${escapeHtml(c.desc)}" tabindex="0">
      <div class="achievement-medal-icon"><i class="${c.icon}"></i></div>
      <span class="achievement-medal-label">${escapeHtml(c.label)}</span>
    </div>`;
}

export function findFcPlayer(id) {
  return FC_PLAYERS.find((p) => p.id === id) ?? null;
}
