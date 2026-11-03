// The Look tuner (3 November 2026): a developer sidebar of live sliders for the art pass. The light, the shadows, the materials and
// their textures, the water, the air, a colour grade, the resolution and antialiasing, changed while a shift plays and seen at once,
// kept for each venue (or for all of them), and copied out as the numbers a venue's own look can then be given.
//
// The creator: "create, in settings, a developer sidebar and add a lot of sliders that alter the materials, the textures, and the
// lighting, even this toggle for the anti-aliasing on Retina screens. And make sure that we see the changes in real time… on each
// venue, we might have different default settings… so I can choose the best combination for the visual perspective."
//
// Only in dev mode (dev.mjs): with dev mode off the game draws as it always has. Nothing here touches the simulation. The values
// are put to work by scene/look.mjs, just before the world is drawn.

export const LOOK_KEY = "pool-panic.look.v1";

const pct = (v) => Math.round(v * 100) + "%";
const times = (v) => "×" + v.toFixed(2);
// Every knob: its group, its label, what it does (`help`), and its range or its choices. `def` is how the game draws without it.
export const KNOBS = [
  { group: "Light", id: "exposure", label: "Exposure", min: 0.3, max: 2.5, step: 0.01, def: 1, show: times },
  { group: "Light", id: "sun", label: "Sun", min: 0, max: 3, step: 0.01, def: 1, show: times },
  {
    group: "Light",
    id: "sky",
    label: "Sky light",
    min: 0,
    max: 3,
    step: 0.01,
    def: 1,
    show: times,
    help: "the ambient",
  },
  { group: "Light", id: "fill", label: "Fill light", min: 0, max: 3, step: 0.01, def: 1, show: times },
  { group: "Light", id: "env", label: "Reflections", min: 0, max: 3, step: 0.01, def: 1, show: times },
  {
    group: "Light",
    id: "warmth",
    label: "Sun warmth",
    min: -1,
    max: 1,
    step: 0.01,
    def: 0,
    show: (v) => (v > 0 ? "warm " : v < 0 ? "cool " : "") + Math.round(Math.abs(v) * 100),
  },
  { group: "Light", id: "sunHeight", label: "Sun height", min: 0.3, max: 2, step: 0.01, def: 1, show: times },
  {
    group: "Light",
    id: "tone",
    label: "Tone mapping",
    choices: [
      ["aces", "ACES filmic"],
      ["agx", "AgX"],
      ["neutral", "Neutral"],
      ["reinhard", "Reinhard"],
      ["cineon", "Cineon"],
      ["linear", "Linear"],
    ],
    def: "aces",
  },
  { group: "Shadows", id: "shadows", label: "Shadows", toggle: true, def: true },
  {
    group: "Shadows",
    id: "shadowStrength",
    label: "Darkness",
    min: 0,
    max: 1,
    step: 0.01,
    def: 1,
    show: pct,
  },
  {
    group: "Shadows",
    id: "shadowType",
    label: "Edges",
    choices: [
      ["pcfsoft", "Soft (PCF soft)"],
      ["pcf", "Filtered (PCF)"],
      ["vsm", "Blurred (VSM)"],
      ["basic", "Hard"],
    ],
    def: "pcfsoft",
  },
  {
    group: "Shadows",
    id: "shadowSize",
    label: "Shadow map",
    choices: [
      ["auto", "As the quality"],
      ["512", "512"],
      ["1024", "1024"],
      ["2048", "2048"],
      ["4096", "4096"],
    ],
    def: "auto",
  },
  {
    group: "Shadows",
    id: "shadowBlur",
    label: "Blur",
    min: 0,
    max: 12,
    step: 0.5,
    def: 4,
    show: (v) => v.toFixed(1),
    help: "filtered and blurred edges",
  },
  {
    group: "Materials",
    id: "albedo",
    label: "Texture brightness",
    min: 0.4,
    max: 1.6,
    step: 0.01,
    def: 1,
    show: times,
  },
  { group: "Materials", id: "rough", label: "Roughness", min: 0.25, max: 2, step: 0.01, def: 1, show: times },
  { group: "Materials", id: "metal", label: "Metalness", min: 0, max: 3, step: 0.01, def: 1, show: times },
  {
    group: "Materials",
    id: "normal",
    label: "Surface detail",
    min: 0,
    max: 3,
    step: 0.01,
    def: 1,
    show: times,
    help: "the normal maps",
  },
  {
    group: "Materials",
    id: "ao",
    label: "Contact shade",
    min: 0,
    max: 2,
    step: 0.01,
    def: 1,
    show: times,
    help: "ambient occlusion",
  },
  {
    group: "Materials",
    id: "glow",
    label: "Glow",
    min: 0,
    max: 3,
    step: 0.01,
    def: 1,
    show: times,
    help: "emissive",
  },
  {
    group: "Textures",
    id: "aniso",
    label: "Sharpness at an angle",
    choices: [
      ["auto", "As the quality"],
      ["1", "Off"],
      ["2", "2×"],
      ["4", "4×"],
      ["8", "8×"],
      ["16", "16×"],
    ],
    def: "auto",
  },
  {
    group: "Water",
    id: "waterLight",
    label: "Water brightness",
    min: 0.3,
    max: 2,
    step: 0.01,
    def: 1,
    show: times,
  },
  { group: "Water", id: "caustics", label: "Caustics", min: 0, max: 3, step: 0.01, def: 1, show: times },
  { group: "Air", id: "fog", label: "Fog", toggle: true, def: true },
  {
    group: "Air",
    id: "fogDistance",
    label: "Fog distance",
    min: 0.3,
    max: 3,
    step: 0.01,
    def: 1,
    show: times,
  },
  {
    group: "Colour grade",
    id: "saturation",
    label: "Saturation",
    min: 0,
    max: 2,
    step: 0.01,
    def: 1,
    show: pct,
  },
  {
    group: "Colour grade",
    id: "contrast",
    label: "Contrast",
    min: 0.5,
    max: 1.6,
    step: 0.01,
    def: 1,
    show: pct,
  },
  {
    group: "Colour grade",
    id: "brightness",
    label: "Brightness",
    min: 0.5,
    max: 1.6,
    step: 0.01,
    def: 1,
    show: pct,
  },
  { group: "Colour grade", id: "tint", label: "Warm tint", min: 0, max: 0.6, step: 0.01, def: 0, show: pct },
  {
    group: "Colour grade",
    id: "hue",
    label: "Hue shift",
    min: -40,
    max: 40,
    step: 1,
    def: 0,
    show: (v) => Math.round(v) + "°",
  },
  { group: "Colour grade", id: "vignette", label: "Vignette", min: 0, max: 1, step: 0.01, def: 0, show: pct },
  {
    group: "Resolution",
    id: "scale",
    label: "Pixel ratio",
    choices: [
      ["auto", "As the quality"],
      ["0.5", "0.5"],
      ["0.75", "0.75"],
      ["1", "1"],
      ["1.25", "1.25"],
      ["1.5", "1.5"],
      ["1.7", "1.7"],
      ["2", "2"],
      ["2.5", "2.5"],
    ],
    def: "auto",
    help: "a Retina screen draws 1.7 by default",
  },
  // (The one knob that cannot change while the game draws: antialiasing is chosen when the drawing surface is made, so switching it
  // restarts the game, back at the menu. It is for every venue.)
  {
    group: "Resolution",
    id: "aa",
    label: "Antialiasing",
    toggle: true,
    def: true,
    global: true,
    help: "restarts the game",
  },
];
export const KNOB = Object.fromEntries(KNOBS.map((k) => [k.id, k]));
export const LOOK_DEFAULTS = Object.freeze(Object.fromEntries(KNOBS.map((k) => [k.id, k.def])));

// A knob's value made good: a number in its range, one of its choices, or a switch.
export function knobValue(id, v) {
  const k = KNOB[id];
  if (!k) return undefined;
  if (k.toggle) return typeof v === "boolean" ? v : k.def;
  if (k.choices) return k.choices.some(([c]) => c === String(v)) ? String(v) : k.def;
  const n = Number(v);
  return Number.isFinite(n) && v !== null && v !== "" ? Math.min(k.max, Math.max(k.min, n)) : k.def;
}
const clean = (values = {}) => {
  const out = {};
  for (const [id, v] of Object.entries(values || {}))
    if (KNOB[id] && knobValue(id, v) !== KNOB[id].def) out[id] = knobValue(id, v);
  return out;
};
// The saved tuner: `all` (every venue), `venues` (one each, over `all`), and where the sidebar was left.
export function normalizeLook(saved = {}) {
  const venues = {};
  for (const [id, v] of Object.entries(saved?.venues || {})) {
    const c = clean(v);
    for (const k of Object.keys(c)) if (KNOB[k].global) delete c[k];
    if (Object.keys(c).length) venues[id] = c;
  }
  return {
    all: clean(saved?.all),
    venues,
    scope: saved?.scope === "all" ? "all" : "venue",
    open: saved?.open === true,
  };
}
export function readLook(storage) {
  try {
    return normalizeLook(JSON.parse(storage?.getItem(LOOK_KEY) || "{}"));
  } catch {
    return normalizeLook();
  }
}
export function writeLook(storage, look) {
  try {
    storage?.setItem(LOOK_KEY, JSON.stringify(look));
  } catch {}
}
// What a venue draws with: the defaults, then every venue's, then its own.
export const lookFor = (look, venue) => ({ ...LOOK_DEFAULTS, ...look.all, ...(look.venues[venue] || {}) });
// The knobs that differ from the game's own look.
export const lookDiff = (values) => clean(values);
// Antialiasing off, read at launch (before the drawing surface is made), only in dev mode.
export const antialiasOff = (storage, dev) => !!dev && readLook(storage).all.aa === false;

// The colour grade as a CSS filter on the drawing surface ("" when it is the game's own).
export function gradeFilter(v) {
  const parts = [];
  if (v.saturation !== 1) parts.push(`saturate(${v.saturation})`);
  if (v.contrast !== 1) parts.push(`contrast(${v.contrast})`);
  if (v.brightness !== 1) parts.push(`brightness(${v.brightness})`);
  if (v.tint) parts.push(`sepia(${v.tint})`);
  if (v.hue) parts.push(`hue-rotate(${v.hue}deg)`);
  return parts.join(" ");
}

// ---- the sidebar ---------------------------------------------------------------------------------------------------------------
// `venue()` is the venue being drawn ({ id, name }); `changed()` is told when a value changes; `restart()` reloads the game (for
// antialiasing); `freeze(on)` holds the shift while you look (or lets it go on).
export function installLookTuner({
  storage,
  venue,
  changed = () => {},
  restart = () => {},
  freeze = () => {},
}) {
  let look = readLook(storage);
  let cache = { key: null, values: null };
  let frozen = false;
  const root = document.createElement("aside");
  root.id = "look-tuner";
  root.className = "look-tuner";
  root.setAttribute("aria-label", "Look tuner");
  root.hidden = true;
  const groups = [...new Set(KNOBS.map((k) => k.group))];
  const row = (k) => {
    const id = "lk-" + k.id;
    const input = k.toggle
      ? `<input type="checkbox" id="${id}" data-knob="${k.id}">`
      : k.choices
        ? `<select id="${id}" data-knob="${k.id}">${k.choices.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>`
        : `<input type="range" id="${id}" data-knob="${k.id}" min="${k.min}" max="${k.max}" step="${k.step}">`;
    return `<label class="lk-row" data-row="${k.id}" title="Double-click to reset"><span class="lk-name">${k.label}${k.help ? ` <small>${k.help}</small>` : ""}</span>${input}<output data-out="${k.id}"></output></label>`;
  };
  root.innerHTML = `
    <header class="lk-head">
      <div><strong>LOOK TUNER</strong><small id="lk-venue"></small></div>
      <button class="lk-x" id="lk-close" aria-label="Close the look tuner">×</button>
    </header>
    <div class="lk-scope" role="group" aria-label="What the sliders change">
      <button data-scope="venue">This venue</button><button data-scope="all">All venues</button>
    </div>
    <label class="lk-row lk-freeze"><span class="lk-name">Freeze the shift <small>to look without the clock running</small></span><input type="checkbox" id="lk-freeze"></label>
    <div class="lk-body">${groups
      .map(
        (g) =>
          `<section><h4>${g}</h4>${KNOBS.filter((k) => k.group === g)
            .map(row)
            .join("")}</section>`,
      )
      .join("")}</div>
    <footer class="lk-foot">
      <button id="lk-copy">Copy settings</button>
      <button id="lk-reset">Reset this venue</button>
      <button id="lk-reset-all">Reset everything</button>
      <textarea id="lk-out" readonly rows="3" aria-label="The settings, to send" hidden></textarea>
    </footer>`;
  document.body.appendChild(root);
  const $$ = (s) => root.querySelector(s);
  const save = () => writeLook(storage, look);
  const here = () => venue() || { id: "club", name: "Community Pool" };
  const layer = () => (look.scope === "all" ? look.all : (look.venues[here().id] ||= {}));
  const values = (id = here().id) => {
    const key = id + "|" + JSON.stringify(look.all) + JSON.stringify(look.venues[id] || {});
    if (cache.key !== key) cache = { key, values: Object.freeze(lookFor(look, id)) };
    return cache.values;
  };
  function render() {
    const v = values(),
      own = look.venues[here().id] || {};
    $$("#lk-venue").textContent = here().name + (Object.keys(own).length ? " · its own look" : "");
    root
      .querySelectorAll("[data-scope]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.scope === look.scope)));
    for (const k of KNOBS) {
      const input = $$("#lk-" + k.id);
      if (k.toggle) input.checked = v[k.id];
      else input.value = String(v[k.id]);
      const out = $$(`[data-out="${k.id}"]`);
      out.textContent = k.toggle
        ? v[k.id]
          ? "On"
          : "Off"
        : k.choices
          ? ""
          : k.show
            ? k.show(v[k.id])
            : v[k.id];
      const r = $$(`[data-row="${k.id}"]`);
      r.classList.toggle("changed", v[k.id] !== k.def);
      r.classList.toggle("venue-own", k.id in own);
      if (!k.toggle && !k.choices)
        input.style.setProperty("--fill", ((v[k.id] - k.min) / (k.max - k.min)) * 100 + "%");
    }
    $$("#lk-freeze").checked = frozen;
  }
  function set(id, raw) {
    const k = KNOB[id];
    const v = knobValue(id, raw);
    const target = k.global ? look.all : layer();
    if (v === k.def && (k.global || look.scope === "all" || !(id in look.all))) delete target[id];
    else target[id] = v;
    if (look.venues[here().id] && !Object.keys(look.venues[here().id]).length) delete look.venues[here().id];
    save();
    render();
    changed(values());
    if (id === "aa") restart();
  }
  root.addEventListener("input", (e) => {
    const id = e.target.dataset?.knob;
    if (id) set(id, KNOB[id].toggle ? e.target.checked : e.target.value);
  });
  root.addEventListener("change", (e) => {
    const id = e.target.dataset?.knob;
    if (id && (KNOB[id].toggle || KNOB[id].choices))
      set(id, KNOB[id].toggle ? e.target.checked : e.target.value);
  });
  // Double-click a row: back to how the game draws it (in the layer being changed).
  root.addEventListener("dblclick", (e) => {
    const r = e.target.closest?.("[data-row]");
    if (!r) return;
    const id = r.dataset.row;
    delete (KNOB[id].global ? look.all : layer())[id];
    save();
    render();
    changed(values());
    if (id === "aa") restart();
  });
  // (keys typed here stay here: the arrows move a slider, not the coach)
  for (const type of ["keydown", "keyup"])
    root.addEventListener(type, (e) => {
      if (e.key !== "F9") e.stopPropagation();
    });
  root.querySelectorAll("[data-scope]").forEach(
    (b) =>
      (b.onclick = () => {
        look.scope = b.dataset.scope;
        save();
        render();
      }),
  );
  $$("#lk-freeze").onchange = (e) => {
    frozen = e.target.checked;
    freeze(frozen);
  };
  $$("#lk-close").onclick = () => toggle(false);
  $$("#lk-reset").onclick = () => {
    delete look.venues[here().id];
    save();
    render();
    changed(values());
  };
  $$("#lk-reset-all").onclick = () => {
    const aa = look.all.aa;
    look = normalizeLook({ scope: look.scope, open: true });
    save();
    render();
    changed(values());
    if (aa === false) restart();
  };
  $$("#lk-copy").onclick = async () => {
    const text = copyText(look, here());
    const out = $$("#lk-out");
    out.value = text;
    out.hidden = false;
    out.select();
    try {
      await navigator.clipboard.writeText(text);
      $$("#lk-copy").textContent = "Copied ✓";
      setTimeout(() => ($$("#lk-copy").textContent = "Copy settings"), 1600);
    } catch {}
  };
  function toggle(on = root.hidden) {
    root.hidden = !on;
    document.body.classList.toggle("look-tuning", on);
    // (the view makes room for the sidebar, style.css: the world sizes its drawing to it)
    window.dispatchEvent(new Event("resize"));
    look.open = on;
    save();
    if (on) render();
    else if (frozen) {
      frozen = false;
      freeze(false);
    }
  }
  return {
    values,
    toggle,
    get open() {
      return !root.hidden;
    },
    // (the venue changed: the sliders show its values)
    refresh: () => !root.hidden && render(),
    reopen: () => look.open && toggle(true),
  };
}

// What "Copy settings" puts on the clipboard: this venue's look over the game's own, every venue's, and every other venue's own.
export function copyText(look, here) {
  const lines = [`Pool Panic look · ${here.name} (${here.id})`];
  const show = (o) =>
    Object.entries(o)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ") || "as the game draws it";
  lines.push(`${here.id}: ${show(lookDiff(lookFor(look, here.id)))}`);
  if (Object.keys(look.all).length) lines.push(`all venues: ${show(look.all)}`);
  for (const [id, v] of Object.entries(look.venues))
    if (id !== here.id) lines.push(`${id} (own): ${show(v)}`);
  return lines.join("\n");
}
