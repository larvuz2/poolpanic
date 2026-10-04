import assert from "node:assert/strict";
import { PoolSimulation } from "./dist/sim.mjs";
import { RESCUE as R, isDeckPosition } from "./dist/spatial.mjs";
import { waitingInWater } from "./dist/rescue.mjs";
const tick = (s, n) => {
  for (let f = 0; f < n; f++) s.tick(1 / 60);
};
function go(s, x, z) {
  let f = 0;
  while (Math.hypot(s.coach.x - x, s.coach.z - z) > 0.055 && f++ < 900) {
    const dx = x - s.coach.x,
      dz = z - s.coach.z,
      n = Math.hypot(dx, dz);
    s.setMovement(dx / n, dz / n);
    s.tick(1 / 60);
  }
  s.clearInput();
  assert.ok(f < 900, "Coach reaches the physical destination");
}
function ringFromWall(s) {
  go(s, -6.6, -13.7);
  go(s, -4, -14.5);
  assert.ok(s.interact());
  assert.equal(s.coach.carry, "lifering");
  go(s, -4, -10.5);
  go(s, -7.2, -10.5);
  go(s, -7.2, 0);
}
function enter(s) {
  s.setMovement(1, 0);
  for (let f = 0; f < 120 && !s.coach.waterTransition; f++) s.tick(1 / 60);
  s.clearInput();
  assert.ok(s.coach.waterTransition, "Approaching with a ring automatically dives without Space");
}
function fixture(level = 3) {
  const s = new PoolSimulation(level, 20);
  s.schedule = [];
  s.start();
  const p = s.spawn({ type: "intermediate", sick: false }),
    a = s.spawn({ type: "beginner", sick: false });
  Object.assign(p, {
    status: "swim",
    lane: 1,
    x: 0,
    z: 0,
    p: 7.2,
    workTime: 6,
    traveled: 12,
    workTarget: 999,
    needsFins: false,
    crampAt: Infinity,
  });
  Object.assign(a, {
    status: "swim",
    lane: 0,
    x: -3.2,
    z: 2,
    p: 9.2,
    workTarget: 999,
    needsFins: false,
    crampAt: Infinity,
  });
  return { s, p, a };
}
{
  const { s, p } = fixture(1);
  assert.equal(s.startCramp(p), false);
  go(s, -6.3, 0);
  s.jump();
  s.setMovement(1, 0);
  tick(s, 60);
  assert.ok(isDeckPosition(s.coach.x, s.coach.z));
  assert.ok(!s.coach.swimming);
}
{
  const { s, p, a } = fixture();
  p.hasFins = true;
  s.finsAvailable = 2;
  assert.equal(s.startCramp(p), true);
  assert.equal(s.startCramp(a), false);
  const frozen = [p.x, p.z, p.p, p.workTime, a.x, a.z, a.p, a.workTime];
  tick(s, 60);
  assert.deepEqual([p.x, p.z, p.p, p.workTime, a.x, a.z, a.p, a.workTime], frozen);
  s.select(p.id);
  s.home();
  assert.equal(p.problem, "cramp", "Send home cannot bypass the rescue");
  assert.equal(s.assist(), false);
  assert.equal(p.problem, "cramp");
  const queue = s.spawn({ type: "beginner", sick: false });
  s.select(queue.id);
  assert.equal(s.assign(0), false);
  queue.status = "gone";
  ringFromWall(s);
  assert.deepEqual([p.x, p.z, p.p, p.workTime, a.x, a.z, a.p, a.workTime], frozen);
  assert.equal(s.deliver(p.id), false, "Clicking from the deck cannot consume the ring");
  enter(s);
  tick(s, 8);
  const dive = [s.coach.x, s.coach.y, s.coach.waterTransition.t];
  s.status = "paused";
  tick(s, 90);
  assert.deepEqual([s.coach.x, s.coach.y, s.coach.waterTransition.t], dive);
  s.status = "playing";
  tick(s, 35);
  assert.equal(s.coach.swimming, true);
  assert.equal(s.coach.carry, "lifering");
  assert.equal(s.dash(), false);
  assert.equal(s.canInteract(), false);
  s.setMovement(1, 0);
  for (let f = 0; f < 300 && s.lifeRing.state !== "victim"; f++) s.tick(1 / 60);
  s.clearInput();
  assert.equal(s.lifeRing.state, "victim");
  assert.equal(s.coach.carry, null);
  assert.equal(p.rescueRecover, true);
  assert.equal(p.lane, null);
  assert.equal(s.stats.served, 0);
  assert.deepEqual([a.x, a.z, a.p, a.workTime], frozen.slice(4));
  s.setMovement(-1, 0);
  for (let f = 0; f < 300 && (s.coach.swimming || s.coach.waterTransition); f++) s.tick(1 / 60);
  s.clearInput();
  assert.ok(!s.coach.swimming && !s.coach.waterTransition);
  assert.ok(isDeckPosition(s.coach.x, s.coach.z));
  for (let f = 0; f < 900 && s.rescue; f++) {
    if (s.rescue) assert.ok(waitingInWater(s, a));
    s.tick(1 / 60);
  }
  assert.equal(s.rescue, null);
  assert.equal(p.recoveryStage, "to-bench");
  const before = a.p;
  tick(s, 2);
  assert.notEqual(a.p, before, "Pool resumes at deck arrival, before the bench rest");
  for (let f = 0; f < 600 && p.recoveryStage !== "resting"; f++) s.tick(1 / 60);
  assert.equal(p.recoveryStage, "resting");
  assert.equal(s.lifeRing.state, "deck");
  assert.equal(p.workTime, 6);
  assert.equal(p.traveled, 12);
  const resting = { x: p.x, z: p.z, t: p.restTime };
  tick(s, 120);
  assert.equal(p.x, resting.x);
  assert.equal(p.z, resting.z);
  assert.ok(p.restTime > 0 && p.restTime < resting.t);
  go(s, -6.3, -0.25);
  go(s, -8.3, -0.25);
  assert.ok(s.interact());
  assert.equal(s.lifeRing.state, "coach");
  go(s, -6.3, -0.25);
  go(s, -6.3, -13.7);
  go(s, -4, -14.5);
  assert.ok(s.returnItem());
  assert.equal(s.lifeRing.state, "wall");
  assert.equal(s.coach.carry, null);
  for (let f = 0; f < 900 && p.status !== "swim"; f++) s.tick(1 / 60);
  assert.equal(p.status, "swim");
  assert.equal(p.lane, 1);
  assert.ok(p.workTime >= 6 && p.workTime < 8);
  assert.ok(p.traveled >= 12);
  assert.equal(p.crampDone, true);
  assert.equal(s.stats.served, 0);
  assert.equal(p.hasFins, true);
  assert.equal(
    s.finsAvailable +
      s.people.filter((p) => p.hasFins).length +
      s.clutter.filter((f) => f.type === "fins").length,
    3,
  );
  // Owning the ring without a cramp never grants free swimming.
  assert.ok(s.fetch("lifering"));
  go(s, -4, -10.5);
  go(s, -6.3, -10.5);
  go(s, -6.3, 0);
  s.jump();
  s.setMovement(1, 0);
  tick(s, 50);
  assert.ok(!s.coach.swimming);
  assert.ok(isDeckPosition(s.coach.x, s.coach.z));
}
// A real level-two arrival develops a mid-pool cramp without forcing incident state.
{
  const s = new PoolSimulation(2, 31);
  s.start();
  for (let f = 0; f < 2400 && !s.rescue; f++) {
    for (const p of s.people.filter((p) => p.status === "queue")) {
      s.select(p.id);
      s.assign(p.type === "beginner" ? 0 : 1);
    }
    s.tick(1 / 60);
  }
  assert.ok(s.rescue);
  const p = s.get(s.rescue.victim);
  assert.ok(Math.abs(p.z) < 5.6);
  assert.equal(p.problem, "cramp");
  assert.ok(p.workTime >= 9);
  ringFromWall(s);
  enter(s);
  tick(s, 40);
  go(s, p.x, p.z);
  assert.equal(s.lifeRing.state, "victim");
  s.setMovement(-1, 0);
  for (let f = 0; f < 300 && (s.coach.swimming || s.coach.waterTransition); f++) s.tick(1 / 60);
  s.clearInput();
  for (let f = 0; f < 1800 && (p.rescueRecover || p.status !== "swim"); f++) {
    for (const q of s.people.filter((q) => q.status === "queue")) {
      s.select(q.id);
      s.assign(q.type === "beginner" ? 0 : 1);
    }
    s.tick(1 / 60);
  }
  assert.equal(p.status, "swim");
  assert.equal(p.rescueRecover, false);
  assert.ok(
    s.stats.served > 0,
    "A naturally triggered rescue still leaves time to serve customers in level two",
  );
}
// A swimmer walking to the bench is never thrown back along the pool. The coach climbs out of the water on that very side, and a
// collision pushes the swimmer into the margin of the pool's keep-out box; the walk's guard against stepping into the water used to
// send such a swimmer 4.5 m back to the end of the pool every time, again and again for as long as the coach stood there. The coach
// stands in the way of the whole walk here: the swimmer gets by, never moves faster than a walk, never steps into the water, and rests.
{
  for (const level of [3, 12]) {
    const { s, p } = fixture(level);
    const P = s.venue.pool;
    assert.equal(s.startCramp(p), true);
    tick(s, 30);
    const c = s.coach;
    Object.assign(c, { swimming: true, y: -0.39, x: p.x - 0.5, z: p.z, carry: "lifering", carryOwner: 0 });
    s.lifeRings[0].state = "coach";
    for (let f = 0; f < 120 && s.lifeRing.state !== "victim"; f++) s.tick(1 / 60);
    assert.equal(s.lifeRing.state, "victim", "the ring is handed over");
    for (let f = 0; f < 600 && p.exitPhase !== "deck"; f++) s.tick(1 / 60);
    assert.equal(p.exitPhase, "deck", "the swimmer is out on the deck");
    // The coach is out too, standing in the corridor the swimmer walks to the bench by, a little way along it, and does not move.
    const stand = { x: Math.sign(s.venue.rescue.bench.x) * (P.corridorX - 0.1), z: p.z > 0 ? 3.9 : -3.9 };
    Object.assign(c, { swimming: false, waterTransition: null, y: 0, vx: 0, vz: 0, carry: null, ...stand });
    let last = { x: p.x, z: p.z },
      worst = 0;
    for (let f = 0; f < 60 * 30 && p.recoveryStage !== "resting"; f++) {
      Object.assign(c, stand);
      s.tick(1 / 60);
      worst = Math.max(worst, Math.hypot(p.x - last.x, p.z - last.z));
      last = { x: p.x, z: p.z };
      assert.ok(
        !(Math.abs(p.x) < P.deckX && Math.abs(p.z) < P.deckZ),
        `level ${level}: the swimmer walks into the water at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`,
      );
    }
    assert.ok(
      worst < 0.15,
      `level ${level}: the swimmer jumped ${worst.toFixed(2)} m in one tick (a walk is 0.05)`,
    );
    assert.equal(
      p.recoveryStage,
      "resting",
      `level ${level}: the swimmer gets by the coach and rests on the bench`,
    );
  }
}
console.log(
  "Rescue checks passed: level gating, natural mid-pool onset, frozen lanes, mandatory ring/dive, real keyboard travel and swimming, automatic handoff, exit-only resumption, four-second seated recovery, original workout, physical ring collection/return, a swimmer walking to the bench past a coach standing in the way (never thrown back along the pool), pause, and no swimming outside rescues.",
);
