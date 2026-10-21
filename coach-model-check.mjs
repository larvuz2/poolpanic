// Coach Waters in the game (scene/coach-model.mjs): which coach is chosen, the walk in while the countdown runs, the rules
// that pick the clip (SwimRing, with the arms held out round the life ring, whenever he swims with it), and swapping the model in and
// out of the scene (with stand-ins for the model and its clips).
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import * as THREE from "./dist/assets/three.module.js";
import { PoolSimulation } from "./dist/sim.mjs";
import {
  CLIPS,
  WALK_SPEED,
  CoachRig,
  activeChoice,
  chooseCoach,
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
  assert.equal(coachChoice("", s), "panic", "Coach Waters' model, always");
  assert.equal(coachChoice("?coach=classic", s), "classic", "a test page can ask for the classic coach");
  assert.equal(coachChoice("?debug", s), "panic", "and it is not remembered");
  const old = store({ "pool-panic.coach.v1": "classic" });
  assert.equal(coachChoice("", old), "panic", "a classic choice an older version saved is ignored");
  assert.equal(old.getItem("pool-panic.coach.v1"), null, "and forgotten");
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
{
  // The crash hunt's character-models test (?nomodels) plays one page with the classic coach and remembers nothing.
  const s = store();
  Object.defineProperty(globalThis, "localStorage", { value: s, configurable: true, writable: true });
  chooseCoach("classic", false);
  assert.equal(activeChoice(), "classic", "this page plays the classic coach");
  assert.deepEqual(s.data, {}, "and nothing is remembered");
  chooseCoach("classic");
  assert.deepEqual(s.data, {}, "a classic choice is never saved: Coach Waters always comes back");
  delete globalThis.localStorage;
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
    swimRing: action("swimRing"),
    startle: action("startle"),
    haul: action("haul"),
    freakOut: action("freakOut"),
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
  // Swimming with the life ring is SwimRing, and only that: the arms stay out ahead of him round the ring and only the legs kick.
  // The crawl's arms would be windmilling round it.
  const { rig, actions, mixer } = fakeRig();
  rig.update(1 / 60, { speed: 0, prone: true, ring: true });
  assert.equal(rig.current, "swimRing", "holding the ring in the water, even floating still");
  for (let i = 0; i < 40; i++) rig.update(1 / 60, { speed: 0, prone: true, ring: true });
  assert.ok(
    Math.abs(actions.swimRing.rate - 0.85) < 0.03,
    `a gentle kick when he floats (${actions.swimRing.rate})`,
  );
  for (let i = 0; i < 40; i++) rig.update(1 / 60, { speed: 4.2, prone: true, ring: true });
  assert.equal(
    rig.current,
    "swimRing",
    "and still when he swims at his fastest: never the crawl, never the run",
  );
  assert.ok(
    Math.abs(actions.swimRing.rate - 1.3) < 0.03,
    `the legs kick faster as he swims faster (${actions.swimRing.rate})`,
  );
  for (let i = 0; i < 40; i++) rig.update(1 / 60, { speed: 12, prone: true, ring: true });
  assert.ok(actions.swimRing.rate <= 1.3 + 1e-9, "…up to a limit");
  assert.ok(!actions.swim.playing && !actions.run.playing, "the crawl and the run are not playing under it");
  // Handing the ring over: the clips he always had take over again (the run while he moves, the crawl while he floats).
  rig.update(1 / 60, { speed: 2, prone: true, ring: false });
  assert.equal(rig.current, "run", "without the ring the old rules are back");
  rig.update(1 / 60, { speed: 0, prone: true, ring: false });
  assert.equal(rig.current, "swim", "…and floating without it is the crawl");
  // On the deck with the ring he runs and stands as ever: SwimRing is for the water.
  for (const speed of [0, 5]) {
    rig.update(1 / 60, { speed, prone: false, ring: true });
    assert.equal(rig.current, speed ? "run" : "idle", "on the deck the ring changes nothing");
  }
  // Into the water with it: straight to SwimRing.
  rig.update(1 / 60, { speed: 3, prone: true, ring: true });
  assert.equal(rig.current, "swimRing");
  assert.ok(mixer.advanced > 0);
}
{
  // A file without SwimRing swims with the crawl, as before.
  const { rig } = fakeRig();
  delete rig.actions.swimRing;
  rig.update(1 / 60, { speed: 0, prone: true, ring: true });
  assert.equal(rig.current, "swim", "without a SwimRing clip the ring is carried with the crawl");
  delete rig.actions.swim;
  rig.update(1 / 60, { speed: 0, prone: true, ring: true });
  assert.equal(rig.current, "run", "…and with the run when the file has no crawl either");
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

{
  // Trouble (21 October 2026): the jolt when an incident starts, heaving at a heavy job, freaking out when left standing.
  const { rig, actions } = fakeRig();
  rig.update(1 / 60, { speed: 0, startle: true });
  assert.equal(rig.current, "startle", "a new incident jolts him where he stands");
  for (let i = 0; i < 10; i++) rig.update(1 / 60, { speed: 0 });
  assert.equal(rig.current, "startle", "the jolt plays out");
  actions.startle.time = 5.9;
  rig.update(1 / 60, { speed: 0 });
  assert.equal(rig.current, "idle", "then he stands again");
  rig.update(1 / 60, { speed: 5, startle: true });
  assert.equal(rig.current, "run", "running, he keeps running: no jolt mid-stride");
  rig.update(1 / 60, { speed: 0, prone: true, startle: true });
  assert.equal(rig.current, "swim", "nor in the water");
  rig.update(1 / 60, { speed: 0, startle: true });
  rig.update(1 / 60, { speed: 4 });
  assert.equal(rig.current, "run", "moving off ends the jolt at once");
  rig.update(1 / 60, { speed: 0, busy: true, heavy: true });
  assert.equal(rig.current, "haul", "a heavy job is a heave");
  rig.update(1 / 60, { speed: 0, busy: true });
  assert.equal(rig.current, "idle", "a light one (a tip, the mop) is not");
  for (let i = 0; i < 30; i++) rig.update(1 / 60, { speed: 0, urgent: true });
  assert.equal(rig.current, "idle", "something urgent: a moment to take it in");
  for (let i = 0; i < 30; i++) rig.update(1 / 60, { speed: 0, urgent: true });
  assert.equal(rig.current, "freakOut", "left standing with it, he freaks out");
  rig.update(1 / 60, { speed: 3, urgent: true });
  assert.equal(rig.current, "run", "running to it is the run");
  for (let i = 0; i < 90; i++) rig.update(1 / 60, { speed: 0, urgent: true, busy: true });
  assert.equal(rig.current, "idle", "busy with a job he does not freak out");
  rig.update(1 / 60, { speed: 0 });
  assert.equal(rig.freakFor, 0, "and when it is over the count starts again");
  // A file without the new clips stands as before.
  const old = fakeRig();
  for (const k of ["startle", "haul", "freakOut"]) delete old.rig.actions[k];
  for (let i = 0; i < 90; i++)
    old.rig.update(1 / 60, { speed: 0, startle: i === 0, heavy: true, busy: true, urgent: true });
  assert.equal(old.rig.current, "idle", "without them nothing new is played");
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
assert.ok(u.rig && u.model, "Coach Waters is in the scene");
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
// With the life ring in the water, and only then, it is SwimRing; carrying anything else, or nothing, it is the crawl.
sim.coach.carry = "lifering";
world.sync(sim, (t += 1 / 60), 1 / 60);
assert.equal(u.rig.current, "swimRing", "swimming with the life ring plays SwimRing");
sim.coach.swimming = false;
sim.coach.waterTransition = { kind: "dive", from: { x: 0, z: 0 }, to: { x: 1, z: 0 }, t: 0.2 };
world.sync(sim, (t += 1 / 60), 1 / 60);
assert.equal(u.rig.current, "swimRing", "…in the dive into the water too");
sim.coach.waterTransition = null;
sim.coach.swimming = true;
sim.coach.carry = "fishnet";
world.sync(sim, (t += 1 / 60), 1 / 60);
assert.equal(u.rig.current, "swim", "the fish net is not the ring: the crawl");
sim.coach.carry = "lifering";
sim.coach.swimming = false;
world.sync(sim, (t += 1 / 60), 1 / 60);
assert.notEqual(u.rig.current, "swimRing", "the ring on the deck is not SwimRing");
sim.coach.carry = null;
sim.coach.swimming = true;
world.sync(sim, (t += 1 / 60), 1 / 60);
assert.equal(u.rig.current, "swim", "the ring handed over, he crawls to the edge");
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
  "Coach model checks passed: the models always (a classic choice never saved), a walk in on every level ending on the spawn point, the clip rules (SwimRing whenever he swims with the life ring, and only then), the swap in the scene, and a model that breaks is dropped.",
);
