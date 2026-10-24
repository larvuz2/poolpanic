// The Jumping Pool's floor plan (24 October 2026, the creator: "an open-air country-club complex… one large, deep rectangular
// pool… no lanes, ropes or competitions… two diving stations on opposite sides… LOW: a flexible springboard… MEDIUM: a rigid
// platform… HIGH: a rigid platform reached by stairs… height markers in green, yellow and red… an open massage corner: two massage
// beds side by side… LETS ADD A HOTTUB HERE"). Pure data and geometry, shared by the venue (spatial.mjs), the divers and the hot
// tub (dive.mjs) and the scene (scene/dive.mjs).
//
// The camera looks across the pool from the near side (-x). The pool lies along z, deep and wide, with a diving station at each
// end (screen left, -z, and right, +z): three boards side by side across the end, the green LOW springboard nearest the camera, the
// yellow MID platform in the middle and the red HIGH platform farthest away (so its tower never hides the water). Each board has its
// own stairs going up from the deck behind the station, and its own line at the stairs' foot. The guests come in through two garden
// gates in the end hedges, at the near corners, and wait on the lawn by their gate until the coach sends them somewhere. Out of the
// water by the ladders on the long sides. On the near side, by the coach (the creator, 24 October 2026: "switch the hot tub and
// massage area… closer to camera where coach spawn"): the hot tub (left) and the open massage corner (right, two beds side by side);
// the towels, the eye care and the rescue bench on the far side. Round it all, the country club's garden: hedges, flower beds, trees
// and the clubhouse beyond the far side.
import { blockRoute } from "./roof-plan.mjs";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const DIVE = {
  // (the near side, the camera's, is narrow: the walk by the pool, the hot tub and the massage beds; the far side is wide)
  deck: { minX: -9.7, maxX: 13.4, minZ: -15.0, maxZ: 15.0 },
  room: { minX: -10.5, maxX: 14.2, minZ: -16.6, maxZ: 16.6 },
  halfX: 5.6, // the basin: 11.2 m across
  halfZ: 8.0, // and 16 m long
  depth: 4.2, // deep water (the scene's floor), for the high board
  // The garden gates in the end hedges, at the near corners: in through them along z (the rooftop's lifts, `alongZ`).
  gateX: -8.2,
};

// The three heights (the creator: green, yellow, red markers). `y` the board's top above the water, `x` where its board stands
// across the station, `climb` seconds up its stairs, `spring` the LOW springboard (it bends and bounces), `points` what a dive
// from it is worth.
export const HEIGHTS = [
  {
    id: 0,
    key: "low",
    name: "LOW",
    label: "Springboard",
    metres: 1,
    y: 1.0,
    x: -3.4,
    climb: 1.0,
    spring: true,
    color: "#46b553",
  },
  {
    id: 1,
    key: "mid",
    name: "MID",
    label: "3 m platform",
    metres: 3,
    y: 3.0,
    x: 0,
    climb: 2.2,
    color: "#f1c232",
  },
  {
    id: 2,
    key: "high",
    name: "HIGH",
    label: "6 m platform",
    metres: 6,
    y: 6.0,
    x: 3.4,
    climb: 4.0,
    color: "#e2453c",
  },
];
// Where the hot tub is in the coach's numbers: the fourth "lane" (TUB, key 4), after the three heights.
export const TUB_LANE = 3;
// How many may stand in one board's line before it is crowded (and the line goes no further).
export const LINE_ROOM = 3;
export const LINE_MAX = 4;

// A board: one height at one end (`side` -1 the left end, +1 the right end). Its tip overhangs the water; its back stands over the
// coping; its stairs come down to the deck behind the station; its line stands behind the stairs' foot, one behind the other.
function makeBoard(side, h) {
  const H = HEIGHTS[h],
    z = (d) => side * (DIVE.halfZ + d),
    tip = H.spring ? -1.6 : -1.25; // (the springboard reaches a little farther out)
  return {
    id: (side < 0 ? 0 : 3) + h,
    side,
    h,
    x: H.x,
    y: H.y,
    // Along z: the tip over the water, the back over the coping, the stairs' top and foot.
    tipZ: z(tip),
    backZ: z(0.9),
    topZ: z(1.6),
    footZ: z(3.7),
    // The way a diver faces off the tip: toward the middle of the pool.
    angle: side < 0 ? 0 : Math.PI,
    dir: -side,
    line: Array.from({ length: LINE_MAX }, (_, k) => ({ x: H.x, z: z(4.45 + k * 0.8) })),
  };
}
export const BOARDS = [-1, 1].flatMap((side) => HEIGHTS.map((H) => makeBoard(side, H.id)));
export const boardAt = (side, h) => BOARDS[(side < 0 ? 0 : 3) + h];
// The station's frame at each end (towers, stairs): in the way of anyone walking.
export const STATIONS = [-1, 1].map((side) => ({
  side,
  x0: -4.4,
  x1: 4.4,
  z0: side < 0 ? -(DIVE.halfZ + 4.0) : DIVE.halfZ + 0.35,
  z1: side < 0 ? -(DIVE.halfZ + 0.35) : DIVE.halfZ + 4.0,
}));

// The ladders out of the pool, on the long sides: `water` the foot of the ladder in the water, `deck` the top on the deck.
// (On the near side they are toward the ends, clear of the hot tub and the massage beds on the narrow walk.)
export const LADDERS = [-1, 1].flatMap((sx) =>
  (sx < 0 ? [-6.4, 6.6] : [-2.6, 2.6]).map((z) => ({
    side: sx,
    water: { x: sx * (DIVE.halfX - 0.45), z },
    deck: { x: sx * (DIVE.halfX + 0.95), z },
    angle: sx < 0 ? -Math.PI / 2 : Math.PI / 2, // (facing out of the pool, climbing)
  })),
);
export function nearestLadder(p, sx = null) {
  let best = LADDERS[0],
    d = Infinity;
  for (const l of LADDERS) {
    if (sx && l.side !== sx) continue;
    const e = Math.hypot(l.water.x - p.x, l.water.z - p.z);
    if (e < d) {
      d = e;
      best = l;
    }
  }
  return best;
}

// The hot tub: a long raised rectangular tub in a teak cabinet on the near side, along the walk by the pool (the creator, 24 October
// 2026: "make the lower area of this pool thinner… a rectangular hot tub", so the near deck is narrow and the camera can show the
// HIGH boards), six seats in two rows facing each other, its steps at the end toward the massage corner. `hx`, `hz`: the water's
// half-width (across, x) and half-length (along the pool, z).
export const TUB = { id: 0, x: -8.4, z: -3.0, hx: 0.7, hz: 1.7, cap: 6, entry: Math.PI / 2 };
TUB.rim = 0.25; // the tub's coping (not walkable: the tub's wall)
TUB.deck = 0.15; // the teak cabinet round it, past the coping (not walkable either)
// How far out from the water's edge a body clears the cabinet.
const TUB_WALL = TUB.rim + TUB.deck;
// Where (x, z) is from the tub: the angle round its middle, and how far in from the water's edge (m, negative outside).
export function tubLocal(x, z) {
  const dx = x - TUB.x,
    dz = z - TUB.z,
    ox = Math.abs(dx) - TUB.hx,
    oz = Math.abs(dz) - TUB.hz;
  const inside = ox <= 0 && oz <= 0 ? Math.min(-ox, -oz) : -Math.hypot(Math.max(0, ox), Math.max(0, oz));
  return { th: Math.atan2(dz, dx), inside };
}
// In the tub's water, at least `margin` m in from its edge (negative: over its coping).
export const inTub = (x, z, margin = 0) => tubLocal(x, z).inside > margin;
// The point on the tub's edge nearest (x, z), moved `out` metres outward (negative: into the water).
export function tubEdge(x, z, out = 0) {
  const dx = x - TUB.x,
    dz = z - TUB.z;
  // (the long sides unless it is past an end)
  if (Math.abs(dz) - TUB.hz > Math.abs(dx) - TUB.hx)
    return {
      x: clamp(x, TUB.x - TUB.hx + 0.25, TUB.x + TUB.hx - 0.25),
      z: TUB.z + Math.sign(dz || 1) * (TUB.hz + out),
    };
  return {
    x: TUB.x + Math.sign(dx || 1) * (TUB.hx + out),
    z: clamp(z, TUB.z - TUB.hz + 0.25, TUB.z + TUB.hz - 0.25),
  };
}
// The tub's steps, at its end toward the massage corner: where a guest stands on the deck to get in, the first place in the water,
// and the facing in.
export function tubSteps() {
  const e = Math.sign(Math.sin(TUB.entry)) || 1,
    deck = { x: TUB.x, z: TUB.z + e * (TUB.hz + TUB_WALL + 0.45) },
    water = { x: TUB.x, z: TUB.z + e * (TUB.hz - 0.45) };
  return { deck, water, angle: Math.atan2(water.x - deck.x, water.z - deck.z) };
}
// The seats: two rows along its long sides, facing each other across the water, the first by the steps.
export function tubSeats() {
  const seats = [],
    rows = [1, -1],
    per = Math.ceil(TUB.cap / 2),
    e = Math.sign(Math.sin(TUB.entry)) || 1;
  for (let i = 0; i < TUB.cap; i++) {
    const row = rows[i % 2],
      k = Math.floor(i / 2),
      along = e * (TUB.hz - 0.55 - (k * (2 * TUB.hz - 1.1)) / Math.max(1, per - 1)),
      at = { x: TUB.x + row * (TUB.hx - 0.38), z: TUB.z + along };
    seats.push({ i, ...at, angle: row > 0 ? -Math.PI / 2 : Math.PI / 2 });
  }
  return seats;
}
// The nearest place in the tub at least `margin` in from its edge.
export function clampInTub(x, z, margin = 0.4) {
  const mx = Math.max(0.05, TUB.hx - margin),
    mz = Math.max(0.05, TUB.hz - margin);
  return { x: clamp(x, TUB.x - mx, TUB.x + mx), z: clamp(z, TUB.z - mz, TUB.z + mz) };
}
// Out of the tub for good (a floater, an evacuation): to its coping beside them and onto the deck, or out by the steps.
export function tubOutPath(p) {
  const water = tubEdge(p.x, p.z, -0.35),
    deck = tubEdge(p.x, p.z, TUB_WALL + 0.55);
  if (diveWalkable(deck.x, deck.z, 0.3)) return [water, deck];
  const s = tubSteps();
  return [s.water, s.deck];
}

// The massage corner: two beds end to end along the walk on the near side, lengthwise along the pool, their fronts (where a coach
// stands) toward the pool and the guests' side toward the hedge (incidents/massage.mjs reads them: `fixtures.massage` the first,
// by the hot tub, `fixtures.massageMore` the second).
export const MASSAGE_BEDS = [
  { x: -8.4, z: 1.5, angle: 0, side: 1 },
  { x: -8.4, z: 5.0, angle: 0, side: 1 },
];

// ---- walking -------------------------------------------------------------------------------------------------------------

// Can a body of radius `r` stand at (x, z) as far as the plan goes (the rest, the furniture, is the venue's)? Out of the tub.
export function diveWalkable(x, z, r = 0) {
  return !(Math.abs(x - TUB.x) < TUB.hx + TUB_WALL + r && Math.abs(z - TUB.z) < TUB.hz + TUB_WALL + r);
}
// What a walk goes round: the pool (with its coping), the two stations, the tub (its square), and the furniture the venue passes in
// (spatial.mjs: benches, stations, the lifeguard's chair, the massage beds…).
export function diveBlocks(furniture = []) {
  const P = 0.65; // (the pool's keep-out margin, as a lane pool's)
  return [
    [-(DIVE.halfX + P), DIVE.halfX + P, -(DIVE.halfZ + 0.35), DIVE.halfZ + 0.35],
    ...STATIONS.map((s) => [s.x0, s.x1, s.z0, s.z1]),
    [
      TUB.x - TUB.hx - TUB_WALL,
      TUB.x + TUB.hx + TUB_WALL,
      TUB.z - TUB.hz - TUB_WALL,
      TUB.z + TUB.hz + TUB_WALL,
    ],
    ...furniture
      .filter((f) => f.hx && f.block !== false)
      .map((f) => [f.x - f.hx, f.x + f.hx, f.z - f.hz, f.z + f.hz]),
  ];
}
export function makeDiveRoute(furniture) {
  const D = DIVE.deck;
  return blockRoute(
    diveBlocks(furniture),
    (c) => c.x > D.minX + 0.3 && c.x < D.maxX - 0.3 && c.z > D.minZ + 0.3 && c.z < D.maxZ - 0.3,
  );
}

// The landing zone of a board: where a diver from it comes down (the middle of their arc's end), and how far round it must be clear.
export const LANDING = { reach: 1.5 };
export function landingSpot(board, travel) {
  return { x: board.x, z: clamp(board.tipZ + board.dir * travel, -DIVE.halfZ + 1.4, DIVE.halfZ - 1.4) };
}

// The pool and the tub as places in the water (the incidents ask, as they ask the hot springs: spatial.mjs `dive`).
export const DIVE_WATER = {
  tub: TUB,
  inPool: (x, z, margin = 0) => Math.abs(x) < DIVE.halfX - margin && Math.abs(z) < DIVE.halfZ - margin,
  inTub,
  inWater: (x, z, margin = 0) =>
    (Math.abs(x) < DIVE.halfX - margin && Math.abs(z) < DIVE.halfZ - margin) || inTub(x, z, margin),
};
