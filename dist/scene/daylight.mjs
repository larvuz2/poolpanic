// Time of day. One continuous scale runs from noon (0) through golden hour and sunset to night (1), and every open-air
// look in the game is a point on it, so a shift can slide along it (the sun sinks while you work) and the sky dome,
// clouds, light, fog, water and lamps all move together. A storm is an overlay on top of any time of day.
//
// Pure data and pure functions (no scene, no DOM), so the checks can pin the palette down.
import { THREE } from "./kit.mjs";

const DEG = Math.PI / 180;

// Colours are authored as sRGB hex, numbers as plain values. `w` holds the water shader's colour triples.
export const DAY_KEYS = [
  {
    name: "noon",
    t: 0,
    c: {
      zenith: "#2f8fe0",
      mid: "#7cc8ef",
      horizon: "#c4e8ee",
      below: "#b4dee6",
      sunColor: "#fff6d8",
      cloudTop: "#ffffff",
      cloudBottom: "#a9c9ea",
      hillNear: "#5fae62",
      hillMid: "#4c9a86",
      hillFar: "#7fb4c8",
      seaNear: "#33c1cf",
      seaDeep: "#1c8fb8",
      fog: "#b4dee6",
      hemiSky: "#d4f1ff",
      hemiGround: "#b08a60",
      keyColor: "#fff0d0",
      fillColor: "#9fd8ea",
      envTop: "#bfe7f7",
      envMid: "#e9f3ea",
      envBottom: "#c9a57d",
    },
    n: {
      sunElev: 62,
      sunSize: 0.05,
      sunGlow: 0.5,
      moon: 0,
      stars: 0,
      fogNear: 55,
      fogFar: 135,
      hemiI: 1,
      keyI: 2.6,
      keyElev: 60,
      fillI: 0.55,
      env: 0.7,
      exposure: 0.97,
      glow: 0,
    },
    w: {
      shallow: [0.34, 0.86, 0.88],
      deep: [0.05, 0.56, 0.72],
      sky: [0.72, 0.92, 0.98],
      glint: [1, 0.97, 0.88],
    },
  },
  {
    name: "afternoon",
    t: 0.3,
    c: {
      zenith: "#3f95e2",
      mid: "#8fd0ec",
      horizon: "#e6ecd8",
      below: "#d6e6d8",
      sunColor: "#ffeeb8",
      cloudTop: "#fffaf0",
      cloudBottom: "#bccbe6",
      hillNear: "#62ae5a",
      hillMid: "#56a07c",
      hillFar: "#86b1c0",
      seaNear: "#35bfc8",
      seaDeep: "#1f8db2",
      fog: "#dbe9df",
      hemiSky: "#ffefd8",
      hemiGround: "#a98660",
      keyColor: "#ffe2b0",
      fillColor: "#a6d3e0",
      envTop: "#c9e6f0",
      envMid: "#f0ecd8",
      envBottom: "#c6a279",
    },
    n: {
      sunElev: 42,
      sunSize: 0.055,
      sunGlow: 0.65,
      moon: 0,
      stars: 0,
      fogNear: 55,
      fogFar: 135,
      hemiI: 1,
      keyI: 2.65,
      keyElev: 50,
      fillI: 0.55,
      env: 0.7,
      exposure: 0.97,
      glow: 0,
    },
    w: {
      shallow: [0.33, 0.85, 0.87],
      deep: [0.05, 0.54, 0.7],
      sky: [0.9, 0.88, 0.82],
      glint: [1, 0.92, 0.72],
    },
  },
  {
    name: "golden",
    t: 0.52,
    c: {
      zenith: "#4a86d6",
      mid: "#f2b58c",
      horizon: "#ffd9a0",
      below: "#f5c99a",
      sunColor: "#ffcf7d",
      cloudTop: "#fff0d0",
      cloudBottom: "#d99a86",
      hillNear: "#6aa550",
      hillMid: "#5f8f6d",
      hillFar: "#a89aa8",
      seaNear: "#38b4c0",
      seaDeep: "#206e9e",
      fog: "#f2d2a4",
      hemiSky: "#ffe0bd",
      hemiGround: "#8a6a55",
      keyColor: "#ffc47a",
      fillColor: "#a598d8",
      envTop: "#f5cf9e",
      envMid: "#f6dcc0",
      envBottom: "#94705a",
    },
    n: {
      sunElev: 16,
      sunSize: 0.07,
      sunGlow: 0.9,
      moon: 0,
      stars: 0,
      fogNear: 50,
      fogFar: 130,
      hemiI: 1.15,
      keyI: 2.7,
      keyElev: 38,
      fillI: 0.6,
      env: 0.68,
      exposure: 0.98,
      glow: 0.05,
    },
    w: { shallow: [0.36, 0.88, 0.9], deep: [0.07, 0.58, 0.76], sky: [1, 0.86, 0.68], glint: [1, 0.85, 0.55] },
  },
  {
    name: "sunset",
    t: 0.68,
    c: {
      zenith: "#5a68bc",
      mid: "#f09b7a",
      horizon: "#ffc98a",
      below: "#f2b58a",
      sunColor: "#ff9a4a",
      cloudTop: "#ffc9a0",
      cloudBottom: "#8a5f9a",
      hillNear: "#4d6f58",
      hillMid: "#6b5f8a",
      hillFar: "#a27ba0",
      seaNear: "#3aa6b8",
      seaDeep: "#234f8a",
      fog: "#e9a986",
      hemiSky: "#ffd2b3",
      hemiGround: "#7d5f63",
      keyColor: "#ffb877",
      fillColor: "#9e8fd6",
      envTop: "#f7b995",
      envMid: "#f3d7b8",
      envBottom: "#8f6a58",
    },
    n: {
      sunElev: 3,
      sunSize: 0.085,
      sunGlow: 1,
      moon: 0,
      stars: 0,
      fogNear: 50,
      fogFar: 130,
      hemiI: 1.15,
      keyI: 2.7,
      keyElev: 36,
      fillI: 0.6,
      env: 0.65,
      exposure: 0.98,
      glow: 0.2,
    },
    w: { shallow: [0.36, 0.86, 0.9], deep: [0.08, 0.58, 0.78], sky: [1, 0.78, 0.62], glint: [1, 0.82, 0.56] },
  },
  {
    name: "dusk",
    t: 0.83,
    c: {
      zenith: "#26336c",
      mid: "#7a58a0",
      horizon: "#f0907c",
      below: "#b06f80",
      sunColor: "#ff7a4a",
      cloudTop: "#c48fb8",
      cloudBottom: "#4d4282",
      hillNear: "#33475a",
      hillMid: "#464874",
      hillFar: "#786a98",
      seaNear: "#2a6b90",
      seaDeep: "#1a3a72",
      fog: "#b47c8a",
      hemiSky: "#a6a4e6",
      hemiGround: "#4a3c56",
      keyColor: "#b4bcff",
      fillColor: "#7b7fd0",
      envTop: "#3a4a8a",
      envMid: "#b07c98",
      envBottom: "#4a3a4a",
    },
    n: {
      sunElev: -7,
      sunSize: 0.085,
      sunGlow: 0.7,
      moon: 0.55,
      stars: 0.35,
      fogNear: 45,
      fogFar: 125,
      hemiI: 1,
      keyI: 1.6,
      keyElev: 46,
      fillI: 0.45,
      env: 0.5,
      exposure: 1.02,
      glow: 0.7,
    },
    w: { shallow: [0.3, 0.82, 0.92], deep: [0.07, 0.5, 0.76], sky: [0.6, 0.5, 0.72], glint: [1, 0.7, 0.6] },
  },
  {
    name: "night",
    t: 1,
    c: {
      zenith: "#0c1330",
      mid: "#1c2b58",
      horizon: "#3f4b7a",
      below: "#1c2744",
      sunColor: "#ff7a4a",
      cloudTop: "#5b6a9a",
      cloudBottom: "#2b3660",
      hillNear: "#18283a",
      hillMid: "#212a4c",
      hillFar: "#343e66",
      seaNear: "#164a78",
      seaDeep: "#0b2350",
      fog: "#1c2744",
      hemiSky: "#6878b8",
      hemiGround: "#2e2a3c",
      keyColor: "#9fb6ff",
      fillColor: "#5578c4",
      envTop: "#27335a",
      envMid: "#3b4a73",
      envBottom: "#2b2531",
    },
    n: {
      sunElev: -30,
      sunSize: 0.085,
      sunGlow: 0,
      moon: 1,
      stars: 1,
      fogNear: 45,
      fogFar: 120,
      hemiI: 0.92,
      keyI: 1.1,
      keyElev: 54,
      fillI: 0.35,
      env: 0.35,
      exposure: 1.05,
      glow: 1,
    },
    w: {
      shallow: [0.18, 0.72, 0.86],
      deep: [0.04, 0.4, 0.66],
      sky: [0.26, 0.34, 0.58],
      glint: [0.8, 0.88, 1],
    },
  },
];

// Where the classic presets sit on the scale (the campaign's existing lighting names).
export const DAY_TIMES = { day: 0, afternoon: 0.3, golden: 0.52, sunset: 0.68, dusk: 0.83, night: 1 };

// The storm palette every colour is pulled toward. `dim` darkens it after dark.
const STORM = {
  zenith: "#3c465c",
  mid: "#5d6780",
  horizon: "#8c96a6",
  below: "#7d8797",
  cloudTop: "#98a3b5",
  cloudBottom: "#414a60",
  hillNear: "#2f4a48",
  hillMid: "#3c4a5c",
  hillFar: "#5f6d80",
  seaNear: "#2e5a6c",
  seaDeep: "#1d3a52",
  fog: "#7f8896",
  hemiSky: "#b6c3d8",
  keyColor: "#c8d4e8",
  fillColor: "#8794b8",
  envTop: "#6f7c96",
  envMid: "#8f9aae",
};

const tmpA = new THREE.Color(),
  tmpB = new THREE.Color();
const mix = (a, b, f) => a + (b - a) * f;
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function lerpColor(a, b, f) {
  tmpA.set(a);
  tmpB.set(b);
  return tmpA.lerp(tmpB, f).clone();
}
const hexOf = (c) => c.getHex();
const css = (c) => "#" + c.getHexString();
const lerpTriple = (a, b, f) => a.map((v, i) => mix(v, b[i], f));

// The two keys around `t`, and how far between them.
export function keysAround(t) {
  t = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < DAY_KEYS.length - 2 && t > DAY_KEYS[i + 1].t) i++;
  const a = DAY_KEYS[i],
    b = DAY_KEYS[i + 1];
  return { a, b, f: Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) };
}

// Unit vector for a compass azimuth (radians; π points along −X, the side the overview camera sits on) and elevation.
export function skyDirection(azimuth, elevationDeg) {
  const e = elevationDeg * DEG;
  return new THREE.Vector3(Math.cos(azimuth) * Math.cos(e), Math.sin(e), Math.sin(azimuth) * Math.cos(e));
}

// The full look for a time of day: the same shape the scene's lighting presets use, plus `dome` for the sky.
// `azimuth` is where the sun rises and sets on this venue's compass; `storm` (0..1) overlays weather.
export function dayLook(t, { azimuth = 2.6, storm = 0 } = {}) {
  const { a, b, f } = keysAround(t);
  const c = {},
    n = {},
    w = {};
  for (const k of Object.keys(a.c)) c[k] = lerpColor(a.c[k], b.c[k], f);
  for (const k of Object.keys(a.n)) n[k] = mix(a.n[k], b.n[k], f);
  for (const k of Object.keys(a.w)) w[k] = lerpTriple(a.w[k], b.w[k], f);
  const night = smooth(0.72, 1, t),
    s = Math.max(0, Math.min(1, storm));
  if (s > 0) {
    const dim = mix(1, 0.42, night);
    for (const [k, target] of Object.entries(STORM)) {
      const dark = tmpB.set(target).multiplyScalar(dim).clone();
      c[k].lerp(dark, s * 0.94);
    }
    n.sunGlow *= 1 - s;
    n.sunSize *= 1 - s * 0.8;
    n.stars *= 1 - s;
    n.moon *= 1 - s * 0.9;
    n.hemiI *= 1 - 0.16 * s;
    n.keyI *= 1 - 0.62 * s;
    n.fillI *= 1 - 0.15 * s;
    n.env *= 1 - 0.3 * s;
    n.fogNear = mix(n.fogNear, 28, s);
    n.fogFar = mix(n.fogFar, 96, s);
    n.exposure += 0.03 * s;
    for (const k of ["sky", "glint"])
      w[k] = lerpTriple(w[k], k === "sky" ? [0.42, 0.48, 0.56] : [0.7, 0.75, 0.85], s);
  }
  // Light: the key light follows the sun until it sets, then hands over to the moon (a higher, bluer light).
  const keyAz = azimuth + 0.55 * night;
  const keyDir = skyDirection(keyAz, n.keyElev).multiplyScalar(32);
  const fillDir = new THREE.Vector3(14, 16, -17);
  const sunDir = skyDirection(azimuth, n.sunElev);
  const moonDir = skyDirection(azimuth + 1.05, 46);
  return {
    t,
    storm: s,
    background: hexOf(c.fog),
    exposure: n.exposure,
    hemi: [hexOf(c.hemiSky), hexOf(c.hemiGround), n.hemiI],
    sun: [hexOf(c.keyColor), n.keyI, keyDir.toArray()],
    fill: [hexOf(c.fillColor), n.fillI, fillDir.toArray()],
    env: n.env,
    envColors: [css(c.envTop), css(c.envMid), css(c.envBottom)],
    fog: [hexOf(c.fog), n.fogNear, n.fogFar],
    water: { ...w, glow: n.glow * 1 },
    glow: n.glow,
    sky: [
      [0, css(c.zenith)],
      [0.55, css(c.mid)],
      [1, css(c.horizon)],
    ],
    dome: {
      zenith: c.zenith,
      mid: c.mid,
      horizon: c.horizon,
      below: c.below,
      fog: c.fog,
      sunDir,
      sunColor: c.sunColor,
      sunSize: n.sunSize,
      sunGlow: n.sunGlow,
      moonDir,
      moon: n.moon,
      stars: n.stars,
      cloudTop: c.cloudTop,
      cloudBottom: c.cloudBottom,
      hills: [c.hillNear, c.hillMid, c.hillFar],
      sea: [c.seaNear, c.seaDeep],
    },
  };
}

// The look of a named classic mood (day / sunset / night...) on a venue's compass.
export function moodLook(name, options) {
  return dayLook(DAY_TIMES[name] ?? 0, options);
}

export { smooth as smoothstep, mix as lerp };
