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

// The corners a walker may turn at: just outside each block's corners (none past the glass rail: there is no deck there).
const CORNERS = ROOF_BLOCKS.flatMap(([x0, x1, z0, z1]) =>
  [
    { x: x0 - PAD, z: z0 - PAD },
    { x: x0 - PAD, z: z1 + PAD },
    { x: x1 + PAD, z: z0 - PAD },
    { x: x1 + PAD, z: z1 + PAD },
  ].filter((c) => c.x < ROOF.rail - 0.3 && !ROOF_BLOCKS.some((box) => inside(c, box))),
);

// The shortest walk from `from` to `to` round everything (a straight line when nothing is in the way). A walker standing inside a
// block (a guest getting off a sunbed) steps straight out of it first: the box it starts in does not count.
export function roofRoute(from, to) {
  const ignore = ROOF_BLOCKS.filter((box) => inside(from, box) || inside(to, box)),
    blocks = ROOF_BLOCKS.filter((box) => !ignore.includes(box)),
    blocked = (a, b) => blocks.some((box) => hitsBox(a, b, box));
  if (!blocked(from, to)) return [{ x: to.x, z: to.z }];
  const nodes = [from, ...CORNERS, to],
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
}
