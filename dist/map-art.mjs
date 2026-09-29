// Level map art: one floating isometric island per zone (a chunk of three levels, or an act's finale), drawn as
// minimal, flat-shaded SVG in the game's own colours: warm sand and terracotta, teal water and walls, cream clouds.
// Everything here is pure (strings and numbers, no DOM), so the layout can be checked headlessly; map.mjs draws it
// and adds the buttons. Coordinates are in SVG units; each landmark is built around its platform's centre.

// ---------------------------------------------------------------------------------------------------------------
// Layout: where the four platforms of an act sit, and where their level nodes go. Two orientations share the same
// art: a wide staircase climbing to the upper right, and a tall zigzag climbing up a phone screen.
const NODE_SHAPE = {
  landscape: {
    nodes: [
      [-92, 40],
      [0, 58],
      [92, 40],
    ],
    finale: [0, 54],
    drill: [-128, -20],
    label: 18,
  },
  portrait: {
    nodes: [
      [-64, 27],
      [0, 41],
      [64, 27],
    ],
    finale: [0, 38],
    drill: [-92, -14],
    label: 16,
  },
};
export const LAYOUTS = {
  landscape: {
    box: [1200, 760],
    pads: [
      { cx: 215, cy: 590, rx: 165, ry: 84, depth: 30 },
      { cx: 520, cy: 468, rx: 165, ry: 84, depth: 30 },
      { cx: 825, cy: 346, rx: 165, ry: 84, depth: 30 },
      { cx: 1000, cy: 168, rx: 176, ry: 90, depth: 34 },
    ],
  },
  portrait: {
    box: [520, 1260],
    pads: [
      { cx: 150, cy: 1060, rx: 122, ry: 62, depth: 24 },
      { cx: 370, cy: 850, rx: 122, ry: 62, depth: 24 },
      { cx: 150, cy: 640, rx: 122, ry: 62, depth: 24 },
      { cx: 370, cy: 400, rx: 130, ry: 66, depth: 26 },
    ],
  },
};

// Positions for one act: each zone's platform, nodes, drill satellite, label, and the route segments between nodes.
// `zones` is the campaign's list of four zones (three chunks and the finale).
export function layoutAct(orientation = "landscape") {
  const L = LAYOUTS[orientation],
    S = NODE_SHAPE[orientation];
  const zones = L.pads.map((pad, i) => {
    // In portrait the platforms alternate sides, so every other one is walked right to left.
    const finale = i === 3,
      flip = orientation === "portrait" && i === 1 ? -1 : 1,
      nodes = (finale ? [S.finale] : S.nodes).map(([x, y]) => ({ x: pad.cx + x * flip, y: pad.cy + y })),
      d = S.drill;
    return {
      pad,
      nodes,
      drill: finale ? null : { x: pad.cx + d[0] * flip, y: pad.cy + d[1] },
      label: { x: pad.cx, y: pad.cy + pad.ry + pad.depth + S.label },
    };
  });
  // The route through every node in play order: a gentle bow inside a platform, an S between platforms.
  const path = zones.flatMap((z) => z.nodes),
    route = path.slice(1).map((to, i) => {
      const from = path[i],
        sameZone = zones.some((z) => z.nodes.includes(from) && z.nodes.includes(to)),
        f = (n) => Math.round(n * 10) / 10;
      const d = sameZone
        ? `M${f(from.x)},${f(from.y)} Q${f((from.x + to.x) / 2)},${f((from.y + to.y) / 2 + 9)} ${f(to.x)},${f(to.y)}`
        : orientation === "landscape"
          ? `M${f(from.x)},${f(from.y)} C${f(from.x + 70)},${f(from.y)} ${f(to.x - 70)},${f(to.y)} ${f(to.x)},${f(to.y)}`
          : `M${f(from.x)},${f(from.y)} C${f(from.x + Math.sign(to.x - from.x || 1) * 70)},${f(from.y)} ${f(to.x)},${f(to.y + 90)} ${f(to.x)},${f(to.y)}`;
      return { from: path.indexOf(from), to: i + 1, d };
    });
  return { box: L.box, zones, route };
}

// ---------------------------------------------------------------------------------------------------------------
// Colour and isometric helpers.
export const PALETTE = {
  ink: "#103b48",
  cream: "#fff4cf",
  yellow: "#ffdc52",
  coral: "#f26857",
  water: "#59c9cf",
  waterDeep: "#2f9fb0",
  wall: "#3c9296",
  roof: "#d9784b",
  sand: "#efd3a4",
  sandSide: "#cf9a63",
  white: "#fbf6ea",
  leaf: "#3f9d60",
  wood: "#a9764a",
  gold: "#f6c23c",
};
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16),
    target = amount < 0 ? 0 : 255,
    k = Math.abs(amount);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => clamp(v + (target - v) * k));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}
const U = 22; // half the width of one isometric tile
const iso = (gx, gy, z = 0) => [(gx - gy) * U, (gx + gy) * U * 0.5 - z * U * 0.92];
const r1 = (n) => Math.round(n * 10) / 10;
const pts = (list) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(" ");
const poly = (list, fill, extra = "") =>
  `<polygon points="${pts(list)}" fill="${fill}" stroke="${shade(fill, -0.3)}" stroke-opacity=".35" stroke-width="1" stroke-linejoin="round" ${extra}/>`;
const faces = (base) => ({ top: base, left: shade(base, -0.13), right: shade(base, -0.27) });
const at = (x, y, inner, cls = "") =>
  `<g transform="translate(${r1(x)} ${r1(y)})"${cls ? ` class="${cls}"` : ""}>${inner}</g>`;

// A box: its two visible sides and its top. (gx, gy) is the back corner, w along +x, d along +y, h up.
function prism(gx, gy, w, d, h, z, c) {
  const P = (x, y, zz) => iso(x, y, zz),
    top = z + h;
  return (
    poly([P(gx, gy + d, z), P(gx + w, gy + d, z), P(gx + w, gy + d, top), P(gx, gy + d, top)], c.left) +
    poly([P(gx + w, gy, z), P(gx + w, gy + d, z), P(gx + w, gy + d, top), P(gx + w, gy, top)], c.right) +
    poly([P(gx, gy, top), P(gx + w, gy, top), P(gx + w, gy + d, top), P(gx, gy + d, top)], c.top)
  );
}
// A window or door on the box's +y side (`front`) or +x side.
const panelFront = (gy, x0, x1, z0, z1, fill) =>
  poly([iso(x0, gy, z0), iso(x1, gy, z0), iso(x1, gy, z1), iso(x0, gy, z1)], fill);
const panelSide = (gx, y0, y1, z0, z1, fill) =>
  poly([iso(gx, y0, z0), iso(gx, y1, z0), iso(gx, y1, z1), iso(gx, y0, z1)], fill);
const shadow = (rx, ry, op = 0.16) => `<ellipse rx="${rx}" ry="${ry}" fill="#0b3a48" opacity="${op}"/>`;

// A gabled roof over a box whose ridge runs along +y.
function gable(gx, gy, w, d, z, rise, roof, wallFront) {
  const P = (x, y, zz) => iso(x, y, zz),
    mid = gx + w / 2,
    o = 0.28;
  return (
    poly(
      [
        P(mid, gy - o, z + rise),
        P(mid, gy + d + o, z + rise),
        P(gx - o, gy + d + o, z),
        P(gx - o, gy - o, z),
      ],
      shade(roof, -0.32),
    ) +
    poly([P(gx - o, gy + d + o, z), P(gx + w + o, gy + d + o, z), P(mid, gy + d + o, z + rise)], wallFront) +
    poly(
      [
        P(mid, gy - o, z + rise),
        P(mid, gy + d + o, z + rise),
        P(gx + w + o, gy + d + o, z),
        P(gx + w + o, gy - o, z),
      ],
      roof,
    )
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Objects. Each is drawn around its own ground centre.
function hall({
  w = 3,
  d = 2,
  h = 1.7,
  wall = PALETTE.wall,
  roof = PALETTE.roof,
  door = true,
  sign = "",
} = {}) {
  const gx = -w / 2,
    gy = -d / 2,
    c = faces(wall),
    glass = "#cdeee6";
  return (
    shadow(w * U * 0.95, d * U * 0.5) +
    prism(gx, gy, w, d, h, 0, c) +
    panelFront(gy + d, gx + 0.35, gx + 1.0, 0.7, 1.35, glass) +
    panelFront(gy + d, gx + w - 1.0, gx + w - 0.35, 0.7, 1.35, glass) +
    (door ? panelFront(gy + d, gx + w / 2 - 0.3, gx + w / 2 + 0.3, 0, 1.05, PALETTE.ink) : "") +
    panelSide(gx + w, gy + 0.35, gy + 0.85, 0.7, 1.35, glass) +
    panelSide(gx + w, gy + d - 0.85, gy + d - 0.35, 0.7, 1.35, glass) +
    gable(gx, gy, w, d, h, 1.05, roof, shade(wall, -0.13)) +
    sign
  );
}
function pool({ w = 4, d = 2.4, water = PALETTE.water, coping = "#f6e3bd", lanes = 2, mosaic = false } = {}) {
  const gx = -w / 2,
    gy = -d / 2,
    i = 0.32,
    P = (x, y, z = 0.14) => iso(x, y, z);
  const wall = shade(water, -0.42);
  let laneLines = "";
  for (let k = 1; k <= lanes; k++) {
    const y = gy + i + ((d - 2 * i) * k) / (lanes + 1);
    laneLines += `<line x1="${r1(P(gx + i, y)[0])}" y1="${r1(P(gx + i, y)[1])}" x2="${r1(P(gx + w - i, y)[0])}" y2="${r1(P(gx + w - i, y)[1])}" stroke="${PALETTE.cream}" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="1 5.5" opacity=".95"/>`;
  }
  return (
    shadow(w * U * 0.9, d * U * 0.5, 0.12) +
    prism(gx, gy, w, d, 0.16, 0, faces(coping)) +
    (mosaic
      ? `<polygon points="${pts([P(gx, gy, 0.17), P(gx + w, gy, 0.17), P(gx + w, gy + d, 0.17), P(gx, gy + d, 0.17)])}" fill="none" stroke="${PALETTE.waterDeep}" stroke-width="3" stroke-dasharray="7 4" opacity=".7"/>`
      : "") +
    `<polygon points="${pts([P(gx + i, gy + i, 0.17), P(gx + w - i, gy + i, 0.17), P(gx + w - i, gy + d - i, 0.17), P(gx + i, gy + d - i, 0.17)])}" fill="${wall}"/>` +
    `<polygon points="${pts([P(gx + i, gy + i + 0.22, 0.05), P(gx + w - i - 0.22, gy + i + 0.22, 0.05), P(gx + w - i - 0.22, gy + d - i, 0.05), P(gx + i, gy + d - i, 0.05)])}" fill="${water}"/>` +
    laneLines +
    `<polygon points="${pts([P(gx + i + 0.5, gy + i + 0.5, 0.05), P(gx + i + 1.6, gy + i + 0.5, 0.05), P(gx + i + 1.2, gy + i + 0.75, 0.05), P(gx + i + 0.3, gy + i + 0.75, 0.05)])}" fill="#fff" opacity=".28"/>`
  );
}
function palm(lean = 1, s = 1) {
  const leaf = (a, l, c) =>
    `<path d="M0,0 Q${r1(Math.cos(a) * l * 0.5)},${r1(Math.sin(a) * l * 0.5 - 7 * s)} ${r1(Math.cos(a) * l)},${r1(Math.sin(a) * l * 0.55 + 6 * s)}" stroke="${c}" stroke-width="${5 * s}" fill="none" stroke-linecap="round"/>`;
  return (
    shadow(16 * s, 6 * s, 0.14) +
    `<path d="M0,0 Q${6 * lean * s},${-24 * s} ${2 * lean * s},${-50 * s}" stroke="${PALETTE.wood}" stroke-width="${5.5 * s}" fill="none" stroke-linecap="round"/>` +
    at(
      2 * lean * s,
      -50 * s,
      [-2.7, -2.1, -1.4, -0.75, -0.2, 0.35]
        .map((a, i) => leaf(a, 26 * s, i % 2 ? "#2e8a52" : PALETTE.leaf))
        .join("") + `<circle r="${3 * s}" cy="${2 * s}" fill="#7a4d2a"/>`,
    )
  );
}
function umbrella(color = PALETTE.coral, s = 1) {
  return (
    shadow(15 * s, 5 * s, 0.13) +
    `<line x1="0" y1="0" x2="0" y2="${-34 * s}" stroke="${PALETTE.wood}" stroke-width="3"/>` +
    at(
      0,
      -34 * s,
      `<path d="M${-26 * s},0 Q0,${-20 * s} ${26 * s},0 Q0,${-5 * s} ${-26 * s},0Z" fill="${color}"/><path d="M${-9 * s},${-2 * s} Q0,${-19 * s} ${9 * s},${-2 * s}Q0,${-6 * s} ${-9 * s},${-2 * s}Z" fill="${shade(color, 0.5)}" opacity=".85"/>`,
    )
  );
}
function lifeguardChair() {
  const c = faces(PALETTE.white);
  return (
    shadow(20, 7, 0.14) +
    prism(-0.4, -0.4, 0.8, 0.8, 1.7, 0, faces("#f3efe4")) +
    prism(-0.7, -0.7, 1.4, 1.4, 0.16, 1.7, faces(PALETTE.coral)) +
    prism(-0.7, -0.7, 1.4, 0.16, 0.9, 1.86, c) +
    `<line x1="-6" y1="-45" x2="-6" y2="-70" stroke="${PALETTE.wood}" stroke-width="2"/>` +
    `<path d="M-6,-70 L18,-64 L-6,-58Z" fill="${PALETTE.yellow}"/>`
  );
}
function bucketFish() {
  return (
    shadow(13, 5, 0.14) +
    `<path d="M-9,-16 L9,-16 L7,0 L-7,0Z" fill="#4da3e0"/><ellipse cy="-16" rx="9" ry="3" fill="#78bdf0"/>` +
    `<ellipse cx="0" cy="-22" rx="8" ry="4.6" fill="#f5883a"/><path d="M7,-22 L14,-27 L14,-17Z" fill="#f5883a"/><circle cx="-4" cy="-23" r="1.3" fill="${PALETTE.ink}"/>`
  );
}
function beachBall() {
  return `<circle r="8" cy="-8" fill="#fff"/><path d="M0,-16 A8,8 0 0 1 8,-8 L0,-8Z" fill="${PALETTE.coral}"/><path d="M-8,-8 A8,8 0 0 1 0,-16 L0,-8Z" fill="${PALETTE.yellow}"/><path d="M0,0 A8,8 0 0 1 -8,-8 L0,-8Z" fill="#4da3e0"/>`;
}
function flagPole(color = PALETTE.coral, h = 62) {
  return `<line x1="0" y1="0" x2="0" y2="${-h}" stroke="#f2ead5" stroke-width="3" stroke-linecap="round"/><path d="M1,${-h} L${h * 0.42},${-h + 8} L1,${-h + 17}Z" fill="${color}"/>`;
}
function stand() {
  const steps = [2, 1, 0]
    .map((k) =>
      prism(-1.6, -0.5 - k * 0.55, 3.2, 0.6, 0.55 + k * 0.55, 0, faces(k % 2 ? "#e9b56f" : "#f0c684")),
    )
    .join("");
  const crowd = Array.from({ length: 9 }, (_, i) => {
    const gx = -1.35 + (i % 5) * 0.62,
      row = i < 5 ? 0 : 1,
      [x, y] = iso(gx, -0.2 - row * 0.55, 0.6 + row * 0.55);
    return `<circle cx="${r1(x)}" cy="${r1(y - 4)}" r="3.6" fill="${["#f26857", "#ffdc52", "#7cc4f0", "#fff4cf", "#9adf8f"][i % 5]}"/>`;
  }).join("");
  return shadow(70, 20, 0.14) + steps + crowd;
}
function tower(park) {
  const post = faces("#f7f3e6"),
    accent = faces("#4da3e0");
  return (
    shadow(28, 10, 0.16) +
    prism(-0.5, -0.5, 1, 1, 3.6, 0, post) +
    prism(-0.52, -0.52, 1.04, 1.04, 0.32, 1.1, accent) +
    prism(-0.52, -0.52, 1.04, 1.04, 0.32, 2.3, accent) +
    prism(-1.1, -1.1, 2.2, 2.2, 0.16, 3.6, faces(park ? "#f6c23c" : "#fff")) +
    `<polygon points="${pts([iso(-1.1, 1.1, 3.76), iso(1.1, 1.1, 3.76), iso(1.1, 1.1, 4.3), iso(-1.1, 1.1, 4.3)])}" fill="none" stroke="#f7f3e6" stroke-width="1.5"/>` +
    at(...iso(0, 0, 4.4), flagPole(PALETTE.coral, 36))
  );
}
// `glow` is the id of the lamp-glow gradient in the act's <defs> (every act's drawing has its own, so a hidden act's
// drawing is never the one a visible one points at), or "" for no lamps.
function cabana(glow) {
  const post = (x, y) => prism(x, y, 0.16, 0.16, 1.9, 0, faces(PALETTE.wood)),
    apex = iso(0, 0, 3.0);
  return (
    shadow(48, 16, 0.14) +
    post(-1.4, -1.4) +
    post(1.2, -1.4) +
    post(-1.4, 1.2) +
    post(1.2, 1.2) +
    poly([iso(-1.5, 1.5, 1.9), iso(1.5, 1.5, 1.9), apex], "#f2ead5") +
    poly([iso(1.5, -1.5, 1.9), iso(1.5, 1.5, 1.9), apex], PALETTE.coral) +
    (glow
      ? [
          [-1.3, 1.3],
          [1.3, 1.3],
        ]
          .map(([x, y]) =>
            at(...iso(x, y, 1.6), `<circle r="14" fill="url(#${glow})"/><circle r="3.2" fill="#ffe9a8"/>`),
          )
          .join("")
      : "")
  );
}
function podium() {
  return (
    shadow(70, 18, 0.16) +
    prism(-2.1, -0.7, 1.4, 1.4, 0.9, 0, faces("#f0c684")) +
    prism(0.7, -0.7, 1.4, 1.4, 0.6, 0, faces("#f0c684")) +
    prism(-0.7, -0.7, 1.4, 1.4, 1.3, 0, faces("#f6c23c")) +
    at(
      ...iso(0, 0, 1.3),
      `<path d="M-12,-30 Q-13,-8 0,-6 Q13,-8 12,-30Z" fill="${PALETTE.gold}"/><rect x="-3" y="-8" width="6" height="8" fill="${shade(PALETTE.gold, -0.15)}"/><rect x="-11" y="-1.5" width="22" height="4" rx="1.5" fill="${shade(PALETTE.gold, -0.25)}"/><path d="M-12,-26 Q-22,-26 -18,-14 Q-15,-10 -11,-13" stroke="${PALETTE.gold}" stroke-width="3" fill="none"/><path d="M12,-26 Q22,-26 18,-14 Q15,-10 11,-13" stroke="${PALETTE.gold}" stroke-width="3" fill="none"/><path d="M0,-25 L2.4,-19 L8,-19 L3.5,-15.5 L5.2,-10 L0,-13.4 L-5.2,-10 L-3.5,-15.5 L-8,-19 L-2.4,-19Z" fill="#fff4cf" transform="translate(0 -2) scale(.7)"/>`,
    )
  );
}
function bunting(x0, y0, x1, y1, sag = 12) {
  const cols = [PALETTE.coral, PALETTE.yellow, "#4da3e0", "#9adf8f", PALETTE.cream],
    n = 7;
  let flags = "";
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      x = x0 + (x1 - x0) * t,
      y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
    flags += `<path d="M${r1(x - 5)},${r1(y)} L${r1(x + 5)},${r1(y)} L${r1(x)},${r1(y + 10)}Z" fill="${cols[i % cols.length]}"/>`;
  }
  return (
    `<path d="M${x0},${y0} Q${(x0 + x1) / 2},${(y0 + y1) / 2 + sag * 2} ${x1},${y1}" stroke="#eadfbf" stroke-width="1.5" fill="none"/>` +
    flags
  );
}
function hotel() {
  const c = faces("#f7d9b4");
  return (
    shadow(60, 18, 0.14) +
    prism(-1.4, -1.1, 2.8, 2.2, 2.2, 0, c) +
    prism(-1.0, -0.8, 2.0, 1.6, 1.2, 2.2, faces("#f0c08a")) +
    [-0.9, 0.1, 1.1].map((x) => panelFront(1.1, x, x + 0.5, 0.6, 1.5, "#7fc6d6")).join("") +
    panelFront(0.8, -0.5, 0.5, 2.6, 3.2, "#7fc6d6") +
    at(...iso(0, 0, 3.4), flagPole(PALETTE.yellow, 26))
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Landmarks: what stands on each platform. Positions are screen offsets from the platform's centre. The front third
// of every platform is kept clear for the level nodes.
const LANDMARKS = {
  club: ({ mosaic }) =>
    at(48, -30, hall({ w: 3, d: 2.1, h: 1.7 })) +
    at(-50, 2, pool({ w: 3.3, d: 2.1, mosaic })) +
    at(112, 8, palm(-1, 0.9)) +
    bunting(-30, -70, 32, -78, 10),
  deck: ({ mosaic }) =>
    at(-40, -6, pool({ w: 4.2, d: 2.4, lanes: 2, mosaic })) +
    at(74, -34, lifeguardChair()) +
    at(112, 4, bucketFish()) +
    at(92, 14, beachBall()) +
    bunting(-95, -30, -8, -58, 12),
  stadium: ({ mosaic }) =>
    at(-30, -4, pool({ w: 4.6, d: 2.6, lanes: 3, mosaic })) +
    at(86, -38, stand()) +
    at(-112, -8, flagPole(PALETTE.coral)) +
    at(16, -78, flagPole(PALETTE.yellow, 44)),
  tower: ({ mosaic }) =>
    at(-58, 0, pool({ w: 3.8, d: 2.4, lanes: 3, mosaic, coping: "#f7f3e6" })) +
    at(74, -30, tower(true)) +
    at(118, 12, palm(1, 0.95)) +
    at(-118, -34, umbrella(PALETTE.coral)) +
    bunting(-100, -52, -6, -66, 10),
  cabana: ({ mosaic, ids }) =>
    at(48, -26, cabana(ids + "glow")) +
    at(-64, 0, pool({ w: 3.4, d: 2.2, mosaic, coping: "#f7f3e6", water: "#4aa9c8" })) +
    at(-122, -20, palm(-1, 1)) +
    at(122, 10, palm(1, 0.85)),
  sunset: ({ mosaic }) =>
    at(46, -26, hotel()) +
    at(-64, 0, pool({ w: 3.4, d: 2.2, mosaic, coping: "#f7f3e6" })) +
    at(-122, -14, palm(-1, 1)) +
    at(112, 14, umbrella("#f6c23c")),
  trophy: () =>
    at(0, -20, podium()) +
    at(-112, 2, flagPole(PALETTE.coral, 58)) +
    at(112, 2, flagPole(PALETTE.yellow, 58)) +
    [
      [-70, -84, "#f26857"],
      [64, -92, "#ffdc52"],
      [-24, -104, "#7cc4f0"],
      [30, -110, "#9adf8f"],
      [92, -66, "#f26857"],
      [-96, -60, "#ffdc52"],
    ]
      .map(
        ([x, y, c], i) =>
          `<rect x="${x}" y="${y}" width="7" height="7" rx="1.5" fill="${c}" transform="rotate(${i * 35} ${x} ${y})"/>`,
      )
      .join(""),
};

export const LANDMARK_KEYS = Object.keys(LANDMARKS);

// ---------------------------------------------------------------------------------------------------------------
// Clouds: flat cream puffs with a soft underside. They frame the map, sit under the platforms, and cover what is
// still locked.
export function cloud(w = 220, tone = "#fff8e6") {
  const h = w * 0.34;
  return (
    `<ellipse cy="${r1(h * 0.28)}" rx="${r1(w * 0.5)}" ry="${r1(h * 0.34)}" fill="${shade(tone, -0.1)}"/>` +
    `<ellipse cy="${r1(h * 0.16)}" rx="${r1(w * 0.5)}" ry="${r1(h * 0.34)}" fill="${tone}"/>` +
    [
      [-0.24, -0.06, 0.17],
      [0.0, -0.17, 0.23],
      [0.25, -0.05, 0.16],
      [-0.42, 0.06, 0.1],
      [0.44, 0.07, 0.1],
    ]
      .map(([x, y, r]) => `<circle cx="${r1(w * x)}" cy="${r1(w * y)}" r="${r1(w * r)}" fill="${tone}"/>`)
      .join("")
  );
}

// ---------------------------------------------------------------------------------------------------------------
// One act's whole picture. `theme` is "club" or "park". `zoneArt` is the landmark key of each of the four zones.
const THEMES = {
  club: { top: "#efd3a4", side1: "#d9a76f", side2: "#a86f3e", rim: "#f8e8c6", mosaic: false },
  park: { top: "#f4ecd9", side1: "#dcbb90", side2: "#b48a5b", rim: "#4fb1bd", mosaic: true },
};
export function actSvg({ id = 1, theme = "club", art = [], night = [] }, orientation = "landscape") {
  const layout = layoutAct(orientation),
    T = THEMES[theme] || THEMES.club,
    [W, H] = layout.box,
    p = `a${id}-`;
  const defs = `
    <linearGradient id="${p}side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.side1}"/><stop offset="1" stop-color="${T.side2}"/></linearGradient>
    <radialGradient id="${p}top" cx=".42" cy=".3" r=".8"><stop offset="0" stop-color="${shade(T.top, 0.25)}"/><stop offset="1" stop-color="${T.top}"/></radialGradient>
    <radialGradient id="${p}glow" r="1"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".95"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>
    <radialGradient id="${p}drop" r="1"><stop offset="0" stop-color="#062832" stop-opacity=".34"/><stop offset="1" stop-color="#062832" stop-opacity="0"/></radialGradient>
    <pattern id="${p}pavers" width="44" height="22" patternUnits="userSpaceOnUse"><path d="M0,11 L22,0 L44,11 L22,22Z" fill="none" stroke="#8a5a2e" stroke-opacity=".13" stroke-width="1"/></pattern>`;
  // A platform is drawn in two layers, so the route can pass behind the buildings but in front of the ground:
  // its ground (shadow, clouds beneath, sides, top) and what stands on it.
  const order = layout.zones.map(({ pad }, i) => ({ pad, i })).reverse(); // farther platforms first
  const bases = order
    .map(({ pad, i }) => {
      const { cx, cy, rx, ry, depth } = pad;
      return (
        `<g class="zone-ground" data-zone="${i}" transform="translate(${cx} ${cy})">` +
        `<ellipse cy="${depth + ry * 0.5 + 34}" rx="${rx * 0.95}" ry="${ry * 0.55}" fill="url(#${p}drop)"/>` +
        `<g class="puffs" transform="translate(0 ${depth + ry * 0.92})">${at(-rx * 0.5, 4, cloud(rx * 1.05))}${at(rx * 0.52, 10, cloud(rx * 1.15))}${at(0, 22, cloud(rx * 0.8, "#f4f0df"))}</g>` +
        `<path d="M${-rx},0 A${rx},${ry} 0 0 0 ${rx},0 L${rx},${depth} A${rx},${ry} 0 0 1 ${-rx},${depth}Z" fill="url(#${p}side)"/>` +
        `<path d="M${-rx},${depth * 0.55} A${rx},${ry} 0 0 0 ${rx},${depth * 0.55}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2"/>` +
        `<ellipse rx="${rx}" ry="${ry}" fill="url(#${p}top)"/>` +
        `<ellipse rx="${rx}" ry="${ry}" fill="url(#${p}pavers)"/>` +
        `<ellipse rx="${rx - 5}" ry="${ry - 2.5}" fill="none" stroke="${T.rim}" stroke-width="4" stroke-opacity=".9"/>` +
        (night[i] ? `<ellipse rx="${rx}" ry="${ry}" fill="#0c2a63" opacity=".32"/>` : "") +
        `</g>`
      );
    })
    .join("");
  const landmarks = order
    .map(({ pad, i }) => {
      const { cx, cy, rx, ry } = pad,
        landmark = (LANDMARKS[art[i]] || LANDMARKS.club)({ mosaic: T.mosaic, ids: p });
      return (
        `<g class="zone-art" data-zone="${i}" transform="translate(${cx} ${cy})">` +
        `<g class="landmark" transform="scale(${orientation === "portrait" ? 0.92 : 1.2})">${landmark}</g>` +
        (night[i]
          ? `<g transform="translate(${-rx * 0.62} ${-ry * 2.2})"><circle r="17" fill="#fff4cf"/><circle cx="8" cy="-4" r="15" fill="#123a66"/></g>` +
            [
              [-110, -140],
              [20, -160],
              [90, -128],
            ]
              .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#fff4cf" opacity=".85"/>`)
              .join("")
          : "") +
        `</g>`
      );
    })
    .join("");
  const route = layout.route
    .map(
      (s, i) =>
        `<g class="seg" data-seg="${i}"><path class="seg-shadow" d="${s.d}" transform="translate(0 9)"/><path class="seg-edge" d="${s.d}"/><path class="seg-base" d="${s.d}"/><path class="seg-dash" d="${s.d}"/></g>`,
    )
    .join("");
  const fog = layout.zones
    .map(({ pad }, i) => {
      const { cx, cy, rx, ry } = pad;
      return (
        `<g transform="translate(${cx} ${cy - ry * 0.35})"><g class="fog" data-zone="${i}">` +
        at(-rx * 0.55, -6, cloud(rx * 1.5)) +
        at(rx * 0.55, -14, cloud(rx * 1.4)) +
        at(0, -46, cloud(rx * 1.6)) +
        at(-rx * 0.3, 42, cloud(rx * 1.3)) +
        at(rx * 0.35, 50, cloud(rx * 1.2)) +
        `</g></g>`
      );
    })
    .join("");
  const edges =
    orientation === "landscape"
      ? [
          [80, 205, 320],
          [1135, 45, 250],
          [130, 700, 380],
          [640, 730, 420],
          [1110, 690, 340],
          [600, 90, 220],
        ]
      : [
          [40, 60, 230],
          [480, 200, 220],
          [60, 1210, 300],
          [470, 1180, 280],
          [40, 560, 190],
          [500, 760, 190],
        ];
  // The clouds at the edges drift, so they are separate drawings (three, each drifting on its own) that the browser
  // can move without repainting the islands: the art below never changes.
  const box = `viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" overflow="visible"`;
  const sky = [0, 1, 2]
    .map(
      (k) =>
        `<svg class="map-sky d${k}" ${box} aria-hidden="true">` +
        edges
          .map(([x, y, w], i) => (i % 3 === k ? at(x, y, cloud(w, i % 2 ? "#f6f1de" : "#fff8e6")) : ""))
          .join("") +
        `</svg>`,
    )
    .join("");
  return (
    sky +
    `<svg class="map-art" ${box} role="img" aria-label="Map of act ${id}">` +
    `<defs>${defs}</defs>` +
    `<g class="pads">${bases}</g>` +
    `<g class="route">${route}</g>` +
    `<g class="landmarks">${landmarks}</g>` +
    `<g class="fogs">${fog}</g>` +
    `</svg>`
  );
}
