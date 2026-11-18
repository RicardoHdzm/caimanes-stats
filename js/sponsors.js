// Logos de patrocinadores — los usan la portada del softbol (SPONSORS en
// js/data.js, ver js/views/home.js) y la de Caimanes FC (FC_SPONSORS en
// js/fc/data.js, ver js/fc/views.js). Estilos: .home-sponsor-logo
// en css/styles.css (se invierten a blanco solos en los temas oscuros).
//
// Los logos vienen de todas formas (cuadrados, 6:1, con mucho margen
// transparente...), así que a la misma altura se ven disparejos. Al cargar
// cada uno: (1) se recorta su margen transparente (canvas, mismo origen) y
// (2) se le da un tamaño de peso visual parejo en vez de altura pareja —
// un logo ancho queda más bajito y uno cuadrado más alto. Alto = BASE /
// proporción^0.6 (con 0.5 sería área idéntica; 0.6 encoge un poco más a
// los muy horizontales, que por ser letras gruesas "pesan" más).
const SPONSOR_LOGO_BASE_H = 80; // alto de un logo cuadrado
const SPONSOR_LOGO_EXPONENT = 0.6;

export function fitSponsorLogo(img) {
  if (img.dataset.fitted) return;
  img.dataset.fitted = "1";
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return;
  let box = { x: 0, y: 0, w, h };
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const alpha = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (alpha[(y * w + x) * 4 + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX >= minX && (minX > 0 || minY > 0 || maxX < w - 1 || maxY < h - 1)) {
      box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      const crop = document.createElement("canvas");
      crop.width = box.w;
      crop.height = box.h;
      crop.getContext("2d").drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      img.src = crop.toDataURL("image/png");
    }
  } catch {
    // Sin canvas (o la imagen no se puede leer): se queda sin recortar,
    // nomás con el tamaño parejo de abajo.
  }
  const ratio = box.w / box.h;
  const height = Math.min(SPONSOR_LOGO_BASE_H / ratio ** SPONSOR_LOGO_EXPONENT, SPONSOR_LOGO_BASE_H);
  img.style.height = `${height.toFixed(1)}px`;
  img.style.width = `${(height * ratio).toFixed(1)}px`;
}
