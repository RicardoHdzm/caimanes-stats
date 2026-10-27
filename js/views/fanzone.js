// Fanzone: cualquier visitante arma un wallpaper para su celular con el
// logo del equipo, un nombre y un número de jersey (estilo playera), y
// elige entre dos estilos de color: Clásico y Moderno. El dibujo vive en
// wallpaperCanvas() de js/flyers.js; aquí solo el formulario, la vista
// previa y Descargar/Compartir. Lo último que se eligió se recuerda en
// este navegador (localStorage), para no volver a capturarlo.
import { ROSTER } from "../data.js";
import { heading, escapeHtml } from "../ui.js";
import { wallpaperCanvas, stripAccents } from "../flyers.js";

const STORAGE_KEY = "caimanes-wallpaper";

// Solo dos estilos (a petición expresa), con el diseño de Ricardo: Clásico
// (azul marino, letras blancas con sombra) primero y Moderno (negro, rojo).
const STYLES = [
  { id: "clasico", label: "Clásico", bg: "#111827", fg: "#ffffff", logo: "white", shadow: true },
  { id: "moderno", label: "Moderno", bg: "#000000", fg: "#d31245", logo: "red", shadow: false },
];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object") return saved;
  } catch {
    // Sin almacenamiento disponible: arranca con el preset de Caimanes.
  }
  return null;
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Nada que hacer — solo es una comodidad.
  }
}

// "Luis Fernando Lugo" -> "LUGO" (el apellido de la playera). Se puede
// editar a mano después.
function surnameOf(player) {
  const parts = (player?.name ?? "").trim().split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

export function renderFanzone(container) {
  heading(container, "Fanzone");

  const saved = loadState() ?? {};
  const state = {
    playerId: saved.playerId ?? "",
    name: stripAccents(saved.name ?? "CAIMANES"),
    number: saved.number ?? "1",
    // Lo guardado de antes (colores sueltos) cae al primer estilo.
    style: STYLES.some((st) => st.id === saved.style) ? saved.style : STYLES[0].id,
  };
  const styleOf = () => STYLES.find((st) => st.id === state.style) ?? STYLES[0];

  const wrap = document.createElement("div");
  wrap.className = "fanzone";
  wrap.innerHTML = `
    <div class="leader-card fanzone-form">
      <h3><i class="fa-solid fa-mobile-screen"></i>Wallpaper para tu celular</h3>
      <label class="fz-field">
        <span>Jugador</span>
        <select id="fz-player">
          <option value="">— Elige un jugador (opcional) —</option>
          ${[...ROSTER]
            .sort((a, b) => a.name.localeCompare(b.name, "es"))
            .map((p) => `<option value="${p.id}">#${p.number ?? "-"} ${escapeHtml(p.name)}</option>`)
            .join("")}
        </select>
      </label>
      <div class="fz-row">
        <label class="fz-field fz-field--grow">
          <span>Nombre</span>
          <input id="fz-name" type="text" maxlength="14" autocomplete="off" />
        </label>
        <label class="fz-field fz-field--number">
          <span>Número</span>
          <input id="fz-number" type="text" inputmode="numeric" maxlength="2" autocomplete="off" />
        </label>
      </div>

      <span class="fz-label">Estilo</span>
      <div class="fz-presets">
        ${STYLES.map(
          (st) => `
            <button type="button" class="fz-preset" data-style="${st.id}" title="${st.label}">
              <span class="fz-swatch" style="background:${st.bg};color:${st.fg};">8</span>
              <span>${st.label}</span>
            </button>
          `
        ).join("")}
      </div>

      <div class="fz-actions">
        <button type="button" class="flyer-btn flyer-btn--share" id="fz-share" hidden><i class="fa-solid fa-share-nodes"></i> Compartir</button>
        <a class="flyer-btn flyer-btn--download" id="fz-download"><i class="fa-solid fa-download"></i> Descargar</a>
      </div>
    </div>
    <div class="fanzone-preview">
      <div class="fz-phone"><img id="fz-img" alt="Vista previa del wallpaper" /></div>
    </div>
  `;
  container.appendChild(wrap);

  const $ = (sel) => wrap.querySelector(sel);
  const playerSel = $("#fz-player");
  const nameIn = $("#fz-name");
  const numberIn = $("#fz-number");
  const img = $("#fz-img");
  const download = $("#fz-download");
  const shareBtn = $("#fz-share");

  function syncInputs() {
    playerSel.value = ROSTER.some((p) => p.id === state.playerId) ? state.playerId : "";
    nameIn.value = state.name;
    numberIn.value = state.number;
    for (const btn of wrap.querySelectorAll(".fz-preset")) btn.classList.toggle("active", btn.dataset.style === state.style);
  }

  let currentFile = null;
  let currentUrl = null;
  let timer = null;
  let token = 0;
  function render() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const mine = ++token;
      saveState(state);
      const canvas = await wallpaperCanvas({ name: state.name, number: state.number, style: styleOf() });
      const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      if (mine !== token || !blob || !img.isConnected) return;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = URL.createObjectURL(blob);
      img.src = currentUrl;
      const filename = `wallpaper-caimanes-${(state.name || "fan").toLowerCase().replace(/[^a-z0-9ñáéíóú]+/gi, "-")}-${state.number || "0"}.png`;
      download.href = currentUrl;
      download.download = filename;
      currentFile = new File([blob], filename, { type: "image/png" });
      shareBtn.hidden = !navigator.canShare?.({ files: [currentFile] });
    }, 120);
  }

  function update(patch) {
    Object.assign(state, patch);
    syncInputs();
    render();
  }

  playerSel.addEventListener("change", () => {
    const p = ROSTER.find((x) => x.id === playerSel.value);
    if (!p) return update({ playerId: "" });
    update({ playerId: p.id, name: stripAccents(surnameOf(p)).toUpperCase(), number: p.number != null ? String(p.number) : "" });
  });
  nameIn.addEventListener("input", () => {
    // Sin acentos, también si se escribe a mano.
    const clean = stripAccents(nameIn.value).toUpperCase();
    if (clean !== nameIn.value) nameIn.value = clean;
    state.name = clean;
    render();
  });
  numberIn.addEventListener("input", () => {
    numberIn.value = numberIn.value.replace(/\D/g, "").slice(0, 2);
    state.number = numberIn.value;
    render();
  });
  wrap.querySelector(".fz-presets").addEventListener("click", (e) => {
    const btn = e.target.closest(".fz-preset");
    if (btn) update({ style: btn.dataset.style });
  });

  shareBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    try {
      await navigator.share({ files: [currentFile], text: "Mi wallpaper de Caimanes de Villas" });
    } catch {
      // Cancelado — nada que hacer.
    }
  });

  syncInputs();
  render();
}
