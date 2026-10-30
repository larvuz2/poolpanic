// The Community Pool dressed as the Harbourside (scene/harbourside.mjs, 28 October 2026): built headless from the real model
// (dist/assets/club/harbourside.glb, parsed here; its pictures are stand-ins), it must keep every hook the classic pool has (the
// same hit boxes and labels, the fins, the rings, the doors), cost fewer draw calls than the classic pool, and stay within its
// budget (triangles, file sizes). The classic pool is still the one built until the model is in, and with ?nomodels.
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { GLTFLoader } from "./dist/assets/GLTFLoader.js";
import { PoolWorld, LIGHTING } from "./dist/scene.mjs";
import { PoolSimulation } from "./dist/sim.mjs";
import { primeHarbourside, harbourReady, HARBOUR_TILES } from "./dist/scene/harbourside.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const container = { clientWidth: 1440, clientHeight: 900 };
const DIR = "dist/assets/club/";

// ---- the files: there, and small enough --------------------------------------------------------------------------------------
const pictures = [
  ...HARBOUR_TILES.flatMap((t) => [t, t + "_n"]),
  "atlas_signs",
  "atlas_cut",
  "floor_paint",
  "mural",
  "floor_ao",
];
let pictureBytes = 0;
for (const p of pictures) pictureBytes += statSync(DIR + p + ".webp").size;
const glbBytes = statSync(DIR + "harbourside.glb").size;
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

// ---- before the model is in: the classic pool --------------------------------------------------------------------------------
assert.equal(harbourReady(), false);
const classic = new PoolWorld(container, () => {}, { headless: true });
assert.equal(classic.lightingName, "indoor", "until the model is in, the classic pool and its light");
assert.equal(classic.scene.getObjectByName("harbourside"), undefined);

// ---- the model -----------------------------------------------------------------------------------------------------------------
const data = readFileSync(DIR + "harbourside.glb");
const gltf = await new Promise((resolve, reject) =>
  new GLTFLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
    resolve,
    reject,
  ),
);
const info = JSON.parse(readFileSync(DIR + "harbourside.json", "utf8"));
primeHarbourside({
  scene: gltf.scene,
  info,
  textures: Object.fromEntries(pictures.map((p) => [p, new THREE.Texture()])),
});
let triangles = 0;
const classes = new Set();
gltf.scene.traverse((o) => {
  if (!o.isMesh) return;
  triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  classes.add(o.material.name.replace(/^H_/, ""));
  if (/^(tile_|signs|cut)/.test(o.material.name.replace(/^H_/, "")))
    assert.ok(o.geometry.attributes.uv, `${o.name}: a textured mesh keeps its UVs (gltfpack -kv)`);
});
assert.ok(triangles < 260000, `${triangles} triangles (budget 260k)`);
for (const name of ["Door_Men", "Door_Women", "Fins_1", "Fins_2", "Fins_3", "NearWall", "ShadowOnly"])
  assert.ok(gltf.scene.getObjectByName(name), name + " is its own node");
assert.ok(info.lights.length >= 10 && info.anchors.Flashlight.length === 1);
assert.ok(LIGHTING.harbour, "the Harbourside's look");

// ---- with the model: the same pool to play -------------------------------------------------------------------------------------
const world = new PoolWorld(container, () => {}, { headless: true });
assert.equal(
  world.lightingName,
  "harbour",
  "the Community Pool takes the Harbourside's look once the model is in",
);
const root = world.scene.getObjectByName("harbourside");
assert.ok(root, "the model is in the scene");
const hooks = (w) => w.clickables.map((c) => JSON.stringify({ ...c.userData })).sort();
assert.deepEqual(hooks(world), hooks(classic), "the same hit boxes as the classic pool");
const labels = (w) => w.labels.map((l) => l.text).sort();
assert.deepEqual(labels(world), labels(classic), "the same labels as the classic pool");
assert.equal(world.finPairs.length, 3, "the model's three pairs of fins are the rack's");
assert.ok(world.finPairs.every((f) => f.parent && root.getObjectById(f.id)));
assert.equal(world.ringModels.length, classic.ringModels.length, "the life rings");
for (const k of ["fishNetRack", "flashlightRack", "skimmerRack", "fuseLever", "water"])
  assert.ok(world[k], k + " is there, as in the classic pool");
assert.ok(world.windowGlass?.length && world.lightShafts?.length, "glass for the storm, shafts for the sun");

// the fins go as they are rented, the doors swing as guests come and go, the near wall is only for the Coach Cam
const sim = new PoolSimulation(1, 70);
sim.schedule = [];
sim.start();
sim.finsAvailable = 1;
const men = root.getObjectByName("Door_Men"),
  before = men.quaternion.clone();
sim.doors[-1] = 1;
world.sync(sim, 1);
assert.deepEqual(
  world.finPairs.map((f) => f.visible),
  [true, false, false],
);
assert.ok(men.quaternion.angleTo(before) > 0.5, "the men's door swings open");
sim.doors[-1] = 0;
world.sync(sim, 3);
assert.ok(men.quaternion.angleTo(before) < 0.01, "and shuts");
// the changing rooms' doors are in the back wall (30 October 2026) and swing out onto the deck, never into the wall
for (const [name, side] of [
  ["Door_Men", -1],
  ["Door_Women", 1],
]) {
  const door = root.getObjectByName(name),
    centre = () => new THREE.Box3().setFromObject(door).getCenter(new THREE.Vector3());
  assert.ok(
    world.lockerDoors.some((d) => d.hinge === door && d.side === side),
    name + " is swung by the game's door sync",
  );
  assert.ok(
    Math.abs(Math.abs(centre().x) - 10.7) < 0.3 && centre().z < -16.4,
    name + " stands in the back wall",
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
const near = root.getObjectByName("NearWall");
assert.equal(near.visible, false, "the overview never sees the near wall");
world.hall.setCoach(true);
assert.equal(near.visible, true, "the Coach Cam does");
world.hall.setCoach(false);

// ---- cheaper to draw than the classic pool ------------------------------------------------------------------------------------
const drawn = (w) => {
  let n = 0;
  w.scene.traverse((o) => {
    if ((o.isMesh || o.isPoints || o.isLine) && o.visible && o.material?.visible !== false) n++;
  });
  return n;
};
assert.ok(
  drawn(world) < drawn(classic),
  `${drawn(world)} draw calls against the classic pool's ${drawn(classic)}`,
);
// every mesh of the venue draws its own material class (the shaders the game compiles stay few)
assert.ok(classes.size <= 26, classes.size + " material classes");

console.log(
  `Harbourside checks passed: the model (${(glbBytes / 1e6).toFixed(1)} MB, ${Math.round(triangles / 1000)}k triangles, ${classes.size} materials) and its pictures (${(pictureBytes / 1e6).toFixed(2)} MB); the classic pool till it is in; the same hit boxes and labels; the fins, rings, doors and near wall at work; ${drawn(world)} draw calls against ${drawn(classic)}.`,
);
