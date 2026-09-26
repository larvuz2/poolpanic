import assert from "node:assert/strict";
import { PoolSimulation, LANES, STATIONS } from "./dist/sim.mjs";
import { COACH_TUNING as T, isDeckPosition } from "./dist/spatial.mjs";
import { CoachInput } from "./dist/input.mjs";
const game = () => {
  const s = new PoolSimulation(1, 913);
  s.schedule = [];
  s.start();
  Object.assign(s.coach, { x: 0, z: 10.8 });
  return s;
};
const step = (s, seconds) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) s.tick(1 / 60);
};
const at = (s, x, z) => {
  Object.assign(s.coach, { x, z, vx: 0, vz: 0, y: 0, vy: 0, slipTime: 0 });
  s.setMovement(0, 0);
};
{
  const s = game();
  s.setMovement(1, 0);
  step(s, 0.05);
  assert.ok(s.coach.x > 0.01, "Input must respond within 50 ms");
  step(s, 0.45);
  assert.ok(s.coach.x > 3);
  s.setMovement(0, 0);
  step(s, 0.2);
  assert.equal(s.coach.vx, 0);
  const x = s.coach.x;
  step(s, 0.4);
  assert.equal(s.coach.x, x);
}
{
  const a = game(),
    b = game();
  at(a, 7, 4);
  at(b, 7, 4);
  a.setMovement(0, -1);
  b.setMovement(1, -1);
  step(a, 0.3);
  step(b, 0.3);
  assert.ok(
    Math.abs(Math.hypot(a.coach.x - 7, a.coach.z - 4) - Math.hypot(b.coach.x - 7, b.coach.z - 4)) < 0.1,
    "Diagonal movement must not be faster",
  );
  const s = game();
  at(s, 0, -10.8);
  s.setMovement(0, 1);
  step(s, 1);
  assert.ok(s.coach.z < -9.9, "Starting blocks must be solid");
  at(s, 1.2, -10);
  s.setMovement(0, 1);
  s.jump();
  step(s, 1);
  assert.ok(s.coach.z <= -8.95, "Jumping must not cross the pool edge");
  assert.ok(isDeckPosition(s.coach.x, s.coach.z));
  at(s, 13.7, 1);
  s.setMovement(1, 0);
  step(s, 2);
  assert.ok(s.coach.x <= 14.1, "The coach stays inside the facility");
}
{
  const s = game();
  s.jump();
  step(s, 0.25);
  assert.ok(s.coach.y > 0.8);
  const mid = s.coach.y;
  s.jump();
  step(s, 0.05);
  assert.ok(s.coach.vy < 2, "Airborne jump cannot double jump");
  step(s, 0.6);
  assert.equal(s.coach.y, 0);
  assert.equal(s.coach.vy, 0);
  assert.equal(s.status, "playing", "Space must never pause");
  assert.ok(s.events.some((e) => e.type === "land"));
}
{
  const s = game();
  assert.equal(s.fetch("fins"), false);
  assert.equal(s.finsAvailable, 3);
  const original = { x: s.coach.x, z: s.coach.z };
  step(s, 1);
  assert.deepEqual({ x: s.coach.x, z: s.coach.z }, original, "A distant click must not start auto-walking");
  at(s, -9.3, 7.8);
  assert.equal(s.nearestInteraction().kind, "fetch");
  assert.ok(s.interact());
  assert.equal(s.coach.carry, "fins");
  assert.equal(s.finsAvailable, 2);
  assert.equal(s.fetch("chlorine"), false, "Only one carried item");
  const p = s.spawn({ type: "advanced" });
  Object.assign(p, { needsFins: true, sick: false });
  assert.equal(s.deliver(p.id), false, "No long-distance handoffs");
  assert.equal(p.hasFins, false);
  at(s, p.x, p.z + 0.9);
  s.jump();
  step(s, 0.1);
  assert.equal(s.deliver(p.id), false, "Airborne handoffs are gated");
  step(s, 0.7);
  assert.ok(s.deliver(p.id));
  assert.equal(p.hasFins, true);
  assert.equal(s.coach.carry, null);
  // A fin-equipped waiting customer cannot take a finite pair out of the simulation.
  p.h = 0;
  p.wait = p.waitLimit;
  step(s, 0.05);
  assert.equal(p.hasFins, false);
  assert.equal(s.clutter.filter((f) => f.type === "fins").length, 1);
}
{
  const s = game();
  const p = s.spawn({ type: "beginner" });
  Object.assign(p, {
    status: "swim",
    lane: 0,
    p: 23,
    x: -3.2,
    z: -0.2,
    problem: "fins",
    needsFins: true,
    sick: false,
    workTarget: 999,
    h: 100,
  });
  at(s, -9.3, 7.8);
  assert.ok(s.fetch("fins"));
  at(s, -2.05, -10.15);
  assert.equal(s.deliver(p.id), false, "Swimmer must first arrive at the wall");
  step(s, 5);
  assert.ok(p.z <= -6.55);
  assert.ok(s.deliver(p.id));
  assert.equal(p.problem, null);
  assert.equal(p.hasFins, true);
}
{
  const s = game();
  const p = s.spawn({ type: "aqua" });
  Object.assign(p, {
    status: "swim",
    lane: 2,
    x: 3.8,
    z: -7.2,
    problem: "eyes",
    sick: false,
    workTarget: 100,
    h: 100,
  });
  s.coach.carry = "relief";
  at(s, 4.35, -9.9);
  assert.ok(s.deliver(p.id));
  const before = p.z;
  step(s, 0.05);
  assert.ok(Math.abs(p.z - before) < 0.2, "Aqua must walk/swim back instead of teleporting after treatment");
}
{
  const s = game();
  const p = s.spawn({ type: "intermediate" });
  Object.assign(p, { status: "swim", lane: 1, p: 30, z: -7.2, x: 0.6, problem: "goggles", sick: false });
  s.clutter.push({ id: 991, type: "goggles", owner: p.id, x: 0, z: 10.5 });
  at(s, 0, 11.4);
  assert.ok(s.pickup(991));
  assert.equal(s.coach.carry, "goggles");
  at(s, 1.15, -9.9);
  assert.ok(s.deliver(p.id));
  assert.equal(p.problem, null);
  assert.equal(s.coach.carry, null);
}
{
  const s = game();
  at(s, 7, 4);
  s.clutter.push({ id: 9, type: "fins", x: 7, z: 3 });
  s.setMovement(0, -1);
  s.jump();
  step(s, 0.25);
  assert.equal(s.coach.slipTime, 0, "A jump clears dropped fins");
  const q = game();
  at(q, 7, 4);
  q.clutter.push({ id: 9, type: "fins", x: 7, z: 3 });
  q.setMovement(0, -1);
  step(q, 0.25);
  assert.ok(q.coach.slipTime > 0, "Walking through fins causes a slip");
}
{
  let jumps = 0,
    actions = 0,
    pauses = 0;
  const input = new CoachInput({
    isPlaying: () => true,
    onJump: () => jumps++,
    onInteract: () => actions++,
    onPause: () => pauses++,
    onShortcut: () => {},
  });
  const key = (code, repeat = false) => ({
    code,
    key: code,
    repeat,
    preventDefault() {},
    target: { matches: () => false },
  });
  input.keyDown(key("KeyW"));
  input.keyDown(key("ArrowRight"));
  let v = input.vector();
  assert.ok(v.x > 0 && v.z < 0);
  assert.equal(Math.hypot(v.x, v.z), 1);
  input.keyUp(key("KeyW"));
  assert.deepEqual(input.vector(), { x: 1, z: 0 });
  input.keyDown(key("Space"));
  input.keyDown(key("Space", true));
  assert.equal(jumps, 1);
  assert.equal(pauses, 0);
  input.keyDown(key("KeyE"));
  assert.equal(actions, 1);
  input.keyDown(key("KeyP"));
  assert.equal(pauses, 1);
  input.clear();
  assert.deepEqual(input.vector(), { x: 0, z: 0 });
}
console.log(
  "Coach checks passed: real key mappings, acceleration/braking, normalized movement, collision, jumps, range-gated interactions, physical delivery, inventory recovery, aqua return, goggles, and jump-over-clutter behavior.",
);
