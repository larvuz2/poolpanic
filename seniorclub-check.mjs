// Senior Aqua Fit dressed for real (scene/seniorclub.mjs, 1 November 2026): built headless from the real model
// (dist/assets/senior-club/senior.glb, parsed here; its pictures are stand-ins), it must keep every hook the classic conservatory has
// (the same hit boxes and labels: the stations, the fins, the rings, the skimmer, the net, the torch, the fuse box, the treats on the
// tea trolley), keep what moves (the spa's water, bubbles and steam, the gramophone's notes, the late sun's shafts and motes, the
// window pattern the roof's ribs cast, the doors' leaves, the roof for the Coach Cam only), put its pieces where the game's plan has
// them (nothing in anyone's way where the guests wait and walk, at the evacuation columns or round the massage table; open water
// over the whole pool; the anchors where the game needs them), cost fewer draw calls than the classic one and stay within its
// budget. The classic conservatory is still the one built until the model is in, and with ?nomodels.
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { GLTFLoader } from "./dist/assets/GLTFLoader.js";
import { PoolWorld } from "./dist/scene.mjs";
import { VENUES } from "./dist/spatial.mjs";
import {
  primeSeniorClub,
  seniorClubReady,
  seniorClubPictures,
  SENIOR_LOOKS,
} from "./dist/scene/seniorclub.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const quiet = console.warn;
console.warn = () => {};
const container = { clientWidth: 1440, clientHeight: 900 };
const DIR = "dist/assets/senior-club/";
const senior = VENUES.senior;
const P = senior.pool;

// ---- the files: there, and small enough --------------------------------------------------------------------------------------
const info = JSON.parse(readFileSync(DIR + "senior.json", "utf8"));
const pictures = seniorClubPictures(info);
let pictureBytes = 0;
for (const p of pictures) pictureBytes += statSync(DIR + p + ".webp").size;
const glbBytes = statSync(DIR + "senior.glb").size;
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

// ---- before the model is in: the classic conservatory --------------------------------------------------------------------------
assert.equal(seniorClubReady(), false);
const classic = new PoolWorld(container, () => {}, { headless: true, venue: senior });
assert.equal(
  classic.scene.getObjectByName("seniorclub"),
  undefined,
  "until the model is in, the classic conservatory",
);

// ---- the model -----------------------------------------------------------------------------------------------------------------
const data = readFileSync(DIR + "senior.glb");
const gltf = await new Promise((resolve, reject) =>
  new GLTFLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
    resolve,
    reject,
  ),
);
primeSeniorClub({
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
const torch = A.Flashlight?.[0];
assert.ok(
  torch &&
    Math.hypot(torch[0] - senior.fixtures.flashlight.x, torch[2] - senior.fixtures.flashlight.z) < 0.05,
  "the torch on its pedestal",
);
assert.ok(Math.abs(torch[1] - 1.24) < 0.05, "the torch where the game puts it, 1.24 m up");
const furniture = (kind) => senior.furniture.find((f) => f.kind === kind);
const near = (a, f, d = 0.05) => a && Math.hypot(a[0] - f.x, a[2] - f.z) < d;
assert.ok(
  near(A.Spa?.[0], furniture("spa")) && Math.abs(A.Spa[0][1] - 0.58) < 0.02,
  "the spa's water in its tub",
);
assert.ok(near(A.Notes?.[0], furniture("gramophone")), "the gramophone's notes");
const trolley = furniture("trolley");
assert.ok(
  near(A.Biscuits?.[0], { x: trolley.x - 0.18, z: trolley.z + 0.3 }) &&
    Math.abs(A.Biscuits[0][1] - 1.05) < 0.02,
  "the tin of treats on the trolley's top tier, where the classic has it",
);

// ---- placement: nothing in the way where the guests wait and walk; the water open ---------------------------------------------
gltf.scene.updateMatrixWorld(true);
const meshes = [];
gltf.scene.traverse(
  (o) => o.isMesh && !/^C_/.test(o.name) && !/^C_/.test(o.parent?.name || "") && meshes.push(o),
);
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
  Array.from({ length: 12 }, (_, slot) => senior.queuePosition(side, slot)),
))
  clearAt(q.x, q.z, "the lounge's waiting places");
// (sanitation.mjs: the evacuation columns along both long sides)
let evac = 0;
for (const side of [-1, 1])
  for (let slot = 0; slot < 24; slot++, evac++)
    clearAt(side * (P.evacX + Math.floor(slot / 8) * 0.75), -2.7 + (slot % 8) * 1.35, "an evacuation spot");
// the walks: the long sides' corridors, behind the near end, the ends after climbing out, the way in from the doors
const boxes = senior.furniture.map((f) => ({ ...f, hx: (f.hx ?? 0.3) + 0.3, hz: (f.hz ?? 0.3) + 0.3 }));
const inFurniture = (x, z) => boxes.some((f) => Math.abs(x - f.x) < f.hx && Math.abs(z - f.z) < f.hz);
let walked = 0;
const walk = (x, z, what) => {
  if (inFurniture(x, z)) return;
  clearAt(x, z, what);
  walked++;
};
for (let z = P.walkZ - 1; z <= P.endWalkZ + 0.5; z += 0.6)
  for (const x of [-P.corridorX, P.corridorX]) walk(x, z, "the corridor along the pool");
for (let x = -P.corridorX; x <= P.corridorX; x += 0.6)
  for (const z of [P.walkZ, -P.halfZ - 0.6, P.halfZ + 0.6, P.endWalkZ])
    walk(x, z, "the walk round the pool's end");
for (let z = senior.doors.doorZ - 0.2; z >= senior.deck.minZ + 0.05; z -= 0.15)
  walk(senior.doors.doorX, z, "the way in from the doors");
// the deck strip between the pool and the walls on both long sides, at the evacuation columns' height
for (let z = -12; z <= 11; z += 0.8) for (const x of [-10.8, 10.8]) walk(x, z, "the deck along the sides");
assert.ok(walked > 150, `the walks were sampled (${walked})`);
// round the massage table the game draws (scene/massage-view.mjs): its rug, and a step round it for the coaches
const M = senior.fixtures.massage;
for (let x = M.x - 0.9; x <= M.x + 0.9; x += 0.3)
  for (let z = M.z - 1.6; z <= M.z + 1.6; z += 0.3) clearAt(x, z, "the massage table's place");
// open water over the whole pool: nothing of the model above the water's surface
for (let x = -P.halfX + 0.4; x <= P.halfX - 0.4; x += 0.8)
  for (let z = -P.halfZ + 0.4; z <= P.halfZ - 0.4; z += 0.8) {
    const hit = firstDown(x, z, 6);
    assert.ok(
      !hit || hit.point.y < -0.25,
      `open water at ${x.toFixed(1)}, ${z.toFixed(1)} (${hit?.object.name})`,
    );
  }

// ---- with the model: the same Senior Aqua Fit to play -------------------------------------------------------------------------
const world = new PoolWorld(container, () => {}, { headless: true, venue: senior });
const root = world.scene.getObjectByName("seniorclub");
assert.ok(root, "Senior Aqua Fit takes the model once it is in");
assert.equal(world.lightingName, "senior");
assert.equal(world.look.lamps, SENIOR_LOOKS.senior.lamps, "its own lamps, warm and low");
const hooks = (w) => w.clickables.map((c) => JSON.stringify({ ...c.userData })).sort();
assert.deepEqual(hooks(world), hooks(classic), "the same hit boxes as the classic conservatory");
const labels = (w) => w.labels.map((l) => l.text).sort();
assert.deepEqual(labels(world), labels(classic), "the same labels as the classic conservatory");
assert.equal(world.ringModels.length, classic.ringModels.length, "the life rings");
assert.ok(world.ringAt.every(Boolean), "each ring hangs on the model's board");
for (const k of ["fishNetRack", "flashlightRack", "fuseLever", "water", "skimmerRack"])
  assert.ok(world[k], k + " is there, as in the classic conservatory");
assert.equal(world.finPairs.length, 3, "the model's three pairs of fins");
assert.ok(
  world.finPairs.every((f) => /^Fins_/.test(f.name)),
  "the fins on the model's rack, hidden by the game as they are taken",
);
assert.equal(world.lockerDoors.length, 2, "the doors' two leaves, swung by the game");
assert.ok(world.windowGlass.length > 0, "the glass a storm darkens");
assert.ok(world.lightShafts.length > 0, "the late sun's shafts");
const shadow = world.scene.getObjectByName("roof-shadow");
assert.ok(shadow && shadow.children.every((c) => c.castShadow), "the roof's ribs cast the window pattern");
// the roof is the Coach Cam's alone
const roofParts = [];
root.traverse(
  (o) => o.isMesh && (/^C_/.test(o.name) || /^C_/.test(o.parent?.name || "")) && roofParts.push(o),
);
assert.ok(roofParts.length > 0 && roofParts.every((m) => !m.visible), "the roof hidden over the overview");
world.hall.setCoach(true);
assert.ok(
  roofParts.every((m) => m.visible),
  "and seen from the Coach Cam",
);
world.hall.setCoach(false);
for (const u of world.updaters) u(3.7, 0.016, world, {});

const drawn = (w) => {
  let n = 0;
  w.scene.traverse((o) => {
    if ((o.isMesh || o.isPoints || o.isLine) && o.visible && o.material?.visible !== false) n++;
  });
  return n;
};
assert.ok(
  drawn(world) < drawn(classic),
  `${drawn(world)} draw calls against the classic conservatory's ${drawn(classic)}`,
);
assert.ok(classes.size <= 30, classes.size + " material classes");
console.warn = quiet;

console.log(
  `Senior Aqua Fit checks passed: the model (${(glbBytes / 1e6).toFixed(1)} MB, ${Math.round(triangles / 1000)}k triangles, ${classes.size} materials) and its pictures (${(pictureBytes / 1e6).toFixed(2)} MB); the classic conservatory till it is in; the same hit boxes and labels; nothing in the way at the ${evac} evacuation spots, the lounge's waiting places, the massage table and ${walked} points of the walks; open water over the pool; the anchors for the spa, the notes, the treats and the torch; the roof the Coach Cam's alone; ${drawn(world)} draw calls against ${drawn(classic)}.`,
);
