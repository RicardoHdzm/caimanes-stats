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

-- 6. Comentarios en el detalle de un juego (context_type='game', context_id
--    = id del juego). Un comentario por jugador por juego (constraint
--    única abajo). No se editan: para "cambiar" uno hay que borrarlo y
--    escribir uno nuevo (addComment en js/db.js) — el dueño puede borrar el
--    suyo, y el coach puede borrar cualquiera (moderación).
--    context_type='lineup' quedó del diseño original (llegó a tener
--    comentarios en Alineación) pero ya no se usa desde la UI.
create table if not exists public.comments (
  id bigint generated always as identity primary key,
  context_type text not null check (context_type in ('game', 'lineup')),
  context_id text not null,
  player_id text not null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (context_type, context_id, player_id)
);
create index if not exists comments_context_idx
  on public.comments (context_type, context_id, created_at);
alter table public.comments enable row level security;

create policy "comments_public_read" on public.comments
  for select using (true);

create policy "comments_insert_own" on public.comments
  for insert to authenticated
  with check (player_id = public.current_player_id());

create policy "comments_delete_own" on public.comments
  for delete to authenticated
  using (player_id = public.current_player_id());

create policy "comments_delete_coach" on public.comments
  for delete to authenticated
  using (auth.email() = 'jrhm95@gmail.com');

grant select, insert, delete on public.comments to anon, authenticated;

-- 6b. Likes de comentarios. Un like por jugador por comentario (la llave
--     primaria lo garantiza) — dar like de nuevo no acumula, es un
--     interruptor: para quitarlo se borra la fila (unlikeComment en
--     js/db.js). Al editar un comentario (upsert de arriba) el `id` no
--     cambia, así que estos likes nunca se pierden por editar el texto.
create table if not exists public.comment_likes (
  comment_id bigint not null references public.comments (id) on delete cascade,
  player_id text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, player_id)
);
alter table public.comment_likes enable row level security;

create policy "comment_likes_public_read" on public.comment_likes
  for select using (true);

create policy "comment_likes_insert_own" on public.comment_likes
  for insert to authenticated
  with check (player_id = public.current_player_id());

create policy "comment_likes_delete_own" on public.comment_likes
  for delete to authenticated
  using (player_id = public.current_player_id());

grant select, insert, delete on public.comment_likes to anon, authenticated;

-- 7. Posiciones registradas, editables por el propio jugador desde su
--    perfil. Mismo formato que el campo `position` de PLAYERS en data.js
--    ("SS/LF/CF", hasta 3, separadas por "/") — sin fila para un jugador,
--    se sigue usando el valor fijo de data.js. Cuando SÍ hay fila, además
--    de mostrarse en el perfil reemplaza esa posición en Roster y en el
--    generador de alineación (ver js/views/roster.js, js/views/alineacion.js
--    y js/lineup-tool.js — todos mezclan esta tabla sobre PLAYERS antes de
--    usar la posición).
create table if not exists public.player_positions (
  player_id text primary key,
  position text not null check (char_length(position) <= 20),
  updated_at timestamptz not null default now()
);
alter table public.player_positions enable row level security;

create policy "positions_public_read" on public.player_positions
  for select using (true);

create policy "positions_insert_own" on public.player_positions
  for insert to authenticated
  with check (player_id = public.current_player_id());

create policy "positions_update_own" on public.player_positions
  for update to authenticated
  using (player_id = public.current_player_id())
  with check (player_id = public.current_player_id());

grant select, insert, update on public.player_positions to anon, authenticated;

-- 8. Estado de pago de inscripción. ÚNICA tabla que NO es de lectura
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

-- 9. Anuncios del equipo. Lectura pública, escritura solo del coach — mismo
--    patrón que player_dues arriba. `title` es opcional (anuncios viejos
--    no lo tienen) — ver postAnnouncement()/getAnnouncements() en js/db.js.
create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  title text check (char_length(title) <= 120),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;

create policy "announcements_public_read" on public.announcements
  for select using (true);

create policy "announcements_write_coach_only" on public.announcements
  for all to authenticated
  using (auth.email() = 'jrhm95@gmail.com')
  with check (auth.email() = 'jrhm95@gmail.com');

grant select on public.announcements to anon, authenticated;
grant select, insert, update, delete on public.announcements to authenticated;

-- 9b. Reacciones a los anuncios — mismo patrón que comment_likes (6b): un
--     "like" por jugador por anuncio (la llave primaria lo garantiza; dar
--     like de nuevo no acumula, es un interruptor — para quitarlo se borra
--     la fila, ver unlikeAnnouncement en js/db.js).
create table if not exists public.announcement_likes (
  announcement_id bigint not null references public.announcements (id) on delete cascade,
  player_id text not null,
  created_at timestamptz not null default now(),
  primary key (announcement_id, player_id)
);
alter table public.announcement_likes enable row level security;

create policy "announcement_likes_public_read" on public.announcement_likes
  for select using (true);

create policy "announcement_likes_insert_own" on public.announcement_likes
  for insert to authenticated
  with check (player_id = public.current_player_id());

create policy "announcement_likes_delete_own" on public.announcement_likes
  for delete to authenticated
  using (player_id = public.current_player_id());

grant select, insert, delete on public.announcement_likes to anon, authenticated;

-- 10. Foto de perfil personalizada — bucket de Storage, no una tabla. Cada
--     jugador tiene como mucho un archivo, en "{player_id}/avatar" (se
--     sobreescribe al cambiarla). Lectura PÚBLICA a propósito (cualquiera
--     que abra el sitio, con o sin cuenta, ve la foto real) — solo subirla
--     o cambiarla exige sesión y ser ese mismo jugador (políticas de abajo).
--     Ver getAvatarUrl() en js/db.js.
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', false)
  on conflict (id) do nothing;

create policy "avatars_read_public" on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.current_player_id());

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.current_player_id());
