// Coach Panic in the game (scene/coach-model.mjs): which coach is chosen, the walk in while the countdown runs, the rules
// that pick the clip, and swapping the model in and out of the scene (with stand-ins for the model and its clips).
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { PoolSimulation } from "./dist/sim.mjs";
import {
  CLIPS,
  WALK_SPEED,
  CoachRig,
  coachChoice,
  planIntro,
  introAt,
  useCoachTemplate,
} from "./dist/scene/coach-model.mjs";

// ---- which coach -------------------------------------------------------------------------------------------------
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
  assert.equal(coachChoice("", s), "panic", "Coach Panic is the default");
  assert.equal(coachChoice("?coach=classic", s), "classic");
  assert.equal(coachChoice("?debug", s), "classic", "the classic coach is remembered on the device");
  assert.equal(coachChoice("?coach=panic", s), "panic");
  assert.equal(coachChoice("", s), "panic", "asking for Coach Panic forgets the classic choice");
  assert.equal(coachChoice("?coach=nonsense", store({ "pool-panic.coach.v1": "classic" })), "classic");
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
  assert.equal(coachChoice("", broken), "panic", "blocked storage still gives the default");
  assert.equal(coachChoice("?coach=classic", broken), "classic");
}

// ---- walking in: a few steps, ending at the spawn point as the countdown reaches zero -------------------------------
let planned = 0;
for (let level = 1; level <= 20; level++) {
  const sim = new PoolSimulation(level, 100 + level);
  sim.start({ countdown: true });
  const c = sim.coach;
  const plan = planIntro(sim);
  assert.ok(
    plan.length >= 0.4 * WALK_SPEED * 3 - 1e-9,
    `level ${level}: there is a walk of a few steps (${plan.length})`,
  );
  assert.ok(plan.rate > 0.3 && plan.rate <= 1.0001, `level ${level}: the walk clip plays at ${plan.rate}`);
  const start = introAt(plan, sim.countdown);
  assert.ok(
    Math.abs(Math.hypot(start.x - c.x, start.z - c.z) - plan.length) < 1e-9,
    "he starts `length` from the spawn",
  );
  const end = introAt(plan, 0);
  assert.ok(
    Math.abs(end.x - c.x) < 1e-9 && Math.abs(end.z - c.z) < 1e-9,
    `level ${level}: he ends on the spawn point`,
  );
  let last = Infinity;
  for (let left = sim.countdown; left >= 0; left -= 0.05) {
    const at = introAt(plan, left);
    assert.ok(
      sim.venue.isDeck(at.x, at.z, sim.level),
      `level ${level}: every step is on the deck (${at.x}, ${at.z})`,
    );
    const to = Math.hypot(at.x - c.x, at.z - c.z);
    assert.ok(to <= last + 1e-9, "he only gets closer");
    last = to;
  }
  planned++;
}
assert.equal(planned, 20);

// ---- the clip rules, with stand-in actions ----------------------------------------------------------------------
function fakeRig() {
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
    swim: action("swim"),
  };
  const mixer = {
    advanced: 0,
    update(dt) {
      this.advanced += dt;
      for (const a of Object.values(actions)) if (a.playing) a.time += dt;
    },
  };
  return { rig: new CoachRig(mixer, actions), actions, mixer, log };
}
{
  const { rig, actions, mixer } = fakeRig();
  assert.equal(rig.current, "idle", "he starts standing");
  rig.update(1 / 60, { speed: 0 });
  assert.equal(rig.current, "idle");
  rig.update(1 / 60, { speed: 5 });
  assert.equal(rig.current, "run", "moving is always the run");
  for (let i = 0; i < 30; i++) rig.update(1 / 60, { speed: 7.6 });
  assert.ok(
    actions.run.rate > 1.6 && actions.run.rate <= 2.1,
    `the run keeps pace with a fast coach (${actions.run.rate})`,
  );
  for (let i = 0; i < 30; i++) rig.update(1 / 60, { speed: 1.2 });
  assert.ok(actions.run.rate < 0.6 + 0.5, `and slows with him (${actions.run.rate})`);
  rig.update(1 / 60, { speed: 0.5 });
  assert.equal(rig.current, "run", "a dip in speed does not flicker to idle");
  rig.update(1 / 60, { speed: 0.1 });
  assert.equal(rig.current, "idle", "stopping is idle");
  rig.update(1 / 60, { speed: 0, intro: { rate: 0.8 } });
  assert.equal(rig.current, "walk", "the countdown walks him in");
  for (let i = 0; i < 20; i++) rig.update(1 / 60, { speed: 0, intro: { rate: 0.8 } });
  assert.ok(Math.abs(actions.walk.rate - 0.8) < 0.05, "at the walk's own rate");
  rig.update(1 / 60, { speed: 0 });
  assert.equal(rig.current, "idle", "at the spawn point he stands");
  rig.update(1 / 60, { speed: 0, prone: true });
  assert.equal(rig.current, "swim", "swimming plays the crawl on his front");
  for (let i = 0; i < 30; i++) rig.update(1 / 60, { speed: 0, prone: true });
  assert.ok(Math.abs(actions.swim.rate - 1.1) < 0.05, `at a stroke of his own (${actions.swim.rate})`);
  assert.ok(mixer.advanced > 0);
}
{
  // A file without the Swim clip crawls with the Run clip.
  const { rig, actions } = fakeRig();
  delete rig.actions.swim;
  rig.update(1 / 60, { speed: 0, prone: true });
  assert.equal(rig.current, "run", "without a Swim clip the swim is the run");
}
{
  // Standing long enough brings a head scratch; a job in hand or moving does not.
  const { rig, actions } = fakeRig();
  rig.scratchAfter = 1;
  for (let i = 0; i < 100; i++) rig.update(1 / 60, { speed: 0, busy: true });
  assert.equal(rig.current, "idle", "no scratching in the middle of a job");
  for (let i = 0; i < 30; i++) rig.update(1 / 60, { speed: 0 });
  assert.equal(rig.current, "scratch", "after a while he scratches his head");
  assert.ok(rig.scratchAfter > 1, "and waits longer the next time");
  rig.update(1 / 60, { speed: 0 });
  assert.equal(rig.current, "scratch", "the scratch plays out");
  actions.scratch.time = 5.8;
  rig.update(1 / 60, { speed: 0 });
  assert.equal(rig.current, "idle", "then he settles back into the scan");
  rig.scratchAfter = 0.05;
  for (let i = 0; i < 10; i++) rig.update(1 / 60, { speed: 0 });
  assert.equal(rig.current, "scratch");
  rig.update(1 / 60, { speed: 4 });
  assert.equal(rig.current, "run", "moving ends a scratch at once");
}

// ---- in the scene, with a stand-in model --------------------------------------------------------------------------
const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { createCanvas } = runtime
  ? await import(pathToFileURL(runtime + "/@napi-rs/canvas/index.js"))
  : await import("@napi-rs/canvas");
globalThis.document = { createElement: () => createCanvas(256, 128) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { PoolWorld } = await import("./dist/scene.mjs");
const world = new PoolWorld({ clientWidth: 1200, clientHeight: 800 }, () => {}, { headless: true });
assert.equal(world.coach.userData.rig, undefined, "without the model the coach is the classic one");
const clips = Object.fromEntries(
  Object.values(CLIPS).map((name) => [name, new THREE.AnimationClip(name, 6, [])]),
);
const model = new THREE.Group();
model.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.7, 0.3), new THREE.MeshBasicMaterial()));
useCoachTemplate({ scene: model, clips, clone: (g) => g.clone() });
world.swapCoach("panic");
let u = world.coach.userData;
assert.ok(u.rig && u.model, "Coach Panic is in the scene");
assert.ok(u.root.children.includes(u.model), "the model stands in the coach's root");
assert.ok(u.classic.length > 5 && u.classic.every((part) => !part.visible), "the classic parts are hidden");
assert.ok(u.carry.visible === false && u.root.children.includes(u.carry), "the carried item's holder stays");
world.swapCoach("classic");
u = world.coach.userData;
assert.equal(u.rig, undefined, "the classic coach comes back whole");
assert.ok(u.root.children.every((part) => part.visible !== false || part === u.carry || part === u.f));
world.swapCoach("panic");

// A shift's countdown: walking in, and standing on the spawn point when it reaches zero.
const sim = new PoolSimulation(3, 55);
sim.schedule = [];
world.resetActors();
sim.start({ countdown: true });
const spawn = { x: sim.coach.x, z: sim.coach.z };
let t = 0;
world.sync(sim, t, 1 / 60);
const first = world.coach.position.clone();
assert.ok(Math.hypot(first.x - spawn.x, first.z - spawn.z) > 1, "he starts a few steps from the spawn point");
assert.equal(world.coach.userData.rig.current, "walk", "and walks");
let frames = 0;
while (sim.status === "countdown" && frames++ < 1000) {
  sim.tick(1 / 60);
  world.sync(sim, (t += 1 / 60), 1 / 60);
}
assert.equal(sim.status, "playing", "the countdown ran out");
world.sync(sim, (t += 1 / 60), 1 / 60);
assert.ok(
  Math.hypot(world.coach.position.x - spawn.x, world.coach.position.z - spawn.z) < 1e-6,
  "he is on the spawn point when the timer reaches zero",
);
assert.notEqual(world.coach.userData.rig.current, "walk", "and no longer walking");
// He never walks in again mid-shift.
for (let i = 0; i < 60; i++) {
  sim.tick(1 / 60);
  world.sync(sim, (t += 1 / 60), 1 / 60);
}
assert.ok(Math.hypot(world.coach.position.x - sim.coach.x, world.coach.position.z - sim.coach.z) < 1e-6);
// Carried items sit in his hands.
sim.coach.carry = "fins";
world.sync(sim, (t += 1 / 60), 1 / 60);
u = world.coach.userData;
assert.deepEqual(
  u.carry.position.toArray().map((v) => +v.toFixed(2)),
  [0.3, 1, 0.34],
  "an item in front of his chest",
);
// Swimming and sliding keep the model.
sim.coach.carry = null;
sim.coach.swimming = true;
world.sync(sim, (t += 1 / 60), 1 / 60);
assert.equal(u.rig.current, "swim", "swimming plays the crawl");
sim.coach.swimming = false;
sim.coach.slipTime = 0.5;
world.sync(sim, (t += 1 / 60), 1 / 60);
assert.ok(u.rig, "a slip keeps the model");
// A model that breaks falls back to the classic coach without stopping the shift.
const quiet = console.error;
console.error = () => {};
u.rig.update = () => {
  throw new Error("broken clip");
};
world.sync(sim, (t += 1 / 60), 1 / 60);
console.error = quiet;
assert.equal(world.coach.userData.rig, null, "the broken model is let go");
assert.ok(
  u.classic.every((part) => part.visible),
  "the classic coach shows again",
);

console.log(
  "Coach model checks passed: the choice is remembered, a walk in on every level ending on the spawn point, the clip rules, the swap in the scene, and a model that breaks is dropped.",
);
