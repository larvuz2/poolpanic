// The title screen around the menu's 3D stage (scene/menu-stage.mjs), 20 October 2026: the first screen (CLICK TO ENTER,
// which lets the sound in), the buttons' sounds, Settings, Credits, the tip line under the menu and START's LOADING %.
// The pure parts (the settings' defaults and limits, the tips, the loading label) are exported for title-check.mjs.

// Settings' sliders and switches, kept with the other preferences (pool-panic.settings.v1). Volumes and film grain are
// percentages, brightness a percentage of the venue's own light, sensitivity a percentage of the Coach Cam's mouse look.
export const SETTING_DEFAULTS = {
  master: 80,
  music: 70,
  effects: 85,
  brightness: 100,
  grain: 20,
  sensitivity: 100,
  invertY: false,
  motion: "auto", // "auto" (the system's choice), "on" or "off"
};
const LIMITS = {
  master: [0, 100],
  music: [0, 100],
  effects: [0, 100],
  brightness: [70, 130],
  grain: [0, 100],
  sensitivity: [30, 250],
};
export function normalizeSettings(saved = {}) {
  const out = { ...saved };
  for (const [key, fallback] of Object.entries(SETTING_DEFAULTS)) {
    const v = saved[key];
    if (LIMITS[key]) {
      const n = Number(v);
      out[key] =
        Number.isFinite(n) && v !== null && v !== ""
          ? Math.min(LIMITS[key][1], Math.max(LIMITS[key][0], n))
          : fallback;
    } else if (key === "invertY") out[key] = v === true;
    else if (key === "motion") out[key] = ["auto", "on", "off"].includes(v) ? v : fallback;
  }
  return out;
}
// What the mix hears: 0 to 1.
export const volumesOf = (s) => ({ master: s.master / 100, music: s.music / 100, effects: s.effects / 100 });
// How strong the film grain is drawn (its layer's opacity): none at 0, a light veil at 100.
export const grainOpacity = (s) => Math.round((s.grain / 100) * 0.14 * 1000) / 1000;
// Reduce motion: the player's choice, or the system's when it is left on Auto.
export const motionReduced = (s, system = false) =>
  s.motion === "on" ? true : s.motion === "off" ? false : system;

// The line under the menu: one tip, a new one every visit.
export const TIPS = [
  "A swimmer's lane is judged at once: green is right, orange is slow, red is wrong.",
  "Carry one thing at a time: fins, chlorine, eye relief, the mop.",
  "Jump a wet spot (Space) or the coach goes down on it.",
  "The happy streak doubles your points at 8 in a row.",
  "Fill the Date Fund by Saturday night, or the run is over.",
  "Every date with Marina opens a new pool, for good.",
  "A tummy ache in the water ends in a poo or a wee. Watch for the warning.",
  "Coaching tips feed the streak: get to the end of their lane and press E.",
  "Two to a lane share. Three swim in a circle.",
  "Stars earned in every run open gear in the Coach's locker.",
  "Press Esc for the menu during a shift.",
  "Every shift has its big moment, about two thirds of the way in.",
];
export const tipAt = (n) => "TIP · " + TIPS[((n % TIPS.length) + TIPS.length) % TIPS.length];
// START while the characters are still loading: "LOADING 42%"; null once they are in.
export const loadingLabel = (share) =>
  share >= 1 ? null : "LOADING " + Math.floor(Math.max(0, share) * 100) + "%";

// ---- the page --------------------------------------------------------------------------------------------------------
// `apply(settings)` puts the settings to work (the app's: the mix, the light, the grain, the camera); `saveSettings` keeps
// them; `audio` is the game's PoolAudio. Returns the few things the app drives: enter(), showTip(), setLoading(share).
export function installTitle({
  $,
  audio,
  settings,
  saveSettings,
  apply,
  fullscreen,
  isFullscreen,
  quit = null,
  build = "",
  entry = true,
  onEnter = () => {},
}) {
  const body = document.body;
  // ---- the first screen ----
  let entered = !entry;
  function enter() {
    if (entered) return;
    entered = true;
    audio.init();
    audio.preloadMenu();
    audio.startMenu("theme", { fade: 3 });
    audio.ui("click");
    body.classList.add("entered");
    $("entry").classList.add("leaving");
    setTimeout(() => ($("entry").hidden = true), 1300);
    onEnter();
  }
  if (entry) {
    $("entry").hidden = false;
    body.classList.add("at-entry");
    $("entry-go").onclick = enter;
    $("entry").addEventListener("pointerdown", (e) => {
      if (e.target === $("entry")) enter();
    });
    setTimeout(() => $("entry-go").focus({ preventScroll: true }), 50);
  } else body.classList.add("entered");

  // ---- the buttons' sounds: a tick on hover (or keyboard focus), a click with a tail on press ----
  const sounding = ".ts-btn, .entry-go, dialog button, .fp-back, #welcome .primary";
  let lastHover = null;
  document.addEventListener("pointerover", (e) => {
    const b = e.target.closest?.(sounding);
    if (b && b !== lastHover && !b.disabled) audio.ui("hover");
    lastHover = b;
  });
  document.addEventListener("focusin", (e) => {
    if (e.target.matches?.(".ts-btn") && e.target.matches(":focus-visible")) audio.ui("hover");
  });
  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest?.(sounding);
      if (b && !b.disabled && b.id !== "entry-go") audio.ui("click");
    },
    true,
  );

  // ---- Settings ----
  const sliders = ["master", "music", "effects", "brightness", "grain", "sensitivity"];
  const shown = {
    master: (v) => v + "%",
    music: (v) => v + "%",
    effects: (v) => v + "%",
    brightness: (v) => (v === 100 ? "As made" : (v > 100 ? "+" : "") + (v - 100) + "%"),
    grain: (v) => (v ? v + "%" : "Off"),
    sensitivity: (v) => (v / 100).toFixed(2) + "×",
  };
  function render() {
    for (const key of sliders) {
      const input = $("set-" + key);
      input.value = settings[key];
      input.nextElementSibling.textContent = shown[key](settings[key]);
      input.style.setProperty("--fill", ((settings[key] - input.min) / (input.max - input.min)) * 100 + "%");
    }
    $("set-invert").checked = settings.invertY;
    $("set-motion").checked = motionReduced(settings, matchMedia("(prefers-reduced-motion: reduce)").matches);
    $("set-fullscreen").checked = isFullscreen();
  }
  for (const key of sliders)
    $("set-" + key).addEventListener("input", (e) => {
      settings[key] = Number(e.target.value);
      render();
      apply(settings);
      // The effects slider is heard as it moves.
      if (key === "effects" || key === "master") audio.ui("hover");
    });
  for (const key of sliders) $("set-" + key).addEventListener("change", saveSettings);
  $("set-invert").onchange = () => {
    settings.invertY = $("set-invert").checked;
    apply(settings);
    saveSettings();
  };
  $("set-motion").onchange = () => {
    settings.motion = $("set-motion").checked ? "on" : "off";
    apply(settings);
    saveSettings();
  };
  $("set-fullscreen").onchange = async () => {
    await fullscreen();
    setTimeout(render, 300);
  };
  document.addEventListener("fullscreenchange", () => $("settings-dialog").open && render());
  function openSettings() {
    render();
    if (!$("settings-dialog").open) $("settings-dialog").showModal();
    $("settings-dialog").focus(); // (not the × button: its ring would be the first thing seen)
  }
  const closeSettings = () => {
    saveSettings();
    $("settings-dialog").close();
  };
  $("ts-settings").onclick = openSettings;
  $("pause-settings").onclick = openSettings;
  $("settings-done").onclick = closeSettings;
  $("settings-close").onclick = closeSettings;

  // ---- Credits: they roll by themselves, slowly; a wheel, a drag or the keys take over ----
  let rolling = null;
  function openCredits() {
    const roll = $("credits-roll");
    roll.scrollTop = 0;
    $("credits-dialog").showModal();
    $("credits-dialog").focus();
    audio.menuLevel?.(0.75, 1.2);
    let held = 0,
      last = performance.now(),
      pos = 0;
    const stop = () => (held = 2.5);
    roll.onwheel = roll.onpointerdown = roll.onkeydown = stop;
    cancelAnimationFrame(rolling);
    const step = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (held > 0) {
        held -= dt;
        pos = roll.scrollTop;
      } else if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        pos += dt * 28;
        roll.scrollTop = pos;
      }
      if ($("credits-dialog").open) rolling = requestAnimationFrame(step);
    };
    rolling = requestAnimationFrame(step);
  }
  const closeCredits = () => {
    $("credits-dialog").close();
    audio.menuLevel?.(audio.menu?.track === "return" ? 0.7 : 1, 1.2);
  };
  $("ts-credits").onclick = openCredits;
  $("credits-done").onclick = closeCredits;
  $("credits-close").onclick = closeCredits;
  $("credits-dialog").addEventListener("close", () => cancelAnimationFrame(rolling));

  // ---- quitting (the desktop app only) ----
  if (quit) {
    $("ts-quit").hidden = false;
    $("ts-quit").onclick = quit;
  }
  $("ts-build").textContent = build;

  // ---- the tip line ----
  let tips = Math.floor(Math.random() * TIPS.length);
  const showTip = () => ($("ts-tip").textContent = tipAt(tips++));
  showTip();

  // ---- START while the characters load ----
  let loadingShare = 1;
  function setLoading(share) {
    loadingShare = share;
    const go = $("wk-go"),
      label = loadingLabel(share);
    go.classList.toggle("loading", !!label);
    go.setAttribute("aria-disabled", label ? "true" : "false");
    const text = go.querySelector(".ts-label");
    if (label) {
      if (!go.dataset.label) go.dataset.label = text?.textContent || "START";
      if (text) text.textContent = label;
    } else if (go.dataset.label) {
      if (text) text.textContent = go.dataset.label;
      delete go.dataset.label;
    }
  }
  // (A press on START while it loads waits for nothing: it is ignored.)
  $("wk-go").addEventListener(
    "click",
    (e) => {
      if (loadingShare < 1) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true,
  );
  return {
    enter,
    showTip,
    setLoading,
    openSettings,
    get entered() {
      return entered;
    },
    get loading() {
      return loadingShare < 1;
    },
  };
}
