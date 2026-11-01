// The Lazy River dressed for real (scene/riverclub.mjs, 1 November 2026): built headless from the real model
// (dist/assets/river-club/river.glb, parsed here; its pictures are stand-ins), it must keep every hook the classic jungle has (the
// same hit boxes and labels: the stations, the tube rack and its tubes, the rings, the skimmer, the net, the torch, the fuse box,
// the treats, the tube return), keep what moves (the river's water, the waterfall and its mist, the flames at the model's torches,
// the parrots, the gate's leaves), put its pieces where the game's plan has them (nothing in anyone's way where the guests wait and
// walk: the queue, the evacuation spots, the spots along both banks, the docks, the tube return, the bridge's ends and its deck,
// the whole deck between the furniture; open water over the river; the anchors where the game needs them), cost fewer draw calls
// than the classic one and stay within its budget. The classic jungle is still the one built until the model is in, and with
// ?nomodels.
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { GLTFLoader } from "./dist/assets/GLTFLoader.js";
import { PoolWorld } from "./dist/scene.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { primeRiverClub, riverClubReady, riverClubPictures, RIVER_LOOKS } from "./dist/scene/riverclub.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const quiet = console.warn;
console.warn = () => {};
const container = { clientWidth: 1440, clientHeight: 900 };
const DIR = "dist/assets/river-club/";
const venue = VENUES.river;
const R = venue.river;

// ---- the files: there, and small enough (its photographic materials a little over the other venues' pictures) ------------------
const info = JSON.parse(readFileSync(DIR + "river.json", "utf8"));
const pictures = riverClubPictures(info);
let pictureBytes = 0;
for (const p of pictures) pictureBytes += statSync(DIR + p + ".webp").size;
const glbBytes = statSync(DIR + "river.glb").size;
assert.ok(glbBytes < 10e6, `the model is ${(glbBytes / 1e6).toFixed(1)} MB (budget 10)`);
assert.ok(pictureBytes < 4e6, `the pictures are ${(pictureBytes / 1e6).toFixed(1)} MB (budget 4)`);
assert.deepEqual(
  readdirSync(DIR)
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.slice(0, -5))
    .sort(),
  [...pictures].sort(),
  "every picture in the folder is used",
);

// ---- before the model is in: the classic jungle -------------------------------------------------------------------------------
assert.equal(riverClubReady(), false);
const classic = new PoolWorld(container, () => {}, { headless: true, venue });
assert.equal(
  classic.scene.getObjectByName("riverclub"),
  undefined,
  "until the model is in, the classic jungle",
);

// ---- the model -----------------------------------------------------------------------------------------------------------------
const data = readFileSync(DIR + "river.glb");
const gltf = await new Promise((resolve, reject) =>
  new GLTFLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
    resolve,
    reject,
  ),
);
primeRiverClub({
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
for (const set of ["sandstone", "templestone", "riverrock", "riverbed", "planks", "bamboo", "leaflitter"])
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
assert.ok(A.Flame?.length >= 10, `a flame on every torch, totem and the camp fire (${A.Flame?.length})`);

// ---- placement: nothing in the way where the guests wait and walk; the river open ---------------------------------------------
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
for (const q of [-1, 1].flatMap((side) =>
  Array.from({ length: 12 }, (_, slot) => venue.queuePosition(side, slot)),
))
  clearAt(q.x, q.z, "the queue by the jungle gate");
for (const e of venue.evacSpots) clearAt(e.x, e.z, "an evacuation spot");
const banks = venue.edgeSpots();
assert.ok(banks.length > 20, `the spots along both banks (${banks.length})`);
for (const b of banks) clearAt(b.x, b.z, "a spot on the bank");
for (const d of [R.docks.board, R.docks.exit]) clearAt(d.stand.x, d.stand.z, "a dock's place to stand", 0.25);
// the tube return: a low rack on a slatted floor, where the game drops the used tubes
for (const dx of [-0.35, 0, 0.35])
  for (const dz of [0, 0.35])
    clearAt(R.docks.tubeReturn.x + dx, R.docks.tubeReturn.z + dz, "the tube return");
for (const e of R.bridge.ends) clearAt(e.x, e.z, "the bridge's end");
// the bridge's deck: walked on at the deck's height, nothing over it but its rails at the sides
let bridged = 0;
for (let d = -R.bridge.reach; d <= R.bridge.reach; d += 0.3)
  for (const a of [-0.4, 0, 0.4]) {
    const p = R.point(R.bridge.s + a, d);
    clearAt(p.x, p.z, "the bridge's deck", 0.3);
    bridged++;
  }
// the whole deck, every 0.7 m, wherever the classic jungle has something too: the furniture (its own boxes, a little wider; a
// palm's crown or a banana plant's leaves over the deck), the fixtures (the treats' crates, the torch's pedestal), the tube
// return's rack, the bridge's rails and posts, the temple's pillars and steps beside the river's way out
const boxes = [...venue.furniture, ...(venue.obstacles || [])].map((f) => ({
  ...f,
  hx: (f.hx ?? 0.3) + (f.kind === "palm" ? 1.4 : 0.3),
  hz: (f.hz ?? 0.3) + (f.kind === "palm" ? 1.4 : 0.3),
}));
const F = venue.fixtures;
const spots = [
  [F.treats, 1.0],
  [F.flashlight, 0.6],
  [R.docks.tubeReturn, 1.4],
];
const inFurniture = (x, z) => {
  if (boxes.some((f) => Math.abs(x - f.x) < f.hx && Math.abs(z - f.z) < f.hz)) return true;
  if (spots.some(([p, r]) => Math.hypot(x - p.x, z - p.z) < r)) return true;
  const q = R.locate(x, z);
  if (Math.abs(q.s - R.bridge.s) < R.bridge.half + 0.3 && Math.abs(q.d) < R.bridge.reach + 0.4) return true;
  return q.s > R.end - 1.6 && Math.abs(q.d) < R.w + 3;
};
const D = venue.deck;
let walked = 0;
for (let x = D.minX + 0.5; x <= D.maxX - 0.5; x += 0.7)
  for (let z = D.minZ + 0.5; z <= D.maxZ - 0.5; z += 0.7) {
    if (inFurniture(x, z) || !venue.isDeck(x, z, 3, 0.3) || R.inWater(x, z, -0.3)) continue;
    clearAt(x, z, "the deck");
    walked++;
  }
assert.ok(walked > 400, `the deck was sampled (${walked})`);
// open water over the river, off the bridge and the stones, from the cave's mouth to the temple's
let open = 0;
for (let s = R.start + 1.2; s <= R.end - 1.2; s += 0.6)
  for (let d = -(R.w - 0.2); d <= R.w - 0.2; d += 0.5) {
    const p = R.point(s, d);
    if (!R.overWater(p.x, p.z)) continue;
    // (the docks' planks and steps reach over the water's edge, as in the classic; and the stones' rims)
    if (d < -(R.w - 0.9) && [R.docks.board, R.docks.exit].some((k) => Math.abs(s - k.s) < 1.2)) continue;
    if (R.stones.some((st) => Math.hypot(p.x - st.x, p.z - st.z) < st.r + 0.15)) continue;
    const hit = firstDown(p.x, p.z, 8);
    assert.ok(
      !hit || hit.point.y < -0.25,
      `open water at s ${s.toFixed(1)}, d ${d.toFixed(1)} (${hit?.object.name} at ${hit?.point.y.toFixed(2)})`,
    );
    open++;
  }
// the stepping stones stand out of the water where the game has them, flat enough to land on
for (const st of R.stones) {
  const hit = firstDown(st.x, st.z, 3);
  assert.ok(
    hit && hit.point.y > -0.1 && hit.point.y < 0.2,
    `a stepping stone at ${st.x.toFixed(1)}, ${st.z.toFixed(1)}`,
  );
}

// ---- with the model: the same Lazy River to play -------------------------------------------------------------------------------
const world = new PoolWorld(container, () => {}, { headless: true, venue });
const root = world.scene.getObjectByName("riverclub");
assert.ok(root, "the Lazy River takes the model once it is in");
assert.equal(world.lightingName, "river");
assert.equal(world.look.lamps, RIVER_LOOKS.river.lamps, "its own lanterns, lit softly");
const hooks = (w) => w.clickables.map((c) => JSON.stringify({ ...c.userData })).sort();
assert.deepEqual(hooks(world), hooks(classic), "the same hit boxes as the classic jungle");
const labels = (w) => w.labels.map((l) => l.text).sort();
assert.deepEqual(labels(world), labels(classic), "the same labels as the classic jungle");
assert.equal(world.ringModels.length, classic.ringModels.length, "the life rings");
assert.ok(world.ringAt.every(Boolean), "each ring hangs on the model's board");
for (const k of ["fishNetRack", "flashlightRack", "fuseLever", "water", "skimmerRack", "riverHighlight"])
  assert.ok(world[k], k + " is there, as in the classic jungle");
assert.equal(world.finPairs.length, classic.finPairs.length, "the tubes on the rack, taken by the game");
assert.equal(world.lockerDoors.length, 2, "the gate's two leaves, swung by the game");
const live = world.scene.getObjectByName("river-live");
assert.ok(live && live.children.length > 0, "what moves: the waterfall, the flames, the parrots");
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
  `${drawn(world)} draw calls against the classic jungle's ${drawn(classic)}`,
);
assert.ok(classes.size <= 30, classes.size + " material classes");
console.warn = quiet;

console.log(
  `Lazy River checks passed: the model (${(glbBytes / 1e6).toFixed(1)} MB, ${Math.round(triangles / 1000)}k triangles, ${classes.size} materials) and its photographic pictures (${(pictureBytes / 1e6).toFixed(2)} MB); the classic jungle till it is in; the same hit boxes and labels; nothing in the way at the queue, the ${venue.evacSpots.length} evacuation spots, ${banks.length} spots on the banks, the docks, the tube return, ${bridged} points of the bridge and ${walked} of the deck; open water at ${open} points of the river; the stones to land on; the anchors for the rings, the torch and ${A.Flame.length} flames; ${drawn(world)} draw calls against ${drawn(classic)}.`,
);
