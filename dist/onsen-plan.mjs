// The Mountain Hot Springs' floor plan (18 October 2026, the creator: "a snowy kind of natural hot springs in the mountains… have
// several hot springs that the coach waters can assign guests to… three or four spots as hot natural hot springs… lots of rocks and
// snow… it's icy on the deck"). Pure data and geometry, shared by the venue (spatial.mjs), the guests and the snow monkeys
// (onsen.mjs), the incidents (through the venue's `onsen` place) and the scene (scene/onsen.mjs).
//
// The camera looks across the terrace from the near side (-x) to the mountains (+x). The bathhouse is at the left end (-z): the
// guests come out of its door and wait in the snow in front of it. Four natural springs lie in the snow, each a round, irregular
// pool rimmed with flat stones (walkable) and a few big boulders (not): the big one near left (Spring 1), a near right one (2), a far
// left one under the bamboo spout (3) and a small hot one far right (4). Each has its steps (`entry`, where guests get in and out)
// on the side that faces the paths, and seats round the inside of its rim, as many as it holds (`cap`). The forest stands round the
// terrace's far side and right end, and the snow monkeys come out of it (onsen.mjs).
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// A spring: its centre, its radii along x and z, the wobble of its outline (`a2`, `a3` with their phases), how many it holds, and
// the direction (radians, from the centre: 0 is +x, PI/2 is +z) of its steps.
export const SPRINGS = [
  { id: 0, x: -6.2, z: -1.6, rx: 3.0, rz: 3.5, a2: 0.07, p2: 0.6, a3: 0.05, p3: 1.9, cap: 5, entry: -2.2 },
  { id: 1, x: -5.6, z: 8.2, rx: 2.7, rz: 3.0, a2: 0.06, p2: 2.1, a3: 0.06, p3: 0.4, cap: 4, entry: -1.75 },
  { id: 2, x: 5.6, z: -2.4, rx: 3.1, rz: 3.5, a2: 0.08, p2: 1.2, a3: 0.05, p3: 2.8, cap: 5, entry: -2.75 },
  { id: 3, x: 6.0, z: 8.0, rx: 2.4, rz: 2.6, a2: 0.06, p2: 0.2, a3: 0.07, p3: 1.1, cap: 3, entry: -2.9 },
].map((s) => ({ ...s, r: (s.rx + s.rz) / 2 }));

export const ONSEN = {
  deck: { minX: -14.8, maxX: 14.8, minZ: -15.0, maxZ: 13.0 },
  depth: 0.95, // m of water: a guest sits in it to the shoulders
  rim: 0.7, // m of flat rim stones round the water (walkable)
  bathhouse: { x: 0, z: -17.2, hx: 4.6, hz: 2.2 }, // past the deck's left end; its door opens onto the deck at z -15
  // Where the snow monkeys come out of the forest: the far side (x), the right end (z) and the near right corner.
  forest: [
    { from: { x: 15.6, z: -13 }, to: { x: 15.6, z: 12.5 } },
    { from: { x: -13.5, z: 13.8 }, to: { x: 15.0, z: 13.8 } },
    { from: { x: -15.6, z: 2.5 }, to: { x: -15.6, z: 12.5 } },
  ],
};

// The outline's radius factor at angle `th` (1 on the ellipse).
const shape = (s, th) => 1 + s.a2 * Math.cos(2 * th + s.p2) + s.a3 * Math.cos(3 * th + s.p3);
// A point of a spring at angle `th` and normalized radius `r` (1: the water's edge).
export function springPoint(s, th, r = 1) {
  const k = r * shape(s, th);
  return { x: s.x + Math.cos(th) * s.rx * k, z: s.z + Math.sin(th) * s.rz * k };
}
// Where (x, z) is from a spring: the angle, the normalized radius (below 1: in the water) and roughly how far in from the edge
// (m, negative outside).
export function springLocal(s, x, z) {
  const u = (x - s.x) / s.rx,
    v = (z - s.z) / s.rz,
    th = Math.atan2(v, u),
    f = shape(s, th),
    rho = Math.hypot(u, v) / f,
    // (The local radius along this direction, for metres.)
    R = Math.hypot(Math.cos(th) * s.rx, Math.sin(th) * s.rz) * f;
  return { th, rho, inside: (1 - rho) * R, R };
}
// The spring (x, z) is in (`margin` m inside its edge at least: negative reaches out over the rim), or null.
export function springAt(x, z, margin = 0) {
  for (const s of SPRINGS) if (springLocal(s, x, z).inside > margin) return s;
  return null;
}

// The steps of a spring: where a guest stands on the rim to get in (`deck`), the first place in the water (`water`), and the
// facing in (`angle`, the game's: atan2 of the direction in x and z).
export function springSteps(s) {
  const deck = springPoint(s, s.entry, 1 + (ONSEN.rim + 0.35) / s.r),
    water = springPoint(s, s.entry, 1 - 0.75 / s.r);
  return { deck, water, angle: Math.atan2(water.x - deck.x, water.z - deck.z) };
}
// The seats round the inside of a spring's rim: `cap` of them, spread round from the steps (a guest sits facing the middle).
export function springSeats(s) {
  const seats = [];
  for (let i = 0; i < s.cap; i++) {
    const th = s.entry + Math.PI / s.cap + (i * TAU) / s.cap,
      at = springPoint(s, th, 1 - 0.62 / s.r);
    seats.push({ i, ...at, angle: Math.atan2(s.x - at.x, s.z - at.z) });
  }
  return seats;
}

// Boulders round the springs and about the terrace (in the way: the flat rim stones are not). Each is a circle on the deck; the
// scene puts the big snow-capped rocks there. None at a spring's steps.
export const BOULDERS = (() => {
  const out = [];
  SPRINGS.forEach((s, k) => {
    const n = 4 + (k % 2);
    for (let i = 0; i < n; i++) {
      const th = s.entry + Math.PI * 0.42 + (i * (TAU - Math.PI * 0.84)) / (n - 1),
        r = 0.55 + ((i * 7 + k * 3) % 5) * 0.08,
        at = springPoint(s, th, 1 + (ONSEN.rim + r * 0.75) / s.r);
      out.push({ x: at.x, z: at.z, r, spring: s.id });
    }
  });
  for (const b of [
    { x: -13.2, z: -6.5, r: 0.8 },
    { x: 13.4, z: 2.6, r: 0.9 },
    { x: 0.4, z: 3.0, r: 0.75 },
    { x: -0.6, z: 12.0, r: 0.85 },
    { x: 12.8, z: -11.6, r: 0.7 },
  ])
    out.push({ ...b, spring: null });
  // (None in front of any spring's steps: the way in stays clear.)
  const steps = SPRINGS.map((s) => springSteps(s).deck);
  return out.filter((b) => steps.every((d) => Math.hypot(b.x - d.x, b.z - d.z) > b.r + 0.9));
})();

// Can a body of radius `r` stand at (x, z) on the terrace (out of the water, clear of the boulders)?
export function onsenWalkable(x, z, r = 0) {
  for (const s of SPRINGS) if (springLocal(s, x, z).inside > -r) return false;
  for (const b of BOULDERS) if (Math.hypot(x - b.x, z - b.z) < b.r + r) return false;
  return true;
}
// The nearest place in spring `s` at least `margin` m in from its edge (where (x, z) is, if it already is).
export function clampInSpring(s, x, z, margin = 0.4) {
  const l = springLocal(s, x, z);
  if (l.inside >= margin) return { x, z };
  return springPoint(s, l.th, clamp(1 - margin / l.R, 0.05, 1));
}
// In a spring's water, at least `margin` m in from its edge (a negative margin reaches out over the rim).
export const inSpring = (x, z, margin = 0) => !!springAt(x, z, margin);

// ---- the walks between ---------------------------------------------------------------------------------------------------

// A walk round the springs and the boulders: corners on a ring round each spring (a step out from its rim) and round each boulder,
// joined where the straight line between them is clear; the shortest way by Dijkstra. The corners and which pairs see each other
// are worked out once; a query only adds its two ends.
const PAD = 0.45;
const CORNERS = (() => {
  const out = [];
  for (const s of SPRINGS)
    for (let i = 0; i < 14; i++) out.push(springPoint(s, (i * TAU) / 14, 1 + (ONSEN.rim + PAD + 0.25) / s.r));
  for (const b of BOULDERS)
    for (let i = 0; i < 6; i++) {
      const th = (i * TAU) / 6;
      out.push({ x: b.x + Math.cos(th) * (b.r + PAD + 0.15), z: b.z + Math.sin(th) * (b.r + PAD + 0.15) });
    }
  const D = ONSEN.deck;
  return out.filter(
    (c) =>
      c.x > D.minX + 0.3 &&
      c.x < D.maxX - 0.3 &&
      c.z > D.minZ + 0.3 &&
      c.z < D.maxZ - 0.3 &&
      onsenWalkable(c.x, c.z, PAD),
  );
})();
// How far a point is from the segment a-b.
function segDistance(a, b, p) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    L = dx * dx + dz * dz,
    t = L ? clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / L, 0, 1) : 0;
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
}
// (A circle round each spring that holds all of its water.)
for (const s of SPRINGS) s.reach = Math.max(s.rx, s.rz) * (1 + s.a2 + s.a3) + 0.05;
// Is the straight line from a to b clear for a walker of radius `r`? The boulders exactly; a spring the line passes near, sampled
// every 0.2 m (the others are skipped).
export function clearLine(a, b, r = 0.3) {
  for (const o of BOULDERS) if (segDistance(a, b, o) < o.r + r) return false;
  const near = SPRINGS.filter((s) => segDistance(a, b, s) < s.reach + r);
  if (!near.length) return true;
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.2));
  for (let k = 1; k < n; k++) {
    const t = k / n,
      x = a.x + (b.x - a.x) * t,
      z = a.z + (b.z - a.z) * t;
    for (const s of near) if (springLocal(s, x, z).inside > -r) return false;
  }
  return true;
}
const SEES = CORNERS.map((a, i) => CORNERS.map((b, j) => i !== j && clearLine(a, b)));
export function onsenRoute(from, to) {
  // (A walker starting or ending off the walkable deck (in a spring, on its steps) steps straight to its first corner.)
  if (clearLine(from, to)) return [{ x: to.x, z: to.z }];
  const n = CORNERS.length,
    fromSees = CORNERS.map((c) => clearLine(from, c)),
    toSees = CORNERS.map((c) => clearLine(c, to));
  // Ends that see nothing (in the water, on the steps): let them see their nearest corners.
  const fix = (sees, p) => {
    if (sees.some(Boolean)) return;
    const near = CORNERS.map((c, i) => [Math.hypot(c.x - p.x, c.z - p.z), i]).sort((a, b) => a[0] - b[0]);
    for (const [, i] of near.slice(0, 3)) sees[i] = true;
  };
  fix(fromSees, from);
  fix(toSees, to);
  const dist = Array(n).fill(Infinity),
    prev = Array(n).fill(-1),
    done = Array(n).fill(false);
  for (let i = 0; i < n; i++)
    if (fromSees[i]) dist[i] = Math.hypot(CORNERS[i].x - from.x, CORNERS[i].z - from.z);
  let best = Infinity,
    last = -1;
  for (let k = 0; k < n; k++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] >= best) break;
    done[u] = true;
    if (toSees[u]) {
      const d = dist[u] + Math.hypot(to.x - CORNERS[u].x, to.z - CORNERS[u].z);
      if (d < best) {
        best = d;
        last = u;
      }
    }
    for (let v = 0; v < n; v++) {
      if (done[v] || !SEES[u][v]) continue;
      const d = dist[u] + Math.hypot(CORNERS[v].x - CORNERS[u].x, CORNERS[v].z - CORNERS[u].z);
      if (d < dist[v]) {
        dist[v] = d;
        prev[v] = u;
      }
    }
  }
  if (last < 0) return [{ x: to.x, z: to.z }];
  const path = [{ x: to.x, z: to.z }];
  for (let i = last; i >= 0; i = prev[i]) path.unshift({ x: CORNERS[i].x, z: CORNERS[i].z });
  return path;
}

// The springs as a place in the water (the incidents ask it, as they ask the Lazy River: spatial.mjs `onsen`).
export const ONSEN_WATER = {
  springs: SPRINGS,
  springAt,
  // In a spring, at least `margin` in from its edge (negative: within that much of it, on the rim).
  inWater: (x, z, margin = 0) => inSpring(x, z, margin),
  // How far (x, z) is inside the nearest spring's edge, less `margin` (negative: outside).
  clearance(x, z, margin = 0.5) {
    let best = -Infinity;
    for (const s of SPRINGS) best = Math.max(best, springLocal(s, x, z).inside);
    return best - margin;
  },
  // From a deck spot at a spring's edge, the place `depth` m into the water toward its middle.
  fromBank(spot, depth = 1.2) {
    const s = nearestSpring(spot),
      q = springLocal(s, spot.x, spot.z);
    return springPoint(s, q.th, clamp(1 - depth / s.r, 0.15, 0.95));
  },
  // The rim beside a place in the water: `water` just inside the edge, `deck` just outside on the rim.
  bank(x, z, { inside = 0.35, outside = 0.75 } = {}) {
    const s = nearestSpring({ x, z }),
      q = springLocal(s, x, z);
    return {
      spring: s.id,
      water: springPoint(s, q.th, 1 - inside / s.r),
      deck: springPoint(s, q.th, 1 + outside / s.r),
    };
  },
  // A clear place in a spring's water (for a fish, a floater): `r` of the way out from its middle at angle `th`.
  point: (s, th, r) => springPoint(s, th, r),
};
export function nearestSpring(p) {
  let best = SPRINGS[0],
    d = Infinity;
  for (const s of SPRINGS) {
    const q = springLocal(s, p.x, p.z),
      e = Math.abs(q.inside);
    if (q.inside > 0) return s;
    if (e < d) {
      d = e;
      best = s;
    }
  }
  return best;
}
// Deck spots right at the springs' edges (on the rim, facing the water), for visitors who want to reach the water.
export function onsenEdgeSpots() {
  const spots = [];
  for (const s of SPRINGS)
    for (let i = 0; i < 10; i++) {
      const th = s.entry + (i * TAU) / 10,
        at = springPoint(s, th, 1 + 0.45 / s.r),
        inward = springPoint(s, th, 0.5);
      const dx = inward.x - at.x,
        dz = inward.z - at.z,
        n = Math.hypot(dx, dz) || 1;
      spots.push({
        x: at.x,
        z: at.z,
        spring: s.id,
        // (Which way the water is, for those who face it: `dir`, like a river bank's `fx`, `fz`.)
        dir: true,
        fx: dx / n,
        fz: dz / n,
        face: Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) : Math.sign(dz),
        axis: Math.abs(dx) > Math.abs(dz) ? "x" : "z",
        angle: Math.atan2(dx, dz),
      });
    }
  return spots.filter((s) => onsenWalkable(s.x, s.z, 0.3));
}
