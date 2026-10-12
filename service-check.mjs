import assert from "node:assert/strict";
import { PoolSimulation } from "./dist/sim.mjs";
import { RING_MOUNTS, LANES, STATIONS, isDeckPosition } from "./dist/spatial.mjs";
const game = () => {
  const s = new PoolSimulation(3, 12);
  s.schedule = [];
  s.start();
  return s;
};
const at = (s, x, z) => {
  assert.ok(isDeckPosition(x, z));
  Object.assign(s.coach, { x, z, y: 0, vx: 0, vz: 0 });
};
const swimmer = (s, lane, x, z) => {
  const p = s.spawn({ type: "intermediate", sick: false });
  Object.assign(p, {
    status: "swim",
    lane,
    x,
    z,
    needsFins: true,
    hasFins: false,
    problem: "fins",
    crampAt: Infinity,
  });
  return p;
};
for (const item of ["fins", "relief", "goggles"])
  for (const lane of [0, 1, 2])
    for (const end of [-1, 1]) {
      const s = game(),
        p = swimmer(s, lane, LANES[lane], end * 6.5);
      p.problem = item === "relief" ? "eyes" : item === "goggles" ? "goggles" : "fins";
      s.coach.carry = item;
      s.coach.carryOwner = p.id;
      at(s, LANES[lane] + 1.15, end * 9.55);
      assert.ok(s.swimmerInReach(p), "More than the old reach works at both ends");
      assert.ok(s.interact());
      assert.equal(s.coach.carry, null);
      assert.equal(p.problem, null);
    }
for (const lane of [0, 2])
  for (const offset of [-0.6, 0.6]) {
    const s = game(),
      p = swimmer(s, lane, LANES[lane] + offset, 2);
    s.coach.carry = "fins";
    at(s, lane === 0 ? -5.9 : 5.9, 2);
    assert.ok(s.interact());
    assert.ok(p.hasFins, "Outer lanes can receive fins mid-pool on either side of their loop");
  }
{
  const s = game(),
    p = swimmer(s, 1, 0, 0);
  s.coach.carry = "fins";
  at(s, -5.9, 0);
  assert.equal(s.deliver(p.id), false, "Middle lane cannot receive a side handoff");
  assert.equal(p.hasFins, false);
  p.x = -3.2;
  p.lane = 0;
  at(s, -7.1, 0);
  assert.equal(s.deliver(p.id), false, "Handoff still has a finite range");
}
{
  const s = game();
  at(s, -9.3, 7.8);
  assert.ok(s.fetch("fins"));
  assert.equal(s.finsAvailable, 2);
  assert.ok(s.interact(), "Second E drops even beside rack");
  assert.equal(s.coach.carry, null);
  assert.equal(s.clutter.length, 1);
  const f = s.clutter[0];
  const p = s.spawn({ type: "beginner", sick: false });
  Object.assign(p, { status: "enter", lane: 0, x: f.x, z: f.z, path: [{ x: -6.3, z: 7.8 }], h: 100 });
  s.coach.x = -6.5;
  s.coach.z = 6;
  s.tick(1 / 60);
  assert.equal(p.h, 94);
  assert.ok(p.annoyedTime > 0);
  assert.ok(p.slipTime > 0);
  assert.equal(s.clutter.length, 1, "Tripping does not remove fins");
  for (let n = 0; n < 30; n++) s.tick(1 / 60);
  assert.equal(p.h, 94, "No repeated penalty while stumbling");
  at(s, f.x + 0.7, f.z);
  assert.ok(s.pickup(f.id));
  assert.equal(s.clutter.length, 0);
  at(s, -9.3, 7.8);
  assert.ok(s.returnItem());
  assert.equal(s.finsAvailable, 3, "Drop, trip, pickup and return conserve all three pairs");
}
for (const [id, mount] of RING_MOUNTS.entries()) {
  const s = game(),
    p = swimmer(s, 1, 0, 0);
  p.problem = null;
  assert.ok(s.startCramp(p));
  const approach = { x: mount.x + Math.sin(mount.angle) * 1.1, z: mount.z + Math.cos(mount.angle) * 1.1 };
  at(s, approach.x, approach.z);
  assert.ok(s.interact());
  assert.equal(s.coach.carryOwner, id);
  assert.equal(s.lifeRings.filter((r) => r.state === "wall").length, 2);
  assert.ok(s.returnItem());
  assert.equal(s.lifeRings[id].state, "wall");
  assert.ok(s.fetch("lifering", id));
  at(s, -6.3, 0);
  s.tick(1 / 60);
  assert.equal(s.coach.waterTransition?.kind, "dive", "Every life ring enables automatic entry");
}
// Fins first: a swimmer who asks for fins in the queue cannot be given a lane until the coach hands a pair over; then the lane is
// theirs. About one swimmer in twelve asks this way (none on level 1, and never a daredevil or a VIP).
{
  const s = game();
  const p = s.spawn({ type: "intermediate", sick: false });
  Object.assign(p, { needsFins: true, midFins: false, finsFirst: true, hasFins: false, problem: "fins" });
  s.select(p.id);
  s.events.length = 0;
  assert.equal(s.assign(1), false, "no lane before the fins");
  assert.equal(p.status, "queue");
  assert.ok(
    s.events.some((e) => e.type === "toast" && /won't swim without fins/.test(e.text)),
    "the player is told why",
  );
  // The coach fetches a pair at the rack and hands it over in the queue.
  const rack = s.venue.stations.fins;
  const beside = [
    [0.9, 0],
    [-0.9, 0],
    [0, 0.9],
    [0, -0.9],
  ].find(([dx, dz]) => isDeckPosition(rack.x + dx, rack.z + dz));
  at(s, rack.x + beside[0], rack.z + beside[1]);
  assert.ok(s.fetch("fins"));
  for (let i = 0; i < 30; i++) s.tick(1 / 60);
  assert.equal(s.coach.carry, "fins");
  const spot = s.servicePoint(p);
  at(s, spot.x, spot.z);
  assert.ok(s.deliver(p.id), "the fins can be handed over in the queue");
  for (let i = 0; i < 60 && s.coach.busy; i++) s.tick(1 / 60);
  assert.ok(p.hasFins && p.problem === null, "fins on, nothing more to ask");
  s.select(p.id);
  assert.equal(s.assign(1), true, "and now a lane");
  let asked = 0,
    total = 0;
  for (const level of [1, 2, 6, 12, 18]) {
    const t = new PoolSimulation(level, 7);
    for (let i = 0; i < 150; i++) t.spawn({});
    for (const q of t.people) {
      total++;
      if (q.finsFirst) {
        asked++;
        assert.ok(
          level >= 2 && q.needsFins && !q.midFins && q.problem === "fins" && !q.vip && q.type !== "daredevil",
        );
      }
    }
  }
  assert.ok(
    asked / total > 0.01 && asked / total < 0.08,
    "some swimmers ask first (" + asked + " of " + total + ")",
  );
}
console.log(
  "Fins first: a swimmer asking in the queue gets no lane until the fins are handed over. " +
    "Service checks passed: doubled handoffs, both ends, both outer-lane tracks, middle-lane restriction, E-drop priority, angry trip feedback, small single penalty, fin inventory, all three ring pickups/returns, and automatic rescue entry.",
);
