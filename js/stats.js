import { PLAYERS, GAMES } from "./data.js";

// ---- helpers de entradas pitcheadas (notación .1 = 1 out, .2 = 2 outs) ----
export function ipToOuts(ip) {
  const whole = Math.floor(ip);
  const frac = Math.round((ip - whole) * 10);
  return whole * 3 + frac;
}

export function outsToIp(outs) {
  const whole = Math.floor(outs / 3);
  const rem = outs % 3;
  return Number(`${whole}.${rem}`);
}

function div(num, den) {
  return den > 0 ? num / den : 0;
}

function fmt3(n) {
  return n.toFixed(3).replace(/^0\./, ".");
}

function emptyBatting() {
  return { G: 0, AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 };
}

function emptyPitching() {
  return { G: 0, outs: 0, H: 0, R: 0, ER: 0, BB: 0, SO: 0, HR: 0, W: 0, L: 0, SV: 0 };
}

function emptyFielding() {
  return { G: 0, PO: 0, A: 0, E: 0 };
}

export function playerName(playerId) {
  return PLAYERS.find((p) => p.id === playerId)?.name ?? playerId;
}

// Apariciones al plato (AB + BB) mínimas por juego del equipo para entrar a
// los líderes de promedio — la misma regla que usan las ligas grandes. Sin un
// mínimo, quien jugó un solo juego de 2-2 encabeza la tabla por encima de
// quien lleva toda la temporada bateando.
export const PA_PER_GAME_TO_QUALIFY = 2.7;

export function minPlateAppearances(games = GAMES) {
  return Math.ceil(games.length * PA_PER_GAME_TO_QUALIFY);
}

export function battingTotals(games = GAMES) {
  const totals = new Map();
  for (const game of games) {
    for (const line of game.batting ?? []) {
      const t = totals.get(line.playerId) ?? emptyBatting();
      t.G += 1;
      t.AB += line.AB ?? 0;
      t.H += line.H ?? 0;
      t["2B"] += line["2B"] ?? 0;
      t["3B"] += line["3B"] ?? 0;
      t.HR += line.HR ?? 0;
      t.HRC += line.HRC ?? 0;
      t.RBI += line.RBI ?? 0;
      t.R += line.R ?? 0;
      t.BB += line.BB ?? 0;
      t.SO += line.SO ?? 0;
      t.SB += line.SB ?? 0;
      totals.set(line.playerId, t);
    }
  }
  const minPA = minPlateAppearances(games);
  return [...totals.entries()].map(([playerId, t]) => {
    const homers = t.HR + t.HRC; // ambos valen 4 bases, aunque se lideran por separado
    const singles = t.H - t["2B"] - t["3B"] - homers;
    const TB = singles + 2 * t["2B"] + 3 * t["3B"] + 4 * homers;
    const PA = t.AB + t.BB;
    const AVG = div(t.H, t.AB);
    const OBP = div(t.H + t.BB, t.AB + t.BB);
    const SLG = div(TB, t.AB);
    return {
      playerId,
      name: playerName(playerId),
      ...t,
      PA,
      qualified: PA >= minPA,
      AVG: fmt3(AVG),
      OBP: fmt3(OBP),
      SLG: fmt3(SLG),
      OPS: fmt3(OBP + SLG),
    };
  });
}

// innings por juego usadas para escalar la efectividad (softbol = 7)
export function pitchingTotals(games = GAMES, inningsPerGame = 7) {
  const totals = new Map();
  for (const game of games) {
    for (const line of game.pitching ?? []) {
      const t = totals.get(line.playerId) ?? emptyPitching();
      t.G += 1;
      t.outs += ipToOuts(line.IP ?? 0);
      t.H += line.H ?? 0;
      t.R += line.R ?? 0;
      t.ER += line.ER ?? 0;
      t.BB += line.BB ?? 0;
      t.SO += line.SO ?? 0;
      t.HR += line.HR ?? 0;
      if (line.decision === "W") t.W += 1;
      if (line.decision === "L") t.L += 1;
      if (line.decision === "SV") t.SV += 1;
      totals.set(line.playerId, t);
    }
  }
  return [...totals.entries()].map(([playerId, t]) => {
    const ip = outsToIp(t.outs);
    const ipReal = t.outs / 3;
    const ERA = ipReal > 0 ? (t.ER * inningsPerGame) / ipReal : 0;
    const WHIP = ipReal > 0 ? (t.BB + t.H) / ipReal : 0;
    return {
      playerId,
      name: playerName(playerId),
      ...t,
      IP: ip.toFixed(1),
      ERA: ERA.toFixed(2),
      WHIP: WHIP.toFixed(2),
    };
  });
}

export function fieldingTotals(games = GAMES) {
  const totals = new Map();
  for (const game of games) {
    for (const line of game.fielding ?? []) {
      const t = totals.get(line.playerId) ?? emptyFielding();
      t.G += 1;
      t.PO += line.PO ?? 0;
      t.A += line.A ?? 0;
      t.E += line.E ?? 0;
      totals.set(line.playerId, t);
    }
  }
  return [...totals.entries()].map(([playerId, t]) => {
    const chances = t.PO + t.A + t.E;
    const FPCT = div(t.PO + t.A, chances);
    return {
      playerId,
      name: playerName(playerId),
      ...t,
      FPCT: fmt3(FPCT),
    };
  });
}

// Un juego puede no tener marcador todavía (scoreUs/scoreThem null) si ya
// sabemos si ganamos o perdimos pero no el número exacto; en ese caso se usa
// el campo `result` ("W"/"L"/"T") y no se suma a carreras a favor/en contra.
export function gameResult(g) {
  if (g.scoreUs != null && g.scoreThem != null) {
    if (g.scoreUs > g.scoreThem) return "W";
    if (g.scoreUs < g.scoreThem) return "L";
    return "T";
  }
  return g.result ?? null;
}

// Racha activa: cuántos juegos seguidos (contando desde el más reciente hacia
// atrás) tienen el mismo resultado. null si no hay juegos con resultado.
export function currentStreak(games = GAMES) {
  const known = [...games].filter((g) => gameResult(g) != null).sort((a, b) => a.date.localeCompare(b.date));
  if (known.length === 0) return null;
  const lastResult = gameResult(known[known.length - 1]);
  let count = 0;
  for (let i = known.length - 1; i >= 0; i--) {
    if (gameResult(known[i]) !== lastResult) break;
    count++;
  }
  return { type: lastResult, count };
}

// Cuántos juegos de la temporada jugó cada jugador (aparece en bateo,
// pitcheo o fildeo de ese juego), sin contar dos veces el mismo juego.
export function gamesPlayedByPlayer(games = GAMES) {
  const counts = new Map();
  for (const game of games) {
    const ids = new Set([
      ...(game.batting ?? []).map((l) => l.playerId),
      ...(game.pitching ?? []).map((l) => l.playerId),
      ...(game.fielding ?? []).map((l) => l.playerId),
    ]);
    for (const id of ids) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

export function teamRecord(games = GAMES) {
  let W = 0, L = 0, T = 0, RF = 0, RA = 0;
  for (const g of games) {
    if (g.scoreUs != null && g.scoreThem != null) {
      RF += g.scoreUs;
      RA += g.scoreThem;
    }
    const result = gameResult(g);
    if (result === "W") W += 1;
    else if (result === "L") L += 1;
    else if (result === "T") T += 1;
  }
  return { W, L, T, RF, RA, G: games.length };
}

// Stats del equipo completo (todas las líneas juntas, no por jugador).
export function teamBattingTotals(games = GAMES) {
  let AB = 0, H = 0, B2 = 0, B3 = 0, HR = 0, HRC = 0, RBI = 0, R = 0, BB = 0, SO = 0, SB = 0;
  for (const game of games) {
    for (const line of game.batting ?? []) {
      AB += line.AB ?? 0;
      H += line.H ?? 0;
      B2 += line["2B"] ?? 0;
      B3 += line["3B"] ?? 0;
      HR += line.HR ?? 0;
      HRC += line.HRC ?? 0;
      RBI += line.RBI ?? 0;
      R += line.R ?? 0;
      BB += line.BB ?? 0;
      SO += line.SO ?? 0;
      SB += line.SB ?? 0;
    }
  }
  const homers = HR + HRC;
  const singles = H - B2 - B3 - homers;
  const TB = singles + 2 * B2 + 3 * B3 + 4 * homers;
  const AVG = div(H, AB);
  const OBP = div(H + BB, AB + BB);
  const SLG = div(TB, AB);
  return {
    AB, H, "2B": B2, "3B": B3, HR, HRC, RBI, R, BB, SO, SB,
    AVG: fmt3(AVG), OBP: fmt3(OBP), SLG: fmt3(SLG), OPS: fmt3(OBP + SLG),
  };
}

export function teamPitchingTotals(games = GAMES, inningsPerGame = 7) {
  let outs = 0, H = 0, R = 0, ER = 0, BB = 0, SO = 0, HR = 0;
  for (const game of games) {
    for (const line of game.pitching ?? []) {
      outs += ipToOuts(line.IP ?? 0);
      H += line.H ?? 0;
      R += line.R ?? 0;
      ER += line.ER ?? 0;
      BB += line.BB ?? 0;
      SO += line.SO ?? 0;
      HR += line.HR ?? 0;
    }
  }
  const ipReal = outs / 3;
  const ERA = ipReal > 0 ? (ER * inningsPerGame) / ipReal : 0;
  const WHIP = ipReal > 0 ? (BB + H) / ipReal : 0;
  return { IP: outsToIp(outs).toFixed(1), H, R, ER, BB, SO, HR, ERA: ERA.toFixed(2), WHIP: WHIP.toFixed(2) };
}

export function teamFieldingTotals(games = GAMES) {
  let PO = 0, A = 0, E = 0;
  for (const game of games) {
    for (const line of game.fielding ?? []) {
      PO += line.PO ?? 0;
      A += line.A ?? 0;
      E += line.E ?? 0;
    }
  }
  const chances = PO + A + E;
  return { PO, A, E, FPCT: fmt3(div(PO + A, chances)) };
}
