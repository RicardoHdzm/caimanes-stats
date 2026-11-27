// Datos del sitio de CaimanX (caimanx.html) — a mano, como js/data.js del
// sóftbol. Lo que esté vacío muestra un aviso en su sección.

// Redes. `null` = no sale el botón. Para agregar una, pon su link completo
// (ej. twitch: "https://www.twitch.tv/caimanx").
export const LINKS = {
  instagram: "https://www.instagram.com/caimanes.sb/",
  twitch: null,
  youtube: null,
  tiktok: null,
  kick: null,
};

// Jugadores. Un objeto por jugador:
//   { tag: "CaimanRicky", name: "Ricardo Hernández", games: ["Pokémon", "Smash Bros"],
//     twitch: "https://www.twitch.tv/..." (opcional) }
export const PLAYERS = [];

// Juegos que juega el equipo. `overlay`: el id del overlay que le queda
// (general, peleas, deportes, shooters, moba, pokemon) — su tarjeta lleva a él.
export const GAMES = [
  { name: "Pokémon", overlay: "pokemon" },
  { name: "Smash Bros", overlay: "peleas" },
  { name: "League of Legends", overlay: "moba" },
];

// Patrocinadores: salen en los overlays y las pantallas (en blanco). `logo`:
// PNG con fondo transparente (como los de assets/sponsors/).
export const SPONSORS = [{ name: "JRHM.STUDIO", logo: "assets/sponsors/sponsor00.png", url: "https://jrhm.studio/" }];

// Torneos, del más reciente al más viejo:
//   { date: "2026-12-06", name: "Copa Culiacán", game: "Smash Bros", result: "3er lugar" }
// `result` puede quedar vacío si todavía no se juega.
export const TOURNAMENTS = [];
