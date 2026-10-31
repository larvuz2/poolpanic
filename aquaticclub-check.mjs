// The Aquatic Centre dressed for real (scene/aquaticclub.mjs, 31 October 2026): built headless from the real model
// (dist/assets/aquatic/aquatic.glb, parsed here; its pictures are stand-ins), it must keep every hook the classic Aquatic Centre has
// (the same hit boxes and labels, the fins, the rings, the changing rooms' two doors in the timing wall), keep what moves (the timing
// board, the pace clocks, the club flags, the crowds and their ribbons), show its roof and near stand to the Coach Cam only, cost fewer
// draw calls than the classic one and stay within its budget. The classic Aquatic Centre is still the one built until the model is
// in, and with ?nomodels.
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { GLTFLoader } from "./dist/assets/GLTFLoader.js";
import { PoolWorld } from "./dist/scene.mjs";
import { PoolSimulation } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import {
  primeAquaticClub,
  aquaticClubReady,
  aquaticClubPictures,
  AQUATIC_LOOKS,
} from "./dist/scene/aquaticclub.mjs";
import { primeCrowdModels, crowdModelsReady } from "./dist/scene/crowd-models.mjs";
import { primeOfficials, OFFICIALS } from "./dist/scene/officials.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const quiet = console.warn;
console.warn = () => {};
const container = { clientWidth: 1440, clientHeight: 900 };
const DIR = "dist/assets/aquatic/";
const aquatic = VENUES.aquatic;

// ---- the files: there, and small enough --------------------------------------------------------------------------------------
const info = JSON.parse(readFileSync(DIR + "aquatic.json", "utf8"));
const pictures = aquaticClubPictures(info);
let pictureBytes = 0;
for (const p of pictures) pictureBytes += statSync(DIR + p + ".webp").size;
const glbBytes = statSync(DIR + "aquatic.glb").size;
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
  "the Coach Cam's own meshes (the roof, the near stand)",
);

// ---- before the model is in: the classic Aquatic Centre --------------------------------------------------------------------------
assert.equal(aquaticClubReady(), false);
const classic = new PoolWorld(container, () => {}, { headless: true, venue: aquatic });
assert.equal(
  classic.scene.getObjectByName("aquaticclub"),
  undefined,
  "until the model is in, the classic Aquatic Centre",
);

// ---- the model -----------------------------------------------------------------------------------------------------------------
const data = readFileSync(DIR + "aquatic.glb");
const gltf = await new Promise((resolve, reject) =>
  new GLTFLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
    resolve,
    reject,
  ),
);
primeAquaticClub({
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

// ---- its people: the crowd (five Meshy spectators, two still poses each, very low) and the two officials (rigged, one clip each)
const parse = (file) => {
  const bytes = readFileSync(file);
  return new Promise((resolve, reject) =>
    new GLTFLoader().parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
      resolve,
      reject,
    ),
  );
};
const crowdInfo = JSON.parse(readFileSync("dist/assets/crowd/crowd.json", "utf8"));
const crowdFile = await parse("dist/assets/crowd/crowd.glb");
let crowdTriangles = 0;
crowdFile.scene.traverse((o) => {
  if (!o.isMesh) return;
  assert.ok(o.geometry.attributes.uv, (o.parent?.name || o.name) + " keeps its UVs (gltfpack -kv)");
  crowdTriangles += o.geometry.index.count / 3;
});
assert.equal(crowdInfo.people.length, 5, "five spectators");
assert.ok(
  crowdTriangles / 10 <= 500,
  `a spectator's pose is ${Math.round(crowdTriangles / 10)} triangles (budget 500)`,
);
let crowdBytes = 0;
for (const f of ["crowd.glb", "crowd.webp", "crowd_mask.webp", "crowd.json"])
  crowdBytes += statSync("dist/assets/crowd/" + f).size;
assert.ok(crowdBytes < 600e3, `the crowd's files are ${Math.round(crowdBytes / 1e3)} KB (budget 600)`);
primeCrowdModels({
  scene: crowdFile.scene,
  info: crowdInfo,
  texture: new THREE.Texture(),
  mask: new THREE.Texture(),
});
assert.ok(crowdModelsReady());
// (their files embed their pictures, which Node cannot decode: the clips and the skin are read from the file's JSON, and stand-ins sit)
const officials = {};
for (const o of OFFICIALS) {
  const bytes = readFileSync("dist/assets/models/" + o.file);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
  assert.ok(
    json.animations?.some((a) => a.name === o.clip),
    `${o.id} has ${o.clip}`,
  );
  assert.equal(json.skins?.[0]?.joints.length >= 24, true, `${o.id} is rigged on Coach Waters' skeleton`);
  assert.ok(bytes.length < 1.6e6, o.file + " is small enough");
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.3)));
  officials[o.id] = { scene, animations: [new THREE.AnimationClip(o.clip, 10, [])] };
}
primeOfficials(officials);

// ---- with the model: the same pool to play -------------------------------------------------------------------------------------
const world = new PoolWorld(container, () => {}, { headless: true, venue: aquatic });
const root = world.scene.getObjectByName("aquaticclub");
assert.ok(root, "the Aquatic Centre takes the model once it is in");
assert.equal(world.lightingName, "aquatic");
assert.equal(
  world.look.lamps,
  AQUATIC_LOOKS.aquatic.lamps,
  "every lamp in the model lit (the windows' daylight)",
);
const hooks = (w) => w.clickables.map((c) => JSON.stringify({ ...c.userData })).sort();
assert.deepEqual(hooks(world), hooks(classic), "the same hit boxes as the classic Aquatic Centre");
const labels = (w) => w.labels.map((l) => l.text).sort();
assert.deepEqual(labels(world), labels(classic), "the same labels as the classic Aquatic Centre");
assert.equal(world.finPairs.length, 3, "the model's three pairs of fins are the rack's");
assert.ok(world.finPairs.every((f) => root.getObjectById(f.id)));
assert.equal(world.ringModels.length, classic.ringModels.length, "the life rings");
assert.ok(world.ringAt.every(Boolean), "each ring hangs on the model's board");
for (const k of ["fishNetRack", "flashlightRack", "fuseLever", "water", "poolLamps"])
  assert.ok(world[k], k + " is there, as in the classic Aquatic Centre");
assert.equal(world.flags.length, classic.flags.length, "the club flags along the timing wall");
assert.ok(world.updaters.length >= 3, "the timing board, the pace clocks' hands, the crowds");
// the timing board and the pace clocks are the game's, in front of the model's wall and housings
const board = world.scene.children.find(
  (o) => o.isMesh && o.geometry?.parameters?.width === 9.6 && o.geometry?.parameters?.height === 4.2,
);
assert.ok(board && board.position.z > -16.13, "the timing board, on the wall's face");
// the Coach Cam's ceiling: hidden from the overview, shown to the Coach Cam, never casting a shadow
const coachMeshes = [];
root.traverse((o) => o.isMesh && /^C_/.test(o.parent?.name || o.name) && coachMeshes.push(o));
assert.ok(coachMeshes.length > 3, "the roof's meshes");
const near = world.scene.getObjectByName("aquatic-near");
assert.ok(near && near.children.length > 0, "the near stand's crowd and ribbon");
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
world.hall.setCoach(false);

// a frame of play: the crowds cheer, the board ticks, nothing throws
for (const u of world.updaters) u(3.7, 0.016, world, null);
// the crowd: the Meshy spectators, instanced (a mesh a spectator and a pose, the flags and the foam fingers), some on their feet
// in a cheer
const crowdMeshes = [];
world.scene.traverse((o) => o.isInstancedMesh && /^crowd-/.test(o.name) && crowdMeshes.push(o));
assert.ok(
  crowdMeshes.length >= 10 && crowdMeshes.length <= 40,
  crowdMeshes.length + " instanced crowd meshes",
);
assert.ok(!world.scene.getObjectByName("crowd-dad-sit")?.castShadow, "the crowd casts no shadow");
world.cheer = 1;
for (const u of world.updaters) u(5.1, 0.016, world, null);
world.cheer = 0;
// the officials at their table, each on their own clip
for (const o of OFFICIALS) {
  const body = world.scene.getObjectByName("official-" + o.id);
  assert.ok(body, o.id + " sits at the officials' table");
  assert.ok(Math.abs(body.position.x - o.x) < 1e-6 && Math.abs(body.position.z - o.z) < 1e-6);
  assert.ok(
    Math.abs(body.position.z - 11.2) < 1.2 && body.position.x > 14.3,
    o.id + " behind the table, facing the pool",
  );
}

// the changing rooms: a door each side in the timing wall, swung by the game's door sync out onto the deck
const sim = new PoolSimulation(1, 70);
sim.schedule = [];
sim.start();
sim.venue = aquatic;
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
    name + " stands in the timing wall",
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

// ---- cheaper to draw than the classic Aquatic Centre ----------------------------------------------------------------------------------
assert.ok(
  drawn(world) < drawn(classic),
  `${drawn(world)} draw calls against the classic Aquatic Centre's ${drawn(classic)}`,
);
assert.ok(classes.size <= 30, classes.size + " material classes");
console.warn = quiet;

console.log(
  `Aquatic Centre checks passed: the model (${(glbBytes / 1e6).toFixed(1)} MB, ${Math.round(triangles / 1000)}k triangles, ${classes.size} materials) and its pictures (${(pictureBytes / 1e6).toFixed(2)} MB); the classic hall till it is in; the same hit boxes and labels; the fins, rings and doors at work; the board, clocks, flags and crowds the game's; the roof and near stand the Coach Cam's only; the crowd five Meshy spectators at ${Math.round(crowdTriangles / 10)} triangles a pose (${Math.round(crowdBytes / 1e3)} KB), the two officials seated; ${drawn(world)} draw calls against ${drawn(classic)}.`,
);
