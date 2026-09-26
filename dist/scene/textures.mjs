// Procedural canvas textures. Everything is seeded, so a venue always looks the same and CPU checks stay
// deterministic. Textures stay chunky and hand-painted to match the toy-like low-poly look.
import { THREE } from "./kit.mjs";

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function shade(hex, amount) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)));
  return "#" + c.getHexString();
}
function hueShift(hex, dh, ds = 0, dl = 0) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL((hsl.h + dh + 1) % 1, Math.max(0, Math.min(1, hsl.s + ds)), Math.max(0, Math.min(1, hsl.l + dl)));
  return "#" + c.getHexString();
}
function toTexture(c, { repeat = [1, 1], srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}
function speckle(ctx, x, y, w, h, random, count, colors, size = 2) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.08 + random() * 0.14;
    ctx.fillStyle = colors[Math.floor(random() * colors.length)];
    const s = size * (0.5 + random());
    ctx.fillRect(x + random() * w, y + random() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

// Square glazed tiles with a toy bevel. Returns colour and bump maps covering `tiles` × `tiles` tiles.
export function tileTextures({
  base,
  grout,
  tiles = 4,
  px = 128,
  seed = 7,
  variation = 0.035,
  groutPx = 4,
  bevel = true,
}) {
  const size = tiles * px,
    random = rng(seed);
  const color = canvas(size, size),
    bump = canvas(size, size);
  const c = color.getContext("2d"),
    b = bump.getContext("2d");
  c.fillStyle = grout;
  c.fillRect(0, 0, size, size);
  b.fillStyle = "#1a1a1a";
  b.fillRect(0, 0, size, size);
  for (let i = 0; i < tiles; i++)
    for (let j = 0; j < tiles; j++) {
      const x = i * px + groutPx / 2,
        y = j * px + groutPx / 2,
        w = px - groutPx;
      const tone = hueShift(
        base,
        (random() - 0.5) * 0.012,
        (random() - 0.5) * 0.04,
        (random() - 0.5) * variation * 2,
      );
      c.fillStyle = tone;
      c.fillRect(x, y, w, w);
      if (bevel) {
        const g = c.createLinearGradient(x, y, x + w, y + w);
        g.addColorStop(0, "rgba(255,248,230,0.16)");
        g.addColorStop(0.45, "rgba(255,248,230,0)");
        g.addColorStop(1, "rgba(60,30,10,0.12)");
        c.fillStyle = g;
        c.fillRect(x, y, w, w);
        c.fillStyle = "rgba(255,250,235,0.22)";
        c.fillRect(x, y, w, 3);
        c.fillRect(x, y, 3, w);
        c.fillStyle = "rgba(70,35,15,0.16)";
        c.fillRect(x, y + w - 3, w, 3);
        c.fillRect(x + w - 3, y, 3, w);
      }
      speckle(c, x, y, w, w, random, 34, [shade(base, -0.12), shade(base, 0.1)], 2.4);
      b.fillStyle = "#d8d8d8";
      b.fillRect(x, y, w, w);
      b.fillStyle = "#ffffff";
      b.fillRect(x + 4, y + 4, w - 8, w - 8);
    }
  return { map: toTexture(color), bump: toTexture(bump, { srgb: false }) };
}

// Running-bond pavers (resort deck). One texture covers 4 × 4 world units.
export function paverTextures({ base, grout, seed = 21 }) {
  const size = 512,
    random = rng(seed),
    unit = size / 4;
  const color = canvas(size, size),
    bump = canvas(size, size);
  const c = color.getContext("2d"),
    b = bump.getContext("2d");
  c.fillStyle = grout;
  c.fillRect(0, 0, size, size);
  b.fillStyle = "#222";
  b.fillRect(0, 0, size, size);
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 ? unit : 0;
    for (let k = -1; k < 3; k++) {
      const x = k * unit * 2 + offset + 3,
        y = row * unit + 3,
        w = unit * 2 - 6,
        h = unit - 6;
      const tone = hueShift(base, (random() - 0.5) * 0.02, (random() - 0.5) * 0.05, (random() - 0.5) * 0.07);
      c.fillStyle = tone;
      c.fillRect(x, y, w, h);
      const g = c.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, "rgba(255,250,235,0.18)");
      g.addColorStop(1, "rgba(90,50,20,0.1)");
      c.fillStyle = g;
      c.fillRect(x, y, w, h);
      speckle(c, x, y, w, h, random, 70, [shade(base, -0.16), shade(base, 0.08), "#b98d62"], 2.6);
      b.fillStyle = "#e0e0e0";
      b.fillRect(x, y, w, h);
    }
  }
  return { map: toTexture(color), bump: toTexture(bump, { srgb: false }) };
}

// Small pool mosaic; one texture covers 2 × 2 world units.
export function mosaicTexture({ base = "#9fd9de", grout = "#e3f5f0", seed = 3, tiles = 8 } = {}) {
  const size = 512,
    px = size / tiles,
    random = rng(seed);
  const cv = canvas(size, size),
    c = cv.getContext("2d");
  c.fillStyle = grout;
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < tiles; i++)
    for (let j = 0; j < tiles; j++) {
      const r = random();
      c.fillStyle =
        r < 0.12
          ? shade(base, 0.07)
          : r < 0.22
            ? hueShift(base, 0.02, 0.05, -0.05)
            : hueShift(base, 0, 0, (random() - 0.5) * 0.05);
      c.fillRect(i * px + 3, j * px + 3, px - 6, px - 6);
      c.fillStyle = "rgba(255,255,255,0.14)";
      c.fillRect(i * px + 3, j * px + 3, px - 6, 5);
    }
  return toTexture(cv);
}

// Glossy 2:1 subway tiles for wainscots and service walls.
export function subwayTexture({ base = "#4ea4a2", grout = "#d9ecdf", seed = 11 } = {}) {
  const w = 512,
    h = 256,
    random = rng(seed),
    bw = 128,
    bh = 64;
  const cv = canvas(w, h),
    c = cv.getContext("2d");
  c.fillStyle = grout;
  c.fillRect(0, 0, w, h);
  for (let row = 0; row < h / bh; row++)
    for (let k = -1; k <= w / bw; k++) {
      const x = k * bw + (row % 2 ? bw / 2 : 0) + 3,
        y = row * bh + 3;
      c.fillStyle = hueShift(base, (random() - 0.5) * 0.015, 0, (random() - 0.5) * 0.06);
      c.fillRect(x, y, bw - 6, bh - 6);
      const g = c.createLinearGradient(x, y, x, y + bh);
      g.addColorStop(0, "rgba(255,255,255,0.28)");
      g.addColorStop(0.3, "rgba(255,255,255,0.04)");
      g.addColorStop(1, "rgba(0,40,40,0.14)");
      c.fillStyle = g;
      c.fillRect(x, y, bw - 6, bh - 6);
    }
  return toTexture(cv);
}

// Low-contrast plaster/stucco, tinted by the material colour (texture itself is near-white).
export function plasterTexture({ seed = 5, strength = 0.07 } = {}) {
  const size = 256,
    random = rng(seed);
  const cv = canvas(size, size),
    c = cv.getContext("2d");
  c.fillStyle = "#f2f2f2";
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const v = Math.floor(200 + random() * 55);
    c.globalAlpha = strength * (0.4 + random());
    c.fillStyle = `rgb(${v},${v},${v})`;
    const r = 2 + random() * 9;
    c.beginPath();
    c.arc(random() * size, random() * size, r, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
  return toTexture(cv);
}

// Warm wood planks with grain.
export function woodTexture({ base = "#d7a064", seed = 9, planks = 4 } = {}) {
  const w = 256,
    h = 256,
    random = rng(seed),
    ph = h / planks;
  const cv = canvas(w, h),
    c = cv.getContext("2d");
  for (let i = 0; i < planks; i++) {
    c.fillStyle = hueShift(base, (random() - 0.5) * 0.01, 0, (random() - 0.5) * 0.08);
    c.fillRect(0, i * ph, w, ph);
    for (let k = 0; k < 7; k++) {
      c.strokeStyle = `rgba(120,70,30,${0.08 + random() * 0.1})`;
      c.lineWidth = 1 + random() * 1.5;
      c.beginPath();
      const y = i * ph + random() * ph;
      c.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) c.lineTo(x, y + Math.sin(x * 0.05 + k) * 2.5 + (random() - 0.5) * 2);
      c.stroke();
    }
    c.fillStyle = "rgba(80,40,15,0.35)";
    c.fillRect(0, i * ph, w, 2);
  }
  return toTexture(cv);
}

// Radial glow sprite (white centre fading out), tinted by material colour.
export function glowTexture(size = 128, falloff = 1) {
  const cv = canvas(size, size),
    c = cv.getContext("2d");
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35 * falloff, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft vertical beam used for window light shafts.
export function beamTexture() {
  const w = 64,
    h = 256;
  const cv = canvas(w, h),
    c = cv.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const side = c.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, "rgba(0,0,0,1)");
  side.addColorStop(0.25, "rgba(0,0,0,0)");
  side.addColorStop(0.75, "rgba(0,0,0,0)");
  side.addColorStop(1, "rgba(0,0,0,1)");
  c.globalCompositeOperation = "destination-out";
  c.fillStyle = side;
  c.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Vertical gradient (top → bottom) used for skies and window glass.
export function gradientTexture(stops, w = 8, h = 256) {
  const cv = canvas(w, h),
    c = cv.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, h);
  for (const [t, color] of stops) g.addColorStop(t, color);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Grass for resort planters and lawn beyond the deck.
export function grassTexture({ base = "#7fb45f", seed = 13 } = {}) {
  const size = 256,
    random = rng(seed);
  const cv = canvas(size, size),
    c = cv.getContext("2d");
  c.fillStyle = base;
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < 1600; i++) {
    c.fillStyle = random() < 0.5 ? shade(base, 0.08) : shade(base, -0.08);
    c.globalAlpha = 0.35;
    c.fillRect(random() * size, random() * size, 1.5, 3 + random() * 4);
  }
  c.globalAlpha = 1;
  return toTexture(cv);
}
