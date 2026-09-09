# Caimanes de Villas — Stats

Página estática (sin servidor, sin base de datos) para llevar las estadísticas
del equipo: roster, bateo, pitcheo, fildeo, resultados de juegos, playoffs y
el historial de temporadas anteriores. Se hostea gratis en **GitHub Pages**.

## Cómo actualizar los datos

Todo el contenido vive en [`js/data.js`](js/data.js). No hay panel de admin
con base de datos, pero sí una herramienta local —
[`admin.html`](admin.html) — que a partir de formularios te genera el bloque
de código listo para pegar en `data.js` (no guarda nada por sí sola, solo
arma el texto). Después de pegar el código, sube (commit + push) los cambios
a GitHub para que se reflejen en la página publicada.

Otra herramienta local, [`lineup/`](lineup/index.html), sugiere la alineación
(orden al bat + las 9 posiciones) a partir de quién marques como asistente a
un juego — usa el mismo cálculo que la pestaña Alineación del sitio (stats
de temporada + posiciones del roster), pero solo con los jugadores presentes
en vez de todo el equipo. Tampoco guarda nada, es un punto de partida para
el cuerpo técnico, no la decisión final.

- **`PLAYERS`**: agrega un objeto por jugador con `id` (único, ej. `"p5"`),
  `number`, `name` y `position`. Opcionalmente `photo` y `walkup` — la
  canción de entrada (*walk-up song*), la que suena cuando va al bat:

  ```js
  walkup: { title: "Enter Sandman", artist: "Metallica", url: "https://open.spotify.com/track/..." }
  ```

  Se ve en el perfil del jugador. `artist` y `url` son opcionales; con `url`
  el recuadro se vuelve un link y toma el icono de la plataforma (Spotify,
  YouTube, Apple Music, Deezer o SoundCloud). Sin `walkup` no se muestra nada.
  También opcional, `seasons`: lista de números de temporada en las que el
  jugador estuvo en el equipo (ver "Temporadas y playoffs" abajo) — define
  el "Debut" que se muestra en su perfil. Se genera desde admin.html →
  "Temporadas por jugador", no hace falta editarlo a mano.
- **`GAMES`**: agrega un objeto por juego de temporada regular jugado, con
  el marcador, un `season` (número de temporada, ver abajo) y un arreglo
  `batting`, `pitching` y `fielding` con una línea por jugador que participó
  en cada rubro (si un jugador no bateó/pitcheó/fildeó ese juego, simplemente
  no lo incluyas en ese arreglo).
- **`PLAYOFFS`**: los juegos de playoffs van aparte de `GAMES` a propósito
  (ver "Temporadas y playoffs" abajo) para que nunca se mezclen con las
  stats/medallas de temporada regular.
- **`STANDINGS`**: la tabla de posiciones de la liga (temporada actual), se
  copia tal cual la publican (no se calcula sola). Actualízala a mano cada
  vez que la liga saque una nueva.
- **`STANDINGS_HISTORY`**: la tabla final de temporadas ya cerradas — se
  llena al cerrar una temporada, ver el checklist abajo.
- **`DUES_PAID`**: quién pagó la inscripción, por temporada. Es 100%
  estático (ya no vive en Supabase) — ver "Cuentas de jugador" abajo.
- **`SPONSORS`**: la tira de logos de patrocinadores que se ve al final de
  cada página. Cada logo debe ser un PNG transparente con el dibujo en
  negro — en los temas oscuros se invierte a blanco solo, sin necesitar dos
  versiones del archivo. `url` es opcional (sin él el logo no es clicable).

Las entradas pitcheadas (`IP`) usan la notación estándar de béisbol/softbol:
`.1` = 1 out, `.2` = 2 outs (ej. `4.2` = 4 entradas completas + 2 outs).

Todos los promedios (AVG, OBP, SLG, ERA, WHIP, FPCT, etc.) se calculan solos
en [`js/stats.js`](js/stats.js) a partir de las líneas de cada juego — nunca
los edites a mano.

## Temporadas y playoffs

El sitio soporta varias temporadas a la vez sin perder el historial de las
anteriores:

- **`CURRENT_SEASON`** (`js/data.js`) es la temporada actual — por
  convención siempre `SEASONS.length === TEAM.seasonsTotal`, así que avanza
  sola en cuanto agregas una temporada a `SEASONS` (ver el checklist abajo).
  Resumen, Bateo/Pitcheo/Fildeo, medallas y demás vistas de "esta temporada"
  filtran `GAMES` con `currentSeasonGames()` (`js/stats.js`), que solo deja
  pasar los juegos con `season === CURRENT_SEASON`. El detalle de un juego
  puntual (link directo) y la pestaña **Temporadas** (`#/temporadas`,
  [`js/views/temporadas.js`](js/views/temporadas.js)) sí pueden mostrar
  cualquier temporada — ahí es donde se consulta el historial completo:
  récord, líderes, tabla de posiciones final (`STANDINGS_HISTORY`) y los
  juegos de cada temporada pasada.
- **`PLAYOFFS`** (`js/data.js`) guarda los juegos de postemporada, aparte de
  `GAMES` — mismo esquema exacto que un juego regular (batting/pitching/
  fielding/etc.), así que reutilizan tal cual el box score y la votación de
  MVP de un juego normal. Se organiza por temporada y rondas (cada ronda es
  una serie a mejor de 3 contra un rival); no hace falta capturar el
  formato completo del torneo de antemano, solo vas agregando la ronda que
  se juegue. Marcar `isFinal: true` en la ronda que sea la final hace que la
  temporada se marque "🏆 Campeones" sola si se gana, sin bandera aparte que
  mantener (ver `playoffStatus`/`playoffSeasonStatus` en `js/stats.js`). Se
  ven en la pestaña **Playoffs** (`#/playoffs`,
  [`js/views/playoffs.js`](js/views/playoffs.js)). Admin.html tiene un
  toggle "¿Es un juego de playoffs?" al agregar un juego que arma el bloque
  de código correspondiente.

**Al abrir una temporada nueva** (checklist, también documentado junto a
`CURRENT_SEASON` en `js/data.js`):

1. Agrega una entrada a `SEASONS`, sube `TEAM.seasonsTotal` (y
   `seasonsInLeague` si sigue en la misma liga) y actualiza
   `TEAM.gamesInSeason` al calendario nuevo. Con eso `CURRENT_SEASON`
   avanza solo.
2. Copia el `STANDINGS` de ese momento (la tabla final de la temporada que
   cierra) a `STANDINGS_HISTORY`, con esa temporada como llave — si no, se
   pierde en cuanto pegues la tabla de la temporada nueva.
3. Agrega una entrada nueva a `DUES_PAID` con el número de la temporada
   nueva — la de la temporada que cierra se queda tal cual, como historial.

## Logo del equipo

`assets/logo.png` — el logo real del equipo, referenciado desde `index.html`.

## Publicar en GitHub Pages

1. Sube esta carpeta a un repositorio nuevo de GitHub.
2. En el repo, ve a **Settings → Pages** y en "Build and deployment" elige
   **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. En un par de minutos la página estará en
   `https://tu-usuario.github.io/tu-repo/`.

## Estructura del proyecto

```
index.html          shell de la app (incluye la pantalla de bienvenida y la de recuperar contraseña)
admin.html            herramienta local: genera el código para pegar en data.js
lineup/index.html       herramienta local: sugiere alineación según quién asiste (se abre como /lineup)
manifest.webmanifest      metadatos del PWA (nombre, iconos, colores)
sw.js                       service worker: hace que la página abra sin señal
css/styles.css               estilos
css/admin.css                 estilos de admin.html y lineup/
js/data.js                     roster, juegos, playoffs y temporadas (lo editas tú cada semana)
js/stats.js                     cálculo de promedios, totales, récords y estatus de playoffs
js/ui.js                         tabla ordenable reutilizable
js/charts.js                      gráficas en SVG (tendencia de bateo)
js/lineup.js                       motor de alineación (defensa + orden al bat)
js/main.js                          router de las pestañas
js/splash.js                         pantalla de bienvenida (video + "soy jugador"/"soy invitado" + login)
js/recovery.js                        pantalla de "nueva contraseña" (link de recuperación de Supabase)
js/auth.js                           sesión de Supabase (login, logout, recuperar contraseña)
js/db.js                              consultas a Supabase (RSVP, votos, walkup, comentarios)
js/supabase-config.js                  URL y llave del proyecto (se llenan una vez, ver arriba)
js/admin.js                             lógica de admin.html
js/lineup-tool.js                        lógica de lineup/index.html
js/views/                                 una vista por pestaña (comparar.js va dentro de alineacion.js;
                                            bateo/pitcheo/fildeo.js viven juntos bajo la pestaña Estadísticas)
supabase/schema.sql                        tablas y permisos — se corre una vez en Supabase, no automático
assets/logo.png                             logo del equipo
assets/video.mp4                             video de fondo de la pantalla de bienvenida
assets/sponsors/*.png                        logos de patrocinadores (ver SPONSORS en js/data.js)
assets/thumbnail.png                         preview al compartir el link (1200x630)
assets/icon-*.png                             iconos del PWA (192, 512 y maskable)
```

## Instalable y sin señal (PWA)

La página se puede "agregar a inicio" desde el celular y abre aunque no haya
datos en el campo. El service worker (`sw.js`) pide siempre primero a la red
y solo usa la caché cuando no hay internet, así que **al subir cambios a
`data.js` se ven en cuanto haya señal** — no hay que hacer nada extra.

Solo si cambias la estrategia de caché o quieres forzar que todos los
celulares tiren lo guardado, sube `CACHE_VERSION` dentro de `sw.js`.

El video de la pantalla de bienvenida (`assets/video.mp4`) es pesado a
propósito y NO va en la caché del service worker: se pide directo a la red
solo cuando de veras se muestra la pantalla, y nunca en el primer arranque
offline.

## Preview al compartir el link

Los meta tags de `index.html` (Open Graph) apuntan a la URL pública en
absoluto, porque WhatsApp y Facebook no resuelven rutas relativas. **Si algún
día pones dominio propio hay que actualizar esas URLs** (`og:url`,
`og:image`, `twitter:image` y `canonical`).

## Cuentas de jugador (Supabase)

El sitio en sí sigue siendo estático (sin build, sin servidor propio), pero
ahora hay una capa opcional de cuentas para que los jugadores puedan
confirmar asistencia, votar MVP, editar su canción de entrada y sus
posiciones registradas, y comentar — todo con
[Supabase](https://supabase.com) (base de datos + login en un solo servicio
gratuito). Las posiciones que edita cada quien en su perfil reemplazan las
de `data.js` en Roster y en el generador de alineación — no son solo
informativas.

**Sin configurar, el sitio funciona exactamente igual que antes** — la
pantalla de bienvenida no ofrece "Soy jugador" hasta que se complete este
paso único:

1. Crea una cuenta y un proyecto gratis en supabase.com.
2. En el SQL Editor de tu proyecto, pega y corre **una sola vez** el
   contenido de [`supabase/schema.sql`](supabase/schema.sql) — crea todas
   las tablas y sus reglas de permisos.
3. En **Project Settings → API**, copia el *Project URL* y la *anon public
   key* y pégalos en [`js/supabase-config.js`](js/supabase-config.js).
4. En **Authentication → URL Configuration**, agrega la URL pública del
   sitio (la de GitHub Pages, o la de Vercel si usas ese mirror) a
   "Redirect URLs" — sin esto, el correo de "olvidé mi contraseña" no va a
   funcionar (ver `resetPassword()` en `js/auth.js`).

**No hay auto-registro.** Cada cuenta la das de alta tú mismo, dos pasos
cortos en el panel de Supabase (sin código) por cada jugador nuevo:

- **Authentication → Users → Add user**: su correo + una contraseña
  temporal — activa "Auto Confirm User" para que funcione de inmediato. El
  jugador puede cambiar esa contraseña después, desde el propio sitio, o
  restablecerla solo con "¿Olvidaste tu contraseña?" si la olvida.
- **Table Editor → `player_whitelist`**: una fila con ese mismo correo y su
  `id` de `js/data.js` (ej. `"p15"`) — así la app sabe qué jugador es cada
  cuenta.

### Pantalla de bienvenida y login

Al entrar al sitio (una vez por sesión del navegador) aparece una pantalla
de bienvenida ([`js/splash.js`](js/splash.js)) con el video de fondo y dos
botones: "Soy invitado" entra directo al sitio de siempre; "Soy jugador"
muestra ahí mismo un formulario de correo/contraseña — ya no existe una
página de login aparte. Si ya tenías una sesión guardada de una visita
anterior, la pantalla se salta sola. Cerrar sesión regresa a esta misma
pantalla.

Si un jugador olvida su contraseña, "¿Olvidaste tu contraseña?" (en esa
misma pantalla, o en el login de `admin.html`) manda un correo de
recuperación de Supabase; al abrirlo, el sitio muestra un formulario para
poner una contraseña nueva ([`js/recovery.js`](js/recovery.js)) — necesita
el paso 4 de arriba (Redirect URLs) configurado para funcionar.

### Qué es exclusivo de cuentas con sesión iniciada

A petición expresa, estas partes del sitio son privadas — solo se ven con
sesión iniciada, el resto sigue siendo de lectura pública para cualquiera:

- Leer y escribir comentarios en un juego.
- El medallero (logros) de cualquier perfil de jugador.
- Los conteos de votos de MVP mientras la votación sigue abierta (los
  resultados de un juego ya cerrado siguen siendo públicos).

La tabla `player_dues` (quién pagó la inscripción) **ya no existe en
Supabase** — se movió por completo a `DUES_PAID` en `js/data.js` (ver
arriba), igual que el resto de los datos estáticos del sitio.

## Notas

- No se necesita build ni instalar dependencias: corre directo en el
  navegador con módulos JS nativos. El cliente de Supabase se carga por CDN
  (`js/auth.js`), igual que Font Awesome — no agrega ningún paso de build.
- El sitio es de solo lectura para cualquiera que entre sin cuenta; tú
  sigues controlando los datos del roster/juegos/playoffs/temporadas
  editando `js/data.js` y subiendo los cambios por git, como siempre.
