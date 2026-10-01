// The generic swimmers in the game (scene/swimmer-models.mjs): which look is chosen, which swimmers get a model, the rules
// that pick the clip, how the poses set on the classic limbs reach the model's bones, and swapping the models in and out
// of the scene (with a stand-in model that has the real model's bone names).
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { PoolSimulation, swimmerLook } from "./dist/sim.mjs";
import {
  CLIPS,
  SWIMMERS,
  SwimmerRig,
  attachSwimmerModel,
  chooseSwimmers,
  dropSwimmerModel,
  lookFor,
  swimmerChoice,
  swimmerModelsReady,
  useSwimmerTemplates,
  wantsModel,
} from "./dist/scene/swimmer-models.mjs";

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
function standIn(height = 1.7) {
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
  };
  const mixer = {
    advanced: 0,
    update(dt) {
      this.advanced += dt;
      for (const a of Object.values(actions)) if (a.playing) a.time += dt;
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
  // Swimming: the run on the front, at the stroke the world sync asks for.
  run(rig, 5, { swim: true, stroke: 0.6 });
  assert.equal(rig.current, "run", "swimming plays the run");
  run(rig, 40, { swim: true, stroke: 0.6 });
  assert.ok(Math.abs(actions.run.rate - 0.6) < 0.05, `at the stroke rate (${actions.run.rate})`);
  run(rig, 40, { swim: true, stroke: 1.4 });
  assert.ok(Math.abs(actions.run.rate - 1.4) < 0.05, `which can change (${actions.run.rate})`);
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
  assert.equal(rig.current, "run", "in the water it swims, panic or not");
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
assert.equal(u.rig.current, "run", "a swimmer in the water plays the run");
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

console.log(
  "Swimmer model checks passed: the choice is remembered, five looks given out evenly, the clip rules and their paces, the poses laid over the clips, VIPs, daredevils and Carl, the swap in the scene, and a model that breaks is dropped.",
);
