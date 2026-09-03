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
