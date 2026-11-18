// =====================================================================
// CAIMANES FC — fútbol 7. Todo lo que muestra fc.html sale de aquí, igual
// que js/data.js para el softbol. Para capturar: llenar las listas de
// abajo (los ejemplos comentados muestran el formato) y subir el cambio.
// =====================================================================

export const FC_TEAM = {
  name: "Caimanes FC",
  sport: "Fútbol 7",
  city: "Culiacán",
  // Nombre de la liga y del torneo actual, ej. "Liga Valle Alto" / "Apertura 2026".
  league: "",
  season: "",
  // Escudo del equipo: copia recortada (sin el margen transparente) de
  // assets/logo-futbol.png. Con null se usaría el escudo provisional en CSS
  // (ver fcLogoHtml en js/fc/ui.js).
  logo: "assets/logos/caimanes-fc.png",
  instagram: "https://www.instagram.com/caimanes.sb/",
};

// Posiciones de fútbol 7.
export const FC_POSITIONS = {
  POR: "Portero",
  DEF: "Defensa",
  MED: "Medio",
  DEL: "Delantero",
};

// Plantilla. `id` único y sin espacios (sale en la URL del perfil).
// `photo` es opcional; sin foto se muestran las iniciales. `number` y
// `position` (POR/DEF/MED/DEL) se llenan cuando estén definidos.
// Los que también juegan softbol usan la misma foto de assets/players/.
export const FC_PLAYERS = [
  { id: "carlos-borboa", name: "Carlos Borboa", number: null, position: null, photo: "assets/players/p4.jpg" },
  { id: "fernando-olivas", name: "Fernando Olivas", number: null, position: null, photo: "assets/players/p25.jpg" },
  { id: "omar-ramirez", name: "Omar Ramirez", number: null, position: null, photo: "assets/players/p3.jpg" },
  { id: "edwyn-pompa", name: "Edwyn Pompa", number: null, position: null, photo: "assets/players/p6.jpg" },
  { id: "luis-pompa", name: "Luis Pompa", number: null, position: null, photo: "assets/players/p13.jpg" },
  { id: "ruben-perez", name: "Ruben Perez", number: null, position: null, photo: "assets/players/p16.jpg" },
  // { id: "juan-perez", name: "Juan Pérez", number: 10, position: "DEL", photo: null },
];

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
  { name: "JRHM.STUDIO", logo: "assets/sponsors/sponsor00.png" },
];

// Tabla de la liga como la publica la liga. `us: true` marca nuestro renglón.
export const FC_STANDINGS = {
  updated: null, // "2026-11-20"
  teams: [
    // { pos: 1, team: "Caimanes FC", PJ: 5, PG: 4, PE: 1, PP: 0, GF: 18, GC: 6, PTS: 13, us: true },
  ],
};
