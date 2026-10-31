// The Kids Pool (16 October 2026): an outdoor paddling pool for children, built for it. A deck of soft rubber tiles in sunny yellow
// and sky blue on a lawn, a white picket fence round it with one gate at the back (no locker rooms: the kids come and go through the
// gate, KIDS in spatial.mjs), a bright shallow pool with no lane lines, ropes or blocks, and toys floating in it that drift and bob:
// rubber ducks and swim rings (Tripo models, props/*.glb, with stand-ins until they load) and beach balls. A slide, a lifeguard chair
// under a striped parasol, a toy box, sun umbrellas, bunting over the ends and balloons on the gate. Toys and balloons only move in
// the picture: the simulation never sees them.
import { THREE, COLORS } from "./kit.mjs";
import { buildPool, buildDeck } from "./pool.mjs";
import { grassTexture } from "./textures.mjs";
import { poolSurround, kioskTreats } from "./resort.mjs";
import {
  bench,
  finRack,
  station,
  rescueStations,
  sanitationCorner,
  fishNetHook,
  flashlightHolder,
  fuseBox,
  lifeguardTower,
  palm,
  umbrella,
} from "./props.mjs";
import { propModel } from "./prop-models.mjs";
import { buildKidsPool, kidsReady } from "./kidspool.mjs";

const FLOOR = -1.95;
const PINK = 0xff7eb3,
  SUN = 0xffd23f,
  SKY = 0x4fc3f7,
  LEAF = 0x7bd389,
  CORAL = 0xff8a5c,
  LILAC = 0xb49cff;
const BRIGHT = [PINK, SUN, SKY, LEAF, CORAL, LILAC];

export function buildKids(w, venue) {
  // The Kids Pool dressed for real when its model is in (scene/kidspool.mjs); this one till then, and with ?nomodels.
  if (kidsReady()) return buildKidsPool(w, venue);
  buildDeck(w, venue, {
    checker: { a: "#ffe38a", b: "#a6e1ff", grout: "#ffffff", tiles: 3 },
    slab: 0x58b9e6,
    rim: 0xffffff,
    side: 0x7fcff2,
  });
  buildPool(w, venue, w.look.water, {
    floorTiles: ["#58d3f5", "#c6f3ff"],
    wallTiles: ["#45c2ee", "#e3f9ff"],
    line: null,
    ropes: null,
    pennants: null,
  });
  poolSurround(w, venue, { base: "#ff9cc3", grout: "#fff6e8", seed: 77 });
  const ctx = { w, venue };
  ground(ctx);
  fence(ctx);
  for (const f of venue.furniture) {
    if (f.kind === "bench") bench(w, f.x, f.z, f.angle);
    if (f.kind === "slide") slide(w, f);
    if (f.kind === "lifeguard") lifeguardTower(w, f.x, f.z);
    if (f.kind === "toy-box") toyBox(w, f);
  }
  finRack(w, venue.stations.fins);
  station(w, "chlorine", venue.stations.chlorine, COLORS.yellow, "WATER CARE", -Math.PI / 2);
  station(w, "relief", venue.stations.relief, 0xddf3d7, "EYE CARE", -Math.PI / 2);
  sanitationCorner(w, venue);
  rescueStations(w, venue);
  fishNetHook(w, venue.fixtures.fishNet);
  flashlightHolder(w, venue.fixtures.flashlight);
  fuseBox(w, venue.fixtures.fuseBox);
  kioskTreats(w, venue.fixtures.treats);
  for (const [x, z, c] of [
    [-12.6, -12.6, SKY],
    [12.4, 9.8, PINK],
    [-12.4, 4.4, SUN],
  ])
    umbrella(w, x, z, c);
  bunting(ctx);
  toys(ctx);
}

// Grass to the horizon and a few palms beyond the fence.
function ground(ctx) {
  const { w, venue } = ctx,
    grass = grassTexture({ base: "#86c95f", seed: 21 });
  grass.repeat.set(150, 150);
  w.textures.push(grass);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ map: grass, color: 0xc3e59a, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR;
  floor.receiveShadow = true;
  w.scene.add(floor);
  const room = venue.room;
  for (const [x, z, s] of [
    [room.minX - 3, -9, 1.1],
    [room.minX - 4, 7, 1.2],
    [room.maxX + 3.5, -4, 1.15],
    [room.maxX + 3, 8, 1.25],
    [-9, room.maxZ + 4, 1.1],
    [8, room.maxZ + 4.5, 1.2],
  ]) {
    const g = palm(w, x, z, 4.6 * s, x * z);
    g.position.y = FLOOR;
  }
}

// A white picket fence on the deck's edge, with the gate at the back: two leaves that swing open towards the deck as a kid comes or
// goes (`world.lockerDoors`, as the locker doors do), an arch over it with the pool's name and a bunch of balloons on each post.
function fence(ctx) {
  const { w, venue } = ctx,
    room = venue.room,
    door = venue.arrival,
    half = door.doorX * 2 + 0.02,
    back = room.minZ + 0.25,
    white = 0xfdfbf4;
  const run = (x0, z0, x1, z1, skip = null) => {
    const length = Math.hypot(x1 - x0, z1 - z0),
      n = Math.floor(length / 0.42);
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = x0 + (x1 - x0) * t,
        z = z0 + (z1 - z0) * t;
      if (skip && skip(x, z)) continue;
      w.box(0.12, 0.95, 0.06, white, x, 0.5, z, 0.02);
      w.box(0.12, 0.08, 0.12, white, x, 1.0, z, 0.02).rotation.set(
        0,
        Math.atan2(x1 - x0, z1 - z0),
        Math.PI / 4,
      );
    }
    const mx = (x0 + x1) / 2,
      mz = (z0 + z1) / 2,
      along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (const y of [0.32, 0.74]) {
      if (skip) {
        // The back fence: two rails, one each side of the gate.
        for (const s of [-1, 1]) {
          const len = (Math.abs(x1 - x0) - half * 2 - 0.3) / 2;
          w.box(len, 0.08, 0.05, white, s * (half + 0.15 + len / 2), y, mz, 0.02);
        }
      } else w.box(along ? length : 0.05, 0.08, along ? 0.05 : length, white, mx, y, mz, 0.02);
    }
  };
  run(room.minX + 0.25, back, room.maxX - 0.25, back, (x) => Math.abs(x) < half + 0.15);
  run(room.minX + 0.25, back, room.minX + 0.25, room.maxZ - 0.25);
  run(room.maxX - 0.25, back, room.maxX - 0.25, room.maxZ - 0.25);
  run(room.minX + 0.25, room.maxZ - 0.25, room.maxX - 0.25, room.maxZ - 0.25);
  // The gate: posts, an arch with the name, the leaves.
  for (const s of [-1, 1]) {
    w.box(0.22, 2.6, 0.22, SKY, s * (half + 0.12), 1.3, back, 0.04);
    w.ball(0.16, SUN, s * (half + 0.12), 2.7, back);
    balloons(w, s * (half + 0.12), back, s);
  }
  const arch = w.textPlane(
    "KIDS POOL",
    half * 2 + 0.9,
    0.55,
    "#ff7eb3",
    "#ffffff",
    0,
    2.35,
    back + 0.02,
    w.scene,
    64,
  );
  arch.rotation.y = 0;
  w.box(half * 2 + 1.0, 0.62, 0.08, PINK, 0, 2.35, back - 0.04, 0.05);
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * half, 0, back + 0.04);
    w.scene.add(hinge);
    for (let i = 0; i < 4; i++) {
      const x = -side * (0.15 + i * ((half - 0.25) / 3));
      w.box(0.1, 1.05, 0.05, BRIGHT[(i + (side > 0 ? 2 : 0)) % BRIGHT.length], x, 0.6, 0.02, 0.02, hinge);
    }
    for (const y of [0.35, 0.9])
      w.box(half - 0.05, 0.08, 0.05, white, (-side * half) / 2, y, 0.02, 0.02, hinge);
    w.lockerDoors.push({ side, hinge });
  }
}

export function balloons(w, x, z, side) {
  const g = w.group(x, 2.7, z);
  for (let i = 0; i < 4; i++) {
    const a = side * 0.35 + (i - 1.5) * 0.35,
      h = 0.9 + (i % 2) * 0.35;
    const bx = Math.sin(a) * 0.55,
      by = h,
      bz = 0.15 + (i % 2) * 0.1;
    w.rod([0, 0, 0], [bx, by - 0.22, bz], 0.008, 0xffffff, g);
    w.ball(0.22, BRIGHT[(i + (side > 0 ? 3 : 0)) % BRIGHT.length], bx, by, bz, g, [1, 1.2, 1]);
  }
  (w.liveProps ||= []).push(g);
  w.updaters.push((time) => {
    if (w.reducedMotion?.matches) return;
    g.rotation.z = Math.sin(time * 1.3 + x) * 0.06;
  });
}

// A slide: a ladder up the back, a platform, and a wavy chute down to the deck.
function slide(w, f) {
  const g = w.group(f.x, 0, f.z, w.scene, Math.PI / 2);
  const top = 1.55;
  for (const x of [-0.32, 0.32]) w.rod([x, 0, -1.6], [x, top, -1.05], 0.05, SKY, g);
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    w.box(0.64, 0.05, 0.1, SUN, 0, top * t, -1.6 + 0.55 * t, 0.02, g);
  }
  w.box(0.9, 0.1, 0.6, PINK, 0, top, -0.85, 0.04, g);
  for (const x of [-0.42, 0.42]) w.rod([x, top, -1.1], [x, top + 0.55, -1.1], 0.04, SKY, g);
  w.rod([-0.42, top + 0.55, -1.1], [0.42, top + 0.55, -1.1], 0.04, SKY, g);
  // The chute: short tilted panels that curve out at the bottom.
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps,
      t1 = (i + 1) / steps,
      y = (t) => top * (1 - t) ** 1.6 + 0.12,
      z = (t) => -0.55 + t * 2.0;
    const len = Math.hypot(z(t1) - z(t0), y(t1) - y(t0)),
      panel = w.box(0.7, 0.06, len + 0.04, SUN, 0, (y(t0) + y(t1)) / 2, (z(t0) + z(t1)) / 2, 0.02, g);
    panel.rotation.x = Math.atan2(y(t0) - y(t1), z(t1) - z(t0));
    for (const x of [-0.36, 0.36]) {
      const lip = w.box(
        0.06,
        0.16,
        len + 0.04,
        CORAL,
        x,
        (y(t0) + y(t1)) / 2 + 0.07,
        (z(t0) + z(t1)) / 2,
        0.02,
        g,
      );
      lip.rotation.x = panel.rotation.x;
    }
  }
  w.box(0.9, 0.06, 0.5, 0x5fbf6a, 0, 0.03, 1.6, 0.02, g); // a soft landing mat
}

function toyBox(w, f) {
  const g = w.group(f.x, 0, f.z);
  w.box(f.hx * 2, 0.6, f.hz * 2, LILAC, 0, 0.3, 0, 0.06, g);
  const lid = w.box(f.hx * 2 + 0.06, 0.08, f.hz * 2 + 0.06, PINK, 0, 0.66, -0.25, 0.03, g);
  lid.rotation.x = -0.9;
  w.ball(0.16, SUN, -0.25, 0.68, 0.05, g);
  w.ball(0.12, SKY, 0.2, 0.66, -0.05, g);
  w.cyl(0.08, 0.08, 0.3, LEAF, 0.05, 0.7, 0.15, g, 8).rotation.z = 0.9;
  w.textPlane("TOYS", 0.9, 0.24, "#ffffff", "#b49cff", 0, 0.32, f.hz + 0.01, g, 60);
}

// Triangle bunting strung across over both ends of the pool.
function bunting(ctx) {
  const { w, venue } = ctx,
    P = venue.pool;
  const flag = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.18, 0, 0),
    new THREE.Vector3(0.18, 0, 0),
    new THREE.Vector3(0, -0.34, 0),
  ]);
  flag.computeVertexNormals();
  for (const z of [-P.halfZ - 1.6, P.halfZ + 1.6]) {
    const span = P.halfX * 2 + 6,
      n = 22;
    for (const x of [-span / 2, span / 2]) w.cyl(0.05, 0.05, 3.2, 0xffffff, x, 1.6, z, w.scene, 8);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n,
        x = -span / 2 + span * t,
        y = 3.05 - Math.sin(t * Math.PI) * 0.55;
      const m = new THREE.Mesh(
        flag,
        new THREE.MeshStandardMaterial({
          color: BRIGHT[i % BRIGHT.length],
          side: THREE.DoubleSide,
          roughness: 0.6,
        }),
      );
      m.position.set(x, y, z);
      w.scene.add(m);
    }
  }
}

// Toys floating in the pool: they drift slowly round on paths of their own, bob on the water and turn. Ducks and swim rings are
// Tripo models (stand-ins until they load); the beach balls are built here.
export function toys(ctx) {
  const { w, venue } = ctx,
    P = venue.pool;
  const list = [
    { kind: "duck", size: 0.55, x: -2.6, z: -3.2 },
    { kind: "duck", size: 0.5, x: 2.4, z: 2.6 },
    { kind: "duck", size: 0.45, x: 0.6, z: 5.6 },
    { kind: "swim-ring", size: 1.0, x: -1.4, z: 3.8 },
    { kind: "swim-ring", size: 0.95, x: 3.0, z: -4.8 },
    { kind: "ball", size: 0.5, x: -3.4, z: 1.0 },
    { kind: "ball", size: 0.45, x: 1.6, z: -1.6 },
  ];
  const items = list.map((t, i) => {
    const g =
      t.kind === "ball"
        ? beachBall(w, t.size)
        : propModel(t.kind, { size: t.size }, (s) => {
            if (t.kind === "duck") {
              w.ball(0.2, SUN, 0, 0.14, 0, s, [1.2, 0.8, 1]);
              w.ball(0.12, SUN, 0.14, 0.32, 0, s);
              w.ball(0.05, CORAL, 0.26, 0.31, 0, s, [1.4, 0.6, 1]);
            } else {
              const ring = w.torus(0.36, 0.13, PINK, s, Math.PI * 2, 10, 24);
              ring.rotation.x = Math.PI / 2;
              ring.position.y = 0.1;
            }
          });
    w.scene.add(g);
    (w.liveProps ||= []).push(g);
    return { g, ...t, phase: i * 1.9, speed: 0.08 + (i % 3) * 0.03 };
  });
  const X = P.halfX - 0.8,
    Z = P.halfZ - 1.0;
  w.updaters.push((time) => {
    const t = w.reducedMotion?.matches ? 0 : time;
    for (const it of items) {
      // A slow loop of its own round where it started, kept inside the pool.
      const a = t * it.speed + it.phase;
      const x = Math.max(-X, Math.min(X, it.x + Math.sin(a) * 1.6)),
        z = Math.max(-Z, Math.min(Z, it.z + Math.cos(a * 0.8) * 2.2));
      it.g.position.set(x, -0.2 + Math.sin(t * 2 + it.phase) * 0.035, z);
      it.g.rotation.y = a * 0.7;
      it.g.rotation.z = Math.sin(t * 1.7 + it.phase) * 0.08;
    }
  });
}

function beachBall(w, size) {
  const g = new THREE.Group(),
    r = size / 2;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(r, 12, 8, (i * Math.PI) / 3, Math.PI / 3),
      w.mat([CORAL, 0xffffff, SKY, 0xffffff, SUN, 0xffffff][i], { roughness: 0.4 }),
    );
    seg.castShadow = true;
    seg.position.y = r * 0.6;
    g.add(seg);
  }
  return g;
}
