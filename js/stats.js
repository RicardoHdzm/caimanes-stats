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
  return { G: 0, AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, GO: 0, FO: 0, LO: 0, SB: 0 };
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
// los líderes de promedio. Sin un mínimo, quien jugó un solo juego de 2-2
// encabeza la tabla por encima de quien lleva toda la temporada bateando.
// La regla real de las ligas grandes es 3.1 por juego, pero es para partidos
// de 9 entradas — aquí se juega a 7, así que se escala por esa proporción:
// 3.1 × (7/9) ≈ 2.4.
export const PA_PER_GAME_TO_QUALIFY = 2.4;

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
      t.GO += line.GO ?? 0;
      t.FO += line.FO ?? 0;
      t.LO += line.LO ?? 0;
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
    // Outs totales al bat, por tipo: ponche (SO) + rodado/elevado/línea
    // (GO/FO/LO) — no es lo mismo que "AB - H" (eso ignora bases por error,
    // toque de sacrificio, etc.), es la cuenta real de lo que se capturó.
    const OUTS = t.SO + t.GO + t.FO + t.LO;
    return {
      playerId,
      name: playerName(playerId),
      ...t,
      PA,
      OUTS,
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
// En qué lugar del equipo va un jugador en una estadística, dentro de una
// lista ya calculada (battingTotals/pitchingTotals/fieldingTotals). Usado
// en su propio perfil para mostrarle su posición entre sus compañeros (ver
// js/views/jugador.js) — nunca en el de alguien más, así cada quien solo ve
// la suya. `dir` "desc" = más alto es mejor (default, ej. HR); "asc" = más
// bajo es mejor (ej. ERA, errores). Empates comparten lugar (1, 2, 2, 4...).
// null si el jugador no está en la lista o si es el único (un "#1 de 1" no
// dice nada).
export function rankAmong(list, playerId, key, dir = "desc") {
  if (list.length <= 1) return null;
  const mine = list.find((row) => row.playerId === playerId);
  if (!mine) return null;
  const myValue = Number(mine[key]);
  const isBetter = dir === "asc" ? (v) => v < myValue : (v) => v > myValue;
  const place = list.filter((row) => isBetter(Number(row[key]))).length + 1;
  return { place, of: list.length };
}

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

// Racha de juegos SEGUIDOS jugados (medalla "Ironman", ver js/views/
// jugador.js) — a diferencia de hitStreaks(), aquí no hay "juego sin turnos
// que no cuenta ni a favor ni en contra": CADA juego de la temporada es un
// checkpoint (apareció en bateo/pitcheo/fildeo, o no), así que faltar a uno
// corta la racha aunque haya jugado antes y después.
export function attendanceStreaks(games = GAMES) {
  const ordered = [...games].sort((a, b) => a.date.localeCompare(b.date));
  const gameRosters = ordered.map(
    (game) =>
      new Set([
        ...(game.batting ?? []).map((l) => l.playerId),
        ...(game.pitching ?? []).map((l) => l.playerId),
        ...(game.fielding ?? []).map((l) => l.playerId),
      ])
  );
  const result = [];
  for (const player of PLAYERS) {
    let current = 0;
    let longest = 0;
    for (const roster of gameRosters) {
      if (roster.has(player.id)) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
    }
    if (longest > 0) {
      result.push({ playerId: player.id, name: playerName(player.id), longest, current, active: current === longest && current > 0 });
    }
  }
  return result;
}

// ---- récords de temporada ----

// Mejor marca individual en un solo juego. Devuelve TODOS los que empatan en
// la marca, no el primero que se encontró: si dos jugadores tienen el récord,
// los dos lo tienen.
//
// `refine` (opcional) afina el empate quedándose con los de menor valor según
// esa función — ej. a mismos hits, gana quien los hizo en menos turnos. Los
// que sobreviven están empatados de verdad.
function bestInGame(games, listKey, valueFn, refine) {
  let best = 0;
  let entries = [];
  for (const game of games) {
    for (const line of game[listKey] ?? []) {
      const value = valueFn(line);
      if (value <= 0) continue;
      if (value > best) {
        best = value;
        entries = [];
      }
      if (value === best) {
        entries.push({ playerId: line.playerId, name: playerName(line.playerId), line, game });
      }
    }
  }
  if (entries.length === 0) return null;
  if (refine && entries.length > 1) {
    const bestRefined = Math.min(...entries.map(refine));
    entries = entries.filter((e) => refine(e) === bestRefined);
  }
  return { value: best, entries };
}

// 2do/3er lugar de una métrica por juego, para el mismo tipo de tarjeta que
// bestInGame arriba pero excluyendo a quien ya es dueño del récord
// (`excludeIds`). Un jugador aparece una sola vez, con su mejor marca en un
// solo juego (si hizo 3 en un juego y 2 en otro, solo cuenta el de 3) —
// mismo criterio de "un renglón por jugador" que ya usan battingTotals /
// pitchingTotals para los líderes de temporada.
function runnersUpInGame(games, listKey, valueFn, excludeIds, limit = 2) {
  const bestByPlayer = new Map();
  for (const game of games) {
    for (const line of game[listKey] ?? []) {
      const value = valueFn(line);
      if (value <= 0 || excludeIds.has(line.playerId)) continue;
      const current = bestByPlayer.get(line.playerId);
      if (!current || value > current.value) {
        bestByPlayer.set(line.playerId, { playerId: line.playerId, name: playerName(line.playerId), value });
      }
    }
  }
  return [...bestByPlayer.values()].sort((a, b) => b.value - a.value).slice(0, limit);
}

// Todos los que comparten el récord, por nombre: "Fulano, Mengano y Zutano".
// Nadie se queda en un "y N más" — si empataron, aparecen.
function namesLabel(entries) {
  const names = entries.map((e) => e.name);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

// Racha de juegos seguidos con al menos un hit. Solo cuentan los juegos en
// que el jugador tuvo turnos: si no bateó, la racha no se corta ni avanza.
// `active` = la racha sigue viva (llega hasta su último juego con turnos).
export function hitStreaks(games = GAMES) {
  const ordered = [...games].sort((a, b) => a.date.localeCompare(b.date));
  const byPlayer = new Map();

  for (const game of ordered) {
    for (const line of game.batting ?? []) {
      if ((line.AB ?? 0) <= 0) continue;
      const state = byPlayer.get(line.playerId) ?? { current: 0, longest: 0 };
      if ((line.H ?? 0) > 0) {
        state.current += 1;
        state.longest = Math.max(state.longest, state.current);
      } else {
        state.current = 0;
      }
      byPlayer.set(line.playerId, state);
    }
  }

  return [...byPlayer.entries()]
    .filter(([, s]) => s.longest > 0)
    .map(([playerId, s]) => ({
      playerId,
      name: playerName(playerId),
      longest: s.longest,
      current: s.current,
      active: s.current === s.longest && s.current > 0,
    }));
}

// Récords de la temporada, ya formateados para pintarse como tarjetas.
// Solo se incluye `playerId`/`gameId` cuando hay un único dueño del récord;
// con empate la tarjeta no lleva a ningún lado porque no hay a quién
// apuntar, pero `playerIds` sigue trayendo a todos los empatados (sin
// duplicados) para poder mostrar sus fotos aunque no haya un solo dueño —
// vacío en los récords de equipo, que no son de ningún jugador en
// particular. `runnersUp` trae hasta 2 renglones de 2do/3er lugar
// ({ playerId?, name, value }) — sin `playerId` en los récords de equipo,
// donde el 2do/3er lugar es otro juego, no otro jugador.
export function seasonRecords(games = GAMES) {
  const records = [];
  const gameLabel = (g) => `vs ${g.opponent} · ${g.date}`;

  function pushRecord({ icon, label, unit, listKey, valueFn, refine, detailSuffix }) {
    const best = bestInGame(games, listKey, valueFn, refine);
    if (!best) return;
    const solo = best.entries.length === 1 ? best.entries[0] : null;
    const excludeIds = new Set(best.entries.map((e) => e.playerId));
    const runnersUp = runnersUpInGame(games, listKey, valueFn, excludeIds).map((e) => ({
      playerId: e.playerId,
      name: e.name,
      value: `${e.value} ${unit}`,
    }));
    records.push({
      icon,
      label,
      value: `${best.value} ${unit}`,
      detail: namesLabel(best.entries) + (solo && detailSuffix ? detailSuffix(solo) : ""),
      note: solo ? gameLabel(solo.game) : `${best.entries.length} jugadores empatados`,
      playerId: solo?.playerId,
      playerIds: [...excludeIds],
      runnersUp,
    });
  }

  pushRecord({
    icon: "fa-baseball-bat-ball",
    label: "Más hits en un juego",
    unit: "H",
    listKey: "batting",
    valueFn: (l) => l.H ?? 0,
    // A mismos hits, gana quien necesitó menos turnos.
    refine: (e) => e.line.AB ?? 0,
    detailSuffix: (e) => ` — ${e.line.H} de ${e.line.AB ?? 0}`,
  });

  pushRecord({
    icon: "fa-tornado",
    label: "Más impulsadas en un juego",
    unit: "RBI",
    listKey: "batting",
    valueFn: (l) => l.RBI ?? 0,
  });

  pushRecord({
    icon: "fa-bomb",
    label: "Más jonrones en un juego",
    unit: "HR",
    listKey: "batting",
    // Los dos tipos valen lo mismo aquí: cuatro bases es cuatro bases.
    valueFn: (l) => (l.HR ?? 0) + (l.HRC ?? 0),
    detailSuffix: (e) => (e.line.HRC ? ` (${e.line.HRC} de campo)` : ""),
  });

  pushRecord({
    icon: "fa-person-running",
    label: "Más robos en un juego",
    unit: "SB",
    listKey: "batting",
    valueFn: (l) => l.SB ?? 0,
  });

  pushRecord({
    icon: "fa-baseball",
    label: "Más ponches en un juego",
    unit: "K",
    listKey: "pitching",
    valueFn: (l) => l.SO ?? 0,
    detailSuffix: (e) => ` — ${e.line.IP ?? 0} IP`,
  });

  const streaks = hitStreaks(games);
  if (streaks.length > 0) {
    const longest = Math.max(...streaks.map((s) => s.longest));
    const tied = streaks.filter((s) => s.longest === longest);
    const solo = tied.length === 1 ? tied[0] : null;
    const anyActive = tied.some((s) => s.active);
    const runnersUp = streaks
      .filter((s) => s.longest !== longest)
      .sort((a, b) => b.longest - a.longest)
      .slice(0, 2)
      .map((s) => ({ playerId: s.playerId, name: s.name, value: `${s.longest} juego${s.longest === 1 ? "" : "s"}` }));
    records.push({
      icon: "fa-fire",
      label: "Racha de hits más larga",
      value: `${longest} juego${longest === 1 ? "" : "s"}`,
      detail: namesLabel(tied),
      note: solo
        ? solo.active
          ? "Sigue activa"
          : "Ya terminó"
        : `${tied.length} empatados${anyActive ? ", sigue activa" : ""}`,
      playerId: solo?.playerId,
      playerIds: tied.map((s) => s.playerId),
      runnersUp,
    });
  }

  // Récords del equipo, no de un jugador: la mejor marca del marcador en un
  // solo juego. `pick` decide si gana el número más alto o el más bajo.
  // Los juegos sin marcador capturado quedan fuera; si no, un null contaría
  // como cero y sería siempre el mínimo.
  function pushTeamRecord({ icon, label, unit, key, pick }) {
    const scored = games.filter((g) => g[key] != null);
    if (scored.length === 0) return;
    const values = scored.map((g) => g[key]);
    const best = pick === "min" ? Math.min(...values) : Math.max(...values);
    const tied = scored.filter((g) => g[key] === best);
    const solo = tied.length === 1 ? tied[0] : null;
    // Sin jugador que retratar (es un récord de equipo): el 2do/3er lugar
    // es el siguiente mejor/peor juego, no otro jugador.
    const rest = scored
      .filter((g) => g[key] !== best)
      .sort((a, b) => (pick === "min" ? a[key] - b[key] : b[key] - a[key]));
    const runnersUp = rest.slice(0, 2).map((g) => ({ name: `vs ${g.opponent}`, value: `${g[key]} ${unit}` }));
    records.push({
      icon,
      label,
      value: `${best} ${unit}`,
      detail: solo ? `vs ${solo.opponent}` : `${tied.length} juegos empatados`,
      note: solo ? solo.date : tied.map((g) => g.opponent).join(", "),
      gameId: solo?.id,
      runnersUp,
    });
  }

  pushTeamRecord({ icon: "fa-bolt", label: "Más carreras del equipo", unit: "C", key: "scoreUs", pick: "max" });
  pushTeamRecord({ icon: "fa-shield-halved", label: "Menos carreras permitidas", unit: "C", key: "scoreThem", pick: "min" });

  return records;
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
