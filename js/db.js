// Todas las consultas a Supabase que no son de sesión/login (eso vive en
// js/auth.js) van aquí: RSVP, votos de MVP, canción de entrada, comentarios,
// estado de pago. Las vistas importan de este archivo, nunca hablan con
// Supabase directo — mismo criterio que separa js/stats.js (cálculo) de
// js/ui.js (render).
//
// Se va llenando fase por fase según el plan (RSVP, walkup, MVP, comentarios,
// pagos); por ahora solo expone el cliente para que las próximas fases lo
// reusen sin volver a importarlo cada una por su cuenta.
import { getClient, getCurrentPlayerId } from "./auth.js";

export { getClient };

// ---- Estado de pago de inscripción (player_dues) ----
//
// Lectura: cualquiera con sesión iniciada (RLS lo bloquea a un visitante
// anónimo, no hace falta comprobarlo aquí). Escritura: solo la cuenta del
// coach — este código nunca decide eso, Supabase lo rechaza solo si alguien
// más lo intenta (ver isCoach() en auth.js para la parte de mostrar/ocultar
// el control en la UI).

// Devuelve un Map playerId -> boolean. Si Supabase no está configurado, no
// hay sesión, o la tabla no es visible (anónimo), regresa un Map vacío en
// vez de tronar — el roster simplemente no muestra la columna en ese caso.
export async function getDuesMap() {
  const client = getClient();
  if (!client) return new Map();
  const { data, error } = await client.from("player_dues").select("player_id, paid");
  if (error || !data) return new Map();
  return new Map(data.map((row) => [row.player_id, row.paid]));
}

// Upsert: si el jugador no tenía fila todavía, la crea. Tira si quien llama
// no es el coach — RLS lo bloquea allá, no aquí.
export async function setDuesPaid(playerId, paid) {
  const client = getClient();
  if (!client) throw new Error("Supabase no está configurado todavía.");
  const { error } = await client
    .from("player_dues")
    .upsert({ player_id: playerId, paid, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ---- RSVP a un juego programado (game_rsvps) ----
//
// Lectura pública: cualquiera ve quién confirmó, con o sin sesión. Solo el
// propio jugador puede confirmar/declinar por sí mismo — RLS lo exige del
// lado del servidor, aquí solo se manda el player_id porque Postgres no lo
// deduce solo (el upsert lo necesita en la fila).

// Todas las filas de un juego (game_id = id de un SCHEDULE, ej. "s1"). []
// si Supabase no está configurado o falla la consulta — la tarjeta de
// "Próximo juego" simplemente no muestra tally en ese caso.
export async function getRsvps(gameId) {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from("game_rsvps").select("player_id, status").eq("game_id", gameId);
  return error || !data ? [] : data;
}

export async function setRsvp(gameId, status) {
  const client = getClient();
  const playerId = getCurrentPlayerId();
  if (!client || !playerId) throw new Error("Necesitas una cuenta vinculada a un jugador para confirmar asistencia.");
  const { error } = await client
    .from("game_rsvps")
    .upsert({ game_id: gameId, player_id: playerId, status, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ---- Voto de MVP por juego (mvp_votes) ----
//
// Lectura pública: cualquiera ve el conteo, con o sin sesión. RLS solo
// exige "eres un jugador con cuenta" para votar, no "jugaste ESTE juego en
// particular" — eso lo filtra la UI en js/views/juego.js, comparando contra
// el line-up real de ese juego. Ver supabase/schema.sql para el porqué.

// Todas las filas de un juego (game_id = id de un GAMES, ej. "g9"). [] si
// Supabase no está configurado o falla la consulta.
export async function getMvpVotes(gameId) {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from("mvp_votes").select("voter_player_id, voted_player_id").eq("game_id", gameId);
  return error || !data ? [] : data;
}

export async function setMvpVote(gameId, votedPlayerId) {
  const client = getClient();
  const voterId = getCurrentPlayerId();
  if (!client || !voterId) throw new Error("Necesitas una cuenta vinculada a un jugador para votar.");
  // Sin created_at explícito: en un voto nuevo lo llena el DEFAULT now() de
  // la tabla; si es un cambio de voto (mismo game_id + voter_player_id), se
  // queda con la fecha del voto original en vez de reescribirla.
  const { error } = await client
    .from("mvp_votes")
    .upsert({ game_id: gameId, voter_player_id: voterId, voted_player_id: votedPlayerId });
  if (error) throw error;
}

// ---- Canción de entrada personalizada (player_walkups) ----
//
// Lectura pública (cualquiera ve la canción de cualquiera, con o sin
// sesión). Escritura: solo el propio jugador — RLS compara contra
// current_player_id(), no hace falta repetir esa comprobación aquí.

// null si el jugador no ha personalizado su canción (o si Supabase no está
// configurado) — en ese caso la vista sigue mostrando la de data.js.
export async function getWalkupOverride(playerId) {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from("player_walkups")
    .select("title, artist, url")
    .eq("player_id", playerId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// Upsert de la canción del propio jugador. Tira si quien llama no es ese
// jugador — RLS lo bloquea allá, no aquí.
export async function setWalkup(playerId, { title, artist, url }) {
  const client = getClient();
  if (!client) throw new Error("Supabase no está configurado todavía.");
  const { error } = await client
    .from("player_walkups")
    .upsert({ player_id: playerId, title, artist, url, updated_at: new Date().toISOString() });
  if (error) throw error;
}
