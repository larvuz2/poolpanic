// How hard the game may drive the graphics on this device: the drawing surface's size, antialiasing, shadows, the character models,
// a frame-rate cap, and a governor that lowers the resolution when the frames slow down. Pure: no DOM; the storage is handed in.
//
// Why. An iPad's Safari killed the page 23 to 64 s into almost every shift it played (October 2026), with no error and the script's
// memory flat (11 MB of heap all shift long, measured in Chromium). What the device itself showed: the first-person hands layer, a
// second drawing pass and nothing else, was enough to kill it about 45 s into a shift (the crash hunt of October 3); and every shift
// that died had slowed to 32-46 frames a second, the graphics working flat out at a 2322×1516 surface, four times multisampled
// (about 148 MB). So on a touch device with Apple's WebKit the game draws fewer pixels to begin with (a budget of 2 million, no
// longer the screen's 1.7 pixels a point), never more than 60 frames a second (a 120 Hz iPad asked for twice the work), and lowers the
// resolution further while the frames are slow. And on any device, a page that dies in the middle of a shift makes the next launch
// draw with lighter graphics (a tier: no antialiasing, then no shadows, then the classic characters), so a crash is not met twice.

import { isWebKit } from "./tuning.mjs";

export const GFX_KEY = "pool-panic.gfx.v1";
export const MAX_TIER = 3;

// What each tier turns off, as the switches of tuning.mjs (the same words a crash hunt uses), and the most pixels it draws on a touch
// device with WebKit (a desktop keeps its own pixel ratio cap, below).
export const TIERS = [
  { flags: [], pixels: 2.0e6, ratio: 1.7, says: "full graphics" },
  { flags: ["noaa"], pixels: 1.4e6, ratio: 1.25, says: "no antialiasing, fewer pixels" },
  { flags: ["noaa", "noshadow"], pixels: 1.0e6, ratio: 1, says: "no antialiasing or shadows, fewer pixels" },
  {
    flags: ["noaa", "noshadow", "noparticles", "nomodels"],
    pixels: 0.8e6,
    ratio: 1,
    says: "no antialiasing, shadows or splashes, classic characters",
  },
];

// An iPad (which says it is a Mac, but has a touch screen), an iPhone or an iPod: every browser on them draws with Apple's WebKit.
export function isTouchWebKit({ userAgent = "", maxTouchPoints = 0 } = {}) {
  const ua = String(userAgent);
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && isWebKit(ua) && maxTouchPoints > 1);
}

const clampTier = (n) => Math.max(0, Math.min(MAX_TIER, Math.floor(Number(n) || 0)));

export function readGfx(storage) {
  try {
    const data = JSON.parse(storage?.getItem(GFX_KEY) || "{}");
    return { tier: clampTier(data.tier), live: data.live || null, crashes: Number(data.crashes) || 0 };
  } catch {
    return { tier: 0, live: null, crashes: 0 };
  }
}
function writeGfx(storage, data) {
  try {
    storage?.setItem(GFX_KEY, JSON.stringify(data));
  } catch {}
}

// At launch: a shift that was being drawn when the last page went away, and was never put away (the shift ended, the page was hidden
// or closed), is a page that died. Its device goes down a tier. `count: false` (a crash hunt, a trial) only clears the mark.
export function bootGfx(storage, { count = true } = {}) {
  const state = readGfx(storage);
  const died = !!state.live;
  const next = {
    tier: died && count ? clampTier(state.tier + 1) : state.tier,
    live: null,
    crashes: state.crashes + (died && count ? 1 : 0),
  };
  writeGfx(storage, next);
  return { tier: next.tier, raised: died && count && next.tier > state.tier, died, crashes: next.crashes };
}

// The mark a shift leaves while it is being drawn (`on`), taken away when it is put away (`off`).
export function markDrawing(storage, on, now = Date.now()) {
  const state = readGfx(storage);
  if (!!state.live === !!on) return;
  writeGfx(storage, { ...state, live: on ? { at: now } : null });
}

// Back to full graphics (a settings screen, or `?gfx=reset`).
export function resetGfx(storage) {
  writeGfx(storage, { tier: 0, live: null, crashes: 0 });
}

// What this device draws with. `dprCap` is a pixel ratio the address asked for (`?dpr=1`): it wins, and nothing then changes it.
export function graphicsPlan({
  tier = 0,
  touch = false,
  deviceRatio = 1,
  dprCap = null,
  testing = false,
} = {}) {
  const t = TIERS[clampTier(tier)];
  const fixed = dprCap !== null && dprCap !== undefined;
  return {
    tier: clampTier(tier),
    flags: t.flags,
    says: t.says,
    touch,
    // 60 frames a second at most on a touch WebKit device (a 120 Hz screen would ask for twice the drawing).
    fpsCap: touch ? 60 : 0,
    // The governor watches the frames on a touch device and on any device that has crashed before; never in a test or with ?dpr.
    govern: !testing && !fixed && (touch || tier > 0),
    // The pixel ratio for a drawing surface of w×h CSS pixels, times the governor's scale.
    ratio(w, h, scale = 1) {
      if (fixed) return Math.min(deviceRatio, Math.max(0.5, dprCap));
      let r = Math.min(deviceRatio, touch ? t.ratio : tier > 0 ? t.ratio : 1.7);
      if (touch && w > 0 && h > 0) r = Math.min(r, Math.sqrt(t.pixels / (w * h)));
      return Math.max(0.5, +(r * scale).toFixed(3));
    },
  };
}

// Lowers the resolution while the frames are slow: every `window` ms of frames drawn in a shift, if they came at fewer than `minFps`,
// the scale goes down by `step` (never under `floor`). It only goes down: a page that struggled once keeps the lighter surface.
export class Governor {
  constructor({ minFps = 45, window = 2000, step = 0.85, floor = 0.7 } = {}) {
    Object.assign(this, { minFps, window, step, floor });
    this.scale = 1;
    this.reset();
  }
  reset() {
    this.elapsed = 0;
    this.frames = 0;
  }
  // One frame `ms` long (between two drawn frames). Returns the new scale when it changes, else null.
  frame(ms) {
    if (!(ms > 0) || ms > 250) return null; // a hitch (a hidden page, a dialog, a shader compiling) is not the frame rate
    this.elapsed += ms;
    this.frames++;
    if (this.elapsed < this.window) return null;
    const fps = (this.frames * 1000) / this.elapsed;
    this.reset();
    this.fps = Math.round(fps);
    if (fps >= this.minFps || this.scale <= this.floor) return null;
    this.scale = Math.max(this.floor, +(this.scale * this.step).toFixed(3));
    return this.scale;
  }
}
