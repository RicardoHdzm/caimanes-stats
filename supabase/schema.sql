-- ============================================================================
-- Caimanes de Villas — cuentas, RSVP, votos MVP, walkup y pagos.
-- Pegar en Supabase → SQL Editor → New query → Run. Una sola vez.
--
-- Este archivo se guarda en el repo solo como historial/documentación — nada
-- lo corre automático, no hay CI ni build step que lo aplique. Si cambias el
-- esquema más adelante, actualiza este archivo Y vuelve a correr el cambio
-- a mano en el SQL Editor de Supabase.
-- ============================================================================

-- 1. Correo -> player_id de js/data.js (ej. "p15"). Mantenimiento manual en
--    Table Editor: una fila por cada jugador al que le des cuenta.
create table if not exists public.player_whitelist (
  email text primary key,
  player_id text not null,
  created_at timestamptz not null default now()
);
alter table public.player_whitelist enable row level security;
-- Sin políticas: ni siquiera lectura pública. Nadie debe poder ver el correo
-- de otro jugador. Solo current_player_id() (abajo) la consulta.

-- 2. Resuelve "¿quién soy?" a partir del correo de la sesión actual.
--    security definer le permite leer player_whitelist aunque esa tabla no
--    tenga ninguna política propia. Devuelve null si no hay sesión o el
--    correo no está en la lista.
create or replace function public.current_player_id()
returns text
language sql stable security definer set search_path = public
as $$
  select player_id from public.player_whitelist where email = auth.email();
$$;
grant execute on function public.current_player_id() to anon, authenticated;

-- 3. RSVP a un juego programado (game_id = id de un SCHEDULE, ej. "s1").
--    Lectura pública (cualquiera ve el conteo), escritura solo del propio
--    jugador.
create table if not exists public.game_rsvps (
  game_id text not null,
  player_id text not null,
  status text not null check (status in ('yes', 'no')),
  updated_at timestamptz not null default now(),
  primary key (game_id, player_id)
);
alter table public.game_rsvps enable row level security;

create policy "rsvps_public_read" on public.game_rsvps
  for select using (true);

create policy "rsvps_insert_own" on public.game_rsvps
  for insert to authenticated
  with check (player_id = public.current_player_id());

create policy "rsvps_update_own" on public.game_rsvps
  for update to authenticated
  using (player_id = public.current_player_id())
  with check (player_id = public.current_player_id());

grant select, insert, update on public.game_rsvps to anon, authenticated;

-- 4. Canción de entrada personalizada. Sin fila para un jugador = se sigue
--    mostrando el valor fijo de data.js (no hace falta migrar los 20 de
--    una vez, solo quien la edita gana una fila aquí).
create table if not exists public.player_walkups (
  player_id text primary key,
  title text not null check (char_length(title) between 1 and 120),
  artist text check (char_length(artist) <= 120),
  url text check (char_length(url) <= 500),
  updated_at timestamptz not null default now()
);
alter table public.player_walkups enable row level security;

create policy "walkups_public_read" on public.player_walkups
  for select using (true);

create policy "walkups_insert_own" on public.player_walkups
  for insert to authenticated
  with check (player_id = public.current_player_id());

create policy "walkups_update_own" on public.player_walkups
  for update to authenticated
  using (player_id = public.current_player_id())
  with check (player_id = public.current_player_id());

grant select, insert, update on public.player_walkups to anon, authenticated;

-- 5. Voto de MVP (game_id = id de un GAMES, ej. "g9"). Una fila por votante
--    y juego (el UPDATE permite cambiar el voto antes de que "cierre").
--
--    NOTA sobre "solo quien jugó ese juego puede votar": el line-up de cada
--    juego vive solo en data.js, no aquí, así que Postgres no tiene con qué
--    verificarlo sin duplicar ese line-up en una tabla y mantenerla
--    sincronizada a mano en cada edición de data.js. Esta política solo
--    exige "eres un jugador con cuenta"; el filtro real de "jugó este
--    partido" se aplica en la UI (js/views/juego.js), no aquí. Riesgo
--    aceptado para una app de equipo entre amigos — ver plan para el
--    detalle.
create table if not exists public.mvp_votes (
  game_id text not null,
  voter_player_id text not null,
  voted_player_id text not null,
  created_at timestamptz not null default now(),
  primary key (game_id, voter_player_id)
);
alter table public.mvp_votes enable row level security;

create policy "votes_public_read" on public.mvp_votes
  for select using (true);

create policy "votes_insert_own" on public.mvp_votes
  for insert to authenticated
  with check (voter_player_id = public.current_player_id());

create policy "votes_update_own" on public.mvp_votes
  for update to authenticated
  using (voter_player_id = public.current_player_id())
  with check (voter_player_id = public.current_player_id());

create policy "votes_delete_own" on public.mvp_votes
  for delete to authenticated
  using (voter_player_id = public.current_player_id());

grant select, insert, update, delete on public.mvp_votes to anon, authenticated;

-- 6. Comentarios, reusados por la página de un juego (context_type='game',
--    context_id = id del juego) y por la de alineación sugerida
--    (context_type='lineup', context_id='alineacion').
create table if not exists public.comments (
  id bigint generated always as identity primary key,
  context_type text not null check (context_type in ('game', 'lineup')),
  context_id text not null,
  player_id text not null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_context_idx
  on public.comments (context_type, context_id, created_at);
alter table public.comments enable row level security;

create policy "comments_public_read" on public.comments
  for select using (true);

create policy "comments_insert_own" on public.comments
  for insert to authenticated
  with check (player_id = public.current_player_id());
-- Sin políticas de update/delete: los comentarios son inmutables desde el
-- cliente a propósito. Se puede borrar uno desde Table Editor si hace falta.

grant select, insert on public.comments to anon, authenticated;

-- 7. Estado de pago de inscripción. ÚNICA tabla que NO es de lectura
--    pública: hace falta tener sesión iniciada para verla, y solo la cuenta
--    del coach puede escribirla. Cambia el correo de abajo si algún día
--    cambia quién administra el sitio.
create table if not exists public.player_dues (
  player_id text primary key,
  paid boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.player_dues enable row level security;

create policy "dues_read_authenticated" on public.player_dues
  for select to authenticated using (true);

create policy "dues_write_coach_only" on public.player_dues
  for all to authenticated
  using (auth.email() = 'jrhm95@gmail.com')
  with check (auth.email() = 'jrhm95@gmail.com');

grant select, insert, update on public.player_dues to authenticated;
