// Datos del equipo. Edita este archivo para agregar jugadores y juegos,
// y luego sube (commit + push) los cambios a GitHub.
//
// Formato de entradas pitcheadas (IP): notación de béisbol/softbol,
// donde ".1" = 1 out y ".2" = 2 outs (ej. 4.2 = 4 entradas y 2 outs).

export const TEAM = {
  name: "Caimanes de Villas",
  season: "2026",
  league: "Liga Valle Alto",
  seasonsInLeague: 4, // temporadas jugando en esta liga
  seasonsTotal: 8, // temporadas del equipo en total
  gamesInSeason: 10, // juegos de temporada regular, sin contar playoffs
};

// Roster del equipo.
// number: número de camiseta (null si aún no lo sabes)
// position: posición principal — vacío si aún no la sabes. Códigos válidos:
//   P, C, 1B, 2B, 3B, SS, LF, CF, RF, DH, UTIL,
//   JC (Jugador de Cortesía — solo batea, nunca entra al campo),
//   JD (Jugador Designado — batea, eventualmente puede entrar al campo;
//       normalmente batea en lugar del pitcher).
// Si juega más de una posición, sepáralas con "/" (máximo 3), ej. "2B/SS".
export const PLAYERS = [
  { id: "p1", number: 23, name: "Axel Medina", position: "SS/LF/CF" },
  { id: "p2", number: 7, name: "Carlos Baez", position: "RF" },
  { id: "p3", number: 21, name: "Omar Ramirez", position: "2B/CF/RF" },
  { id: "p4", number: 33, name: "Carlos Borboa", position: "LF/CF/RF" },
  { id: "p5", number: 44, name: "Christopher Felix", position: "2B/SS/CF" },
  { id: "p6", number: 93, name: "Edwyn Pompa", position: "C" },
  { id: "p7", number: 55, name: "Francois Cardenas", position: "RF" },
  { id: "p8", number: 66, name: "Jorge Zazueta", position: "C" },
  { id: "p9", number: 17, name: "Carlos Sepulveda", position: "2B/RF" },
  { id: "p10", number: 4, name: "Enrique Muñoz", position: "3B/LF/CF" },
  { id: "p11", number: 28, name: "Luis Lugo Bastidas", position: "RF" },
  { id: "p12", number: 16, name: "Luis Fernando Lugo", position: "1B" },
  { id: "p13", number: 29, name: "Luis Pompa", position: "C/2B/RF" },
  { id: "p14", number: 10, name: "Ricardo Santoyo", position: "P" },
  { id: "p15", number: 24, name: "Ricardo Hernández", position: "3B/LF/CF" },
  { id: "p16", number: 8, name: "Ruben Perez", position: "P" },
  { id: "p17", number: 23, name: "Teddy Sainz", position: "2B/RF" },
  { id: "p18", number: 26, name: "Javier Urquiza", position: "SS/LF/RF" },
  { id: "p19", number: 2, name: "Xico Espinoza", position: "C/3B/SS" },
];

// Un objeto por juego jugado. Cada línea de bateo/pitcheo/fildeo se
// referencia al jugador con playerId (usa los id de arriba, ej. "p1").
// Si un jugador no participó en algo (ej. no pitcheó ese juego), simplemente
// no aparece en ese arreglo. En esta liga no hay local/visitante oficial, así
// que se toma como Local a quien cierra bateando (weCloseBatting: true si
// nosotros cerramos bateando = Local; false si cierra el rival = Visitante).
//
// Cada línea de `batting` es también el line-up: `order` es el turno al bat
// (1, 2, 3...) y `position` la posición que jugó ese jugador ESE juego (puede
// cambiar de un juego a otro, por eso no se usa la posición fija del roster).
//
// Criterio de anotación de esta liga: cuando el bateador se embasa por un
// error de fildeo (no por un batazo que el rival no pudo convertir en out
// jugando bien), aquí SÍ se cuenta como hit (H) para el bateador/pitcher,
// a diferencia de la regla oficial de béisbol. El error (E) se sigue
// anotando aparte, normal, en la línea de fildeo del jugador que lo cometió.
//
// El elevado o toque de sacrificio (el bateador sale out a propósito para
// avanzar/anotar a un corredor) NO cuenta como turno al bat (AB), siguiendo
// la regla oficial — aunque sí puede impulsar carrera (RBI) si alguien anota.
//
// `substitutions` es el registro de cambios de jugador durante el juego
// (entra alguien a batear o a jugar campo por otro). No afecta los cálculos
// de stats (esos siempre salen de las líneas en batting/pitching/fielding);
// es solo la bitácora de quién entró por quién, en qué entrada y de qué tipo.
//   inning: entrada en la que ocurrió el cambio
//   type: "bateo" o "campo"
//   playerOut: id del jugador que sale
//   playerIn: id del jugador que entra
//   position: posición que toma el que entra (solo aplica si type es "campo")
//
// export const GAMES = [
//   {
//     id: "g1",
//     date: "2026-03-01",
//     opponent: "Nombre del rival",
//     weCloseBatting: true,
//     scoreUs: 8,
//     scoreThem: 5,
//     batting: [
//       { playerId: "p1", order: 1, position: "SS", AB: 4, H: 2, "2B": 1, "3B": 0, HR: 0, RBI: 2, R: 1, BB: 0, SO: 1, SB: 0 },
//     ],
//     pitching: [
//       { playerId: "p2", IP: 5.0, H: 4, R: 3, ER: 2, BB: 2, SO: 6, HR: 0, decision: "W" },
//     ],
//     fielding: [
//       { playerId: "p1", PO: 3, A: 2, E: 1 },
//     ],
//     substitutions: [
//       { inning: 5, type: "campo", playerOut: "p1", playerIn: "p3", position: "SS" },
//     ],
//     replayUrl: "https://youtube.com/...", // opcional, link al video del juego
//   },
// ];
export const GAMES = [
  {
    id: "g-1",
    date: "2026-06-12",
    opponent: "BNG Agroproductos",
    weCloseBatting: null,
    result: "L", // marcador todavía no capturado
    scoreUs: null,
    scoreThem: null,
    batting: [],
    pitching: [],
    fielding: [],
    substitutions: [],
  },
  {
    id: "g0",
    date: "2026-06-25",
    opponent: "Muñekos",
    weCloseBatting: false,
    scoreUs: 16,
    scoreThem: 17,
    batting: [
      { playerId: "p6", order: 1, position: "C", AB: 2, H: 1, "2B": 0, "3B": 0, HR: 0, RBI: 0, R: 1, BB: 0, SO: 0, SB: 1 },
      { playerId: "p4", order: 2, position: "LF", AB: 4, H: 1, "2B": 0, "3B": 0, HR: 0, RBI: 2, R: 1, BB: 0, SO: 0, SB: 1 },
      { playerId: "p1", order: 3, position: "CF", AB: 4, H: 2, "2B": 2, "3B": 0, HR: 0, RBI: 3, R: 2, BB: 0, SO: 0, SB: 0 },
      { playerId: "p19", order: 4, position: "SS", AB: 4, H: 2, "2B": 0, "3B": 0, HR: 0, RBI: 2, R: 2, BB: 0, SO: 0, SB: 1 },
      { playerId: "p12", order: 5, position: "1B", AB: 4, H: 3, "2B": 2, "3B": 0, HR: 1, RBI: 2, R: 3, BB: 0, SO: 0, SB: 1 },
      { playerId: "p15", order: 6, position: "3B", AB: 4, H: 1, "2B": 1, "3B": 0, HR: 0, RBI: 2, R: 0, BB: 0, SO: 0, SB: 1 },
      { playerId: "p9", order: 7, position: "2B", AB: 4, H: 2, "2B": 0, "3B": 0, HR: 0, RBI: 1, R: 1, BB: 0, SO: 0, SB: 2 },
      { playerId: "p17", order: 8, position: "JD", AB: 4, H: 3, "2B": 0, "3B": 0, HR: 0, RBI: 0, R: 2, BB: 0, SO: 0, SB: 0 },
      { playerId: "p13", order: 9, position: "RF", AB: 3, H: 2, "2B": 0, "3B": 0, HR: 0, RBI: 1, R: 2, BB: 1, SO: 0, SB: 1 },
      { playerId: "p2", order: 10, position: "JC", AB: 4, H: 0, "2B": 0, "3B": 0, HR: 0, RBI: 0, R: 0, BB: 0, SO: 2, SB: 0 },
      { playerId: "p3", order: 1, position: "LF", AB: 2, H: 1, "2B": 0, "3B": 0, HR: 0, RBI: 1, R: 2, BB: 1, SO: 0, SB: 1 },
    ],
    pitching: [
      { playerId: "p14", IP: 4, H: 16, R: 10, ER: 0, BB: 1, SO: 1, HR: 0, decision: "L" },
      { playerId: "p16", IP: 2, H: 10, R: 7, ER: 0, BB: 1, SO: 0, HR: 1, decision: "" },
    ],
    fielding: [
      { playerId: "p6", PO: 0, A: 0, E: 0 },
      { playerId: "p4", PO: 1, A: 0, E: 1 },
      { playerId: "p1", PO: 2, A: 0, E: 0 },
      { playerId: "p19", PO: 0, A: 1, E: 0 },
      { playerId: "p12", PO: 6, A: 0, E: 0 },
      { playerId: "p15", PO: 1, A: 2, E: 2 },
      { playerId: "p9", PO: 1, A: 1, E: 0 },
      { playerId: "p17", PO: 0, A: 0, E: 0 },
      { playerId: "p13", PO: 0, A: 0, E: 1 },
      { playerId: "p2", PO: 0, A: 0, E: 0 },
      { playerId: "p14", PO: 0, A: 1, E: 0 },
      { playerId: "p16", PO: 1, A: 0, E: 0 },
      { playerId: "p3", PO: 1, A: 0, E: 0 },
    ],
    substitutions: [
      { inning: 4, type: "campo", playerOut: "p6", playerIn: "p3", position: "LF" },
    ],
    replayUrl: "https://www.facebook.com/100044345960156/videos/2028259977789373",
  },
  {
    id: "g1",
    date: "2026-07-10",
    opponent: "Bronx",
    weCloseBatting: false,
    scoreUs: 29,
    scoreThem: 15,
    batting: [],
    pitching: [],
    fielding: [],
    substitutions: [],
  },
  {
    id: "g2",
    date: "2026-07-21",
    opponent: "Los Pichichis",
    weCloseBatting: true,
    scoreUs: 17,
    scoreThem: 7,
    batting: [
      { playerId: "p10", order: 1, position: "LF", AB: 5, H: 3, "2B": 1, "3B": 0, HR: 0, RBI: 0, R: 3, BB: 0, SO: 1, SB: 3 },
      { playerId: "p5", order: 2, position: "CF", AB: 5, H: 3, "2B": 0, "3B": 0, HR: 0, RBI: 1, R: 1, BB: 0, SO: 0, SB: 1 },
      { playerId: "p19", order: 3, position: "SS", AB: 4, H: 3, "2B": 1, "3B": 0, HR: 1, RBI: 2, R: 3, BB: 0, SO: 0, SB: 1 },
      { playerId: "p12", order: 4, position: "1B", AB: 4, H: 2, "2B": 1, "3B": 0, HR: 0, RBI: 1, R: 2, BB: 0, SO: 0, SB: 1 },
      { playerId: "p15", order: 5, position: "3B", AB: 3, H: 3, "2B": 1, "3B": 0, HR: 0, RBI: 2, R: 3, BB: 1, SO: 0, SB: 3 },
      { playerId: "p9", order: 6, position: "2B", AB: 4, H: 2, "2B": 2, "3B": 0, HR: 0, RBI: 3, R: 1, BB: 0, SO: 0, SB: 1 },
      { playerId: "p6", order: 7, position: "C", AB: 4, H: 3, "2B": 1, "3B": 0, HR: 0, RBI: 1, R: 2, BB: 0, SO: 0, SB: 1 },
      { playerId: "p14", order: 8, position: "P", AB: 4, H: 2, "2B": 0, "3B": 1, HR: 0, RBI: 2, R: 1, BB: 0, SO: 0, SB: 1 },
      { playerId: "p3", order: 9, position: "RF", AB: 4, H: 1, "2B": 0, "3B": 0, HR: 1, RBI: 1, R: 1, BB: 0, SO: 0, SB: 0 },
    ],
    pitching: [
      { playerId: "p14", IP: 6, H: 15, R: 7, ER: 0, BB: 0, SO: 4, HR: 0, decision: "W" },
    ],
    fielding: [
      { playerId: "p14", PO: 0, A: 0, E: 0 },
      { playerId: "p6", PO: 1, A: 0, E: 0 },
      { playerId: "p12", PO: 4, A: 0, E: 0 },
      { playerId: "p9", PO: 1, A: 0, E: 2 },
      { playerId: "p19", PO: 1, A: 4, E: 2 },
      { playerId: "p15", PO: 3, A: 0, E: 1 },
      { playerId: "p10", PO: 1, A: 0, E: 0 },
      { playerId: "p5", PO: 2, A: 0, E: 0 },
      { playerId: "p3", PO: 1, A: 0, E: 0 },
    ],
    substitutions: [
    ],
    replayUrl: "https://www.facebook.com/100044345960156/videos/1036862952326417",
  },
];

// Próximos juegos (todavía sin jugar, sin marcador).
export const SCHEDULE = [
  { id: "s1", date: "2026-07-28", time: "19:00", opponent: "Tamagochis" },
];
