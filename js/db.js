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
import { PLAYERS, DUES_PAID } from "./data.js";

export { getClient };

// Reintenta una consulta de lectura hasta 2 veces (3 intentos en total, con
// pausas cada vez más largas) antes de rendirse. En el campo la señal es
// intermitente (ver sw.js) — un solo reintento de 800ms no alcanza si el
// hipo dura varios segundos, y sin esto se ve exactamente igual que "no hay
// comentarios/anuncios" o "no ha pagado", sin forma de distinguirlo, y solo
// se arregla con un refresh manual (ver también el listener de "online" en
// js/main.js, que ataca el mismo problema desde otro ángulo: repinta la
// vista completa apenas vuelve la señal, en vez de solo reintentar la
// consulta que ya se hizo). `queryFn` regresa `{ data, error }` (la forma
// que usa el cliente de Supabase en cada consulta). Solo para lecturas —
// las escrituras (insert/upsert) no se reintentan aquí, podrían duplicar
// algo si la primera sí llegó a pasar y solo se perdió la respuesta.
async function runQuery(queryFn) {
  let result = await queryFn();
  for (const delay of [800, 2000]) {
    if (!result.error) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
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
  for (const delay of [800, 2000]) {
    if (!result.error) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
    result = await mutationFn();
  }
  return result;
}

// ---- Estado de pago de inscripción ----
//
// Ya NO vive en Supabase (tabla player_dues) — ahora sale directo de
// DUES_PAID en js/data.js, a petición expresa ("por ahora marca que todos
// pagaron correctamente"). Estas dos funciones se quedan async y con la
// misma forma de siempre (Map / boolean) para que roster.js, jugador.js y
// medallas.js no tengan que cambiar nada — ya no pueden fallar ni regresar
// `null` (no hay red de por medio), pero esos casos se dejan intactos en
// quien llama por si algún día vuelve a haber una fuente que sí falle.
export async function getDuesMap() {
  return new Map(PLAYERS.map((p) => [p.id, DUES_PAID[p.id] ?? true]));
}

export async function getDuesForPlayer(playerId) {
  return DUES_PAID[playerId] ?? true;
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
  const { error } = await runMutation(() =>
    client.from("game_rsvps").upsert({ game_id: gameId, player_id: playerId, status, updated_at: new Date().toISOString() })
  );
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
  const { error } = await runMutation(() =>
    client.from("mvp_votes").upsert({ game_id: gameId, voter_player_id: voterId, voted_player_id: votedPlayerId })
  );
  if (error) throw error;
}

export async function deleteMvpVote(gameId) {
  const client = getClient();
  const voterId = getCurrentPlayerId();
  if (!client || !voterId) throw new Error("Necesitas una cuenta vinculada a un jugador para quitar tu voto.");
  const { error } = await runMutation(() =>
    client.from("mvp_votes").delete().eq("game_id", gameId).eq("voter_player_id", voterId)
  );
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
  const { error } = await runMutation(() =>
    client.from("player_positions").upsert({ player_id: playerId, position, updated_at: new Date().toISOString() })
  );
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
  const { error } = await runMutation(() =>
    client.from("player_walkups").upsert({ player_id: playerId, title, artist, url, updated_at: new Date().toISOString() })
  );
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
  const { error } = await runMutation(() => client.from("comments").delete().eq("id", commentId));
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
  const { error } = await runMutation(() =>
    client.from("comment_likes").delete().eq("comment_id", commentId).eq("player_id", playerId)
  );
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
    client.from("announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(limit)
  );
  return error || !data ? [] : data;
}

// `title` es opcional (columna nullable, ver supabase/schema.sql) — un
// anuncio viejo o publicado sin título simplemente no trae uno.
export async function postAnnouncement(title, body) {
  const client = getClient();
  if (!client) throw new Error("Supabase no está configurado todavía.");
  const { error } = await client.from("announcements").insert({ title: title || null, body });
  if (error) throw error;
}

export async function deleteAnnouncement(id) {
  const client = getClient();
  if (!client) throw new Error("Supabase no está configurado todavía.");
  const { error } = await runMutation(() => client.from("announcements").delete().eq("id", id));
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
  const { error } = await runMutation(() =>
    client.from("announcement_likes").delete().eq("announcement_id", announcementId).eq("player_id", playerId)
  );
  if (error) throw error;
}

// ---- Foto de perfil personalizada (Storage, bucket "avatars") ----
//
// A diferencia de todo lo de arriba, esto no es una tabla — cada foto es un
// archivo en Storage, guardado como "{playerId}/avatar" (se sobreescribe
// cada vez que la cambian, no hace falta borrar la anterior). La LECTURA es
// pública (política "avatars_read_public" en supabase/schema.sql, sin
// sesión incluida) — cualquiera que abra el sitio ve la foto real. Subir o
// cambiar la propia sigue exigiendo sesión (políticas "avatars_insert_own"
// / "avatars_update_own", comparan contra current_player_id()).
//
// El bucket ya es público de verdad (storage.buckets.public = true, migrado
// a mano — antes solo tenía la política RLS "avatars_read_public" pero
// seguía registrado como privado, y getPublicUrl() 400eaba sin importar la
// política; confirmado probando contra el proyecto real). Con el bucket
// público, getPublicUrl() regresa SIEMPRE la misma URL para la misma foto —
// a diferencia de createSignedUrl() de antes, que traía un token nuevo cada
// vez y el navegador nunca podía cachear la imagen ("tarda en cargar la
// imagen de perfil" con señal regular). getPublicUrl() no avisa si el
// archivo existe (solo arma la URL), así que se comprueba con list()
// primero — barato, sin firmar nada — para no romper el fallback a
// iniciales ni la medalla "Selfie!" (ambos dependen de null = "no tiene
// foto").
export async function getAvatarUrl(playerId) {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await runQuery(() => client.storage.from("avatars").list(playerId, { search: "avatar" }));
  if (error || !data || data.length === 0) return null;
  const publicUrl = client.storage.from("avatars").getPublicUrl(`${playerId}/avatar`).data.publicUrl;
  // "?v=" con la fecha real de modificación (no aleatorio): mismo archivo =
  // misma URL = el navegador la cachea entre visitas; si alguien sube una
  // foto nueva (mismo nombre, se sobreescribe), `updated_at` cambia y con
  // él la URL, así que se pide fresca en vez de servir la vieja cacheada.
  const version = data[0]?.updated_at ? new Date(data[0].updated_at).getTime() : null;
  return version ? `${publicUrl}?v=${version}` : publicUrl;
}

// Tira si quien llama no es ese jugador — RLS lo bloquea allá (la política
// de Storage compara el primer segmento de la ruta contra
// current_player_id()), no aquí.
export async function uploadAvatar(playerId, file) {
  const client = getClient();
  if (!client) throw new Error("Supabase no está configurado todavía.");
  const { error } = await runMutation(() =>
    client.storage.from("avatars").upload(`${playerId}/avatar`, file, { upsert: true, contentType: file.type })
  );
  if (error) throw error;
}
