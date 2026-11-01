// The Jumping Pool dressed for real (scene/diveclub.mjs, 1 November 2026): built headless from the real model
// (dist/assets/dive-club/dive.glb, parsed here; its pictures are stand-ins), it must keep every hook the classic pool has (the
// same hit boxes and labels: the boards and the tub to click, the stations, the rings, the skimmer, the net, the torch, the fuse
// box, the treats), keep what moves (the water, the springboards' planks, the tub's water, the gates' leaves, the flag, the
// highlights and rims), put its pieces where the game's plan has them (nothing in anyone's way where the guests queue, evacuate
// and walk; open water over the pool but under the platforms; the anchors where the game needs them), cost fewer draw calls than
// the classic one and stay within its budget. The classic pool is still the one built until the model is in, and with ?nomodels.
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { GLTFLoader } from "./dist/assets/GLTFLoader.js";
import { PoolWorld } from "./dist/scene.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { DIVE, BOARDS, STATIONS, TUB, MASSAGE_BEDS, diveBlocks } from "./dist/dive-plan.mjs";
import { primeDiveClub, diveClubReady, diveClubPictures, DIVE_LOOKS } from "./dist/scene/diveclub.mjs";
const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const quiet = console.warn;
console.warn = () => {};
const container = { clientWidth: 1440, clientHeight: 900 };
const DIR = "dist/assets/dive-club/";
const venue = VENUES.dive;

// ---- the files: there, and small enough --------------------------------------------------------------------------------------------
const info = JSON.parse(readFileSync(DIR + "dive.json", "utf8"));
const pictures = diveClubPictures(info);
let pictureBytes = 0;
for (const p of pictures) pictureBytes += statSync(DIR + p + ".webp").size;
const glbBytes = statSync(DIR + "dive.glb").size;
assert.ok(glbBytes < 10e6, `the model is ${(glbBytes / 1e6).toFixed(1)} MB (budget 10)`);
assert.ok(pictureBytes < 3e6, `the pictures are ${(pictureBytes / 1e6).toFixed(1)} MB (budget 3)`);
assert.deepEqual(
  readdirSync(DIR)
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.slice(0, -5))
    .sort(),
  [...pictures].sort(),
  "every picture in the folder is used",
);

// ---- before the model is in: the classic pool -------------------------------------------------------------------------------
assert.equal(diveClubReady(), false);
const classic = new PoolWorld(container, () => {}, { headless: true, venue });
assert.equal(classic.scene.getObjectByName("diveclub"), undefined, "until the model is in, the classic pool");

// ---- the model -----------------------------------------------------------------------------------------------------------------
const data = readFileSync(DIR + "dive.glb");
const gltf = await new Promise((resolve, reject) =>
  new GLTFLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
    resolve,
    reject,
  ),
);
primeDiveClub({
  scene: gltf.scene,
  info,
  textures: Object.fromEntries(pictures.map((p) => [p, new THREE.Texture()])),
});
let triangles = 0;
const classes = new Set();
gltf.scene.traverse((o) => {
  if (!o.isMesh) return;
  triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  const cls = o.material.name.replace(/^H_/, "");
  classes.add(cls);
  if (/^(tile_|signs|cut)/.test(cls)) {
    const uv = o.geometry.attributes.uv;
    assert.ok(uv, `${cls}: a textured mesh keeps its UVs (gltfpack -kv)`);
    assert.ok(uv.array instanceof Float32Array, `${cls}: its UVs are floats`);
  }
});
assert.ok(triangles < 200000, `${triangles} triangles (budget 200k)`);
for (const set of [
  "travertine",
  "mosaic",
  "majolica",
  "marble",
  "concrete",
  "teak",
  "lawn",
  "hedge",
  "stucco",
  "rooftile",
  "awning",
  "linen",
])
  assert.ok(
    [...classes].some((c) => c.startsWith("tile_" + set)),
    `the ${set} photograph is one of its materials`,
  );

// the anchors: where the game's moving parts go
const A = info.anchors;
assert.equal(A.LifeRing.length, 3, "a place for each of the three rings");
const torch = A.Flashlight?.[0];
assert.ok(
  torch && Math.hypot(torch[0] - venue.fixtures.flashlight.x, torch[2] - venue.fixtures.flashlight.z) < 0.05,
  "the torch on its pedestal",
);
assert.ok(Math.abs(torch[1] - 1.24) < 0.05, "the torch where the game puts it, 1.24 m up");

// ---- placement: nothing in the way where the guests queue, evacuate and walk; the pool's water open --------------------------
gltf.scene.updateMatrixWorld(true);
const meshes = [];
gltf.scene.traverse((o) => o.isMesh && meshes.push(o));
const ray = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);
const firstDown = (x, z, from) => {
  ray.set(new THREE.Vector3(x, from, z), down);
  return ray.intersectObjects(meshes, false)[0];
};
const clearAt = (x, z, what, floor = 0.1) => {
  const hit = firstDown(x, z, 1.9);
  assert.ok(
    !hit || hit.point.y < floor,
    `${what} at ${x.toFixed(1)}, ${z.toFixed(1)}: nothing between ${floor} and 1.9 m (${hit?.object.name} at ${hit?.point.y.toFixed(2)})`,
  );
};
const queue = [-1, 1].flatMap((side) =>
  Array.from({ length: 12 }, (_, slot) => venue.queuePosition(side, slot)),
);
for (const q of queue) clearAt(q.x, q.z, "the queue by the gates");
for (const e of venue.evacSpots) clearAt(e.x, e.z, "an evacuation spot");
// in through the gates
const A_ = venue.arrival;
for (const side of [-1, 1])
  for (let z = A_.outsideZ; z >= A_.outsideZ - 2; z -= 0.4)
    clearAt(A_.doorX, side * z, "the way in through a gate");
// each board's line at the foot of its stairs
for (const b of BOARDS) for (const spot of b.line) clearAt(spot.x, spot.z, "a board's line");
// the walks along the pool's long sides
for (let z = -DIVE.halfZ; z <= DIVE.halfZ; z += 0.5)
  for (const x of [-6.6, 6.6]) clearAt(x, z, "the walk along the pool");
// the whole deck, every 0.6 m, wherever the furniture is not (its own boxes and the walkers' blocks, a little wider; the places
// the classic pool keeps its loungers, parasols, massage corner and the stories against the hedges)
const boxes = [...venue.furniture, ...(venue.obstacles || [])].map((f) => [
  f.x - (f.hx ?? 0.3) - 0.3,
  f.x + (f.hx ?? 0.3) + 0.3,
  f.z - (f.hz ?? 0.3) - 0.3,
  f.z + (f.hz ?? 0.3) + 0.3,
]);
for (const b of diveBlocks(venue.furniture)) boxes.push([b[0] - 0.3, b[1] + 0.3, b[2] - 0.3, b[3] + 0.3]);
const F = venue.fixtures;
const spots = [
  F.flashlight,
  F.treats,
  F.fishNet,
  F.fuseBox,
  F.mop,
  venue.sanitation.rack,
  venue.sanitation.bin,
];
const beds = [...MASSAGE_BEDS].sort((a, b) => a.z - b.z);
spots.push({ x: beds[0].x - 0.9, z: beds.at(-1).z + 1.5 }, { x: beds[0].x + 0.45, z: beds.at(-1).z + 1.55 });
spots.push({ x: beds[0].x - 1.15, z: beds[0].z - 1.45 });
for (const s of [-1, 1]) {
  for (const x of [8.4, 11.2]) boxes.push([x - 0.8, x + 0.8, s * 13.2 - 1.3, s * 13.2 + 1.3]);
  spots.push({ x: 6.9, z: s * 14.1 });
  // (the CHICKEN-OUT ZONE's hen house, its ramp, its basket and its sign)
  boxes.push([5.6 - 0.7, 5.6 + 0.7, s * 13.6 - 1.0, s * 13.6 + 1.0]);
}
// (against the far hedge: the judges, the SPLASH-O-METER, the HALL OF FAME, the ponchos)
boxes.push(
  [11.9, 13.5, -13.1, -10.1],
  [12.3, 13.5, -15.1, -13.6],
  [12.4, 13.5, 8.6, 11.4],
  [12.4, 13.5, 3.0, 4.2],
);
// (the hot tub's steps up to its rim, as the classic's)
const steps = TUB.z + TUB.hz + TUB.rim + TUB.deck;
boxes.push([TUB.x - 0.75, TUB.x + 0.75, steps - 0.1, steps + 0.95]);
for (const p of spots) boxes.push([p.x - 0.7, p.x + 0.7, p.z - 0.7, p.z + 0.7]);
for (const m of venue.ringMounts) boxes.push([m.x - 1.0, m.x + 1.0, m.z - 1.0, m.z + 1.0]);
const inBox = (x, z) => boxes.some((b) => x > b[0] && x < b[1] && z > b[2] && z < b[3]);
const D = venue.deck;
let walked = 0;
for (let x = D.minX + 0.3; x <= D.maxX - 0.3; x += 0.6)
  for (let z = D.minZ + 0.3; z <= D.maxZ - 0.3; z += 0.6) {
    if (inBox(x, z)) continue;
    clearAt(x, z, "the deck");
    walked++;
  }
assert.ok(walked > 500, `the deck was sampled (${walked})`);
// open water over the whole pool, but under the platforms reaching out over it
const underBoard = (x, z) =>
  BOARDS.some((b) => Math.abs(x - b.x) < 1.0 && Math.abs(z) > Math.abs(b.tipZ) - 0.2);
let open = 0;
for (let x = -DIVE.halfX + 0.3; x <= DIVE.halfX - 0.3; x += 0.5)
  for (let z = -DIVE.halfZ + 0.3; z <= DIVE.halfZ - 0.3; z += 0.5) {
    if (underBoard(x, z)) continue;
    const hit = firstDown(x, z, 12);
    assert.ok(
      !hit || hit.point.y < -0.25,
      `open water at ${x.toFixed(1)}, ${z.toFixed(1)} (${hit?.object.name} at ${hit?.point.y.toFixed(2)})`,
    );
    open++;
  }

// ---- with the model: the same Jumping Pool to play -------------------------------------------------------------------------------
const world = new PoolWorld(container, () => {}, { headless: true, venue });
const root = world.scene.getObjectByName("diveclub");
assert.ok(root, "the Jumping Pool takes the model once it is in");
assert.equal(world.lightingName, "dive");
assert.equal(world.look.clouds, DIVE_LOOKS.dive.clouds, "its own light");
const hooks = (w) => w.clickables.map((c) => JSON.stringify({ ...c.userData })).sort();
assert.deepEqual(hooks(world), hooks(classic), "the same hit boxes as the classic pool");
const labels = (w) => w.labels.map((l) => l.text).sort();
assert.deepEqual(labels(world), labels(classic), "the same labels as the classic pool");
assert.equal(world.ringModels.length, classic.ringModels.length, "the life rings");
assert.ok(world.ringAt.every(Boolean), "each ring hangs on the model's board");
for (const k of ["fishNetRack", "flashlightRack", "fuseLever", "water", "skimmerRack", "tubWater"])
  assert.ok(world[k], k + " is there, as in the classic pool");
assert.equal(world.springboards.length, classic.springboards.length, "the springboards' planks, which bend");
assert.equal(world.lockerDoors.length, classic.lockerDoors.length, "the gates' leaves, which swing");
assert.equal(
  world.springHighlights.length,
  classic.springHighlights.length,
  "the boards' and the tub's highlights",
);
assert.equal(world.flags.length, classic.flags.length, "the club's flag");
for (const u of world.updaters) u(3.7, 0.016, world, null);

const drawn = (w) => {
  let n = 0;
  w.scene.traverse((o) => {
    if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.visible && o.material?.visible !== false) n++;
  });
  return n;
};
assert.ok(
  drawn(world) < drawn(classic),
  `${drawn(world)} draw calls against the classic pool's ${drawn(classic)}`,
);
assert.ok(classes.size <= 30, classes.size + " material classes");
console.warn = quiet;
console.log(
  `Jumping Pool checks passed: the model (${(glbBytes / 1e6).toFixed(1)} MB, ${Math.round(triangles / 1000)}k triangles, ${classes.size} materials) and its photographic pictures (${(pictureBytes / 1e6).toFixed(2)} MB); the classic pool till it is in; the same hit boxes and labels, springboards, gates and flag; nothing in the way at the queue, the ${venue.evacSpots.length} evacuation spots, the gates, the boards' lines, the walks along the pool and ${walked} points of the deck; open water at ${open} points of the pool; the anchors for the rings and the torch; ${drawn(world)} draw calls against ${drawn(classic)}.`,
);
