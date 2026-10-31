// The Sunset Lagoon dressed for real (scene/lagoonclub.mjs, 31 October 2026): built headless from the real model
// (dist/assets/lagoon/lagoon.glb, parsed here; its pictures are stand-ins), it must keep every hook the classic Sunset Lagoon has (the
// same hit boxes and labels, the fins, the rings, the changing rooms' doors in the beach house's wall), follow the game's sliding
// hour (lamps out in the golden light, lit at dusk, dark in a power cut; the painted horizon dimming with the light), keep its
// horizon off the sea side, cost fewer draw calls than the classic one and stay within its budget. The classic Sunset Lagoon is
// still the one built until the model is in, and with ?nomodels.
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { GLTFLoader } from "./dist/assets/GLTFLoader.js";
import { PoolWorld } from "./dist/scene.mjs";
import { PoolSimulation } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { dayLook } from "./dist/scene/daylight.mjs";
import { primeLagoonClub, lagoonClubReady, lagoonClubPictures } from "./dist/scene/lagoonclub.mjs";
import { hourLamps } from "./dist/scene/dressed.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const container = { clientWidth: 1440, clientHeight: 900 };
const DIR = "dist/assets/lagoon/";
const lagoon = VENUES.lagoon;

// ---- the files: there, and small enough --------------------------------------------------------------------------------------
const info = JSON.parse(readFileSync(DIR + "lagoon.json", "utf8"));
const pictures = lagoonClubPictures(info);
let pictureBytes = 0;
for (const p of pictures) pictureBytes += statSync(DIR + p + ".webp").size;
const glbBytes = statSync(DIR + "lagoon.glb").size;
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
const kinds = {};
for (const l of info.lights) kinds[l.kind] = (kinds[l.kind] || 0) + 1;
assert.ok(kinds.Torch >= 16, kinds.Torch + " tiki torches");
assert.equal(kinds.Bonfire, 1, "the bonfire on the beach");
assert.ok(kinds.Paper >= 10, "paper lanterns along the beach house");

// ---- before the model is in: the classic Sunset Lagoon -----------------------------------------------------------------------
assert.equal(lagoonClubReady(), false);
const classic = new PoolWorld(container, () => {}, { headless: true, venue: lagoon });
assert.equal(
  classic.scene.getObjectByName("lagoonclub"),
  undefined,
  "until the model is in, the classic Sunset Lagoon",
);

// ---- the model -----------------------------------------------------------------------------------------------------------------
const data = readFileSync(DIR + "lagoon.glb");
const gltf = await new Promise((resolve, reject) =>
  new GLTFLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
    resolve,
    reject,
  ),
);
primeLagoonClub({
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
const world = new PoolWorld(container, () => {}, { headless: true, venue: lagoon });
const root = world.scene.getObjectByName("lagoonclub");
assert.ok(root, "the Sunset Lagoon takes the model once it is in");
assert.equal(world.lightingName, "golden", "the game's own golden hour (its shifts slide on into dusk)");
const hooks = (w) => w.clickables.map((c) => JSON.stringify({ ...c.userData })).sort();
assert.deepEqual(hooks(world), hooks(classic), "the same hit boxes as the classic Sunset Lagoon");
const labels = (w) => w.labels.map((l) => l.text).sort();
assert.deepEqual(labels(world), labels(classic), "the same labels as the classic Sunset Lagoon");
assert.equal(world.finPairs.length, 3, "the model's three pairs of fins are the rack's");
assert.ok(world.finPairs.every((f) => root.getObjectById(f.id)));
assert.equal(world.ringModels.length, classic.ringModels.length, "the life rings");
assert.ok(world.ringAt.every(Boolean), "each ring hangs on the model's board");
for (const k of ["fishNetRack", "flashlightRack", "fuseLever", "water", "sky"])
  assert.ok(world[k], k + " is there, as in the classic Sunset Lagoon");

// the painted horizon: an arc round the land sides, never over the game's sea (x < -38)
const ring = world.dressedHorizon;
assert.ok(
  ring && ring.geometry.parameters.thetaLength < Math.PI * 2 - 1,
  "the horizon leaves the sea side open",
);
const p = ring.geometry.attributes.position;
let minX = Infinity;
for (let i = 0; i < p.count; i++) minX = Math.min(minX, p.getX(i));
assert.ok(minX > -38, `the horizon's ends stop at the shore (x ${minX.toFixed(1)})`);

// the hour: no lamps in the golden light, all lit at dusk, dark in a power cut; the horizon dims with the light
const step = (t, storm = 0) => {
  world.look = dayLook(t, { azimuth: lagoon.sunAzimuth, storm });
  world.ambience.glow = world.look.glow;
  for (const u of world.updaters) u(1, 0.016, world, null);
};
const brightness = () => {
  const c = ring.material.color;
  return c.r + c.g + c.b;
};
step(0.45);
assert.equal(hourLamps(world.look.glow), 0, "no lamps at golden hour");
assert.equal(world.stringLights.visible, false, "the glows are out in the golden light");
const golden = brightness();
step(0.88);
assert.ok(hourLamps(world.look.glow) > 0.9, "every lamp lit at dusk");
assert.equal(world.stringLights.visible, true, "the torches, lanterns and bonfire glow at dusk");
const dusk = brightness();
assert.ok(dusk < golden * 0.8, `the horizon dims at dusk (${dusk.toFixed(2)} against ${golden.toFixed(2)})`);
step(0.5, 1);
assert.ok(brightness() < golden, "and greys in a storm");
step(0.88);
for (const d of world.dimmers) d(0, true);
step(0.881);
assert.equal(world.stringLights.visible, false, "a power cut puts every lamp out");
for (const d of world.dimmers) d(1, false);
step(0.882);
assert.equal(world.stringLights.visible, true, "and they come back with the power");

// the doors: flush in the beach house's wall at x -10.7 and 10.7, swung by the game's door sync out onto the deck
const sim = new PoolSimulation(1, 70);
sim.schedule = [];
sim.start();
sim.venue = lagoon;
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
    Math.abs(centre().x - side * 10.7) < 0.3 && Math.abs(centre().z + 16.05) < 0.2,
    name + " stands in the beach house's wall",
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

// ---- cheaper to draw than the classic Sunset Lagoon -------------------------------------------------------------------------------
assert.ok(
  drawn(world) < drawn(classic),
  `${drawn(world)} draw calls against the classic Sunset Lagoon's ${drawn(classic)}`,
);
assert.ok(classes.size <= 30, classes.size + " material classes");

console.log(
  `Sunset Lagoon checks passed: the model (${(glbBytes / 1e6).toFixed(1)} MB, ${Math.round(triangles / 1000)}k triangles, ${classes.size} materials, ${kinds.Torch} torches, ${kinds.Paper} lanterns, a bonfire) and its pictures (${(pictureBytes / 1e6).toFixed(2)} MB); the classic lagoon till it is in; the same hit boxes and labels; the fins, rings and doors at work; lamps and horizon following the hour, the storm and the power; ${drawn(world)} draw calls against ${drawn(classic)}.`,
);
