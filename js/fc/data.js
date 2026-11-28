// =====================================================================
// CAIMANES FC — fútbol. Todo lo que muestra fc.html sale de aquí, igual
// que js/data.js para el softbol. Para capturar: llenar las listas de
// abajo (los ejemplos comentados muestran el formato) y subir el cambio.
// =====================================================================

export const FC_TEAM = {
  name: "Caimanes FC",
  sport: "Fútbol",
  city: "Culiacán",
  // Nombre de la liga y del torneo actual, ej. "Liga Valle Alto" / "Apertura 2026".
  league: "",
  season: "",
  // Escudo del equipo, el archivo tal cual. Si se reemplaza por otro con el
  // mismo nombre, subir el "?v=" — si no, los navegadores siguen mostrando
  // el viejo que tienen guardado. Con null se usaría el escudo provisional
  // en CSS (ver fcLogoHtml en js/fc/ui.js).
  logo: "assets/logo-futbol.png?v=3",
  // Escudo todo en blanco para el header (como la cabeza blanca del caimán en
  // el header del softbol): copia recortada de assets/logos/fc-blanco.png.
  // "?v=2": subir el número si se reemplaza el archivo con el mismo nombre.
  logoWhite: "assets/logos/caimanes-fc-white.png?v=3",
  instagram: "https://www.instagram.com/caimanes.sb/",
};

// Posiciones de fútbol.
export const FC_POSITIONS = {
  POR: "Portero",
  DEF: "Defensa",
  MED: "Medio",
  DEL: "Delantero",
};

// Fotos de perfil del fútbol: personajes de Blue Lock, recortados en
// cuadrado en assets/players/fc/personajes/<personaje>.jpg (los 41 del sitio
// oficial). Son distintas a las del sóftbol a propósito, aunque el jugador
// juegue los dos deportes.
const fcPhoto = (character) => `assets/players/fc/personajes/${character}.jpg`;

// Personajes libres para los jugadores que se vayan agregando, en un orden al
// azar ya fijo: quien entre con `photo: null` toma solo el siguiente libre
// (ver el final de este bloque). Fuera de la lista: ego-jinpachi y
// teieri-anri (no son jugadores; quedan por si hay entrenador o mánager).
const FREE_CHARACTERS = [
  "adam-blake",
  "itoshi-rin",
  "yukimiya-kenyu",
  "wanima-keisuke",
  "isagi-yoichi",
  "wanima-junichi",
  "barou-shouei",
  "nagi-seishiro",
  "tsurugi-zantetsu",
  "chigiri-hyoma",
  "kira-ryosuke",
  "kiyora-jin",
  "itoshi-sae",
  "aryu-jyubei",
  "kurona-ranze",
  "tokimitsu-aoshi",
  "shidou-ryusei",
  "hiori-yo",
  "ohkawa-hibiki",
  "otoya-eita",
  "bachira-meguru",
  "imamura-yudai",
  "gagamaru-gin",
  "nanase-nijiro",
  "pablo-cavazos",
  "dada-silva",
  "sendou-shuto",
  "julien-loki",
];

// Plantilla. `id` único y sin espacios (sale en la URL del perfil).
// `photo`: su personaje (fcPhoto("…")); con null se le asigna solo el
// siguiente de FREE_CHARACTERS. `number` y `position` (POR/DEF/MED/DEL) se
// llenan cuando estén definidos. Los que también juegan sóftbol llevan
// `softbolId` (su id en js/data.js; les da la medalla "Two-Way").
// Opcionales: `captain: true` (medalla "Captain") y `seasons` (cuántas
// temporadas lleva en el equipo).
export const FC_PLAYERS = [
  { id: "carlos-borboa", name: "Carlos Borboa", number: null, position: null, photo: fcPhoto("niko-ikki"), softbolId: "p4" },
  { id: "fernando-olivas", name: "Fernando Olivas", number: null, position: null, photo: fcPhoto("kunigami-rensuke"), softbolId: "p25" },
  { id: "omar-ramirez", name: "Omar Ramirez", number: null, position: null, photo: fcPhoto("igarashi-gurimu"), softbolId: "p3" },
  { id: "edwyn-pompa", name: "Edwyn Pompa", number: null, position: null, photo: fcPhoto("leonardo-luna"), softbolId: "p6" },
  { id: "luis-pompa", name: "Luis Pompa", number: null, position: null, photo: fcPhoto("iemon-okuhito"), softbolId: "p13" },
  { id: "ruben-perez", name: "Ruben Perez", number: null, position: null, photo: fcPhoto("raichi-jingo"), softbolId: "p16" },
  { id: "teddy-sainz", name: "Teddy Sainz", number: null, position: null, photo: fcPhoto("oliver-aiku"), softbolId: "p17" },
  { id: "luis-galaviz", name: "Luis Galaviz", number: null, position: null, photo: fcPhoto("naruhaya-asahi") },
  { id: "luis-nunez", name: "Luis Nuñez", number: null, position: null, photo: fcPhoto("kuon-wataru") },
  { id: "alberto-buelna", name: "Alberto Buelna", number: null, position: null, photo: fcPhoto("mikage-reo") },
  { id: "miguel-vega", name: "Miguel Vega", number: null, position: null, photo: fcPhoto("karasu-tabito") },
  // { id: "juan-perez", name: "Juan Pérez", number: 10, position: "DEL", photo: null },
];

// Jugadores nuevos sin foto: el siguiente personaje libre, sin repetir.
{
  const taken = new Set(FC_PLAYERS.map((p) => p.photo).filter(Boolean));
  const free = FREE_CHARACTERS.map(fcPhoto).filter((f) => !taken.has(f));
  for (const p of FC_PLAYERS) if (!p.photo && free.length) p.photo = free.shift();
}

// Partidos: los ya jugados y los próximos en la misma lista. Uno próximo
// lleva goalsFor/goalsAgainst en null.
//   goals:   un renglón por gol nuestro → { player, assist?, minute? }
//            (player: "og" si fue autogol del rival).
//   cards:   { player, type: "yellow" | "red" }
//   lineup:  ids de quienes jugaron (cuenta para partidos jugados).
//   mvp:     id del jugador del partido (opcional).
export const FC_MATCHES = [
  // {
  //   id: "2026-11-20-rival",
  //   date: "2026-11-20",
  //   time: "20:00",
  //   opponent: "Rival FC",
  //   venue: "Cancha 2",
  //   matchday: 1,
  //   goalsFor: 3,
  //   goalsAgainst: 1,
  //   goals: [{ player: "juan-perez", assist: "pedro-lopez", minute: 12 }],
  //   cards: [{ player: "pedro-lopez", type: "yellow" }],
  //   lineup: ["juan-perez", "pedro-lopez"],
  //   mvp: "juan-perez",
  // },
];

// Patrocinadores (mismo formato que SPONSORS en js/data.js). `url` es
// opcional: sin él, la tarjeta se ve pero no es clicable.
export const FC_SPONSORS = [
  { name: "JRHM.STUDIO", logo: "assets/sponsors/sponsor00.png", url: "https://jrhm.studio/" },
  { name: "Jersey Hub", logo: "assets/sponsors/sponsor002.png", url: "https://www.instagram.com/jerseyhub.cln/" },
];

// Tabla de la liga como la publica la liga. `us: true` marca nuestro renglón.
export const FC_STANDINGS = {
  updated: null, // "2026-11-20"
  teams: [
    // { pos: 1, team: "Caimanes FC", PJ: 5, PG: 4, PE: 1, PP: 0, GF: 18, GC: 6, PTS: 13, us: true },
  ],
};
