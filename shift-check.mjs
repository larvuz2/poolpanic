// Assignment/equipment baseline: rescue-check.mjs separately drives mandatory life-ring rescues.
import assert from "node:assert/strict";
import { PoolSimulation, SHIFTS, TYPES } from "./dist/sim.mjs";
import {
  ENTRY,
  ARRIVAL,
  screenMovement,
  isDeckPosition,
  createCoach,
  queuePosition,
} from "./dist/spatial.mjs";
import { normalizeRecords, recordResult, starsFor } from "./dist/progression.mjs";
const tick = (s, frames) => {
  for (let i = 0; i < frames; i++) s.tick(1 / 60);
};
{
  for (const level of [1, 4, 10]) {
    const s = new PoolSimulation(level, 47);
    s.start({ countdown: true });
    assert.equal(s.status, "countdown");
    assert.equal(s.countdown, 3);
    s.jump();
    assert.equal(s.coach.jumpBuffer, 0);
    assert.equal(s.dash(), false);
    tick(s, 60);
    assert.equal(s.time, 0);
    assert.equal(s.people.length, 0);
    s.status = "paused";
    const held = s.countdown;
    tick(s, 120);
    assert.equal(s.countdown, held, "Pause preserves countdown");
    s.status = "countdown";
    tick(s, 120);
    assert.equal(s.status, "playing");
    assert.equal(s.time, 0, "Countdown must not consume shift time");
    assert.deepEqual(
      s.events.filter((e) => e.type === "countdown").map((e) => e.value),
      [3, 2, 1],
    );
    assert.equal(s.events.filter((e) => e.type === "go").length, 1);
    tick(s, 180);
    assert.equal(s.people.length, 0, "First arrival waits at least three seconds after countdown");
    tick(s, 30);
    assert.equal(s.people.length, 1);
    assert.equal(s.people[0].status, "arriving");
    assert.ok(isDeckPosition(s.coach.x, s.coach.z));
  }
}
{
  for (const side of [-1, 1])
    for (let lane = 0; lane < 3; lane++) {
      const s = new PoolSimulation(1, 21);
      s.schedule = [];
      s.start();
      if (side === 1) s.spawn({ type: "beginner" }).status = "gone";
      const p = s.spawn({ type: "beginner" });
      assert.equal(p.side, side);
      s.select(p.id);
      s.assign(lane);
      assert.ok(
        p.path.every((v) => v.z <= -5.8),
        "Entry stays beside the locker rooms",
      );
      let previous = { x: p.x, z: p.z },
        length = 0;
      for (const point of p.path) {
        length += Math.hypot(point.x - previous.x, point.z - previous.z);
        previous = point;
      }
      assert.ok(length < 18, "No full-length trip to the opposite end");
      tick(s, 6 * 60);
      assert.equal(p.status, "swim");
      assert.equal(p.lane, lane);
      assert.ok(p.z < 0, "Swimmer enters from the relocated block end");
      s.depart(p, false);
      assert.ok(
        p.path.every((v) => v.z < 0),
        "Exit returns by the lockers",
      );
    }
}
{
  assert.equal(SHIFTS.length, 10);
  const fresh = normalizeRecords();
  assert.equal(fresh.unlocked, 1);
  assert.equal(fresh.bests.length, 10);
  const saved = normalizeRecords({ bests: [1644, 3100, 0], unlocked: 3 });
  assert.deepEqual(saved.bests.slice(0, 3), [1644, 3100, 0]);
  assert.equal(saved.unlocked, 3);
  assert.equal(starsFor(2, 3100), 3);
  recordResult(saved, 3, 50);
  assert.equal(saved.unlocked, 3, "A failed shift does not unlock the next level");
  for (let n = 3; n <= 10; n++) {
    assert.equal(recordResult(saved, n, SHIFTS[n - 1].thresholds[0]), true);
    assert.equal(saved.unlocked, Math.min(n + 1, 10));
  }
  assert.equal(saved.bests.length, 10);
  assert.equal(normalizeRecords(JSON.parse(JSON.stringify(saved))).unlocked, 10);
  assert.deepEqual(screenMovement(1, 0), { x: -0, z: 1 });
  assert.deepEqual(screenMovement(0, -1), { x: 1, z: 0 });
  assert.equal(TYPES.advanced.label, "Pro");
  assert.equal(TYPES.intermediate.label, "Intermediate");
  assert.equal(TYPES.beginner.label, "Beginner");
}
for (let level = 4; level <= 10; level++) {
  const s = new PoolSimulation(level, 821);
  s.start({ countdown: true });
  tick(s, 180);
  for (let i = 0; i < Math.ceil(s.config.duration * 60) + 2; i++) {
    for (const p of s.people.filter((p) => p.stomachWarning)) {
      s.select(p.id);
      s.home();
    }
    for (const p of s.people.filter((p) => p.status === "queue")) {
      p.crampAt = Infinity;
      s.select(p.id);
      if (p.queasy && p.sick) s.home();
      else s.assign(p.type === "beginner" || p.type === "aqua" ? 0 : p.type === "advanced" ? 2 : 1);
    }
    s.tick(1 / 60);
    assert.ok(Number.isFinite(s.score));
    assert.equal(
      s.finsAvailable +
        (s.coach.carry === "fins" ? 1 : 0) +
        s.people.filter((p) => p.hasFins).length +
        s.clutter.filter((p) => p.type === "fins").length,
      3,
    );
  }
  assert.equal(s.status, "ended");
  assert.equal(s.nextArrival, s.config.total);
  assert.ok(s.stats.served > 0, "Every level runs to a playable result");
}
console.log(
  "Shift checks passed: 3–2–1 and pause/resume, no lost shift time, short entry/exit paths for both lockers and all lanes, saved progress migration, ten unlocks, labels, controls, and seven complete new shifts.",
);

// First shift rewards learning to assign, with generous reaction time and no errands.
for (const seed of [4, 31, 821])
  for (const limit of [2, 4]) {
    const s = new PoolSimulation(1, seed);
    s.start({ countdown: true });
    tick(s, 180);
    for (let frame = 0; frame < 1801; frame++) {
      for (const p of s.people.filter((p) => p.status === "queue" && p.wait >= 3 && p.id <= limit)) {
        s.select(p.id);
        s.assign(p.type === "beginner" ? 0 : 1);
      }
      s.tick(1 / 60);
    }
    assert.equal(s.config.duration, 30);
    assert.equal(s.status, "ended");
    assert.equal(s.nextArrival, 4);
    assert.equal(s.stats.served, limit);
    assert.equal(
      s.summary().stars,
      3,
      "Two happy completions earn three stars even when the other swimmers are left waiting",
    );
    assert.equal(s.stats.catastrophes, 0);
    assert.ok(s.people.every((p) => !p.sick && !p.queasy && !p.needsFins));
  }
console.log(
  "Warm-up checks passed: 30 seconds, four gentle arrivals, three-second player reaction time, no equipment/sickness, and easy three-star results with two completions.",
);

{
  const coach = createCoach();
  assert.equal(coach.z, 0);
  assert.ok(isDeckPosition(coach.x, coach.z));
  for (const side of [-1, 1])
    for (let slot = 0; slot < 14; slot++) {
      const p = queuePosition(side, slot);
      assert.ok(p.z < -10.5, "Waiting swimmers stay behind the starting blocks");
      assert.ok(isDeckPosition(p.x, p.z), "Every waiting slot sits on clear deck");
    }
  const s = new PoolSimulation(3, 17);
  s.schedule = [];
  s.start();
  const people = Array.from({ length: 27 }, () => s.spawn({ type: "beginner" }));
  assert.equal(new Set(people.map((p) => p.x + "," + p.z)).size, 27);
  s.select(people[0].id);
  s.assign(1);
  s.select(people[2].id);
  s.assign(1);
  const next = s.spawn({ type: "beginner" });
  assert.ok(
    s.people
      .filter((p) => p.status === "queue" && p.side === next.side && p.id !== next.id)
      .every((p) => p.x !== next.x || p.z !== next.z),
    "New arrivals reuse free slots without overlapping existing swimmers",
  );
}
console.log(
  "Layout checks passed: central coach start, 28 clear waiting slots behind the blocks, and unique occupied queue positions.",
);
