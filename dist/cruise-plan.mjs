// The cruise ship's pool deck (18 October 2026, the creator: "the cruise venue… this is a physics level because we can actually see
// the ship. The ship is moving left and right… all of the furniture on top, and even the people on deck… start to go to the left if
// the ship leans to the left… a multi-use pool. It has two lanes on one half, and the other half is free. People go there and chat…
// the same mechanics of the infinity pool"). Pure data and geometry, shared by the venue (spatial.mjs), the ship (ship.mjs), the
// chilling guests (rooftop.mjs, through `CRUISE_CHILL`) and the scene (scene/cruise.mjs).
//
// The camera looks forward along the ship from the stern: the near side (-x) is aft, the far side (+x) is the bow end of the deck
// with the superstructure beyond it, and the ship's sides are left (port, -z) and right (starboard, +z), with the rails and the sea.
// So when the ship rolls, the deck tips left or right on screen and everything loose slides along z. The pool lies across the
// deck: its near half is two lap lanes (the lane pool of every venue, lanes along z), its far half free water where guests stand
// and chat (the Rooftop Pool's chilling, rooftop.mjs), a floating rope between them. Guests come up the two stairway lobbies at the
// left end (the queue for the lanes in front of them); the chilling guests walk round to the far walk and step in from there.
import { blockRoute } from "./roof-plan.mjs";

export const CRUISE = {
  lanes: [-1.6, 1.6],
  halfX: 3.4, // the lane half (the lane pool's own wall at -3.4; at +3.4 the rope)
  halfZ: 8.3,
  free: { x0: 3.4, x1: 10.2 }, // the free half of the water, past the rope
  depth: 1.2,
  deck: { minX: -15.2, maxX: 16.8, minZ: -15.4, maxZ: 15.4 },
  rail: 15.85, // the ship's rails (both sides, ±z)
  farWalk: 10.95, // where a guest stands on the far walk to step into the free water
  bar: { x: 14.6, z: -9.4, hx: 1.7, hz: 1.7 }, // the Lido Bar (serving the pool, -x)
  tubs: [{ x: 14.2, z: 13.0, r: 1.45 }], // a hot tub in the far right corner
  lounger: { hx: 1.0, hz: 0.36 }, // half a sun lounger: 2 m long (along x), 0.72 wide
  // Rows of loungers (they slide along their row when the ship rolls): `x` the row's centre line, `facing` the way their guests
  // look (+1: +x, the pool, from the near deck; -1: from the far deck), `z0`..`z1` the row's length, `homes` where each lounger
  // belongs (in pairs).
  rows: [
    { x: -7.8, facing: 1, z0: -7.7, z1: 7.7, homes: [-6.3, -5.5, -2.5, -1.7, 1.7, 2.5, 5.5, 6.3] },
    { x: -11.7, facing: 1, z0: -7.7, z1: 7.7, homes: [-6.3, -5.5, -2.5, -1.7, 1.7, 2.5, 5.5, 6.3] },
    { x: 13.5, facing: -1, z0: -5.9, z1: 10.9, homes: [-4.5, -3.7, -0.3, 0.5, 3.9, 4.7, 8.1, 8.9] },
  ],
};

// Every lounger: its row, its home (where it belongs, and stays when the ship is still) and the side its guest steps up from. Ids are
// stable: the near row, the back row, the far row, each from left to right.
export const LOUNGERS = CRUISE.rows.flatMap((row, r) =>
  row.homes.map((z) => ({ row: r, home: z })),
).map((l, id) => ({ id, ...l, cabana: false }));

// Where a lounger is now (`z`, from the ship's state when there is one, else its home) and where its guest steps up to it (`foot`).
export function loungerSpot(sim, id) {
  const l = LOUNGERS[id],
    row = CRUISE.rows[l.row],
    z = sim?.ship?.loungers?.[id]?.z ?? l.home,
    reach = CRUISE.lounger.hx + 0.35;
  return {
    id,
    x: row.x,
    z,
    foot: { x: row.x + row.facing * reach, z },
    angle: row.facing > 0 ? Math.PI / 2 : -Math.PI / 2,
    row: l.row,
    home: l.home,
    cabana: false,
  };
}

// What a walker goes round: the whole pool (both halves, with the starting blocks), each row of loungers, the bar, the hot tub and
// the two stairway lobbies. Boxes as [x0, x1, z0, z1].
export const CRUISE_BLOCKS = (() => {
  const H = CRUISE,
    L = H.lounger,
    blocks = [
      [-H.halfX - 0.65, H.free.x1 + 0.65, -H.halfZ - 0.7, H.halfZ + 0.7],
      [-2.3, 2.3, -9.8, -8.5], // the starting blocks
    ];
  for (const row of H.rows) blocks.push([row.x - L.hx - 0.15, row.x + L.hx + 0.15, row.z0 - 0.2, row.z1 + 0.2]);
  blocks.push([H.bar.x - H.bar.hx, H.bar.x + H.bar.hx, H.bar.z - H.bar.hz, H.bar.z + H.bar.hz]);
  for (const t of H.tubs) blocks.push([t.x - t.r, t.x + t.r, t.z - t.r, t.z + t.r]);
  for (const s of [-1, 1]) blocks.push(s < 0 ? [-13.6, -9.6, -15.4, -13.3] : [9.6, 13.6, -15.4, -13.3]);
  return blocks;
})();
const D = CRUISE.deck;
export const cruiseRoute = blockRoute(
  CRUISE_BLOCKS,
  (c) => c.x > D.minX + 0.3 && c.x < D.maxX - 0.3 && c.z > D.minZ + 0.3 && c.z < D.maxZ - 0.3,
);

// The cruise ship as a place to chill (rooftop.mjs): half the guests (`share`) come to chill, in the free half of the pool or on a
// lounger, and are served margaritas from the Lido Bar; they step in and out from the far walk.
const F = CRUISE.free;
export const CRUISE_CHILL = {
  water: { x0: F.x0 + 0.25, x1: F.x1, z0: -CRUISE.halfZ, z1: CRUISE.halfZ },
  edge: { stand: CRUISE.farWalk, inside: F.x1 - 0.55, out: F.x1 + 0.8, dir: -1 },
  beds: LOUNGERS,
  bed: (sim, id) => loungerSpot(sim, id),
  route: cruiseRoute,
  // Waiting for a free lounger: on the far walk by the bar.
  waitSpot: (sim, p, taken) => ({ x: 11.3 + (taken % 2) * 0.6, z: -6.3 + (Math.floor(taken / 2) % 3) * 0.75 }),
  // (Out of a stairway lobby: a step onto the deck.)
  arrive: (door, side) => ({ x: side * (door.outsideX - 1.1), z: door.doorZ + 1.4 }),
  lookAngle: Math.PI / 2, // (a guest alone in the water watches the big screen)
  bedAngle: Math.PI / 2,
  view: (p) => p.x > 7.2,
  selfie: false,
  dj: false,
  cabanas: false,
  share: 0.5,
  wading: (x, z) => x > F.x0 && x < F.x1 + 0.3 && Math.abs(z) < CRUISE.halfZ + 0.35,
  wadeable: (x, z, r) => x > F.x0 + 0.3 && x < F.x1 + 0.3 + r && Math.abs(z) < CRUISE.halfZ + 0.35 + r,
  // Fleeing the free water: over the far edge onto the far walk, or out at the nearer end.
  fleeOut(p) {
    if (!(p.x > F.x0 && p.x < F.x1 + 0.4 && Math.abs(p.z) < CRUISE.halfZ)) return null;
    const end = CRUISE.halfZ - Math.abs(p.z) < 1.6,
      s = Math.sign(p.z) || 1,
      x = Math.max(F.x0 + 0.6, Math.min(F.x1 - 0.5, p.x));
    return {
      target: end ? { x, z: s * (CRUISE.halfZ - 0.35) } : { x: F.x1 - 0.35, z: p.z },
      landing: end ? { x, z: s * (CRUISE.halfZ + 1.1) } : { x: F.x1 + 0.75, z: p.z },
    };
  },
  evacPath: (p) => [
    { x: F.x1 - 0.45, z: p.z },
    { x: F.x1 + 0.75, z: p.z },
  ],
};
