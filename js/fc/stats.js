// Cálculos de CAIMANES FC a partir de js/fc/data.js.
import { FC_PLAYERS, FC_MATCHES } from "./data.js";

// "2026-11-17" de hoy en la hora local (no UTC).
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const isPlayed = (m) => m.goalsFor != null && m.goalsAgainst != null;

export function matchResult(m) {
  if (!isPlayed(m)) return null;
  return m.goalsFor > m.goalsAgainst ? "W" : m.goalsFor < m.goalsAgainst ? "L" : "T";
}

export function playedMatches() {
  return FC_MATCHES.filter(isPlayed).sort((a, b) => b.date.localeCompare(a.date));
}

export function upcomingMatches() {
  const today = localToday();
  return FC_MATCHES.filter((m) => !isPlayed(m) && m.date >= today).sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")
  );
}

export function findMatch(id) {
  return FC_MATCHES.find((m) => m.id === id) ?? null;
}

export function findPlayer(id) {
  return FC_PLAYERS.find((p) => p.id === id) ?? null;
}

export function playerName(id) {
  if (id === "og") return "Autogol";
  return findPlayer(id)?.name ?? id ?? "";
}

// Récord del equipo: PJ, G, E, P, GF, GC, DIF, PTS (3 por victoria, 1 por empate).
export function teamRecord(matches = playedMatches()) {
  const r = { PJ: 0, G: 0, E: 0, P: 0, GF: 0, GC: 0 };
  for (const m of matches) {
    if (!isPlayed(m)) continue;
    r.PJ++;
    r.GF += m.goalsFor;
    r.GC += m.goalsAgainst;
    const res = matchResult(m);
    if (res === "W") r.G++;
    else if (res === "L") r.P++;
    else r.E++;
  }
  r.DIF = r.GF - r.GC;
  r.PTS = r.G * 3 + r.E;
  r.cleanSheets = matches.filter((m) => isPlayed(m) && m.goalsAgainst === 0).length;
  return r;
}

// Números por jugador: PJ, goles, asistencias, tarjetas, MVPs y (porteros)
// porterías en cero.
export function playerStats(matches = playedMatches()) {
  const rows = new Map(
    FC_PLAYERS.map((p) => [
      p.id,
      { playerId: p.id, name: p.name, number: p.number, position: p.position, PJ: 0, G: 0, A: 0, TA: 0, TR: 0, MVP: 0, CS: 0 },
    ])
  );
  const row = (id) => rows.get(id);
  for (const m of matches) {
    if (!isPlayed(m)) continue;
    const appeared = new Set(m.lineup ?? []);
    for (const g of m.goals ?? []) {
      if (g.player && g.player !== "og") appeared.add(g.player);
      if (g.assist) appeared.add(g.assist);
    }
    for (const c of m.cards ?? []) appeared.add(c.player);
    for (const id of appeared) {
      const r = row(id);
      if (!r) continue;
      r.PJ++;
      if (m.goalsAgainst === 0 && r.position === "POR") r.CS++;
    }
    for (const g of m.goals ?? []) {
      if (row(g.player)) row(g.player).G++;
      if (g.assist && row(g.assist)) row(g.assist).A++;
    }
    for (const c of m.cards ?? []) {
      const r = row(c.player);
      if (!r) continue;
      if (c.type === "red") r.TR++;
      else r.TA++;
    }
    if (m.mvp && row(m.mvp)) row(m.mvp).MVP++;
  }
  return [...rows.values()];
}

// Top N por una llave (G, A, MVP...), sin los que traen 0.
export function leaders(key, n = 5, matches) {
  return playerStats(matches)
    .filter((r) => r[key] > 0)
    .sort((a, b) => b[key] - a[key] || a.PJ - b.PJ || a.name.localeCompare(b.name))
    .slice(0, n);
}

// Partidos en los que apareció un jugador (para su perfil).
export function matchesOfPlayer(id) {
  return playedMatches().filter(
    (m) =>
      (m.lineup ?? []).includes(id) ||
      (m.goals ?? []).some((g) => g.player === id || g.assist === id) ||
      (m.cards ?? []).some((c) => c.player === id)
  );
}
