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

// Reintenta una consulta de lectura una vez tras una pausa corta antes de
// rendirse. En el campo la señal es intermitente (ver sw.js) — sin esto, un
// solo hipo de red se ve exactamente igual que "no hay comentarios/anuncios"
// o "no ha pagado", sin forma de distinguirlo, y solo se arregla con un
// refresh manual. `queryFn` es una función que regresa `{ data, error }`
// (la forma que usa el cliente de Supabase en cada consulta); un reintento
// es barato y resuelve la enorme mayoría de esos casos sin bloquear el
// primer pintado (sigue siendo asíncrono). Solo para lecturas — las
// escrituras (insert/upsert) no se reintentan aquí, podrían duplicar algo
// si la primera sí llegó a pasar y solo se perdió la respuesta.
async function runQuery(queryFn) {
  let result = await queryFn();
  if (result.error) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    result = await queryFn();
  }
  return result;
}

// Mismo reintento que runQuery, pero para escrituras — solo se usa en las
// que son upsert/update/delete, nunca en un insert puro (addComment,
// postAnnouncement, likeComment...): esas si de casualidad sí llegaron a
// pasar la primera vez y solo se perdió la respuesta, un reintento
// generaría una fila duplicada o un error de llave repetida. Un
// upsert/update/delete reintentado con los mismos datos llega exactamente
// al mismo resultado, así que aquí sí es seguro — y hace falta: "a veces no
// me deja guardar" (subir foto, guardar posiciones/canción/contraseña) es
// justo el mismo hipo de señal intermitente que ya resuelve runQuery para
// las lecturas.
async function runMutation(mutationFn) {
  let result = await mutationFn();
  if (result.error) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    result = await mutationFn();
  }
  return result;
}

// ---- Estado de pago de inscripción (player_dues) ----
//
// Lectura: cualquiera con sesión iniciada (RLS lo bloquea a un visitante
// anónimo, no hace falta comprobarlo aquí). Escritura: solo la cuenta del
// coach — este código nunca decide eso, Supabase lo rechaza solo si alguien
// más lo intenta (ver isCoach() en auth.js para la parte de mostrar/ocultar
// el control en la UI).

// Devuelve un Map playerId -> boolean. Si Supabase no está configurado, no
// hay sesión, o la tabla no es visible (anónimo), regresa un Map vacío —
// eso sí es "sin datos" real. Pero si SÍ hay cliente y la consulta truena
// incluso tras reintentar, regresa `null` en vez de un Map vacío: quien
// llama debe pintarlo como "no se pudo verificar", nunca como "nadie pagó"
// (un Map vacío ahí se leería como todos en rojo).
export async function getDuesMap() {
  const client = getClient();
  if (!client) return new Map();
  const { data, error } = await runQuery(() => client.from("player_dues").select("player_id, paid"));
  if (error) return null;
  if (!data) return new Map();
  return new Map(data.map((row) => [row.player_id, row.paid]));
}

// Estado de un solo jugador (para el badge del perfil, ver
// js/views/jugador.js) — más liviano que pedir la tabla completa cuando
// solo hace falta uno. OJO: solo se debe llamar con sesión iniciada — sin
// ella, RLS esconde la fila igual que si no existiera (sin distinguir
// "no pagó" de "no la puedo ver"), así que quien llama debe comprobar
// getSession() antes, igual que ya hace Roster para esta misma tabla.
//
// Regresa `null` — no `false` — si no se pudo verificar (sin cliente o la
// consulta falló incluso tras reintentar): a quien llama le toca no pintar
// eso como "no ha pagado", o un hipo de red se vería igual que sí pagó/no
// pagó cuando en realidad no se sabe.
export async function getDuesForPlayer(playerId) {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await runQuery(() =>
    client.from("player_dues").select("paid").eq("player_id", playerId).maybeSingle()
  );
  if (error) return null;
  return data?.paid ?? false;
}

// Upsert: si el jugador no tenía fila todavía, la crea. Tira si quien llama
// no es el coach — RLS lo bloquea allá, no aquí.
export async function setDuesPaid(playerId, paid) {
  const client = getClient();
  if (!client) throw new Error("Supabase no está configurado todavía.");
  const { error } = await runMutation(() =>
    client.from("player_dues").upsert({ player_id: playerId, paid, updated_at: new Date().toISOString() })
  );
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
  const { data, error } = await runQuery(() => client.from("game_rsvps").select("player_id, status").eq("game_id", gameId));
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
  const { data, error } = await runQuery(() =>
    client.from("mvp_votes").select("voter_player_id, voted_player_id").eq("game_id", gameId)
  );
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

export async function deleteMvpVote(gameId) {
  const client = getClient();
  const voterId = getCurrentPlayerId();
  if (!client || !voterId) throw new Error("Necesitas una cuenta vinculada a un jugador para quitar tu voto.");
  const { error } = await client
    .from("mvp_votes")
    .delete()
    .eq("game_id", gameId)
    .eq("voter_player_id", voterId);
  if (error) throw error;
}

// ---- Posiciones registradas (player_positions) ----
//
// Lectura pública. Escritura: solo el propio jugador. Cuando hay fila para
// un jugador, reemplaza la posición de data.js EN TODOS LADOS (Roster,
// perfil, generador de alineación) — no es solo informativo. Mismo formato
// que PLAYERS[].position: hasta 3 códigos separados por "/".

// null si el jugador no ha personalizado sus posiciones (o si Supabase no
// está configurado) — en ese caso se sigue usando la de data.js.
export async function getPositionOverride(playerId) {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await runQuery(() =>
    client.from("player_positions").select("position").eq("player_id", playerId).maybeSingle()
  );
  if (error || !data) return null;
  return data.position;
}

// Todas las posiciones personalizadas de una vez, como Map playerId ->
// position. Para Roster y el generador de alineación, que necesitan
// mezclarlas sobre el roster completo en vez de consultar jugador por
// jugador. Map vacío si Supabase no está configurado o falla la consulta.
export async function getAllPositionOverrides() {
  const client = getClient();
  if (!client) return new Map();
  const { data, error } = await runQuery(() => client.from("player_positions").select("player_id, position"));
  if (error || !data) return new Map();
  return new Map(data.map((row) => [row.player_id, row.position]));
}

// Upsert de las posiciones del propio jugador. Tira si quien llama no es
// ese jugador — RLS lo bloquea allá, no aquí.
export async function setPosition(playerId, position) {
  const client = getClient();
  if (!client) throw new Error("Supabase no está configurado todavía.");
  const { error } = await client
    .from("player_positions")
    .upsert({ player_id: playerId, position, updated_at: new Date().toISOString() });
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
  const { data, error } = await runQuery(() =>
    client.from("player_walkups").select("title, artist, url").eq("player_id", playerId).maybeSingle()
  );
  if (error || !data) return null;
  return data;
}

// Todas las canciones personalizadas de una vez, como Map playerId ->
// {title, artist, url} — para la playlist del equipo (ver
// js/views/playlist.js), que necesita mezclarlas sobre PLAYERS completo en
// vez de consultar jugador por jugador. Map vacío si Supabase no está
// configurado o falla la consulta.
export async function getAllWalkupOverrides() {
  const client = getClient();
  if (!client) return new Map();
  const { data, error } = await runQuery(() => client.from("player_walkups").select("player_id, title, artist, url"));
  if (error || !data) return new Map();
  return new Map(data.map((row) => [row.player_id, { title: row.title, artist: row.artist, url: row.url }]));
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

// ---- Comentarios (comments) ----
//
// Lectura pública. Escritura: cualquier jugador con cuenta (a diferencia de
// walkup/posiciones, aquí no hay "dueño" fijo — cualquiera comenta en
// cualquier juego). Un comentario por jugador por juego (constraint única
// en supabase/schema.sql). No se editan: para "cambiar" un comentario hay
// que borrarlo y escribir uno nuevo — el dueño puede borrar el suyo, y el
// coach puede borrar cualquiera (moderación).
export async function getComments(contextType, contextId) {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await runQuery(() =>
    client
      .from("comments")
      .select("id, player_id, body, created_at")
      .eq("context_type", contextType)
      .eq("context_id", contextId)
      .order("created_at", { ascending: true })
  );
  return error || !data ? [] : data;
}

export async function addComment(contextType, contextId, body) {
  const client = getClient();
  const playerId = getCurrentPlayerId();
  if (!client || !playerId) throw new Error("Necesitas una cuenta vinculada a un jugador para comentar.");
  const { error } = await client
    .from("comments")
    .insert({ context_type: contextType, context_id: contextId, player_id: playerId, body });
  if (error) throw error;
}

export async function deleteComment(commentId) {
  const client = getClient();
  if (!client) throw new Error("Necesitas una cuenta para borrar comentarios.");
  const { error } = await client.from("comments").delete().eq("id", commentId);
  if (error) throw error;
}

// ---- Likes de comentarios (comment_likes) ----
//
// Lectura pública (el conteo se ve con o sin sesión). Dar/quitar like
// requiere cuenta — un like por jugador por comentario (la llave primaria
// lo garantiza; dar like de nuevo no acumula, es un interruptor).

// Todos los likes de un conjunto de comentarios de una sola consulta — para
// no pedirlos uno por uno al pintar la lista completa. [] si no hay
// comentarios que consultar o si Supabase no está configurado.
export async function getCommentLikes(commentIds) {
  const client = getClient();
  if (!client || commentIds.length === 0) return [];
  const { data, error } = await runQuery(() =>
    client.from("comment_likes").select("comment_id, player_id").in("comment_id", commentIds)
  );
  return error || !data ? [] : data;
}

export async function likeComment(commentId) {
  const client = getClient();
  const playerId = getCurrentPlayerId();
  if (!client || !playerId) throw new Error("Necesitas una cuenta vinculada a un jugador para dar like.");
  const { error } = await client.from("comment_likes").insert({ comment_id: commentId, player_id: playerId });
  if (error) throw error;
}

export async function unlikeComment(commentId) {
  const client = getClient();
  const playerId = getCurrentPlayerId();
  if (!client || !playerId) throw new Error("Necesitas una cuenta vinculada a un jugador para quitar el like.");
  const { error } = await client.from("comment_likes").delete().eq("comment_id", commentId).eq("player_id", playerId);
  if (error) throw error;
}

// ---- Anuncios del equipo (announcements) ----
//
// Lectura pública. Escritura: solo la cuenta del coach — mismo patrón que
// player_dues (RLS lo exige del lado del servidor, no aquí).
export async function getAnnouncements(limit = 3) {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await runQuery(() =>
    client.from("announcements").select("id, body, created_at").order("created_at", { ascending: false }).limit(limit)
  );
  return error || !data ? [] : data;
}

export async function postAnnouncement(body) {
  const client = getClient();
  if (!client) throw new Error("Supabase no está configurado todavía.");
  const { error } = await client.from("announcements").insert({ body });
  if (error) throw error;
}

export async function deleteAnnouncement(id) {
  const client = getClient();
  if (!client) throw new Error("Supabase no está configurado todavía.");
  const { error } = await client.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

// ---- Reacciones a anuncios (announcement_likes) ----
//
// Mismo patrón que los likes de comentarios (arriba): lectura pública, un
// like por jugador por anuncio (interruptor, no acumula).
export async function getAnnouncementLikes(announcementIds) {
  const client = getClient();
  if (!client || announcementIds.length === 0) return [];
  const { data, error } = await runQuery(() =>
    client.from("announcement_likes").select("announcement_id, player_id").in("announcement_id", announcementIds)
  );
  return error || !data ? [] : data;
}

export async function likeAnnouncement(announcementId) {
  const client = getClient();
  const playerId = getCurrentPlayerId();
  if (!client || !playerId) throw new Error("Necesitas una cuenta vinculada a un jugador para dar like.");
  const { error } = await client.from("announcement_likes").insert({ announcement_id: announcementId, player_id: playerId });
  if (error) throw error;
}

export async function unlikeAnnouncement(announcementId) {
  const client = getClient();
  const playerId = getCurrentPlayerId();
  if (!client || !playerId) throw new Error("Necesitas una cuenta vinculada a un jugador para quitar el like.");
  const { error } = await client
    .from("announcement_likes")
    .delete()
    .eq("announcement_id", announcementId)
    .eq("player_id", playerId);
  if (error) throw error;
}

// ---- Foto de perfil personalizada (Storage, bucket "avatars") ----
//
// A diferencia de todo lo de arriba, esto no es una tabla — cada foto es un
// archivo en Storage, guardado como "{playerId}/avatar" (se sobreescribe
// cada vez que la cambian, no hace falta borrar la anterior). El bucket es
// PRIVADO — a propósito, para que solo se pueda ver con sesión iniciada
// (ver política "avatars_read_authenticated" en supabase/schema.sql):
// getPublicUrl() no serviría aquí porque esa URL no respeta esa política;
// hace falta una URL firmada, que sí la respeta.

// null si Supabase no está configurado, no hay sesión (RLS la rechaza
// igual que si no existiera), o el jugador no ha subido foto propia —
// en cualquiera de esos casos, la vista sigue mostrando el avatar de
// siempre (foto de data.js o iniciales).
export async function getAvatarUrl(playerId) {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client.storage.from("avatars").createSignedUrl(`${playerId}/avatar`, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

// Tira si quien llama no es ese jugador — RLS lo bloquea allá (la política
// de Storage compara el primer segmento de la ruta contra
// current_player_id()), no aquí.
export async function uploadAvatar(playerId, file) {
  const client = getClient();
  if (!client) throw new Error("Supabase no está configurado todavía.");
  const { error } = await client.storage
    .from("avatars")
    .upload(`${playerId}/avatar`, file, { upsert: true, contentType: file.type });
  if (error) throw error;
}
