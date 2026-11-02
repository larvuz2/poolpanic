// The Grand Gala Arena dressed for real (scene/arenaclub.mjs, 2 November 2026): built headless from the real model
// (dist/assets/arena-club/arena.glb, parsed here; its pictures are stand-ins), it must keep every hook the classic arena has (the same
// hit boxes and labels, the fins, the rings, the trampoline, the changing rooms' two doors in the stage's wall since 2 November 2026,
// no locker rooms), keep what moves (the screens and the marquee, the drapes, the trophy turning in its niche, the crowds and their
// ribbons, the scoreboard, the spotlights, the balloons), show its roof, near stand and rigs to the Coach Cam only, cost fewer draw
// calls than the classic arena and stay within its budget. The classic arena is still the one built until the model is in, and with
// ?nomodels.
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { GLTFLoader } from "./dist/assets/GLTFLoader.js";
import { PoolWorld } from "./dist/scene.mjs";
import { PoolSimulation } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import {
  primeArenaClub,
  arenaClubReady,
  arenaClubPictures,
  ARENA_LOOKS,
  TROPHY_AT,
} from "./dist/scene/arenaclub.mjs";
import { primeCrowdModels } from "./dist/scene/crowd-models.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const quiet = console.warn;
console.warn = () => {};
const container = { clientWidth: 1440, clientHeight: 900 };
const DIR = "dist/assets/arena-club/";
const arena = VENUES.arena;

// ---- the plan: the changing rooms' doors in the stage's wall, no locker rooms ---------------------------------------------------
assert.equal(arena.arrival.doorX, 10.7, "the doors at x ±10.7, in the stage's wall");
assert.equal(arena.arrival.crossesZ, true);
assert.ok(!arena.obstacles.some((o) => /locker/.test(o.kind)), "no locker walls");

// ---- the files: there, and small enough --------------------------------------------------------------------------------------
const info = JSON.parse(readFileSync(DIR + "arena.json", "utf8"));
const pictures = arenaClubPictures(info);
let pictureBytes = 0;
for (const p of pictures) pictureBytes += statSync(DIR + p + ".webp").size;
const glbBytes = statSync(DIR + "arena.glb").size;
assert.ok(glbBytes < 8e6, `the model is ${(glbBytes / 1e6).toFixed(1)} MB (budget 8)`);
assert.ok(pictureBytes < 2.2e6, `the pictures are ${(pictureBytes / 1e6).toFixed(1)} MB (budget 2.2)`);
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
  "the Coach Cam's own meshes (the vault, the chandeliers, the near stand)",
);

// ---- before the model is in: the classic arena, its doors in the wall too ------------------------------------------------------
assert.equal(arenaClubReady(), false);
const classic = new PoolWorld(container, () => {}, { headless: true, venue: arena });
assert.equal(
  classic.scene.getObjectByName("arenaclub"),
  undefined,
  "until the model is in, the classic arena",
);
assert.equal(classic.lockerDoors.length, 2, "the classic arena's two doors in its wall");

// ---- the model -----------------------------------------------------------------------------------------------------------------
const parse = (bytes) =>
  new Promise((resolve, reject) =>
    new GLTFLoader().parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
      resolve,
      reject,
    ),
  );
const gltf = await parse(readFileSync(DIR + "arena.glb"));
primeArenaClub({
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
assert.ok(info.lights.length >= 24, "the marquee bulbs, the chandeliers, the sconces, the spots: lamps");
// the crowd: the Meshy spectators (their files are the Aquatic Centre's, checked there)
primeCrowdModels({
  scene: (await parse(readFileSync("dist/assets/crowd/crowd.glb"))).scene,
  info: JSON.parse(readFileSync("dist/assets/crowd/crowd.json", "utf8")),
  texture: new THREE.Texture(),
  mask: new THREE.Texture(),
});

// ---- with the model: the same pool to play -------------------------------------------------------------------------------------
const world = new PoolWorld(container, () => {}, { headless: true, venue: arena });
const root = world.scene.getObjectByName("arenaclub");
assert.ok(root, "the arena takes the model once it is in");
assert.equal(world.lightingName, "gala");
assert.equal(world.look.lamps, ARENA_LOOKS.gala.lamps, "every lamp in the model lit all night");
const hooks = (w) => w.clickables.map((c) => JSON.stringify({ ...c.userData })).sort();
assert.deepEqual(hooks(world), hooks(classic), "the same hit boxes as the classic arena");
const labels = (w) => w.labels.map((l) => l.text).sort();
assert.deepEqual(labels(world), labels(classic), "the same labels as the classic arena");
assert.equal(world.finPairs.length, 3, "the model's three pairs of fins are the rack's");
assert.ok(world.finPairs.every((f) => root.getObjectById(f.id)));
assert.equal(world.ringModels.length, classic.ringModels.length, "the life rings");
assert.ok(world.ringAt.every(Boolean), "each ring hangs on the model's board");
for (const k of ["fishNetRack", "flashlightRack", "fuseLever", "water", "poolLamps"])
  assert.ok(world[k], k + " is there, as in the classic arena");
assert.ok(
  world.dimmers.length >= 4,
  "the screens, the marquee, the spotlights and the scoreboard answer to a blackout",
);
assert.ok(world.updaters.length >= 3, "the marquee, the trophy, the crowds, the spotlights");
// the screens, on the model's wall; the trophy in its niche over the main one, turning
const screen = world.scene.children.find(
  (o) => o.isMesh && o.geometry?.parameters?.width === 8.4 && o.geometry?.parameters?.height === 3.28,
);
assert.ok(screen && screen.position.z > -16.13, "the main screen, in front of the stage's wall");
const trophy = world.scene.children.find(
  (o) => o.isGroup && o.children.some((c) => c.geometry?.type === "LatheGeometry"),
);
assert.ok(trophy, "the trophy");
assert.equal(trophy.position.y, TROPHY_AT.y, "the trophy on its plinth, in the niche over the screen");
assert.equal(trophy.position.z, TROPHY_AT.z);
for (const u of world.updaters) u(2.0, 0.016, world, null);
const turned = trophy.rotation.y;
for (const u of world.updaters) u(3.0, 0.016, world, null);
assert.notEqual(trophy.rotation.y, turned, "the trophy turns");
// the Coach Cam's: the vault and the near stand, the game's near crowd, scoreboard, rigs and balloons
const coachMeshes = [];
root.traverse((o) => o.isMesh && /^C_/.test(o.parent?.name || o.name) && coachMeshes.push(o));
assert.ok(coachMeshes.length > 3, "the roof's meshes");
const near = world.scene.getObjectByName("arena-near");
assert.ok(
  near && near.children.length > 3,
  "the near stand's crowd and ribbon, the scoreboard, the rigs, the balloons",
);
world.hall.setCoach(false);
assert.ok(
  coachMeshes.every((m) => !m.visible) && !near.visible,
  "the overview looks down past the roof and the near stand",
);
world.hall.setCoach(true);
assert.ok(
  coachMeshes.every((m) => m.visible && !m.castShadow) && near.visible,
  "the Coach Cam sees them; they cast no shadow",
);
world.hall.update(4, 0.016, world, null);
world.hall.setCoach(false);
// a frame of play with a cheer: the Meshy crowd, instanced, in its evening clothes; nothing throws
const crowdMeshes = [];
world.scene.traverse((o) => o.isInstancedMesh && /^crowd-/.test(o.name) && crowdMeshes.push(o));
assert.ok(crowdMeshes.length >= 10, crowdMeshes.length + " instanced crowd meshes");
world.cheer = 1;
for (const u of world.updaters) u(5.1, 0.016, world, null);
world.cheer = 0;

// the changing rooms: a door each side in the stage's wall, swung by the game's door sync out onto the deck
const sim = new PoolSimulation(20, 70);
sim.schedule = [];
sim.start();
sim.venue = arena;
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
    name + " stands in the stage's wall",
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

// ---- cheaper to draw than the classic arena ----------------------------------------------------------------------------------------
classic.hall.setCoach(false);
assert.ok(
  drawn(world) < drawn(classic),
  `${drawn(world)} draw calls against the classic arena's ${drawn(classic)}`,
);
assert.ok(classes.size <= 30, classes.size + " material classes");
console.warn = quiet;

console.log(
  `Grand Gala Arena checks passed: the doors in the stage's wall (no locker rooms); the model (${(glbBytes / 1e6).toFixed(1)} MB, ${Math.round(triangles / 1000)}k triangles, ${classes.size} materials) and its pictures (${(pictureBytes / 1e6).toFixed(2)} MB); the classic arena till it is in; the same hit boxes and labels; the fins, rings and doors at work; the screens, the trophy in its niche, the crowds, the scoreboard and the spotlights the game's; the vault, the near stand and the rigs the Coach Cam's only; ${drawn(world)} draw calls against ${drawn(classic)}.`,
);
