# Caimanes de Villas — Stats

Página estática (sin servidor, sin base de datos) para llevar las estadísticas
del equipo: roster, bateo, pitcheo, fildeo y resultados de juegos. Se hostea
gratis en **GitHub Pages**.

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
- **`GAMES`**: agrega un objeto por juego jugado, con el marcador y un arreglo
  `batting`, `pitching` y `fielding` con una línea por jugador que participó
  en cada rubro (si un jugador no bateó/pitcheó/fildeó ese juego, simplemente
  no lo incluyas en ese arreglo).
- **`STANDINGS`**: la tabla de posiciones de la liga, se copia tal cual la
  publican (no se calcula sola). Actualízala a mano cada vez que la liga
  saque una nueva.

Las entradas pitcheadas (`IP`) usan la notación estándar de béisbol/softbol:
`.1` = 1 out, `.2` = 2 outs (ej. `4.2` = 4 entradas completas + 2 outs).

Todos los promedios (AVG, OBP, SLG, ERA, WHIP, FPCT, etc.) se calculan solos
en [`js/stats.js`](js/stats.js) a partir de las líneas de cada juego — nunca
los edites a mano.

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
index.html          shell de la app
admin.html            herramienta local: genera el código para pegar en data.js
lineup/index.html       herramienta local: sugiere alineación según quién asiste (se abre como /lineup)
manifest.webmanifest      metadatos del PWA (nombre, iconos, colores)
sw.js                       service worker: hace que la página abra sin señal
css/styles.css               estilos
css/admin.css                 estilos de admin.html y lineup/
js/data.js                     roster y juegos (lo editas tú cada semana)
js/stats.js                     cálculo de promedios, totales y récords
js/ui.js                         tabla ordenable reutilizable
js/charts.js                      gráficas en SVG (tendencia de bateo)
js/lineup.js                       motor de alineación (defensa + orden al bat)
js/main.js                          router de las pestañas
js/auth.js                           sesión de Supabase + botón de login del header
js/db.js                              consultas a Supabase (RSVP, votos, walkup, pagos, comentarios)
js/supabase-config.js                  URL y llave del proyecto (se llenan una vez, ver arriba)
js/admin.js                             lógica de admin.html
js/lineup-tool.js                        lógica de lineup/index.html
js/views/                                 una vista por pestaña (comparar.js va dentro de alineacion.js)
supabase/schema.sql                        tablas y permisos — se corre una vez en Supabase, no automático
assets/logo.png                             logo del equipo
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

## Preview al compartir el link

Los meta tags de `index.html` (Open Graph) apuntan a la URL pública en
absoluto, porque WhatsApp y Facebook no resuelven rutas relativas. **Si algún
día pones dominio propio hay que actualizar esas URLs** (`og:url`,
`og:image`, `twitter:image` y `canonical`).

## Cuentas de jugador (Supabase)

El sitio en sí sigue siendo estático (sin build, sin servidor propio), pero
ahora hay una capa opcional de cuentas para que los jugadores puedan
confirmar asistencia, votar MVP, editar su canción de entrada, comentar y
ver quién ya pagó su inscripción — todo con [Supabase](https://supabase.com)
(base de datos + login en un solo servicio gratuito).

**Sin configurar, el sitio funciona exactamente igual que antes** — el botón
de sesión ni siquiera aparece hasta que se complete este paso único:

1. Crea una cuenta y un proyecto gratis en supabase.com.
2. En el SQL Editor de tu proyecto, pega y corre **una sola vez** el
   contenido de [`supabase/schema.sql`](supabase/schema.sql) — crea todas
   las tablas y sus reglas de permisos.
3. En **Project Settings → API**, copia el *Project URL* y la *anon public
   key* y pégalos en [`js/supabase-config.js`](js/supabase-config.js).

**No hay auto-registro.** Cada cuenta la das de alta tú mismo, dos pasos
cortos en el panel de Supabase (sin código) por cada jugador nuevo:

- **Authentication → Users → Add user**: su correo + una contraseña
  temporal — activa "Auto Confirm User" para que funcione de inmediato. El
  jugador puede cambiar esa contraseña después, desde el propio sitio.
- **Table Editor → `player_whitelist`**: una fila con ese mismo correo y su
  `id` de `js/data.js` (ej. `"p15"`) — así la app sabe qué jugador es cada
  cuenta.

La tabla `player_dues` (quién pagó la inscripción) es la única que no es de
lectura pública — solo la ven cuentas con sesión iniciada, y solo tu propia
cuenta (por correo, ver `supabase/schema.sql`) puede editarla.

## Notas

- No se necesita build ni instalar dependencias: corre directo en el
  navegador con módulos JS nativos. El cliente de Supabase se carga por CDN
  (`js/auth.js`), igual que Font Awesome — no agrega ningún paso de build.
- El sitio es de solo lectura para cualquiera que entre sin cuenta; tú
  sigues controlando los datos del roster/juegos editando `js/data.js` y
  subiendo los cambios por git, como siempre.
