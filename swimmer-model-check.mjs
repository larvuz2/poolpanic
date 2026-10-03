// The generic swimmers in the game (scene/swimmer-models.mjs): which look is chosen, which swimmers get a model, the rules
// that pick the clip, how the poses set on the classic limbs reach the model's bones, and swapping the models in and out
// of the scene (with a stand-in model that has the real model's bone names).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { PoolSimulation, loopPosition, swimmerLook } from "./dist/sim.mjs";
import {
  CLIPS,
  FIGURES,
  SWIMMERS,
  SwimmerRig,
  attachSwimmerModel,
  chooseSwimmers,
  dropSwimmerModel,
  figureReady,
  lookFor,
  swimmerChoice,
  swimmerModelsReady,
  useFigureTemplates,
  useSwimmerTemplates,
  wantsModel,
} from "./dist/scene/swimmer-models.mjs";
import { CLIP, SETTLE, figurePose } from "./dist/scene/figure-pose.mjs";
import { CARL_TUNING as T } from "./dist/incidents/carl.mjs";

// ---- which swimmers -----------------------------------------------------------------------------------------------
const store = (initial = {}) => ({
  data: { ...initial },
  getItem(k) {
    return k in this.data ? this.data[k] : null;
  },
  setItem(k, v) {
    this.data[k] = String(v);
  },
  removeItem(k) {
    delete this.data[k];
  },
});
{
  const s = store();
  assert.equal(swimmerChoice("", s), "models", "the swimmer characters are the default");
  assert.equal(swimmerChoice("?swimmers=classic", s), "classic");
  assert.equal(swimmerChoice("?debug", s), "classic", "the classic swimmers are remembered on the device");
  assert.equal(swimmerChoice("?swimmers=models", s), "models");
  assert.equal(swimmerChoice("", s), "models", "asking for the characters forgets the classic choice");
  assert.equal(
    swimmerChoice("?swimmers=nonsense", store({ "pool-panic.swimmers.v1": "classic" })),
    "classic",
  );
  const broken = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(swimmerChoice("", broken), "models", "blocked storage still gives the default");
  assert.equal(swimmerChoice("?swimmers=classic", broken), "classic");
}
assert.equal(SWIMMERS.length, 5, "five generic swimmers");
assert.equal(new Set(SWIMMERS.map((s) => s.id)).size, 5);
for (const look of SWIMMERS) {
  assert.ok(look.run > look.walk * 2 && look.walk > 0.5, `${look.id}: a run covers more ground than a walk`);
  assert.ok(look.eyes[0] > 1.2 && look.eyes[1] > 0.1, `${look.id}: the eye line is on the head`);
}
assert.ok(!swimmerModelsReady(), "nothing is loaded before the models are");

// ---- a stand-in model: a T-pose skeleton with the real bone names, no mesh -----------------------------------------
// Each bone's local frame has its own +Y along the bone (as in the real rig), so an arm bone's rest turns +Y to +x or -x.
function standIn(height = 1.7, mount = false) {
  const scene = new THREE.Group();
  const armature = new THREE.Group();
  armature.name = "Armature";
  scene.add(armature);
  const bone = (name, parent, x, y, z, q) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (q) b.quaternion.copy(q);
    parent.add(b);
    return b;
  };
  const turn = (deg) =>
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (deg * Math.PI) / 180);
  const hips = bone("Hips", armature, 0, height * 0.5, 0);
  const s2 = bone("Spine02", hips, 0, height * 0.06, 0);
  const s1 = bone("Spine01", s2, 0, height * 0.06, 0);
  const sp = bone("Spine", s1, 0, height * 0.06, 0);
  const neck = bone("neck", sp, 0, height * 0.08, 0);
  const head = bone("Head", neck, 0, height * 0.04, 0);
  bone("head_end", head, 0, height * 0.2, 0);
  for (const [side, sign] of [
    ["Left", 1],
    ["Right", -1],
  ]) {
    const shoulder = bone(side + "Shoulder", sp, sign * 0.04, height * 0.05, 0, turn(-90 * sign));
    const arm = bone(side + "Arm", shoulder, 0, 0.1, 0);
    const fore = bone(side + "ForeArm", arm, 0, 0.3, 0);
    bone(side + "Hand", fore, 0, 0.25, 0);
    const up = bone(side + "UpLeg", hips, sign * 0.08, -0.04, 0, turn(180));
    const leg = bone(side + "Leg", up, 0, 0.4, 0);
    const foot = bone(side + "Foot", leg, 0, 0.4, 0);
    bone(side + "ToeBase", foot, 0, 0.1, 0.1);
  }
  if (mount) {
    const m = new THREE.Object3D();
    m.name = "BucketMount";
    sp.add(m);
    const bucket = new THREE.Group(); // (the file's own bucket: a mesh under the node the clips move)
    bucket.name = "Bucket";
    bucket.userData.height = 0.28;
    m.add(bucket);
  }
  const clips = Object.fromEntries(
    Object.values(CLIPS).map((name) => [name, new THREE.AnimationClip(name, 6, [])]),
  );
  return { scene, clips, clone: (g) => g.clone() };
}
useSwimmerTemplates(Object.fromEntries(SWIMMERS.map((look, i) => [look.id, standIn(1.55 + i * 0.07)])));
assert.ok(swimmerModelsReady(), "the stand-ins are in");

// ---- who gets which model ----------------------------------------------------------------------------------------------
{
  const seen = new Set(Array.from({ length: 5 }, (_, skin) => lookFor({ skin }).id));
  assert.equal(seen.size, 5, "the five skin numbers give the five looks");
  assert.equal(
    lookFor({ skin: 3 }).id,
    lookFor({ skin: 3 }).id,
    "the same swimmer is always the same character",
  );
  assert.ok(
    wantsModel({ type: "beginner" }) && wantsModel({ type: "daredevil", vip: true }),
    "swimmers of every type",
  );
  assert.ok(!wantsModel({ type: "kid", visitor: true }), "not the fish kid");
  assert.ok(!wantsModel({ type: "advanced", carl: true }), "not Carl in the queue");
  assert.ok(!wantsModel({ type: "dog" }), "not the dog");
}

// ---- the clip rules, with stand-in actions -----------------------------------------------------------------------------
function fakeRig(look = SWIMMERS[1]) {
  const log = [];
  const action = (name) => ({
    name,
    time: 0,
    rate: 1,
    playing: false,
    reset() {
      this.time = 0;
      return this;
    },
    play() {
      this.playing = true;
      log.push("play " + name);
    },
    stop() {
      this.playing = false;
    },
    setEffectiveWeight() {},
    setEffectiveTimeScale(v) {
      this.rate = v;
    },
    crossFadeFrom() {
      log.push("fade to " + name);
    },
    getClip: () => ({ duration: 6 }),
  });
  const actions = {
    idle: action("idle"),
    scratch: action("scratch"),
    walk: action("walk"),
    run: action("run"),
    panic: action("panic"),
    swim: action("swim"),
    cannonball: action("cannonball"),
    carry: action("carry"),
    carryWalk: action("carryWalk"),
    carryRun: action("carryRun"),
    dump: action("dump"),
  };
  const mixer = {
    advanced: 0,
    update(dt) {
      this.advanced += dt;
      // (The Cannonball is scrubbed, not played: its rate is zero.)
      for (const a of Object.values(actions))
        if (a.playing) a.time += a.name === "cannonball" || a.name === "dump" ? dt * a.rate : dt;
    },
  };
  return { rig: new SwimmerRig(mixer, actions, look), actions, mixer, log, look };
}
const run = (rig, frames, state) => {
  for (let i = 0; i < frames; i++) rig.update(1 / 60, state);
};
{
  const { rig, actions, look } = fakeRig();
  assert.equal(rig.current, "idle", "a swimmer starts standing");
  run(rig, 5, { speed: 0 });
  assert.equal(rig.current, "idle");
  run(rig, 40, { speed: 1.4 });
  assert.equal(rig.current, "walk", "a stroll is the walk");
  assert.ok(
    Math.abs(actions.walk.rate - 1.4 / look.walk) < 0.06,
    `at the pace that keeps the feet still (${actions.walk.rate})`,
  );
  run(rig, 40, { speed: 3.3 });
  assert.equal(rig.current, "run", "the brisk pace the swimmers walk to their lane at is the run");
  assert.ok(
    Math.abs(actions.run.rate - 3.3 / look.run) < 0.06,
    `and it keeps the feet still too (${actions.run.rate})`,
  );
  run(rig, 40, { speed: 2.2 });
  assert.equal(rig.current, "run", "a dip between the two paces does not flicker (hysteresis)");
  run(rig, 40, { speed: 1.2 });
  assert.equal(rig.current, "walk", "slowing is the walk again");
  run(rig, 3, { speed: 0.5 });
  assert.equal(rig.current, "walk", "a dip in speed does not flicker to idle");
  run(rig, 60, { speed: 0 });
  assert.equal(rig.current, "idle", "stopping is idle");
  // Swimming: the crawl (the swimmer is laid on its front by the world sync), at the stroke the world sync asks for.
  run(rig, 5, { swim: true, stroke: 0.6 });
  assert.equal(rig.current, "swim", "swimming plays the Swim clip");
  run(rig, 40, { swim: true, stroke: 0.6 });
  assert.ok(Math.abs(actions.swim.rate - 0.6) < 0.05, `at the stroke rate (${actions.swim.rate})`);
  run(rig, 40, { swim: true, stroke: 1.4 });
  assert.ok(Math.abs(actions.swim.rate - 1.4) < 0.05, `which can change (${actions.swim.rate})`);
  run(rig, 40, { speed: 0 });
  assert.equal(rig.current, "idle", "out of the water it stands");
}
{
  // A model without the Swim clip swims with the Run clip.
  const { rig, actions } = fakeRig();
  delete rig.actions.swim;
  run(rig, 5, { swim: true, stroke: 0.8 });
  assert.equal(rig.current, "run", "without a Swim clip the swim is the run");
  run(rig, 40, { swim: true, stroke: 0.8 });
  assert.ok(Math.abs(actions.run.rate - 0.8) < 0.05, "at the stroke rate");
}
{
  // Panic: the clip for hopping on the spot with the hands up; swimming comes first, and a model without it ignores it.
  const { rig, actions } = fakeRig();
  run(rig, 5, { speed: 0 });
  run(rig, 5, { panic: true });
  assert.equal(rig.current, "panic", "a panicking swimmer plays the Panic clip");
  assert.ok(
    actions.panic.time >= 0 && actions.panic.time < 6,
    "from some moment of it (a crowd does not hop in step)",
  );
  run(rig, 30, { panic: true });
  assert.equal(rig.current, "panic");
  run(rig, 30, { panic: false });
  assert.equal(rig.current, "idle", "calming down is standing again");
  run(rig, 10, { panic: true, swim: true, stroke: 1 });
  assert.equal(rig.current, "swim", "in the water it swims, panic or not");
  const times = new Set();
  for (let i = 0; i < 12; i++) {
    const other = fakeRig().rig;
    run(other, 3, { panic: true });
    times.add(Math.round(other.actions.panic.time * 100));
  }
  assert.ok(
    times.size > 6,
    `the swimmers start their hops at different moments (${times.size} different of 12)`,
  );
  const without = fakeRig();
  delete without.rig.actions.panic;
  run(without.rig, 10, { panic: true });
  assert.equal(without.rig.current, "idle", "a model without the Panic clip stays with its poses");
}
{
  // The slowest and the quickest of the five keep their own feet still at the same speed.
  const slow = fakeRig(SWIMMERS.find((s) => s.id === "heavy-man"));
  const quick = fakeRig(SWIMMERS.find((s) => s.id === "tall-woman"));
  run(slow.rig, 60, { speed: 4.5 });
  run(quick.rig, 60, { speed: 4.5 });
  assert.ok(
    slow.actions.run.rate > quick.actions.run.rate + 0.3,
    "the short-legged swimmer's clip plays faster to cover the same ground",
  );
}
{
  // Standing long enough brings a head scratch; moving does not.
  const { rig, actions } = fakeRig();
  rig.scratchAfter = 1;
  rig.idleFor = 0;
  run(rig, 130, { speed: 0 });
  assert.equal(rig.current, "scratch", "after a while the swimmer scratches their head");
  assert.ok(rig.scratchAfter > 1, "and waits longer the next time");
  run(rig, 1, { speed: 0 });
  assert.equal(rig.current, "scratch", "the scratch plays out");
  actions.scratch.time = 5.8;
  run(rig, 1, { speed: 0 });
  assert.equal(rig.current, "idle", "then settles back into the scan");
  rig.scratchAfter = 0.05;
  run(rig, 10, { speed: 0 });
  assert.equal(rig.current, "scratch");
  run(rig, 10, { speed: 4 });
  assert.equal(rig.current, "run", "moving ends a scratch at once");
}
{
  // A queue does not scan and scratch in step.
  const times = new Set();
  for (let i = 0; i < 12; i++) times.add(fakeRig().actions.idle.time.toFixed(3));
  assert.ok(times.size > 6, "every swimmer starts the scan at its own point");
}

// ---- in the scene, with stand-in models ---------------------------------------------------------------------------------
const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { PoolWorld } = await import("./dist/scene.mjs");
const { character } = await import("./dist/scene/actors.mjs");
useSwimmerTemplates({});
chooseSwimmers("models");
const world = new PoolWorld({ clientWidth: 1200, clientHeight: 800 }, () => {}, { headless: true });
const sim = new PoolSimulation(5, 77);
sim.start({ countdown: false });
for (let i = 0; i < 60 * 30; i++) sim.tick(1 / 60);
let t = 0;
world.resetActors();
world.sync(sim, t, 1 / 60);
assert.ok(world.people.size > 0, "there are swimmers");
for (const g of world.people.values())
  assert.equal(g.userData.rig, undefined, "without the models every swimmer is classic");

useSwimmerTemplates(Object.fromEntries(SWIMMERS.map((look, i) => [look.id, standIn(1.55 + i * 0.07)])));
world.swapSwimmers();
world.sync(sim, (t += 1 / 60), 1 / 60);
assert.ok(world.people.size > 0);
for (const g of world.people.values()) {
  const u = g.userData;
  assert.ok(u.rig && u.model && u.look, "every swimmer is a character now");
  assert.ok(u.root.children.includes(u.model), "the model stands in the swimmer's root");
  assert.ok(u.classic.length > 5 && u.classic.every((part) => !part.visible), "the classic parts are hidden");
  assert.ok(
    u.legs.every((leg) => !leg.visible),
    "and stay hidden, legs too, through the world sync",
  );
  assert.ok(u.head.position.y > 1.3, "the head the dizzy stars look for is on the model");
}
assert.ok(
  new Set([...world.people.values()].map((g) => g.userData.look.id)).size > 1,
  "the swimmers are not all the same character",
);
// The suit on a model is its own, so the type shows in the disc under the feet instead.
for (const [id, g] of world.people) {
  const p = sim.people.find((q) => q.id === id);
  const disc = g.userData.shadow.material;
  assert.equal(
    disc.color.getHexString(),
    new THREE.Color(swimmerLook(p).color).getHexString(),
    "the disc under " + p.name + " wears the colour of the type",
  );
  assert.ok(disc.opacity > 0.3, "and it can be seen");
}
{
  // Karen is near: a model covers its ears with its arms (the classic arms' pose, copied onto its bones for as long as they are
  // up: the puppet), and goes back to its clip when she has gone.
  const p = sim.people.find((q) => q.status !== "swim" && world.people.get(q.id)?.userData.rig);
  assert.ok(p, "someone is out of the water");
  const u = world.people.get(p.id).userData;
  p.karenAnnoyed = 5;
  for (let i = 0; i < 30; i++) world.sync(sim, (t += 1 / 60), 1 / 60);
  assert.ok(
    u.annoy > 0.5 && u.puppet.arms && u.rig.weights.arms > 0.5,
    "near Karen a swimmer covers the ears",
  );
  p.karenAnnoyed = 0;
  for (let i = 0; i < 90; i++) world.sync(sim, (t += 1 / 60), 1 / 60);
  assert.ok(
    !u.puppet.arms && u.annoy < 0.01 && u.rig.weights.arms < 0.05,
    "and goes back to the clip when she has gone",
  );
}
{
  // Fins stay a swimmer's own, a VIP keeps the crown and sash, a daredevil the star and cape.
  const [first] = world.people.values();
  assert.ok(first.userData.root.children.includes(first.userData.f), "the fins are still there to show");
  const vip = character(world, { type: "intermediate", vip: true, skin: 2, id: 99 });
  assert.ok(
    attachSwimmerModel(vip, { type: "intermediate", vip: true, skin: 2 }),
    "a VIP is a character too",
  );
  assert.ok(vip.userData.crown.visible && vip.userData.sash.visible, "with the crown and sash");
  {
    // They ride on the body: a hop that lifts the hips lifts the crown, the sash and the face with it.
    const m = vip.userData.mounts;
    assert.equal(m.head.parent.name, "Head", "the crown is on the head bone");
    assert.equal(m.chest.parent.name, "Spine", "the sash on the chest bone");
    assert.equal(vip.userData.crown.parent, m.head);
    assert.equal(vip.userData.sash.parent, m.chest);
    const worldY = (o) => o.getWorldPosition(new THREE.Vector3()).y;
    vip.updateMatrixWorld(true);
    const before = [vip.userData.crown, vip.userData.sash, vip.userData.soreEyes].map(worldY);
    vip.userData.model.getObjectByName("Hips").position.y += 0.3;
    vip.updateMatrixWorld(true);
    const after = [vip.userData.crown, vip.userData.sash, vip.userData.soreEyes].map(worldY);
    for (const [i, name] of ["crown", "sash", "sore eyes"].entries())
      assert.ok(
        after[i] - before[i] > 0.25,
        `the ${name} went up with the hips (${(after[i] - before[i]).toFixed(2)} m)`,
      );
  }
  assert.equal(
    vip.userData.shadow.material.color.getHexString(),
    new THREE.Color("#e9a92b").getHexString(),
    "and a gold disc",
  );
  assert.ok(vip.userData.crown.scale.x < 1 && vip.userData.crown.scale.x > 0.3, "sized for the model's head");
  const dare = character(world, { type: "daredevil", skin: 1, id: 98 });
  attachSwimmerModel(dare, { type: "daredevil", skin: 1 });
  assert.ok(dare.userData.star.visible && dare.userData.cape.visible, "a daredevil keeps the star and cape");
  const carl = character(world, { type: "advanced", carl: true, skin: 0, id: 97 });
  assert.equal(attachSwimmerModel(carl, { type: "advanced", carl: true, skin: 0 }), null, "Carl stays Carl");
  assert.equal(
    attachSwimmerModel(vip, { type: "intermediate", skin: 0 }, "classic"),
    null,
    "the classic choice stays classic",
  );
  dropSwimmerModel(vip);
  assert.equal(
    vip.userData.crown.parent,
    vip.userData.root,
    "a dropped model gives the crown back to the swimmer",
  );
  assert.equal(vip.userData.sash.parent, vip.userData.root);
  assert.ok(!vip.userData.mounts, "and the mounts go");
}

// ---- the poses laid over the clips -------------------------------------------------------------------------------------
// The classic arm hangs from the shoulder and a rotation swings it; the model's arm bone, put on the same rotation, must point
// where the classic arm does, as straight as it does.
{
  const body = character(world, { type: "intermediate", skin: 2, id: 500 });
  const rig = attachSwimmerModel(body, { type: "intermediate", skin: 2 });
  const u = body.userData;
  const bone = (name) => u.model.getObjectByName(name);
  const settle = (puppet) => {
    for (let i = 0; i < 90; i++) rig.update(1 / 60, { puppet, classic: u });
    u.model.updateMatrixWorld(true);
  };
  const point = (from, to) =>
    bone(to)
      .getWorldPosition(new THREE.Vector3())
      .sub(bone(from).getWorldPosition(new THREE.Vector3()))
      .normalize();
  const hangs = point("LeftArm", "LeftForeArm");
  assert.ok(hangs.x > 0.99, "the stand-in's arms start out in a T-pose");
  // Hands up and in (a panic), then swung forward, then out: each as the classic arm points.
  for (const [x, y, z, label] of [
    [0, 0, 2.7, "up and in"],
    [-1.2, 0, 0.2, "swung forward"],
    [0.4, 0, -1.3, "out and down"],
  ]) {
    u.arms[0].rotation.set(x, y, z);
    u.arms[1].rotation.set(x, y, -z);
    settle({ arms: true, legs: false });
    for (const [i, side] of [
      [0, "Right"],
      [1, "Left"],
    ]) {
      const want = new THREE.Vector3(0, -1, 0).applyEuler(u.arms[i].rotation);
      const got = point(side + "Arm", side + "ForeArm");
      assert.ok(
        got.dot(want) > 0.995,
        `the ${side.toLowerCase()} arm points ${label} (${got.toArray().map((v) => v.toFixed(2))} not ${want.toArray().map((v) => v.toFixed(2))})`,
      );
      assert.ok(point(side + "ForeArm", side + "Hand").dot(got) > 0.995, `${label}: the arm is straight`);
    }
  }
  // Legs: sitting, legs straight forward.
  u.legs.forEach((leg) => leg.rotation.set(-Math.PI / 2, 0, 0));
  settle({ arms: false, legs: true });
  for (const side of ["Right", "Left"]) {
    const got = point(side + "UpLeg", side + "Leg");
    assert.ok(
      got.z > 0.995,
      `the ${side.toLowerCase()} leg points forward when sitting (${got.toArray().map((v) => v.toFixed(2))})`,
    );
    assert.ok(point(side + "Leg", side + "Foot").dot(got) > 0.995, "the knee is straight");
  }
  // The pose eases in rather than snapping: a few frames after being asked for, the arm is on its way.
  const slow = attachSwimmerModel(character(world, { type: "intermediate", skin: 3, id: 501 }), {
    type: "intermediate",
    skin: 3,
  });
  assert.ok(slow.weights.arms === 0, "no pose before it is asked for");
  slow.update(1 / 60, {
    puppet: { arms: true, legs: false },
    classic: slow.body && {
      arms: [new THREE.Group(), new THREE.Group()],
      legs: [new THREE.Group(), new THREE.Group()],
    },
  });
  assert.ok(slow.weights.arms > 0 && slow.weights.arms < 0.5, `it eases in (${slow.weights.arms})`);
  for (let i = 0; i < 90; i++)
    slow.update(1 / 60, {
      puppet: { arms: false, legs: false },
      classic: { arms: [new THREE.Group(), new THREE.Group()], legs: [new THREE.Group(), new THREE.Group()] },
    });
  assert.ok(slow.weights.arms < 0.01, "and out");
}

// The world sync tells the rig what the swimmer is doing.
const someone = sim.people.find((p) => p.status !== "gone");
const g = world.people.get(someone.id);
const u = g.userData;
const step = (n = 1) => {
  for (let i = 0; i < n; i++) world.sync(sim, (t += 1 / 60), 1 / 60);
};
Object.assign(someone, {
  status: "queue",
  problem: null,
  stomachWarning: false,
  slipTime: 0,
  exitPhase: null,
});
step(30);
assert.equal(u.rig.current, "idle", "a swimmer in the queue stands");
assert.ok(!u.puppet.arms && !u.puppet.legs, "on the clips");
someone.status = "panic";
step(2);
assert.equal(u.rig.current, "panic", "a swimmer panicking on the deck plays the Panic clip");
assert.ok(!u.puppet.arms && !u.puppet.legs, "which is the whole body: no classic pose on top of it");
assert.equal(u.root.position.y, 0, "and the swimmer is not hopped as a whole, the clip hops");
{
  // With reduced motion the swimmer stands with its hands up, like the classic one.
  const real = world.reducedMotion;
  world.reducedMotion = { matches: true };
  step(2);
  assert.notEqual(u.rig.current, "panic", "reduced motion has no hopping");
  assert.ok(u.puppet.arms && u.puppet.legs, "the hands-up pose is copied onto the model");
  assert.equal(u.root.position.y, 0);
  world.reducedMotion = real;
}
someone.status = "queue";
someone.stomachWarning = true;
step(2);
assert.ok(u.puppet.arms && !u.puppet.legs, "a hand to the stomach is an arm pose");
someone.stomachWarning = false;
someone.slipTime = 0.3;
step(2);
assert.ok(u.puppet.arms && u.puppet.legs, "a slip lays the model down with the classic limbs' pose");
someone.slipTime = 0;
step(2);
assert.ok(!u.puppet.arms && !u.puppet.legs, "and the clips come back");
someone.status = "swim";
someone.lane = 1;
someone.actualSpeed = 2;
someone.p = 3;
step(2);
assert.equal(u.rig.current, "swim", "a swimmer in the water plays the crawl");
assert.ok(Math.abs(u.root.rotation.x - Math.PI / 2) < 1e-6, "on its front");
assert.ok(
  Math.abs(u.root.position.z + 0.65 * u.fit) < 1e-6,
  `and set back by its own length (${u.root.position.z})`,
);
someone.status = "recovering";
someone.recoveryStage = "resting";
step(2);
assert.ok(u.puppet.arms && u.puppet.legs, "resting on the bench is a pose");
assert.ok(
  Math.abs(g.position.y - (0.22 + 0.45 - u.hipsY)) < 1e-6,
  "with the hips where the classic swimmer's are",
);
someone.status = "queue";
someone.recoveryStage = null;
someone.queasy = true;
step(2);
assert.ok(u.sick, "a queasy swimmer takes the green tint");
someone.queasy = false;
step(2);
assert.ok(!u.sick, "and loses it");

// A model that breaks falls back to the classic swimmer without stopping the shift.
const quiet = console.error;
console.error = () => {};
u.rig.update = () => {
  throw new Error("broken clip");
};
step(1);
console.error = quiet;
assert.equal(world.people.get(someone.id).userData.rig, null, "the broken model is let go");
assert.ok(
  u.classic.every((part) => part.visible || part === u.carry || part === u.f),
  "the classic swimmer shows again",
);
assert.ok(
  u.shadow.material.opacity < 0.2 && u.shadow.material.color.getHexString() === "2a5d62",
  "and the plain shadow with it",
);
dropSwimmerModel(g); // dropping twice is harmless

// Choosing the classic swimmers builds everyone again, as classic.
chooseSwimmers("classic");
world.swapSwimmers();
step(1);
for (const p of world.people.values())
  assert.equal(p.userData.rig, undefined, "classic swimmers, all of them");
chooseSwimmers("models");

// ---- the cannonball men: Carl and the leopard man -----------------------------------------------------------------------
assert.deepEqual(
  FIGURES.map((f) => f.id),
  ["carl", "leopard", "kid"],
  "Carl, the leopard man and the fish kid",
);
for (const look of FIGURES.filter((f) => f.id !== "kid")) {
  assert.ok(look.run > look.walk * 2 && look.walk > 0.5, `${look.id}: a run covers more ground than a walk`);
  assert.ok(look.eyes[0] > 1.2 && look.eyes[1] > 0.1, `${look.id}: the eye line is on the head`);
  assert.ok(look.depth > 0.3, `${look.id}: a belly's depth`);
  assert.ok(existsSync(`dist/assets/${look.file}`), `${look.id}: the model is in the game's assets`);
}
{
  // Anim Bench shows the very files the game loads, and its manifest holds the take-off and the splash the game plays to.
  const manifest = JSON.parse(readFileSync("tools/viewer/characters.json", "utf8")).characters;
  for (const [look, id] of [
    [FIGURES[0], "carl"],
    [FIGURES[1], "leopard-man"],
  ]) {
    const entry = manifest.find((c) => c.id === id);
    assert.ok(entry.file.endsWith("dist/assets/" + look.file), `${id}: the same file in the viewer`);
    assert.deepEqual(
      [entry.clips.Cannonball.water.run.from, entry.clips.Cannonball.water.run.to],
      [CLIP.takeoff, CLIP.splash],
      `${id}: the take-off and the splash frames are the clip's`,
    );
  }
}
assert.ok(!figureReady("carl"), "no cannonball man is loaded before he is asked for");
assert.equal(lookFor({ figure: "carl" }), null, "so none is drawn");

// How he is posed through the incident, from the simulation's own state: one continuous run through the Cannonball clip.
{
  const f = 1 / CLIP.fps;
  const at = (status, left) => figurePose({ status, timer: left });
  const near = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-9, `${why} (${a} and ${b})`);
  assert.equal(figurePose({ status: "walking", timer: 0 }).jump ?? null, null, "he walks in as a walk");
  assert.equal(figurePose({ status: "running", timer: 0 }).jump ?? null, null);
  near(at("windup", T.windup).jump, 0, "the wind-up starts at the clip's first frame");
  near(at("windup", 0).jump, CLIP.down * f, "and ends at the bottom of the crouch");
  near(at("charge", T.charge).jump, CLIP.down * f, "the charge goes on from there");
  near(at("charge", 0).jump, CLIP.takeoff * f, "to the take-off");
  near(at("flying", T.flight).jump, CLIP.takeoff * f, "the flight starts at the take-off");
  near(at("flying", 0).jump, CLIP.splash * f, "and ends at the splash, when the simulation says it does");
  assert.ok(
    at("windup", T.windup).at === "edge" && at("charge", 0).at === "edge" && !at("flying", T.flight).at,
    "he crouches at the edge, and is carried over the water",
  );
  let last = -1;
  for (const [status, span] of [
    ["windup", T.windup],
    ["charge", T.charge],
    ["flying", T.flight],
  ])
    for (let i = 0; i <= 20; i++) {
      const j = at(status, span * (1 - i / 20)).jump;
      assert.ok(j >= last - 1e-9, `the clip only goes forward (${status} ${i}: ${j})`);
      last = j;
    }
  // In the water: the swim, from the splash until he is out; he settles onto his front just after it and stands to climb.
  const floating = at("floating", T.float);
  assert.ok(
    floating.swim && floating.lie === 0 && floating.jump == null,
    "the swim starts at the splash, upright",
  );
  near(at("floating", T.float - SETTLE).lie, 1, "and he is on his front a moment later");
  assert.ok(at("floating", T.float - SETTLE / 2).lie > 0 && at("floating", T.float - SETTLE / 2).lie < 1);
  assert.ok(at("swimming", 0).swim && at("swimming", 0).lie === 1, "he swims to the wall");
  const climb = at("climbing", T.climb);
  assert.ok(
    !climb.swim && climb.lie === 1 && climb.puppet,
    "he starts the climb on his front, with the climbing pose",
  );
  near(at("climbing", 0).lie, 0, "and is upright when it is done");
  assert.ok(!at("running", 0).swim && at("running", 0).lie === 0, "out of the water he runs");
}

// The rig: the Cannonball clip is set to where the incident is in it, and the swim takes over after the splash.
{
  const { rig, actions } = fakeRig(FIGURES[0]);
  run(rig, 40, { speed: 3.4 });
  assert.equal(rig.current, "run", "he runs in");
  rig.update(1 / 60, { jump: 0.4 });
  assert.equal(rig.current, "cannonball", "the jump is the Cannonball clip");
  assert.equal(actions.cannonball.rate, 0, "which does not run by itself");
  assert.equal(actions.cannonball.time, 0.4, "it is set to where the incident is in it");
  rig.update(1 / 60, { jump: 0.9, speed: 5 });
  assert.equal(actions.cannonball.time, 0.9, "and follows it, whatever his speed");
  rig.update(0, { jump: 1.5 });
  assert.equal(actions.cannonball.time, 1.5, "also in a hit-stop");
  rig.update(1 / 60, { swim: true, stroke: 0.7 });
  assert.equal(rig.current, "swim", "after the splash he swims");
  run(rig, 40, { swim: true, stroke: 0.7 });
  assert.ok(Math.abs(actions.swim.rate - 0.7) < 0.05, "at his stroke");
  run(rig, 40, { speed: 0 });
  assert.equal(rig.current, "idle", "out of the water he stands");
  // A model without the clip (any of the five swimmers) ignores it.
  const plain = fakeRig();
  delete plain.rig.actions.cannonball;
  run(plain.rig, 5, { jump: 0.5 });
  assert.notEqual(plain.rig.current, "cannonball", "a swimmer has no Cannonball");
}

// In the scene: the incident's man is a model when it is loaded, and the world sync poses him as the incident goes.
{
  const looks = { carl: standIn(1.68), leopard: standIn(1.68) };
  useFigureTemplates(looks);
  assert.ok(figureReady("carl") && figureReady("leopard"), "the stand-ins are in");
  assert.equal(lookFor({ figure: "leopard" }).id, "leopard");
  assert.ok(wantsModel({ type: "carl", visitor: true, figure: "carl" }), "the cannonball man");
  assert.ok(
    wantsModel({ type: "intermediate", carl: true, figure: "leopard" }),
    "and the customer he becomes when he is red-carded",
  );
  assert.ok(!wantsModel({ type: "carl", visitor: true }), "a Carl with no figure is the classic one");
  assert.ok(!wantsModel({ type: "kid", visitor: true }), "and the fish kid stays the fish kid");
  useFigureTemplates({ carl: looks.carl });
  assert.equal(lookFor({ figure: "leopard" }), null, "a man who did not load is the classic Carl");
  useFigureTemplates(looks);

  const s9 = new PoolSimulation(9, 5);
  s9.start({ countdown: false });
  for (let i = 0; i < 60 * 20; i++) s9.tick(1 / 60);
  world.resetActors();
  let clock = 500;
  const sync = (n = 1) => {
    for (let i = 0; i < n; i++) world.sync(s9, (clock += 1 / 60), 1 / 60);
  };
  s9.triggerChaos("carl");
  const v = s9.visitors[0];
  sync(2);
  assert.equal(v.figure, "leopard", "level 9 has the leopard man");
  const g = world.incidentView.visitors.get(v.id);
  const u = g.userData;
  assert.ok(u.rig && u.model && u.look.id === "leopard", "he is drawn as the leopard man");
  assert.ok(
    u.classic.every((part) => !part.visible || part === u.carry || part === u.f),
    "not as the classic Carl",
  );
  assert.equal(u.root.scale.x, 1, "as tall as he is, not as the classic Carl's 1.14");
  assert.ok(u.fit > 0.9 && u.fit < 1, "and his length in the water follows it");
  const stage = (status, timer, extra = {}) => {
    Object.assign(v, { status, timer, ...extra });
    sync(2);
  };
  const clipAt = () => u.rig.actions.cannonball.time;
  const f = 1 / CLIP.fps;
  v.spot = { x: 5.75, z: 2, face: -1 };
  v.edge = { x: 5.75, z: 2 };
  v.angle = -Math.PI / 2;
  stage("windup", T.windup / 2, { x: 6.4, z: 2 });
  assert.equal(u.rig.current, "cannonball", "he winds up with the Cannonball clip");
  assert.ok(Math.abs(clipAt() - (CLIP.down * f) / 2) < 1e-6, `half way into the crouch (${clipAt()})`);
  assert.ok(
    Math.abs(g.position.x - 5.75) < 1e-6,
    "at the edge, where the classic Carl would be backing away",
  );
  stage("charge", T.charge, { x: 6.4 });
  assert.ok(Math.abs(clipAt() - CLIP.down * f) < 1e-6, "the push comes next");
  stage("flying", T.flight, { x: 5.75 });
  assert.ok(Math.abs(clipAt() - CLIP.takeoff * f) < 1e-6, "he takes off");
  assert.ok(Math.abs(g.position.y) < 1e-9, "the jump is the clip's: the group does not arc");
  assert.ok(!u.shadow.visible, "and the shadow on the deck goes");
  stage("flying", 0, { x: 3.9 });
  assert.ok(Math.abs(clipAt() - CLIP.splash * f) < 1e-6, "he reaches the water at the splash frame");
  stage("floating", T.float);
  assert.equal(u.rig.current, "swim", "in the water he swims");
  assert.ok(Math.abs(u.root.rotation.x) < 0.05, "upright at the splash");
  stage("floating", T.float - SETTLE);
  assert.ok(Math.abs(u.root.rotation.x - Math.PI / 2) < 1e-6, "on his front a moment later");
  assert.ok(
    Math.abs(g.position.y + 0.39) < 1e-6 && Math.abs(u.root.scale.x - 0.85) < 1e-6,
    "in the water, as a swimmer",
  );
  assert.ok(Math.abs(u.root.position.z + 0.65 * u.fit) < 1e-6, "set back by his own length");
  stage("swimming", 0, { x: 4.4, angle: Math.PI / 2 });
  assert.equal(u.rig.current, "swim");
  for (let i = 0; i < 60; i++) sync();
  assert.ok(Math.abs(g.rotation.y - Math.PI / 2) < 0.01, "he has turned to the wall (not at once)");
  stage("climbing", T.climb / 2, { x: 5.2 });
  assert.ok(Math.abs(u.root.rotation.x - Math.PI / 4) < 1e-6, "he stands up as he climbs");
  assert.ok(u.puppet.arms && u.puppet.legs, "with the climbing pose on his arms and legs");
  stage("running", 0, { x: 5.9 });
  assert.ok(!u.puppet.arms && Math.abs(u.root.rotation.x) < 1e-6, "out of the water he is upright");
  for (let i = 0; i < 40; i++) {
    v.x += 5.4 / 60;
    sync();
  }
  assert.equal(u.rig.current, "run", "and runs to the next spot");
  assert.equal(u.root.scale.x, 1 - 0.15 * 0, "at his own size");
  // Karen is near: his arms go to his ears, and back to the clip when she has gone.
  v.karenAnnoyed = 3;
  sync(30);
  assert.ok(u.annoy > 0.5 && u.puppet.arms, "near Karen he covers his ears");
  v.karenAnnoyed = 0;
  sync(90);
  assert.ok(!u.puppet.arms && u.annoy < 0.01, "and runs on when she has gone");
  // A broken model is let go: the classic Carl takes over, drawn at his own size.
  const quiet = console.error;
  console.error = () => {};
  u.rig.update = () => {
    throw new Error("broken clip");
  };
  sync(1);
  console.error = quiet;
  assert.equal(u.rig, null, "the broken model is let go");
  sync(1);
  assert.ok(
    u.classic.every((part) => part.visible || part === u.carry || part === u.f),
    "the classic Carl shows",
  );
  assert.ok(Math.abs(u.root.scale.x - 1.14) < 1e-9, "at the classic Carl's size");
  // He goes when the incident is over, and his skeleton with him.
  s9.visitors = [];
  sync(1);
  assert.ok(!world.incidentView.visitors.has(v.id), "gone from the scene");
}

// While a cannonball man is in the pool the crowd panics: the swimmers in the water stand upright and hop, so do those on the
// deck who wait; those on their way keep walking. With the classic swimmers the hop is the classic one.
{
  useSwimmerTemplates(Object.fromEntries(SWIMMERS.map((look, i) => [look.id, standIn(1.55 + i * 0.07)])));
  chooseSwimmers("models");
  const s9 = new PoolSimulation(9, 5);
  s9.start({ countdown: false });
  for (let i = 0; i < 60 * 14; i++) s9.tick(1 / 60);
  s9.people.length = 0;
  const swimmer = s9.spawn({ type: "beginner" });
  Object.assign(swimmer, { status: "swim", lane: 0, p: 5, actualSpeed: 1.5, h: 90 });
  const pos = loopPosition(swimmer.p, s9.lanes[0]);
  Object.assign(swimmer, { x: pos.x, z: pos.z, angle: pos.angle });
  const waiting = s9.spawn({ type: "advanced" });
  const walker = s9.spawn({ type: "intermediate" });
  Object.assign(walker, { status: "enter", path: [{ x: 0, z: 6 }], x: -3, z: 9 });
  assert.equal(waiting.status, "queue");
  world.swapSwimmers();
  world.resetActors();
  let clock = 900;
  const sync = (n = 1) => {
    for (let i = 0; i < n; i++) world.sync(s9, (clock += 1 / 60), 1 / 60);
  };
  sync(30);
  const [gs, gq, gw] = [swimmer, waiting, walker].map((p) => world.people.get(p.id).userData);
  assert.equal(gs.rig.current, "swim", "calm: the swimmer swims");
  assert.equal(gq.rig.current, "idle", "the queue stands");
  const lying = world.people.get(swimmer.id).position.y;
  assert.ok(Math.abs(lying + 0.39) < 1e-6, "lying on the water");
  s9.carl = { inWater: true, stage: "loose", cannonballs: 1, id: -1, name: "Carl", figure: "carl" };
  assert.ok(s9.crowdPanic(), "he is in the water");
  sync(30);
  assert.equal(gs.rig.current, "panic", "the swimmer in the water plays the Panic clip");
  assert.ok(!gs.puppet.arms && !gs.puppet.legs, "which is the whole body");
  const held = world.people.get(swimmer.id);
  assert.ok(Math.abs(held.position.y + 0.82) < 1e-6, "standing in the water to the waist");
  assert.ok(Math.abs(gs.root.rotation.x) < 1e-6, "upright, not on its front");
  assert.ok(!gs.shadow.visible, "with no shadow on the deck");
  assert.equal(gq.rig.current, "panic", "the swimmer in the queue panics");
  assert.notEqual(gw.rig.current, "panic", "one on the way to the pool does not");
  {
    const real = world.reducedMotion;
    world.reducedMotion = { matches: true };
    sync(2);
    assert.ok(gs.puppet.arms && gq.puppet.arms, "with reduced motion they stand with their hands up");
    world.reducedMotion = real;
  }
  s9.carl.inWater = false;
  sync(30);
  assert.equal(gs.rig.current, "swim", "when he is out the swimmer swims on");
  assert.ok(Math.abs(world.people.get(swimmer.id).position.y + 0.39) < 1e-6, "lying on the water again");
  assert.equal(gq.rig.current, "idle", "and the queue calms down");
  // The classic swimmers: the hop is the classic one, in the water too.
  chooseSwimmers("classic");
  world.swapSwimmers();
  s9.carl.inWater = true;
  sync(30);
  const classicSwimmer = world.people.get(swimmer.id).userData;
  assert.equal(classicSwimmer.rig, undefined, "classic swimmers");
  assert.ok(Math.abs(world.people.get(swimmer.id).position.y + 0.82) < 1e-6, "in the water to the waist");
  assert.ok(Math.abs(classicSwimmer.arms[0].rotation.z - 2.7) < 1e-9, "with their hands up");
  assert.ok(
    Math.abs(world.people.get(waiting.id).userData.arms[0].rotation.z - 2.7) < 1e-9,
    "as in the queue",
  );
  s9.carl = null;
  chooseSwimmers("models");
  world.swapSwimmers();
}

// ---- the fish kid: a small boy with a bucket -----------------------------------------------------------------------
{
  const kid = FIGURES.find((f) => f.id === "kid");
  assert.ok(
    kid.run > kid.walk * 2 && kid.walk > 0.4 && kid.toRun > kid.walk,
    "the kid's paces: a short stride, a run beyond a walk",
  );
  assert.ok(existsSync("dist/assets/" + kid.file), "his model is in the assets");
  {
    // The bucket is in his file, under the node the carrying clips move: BucketMount > BucketFrame > Bucket (a mesh), and each of
    // the four clips keys that node, so the bucket goes where the hands go in the viewer as in the game.
    const bytes = readFileSync("dist/assets/" + kid.file);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
    const named = (name) => json.nodes.findIndex((n) => n.name === name);
    const [mount, frame, bucket] = ["BucketMount", "BucketFrame", "Bucket"].map(named);
    assert.ok(mount > 0 && frame > 0 && bucket > 0, "the file has the mount, its frame and the bucket");
    assert.ok(
      json.nodes[mount].children.includes(frame) && json.nodes[frame].children.includes(bucket),
      "nested as said",
    );
    assert.ok(
      json.nodes.some((n) => n.name === "Spine" && n.children.includes(mount)),
      "the mount hangs from the chest bone",
    );
    assert.ok(
      json.nodes[bucket].mesh !== undefined && json.nodes[bucket].skin === undefined,
      "the bucket is a plain mesh",
    );
    assert.ok(
      Math.abs(json.nodes[frame].scale[0] * 0.01 - 1) < 1e-6,
      "its frame undoes the armature's scale: metres inside",
    );
    assert.ok(
      json.nodes[bucket].extras?.height > 0.2 && json.nodes[bucket].extras.height < 0.4,
      "a bucket of a child's size",
    );
    for (const name of ["CarryIdle", "CarryWalk", "CarryRun", "BucketDump"]) {
      const clip = json.animations.find((a) => a.name === name);
      const paths = clip.channels.filter((c) => c.target.node === mount).map((c) => c.target.path);
      assert.ok(
        paths.includes("translation") && paths.includes("rotation"),
        `${name} moves the bucket's mount`,
      );
    }
    assert.ok(
      !existsSync("dist/assets/bucket.glb"),
      "(there is no second copy of the bucket for the game to load)",
    );
  }
  assert.deepEqual(
    kid.needs,
    ["carry", "carryWalk", "carryRun", "dump"],
    "the four carrying clips are asked of the file",
  );
  const manifest = JSON.parse(readFileSync("tools/viewer/characters.json", "utf8")).characters;
  const entry = manifest.find((c) => c.id === "fish-kid");
  assert.ok(
    entry && entry.file.endsWith("dist/assets/" + kid.file),
    "Anim Bench shows the very file the game loads",
  );
  for (const name of ["CarryIdle", "CarryWalk", "CarryRun", "BucketDump"])
    assert.ok(entry.own?.includes(name) || name in (entry.clips || {}), `the viewer lists ${name}`);

  // The rules: the carrying clips while he holds the bucket, his own pace for a run, no scratching with full hands.
  {
    const { rig, actions } = fakeRig(kid);
    rig.update(1 / 60, { carry: true });
    assert.equal(rig.current, "carry", "standing with the bucket");
    run(rig, 60 * 12, { carry: true, speed: 0 });
    assert.equal(rig.current, "carry", "he does not scratch his head with both hands on the bucket");
    run(rig, 60, { carry: true, speed: 0.95 });
    assert.equal(rig.current, "carryWalk", "a stroll with it");
    assert.ok(Math.abs(actions.carryWalk.rate - 0.95 / kid.walk) < 0.06, "at his pace");
    run(rig, 40, { carry: true, speed: 2.3 });
    assert.equal(rig.current, "carryRun", "the kid's own pace (2.3 m/s) is a run: a child's stride is short");
    run(rig, 40, { carry: false, speed: 2.3 });
    assert.equal(rig.current, "run", "without the bucket it is the plain clip");
    rig.update(1 / 60, { carry: true, dump: 0.3 });
    assert.equal(rig.current, "dump", "tipping it out is BucketDump");
    assert.equal(actions.dump.rate, 0, "which the incident scrubs");
    assert.equal(actions.dump.time, 0.3, "to how far the dump has got");
    // A swimmer has none of the four.
    const plain = fakeRig();
    for (const k of ["carry", "carryWalk", "carryRun", "dump"]) delete plain.rig.actions[k];
    run(plain.rig, 5, { carry: true, dump: 0.2 });
    assert.notEqual(plain.rig.current, "dump", "a model without the clips ignores them");
  }

  // In the scene.
  useFigureTemplates({ kid: standIn(1.2, true) });
  assert.ok(figureReady("kid"), "the stand-in kid is in");
  const s8 = new PoolSimulation(8, 5);
  s8.start({ countdown: false });
  for (let i = 0; i < 60 * 5; i++) s8.tick(1 / 60);
  world.resetActors();
  let clock = 900;
  const sync = (n = 1) => {
    for (let i = 0; i < n; i++) world.sync(s8, (clock += 1 / 60), 1 / 60);
  };
  s8.triggerChaos("fish");
  const v = s8.visitors.find((x) => x.kind === "kid");
  sync(2);
  const g = world.incidentView.visitors.get(v.id);
  const u = g.userData;
  assert.ok(u.rig && u.look.id === "kid" && u.bucketModel, "he is drawn as the model, with a bucket");
  assert.equal(
    u.bucketModel.parent.name,
    "BucketMount",
    "the bucket hangs on the node the clips move, which is his skeleton's",
  );
  assert.equal(u.bucketHeight, 0.28, "it is as tall as the file says");
  assert.ok(u.kidBucket.visible === false, "the classic bucket is hidden");
  assert.ok(
    !u.bucketModel.getObjectByName("bucket-fish"),
    "and there is no fish in it: it is seen only once it is out",
  );
  assert.ok(!world.incidentView.fish.visible, "not in the pool either, while he has it");
  assert.equal(u.root.scale.x, 1, "as tall as he is");
  v.hold = 0;
  v.status = "walking";
  for (let i = 0; i < 60; i++) {
    v.x += 2.3 / 60;
    sync();
  }
  assert.equal(u.rig.current, "carryRun", "he runs in with the bucket at his own pace");
  v.karenAnnoyed = 3;
  sync(30);
  assert.ok(u.annoy > 0.5 && u.puppet.arms, "near Karen his hands go to his ears");
  v.karenAnnoyed = 0;
  sync(90);
  assert.ok(!u.puppet.arms && u.annoy < 0.01, "and back to the bucket when she has gone");
  Object.assign(v, { status: "dumping", dumpTime: 0.5 });
  sync(2);
  assert.equal(u.rig.current, "dump", "he tips it out");
  assert.ok(
    Math.abs(u.rig.actions.dump.time - 0.5 * kid.dumpEnd) < 0.02,
    "half way through the clip at half way",
  );
  assert.ok(
    !world.incidentView.fish.visible,
    "and the fish is not seen while the bucket is tipping: it is out at the end",
  );
  Object.assign(v, { status: "crying", hasFish: false, dumpTime: 0 });
  sync(2);
  assert.ok(
    u.bucketHolder && u.bucketModel.parent === u.bucketHolder && u.bucketHolder.parent === u.root,
    "crying, the empty bucket is on the deck beside him, out of the mount",
  );
  assert.ok(u.puppet.arms, "his hands are at his face");
  assert.notEqual(u.rig.current, "carry", "and he is not carrying anything");
  // A broken model is let go: the classic kid takes over, with his own bucket.
  const quiet = console.error;
  console.error = () => {};
  u.rig.update = () => {
    throw new Error("broken clip");
  };
  sync(1);
  console.error = quiet;
  assert.equal(u.rig, null, "the broken model is let go");
  sync(1);
  assert.ok(u.kidBucket.visible && !u.bucketModel, "the classic bucket is his again");
  s8.visitors = [];
  sync(1);
  assert.ok(!world.incidentView.visitors.has(v.id), "gone from the scene");
}

console.log(
  "Swimmer model checks passed: the choice is remembered, five looks given out evenly, the clip rules and their paces, the poses laid over the clips, VIPs, daredevils and Carl, the swap in the scene, a model that breaks is dropped, and the cannonball men: the Cannonball clip followed through the incident, the swim in the water, and the crowd's panic.",
);
