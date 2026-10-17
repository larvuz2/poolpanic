// The Rooftop Pool's floor plan (17 October 2026): where everything stands on the roof, and how a guest walks round it. Pure data
// and geometry, shared by the venue (spatial.mjs), the guests (rooftop.mjs) and the scene (scene/rooftop.mjs).
//
// The camera looks across the roof from the near side (-x) towards the city (+x). The pool runs the length of the roof (along z),
// shallow (a guest stands in it chest-deep), and its far side is the infinity edge: the water spills over a knife edge into a
// catch gutter a step lower, and past the glass rail there is nothing but the city a long way down. Two lifts face each other
// from the two ends of the deck (the guests come up from both sides). On the near side, a walk along the water, then a row of
// sunbeds in pairs under parasols, a second row behind with two white VIP cabanas and a lounge in the middle; the cocktail bar
// at the far left end, the DJ booth at the far right end.

export const ROOF = {
  halfX: 3.4, // the basin: near wall at -3.4, the infinity edge at +3.4
  halfZ: 10.2,
  depth: 1.15, // m of water: chest-deep on a guest
  gutter: { x0: 3.7, x1: 4.6 }, // the catch gutter past the infinity edge (a step lower)
  rail: 4.72, // the glass rail at the end of the roof
  rowA: -6.9, // the front row of sunbeds (centres)
  rowB: -10.8, // the back row
  bed: { hx: 1.0, hz: 0.38 }, // half a sunbed: 2 m long (along x), 0.76 wide
  pairGap: 0.65, // a bed either side of its pair's centre
  pairsA: [-8.2, -4.1, 4.1, 8.2],
  pairsB: [-8.9, 8.9],
  cabanas: [-5.6, 5.6], // on the back row
  cabanaX: -11.3,
  cabana: { hx: 1.3, hz: 1.3 },
  lounge: { x: -11.0, z: 0, hx: 1.4, hz: 1.8 }, // sofas round a fire table
  aisles: [-6.15, 0, 6.15], // the ways through the front row
  // The lifts: in the two end walls, at the same x (spatial.mjs `doors`, `alongZ`).
  lift: { x: -6.2, insideZ: 16.15, doorZ: 15.45, outsideZ: 14.6 },
  bar: { x: 1.4, z: -13.75, hx: 1.9, hz: 0.48 }, // the counter (the barman behind it, against the end wall)
  dj: { x: 1.6, z: 13.75, hx: 1.15, hz: 0.45 }, // the booth (the DJ behind it, facing the pool)
};

// Every sunbed and cabana: where it stands (its centre), where a guest steps up to it (`foot`, on the walk side) and where the
// coach serves it from. A bed lies along x, its head (the raised back) towards the near wall, so its guest looks at the pool and
// the city beyond. Ids are stable: the front row from left to right, then the back row, then the two cabanas.
export const ROOF_BEDS = (() => {
  const beds = [];
  const row = (x, pairs) => {
    for (const z0 of pairs)
      for (const s of [-1, 1]) {
        const z = z0 + s * ROOF.pairGap;
        beds.push({ id: beds.length, x, z, foot: { x: x + ROOF.bed.hx + 0.35, z }, cabana: false });
      }
  };
  row(ROOF.rowA, ROOF.pairsA);
  row(ROOF.rowB, ROOF.pairsB);
  for (const z of ROOF.cabanas)
    beds.push({
      id: beds.length,
      x: ROOF.cabanaX,
      z,
      foot: { x: ROOF.cabanaX + ROOF.cabana.hx + 0.35, z },
      cabana: true,
    });
  return beds;
})();

// What a guest walks round: the basin and its gutter, each pair of sunbeds with its parasol, the cabanas, the lounge, the bar and
// the DJ booth. Boxes as [x0, x1, z0, z1].
const PAD = 0.25;
export const ROOF_BLOCKS = (() => {
  const b = ROOF.bed,
    blocks = [[-ROOF.halfX - 0.65, ROOF.gutter.x1 + 0.2, -ROOF.halfZ - 0.7, ROOF.halfZ + 0.7]];
  for (const [x, pairs] of [
    [ROOF.rowA, ROOF.pairsA],
    [ROOF.rowB, ROOF.pairsB],
  ])
    for (const z0 of pairs)
      blocks.push([
        x - b.hx - 0.45,
        x + b.hx + 0.05,
        z0 - ROOF.pairGap - b.hz - 0.05,
        z0 + ROOF.pairGap + b.hz + 0.05,
      ]);
  for (const z of ROOF.cabanas)
    blocks.push([
      ROOF.cabanaX - ROOF.cabana.hx,
      ROOF.cabanaX + ROOF.cabana.hx,
      z - ROOF.cabana.hz,
      z + ROOF.cabana.hz,
    ]);
  const L = ROOF.lounge;
  blocks.push([L.x - L.hx, L.x + L.hx, L.z - L.hz, L.z + L.hz]);
  for (const f of [ROOF.bar, ROOF.dj]) blocks.push([f.x - f.hx, f.x + f.hx, f.z - f.hz, f.z + f.hz]);
  return blocks;
})();

// Does the segment a→b pass through the open box? (Liang–Barsky clipping, as spatial.mjs does for the basin.)
function hitsBox(a, b, [x0, x1, z0, z1]) {
  let t0 = 0,
    t1 = 1;
  const dx = b.x - a.x,
    dz = b.z - a.z;
  for (const [p, q] of [
    [-dx, a.x - x0],
    [dx, x1 - a.x],
    [-dz, a.z - z0],
    [dz, z1 - a.z],
  ]) {
    if (Math.abs(p) < 1e-9) {
      if (q <= 0) return false;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 >= t1) return false;
    }
  }
  return t1 - t0 > 1e-6;
}
const inside = (p, [x0, x1, z0, z1]) => p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1;

// A deck route round a set of blocks (boxes [x0, x1, z0, z1]): the shortest walk from `from` to `to`, turning only just outside the
// blocks' corners (those `keep` allows), a straight line when nothing is in the way. A walker standing inside a block (a guest
// getting off a sunbed) steps straight out of it first: the box it starts in (or ends in) does not count. The Rooftop Pool's and the
// cruise ship's deck (cruise-plan.mjs).
export function blockRoute(BLOCKS, keep = () => true) {
  const corners = BLOCKS.flatMap(([x0, x1, z0, z1]) =>
    [
      { x: x0 - PAD, z: z0 - PAD },
      { x: x0 - PAD, z: z1 + PAD },
      { x: x1 + PAD, z: z0 - PAD },
      { x: x1 + PAD, z: z1 + PAD },
    ].filter((c) => keep(c) && !BLOCKS.some((box) => inside(c, box))),
  );
  return function route(from, to) {
    const ignore = BLOCKS.filter((box) => inside(from, box) || inside(to, box)),
      blocks = BLOCKS.filter((box) => !ignore.includes(box)),
      blocked = (a, b) => blocks.some((box) => hitsBox(a, b, box));
    if (!blocked(from, to)) return [{ x: to.x, z: to.z }];
    const nodes = [from, ...corners, to],
      n = nodes.length,
      dist = Array(n).fill(Infinity),
      prev = Array(n).fill(-1),
      done = Array(n).fill(false);
    dist[0] = 0;
    for (let k = 0; k < n; k++) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || dist[u] === Infinity || u === n - 1) break;
      done[u] = true;
      for (let v = 0; v < n; v++) {
        if (done[v]) continue;
        const d = dist[u] + Math.hypot(nodes[u].x - nodes[v].x, nodes[u].z - nodes[v].z);
        if (d < dist[v] && !blocked(nodes[u], nodes[v])) {
          dist[v] = d;
          prev[v] = u;
        }
      }
    }
    if (prev[n - 1] < 0) return [{ x: to.x, z: to.z }];
    const path = [];
    for (let i = n - 1; i > 0; i = prev[i]) path.unshift({ x: nodes[i].x, z: nodes[i].z });
    return path;
  };
}

// The shortest walk from `from` to `to` round everything on the roof (no corner past the glass rail: there is no deck there).
export const roofRoute = blockRoute(ROOF_BLOCKS, (c) => c.x < ROOF.rail - 0.3);

// The Rooftop Pool as a place to chill (rooftop.mjs reads a venue's `chill` plan, so another venue can have chilling guests too:
// the cruise ship's free half of the pool, cruise-plan.mjs). `water`: the box the guests stand in (chest-deep); `edge`: the side
// they step in from and are served from (`stand` on the deck, `inside` a step into the water, `out` where they climb out to, `dir`
// the way in, +1 along +x); `bed(sim, id)` where a sunbed is (its centre, its `foot`, `angle` the way its guest faces, `cabana`);
// `waitSpot` where a guest waits for a free bed; `lookAngle` the way a guest alone in the water faces; `view(p)` whether they are
// enjoying the view; `selfie` and `dj`: the rooftop's own trouble.
export const ROOF_CHILL = {
  water: { x0: -ROOF.halfX, x1: ROOF.halfX, z0: -ROOF.halfZ, z1: ROOF.halfZ },
  edge: { stand: -ROOF.halfX - 0.75, inside: -ROOF.halfX + 0.55, out: -ROOF.halfX - 0.8, dir: 1 },
  beds: ROOF_BEDS,
  bed: (sim, id) => ROOF_BEDS[id],
  route: roofRoute,
  waitSpot(sim, p, taken) {
    const aisle = ROOF.aisles.reduce((a, b) => (Math.abs(b - p.z) < Math.abs(a - p.z) ? b : a));
    return { x: -5.0 - (taken % 2) * 0.7, z: aisle + (Math.floor(taken / 2) % 3) * 0.75 - 0.75 };
  },
  // (Out of a lift: a step onto the deck, beside the lift.)
  arrive: (door, side) => ({ x: door.doorX + 0.4, z: side * (door.outsideZ - 1.3) }),
  lookAngle: Math.PI / 2,
  bedAngle: Math.PI / 2, // (lying with the head to the near wall, looking at the water and the city)
  view: (p) => p.x > ROOF.halfX - 1.4,
  selfie: true,
  dj: true,
  // Where the coach is in the water (wading), and where he may step (`r` his radius): the water and its coping on the near side and
  // the ends, never past the infinity edge.
  wading: (x, z) => Math.abs(x) < ROOF.halfX + 0.3 && Math.abs(z) < ROOF.halfZ + 0.35,
  wadeable: (x, z, r) =>
    x > -ROOF.halfX - 0.3 - r && x < ROOF.halfX - 0.25 && Math.abs(z) < ROOF.halfZ + 0.35 + r,
  // Fleeing the water (the fish, Carl): over the near edge onto the walk, or out at the nearer end (the far side is the infinity
  // edge). Null when the guest is not in the water. `P` is the venue's pool.
  fleeOut(p, P) {
    if (!(Math.abs(p.x) < P.halfX + 0.4 && Math.abs(p.z) < P.halfZ)) return null;
    const end = P.halfZ - Math.abs(p.z) < 1.6,
      s = Math.sign(p.z) || 1,
      x = Math.max(-P.halfX + 0.5, Math.min(P.halfX - 1.2, p.x));
    return {
      target: end ? { x, z: s * (P.halfZ - 0.35) } : { x: -P.halfX + 0.35, z: p.z },
      landing: end ? { x: Math.min(x, 2.4), z: s * (P.solidZ + 0.75) } : { x: -P.solidX - 0.7, z: p.z },
    };
  },
  // Out of the water for a poo (sanitation.mjs): over the near edge onto the walk.
  evacPath: (p, P) => [
    { x: -P.halfX + 0.45, z: p.z },
    { x: -P.solidX - 0.75, z: p.z },
  ],
};
