// Todas las consultas a Supabase que no son de sesión/login (eso vive en
// js/auth.js) van aquí: RSVP, votos de MVP, canción de entrada, comentarios,
// estado de pago. Las vistas importan de este archivo, nunca hablan con
// Supabase directo — mismo criterio que separa js/stats.js (cálculo) de
// js/ui.js (render).
//
// Se va llenando fase por fase según el plan (RSVP, walkup, MVP, comentarios,
// pagos); por ahora solo expone el cliente para que las próximas fases lo
// reusen sin volver a importarlo cada una por su cuenta.
import { getClient } from "./auth.js";

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
