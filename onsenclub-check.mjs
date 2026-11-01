// The Mountain Hot Springs dressed for real (scene/onsenclub.mjs, 1 November 2026): built headless from the real model
// (dist/assets/onsen-club/onsen.glb, parsed here; its pictures are stand-ins), it must keep every hook the classic springs have (the
// same hit boxes and labels: the four springs to click, the stations, the rings, the skimmer, the net, the torch, the fuse box, the
// treats), keep what moves (the springs' water, the steam, the falling snow, the spout's thread of water, the curtain, the lanterns'
// flames, the guests and the monkeys), put its pieces where the game's plan has them (the rings on their boards, the torch on its
// post, every boulder the walks go round under a rock of the model), cost fewer draw calls than the classic one and stay within its
// budget. The classic springs are still the ones built until the model is in, and with ?nomodels.
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { GLTFLoader } from "./dist/assets/GLTFLoader.js";
import { PoolWorld } from "./dist/scene.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { BOULDERS, SPRINGS } from "./dist/onsen-plan.mjs";
import { primeOnsenClub, onsenClubReady, onsenClubPictures, ONSEN_LOOKS } from "./dist/scene/onsenclub.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const quiet = console.warn;
console.warn = () => {};
const container = { clientWidth: 1440, clientHeight: 900 };
const DIR = "dist/assets/onsen-club/";
const onsen = VENUES.onsen;

// ---- the files: there, and small enough --------------------------------------------------------------------------------------
const info = JSON.parse(readFileSync(DIR + "onsen.json", "utf8"));
const pictures = onsenClubPictures(info);
let pictureBytes = 0;
for (const p of pictures) pictureBytes += statSync(DIR + p + ".webp").size;
const glbBytes = statSync(DIR + "onsen.glb").size;
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

// ---- before the model is in: the classic springs ---------------------------------------------------------------------------
assert.equal(onsenClubReady(), false);
const classic = new PoolWorld(container, () => {}, { headless: true, venue: onsen });
assert.equal(
  classic.scene.getObjectByName("onsenclub"),
  undefined,
  "until the model is in, the classic springs",
);

// ---- the model -----------------------------------------------------------------------------------------------------------------
const data = readFileSync(DIR + "onsen.glb");
const gltf = await new Promise((resolve, reject) =>
  new GLTFLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
    resolve,
    reject,
  ),
);
primeOnsenClub({
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
assert.equal(info.anchors.LifeRing.length, 3, "a board for each of the three rings");
assert.equal(info.anchors.Flashlight.length, 1, "a post for the torch");
assert.ok(info.lights.filter((l) => l.kind === "Lantern").length >= 4, "the four stone lanterns' glow");

// the pieces where the plan has them: the torch's post, and a rock of the model over every boulder the walks go round
const torch = info.anchors.Flashlight[0];
assert.ok(
  Math.hypot(torch[0] - onsen.fixtures.flashlight.x, torch[2] - onsen.fixtures.flashlight.z) < 0.05,
  "the torch on its post",
);
assert.ok(Math.abs(torch[1] - 1.24) < 0.05, "the torch where the game puts it, 1.24 m up");
gltf.scene.updateMatrixWorld(true);
const rocky = [];
gltf.scene.traverse((o) => {
  if (o.isMesh && /tile_(rock|snow)/.test(o.material.name)) rocky.push(o); // (the boulders' tops are under snow)
});
const raycaster = new THREE.Raycaster();
for (const b of BOULDERS) {
  raycaster.set(new THREE.Vector3(b.x, 5, b.z), new THREE.Vector3(0, -1, 0));
  const hit = raycaster.intersectObjects(rocky, false)[0];
  assert.ok(
    hit && hit.point.y > b.r * 0.4,
    `a rock over the boulder at ${b.x.toFixed(1)}, ${b.z.toFixed(1)}`,
  );
}
// and none in the springs' water: straight down through each spring's middle, nothing above its surface but the water's own
for (const s of SPRINGS) {
  raycaster.set(new THREE.Vector3(s.x, 5, s.z), new THREE.Vector3(0, -1, 0));
  const hit = raycaster.intersectObjects([gltf.scene], true).find((h) => h.object.isMesh);
  assert.ok(!hit || hit.point.y < -0.2, `the middle of spring ${s.id + 1} is open water`);
}

// ---- with the model: the same springs to play ----------------------------------------------------------------------------------
const world = new PoolWorld(container, () => {}, { headless: true, venue: onsen });
const root = world.scene.getObjectByName("onsenclub");
assert.ok(root, "the springs take the model once it is in");
assert.equal(world.lightingName, "onsen");
assert.equal(world.look.lamps, ONSEN_LOOKS.onsen.lamps, "every lamp in the model lit");
const hooks = (w) => w.clickables.map((c) => JSON.stringify({ ...c.userData })).sort();
assert.deepEqual(hooks(world), hooks(classic), "the same hit boxes as the classic springs");
const labels = (w) => w.labels.map((l) => l.text).sort();
assert.deepEqual(labels(world), labels(classic), "the same labels as the classic springs");
assert.equal(world.ringModels.length, classic.ringModels.length, "the life rings");
assert.ok(world.ringAt.every(Boolean), "each ring hangs on the model's board");
for (const k of ["fishNetRack", "flashlightRack", "fuseLever", "water", "skimmerRack"])
  assert.ok(world[k], k + " is there, as in the classic springs");
assert.equal(world.springHighlights.length, 4, "the four springs light up when a guest is to be sent");
const live = world.scene.getObjectByName("onsen-live");
assert.ok(
  live && live.children.length >= 8,
  "the steam, the snow, the curtain, the spout's water and the flames",
);
for (const u of world.updaters) u(3.7, 0.016, world, null);

const drawn = (w) => {
  let n = 0;
  w.scene.traverse((o) => {
    if ((o.isMesh || o.isPoints || o.isLine) && o.visible && o.material?.visible !== false) n++;
  });
  return n;
};
assert.ok(
  drawn(world) < drawn(classic),
  `${drawn(world)} draw calls against the classic springs' ${drawn(classic)}`,
);
assert.ok(classes.size <= 30, classes.size + " material classes");
console.warn = quiet;

console.log(
  `Mountain Hot Springs checks passed: the model (${(glbBytes / 1e6).toFixed(1)} MB, ${Math.round(triangles / 1000)}k triangles, ${classes.size} materials) and its pictures (${(pictureBytes / 1e6).toFixed(2)} MB); the classic springs till it is in; the same hit boxes and labels; a rock over each of the ${BOULDERS.length} boulders and open water in every spring; the rings, torch, net, skimmer and fuse box at work; the water, steam, snow and flames the game's; ${drawn(world)} draw calls against ${drawn(classic)}.`,
);
