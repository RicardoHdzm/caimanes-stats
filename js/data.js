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
  leaguePosition: 5, // lugar actual en la tabla de posiciones (null = aún no lo tienes)
  leagueTeams: 18, // total de equipos en la liga
};

// Roster del equipo.
// number: número de camiseta (null si aún no lo sabes)
// position: posición principal — vacío si aún no la sabes. Códigos válidos:
//   P, C, 1B, 2B, 3B, SS, LF, CF, RF, DH, UTIL,
//   JC (Jugador de Cortesía — solo batea, nunca entra al campo),
//   JD (Jugador Designado — batea, eventualmente puede entrar al campo;
//       normalmente batea en lugar del pitcher).
// Si juega más de una posición, sepáralas con "/" (máximo 3), ej. "2B/SS".
// photo: opcional, ruta o URL a una foto del jugador (ej. "img/players/p1.jpg").
// Si no la tienes, simplemente omite el campo y se muestra un avatar con
// sus iniciales en su lugar.
// walkup: opcional, la canción de entrada (walk-up song) — la que suena
// cuando el jugador va al bat. Se ve en su perfil. Formato:
//   walkup: { title: "Enter Sandman", artist: "Metallica", url: "https://..." }
// `url` es opcional (Spotify, YouTube, Apple Music o lo que sea); si la pones,
// el título se vuelve un link con el icono de esa plataforma. Si no tienes la
// canción de alguien, omite el campo completo y no se muestra nada.
export const PLAYERS = [
  { id: "p1", number: 23, name: "Axel Medina", position: "CF/LF/SS", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p2", number: 7, name: "Carlos Baez", position: "RF/2B/3B", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p3", number: 21, name: "Omar Ramirez", position: "2B/CF/RF", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p4", number: 33, name: "Carlos Borboa", position: "RF/CF/LF", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p5", number: 44, name: "Christopher Felix", position: "2B/CF/SS", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p6", number: 93, name: "Edwyn Pompa", position: "C/LF/CF", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p7", number: 55, name: "Francois Cardenas", position: "RF/CF/2B", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p8", number: 66, name: "Jorge Zazueta", position: "C/3B/1B", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p9", number: 17, name: "Carlos Sepulveda", position: "2B/RF/C", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p10", number: 4, name: "Enrique Muñoz", position: "LF/CF/3B", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p11", number: 28, name: "Luis Lugo Bastidas", position: "RF/CF/2B", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p12", number: 16, name: "Luis Fernando Lugo", position: "1B/2B/3B", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p13", number: 29, name: "Luis Pompa", position: "RF/2B/C", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p14", number: 10, name: "Ricardo Santoyo", position: "P", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p15", number: 24, name: "Ricardo Hernández", position: "3B/LF/CF", walkup: { title: "Goteo", artist: "Duki", url: "https://open.spotify.com/intl-es/track/1EoEU4HY57qaITp06TkC6B" } },
  { id: "p16", number: 8, name: "Ruben Perez", position: "P", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p17", number: 99, name: "Teddy Sainz", position: "RF/2B/3B", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p18", number: 26, name: "Javier Urquiza", position: "SS/LF/RF", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p19", number: 2, name: "Xico Espinoza", position: "C/3B/SS", walkup: { title: "Canción", artist: "Artista" } },
  { id: "p20", number: 0, name: "Andres Aceves", position: "CF/2B/SS", walkup: { title: "Canción", artist: "Artista" } },
];

// Un objeto por juego jugado. Cada línea de bateo/pitcheo/fildeo se
// referencia al jugador con playerId (usa los id de arriba, ej. "p1").
// Si un jugador no participó en algo (ej. no pitcheó ese juego), simplemente
// no aparece en ese arreglo.
//
// `weCloseBatting` NO es una sede: en esta liga no hay local ni visitante,
// todos juegan en el mismo campo. Es solo quién batea al final de cada
// entrada — true si cerramos nosotros, false si cierra el rival, null si
// todavía no se sabe.
//
// Cada línea de `batting` es también el line-up: `order` es el turno al bat
// (1, 2, 3...) y `position` la posición que jugó ese jugador ESE juego (puede
// cambiar de un juego a otro, por eso no se usa la posición fija del roster).
//
// `HR` son los home runs que se van por la barda (home run "puro"). `HRC` son
// los home runs de campo (inside-the-park). Son conteos INDEPENDIENTES, no
// uno subconjunto del otro — un home run es HR o HRC, nunca los dos. El líder
// de home runs se calcula solo con HR; para bases totales (SLG) se suman
// ambos, ya que los dos valen 4 bases.
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
//     id: "g8", // el siguiente consecutivo (hay 7 juegos: g1…g7)
//     date: "2026-03-01",
//     opponent: "Nombre del rival",
//     weCloseBatting: true,
//     scoreUs: 8,
//     scoreThem: 5,
//     batting: [
//       { playerId: "p1", order: 1, position: "SS", AB: 4, H: 2, "2B": 1, "3B": 0, HR: 0, HRC: 0, RBI: 2, R: 1, BB: 0, SO: 1, SB: 0 },
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
//     mvp: "p1", // opcional, id del jugador más destacado del juego
//   },
// ];
export const GAMES = [
  {
    id: "g1",
    date: "2026-06-12",
    opponent: "BNG Agroproductos",
    weCloseBatting: null,
    result: "L", // marcador todavía no capturado
    scoreUs: null,
    scoreThem: null,
    batting: [
      { playerId: "p1", order: 0, position: "", AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p5", order: 0, position: "", AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p18", order: 0, position: "", AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p15", order: 0, position: "", AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p13", order: 0, position: "", AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p19", order: 0, position: "", AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p14", order: 0, position: "", AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p16", order: 0, position: "", AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p6", order: 0, position: "", AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p4", order: 0, position: "", AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p7", order: 0, position: "", AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p2", order: 0, position: "", AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p12", order: 0, position: "", AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
    ],
    pitching: [
      { playerId: "p16", IP: 0, H: 0, R: 0, ER: 0, BB: 0, SO: 0, HR: 0, decision: "" },
      { playerId: "p14", IP: 0, H: 0, R: 0, ER: 0, BB: 0, SO: 0, HR: 0, decision: "" },
    ],
    fielding: [
    ],
    substitutions: [
    ],
  },
  {
    id: "g2",
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
      { playerId: "p12", order: 5, position: "1B", AB: 4, H: 3, "2B": 2, "3B": 0, HR: 1, RBI: 3, R: 3, BB: 0, SO: 0, SB: 1 },
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
    mvp: "p12",
  },
  {
    id: "g3",
    date: "2026-07-10",
    opponent: "Bronx",
    weCloseBatting: false,
    scoreUs: 27,
    scoreThem: 12,
    batting: [
      { playerId: "p10", order: 1, position: "LF", AB: 4, H: 4, "2B": 3, "3B": 0, HR: 0, RBI: 7, R: 3, BB: 0, SO: 0, SB: 1 },
      { playerId: "p18", order: 2, position: "SS", AB: 3, H: 2, "2B": 1, "3B": 0, HR: 0, RBI: 2, R: 2, BB: 0, SO: 0, SB: 1 },
      { playerId: "p5", order: 3, position: "2B", AB: 3, H: 2, "2B": 0, "3B": 0, HR: 0, RBI: 2, R: 0, BB: 0, SO: 0, SB: 1 },
      { playerId: "p19", order: 4, position: "3B", AB: 3, H: 2, "2B": 1, "3B": 0, HR: 0, HRC: 1, RBI: 2, R: 1, BB: 0, SO: 0, SB: 0 },
      { playerId: "p12", order: 5, position: "1B", AB: 3, H: 3, "2B": 2, "3B": 0, HR: 1, RBI: 1, R: 4, BB: 1, SO: 0, SB: 3 },
      { playerId: "p7", order: 6, position: "JD", AB: 2, H: 1, "2B": 1, "3B": 0, HR: 0, RBI: 3, R: 4, BB: 2, SO: 0, SB: 2 },
      { playerId: "p15", order: 7, position: "JC", AB: 3, H: 2, "2B": 1, "3B": 0, HR: 0, RBI: 2, R: 2, BB: 1, SO: 0, SB: 1 },
      { playerId: "p3", order: 8, position: "RF", AB: 2, H: 2, "2B": 0, "3B": 1, HR: 0, RBI: 2, R: 2, BB: 0, SO: 0, SB: 0 },
      { playerId: "p6", order: 9, position: "C", AB: 2, H: 2, "2B": 1, "3B": 0, HR: 0, RBI: 1, R: 4, BB: 2, SO: 0, SB: 1 },
      { playerId: "p4", order: 10, position: "CF", AB: 4, H: 2, "2B": 1, "3B": 0, HR: 0, RBI: 1, R: 2, BB: 0, SO: 0, SB: 0 },
      { playerId: "p1", order: 8, position: "SS", AB: 2, H: 2, "2B": 0, "3B": 0, HR: 0, RBI: 1, R: 2, BB: 0, SO: 0, SB: 1 },
      { playerId: "p2", order: 2, position: "RF", AB: 2, H: 1, "2B": 0, "3B": 0, HR: 0, RBI: 0, R: 0, BB: 0, SO: 1, SB: 0 },
      { playerId: "p9", order: 3, position: "2B", AB: 2, H: 1, "2B": 1, "3B": 0, HR: 0, RBI: 3, R: 1, BB: 0, SO: 0, SB: 0 },
      { playerId: "p17", order: 4, position: "3B", AB: 2, H: 0, "2B": 0, "3B": 0, HR: 0, RBI: 1, R: 0, BB: 0, SO: 0, SB: 0 },
    ],
    pitching: [
      { playerId: "p16", IP: 2, H: 5, R: 5, ER: 0, BB: 1, SO: 1, HR: 0, decision: "SV" },
      { playerId: "p14", IP: 3, H: 10, R: 7, ER: 0, BB: 0, SO: 2, HR: 1, decision: "W" },
    ],
    fielding: [
      { playerId: "p6", PO: 1, A: 0, E: 2 },
      { playerId: "p12", PO: 4, A: 0, E: 1 },
      { playerId: "p5", PO: 1, A: 0, E: 2 },
      { playerId: "p18", PO: 0, A: 0, E: 1 },
      { playerId: "p19", PO: 2, A: 1, E: 0 },
      { playerId: "p10", PO: 0, A: 0, E: 1 },
      { playerId: "p4", PO: 0, A: 0, E: 0 },
      { playerId: "p3", PO: 0, A: 0, E: 0 },
      { playerId: "p16", PO: 0, A: 0, E: 1 },
      { playerId: "p9", PO: 1, A: 1, E: 0 },
      { playerId: "p2", PO: 0, A: 0, E: 0 },
      { playerId: "p14", PO: 0, A: 2, E: 1 },
      { playerId: "p1", PO: 1, A: 2, E: 1 },
    ],
    substitutions: [
      { inning: 3, type: "campo", playerOut: "p5", playerIn: "p9", position: "2B" },
      { inning: 3, type: "campo", playerOut: "p18", playerIn: "p2", position: "RF" },
      { inning: 3, type: "campo", playerOut: "p3", playerIn: "p1", position: "SS" },
    ],
    replayUrl: "https://www.facebook.com/100044345960156/videos/1781320186374782",
    mvp: "p10",
  },
  {
    id: "g4",
    date: "2026-07-21",
    opponent: "Los Pichichis",
    weCloseBatting: true,
    scoreUs: 17,
    scoreThem: 7,
    batting: [
      { playerId: "p10", order: 1, position: "LF", AB: 5, H: 3, "2B": 1, "3B": 0, HR: 0, RBI: 0, R: 3, BB: 0, SO: 1, SB: 3 },
      { playerId: "p5", order: 2, position: "CF", AB: 5, H: 3, "2B": 0, "3B": 0, HR: 0, RBI: 1, R: 1, BB: 0, SO: 0, SB: 1 },
      { playerId: "p19", order: 3, position: "SS", AB: 4, H: 3, "2B": 1, "3B": 0, HR: 0, HRC: 1, RBI: 3, R: 3, BB: 0, SO: 0, SB: 1 },
      { playerId: "p12", order: 4, position: "1B", AB: 4, H: 2, "2B": 1, "3B": 0, HR: 0, RBI: 1, R: 2, BB: 0, SO: 0, SB: 1 },
      { playerId: "p15", order: 5, position: "3B", AB: 3, H: 3, "2B": 1, "3B": 0, HR: 0, RBI: 2, R: 3, BB: 1, SO: 0, SB: 3 },
      { playerId: "p9", order: 6, position: "2B", AB: 4, H: 2, "2B": 2, "3B": 0, HR: 0, RBI: 3, R: 1, BB: 0, SO: 0, SB: 1 },
      { playerId: "p6", order: 7, position: "C", AB: 4, H: 3, "2B": 1, "3B": 0, HR: 0, RBI: 1, R: 2, BB: 0, SO: 0, SB: 1 },
      { playerId: "p14", order: 8, position: "P", AB: 4, H: 2, "2B": 0, "3B": 1, HR: 0, RBI: 2, R: 1, BB: 0, SO: 0, SB: 1 },
      { playerId: "p3", order: 9, position: "RF", AB: 4, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 1, RBI: 2, R: 1, BB: 0, SO: 0, SB: 0 },
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
    mvp: "p14",
  },
    {
    id: "g5",
    date: "2026-07-28",
    opponent: "Tamagochis",
    weCloseBatting: true,
    scoreUs: 17,
    scoreThem: 15,
    batting: [
      { playerId: "p6", order: 1, position: "C", AB: 3, H: 2, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 2, BB: 0, SO: 0, SB: 3 },
      { playerId: "p10", order: 2, position: "LF", AB: 3, H: 2, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 1, R: 1, BB: 0, SO: 0, SB: 2 },
      { playerId: "p5", order: 3, position: "2B", AB: 4, H: 2, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 1, R: 2, BB: 0, SO: 0, SB: 4 },
      { playerId: "p12", order: 4, position: "1B", AB: 4, H: 3, "2B": 0, "3B": 2, HR: 0, HRC: 0, RBI: 2, R: 3, BB: 0, SO: 0, SB: 1 },
      { playerId: "p1", order: 5, position: "CF", AB: 3, H: 3, "2B": 1, "3B": 0, HR: 0, HRC: 0, RBI: 4, R: 2, BB: 0, SO: 0, SB: 2 },
      { playerId: "p18", order: 6, position: "SS", AB: 4, H: 4, "2B": 1, "3B": 0, HR: 0, HRC: 0, RBI: 2, R: 2, BB: 0, SO: 0, SB: 2 },
      { playerId: "p15", order: 7, position: "3B", AB: 4, H: 2, "2B": 2, "3B": 0, HR: 0, HRC: 0, RBI: 4, R: 1, BB: 0, SO: 0, SB: 0 },
      { playerId: "p4", order: 8, position: "JD", AB: 4, H: 3, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 1, BB: 0, SO: 0, SB: 1 },
      { playerId: "p13", order: 9, position: "RF", AB: 4, H: 2, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 1, R: 0, BB: 0, SO: 0, SB: 2 },
      { playerId: "p2", order: 10, position: "JC", AB: 2, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 1, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p9", order: 10, position: "JC", AB: 1, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 1, BB: 0, SO: 0, SB: 1 },
      { playerId: "p8", order: 1, position: "C", AB: 1, H: 1, "2B": 1, "3B": 0, HR: 0, HRC: 0, RBI: 1, R: 1, BB: 0, SO: 0, SB: 0 },
      { playerId: "p3", order: 2, position: "2B", AB: 1, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 1, BB: 0, SO: 0, SB: 1 },
    ],
    pitching: [
      { playerId: "p14", IP: 4, H: 17, R: 9, ER: 0, BB: 0, SO: 0, HR: 1, decision: "W" },
      { playerId: "p16", IP: 2, H: 9, R: 6, ER: 0, BB: 1, SO: 0, HR: 0, decision: "SV" },
    ],
    fielding: [
      { playerId: "p14", PO: 1, A: 1, E: 1 },
      { playerId: "p6", PO: 0, A: 0, E: 0 },
      { playerId: "p12", PO: 4, A: 0, E: 0 },
      { playerId: "p5", PO: 1, A: 0, E: 1 },
      { playerId: "p15", PO: 1, A: 0, E: 0 },
      { playerId: "p18", PO: 2, A: 1, E: 0 },
      { playerId: "p10", PO: 2, A: 1, E: 1 },
      { playerId: "p1", PO: 1, A: 0, E: 1 },
      { playerId: "p13", PO: 0, A: 0, E: 0 },
      { playerId: "p3", PO: 3, A: 0, E: 1 },
      { playerId: "p16", PO: 0, A: 1, E: 0 },
      { playerId: "p4", PO: 0, A: 0, E: 1 },
      { playerId: "p8", PO: 0, A: 0, E: 0 },
    ],
    substitutions: [
      { inning: 5, type: "bateo", playerOut: "p2", playerIn: "p9", position: "JC" },
      { inning: 5, type: "bateo", playerOut: "p6", playerIn: "p8", position: "C" },
      { inning: 5, type: "bateo", playerOut: "p3", playerIn: "p10", position: "2B" },
    ],
    replayUrl: "https://www.facebook.com/100044345960156/videos/1917285122301122",
    mvp: "p14",
  },
  {
    id: "g6",
    date: "2026-08-14",
    opponent: "Jolinos",
    weCloseBatting: true,
    scoreUs: 13,
    scoreThem: 16,
    batting: [
      { playerId: "p6", order: 1, position: "C", AB: 5, H: 3, "2B": 1, "3B": 0, HR: 0, HRC: 0, RBI: 2, R: 2, BB: 0, SO: 0, SB: 2 },
      { playerId: "p7", order: 2, position: "LF", AB: 5, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p5", order: 3, position: "SS", AB: 4, H: 4, "2B": 2, "3B": 0, HR: 1, HRC: 0, RBI: 3, R: 3, BB: 0, SO: 0, SB: 1 },
      { playerId: "p12", order: 4, position: "1B", AB: 3, H: 3, "2B": 0, "3B": 0, HR: 2, HRC: 0, RBI: 5, R: 3, BB: 0, SO: 0, SB: 2 },
      { playerId: "p20", order: 5, position: "JD", AB: 3, H: 2, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 1, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p4", order: 6, position: "CF", AB: 4, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 1 },
      { playerId: "p15", order: 7, position: "3B", AB: 4, H: 2, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 1, BB: 0, SO: 0, SB: 2 },
      { playerId: "p13", order: 8, position: "RF", AB: 4, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 1, BB: 0, SO: 0, SB: 1 },
      { playerId: "p8", order: 9, position: "2B", AB: 1, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 1, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p11", order: 10, position: "JC", AB: 4, H: 3, "2B": 2, "3B": 0, HR: 0, HRC: 0, RBI: 2, R: 1, BB: 0, SO: 0, SB: 0 },
      { playerId: "p17", order: 9, position: "2B", AB: 2, H: 2, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 2, BB: 0, SO: 0, SB: 1 },
    ],
    pitching: [
      { playerId: "p16", IP: 4, H: 7, R: 3, ER: 0, BB: 0, SO: 2, HR: 0, decision: "" },
      { playerId: "p14", IP: 3, H: 14, R: 12, ER: 0, BB: 2, SO: 0, HR: 0, decision: "L" },
      { playerId: "p16", IP: 1, H: 1, R: 1, ER: 0, BB: 0, SO: 0, HR: 0, decision: "" },
    ],
    fielding: [
      { playerId: "p16", PO: 2, A: 0, E: 0 },
      { playerId: "p6", PO: 0, A: 0, E: 0 },
      { playerId: "p12", PO: 5, A: 0, E: 1 },
      { playerId: "p8", PO: 1, A: 0, E: 0 },
      { playerId: "p15", PO: 0, A: 1, E: 1 },
      { playerId: "p5", PO: 0, A: 1, E: 3 },
      { playerId: "p7", PO: 2, A: 0, E: 0 },
      { playerId: "p4", PO: 2, A: 0, E: 2 },
      { playerId: "p13", PO: 2, A: 0, E: 0 },
      { playerId: "p14", PO: 0, A: 0, E: 1 },
      { playerId: "p17", PO: 0, A: 0, E: 2 },
      { playerId: "p20", PO: 0, A: 0, E: 0 },
    ],
    substitutions: [
      { inning: 5, type: "bateo", playerOut: "p8", playerIn: "p17", position: "" },
    ],
    replayUrl: "https://www.facebook.com/100044345960156/videos/1756467548693744/",
    mvp: "p12",
  },
    {
    id: "g7",
    date: "2026-08-20",
    opponent: "Sox",
    weCloseBatting: true,
    scoreUs: 10,
    scoreThem: 9,
    batting: [
      { playerId: "p6", order: 1, position: "C", AB: 4, H: 2, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 1 },
      { playerId: "p10", order: 2, position: "LF", AB: 4, H: 2, "2B": 1, "3B": 1, HR: 0, HRC: 0, RBI: 0, R: 2, BB: 0, SO: 0, SB: 0 },
      { playerId: "p19", order: 3, position: "SS", AB: 4, H: 4, "2B": 2, "3B": 1, HR: 0, HRC: 0, RBI: 2, R: 4, BB: 0, SO: 0, SB: 1 },
      { playerId: "p12", order: 4, position: "1B", AB: 4, H: 2, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 2, R: 0, BB: 0, SO: 1, SB: 0 },
      { playerId: "p7", order: 5, position: "RF", AB: 4, H: 3, "2B": 1, "3B": 0, HR: 0, HRC: 0, RBI: 3, R: 1, BB: 0, SO: 0, SB: 1 },
      { playerId: "p3", order: 6, position: "2B", AB: 3, H: 2, "2B": 2, "3B": 0, HR: 0, HRC: 0, RBI: 1, R: 1, BB: 0, SO: 0, SB: 0 },
      { playerId: "p4", order: 7, position: "CF", AB: 3, H: 2, "2B": 1, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 1, BB: 0, SO: 0, SB: 3 },
      { playerId: "p15", order: 8, position: "3B", AB: 3, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p17", order: 9, position: "JC", AB: 3, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 1, SB: 0 },
      { playerId: "p16", order: 10, position: "JD", AB: 2, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 1, BB: 0, SO: 0, SB: 0 },
      { playerId: "p14", order: 10, position: "JD", AB: 1, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
    ],
    pitching: [
      { playerId: "p14", IP: 5, H: 15, R: 9, ER: 0, BB: 0, SO: 1, HR: 1, decision: "" },
      { playerId: "p16", IP: 2, H: 3, R: 0, ER: 0, BB: 0, SO: 1, HR: 0, decision: "" },
    ],
    fielding: [
      { playerId: "p14", PO: 0, A: 0, E: 0 },
      { playerId: "p6", PO: 1, A: 0, E: 0 },
      { playerId: "p12", PO: 5, A: 1, E: 0 },
      { playerId: "p3", PO: 0, A: 0, E: 1 },
      { playerId: "p15", PO: 2, A: 3, E: 2 },
      { playerId: "p19", PO: 0, A: 3, E: 0 },
      { playerId: "p10", PO: 4, A: 0, E: 0 },
      { playerId: "p4", PO: 3, A: 0, E: 0 },
      { playerId: "p7", PO: 2, A: 0, E: 0 },
      { playerId: "p16", PO: 0, A: 0, E: 0 },
    ],
    substitutions: [
      { inning: 6, type: "bateo", playerOut: "p16", playerIn: "p14", position: "JD" },
    ],
    replayUrl: "https://www.facebook.com/100044345960156/videos/4013545158944159",
    mvp: "p19",
  },
    // Reemplaza el bloque completo del juego "g8" en GAMES por esto:
  {
    id: "g8",
    date: "2026-08-27",
    opponent: "Rockin' Roll",
    weCloseBatting: false,
    scoreUs: 2,
    scoreThem: 17,
    batting: [
      { playerId: "p6", order: 1, position: "C", AB: 2, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p10", order: 2, position: "LF", AB: 2, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 1 },
      { playerId: "p5", order: 3, position: "SS", AB: 2, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p9", order: 4, position: "1B", AB: 1, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p3", order: 5, position: "2B", AB: 2, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 1, BB: 0, SO: 0, SB: 0 },
      { playerId: "p4", order: 6, position: "CF", AB: 2, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 1, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p15", order: 7, position: "3B", AB: 1, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 1, R: 0, BB: 1, SO: 0, SB: 0 },
      { playerId: "p13", order: 8, position: "RF", AB: 2, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p17", order: 9, position: "JD", AB: 2, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p11", order: 10, position: "JC", AB: 1, H: 0, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 0, BB: 0, SO: 0, SB: 0 },
      { playerId: "p12", order: 4, position: "1B", AB: 1, H: 1, "2B": 0, "3B": 0, HR: 0, HRC: 0, RBI: 0, R: 1, BB: 0, SO: 0, SB: 0 },
    ],
    pitching: [
      { playerId: "p14", IP: 3, H: 19, R: 13, ER: 0, BB: 1, SO: 0, HR: 2, decision: "L" },
      { playerId: "p16", IP: 1, H: 5, R: 4, ER: 0, BB: 0, SO: 0, HR: 0, decision: "" },
    ],
    fielding: [
      { playerId: "p14", PO: 0, A: 0, E: 0 },
      { playerId: "p6", PO: 0, A: 0, E: 0 },
      { playerId: "p9", PO: 0, A: 0, E: 1 },
      { playerId: "p3", PO: 4, A: 0, E: 0 },
      { playerId: "p15", PO: 0, A: 1, E: 3 },
      { playerId: "p5", PO: 2, A: 0, E: 0 },
      { playerId: "p10", PO: 1, A: 0, E: 2 },
      { playerId: "p4", PO: 1, A: 0, E: 0 },
      { playerId: "p13", PO: 0, A: 0, E: 0 },
      { playerId: "p12", PO: 0, A: 0, E: 0 },
    ],
    substitutions: [
      { inning: 4, type: "bateo", playerOut: "p9", playerIn: "p12", position: "1B" },
    ],
    replayUrl: "https://www.facebook.com/100044345960156/videos/2716295835456307/",
  },
];

// Próximos juegos (todavía sin jugar, sin marcador).
 export const SCHEDULE = [
   // `time` es opcional: si no lo pones, solo se muestra la fecha.
   // { id: "s1", date: "2026-08-20", time: "19:00", opponent: "Softbol Valle Alto" },
   { id: "s2", date: "2026-09-01", time: "19:00", opponent: "Los Primos" },
];

// Tabla de posiciones de la liga. Se copia tal cual la publica la liga: NO se
// calcula desde GAMES, porque ahí solo están nuestros juegos y aquí van los
// 18 equipos. Hay que actualizarla a mano cada vez que la liga la publique.
//   pos: lugar en la tabla (lo decide la liga, con sus propios criterios de
//        desempate, por eso se guarda y no se recalcula)
//   JJ: juegos jugados · JG: ganados · JE: empatados · JP: perdidos
//   CF: carreras a favor · CC: carreras en contra
//   us: true solo en nuestra fila, para resaltarla. Es una bandera explícita
//       y no una comparación contra TEAM.name a propósito: la liga escribe
//       los nombres a su manera y un cambio de su lado dejaría de marcarnos
//       sin que nada avise.
export const STANDINGS = {
  updated: "2026-08-20", // fecha de corte de esta tabla
  teams: [
    { pos: 1, team: "Ni Parientes Somos", JJ: 6, JG: 6, JE: 0, JP: 0, CF: 46, CC: 34 },
    { pos: 2, team: "Parkers", JJ: 6, JG: 5, JE: 0, JP: 1, CF: 97, CC: 59 },
    { pos: 3, team: "Jolinos", JJ: 7, JG: 5, JE: 0, JP: 2, CF: 68, CC: 64 },
    { pos: 4, team: "Los Camarones", JJ: 6, JG: 4, JE: 0, JP: 2, CF: 68, CC: 45 },
    { pos: 5, team: "Caimanes de Villas", JJ: 7, JG: 4, JE: 0, JP: 3, CF: 105, CC: 81, us: true },
    { pos: 6, team: "Caguamigos", JJ: 4, JG: 3, JE: 0, JP: 1, CF: 42, CC: 27 },
    { pos: 7, team: "Padres de Sandiego", JJ: 6, JG: 3, JE: 0, JP: 3, CF: 65, CC: 53 },
    { pos: 8, team: "Gallos", JJ: 6, JG: 3, JE: 0, JP: 3, CF: 71, CC: 83 },
    { pos: 9, team: "D Backs", JJ: 4, JG: 2, JE: 0, JP: 2, CF: 33, CC: 47 },
    { pos: 10, team: "Rockin Roll", JJ: 6, JG: 2, JE: 0, JP: 4, CF: 60, CC: 65 },
    { pos: 11, team: "Bronx", JJ: 6, JG: 2, JE: 0, JP: 4, CF: 52, CC: 92 },
    { pos: 12, team: "Soja Sushi", JJ: 4, JG: 1, JE: 0, JP: 3, CF: 30, CC: 41 },
    { pos: 13, team: "Bandidos", JJ: 4, JG: 1, JE: 0, JP: 3, CF: 17, CC: 43 },
    { pos: 14, team: "Primos", JJ: 4, JG: 1, JE: 0, JP: 3, CF: 47, CC: 45 },
    { pos: 15, team: "Tamagochis", JJ: 4, JG: 1, JE: 0, JP: 3, CF: 43, CC: 51 },
    { pos: 16, team: "Sox", JJ: 5, JG: 1, JE: 0, JP: 4, CF: 39, CC: 53 },
    { pos: 17, team: "Muñekos", JJ: 6, JG: 1, JE: 0, JP: 5, CF: 62, CC: 84 },
    { pos: 18, team: "Pichichi Blue Jeys", JJ: 7, JG: 0, JE: 0, JP: 7, CF: 36, CC: 99 },
  ],
};
