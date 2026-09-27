// Assignment/equipment baseline: rescue-check.mjs separately drives mandatory life-ring rescues.
import assert from "node:assert/strict";
import { PoolSimulation, CIRCUIT, STATIONS } from "./dist/sim.mjs";
import { isDeckPosition } from "./dist/spatial.mjs";
const isolated = (level = 1) => {
  const s = new PoolSimulation(level, 391);
  s.schedule = [];
  s.start();
  return s;
};
function advance(s, seconds) {
  for (let t = 0; t < seconds; t += 1 / 60) s.tick(1 / 60);
}
function swimmer(s, type, lane, p = 0) {
  const a = s.spawn({ type });
  Object.assign(a, {
    status: "swim",
    lane,
    p,
    needsFins: false,
    hasFins: false,
    sick: false,
    queasy: false,
    h: 100,
  });
  return a;
}
{
  const s = isolated();
  for (let i = 0; i < 10; i++) {
    const p = s.spawn({ type: "beginner" });
    s.select(p.id);
    assert.equal(s.assign(0), true);
  }
  assert.equal(s.occupancy(0), 10, "Lane occupancy must not be capped");
}
{
  const s = isolated();
  const slow = swimmer(s, "beginner", 0, 8),
    fast = swimmer(s, "advanced", 0, 6.2),
    mid = swimmer(s, "intermediate", 0, 4.4);
  s.updateLane(0, 0.016);
  assert.ok(fast.actualSpeed <= slow.actualSpeed + 0.001, "Circle traffic must propagate the slowest pace");
  assert.ok(mid.actualSpeed <= slow.actualSpeed + 0.001);
  const split = isolated();
  const a = swimmer(split, "beginner", 0, 8),
    b = swimmer(split, "advanced", 0, 6.2);
  split.updateLane(0, 0.016);
  assert.ok(b.actualSpeed > a.actualSpeed * 2, "Split lanes must remain independent");
}
{
  const s = isolated();
  const a = swimmer(s, "advanced", 1, 30);
  a.problem = "eyes";
  const b = swimmer(s, "intermediate", 1, 28.8);
  swimmer(s, "beginner", 1, 27.6);
  s.updateLane(1, 0.016);
  assert.equal(a.actualSpeed, 0);
  assert.equal(b.actualSpeed, 0, "Incidents must block the moving queue");
}
{
  const s = isolated();
  s.contamination = 70;
  s.chlorine = 45;
  s.coach.carry = "chlorine";
  s.coach.x = 5.8;
  s.coach.z = 1;
  s.deliverWater(0);
  assert.equal(s.contamination, 24);
  assert.equal(s.chlorine, 82);
  const p = swimmer(s, "beginner", 0);
  p.chlorineTolerance = 65;
  p.workTarget = 1000;
  advance(s, 6);
  assert.equal(p.problem, "eyes", "Too much chlorine must cause eye irritation");
}
{
  const s = isolated();
  const p = s.spawn({ type: "advanced" });
  p.needsFins = true;
  s.coach.x = -10.3;
  s.coach.z = 8.8;
  assert.ok(s.fetch("fins"));
  assert.equal(s.finsAvailable, 2);
  s.coach.x = p.x;
  s.coach.z = p.z + 1;
  assert.ok(s.deliver(p.id));
  assert.ok(p.hasFins);
  s.depart(p, false);
  assert.equal(s.clutter.length, 1);
  assert.equal(s.finsAvailable, 2);
  s.coach.x = s.clutter[0].x;
  s.coach.z = s.clutter[0].z + 0.8;
  assert.ok(s.pickup(s.clutter[0].id));
  assert.equal(s.coach.carry, "fins");
  assert.equal(s.returnItem(), false);
  s.coach.x = -10.3;
  s.coach.z = 8.8;
  assert.ok(s.returnItem());
  assert.equal(s.finsAvailable, 3);
  assert.equal(s.clutter.length, 0);
}
{
  const s = isolated(3);
  const sick = swimmer(s, "beginner", 1);
  sick.sick = true;
  sick.stomachDelay = 0;
  sick.sicknessTimer = 0.01;
  swimmer(s, "advanced", 0);
  s.updateLane(1, 0.02);
  assert.equal(s.closed, 1);
  assert.equal(s.score, -500);
  assert.ok(!s.people.some((p) => p.status === "swim"));
  const waiting = s.spawn({ type: "beginner" });
  s.select(waiting.id);
  assert.equal(s.assign(0), false);
  advance(s, 12.2);
  assert.equal(s.closed, 1, "The new incident requires a physical cleanup");
  assert.ok(s.cleanup);
  assert.ok(s.contamination > 50);
}
{
  const s = isolated(3);
  const p = s.spawn({ type: "intermediate", sick: true });
  s.select(p.id);
  s.home();
  assert.equal(s.score, 100);
  const healthy = s.spawn({ type: "advanced" });
  healthy.sick = false;
  s.select(healthy.id);
  s.home();
  assert.equal(s.score, 50);
}
{
  const s = isolated();
  for (let i = 0; i < 8; i++) {
    const p = swimmer(s, "beginner", 0);
    s.depart(p, true);
  }
  assert.equal(s.multiplier(), 2);
  assert.equal(s.bestStreak, 8);
  assert.ok(s.score > 2300);
  const p = s.spawn({ type: "beginner" });
  s.lose(p);
  assert.equal(s.streak, 0);
}
const runs = [];
for (let level = 1; level <= 3; level++)
  for (const seed of [4, 31, 821]) {
    const s = new PoolSimulation(level, seed);
    s.start();
    for (let t = 0; t < s.config.duration + 0.1; t += 1 / 60) {
      // Exercise full shifts while the keyboard coach takes a real, collision-resolved deck route.
      if (t % 8 < 4) s.setMovement(1, 0);
      else s.setMovement(-1, 0);
      for (const p of s.people.filter((p) => p.stomachWarning)) {
        s.select(p.id);
        s.home();
      }
      for (const p of s.people.filter((p) => p.status === "queue")) {
        p.crampAt = Infinity;
        s.select(p.id);
        if (p.queasy && p.sick) {
          s.home();
          continue;
        }
        s.assign(p.type === "beginner" || p.type === "aqua" ? 0 : p.type === "advanced" ? 2 : 1);
      }
      s.tick(1 / 60);
      assert.ok(isDeckPosition(s.coach.x, s.coach.z));
      for (const p of s.people)
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.h) && Number.isFinite(p.z));
      const inventory =
        s.finsAvailable +
        (s.coach.carry === "fins" ? 1 : 0) +
        s.people.filter((p) => p.hasFins).length +
        s.clutter.filter((p) => p.type === "fins").length;
      assert.equal(inventory, 3);
    }
    assert.equal(s.status, "ended");
    assert.equal(s.nextArrival, s.config.total);
    assert.ok(s.stats.served > 0);
    runs.push({ level, seed, ...s.summary() });
  }
console.log(
  "Simulation checks passed: lane rules, chemistry, physical fin returns, closures, scoring, and nine complete shifts.",
);
console.table(
  runs.map(({ level, seed, score, stars, served, lost }) => ({ level, seed, score, stars, served, lost })),
);
