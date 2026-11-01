// The Rooftop Pool dressed for real (scene/roofclub.mjs, 1 November 2026): built headless from the real model
// (dist/assets/roof-club/roof.glb, parsed here; its pictures are stand-ins), it must keep every hook the classic roof has (the
// same hit boxes and labels: the stations, the rings, the skimmer, the net, the torch, the fuse box, the treats, the bar), keep
// what moves (the water, the sheets over the knife edge and along the gutter, the lifts' doors, the flames, the neon and the
// margaritas, the LED wall, the city, the cast), put its pieces where the game's plan has them (nothing in anyone's way where the
// guests queue, evacuate and walk; open water over the pool; the anchors where the game needs them), cost fewer draw calls than
// the classic one and stay within its budget. The classic roof is still the one built until the model is in, and with ?nomodels.
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { GLTFLoader } from "./dist/assets/GLTFLoader.js";
import { PoolWorld } from "./dist/scene.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { ROOF, ROOF_BEDS, ROOF_BLOCKS } from "./dist/roof-plan.mjs";
import { primeRoofClub, roofClubReady, roofClubPictures, ROOF_LOOKS } from "./dist/scene/roofclub.mjs";
const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const quiet = console.warn;
console.warn = () => {};
const container = { clientWidth: 1440, clientHeight: 900 };
const DIR = "dist/assets/roof-club/";
const venue = VENUES.roof;

// ---- the files: there, and small enough --------------------------------------------------------------------------------------------
const info = JSON.parse(readFileSync(DIR + "roof.json", "utf8"));
const pictures = roofClubPictures(info);
let pictureBytes = 0;
for (const p of pictures) pictureBytes += statSync(DIR + p + ".webp").size;
const glbBytes = statSync(DIR + "roof.glb").size;
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

// ---- before the model is in: the classic roof -------------------------------------------------------------------------------
assert.equal(roofClubReady(), false);
const classic = new PoolWorld(container, () => {}, { headless: true, venue });
assert.equal(classic.scene.getObjectByName("roofclub"), undefined, "until the model is in, the classic roof");

// ---- the model -----------------------------------------------------------------------------------------------------------------
const data = readFileSync(DIR + "roof.glb");
const gltf = await new Promise((resolve, reject) =>
  new GLTFLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
    resolve,
    reject,
  ),
);
primeRoofClub({
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
  "teak",
  "travertine",
  "mosaic",
  "granite",
  "marble",
  "bronze",
  "linen",
  "rattan",
  "concrete",
  "zellige",
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
for (const q of queue) clearAt(q.x, q.z, "the queue before the lifts");
for (const e of venue.evacSpots) clearAt(e.x, e.z, "an evacuation spot");
// out of the lifts' doors and along the waiting guests' aisles
const A_ = venue.arrival;
for (const side of [-1, 1])
  for (let z = A_.outsideZ; z >= A_.outsideZ - 2; z -= 0.4)
    clearAt(A_.doorX, side * z, "the way out of a lift");
for (const z of ROOF.aisles) for (let x = -9.8; x <= -4.2; x += 0.4) clearAt(x, z, "an aisle to the pool");
// the walk along the coping, where the guests step in and out
for (let z = -ROOF.halfZ; z <= ROOF.halfZ; z += 0.5) clearAt(-ROOF.halfX - 0.6, z, "the walk along the pool");
// the whole deck, every 0.6 m, wherever the furniture is not (its own boxes and the walkers' blocks, a little wider; the places
// the classic roof keeps its lanterns, ice buckets, stools and potted bay balls)
const boxes = [...venue.furniture, ...(venue.obstacles || [])].map((f) => [
  f.x - (f.hx ?? 0.3) - 0.3,
  f.x + (f.hx ?? 0.3) + 0.3,
  f.z - (f.hz ?? 0.3) - 0.3,
  f.z + (f.hz ?? 0.3) + 0.3,
]);
for (const b of ROOF_BLOCKS) boxes.push([b[0] - 0.3, b[1] + 0.3, b[2] - 0.3, b[3] + 0.3]);
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
for (const z of [-1.9, 1.9]) spots.push({ x: -12.9, z });
for (const b of ROOF_BEDS.filter((b) => b.cabana)) {
  const s = Math.sign(b.z);
  spots.push({ x: b.x - 0.3, z: b.z + 1.75 * s }, { x: b.x + 1.25, z: b.z + 1.75 * s });
}
for (const s of [-1, 1]) {
  for (const dx of [-1.55, 1.55]) spots.push({ x: ROOF.bar.x + dx, z: ROOF.bar.z + 0.85 });
  for (const dx of [-2.75, 2.75]) spots.push({ x: venue.arrival.doorX + dx, z: s * 14.9 });
}
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
assert.ok(walked > 400, `the deck was sampled (${walked})`);
// open water over the whole pool, up to the knife edge
let open = 0;
for (let x = -ROOF.halfX + 0.3; x <= ROOF.halfX - 0.3; x += 0.5)
  for (let z = -ROOF.halfZ + 0.3; z <= ROOF.halfZ - 0.3; z += 0.5) {
    const hit = firstDown(x, z, 8);
    assert.ok(
      !hit || hit.point.y < -0.1,
      `open water at ${x.toFixed(1)}, ${z.toFixed(1)} (${hit?.object.name} at ${hit?.point.y.toFixed(2)})`,
    );
    open++;
  }

// ---- with the model: the same Rooftop Pool to play -------------------------------------------------------------------------------
const world = new PoolWorld(container, () => {}, { headless: true, venue });
const root = world.scene.getObjectByName("roofclub");
assert.ok(root, "the Rooftop Pool takes the model once it is in");
assert.equal(world.lightingName, "roof");
assert.equal(world.look.lamps, ROOF_LOOKS.roof.lamps, "its own festoons and lanterns, lit softly");
const hooks = (w) => w.clickables.map((c) => JSON.stringify({ ...c.userData })).sort();
assert.deepEqual(hooks(world), hooks(classic), "the same hit boxes as the classic roof");
const labels = (w) => w.labels.map((l) => l.text).sort();
assert.deepEqual(labels(world), labels(classic), "the same labels as the classic roof");
assert.equal(world.ringModels.length, classic.ringModels.length, "the life rings");
assert.ok(world.ringAt.every(Boolean), "each ring hangs on the model's board");
for (const k of ["fishNetRack", "flashlightRack", "fuseLever", "water", "skimmerRack"])
  assert.ok(world[k], k + " is there, as in the classic roof");
assert.ok(world.scene.getObjectByName("city"), "the city far below");
const live = world.scene.getObjectByName("roof-live");
assert.ok(live, "the live group");
for (const u of world.updaters) u(3.7, 0.016, world, {});

const drawn = (w) => {
  let n = 0;
  w.scene.traverse((o) => {
    if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.visible && o.material?.visible !== false) n++;
  });
  return n;
};
assert.ok(
  drawn(world) < drawn(classic),
  `${drawn(world)} draw calls against the classic roof's ${drawn(classic)}`,
);
assert.ok(classes.size <= 30, classes.size + " material classes");
console.warn = quiet;
console.log(
  `Rooftop Pool checks passed: the model (${(glbBytes / 1e6).toFixed(1)} MB, ${Math.round(triangles / 1000)}k triangles, ${classes.size} materials) and its photographic pictures (${(pictureBytes / 1e6).toFixed(2)} MB); the classic roof till it is in; the same hit boxes and labels; nothing in the way at the queue, the ${venue.evacSpots.length} evacuation spots, the lifts' doors, the aisles, the walk along the pool and ${walked} points of the deck; open water at ${open} points of the pool; the anchors for the rings and the torch; ${drawn(world)} draw calls against ${drawn(classic)}.`,
);
