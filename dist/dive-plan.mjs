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
import { springPoint, springLocal } from "./onsen-plan.mjs";
import { blockRoute } from "./roof-plan.mjs";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const DIVE = {
  deck: { minX: -13.4, maxX: 13.4, minZ: -15.0, maxZ: 15.0 },
  room: { minX: -14.2, maxX: 14.2, minZ: -16.6, maxZ: 16.6 },
  halfX: 5.6, // the basin: 11.2 m across
  halfZ: 8.0, // and 16 m long
  depth: 4.2, // deep water (the scene's floor), for the high board
  // The garden gates in the end hedges, at the near corners: in through them along z (the rooftop's lifts, `alongZ`).
  gateX: -11.0,
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
export const LADDERS = [-1, 1].flatMap((sx) =>
  [-2.6, 2.6].map((z) => ({
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

// The hot tub: a raised round tub in a teak cabinet on the near side, six seats round its rim, its steps toward the massage corner.
// The same shape as a hot spring (onsen-plan.mjs `springPoint`), with no wobble.
export const TUB = {
  id: 0,
  x: -10.3,
  z: -3.2,
  rx: 2.0,
  rz: 2.0,
  a2: 0,
  p2: 0,
  a3: 0,
  p3: 0,
  cap: 6,
  entry: Math.PI / 2,
};
TUB.r = 2.0;
TUB.rim = 0.4; // the tub's coping (not walkable: the tub's wall)
TUB.deck = 0.2; // the teak cabinet round it, past the coping (not walkable either)
// How far out from the water's edge a body clears the cabinet.
const TUB_WALL = TUB.rim + TUB.deck;
export function tubLocal(x, z) {
  return springLocal(TUB, x, z);
}
// In the tub's water, at least `margin` m in from its edge (negative: over its coping).
export const inTub = (x, z, margin = 0) => tubLocal(x, z).inside > margin;
// The tub's steps: where a guest stands on the deck to get in, the first place in the water, and the facing in.
export function tubSteps() {
  const deck = springPoint(TUB, TUB.entry, 1 + (TUB_WALL + 0.45) / TUB.r),
    water = springPoint(TUB, TUB.entry, 1 - 0.7 / TUB.r);
  return { deck, water, angle: Math.atan2(water.x - deck.x, water.z - deck.z) };
}
// The seats round the inside of its rim (a guest sits facing the middle), spread round from the steps.
export function tubSeats() {
  const seats = [];
  for (let i = 0; i < TUB.cap; i++) {
    const th = TUB.entry + Math.PI / TUB.cap + (i * TAU) / TUB.cap,
      at = springPoint(TUB, th, 1 - 0.6 / TUB.r);
    seats.push({ i, ...at, angle: Math.atan2(TUB.x - at.x, TUB.z - at.z) });
  }
  return seats;
}
// The nearest place in the tub at least `margin` in from its edge.
export function clampInTub(x, z, margin = 0.4) {
  const l = tubLocal(x, z);
  if (l.inside >= margin) return { x, z };
  return springPoint(TUB, l.th, clamp(1 - margin / l.R, 0.05, 1));
}
// Out of the tub for good (a floater, an evacuation): to its coping beside them and onto the deck, or out by the steps.
export function tubOutPath(p) {
  const l = tubLocal(p.x, p.z),
    water = springPoint(TUB, l.th, 1 - 0.35 / TUB.r),
    deck = springPoint(TUB, l.th, 1 + (TUB_WALL + 0.55) / TUB.r);
  if (diveWalkable(deck.x, deck.z, 0.3)) return [water, deck];
  const s = tubSteps();
  return [s.water, s.deck];
}

// The massage corner: two beds side by side on the near side, their heads toward the right-hand end, their fronts to the camera
// (incidents/massage.mjs reads them: `fixtures.massage` the first, by the pool, `fixtures.massageMore` the second, by the hedge).
export const MASSAGE_BEDS = [
  { x: -9.2, z: 3.6, angle: 0, side: -1 },
  { x: -11.7, z: 3.6, angle: 0, side: -1 },
];

// ---- walking -------------------------------------------------------------------------------------------------------------

// Can a body of radius `r` stand at (x, z) as far as the plan goes (the rest, the furniture, is the venue's)? Out of the tub.
export function diveWalkable(x, z, r = 0) {
  return tubLocal(x, z).inside < -(TUB_WALL + r);
}
// What a walk goes round: the pool (with its coping), the two stations, the tub (its square), and the furniture the venue passes in
// (spatial.mjs: benches, stations, the lifeguard's chair, the massage beds…).
export function diveBlocks(furniture = []) {
  const P = 0.65; // (the pool's keep-out margin, as a lane pool's)
  return [
    [-(DIVE.halfX + P), DIVE.halfX + P, -(DIVE.halfZ + 0.35), DIVE.halfZ + 0.35],
    ...STATIONS.map((s) => [s.x0, s.x1, s.z0, s.z1]),
    [TUB.x - TUB.r - TUB_WALL, TUB.x + TUB.r + TUB_WALL, TUB.z - TUB.r - TUB_WALL, TUB.z + TUB.r + TUB_WALL],
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
