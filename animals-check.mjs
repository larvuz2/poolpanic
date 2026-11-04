// The dog and the macaws as models, and the shift's warm-up (4 November 2026; README "The dog and the macaws" and "The
// shift's warm-up"): the files (their bones, clips, size), the dog's clip for each thing he does, his model on the classic dog
// (the classic parts hidden, the mouth on his head), a macaw flapping and gliding; then the warm-up on a headless world with a
// stand-in renderer: at its one drawing everything is shown and nothing culled, one of each incident's visitors is there, and
// after it all is as it was; and the game wired to all of it.
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { clone } from "./dist/assets/SkeletonUtils.js";
import { PoolWorld } from "./dist/scene.mjs";
import { dogObject } from "./dist/scene/actors.mjs";
import {
  DOG_FILE,
  DOG_CLIPS,
  dogClip,
  useDogTemplate,
  attachDogModel,
  dropDogModel,
  playDog,
} from "./dist/scene/dog-model.mjs";
import { MACAW_FILES, useMacawTemplates, macawModel, flyMacaw } from "./dist/scene/macaws.mjs";

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const quiet = console.warn;
console.warn = () => {};

function readGlb(file) {
  const data = readFileSync(file);
  assert.equal(data.toString("latin1", 0, 4), "glTF", file + " is a GLB");
  return JSON.parse(data.toString("utf8", 20, 20 + data.readUInt32LE(12)));
}

// 1) The files: a skin with the bones the game and the clips use, every clip, a size the game can afford.
const DOG_BONES = [
  "Root",
  "Hips",
  "Spine",
  "Chest",
  "Neck",
  "Head",
  "EarL",
  "EarR",
  "Tail1",
  "Tail2",
  "Tail3",
].concat(...["FrontL", "FrontR", "BackL", "BackR"].map((leg) => [1, 2, 3].map((n) => leg + n)));
const BIRD_BONES = ["Root", "Body", "Head", "Tail", "WingL1", "WingL2", "WingR1", "WingR2"];
let triangles = 0;
for (const [file, bones, clips, budget] of [
  ["dist/assets/" + DOG_FILE, DOG_BONES, DOG_CLIPS, 1.5e6],
  ...Object.values(MACAW_FILES).map((f) => ["dist/assets/" + f, BIRD_BONES, ["Fly", "Glide"], 1e6]),
]) {
  const json = readGlb(file);
  assert.ok(statSync(file).size < budget, file + ": small enough");
  assert.equal(json.skins?.length, 1, file + ": one skin");
  const names = json.skins[0].joints.map((j) => json.nodes[j].name);
  for (const b of bones) assert.ok(names.includes(b), file + ": the bone " + b);
  assert.deepEqual(json.animations.map((a) => a.name).sort(), [...clips].sort(), file + ": its clips");
  const prim = json.meshes[0].primitives[0];
  triangles += json.accessors[prim.indices].count / 3;
  assert.ok(
    prim.attributes.JOINTS_0 != null && prim.attributes.WEIGHTS_0 != null,
    file + ": every vertex weighted",
  );
}
assert.ok(triangles < 30000, "the dog and two macaws: " + triangles + " triangles");

// 2) The dog's clip for what he does.
assert.deepEqual(dogClip("swim", 1, true, true), ["Swim", 1]);
assert.equal(dogClip("leap", 0, false, false)[0], "Leap");
assert.equal(dogClip("climb", 0, false, false)[0], "Leap");
assert.equal(dogClip("shake", 0, false, false)[0], "Shake");
assert.equal(dogClip("sniff", 0, false, false)[0], "Sniff");
assert.equal(dogClip("zoom", 5, false, true)[0], "Run");
assert.equal(dogClip("following", 1, false, true)[0], "Walk");
assert.deepEqual(dogClip("following", 0, false, false), ["Idle", 1.6], "waiting by the coach: wagging away");
assert.equal(dogClip("entering", 0.1, false, true)[0], "Idle", "barely moving: standing");
const [, fast] = dogClip("zoom", 20, false, true),
  [, slow] = dogClip("zoom", 1.8, false, true);
assert.ok(fast > slow && fast <= 1.9 && slow >= 0.7, "the legs keep up with the floor, within reason");

// 3) His model on the classic dog: the parts hidden, the mouth moved onto the head, a clip playing, the skeleton let go of.
const world = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, { headless: true });
{
  const scene = new THREE.Group(),
    head = new THREE.Bone();
  head.name = "Head";
  head.position.set(0, 0.8, 0.4);
  scene.add(head);
  const track = (name) =>
    new THREE.AnimationClip(name, 1, [new THREE.NumberKeyframeTrack("Head.position[y]", [0, 1], [0.8, 0.9])]);
  const clips = Object.fromEntries(DOG_CLIPS.map((n) => [n, track(n)]));
  useDogTemplate(scene, clips, clone);
  const g = dogObject(world),
    u = g.userData;
  assert.equal(attachDogModel(g), true);
  assert.equal(attachDogModel(g), false, "once");
  assert.ok(u.classicParts.length > 5 && u.classicParts.every((p) => !p.visible), "the balls hidden");
  assert.ok(u.shadow.visible !== false && u.hit, "the shadow and the click target kept");
  assert.equal(u.mouth.parent.parent.name, "Head", "what he carries rides on his head");
  playDog(u, "Run", 1.2, 0.1);
  assert.equal(u.dogModel.current, "Run");
  playDog(u, "Sniff", 1, 0.1);
  assert.equal(u.dogModel.current, "Sniff");
  dropDogModel(g);
  assert.equal(u.dogModel, null);
}

// 4) A macaw: both clips playing, eased between flapping and gliding.
{
  const scene = new THREE.Group(),
    wing = new THREE.Bone();
  wing.name = "WingL1";
  scene.add(wing);
  const clip = (name) =>
    new THREE.AnimationClip(name, 1, [new THREE.NumberKeyframeTrack("WingL1.rotation[z]", [0, 1], [0, 1])]);
  useMacawTemplates({ scarlet: { scene, clips: { Fly: clip("Fly"), Glide: clip("Glide") }, clone } });
  assert.equal(macawModel("bluegold"), null, "none for a bird not loaded");
  const m = macawModel("scarlet");
  for (let i = 0; i < 60; i++) flyMacaw(m, 0.05, 1);
  assert.ok(m.gliding > 0.95 && m.glide.getEffectiveWeight() > 0.95, "gliding");
  for (let i = 0; i < 60; i++) flyMacaw(m, 0.05, 0);
  assert.ok(m.fly.getEffectiveWeight() > 0.95, "flapping again");
}

// 5) The warm-up: one drawing with everything shown and nothing culled, the incidents' visitors in it, then all as it was.
{
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  hidden.visible = false;
  world.scene.add(hidden);
  const before = [];
  world.scene.traverse((o) => before.push([o, o.visible, o.frustumCulled]));
  let drawn = null;
  world.renderer = {
    info: { programs: [] },
    shadowMap: {},
    render(scene) {
      const seen = { hidden: 0, culled: 0, objects: 0, dogs: 0, figures: 0 };
      scene.traverse((o) => {
        seen.objects++;
        if (!o.visible) seen.hidden++;
        if (o.frustumCulled && (o.isMesh || o.isSprite)) seen.culled++;
        if (o.userData?.tongue && o.userData?.tail) seen.dogs++;
      });
      seen.shadows = this.shadowMap.needsUpdate;
      drawn = seen;
    },
  };
  world.incidentView.clearVisitors();
  world.resetActors?.();
  assert.equal(world.warmPending, true, "a new shift asks for it");
  world.warmShaders();
  assert.ok(drawn, "drawn once");
  assert.equal(drawn.hidden, 0, "every hidden thing shown for it");
  assert.equal(drawn.culled, 0, "nothing left out for being off screen");
  assert.ok(drawn.dogs >= 1, "the dog was there");
  assert.equal(drawn.shadows, true, "the shadows drawn too");
  assert.equal(
    world.warmed.cast >= 5,
    true,
    "one of each visitor (the dog, Carl, the fish kid, Karen, the bits)",
  );
  assert.equal(hidden.visible, false, "put back");
  for (const [o, visible, culled] of before) {
    assert.equal(o.visible, visible);
    assert.equal(o.frustumCulled, culled);
  }
  let count = 0;
  world.scene.traverse(() => count++);
  assert.equal(count, before.length, "the cast taken away again");
  assert.equal(world.renderer.shadowMap.needsUpdate, true, "the next frame redraws the shadows as they are");
}

// 6) Wired in.
{
  const app = readFileSync("dist/app.mjs", "utf8"),
    scene = readFileSync("dist/scene.mjs", "utf8"),
    view = readFileSync("dist/scene/incident-view.mjs", "utf8"),
    river = readFileSync("dist/scene/river.mjs", "utf8");
  assert.match(app, /river: \["Lazy River", \(\) => Promise\.all\(\[loadRiverClub\(\), loadMacaws\(\)\]\)/);
  assert.match(app, /if \(!tuning\.has\("nomodels"\)\) loadDog\(\);/, "the dog loads behind the menu");
  assert.match(
    view,
    /else loadKaren\(\)\.then\(\(gltf\) => gltf && again\(\)\);/,
    "Karen with the first shift's warm-up",
  );
  assert.match(scene, /this\.warmPending = true; \/\/ \(the first frame of the shift/);
  assert.match(scene, /if \(this\.warmPending\) \{\s*this\.warmPending = false;/);
  assert.match(view, /if \(!u\.dogModel && dogReady\(\) && !w\.headless\) attachDogModel\(g\);/);
  assert.match(view, /dropDogModel\(g\);/);
  assert.match(river, /b\.mac = macawModel\(b\.kind\);/);
  assert.match(river, /flyMacaw\(b\.mac, dt, glide/);
}
console.warn = quiet;

console.log(
  `Animal checks passed: the dog (${DOG_BONES.length} bones, ${DOG_CLIPS.join(", ")}) and the two macaws (Fly, Glide) as files, ${triangles} triangles in all; the dog's clip for what he does, his model on the classic dog with his mouth on his head; a macaw easing between flapping and gliding; the shift's warm-up drawing everything once, unseen, with every incident's visitors, and leaving the world as it was; and the game wired to it.`,
);
