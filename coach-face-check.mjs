// Coach Waters' face (scene/coach-face.mjs, the bones tools/blender/coach_face.py put in assets/coach-panic.glb): the
// expressions, the mood the game picks for him, and the driver on the file's own face bones (read from the file and built
// as three objects, without the mesh): every expression does what it says, the brows keep in front of a grown eye, the
// face blinks and glances when alive and holds still when asked, nothing outside the face is moved, and no clip keys a
// face bone (the face is the game's to drive, over any clip). The file has the three clips of trouble too.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "./dist/assets/three.module.js";
import {
  CoachFace,
  EXPRESSIONS,
  EXPRESSION_NAMES,
  NEUTRAL,
  coachMood,
  expressionFor,
} from "./dist/scene/coach-face.mjs";
import { CLIPS, HEAVY_JOBS } from "./dist/scene/coach-model.mjs";

// ---- the file -----------------------------------------------------------------------------------------------------
const bytes = readFileSync(new URL("./dist/assets/coach-panic.glb", import.meta.url));
const json = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
const nodes = json.nodes;
const faceIndex = nodes.findIndex((n) => n.name === "Face");
assert.ok(faceIndex >= 0, "the coach's file has a face");
const under = new Set();
(function walk(i) {
  under.add(i);
  for (const c of nodes[i].children || []) walk(c);
})(faceIndex);
assert.equal(under.size, 18, "eighteen face bones");
for (const a of json.animations)
  for (const ch of a.channels)
    assert.ok(
      !under.has(ch.target.node),
      `${a.name} keys ${nodes[ch.target.node].name}: the face is the game's to drive`,
    );
const names = json.animations.map((a) => a.name);
for (const key of ["startle", "haul", "freakOut"])
  assert.ok(names.includes(CLIPS[key]), `the file has ${CLIPS[key]}`);
assert.ok(HEAVY_JOBS.has("haul") && HEAVY_JOBS.has("help-out") && !HEAVY_JOBS.has("mop"), "the heavy jobs");

// The face's bones as three objects, under a head that the face must never move.
function build(i) {
  const n = nodes[i];
  const o = new THREE.Object3D();
  o.name = n.name;
  if (n.translation) o.position.fromArray(n.translation);
  if (n.rotation) o.quaternion.fromArray(n.rotation);
  if (n.scale) o.scale.fromArray(n.scale);
  if (n.extras) o.userData = n.extras;
  for (const c of n.children || []) o.add(build(c));
  return o;
}
function model() {
  const root = new THREE.Group();
  const head = new THREE.Object3D();
  head.name = "Head";
  root.add(head);
  head.add(build(faceIndex));
  return root;
}
const info = nodes[faceIndex].extras;
assert.ok(
  info.eyes.L.radius > 0.08 && info.eyes.R.radius > 0.08 && info.lidRest.length === 2,
  "the face's numbers",
);

// ---- the expressions ----------------------------------------------------------------------------------------------
for (const name of EXPRESSION_NAMES) {
  for (const key of Object.keys(EXPRESSIONS[name]))
    assert.ok(key in NEUTRAL || key === "L" || key === "R", `${name}: ${key} is not a number of the face`);
  for (const side of ["L", "R"]) {
    const e = expressionFor(name, side);
    for (const key of Object.keys(NEUTRAL)) assert.ok(key in e, `${name}: ${key} filled in`);
    assert.ok(e.lid > e.low, `${name}: the upper lid stays above the lower one`);
  }
}
assert.ok(EXPRESSION_NAMES.length >= 8, "neutral and the faces of trouble");

// ---- the mood ------------------------------------------------------------------------------------------------------
assert.equal(coachMood({}), "neutral");
assert.equal(coachMood({ moving: true }), "focus", "on his way somewhere");
assert.equal(
  coachMood({ slipping: true, startled: 0.1, struggling: true }),
  "dizzy",
  "down on a wet spot: dizzy before all",
);
assert.equal(coachMood({ startled: 0.4, struggling: true }), "alarm", "a new incident: the jolt");
assert.equal(coachMood({ startled: 2 }), "neutral", "…for a moment");
assert.equal(coachMood({ struggling: true, saved: 0.2 }), "struggle", "a heavy job");
assert.equal(coachMood({ saved: 0.5, urgency: 90 }), "relief", "a save");
assert.equal(coachMood({ failed: 1 }), "dismay", "something gone wrong");
assert.equal(coachMood({ urgency: 90 }), "panic", "something urgent, standing still");
assert.equal(coachMood({ urgency: 90, moving: true }), "worried", "…running to it");
assert.equal(coachMood({ urgency: 60 }), "worried");
assert.equal(coachMood({ urgency: 60, moving: true }), "focus");

// ---- the driver on the real bones ----------------------------------------------------------------------------------
const seeded =
  (seed = 7) =>
  () =>
    ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
{
  const root = model();
  const head = root.getObjectByName("Head");
  head.position.set(1, 2, 3);
  const face = new CoachFace(root, seeded());
  assert.ok(face.ok, "the driver finds every face bone");
  assert.ok(!("Head" in face.bones), "and only the face's");
  const bone = (n) => root.getObjectByName(n);
  const rest = {};
  root.traverse(
    (o) => (rest[o.name] = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }),
  );
  const pose = (name) => {
    face.reset();
    face.set(name, true);
    face.update(0, { still: true });
  };
  const angle = (n) => (2 * Math.acos(Math.min(1, Math.abs(bone(n).quaternion.w))) * 180) / Math.PI;

  pose("neutral");
  for (const [n, r] of Object.entries(rest)) {
    const o = bone(n);
    assert.ok(
      o.position.distanceTo(r.p) < 1e-6 && o.scale.distanceTo(r.s) < 1e-6,
      `neutral leaves ${n} at rest`,
    );
    assert.ok(Math.abs(o.quaternion.dot(r.q)) > 1 - 1e-6, `neutral leaves ${n} unturned`);
  }

  pose("panic");
  assert.ok(bone("EyeL").scale.x >= 1.2 && bone("EyeR").scale.y >= 1.2, "panic: the eyes wide open");
  assert.ok(bone("PupilL").scale.x <= 0.5, "…the pupils pinpoints");
  assert.ok(bone("BrowInL").position.y > rest.BrowInL.p.y + 0.012, "…the brows up at the middle");
  // the brows are pushed out in front of the grown eye balls
  for (const side of ["L", "R"]) {
    const e = info.eyes[side];
    const front = e.centre[2] + e.radius * ((bone("Eye" + side).scale.x + bone("Eye" + side).scale.y) / 2);
    const brow = bone("BrowIn" + side)
      .position.clone()
      .add(bone("Face").position);
    assert.ok(brow.z > rest["BrowIn" + side].p.z - 1e-9, `${side}: the brow comes forward, never back`);
    assert.ok(front > e.centre[2], "(the eye's front)");
  }
  assert.ok(head.position.equals(new THREE.Vector3(1, 2, 3)), "the head is not the face's to move");

  pose("struggle");
  assert.ok(angle("LidL") > 55 && angle("LidLowL") > 45, "struggle: the lids screwed down and up");
  assert.ok(angle("LidL") > angle("LidR"), "…one eye tighter than the other");
  assert.ok(bone("BrowInL").position.y < rest.BrowInL.p.y - 0.008, "…the brows down at the middle");
  assert.ok(bone("BrowInL").position.x < rest.BrowInL.p.x, "…and squeezed together");

  pose("dizzy");
  assert.ok(Math.abs(angle("LidL") - angle("LidR")) > 15, "dizzy: lopsided lids");
  pose("alarm");
  assert.ok(
    bone("EyeL").scale.x > 1.2 && angle("StacheL") > 10,
    "alarm: popped eyes, the moustache's ends up",
  );
  pose("dismay");
  assert.ok(bone("Stache").position.y < rest.Stache.p.y, "dismay: the moustache sags");

  // still: the shaking of a panic holds
  pose("panic");
  const a = bone("LookL").quaternion.clone();
  face.update(0.37, { still: true });
  assert.ok(Math.abs(a.dot(bone("LookL").quaternion)) > 1 - 1e-9, "still: no shaking");
  // alive: it shakes, and in a minute at ease he blinks and glances about
  face.update(0.37);
  face.update(0.05);
  assert.ok(Math.abs(a.dot(bone("LookL").quaternion)) < 1 - 1e-7, "alive, the pupils shake in a panic");
  face.set("neutral");
  let blinked = false,
    glanced = false;
  for (let i = 0; i < 3600; i++) {
    face.update(1 / 60);
    if (angle("LidL") > 120) blinked = true;
    if (angle("LookL") > 3) glanced = true;
  }
  assert.ok(blinked && glanced, "at ease he blinks and glances about");
  // eased: a new expression takes a few frames, a fright fewer
  face.reset();
  face.set("neutral", true);
  face.update(1 / 60, { mood: "struggle", still: true });
  const step = angle("LidL");
  assert.ok(step > 1 && step < 50, `an expression eases in (${step.toFixed(1)}°)`);
  face.reset();
  face.set("neutral", true);
  face.update(1 / 60, { mood: "alarm", still: true });
  const jolt = bone("EyeL").scale.x - 1;
  assert.ok(jolt > 0.06, `a fright comes at once (a third of the way in one frame) (${jolt.toFixed(2)})`);
}
{
  // An old file (no face bones): nothing to drive, nothing breaks.
  const root = new THREE.Group();
  const face = new CoachFace(root);
  assert.equal(face.ok, false);
  face.update(0.1, { mood: "panic" });
  face.reset();
}
console.log(
  `Coach face checks passed: 18 face bones that no clip keys, ${EXPRESSION_NAMES.length} expressions (each one doing what it says on the real bones), the mood from what is happening to him, blinks and glances when alive and stillness when asked, the head left alone, and the three clips of trouble in the file.`,
);
