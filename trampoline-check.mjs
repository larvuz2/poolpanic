// Resort trampoline: clean flips, emptying the splash lane with mid-swim lane moves, and the full crash →
// rings for every victim → first aid on deck loop, all with real coach movement.
import assert from "node:assert/strict";
import { PoolSimulation, CIRCUIT } from "./dist/sim.mjs";
import { tick, go } from "./check-helpers.mjs";

function resort(seed = 3) {
  const s = new PoolSimulation(11, seed);
  assert.equal(s.venue.id, "resort");
  assert.equal(s.lanes.length, 5, "The resort pool has two extra lanes");
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  return s;
}
function swimmer(s, lane, p, type = "intermediate") {
  const a = s.spawn({ type, sick: false });
  Object.assign(a, {
    status: "swim",
    lane,
    p,
    workTarget: 999,
    workTime: 4,
    traveled: 6,
    needsFins: false,
    crampAt: Infinity,
    h: 90,
  });
  s.updateLane(lane, 0.001);
  return a;
}
function daredevil(s) {
  const d = s.spawn({ type: "daredevil", sick: false });
  assert.equal(d.type, "daredevil");
  s.select(d.id);
  return d;
}
const tr = (s) => s.venue.trampoline;

// 1) A clean flip into an empty splash lane.
{
  const s = resort(3);
  const d = daredevil(s);
  assert.equal(s.assign(tr(s).lane), false, "Daredevils refuse ordinary lanes");
  assert.ok(s.assignTrampoline());
  assert.equal(d.status, "trampoline");
  const stages = new Set();
  let maxY = 0;
  for (let f = 0; f < 60 * 25 && d.status === "trampoline"; f++) {
    tick(s);
    stages.add(d.jumpStage);
    maxY = Math.max(maxY, d.y || 0);
  }
  assert.deepEqual(
    [...stages].filter(Boolean),
    ["toStairs", "waiting", "climbing", "boarding", "bouncing", "flipping"].map((x) =>
      x === "flipping" ? "flying" : x,
    ),
    "Walk, check the lane, climb, board, bounce and flip",
  );
  assert.ok(maxY > 4.5, "The flip goes high above the tower");
  assert.equal(d.status, "exit");
  assert.equal(s.stats.flips, 1);
  assert.ok(s.score >= 250);
  for (let f = 0; f < 60 * 20 && d.status !== "gone"; f++) tick(s);
  assert.equal(d.status, "gone", "The daredevil swims out and goes home happy");
}

// 2) Empty the splash lane by moving its swimmer; the daredevil jumps safely.
{
  const s = resort(5);
  const lane = tr(s).lane;
  const busy = swimmer(s, lane, 9);
  const d = daredevil(s);
  s.assignTrampoline();
  for (let f = 0; f < 60 * 15 && d.jumpStage !== "waiting"; f++) tick(s);
  assert.equal(d.jumpStage, "waiting", "A busy splash lane makes the daredevil wait");
  assert.equal(s.laneBlocked(), lane);
  const queued = s.spawn({ type: "beginner", sick: false });
  s.select(queued.id);
  assert.equal(s.assign(lane), false, "No new swimmers into the splash zone");
  const progress = [busy.workTime, busy.traveled];
  s.select(busy.id);
  assert.ok(s.assign(lane - 1), "Selecting a swimmer in the water and a lane moves them");
  assert.equal(busy.status, "switch");
  for (let f = 0; f < 240 && busy.status === "switch"; f++) tick(s);
  assert.equal(busy.status, "swim");
  assert.equal(busy.lane, lane - 1);
  assert.ok(Math.abs(busy.x - s.lanes[lane - 1]) < 0.7, "They surface in their new lane");
  assert.deepEqual(
    [busy.workTime >= progress[0], busy.traveled >= progress[1]],
    [true, true],
    "Workout progress is kept",
  );
  for (let f = 0; f < 60 * 12 && d.status === "trampoline"; f++) tick(s);
  assert.equal(s.stats.crashes || 0, 0);
  assert.equal(s.stats.flips, 1, "With the lane clear the flip lands safely");
}

// 3) Impatience → crash → a ring for every victim → first aid on deck.
{
  const s = resort(9);
  const lane = tr(s).lane,
    landP = tr(s).landZ + 7.2;
  const victim = swimmer(s, lane, landP - 0.4, "beginner");
  const other = swimmer(s, 1, 12);
  const d = daredevil(s);
  s.assignTrampoline();
  // Keep the victim loitering in the splash zone while the daredevil loses patience.
  for (let f = 0; f < 60 * 45 && !s.rescue; f++) {
    if (victim.status === "swim") victim.p = landP;
    tick(s);
  }
  assert.equal(s.rescue?.kind, "crash", "An impatient daredevil crashes into the occupied lane");
  assert.equal(s.stats.crashes, 1);
  assert.deepEqual(new Set(s.rescue.victims), new Set([d.id, victim.id]));
  assert.ok([d, victim].every((v) => v.problem === "injured"));
  const frozen = [other.x, other.z, other.p];
  const clock = s.time;
  tick(s, 60);
  assert.deepEqual([other.x, other.z, other.p], frozen, "Every swimmer stops");
  assert.equal(s.time, clock, "The shift clock waits during the crash rescue");
  // One ring per victim: fetch, dive, deliver, climb out, repeat.
  for (let n = 0; n < 2; n++) {
    const ring = s.lifeRings
      .filter((r) => r.state === "wall")
      .sort(
        (a, b) => Math.hypot(a.x - s.coach.x, a.z - s.coach.z) - Math.hypot(b.x - s.coach.x, b.z - s.coach.z),
      )[0];
    go(s, ring.mount.x + Math.sin(ring.mount.angle) * 1.1, ring.mount.z + Math.cos(ring.mount.angle) * 1.1);
    assert.equal(s.nearestInteraction()?.kind, "lifering");
    assert.ok(s.interact());
    const stranded = s.strandedVictims().length;
    assert.equal(stranded, 2 - n, "Victims already ringed or on deck are not waiting for a ring");
    const side = Math.sign(s.coach.x) || -1;
    go(s, side * (s.venue.pool.solidX + 0.7), s.strandedVictims()[0].z);
    s.setMovement(-side, 0);
    for (let f = 0; f < 120 && !s.coach.swimming; f++) tick(s);
    assert.ok(s.coach.swimming, "Carrying a ring during a crash allows the rescue dive");
    // Swim to whichever stranded victim is closest; the ring transfers on contact.
    for (let f = 0; f < 900 && s.strandedVictims().length === stranded; f++) {
      const target = s
        .strandedVictims()
        .sort(
          (a, b) =>
            Math.hypot(a.x - s.coach.x, a.z - s.coach.z) - Math.hypot(b.x - s.coach.x, b.z - s.coach.z),
        )[0];
      const dx = target.x - s.coach.x,
        dz = target.z - s.coach.z,
        m = Math.hypot(dx, dz) || 1;
      s.setMovement(dx / m, dz / m);
      tick(s);
    }
    assert.equal(s.strandedVictims().length, stranded - 1, "The ring reaches a victim");
    assert.equal(s.coach.carry, null);
    s.setMovement(Math.sign(s.coach.x) || 1, 0);
    for (let f = 0; f < 600 && (s.coach.swimming || s.coach.waterTransition); f++) tick(s);
    s.clearInput();
    assert.ok(!s.coach.swimming);
  }
  for (let f = 0; f < 60 * 10 && s.rescue; f++) tick(s);
  assert.equal(s.rescue, null, "The pool resumes once every victim is out of the water");
  assert.ok(
    [d, victim].every((v) => v.status === "injured"),
    "Victims lie on the deck",
  );
  for (let f = 0; f < 600 && [d, victim].some((v) => v.path.length); f++) tick(s);
  for (const v of [d, victim])
    assert.ok(s.isDeck(v.x, v.z) || s.venue.isDeck(v.x, v.z, s.level, 0), "…on the deck, not in the pool");
  assert.ok(Math.hypot(d.x - victim.x, d.z - victim.z) > 1.3, "Victims lie apart, not in a heap");
  // Medical kit to each victim.
  const cab = s.venue.fixtures.medkit;
  assert.equal(s.tendInjured(victim.id), false, "Without the kit, clicking a victim points to the cabinet");
  assert.deepEqual([s.coach.goal.x, s.coach.goal.z], [cab.x, cab.z]);
  go(s, cab.x + 1.1, cab.z);
  assert.equal(s.nearestInteraction()?.kind, "medkit");
  assert.ok(s.useFixture("medkit"), "Clicking the cabinet in reach grabs the kit");
  assert.equal(s.coach.carry, "medkit");
  for (const v of [victim, d]) {
    // Stand on the far side from the other victim, then click this one.
    const other = v === d ? victim : d;
    go(s, v.x + (Math.sign(v.x - other.x) || 1) * 0.9, v.z - 0.5);
    assert.equal(s.nearestInteraction()?.kind, "heal", "Beside " + v.name + " the kit patches them up");
    assert.ok(s.tendInjured(v.id), "Clicking " + v.name + " starts first aid");
    assert.ok(s.coach.busy);
    tick(s, 80);
    assert.equal(v.problem, null);
    assert.ok(v.bandaged, "Healed swimmers keep their bandage");
  }
  assert.equal(d.status, "exit", "The daredevil heads home: worth it");
  assert.ok(["enter", "swim"].includes(victim.status), "The lap swimmer returns to the pool");
  assert.equal(victim.lane, lane);
  go(s, cab.x + 1.1, cab.z);
  assert.ok(s.interact());
  assert.equal(s.coach.carry, null);
  assert.equal(s.medkit.state, "cabinet");
}
console.log(
  "Trampoline checks passed: five-lane resort, daredevils refuse lanes, walk/climb/board/bounce/flip, splash-lane lock, mid-swim lane moves keep progress, crash freezes the pool and clock, one ring per victim, victims lie on deck, med kit patches everyone, kit returned.",
);
