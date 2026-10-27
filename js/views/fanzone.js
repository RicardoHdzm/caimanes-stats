// Fanzone: cualquier visitante arma un wallpaper para su celular con el
// logo del equipo, un nombre y un número de jersey (estilo playera), y
// elige los colores — con presets o a mano. El dibujo vive en
// wallpaperCanvas() de js/flyers.js; aquí solo el formulario, la vista
// previa y Descargar/Compartir. Lo último que se eligió se recuerda en
// este navegador (localStorage), para no volver a capturarlo.
import { ROSTER } from "../data.js";
import { heading, escapeHtml } from "../ui.js";
import { wallpaperCanvas } from "../flyers.js";

const STORAGE_KEY = "caimanes-wallpaper";

const PRESETS = [
  { id: "caimanes", label: "Caimanes", bg: "#0b0b0c", fg: "#e2202f", outline: "#ffffff" },
  { id: "plata", label: "Plata", bg: "#000000", fg: "#c4c8cc", outline: null },
  { id: "rojo", label: "Rojo", bg: "#c8102e", fg: "#ffffff", outline: null },
  { id: "blanco", label: "Blanco", bg: "#f2f3f5", fg: "#e2202f", outline: "#111111" },
  { id: "eclipse", label: "Eclipse", bg: "#0a0e18", fg: "#ffffff", outline: "#bf0f35" },
  { id: "dorado", label: "Dorado", bg: "#0b0b0c", fg: "#f5b942", outline: null },
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

  const first = PRESETS[0];
  const state = {
    playerId: "",
    name: "CAIMANES",
    number: "1",
    bg: first.bg,
    fg: first.fg,
    outline: first.outline,
    ...loadState(),
  };

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

      <span class="fz-label">Colores</span>
      <div class="fz-presets">
        ${PRESETS.map(
          (p) => `
            <button type="button" class="fz-preset" data-preset="${p.id}" title="${p.label}">
              <span class="fz-swatch" style="background:${p.bg};color:${p.fg};${p.outline ? `-webkit-text-stroke:1px ${p.outline};` : ""}">8</span>
              <span>${p.label}</span>
            </button>
          `
        ).join("")}
      </div>
      <div class="fz-custom">
        <label class="fz-color"><input id="fz-bg" type="color" /><span>Fondo</span></label>
        <label class="fz-color"><input id="fz-fg" type="color" /><span>Letras</span></label>
        <label class="fz-color">
          <input id="fz-outline" type="color" />
          <span><input id="fz-outline-on" type="checkbox" /> Contorno</span>
        </label>
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
  const bgIn = $("#fz-bg");
  const fgIn = $("#fz-fg");
  const outlineIn = $("#fz-outline");
  const outlineOn = $("#fz-outline-on");
  const img = $("#fz-img");
  const download = $("#fz-download");
  const shareBtn = $("#fz-share");

  function syncInputs() {
    playerSel.value = ROSTER.some((p) => p.id === state.playerId) ? state.playerId : "";
    nameIn.value = state.name;
    numberIn.value = state.number;
    bgIn.value = state.bg;
    fgIn.value = state.fg;
    outlineOn.checked = !!state.outline;
    outlineIn.value = state.outline ?? "#ffffff";
    outlineIn.disabled = !state.outline;
    for (const b of wrap.querySelectorAll(".fz-preset")) {
      const p = PRESETS.find((x) => x.id === b.dataset.preset);
      b.classList.toggle("active", p.bg === state.bg && p.fg === state.fg && (p.outline ?? null) === (state.outline ?? null));
    }
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
      const canvas = await wallpaperCanvas(state);
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
    update({ playerId: p.id, name: surnameOf(p).toUpperCase(), number: p.number != null ? String(p.number) : "" });
  });
  nameIn.addEventListener("input", () => {
    state.name = nameIn.value.toUpperCase();
    render();
  });
  numberIn.addEventListener("input", () => {
    numberIn.value = numberIn.value.replace(/\D/g, "").slice(0, 2);
    state.number = numberIn.value;
    render();
  });
  wrap.querySelector(".fz-presets").addEventListener("click", (e) => {
    const btn = e.target.closest(".fz-preset");
    if (!btn) return;
    const p = PRESETS.find((x) => x.id === btn.dataset.preset);
    update({ bg: p.bg, fg: p.fg, outline: p.outline });
  });
  bgIn.addEventListener("input", () => update({ bg: bgIn.value }));
  fgIn.addEventListener("input", () => update({ fg: fgIn.value }));
  outlineIn.addEventListener("input", () => update({ outline: outlineIn.value }));
  outlineOn.addEventListener("change", () => update({ outline: outlineOn.checked ? outlineIn.value || "#ffffff" : null }));

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
