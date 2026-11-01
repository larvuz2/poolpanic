// The Wave Pool dressed for real (scene/waveclub.mjs, 1 November 2026): built headless from the real model (dist/assets/wave-club/
// wave.glb, parsed here; its pictures are stand-ins), it must keep every hook the classic Wave Pool has (the same hit boxes and
// labels: the water to click, the tube hut, the stations, the rings, the skimmer, the net, the torch, the fuse box, the treats),
// keep what moves (the water and its waves, the chambers' surges, the LED board, the beacons, the roof sign's bulbs, the flags, the
// pennants, the tubes on their peg, the gate's leaves), put its pieces where the game's plan has them (nothing in anyone's way
// where the guests wait and walk and the bathers rest; open water over the whole pool; the chambers open to their surges; the
// anchors where the game needs them), cost fewer draw calls than the classic one and stay within its budget. The classic Wave Pool
// is still the one built until the model is in, and with ?nomodels.
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { GLTFLoader } from "./dist/assets/GLTFLoader.js";
import { PoolWorld } from "./dist/scene.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { WAVE } from "./dist/waves.mjs";
import { CHAMBERS } from "./dist/scene/wave.mjs";
import { primeWaveClub, waveClubReady, waveClubPictures, WAVE_LOOKS } from "./dist/scene/waveclub.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const quiet = console.warn;
console.warn = () => {};
const container = { clientWidth: 1440, clientHeight: 900 };
const DIR = "dist/assets/wave-club/";
const wave = VENUES.wave;

// ---- the files: there, and small enough --------------------------------------------------------------------------------------
const info = JSON.parse(readFileSync(DIR + "wave.json", "utf8"));
const pictures = waveClubPictures(info);
let pictureBytes = 0;
for (const p of pictures) pictureBytes += statSync(DIR + p + ".webp").size;
const glbBytes = statSync(DIR + "wave.glb").size;
assert.ok(glbBytes < 10e6, `the model is ${(glbBytes / 1e6).toFixed(1)} MB (budget 10)`);
assert.ok(pictureBytes < 2.2e6, `the pictures are ${(pictureBytes / 1e6).toFixed(1)} MB (budget 2.2)`);
assert.deepEqual(
  readdirSync(DIR)
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.slice(0, -5))
    .sort(),
  [...pictures].sort(),
  "every picture in the folder is used",
);

// ---- before the model is in: the classic Wave Pool -----------------------------------------------------------------------------
assert.equal(waveClubReady(), false);
const classic = new PoolWorld(container, () => {}, { headless: true, venue: wave });
assert.equal(
  classic.scene.getObjectByName("waveclub"),
  undefined,
  "until the model is in, the classic Wave Pool",
);

// ---- the model -----------------------------------------------------------------------------------------------------------------
const data = readFileSync(DIR + "wave.glb");
const gltf = await new Promise((resolve, reject) =>
  new GLTFLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
    resolve,
    reject,
  ),
);
primeWaveClub({
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

// the anchors: where the game's moving parts go
const A = info.anchors;
assert.equal(A.LifeRing.length, 3, "a place for each of the three rings");
assert.equal(A.Flashlight.length, 1, "a bollard for the torch");
const torch = A.Flashlight[0];
assert.ok(
  Math.hypot(torch[0] - wave.fixtures.flashlight.x, torch[2] - wave.fixtures.flashlight.z) < 0.05,
  "the torch on its bollard",
);
assert.ok(Math.abs(torch[1] - 1.24) < 0.05, "the torch where the game puts it, 1.24 m up");
assert.equal(A.Surge.length, CHAMBERS.length, "the water surging in every chamber");
for (const z of CHAMBERS)
  assert.ok(
    A.Surge.some(
      ([x, y, zz]) => Math.abs(zz - z) < 0.01 && Math.abs(y - WAVE.water) < 0.01 && x > WAVE.halfX,
    ),
    `the surge in the chamber at z ${z}, at the water's level, in the wave house`,
  );
assert.equal(A.LED.length, 1, "the LED board");
assert.ok(
  Math.abs(A.LED[0][2]) < 0.01 && A.LED[0][0] < WAVE.halfX + 0.3,
  "the LED board over the middle chamber",
);
assert.equal(A.Beacon.length, 2, "a beacon in each lighthouse");
assert.ok(A.Flag.length >= 4 && A.BulbLow && A.BulbHigh, "the flags and the roof sign's bulbs");
const tubes = A.Tubes?.[0];
assert.ok(
  tubes && Math.hypot(tubes[0] - wave.stations.fins.x, tubes[2] - wave.stations.fins.z) < 0.3,
  "the tubes' peg in the tube hut",
);

// ---- placement: nothing in the way where the guests wait and walk and the bathers rest; the water open; the chambers open ----
gltf.scene.updateMatrixWorld(true);
const meshes = [];
gltf.scene.traverse((o) => o.isMesh && meshes.push(o));
const ray = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);
const firstDown = (x, z, from) => {
  ray.set(new THREE.Vector3(x, from, z), down);
  return ray.intersectObjects(meshes, false)[0];
};
const clearAt = (x, z, what) => {
  const hit = firstDown(x, z, 1.9);
  assert.ok(
    !hit || hit.point.y < 0.1,
    `${what} at ${x.toFixed(1)}, ${z.toFixed(1)}: nothing between 0.1 and 1.9 m (${hit?.object.name})`,
  );
};
for (const q of [-1, 1].flatMap((side) =>
  Array.from({ length: 12 }, (_, slot) => wave.queuePosition(side, slot)),
))
  clearAt(q.x, q.z, "the queue inside the gate");
for (const e of wave.evacSpots) clearAt(e.x, e.z, "an evacuation spot on the sand");
for (const z of [-6.8, -4.4, 2.6, 4.8, 7.0]) clearAt(-9.6, z, "a towel a bather rests on");
// the walks round the pool's ends, the beach's top, the way in from the gate
const boxes = wave.furniture.map((f) => ({ ...f, hx: (f.hx ?? 0.3) + 0.3, hz: (f.hz ?? 0.3) + 0.3 }));
const inFurniture = (x, z) => boxes.some((f) => Math.abs(x - f.x) < f.hx && Math.abs(z - f.z) < f.hz);
let walked = 0;
for (let x = -10.4; x <= 7.0; x += 0.7)
  for (const z of [-10.3, -11.5, -12.7, -13.9, 10.3, 11.4, 12.4]) {
    if (inFurniture(x, z)) continue;
    clearAt(x, z, "the walk round the pool's end");
    walked++;
  }
for (let z = -9; z <= 9; z += 0.6)
  if (!inFurniture(-10.9, z)) clearAt(-10.9, z, "the boardwalk at the beach's top");
for (let z = -16.4; z <= -14.9; z += 0.3) clearAt(wave.doors.doorX, z, "the way in through the gate");
assert.ok(walked > 100, "the walks were sampled");
// open water over the whole pool: nothing of the model above the water's surface
for (let x = -6; x <= WAVE.halfX - 0.5; x += 0.8)
  for (let z = -WAVE.halfZ + 0.4; z <= WAVE.halfZ - 0.4; z += 0.8) {
    const hit = firstDown(x, z, 6);
    assert.ok(
      !hit || hit.point.y < WAVE.water - 0.005,
      `open water at ${x.toFixed(1)}, ${z.toFixed(1)} (${hit?.object.name})`,
    );
  }
// the chambers open toward the pool: looking in at each one just above the water, the first thing met is its grille or the dark
for (const z of CHAMBERS) {
  ray.set(new THREE.Vector3(0, 0.3, z + 0.13), new THREE.Vector3(1, 0, 0));
  const hit = ray.intersectObjects(meshes, false)[0];
  assert.ok(
    hit && hit.point.x > WAVE.halfX + 0.45,
    `the chamber at z ${z} is open to the pool (met ${hit?.object.name} at ${hit?.point.x.toFixed(2)})`,
  );
}

// ---- with the model: the same Wave Pool to play -------------------------------------------------------------------------------
const world = new PoolWorld(container, () => {}, { headless: true, venue: wave });
const root = world.scene.getObjectByName("waveclub");
assert.ok(root, "the Wave Pool takes the model once it is in");
assert.equal(world.lightingName, "wave");
assert.equal(world.look.sun[1], WAVE_LOOKS.wave.sun[1], "its own late-afternoon sun");
const hooks = (w) => w.clickables.map((c) => JSON.stringify({ ...c.userData })).sort();
assert.deepEqual(hooks(world), hooks(classic), "the same hit boxes as the classic Wave Pool");
const labels = (w) => w.labels.map((l) => l.text).sort();
assert.deepEqual(labels(world), labels(classic), "the same labels as the classic Wave Pool");
assert.equal(world.ringModels.length, classic.ringModels.length, "the life rings");
assert.ok(world.ringAt.every(Boolean), "each ring hangs on the model's board");
for (const k of [
  "fishNetRack",
  "flashlightRack",
  "fuseLever",
  "water",
  "skimmerRack",
  "riverHighlight",
  "riverRim",
])
  assert.ok(world[k], k + " is there, as in the classic Wave Pool");
assert.equal(world.finPairs.length, wave.tubes, "a tube on the peg for every tube in the hut");
assert.equal(world.lockerDoors.length, 2, "the gate's two leaves, swung by the game");
assert.ok(
  world.lostTubes instanceof Map && typeof world.waveBreak === "function",
  "the lost tubes and the breaking spray",
);
const live = world.scene.getObjectByName("wave-live");
assert.ok(
  live && live.children.length >= CHAMBERS.length + 2 + A.Flag.length + 40,
  "the surges, the beacons, the flags, the bulbs, the pennants",
);
const sim = {
  waves: { list: [{ x: 2, a: 0.3, broken: false, foam: 0 }], launched: 3, state: "running", monster: 2 },
};
for (const u of world.updaters) u(3.7, 0.016, world, sim);

const drawn = (w) => {
  let n = 0;
  w.scene.traverse((o) => {
    if ((o.isMesh || o.isPoints || o.isLine) && o.visible && o.material?.visible !== false) n++;
  });
  return n;
};
assert.ok(
  drawn(world) < drawn(classic),
  `${drawn(world)} draw calls against the classic Wave Pool's ${drawn(classic)}`,
);
assert.ok(classes.size <= 30, classes.size + " material classes");
console.warn = quiet;

console.log(
  `Wave Pool checks passed: the model (${(glbBytes / 1e6).toFixed(1)} MB, ${Math.round(triangles / 1000)}k triangles, ${classes.size} materials) and its pictures (${(pictureBytes / 1e6).toFixed(2)} MB); the classic Wave Pool till it is in; the same hit boxes and labels; nothing in the way at the ${wave.evacSpots.length} evacuation spots, the queue, the towels and ${walked} points of the walks; open water over the pool and every chamber open; the anchors for the surges, the LED board, the beacons, the bulbs, the flags and the tubes; ${drawn(world)} draw calls against ${drawn(classic)}.`,
);
