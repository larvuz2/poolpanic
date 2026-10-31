// The Aqua Disco dressed for real (scene/discoclub.mjs, 31 October 2026): built headless from the real model
// (dist/assets/disco/disco.glb, parsed here; its pictures are stand-ins), it must keep every hook the classic Aqua Disco has (the same
// hit boxes and labels, the fins, the rings, the entrance's two leaves), keep everything that moves to the beat (the spots, lasers,
// LED rim, sparkles, sign and equaliser, the stage's lights and Valentina, the speakers' cones, the DJ's decks), show its ceiling and
// near wall to the Coach Cam only, cost fewer draw calls than the classic one and stay within its budget. The classic Aqua Disco is
// still the one built until the model is in, and with ?nomodels.
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { GLTFLoader } from "./dist/assets/GLTFLoader.js";
import { PoolWorld } from "./dist/scene.mjs";
import { PoolSimulation } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { primeDiscoClub, discoClubReady, discoClubPictures, DISCO_LOOKS } from "./dist/scene/discoclub.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
// (the cast's models are fetched by the page; here there is nothing to fetch, and their classic figures stand in)
const quiet = console.warn;
console.warn = () => {};
const container = { clientWidth: 1440, clientHeight: 900 };
const DIR = "dist/assets/disco/";
const disco = VENUES.disco;

// ---- the files: there, and small enough --------------------------------------------------------------------------------------
const info = JSON.parse(readFileSync(DIR + "disco.json", "utf8"));
const pictures = discoClubPictures(info);
let pictureBytes = 0;
for (const p of pictures) pictureBytes += statSync(DIR + p + ".webp").size;
const glbBytes = statSync(DIR + "disco.glb").size;
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
assert.ok(
  info.meshes.some((m) => /^C_/.test(m)),
  "the Coach Cam's own meshes (the ceiling, the near wall)",
);

// ---- before the model is in: the classic Aqua Disco --------------------------------------------------------------------------
assert.equal(discoClubReady(), false);
const classic = new PoolWorld(container, () => {}, { headless: true, venue: disco });
assert.equal(
  classic.scene.getObjectByName("discoclub"),
  undefined,
  "until the model is in, the classic Aqua Disco",
);

// ---- the model -----------------------------------------------------------------------------------------------------------------
const data = readFileSync(DIR + "disco.glb");
const gltf = await new Promise((resolve, reject) =>
  new GLTFLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
    resolve,
    reject,
  ),
);
primeDiscoClub({
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
for (const name of ["Door_A", "Door_B", "Fins_1", "Fins_2", "Fins_3"])
  assert.ok(gltf.scene.getObjectByName(name), name + " is its own node");
assert.equal(info.anchors.LifeRing.length, 3, "a board for each of the three rings");
assert.equal(info.anchors.Flashlight.length, 1, "a holder for the torch");

// ---- with the model: the same pool to play -------------------------------------------------------------------------------------
const world = new PoolWorld(container, () => {}, { headless: true, venue: disco });
const root = world.scene.getObjectByName("discoclub");
assert.ok(root, "the Aqua Disco takes the model once it is in");
assert.equal(world.lightingName, "disco");
assert.equal(world.look.lamps, DISCO_LOOKS.disco.lamps, "every lamp in the model lit");
const hooks = (w) => w.clickables.map((c) => JSON.stringify({ ...c.userData })).sort();
assert.deepEqual(hooks(world), hooks(classic), "the same hit boxes as the classic Aqua Disco");
const labels = (w) => w.labels.map((l) => l.text).sort();
assert.deepEqual(labels(world), labels(classic), "the same labels as the classic Aqua Disco");
assert.equal(world.finPairs.length, 3, "the model's three pairs of fins are the rack's");
assert.ok(world.finPairs.every((f) => root.getObjectById(f.id)));
assert.equal(world.ringModels.length, classic.ringModels.length, "the life rings");
assert.ok(world.ringAt.every(Boolean), "each ring hangs on the model's board");
for (const k of ["fishNetRack", "flashlightRack", "fuseLever", "water", "poolLamps"])
  assert.ok(world[k], k + " is there, as in the classic Aqua Disco");
assert.ok(world.updaters.length >= 2, "the beat, and the DJ and the bartender");

// the Coach Cam's ceiling: hidden from the overview, shown to the Coach Cam, never casting a shadow
const coachMeshes = [];
root.traverse((o) => o.isMesh && /^C_/.test(o.parent?.name || o.name) && coachMeshes.push(o));
assert.ok(coachMeshes.length > 3, "the ceiling's meshes");
world.hall.setCoach(false);
assert.ok(
  coachMeshes.every((m) => !m.visible),
  "the overview looks down past the ceiling and the near wall",
);
world.hall.setCoach(true);
assert.ok(
  coachMeshes.every((m) => m.visible && !m.castShadow),
  "the Coach Cam sees them; they cast no shadow",
);
world.hall.setCoach(false);

// the beat still runs everything that moved in the classic disco: a frame later the spots have moved
const before = [];
world.scene.traverse((o) => o.isMesh && o.renderOrder === 3 && before.push(o.position.clone()));
assert.ok(before.length >= 8, "the moving-head spots");
for (const u of world.updaters) u(3.7, 0.016, world, null);
const after = [];
world.scene.traverse((o) => o.isMesh && o.renderOrder === 3 && after.push(o.position.clone()));
assert.ok(
  before.some((p, i) => p.distanceTo(after[i]) > 0.01),
  "the spots sweep to the beat",
);

// the entrance: two leaves in the back wall, swung by the game's door sync out onto the deck
const sim = new PoolSimulation(1, 70);
sim.schedule = [];
sim.start();
sim.venue = disco;
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
    Math.abs(centre().x - side * 0.62) < 0.3 && Math.abs(centre().z + 16.03) < 0.2,
    name + " stands in the entrance",
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

// ---- cheaper to draw than the classic Aqua Disco ----------------------------------------------------------------------------------
assert.ok(
  drawn(world) < drawn(classic),
  `${drawn(world)} draw calls against the classic Aqua Disco's ${drawn(classic)}`,
);
assert.ok(classes.size <= 30, classes.size + " material classes");
console.warn = quiet;

console.log(
  `Aqua Disco checks passed: the model (${(glbBytes / 1e6).toFixed(1)} MB, ${Math.round(triangles / 1000)}k triangles, ${classes.size} materials) and its pictures (${(pictureBytes / 1e6).toFixed(2)} MB); the classic disco till it is in; the same hit boxes and labels; the fins, rings and doors at work; the beat running the lights; the ceiling the Coach Cam's only; ${drawn(world)} draw calls against ${drawn(classic)}.`,
);
