// The Kids Pool dressed for real (scene/kidspool.mjs, 31 October 2026): built headless from the real model (dist/assets/kids/kids.glb,
// parsed here; its pictures are stand-ins), it must keep every hook the classic Kids Pool has (the same hit boxes and labels, the
// fins, the rings, the gate's leaves, the floating toys), cost fewer draw calls than the classic one, and stay within its budget
// (triangles, file sizes). The classic Kids Pool is still the one built until the model is in, and with ?nomodels.
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { GLTFLoader } from "./dist/assets/GLTFLoader.js";
import { PoolWorld } from "./dist/scene.mjs";
import { PoolSimulation } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { primeKidsPool, kidsReady, kidsPictures, KIDS_LOOKS } from "./dist/scene/kidspool.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const container = { clientWidth: 1440, clientHeight: 900 };
const DIR = "dist/assets/kids/";
const kids = VENUES.kids;

// ---- the files: there, and small enough --------------------------------------------------------------------------------------
const info = JSON.parse(readFileSync(DIR + "kids.json", "utf8"));
const pictures = kidsPictures(info);
let pictureBytes = 0;
for (const p of pictures) pictureBytes += statSync(DIR + p + ".webp").size;
const glbBytes = statSync(DIR + "kids.glb").size;
assert.ok(glbBytes < 10e6, `the model is ${(glbBytes / 1e6).toFixed(1)} MB (budget 10)`);
assert.ok(pictureBytes < 2e6, `the pictures are ${(pictureBytes / 1e6).toFixed(1)} MB (budget 2)`);
assert.deepEqual(
  readdirSync(DIR)
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.slice(0, -5))
    .sort(),
  [...pictures].sort(),
  "every picture in the folder is used",
);

// ---- before the model is in: the classic Kids Pool -----------------------------------------------------------------------------
assert.equal(kidsReady(), false);
const classic = new PoolWorld(container, () => {}, { headless: true, venue: kids });
assert.equal(
  classic.scene.getObjectByName("kidspool"),
  undefined,
  "until the model is in, the classic Kids Pool",
);

// ---- the model -----------------------------------------------------------------------------------------------------------------
const data = readFileSync(DIR + "kids.glb");
const gltf = await new Promise((resolve, reject) =>
  new GLTFLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
    resolve,
    reject,
  ),
);
primeKidsPool({
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
    // (as floats, gltfpack -vtf: a quantized UV needs the file's texture transform, which the game's own materials never read)
    assert.ok(uv.array instanceof Float32Array, `${cls}: its UVs are floats`);
  }
});
assert.ok(triangles < 200000, `${triangles} triangles (budget 200k)`);
for (const name of ["Door_A", "Door_B", "Fins_1", "Fins_2", "Fins_3"])
  assert.ok(gltf.scene.getObjectByName(name), name + " is its own node");
assert.equal(info.anchors.LifeRing.length, 3, "a board for each of the three rings");
assert.equal(info.anchors.Flashlight.length, 1, "a holder for the torch");
assert.ok(KIDS_LOOKS.day, "its own morning light");

// ---- with the model: the same pool to play -------------------------------------------------------------------------------------
const world = new PoolWorld(container, () => {}, { headless: true, venue: kids });
const root = world.scene.getObjectByName("kidspool");
assert.ok(root, "the Kids Pool takes the model once it is in");
assert.equal(world.lightingName, "day", "always played in the day (its light is the pool's own: KIDS_LOOKS)");
assert.equal(world.look.sun[1], KIDS_LOOKS.day.sun[1]);
const hooks = (w) => w.clickables.map((c) => JSON.stringify({ ...c.userData })).sort();
assert.deepEqual(hooks(world), hooks(classic), "the same hit boxes as the classic Kids Pool");
const labels = (w) => w.labels.map((l) => l.text).sort();
assert.deepEqual(labels(world), labels(classic), "the same labels as the classic Kids Pool");
assert.equal(world.finPairs.length, 3, "the model's three pairs of fins are the rack's");
assert.ok(world.finPairs.every((f) => root.getObjectById(f.id)));
assert.equal(world.ringModels.length, classic.ringModels.length, "the life rings");
assert.ok(world.ringAt.every(Boolean), "each ring hangs on the model's board");
for (const k of ["fishNetRack", "flashlightRack", "fuseLever", "water"])
  assert.ok(world[k], k + " is there, as in the classic Kids Pool");
assert.equal(
  world.updaters.length,
  classic.updaters.length,
  "the toys float and the balloons sway, as in the classic Kids Pool",
);

// the gate: its two leaves in the back fence, swung by the game's door sync out onto the deck
const sim = new PoolSimulation(1, 70);
sim.schedule = [];
sim.start();
sim.venue = kids;
for (const [name, side] of [
  ["Door_A", -1],
  ["Door_B", 1],
]) {
  const leaf = root.getObjectByName(name),
    centre = () => new THREE.Box3().setFromObject(leaf).getCenter(new THREE.Vector3());
  assert.ok(
    world.lockerDoors.some((d) => d.hinge === leaf && d.side === side),
    name + " is swung by the game's door sync",
  );
  assert.ok(
    Math.abs(centre().x - side * 0.62) < 0.3 && Math.abs(centre().z + 16.4) < 0.2,
    name + " stands in the gate",
  );
  sim.doors[side] = 0;
  world.sync(sim, 4);
  const shut = centre();
  sim.doors[side] = 1;
  world.sync(sim, 4.1);
  assert.ok(centre().z > shut.z + 0.3, name + " swings out onto the deck");
  sim.doors[side] = 0;
  world.sync(sim, 4.2);
}
const drawn = (w) => {
  let n = 0;
  w.scene.traverse((o) => {
    if ((o.isMesh || o.isPoints || o.isLine) && o.visible && o.material?.visible !== false) n++;
  });
  return n;
};

// ---- cheaper to draw than the classic Splash Park ---------------------------------------------------------------------------------
assert.ok(
  drawn(world) < drawn(classic),
  `${drawn(world)} draw calls against the classic Kids Pool's ${drawn(classic)}`,
);
assert.ok(classes.size <= 30, classes.size + " material classes");

console.log(
  `Kids Pool checks passed: the model (${(glbBytes / 1e6).toFixed(1)} MB, ${Math.round(triangles / 1000)}k triangles, ${classes.size} materials) and its pictures (${(pictureBytes / 1e6).toFixed(2)} MB); the classic pool till it is in; the same hit boxes and labels; the fins, rings, gate, toys and balloons at work; ${drawn(world)} draw calls against ${drawn(classic)}.`,
);
