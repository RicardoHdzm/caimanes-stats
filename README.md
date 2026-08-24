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
- **`INSTAGRAM_POSTS`**: arreglo de links a posts de Instagram, el más nuevo
  hasta arriba. Se muestran en el Resumen con el embed oficial de Instagram
  — a diferencia del resto del sitio, **esta sección necesita internet**
  para verse (sin señal se ve un link de texto en vez de la tarjeta).

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
manifest.webmanifest   metadatos del PWA (nombre, iconos, colores)
sw.js                   service worker: hace que la página abra sin señal
css/styles.css           estilos
css/admin.css             estilos de admin.html
js/data.js                 roster y juegos (lo editas tú cada semana)
js/stats.js                 cálculo de promedios, totales y récords
js/ui.js                     tabla ordenable reutilizable
js/charts.js                  gráficas en SVG (tendencia de bateo)
js/main.js                     router de las pestañas
js/admin.js                     lógica de admin.html
js/views/                        una vista por pestaña (comparar.js va dentro de alineacion.js)
assets/logo.png                   logo del equipo
assets/thumbnail.png               preview al compartir el link (1200x630)
assets/icon-*.png                   iconos del PWA (192, 512 y maskable)
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

## Notas

- No se necesita build ni instalar dependencias: corre directo en el
  navegador con módulos JS nativos.
- No hay login ni base de datos todavía — es un sitio de solo lectura para
  cualquiera que entre al link, y tú controlas los datos editando el código.
  Si más adelante quieres que los jugadores capturen sus propias stats o
  necesitas cuentas de usuario, se puede migrar a Supabase más adelante.
