import assert from "node:assert/strict";
import { PoolSimulation } from "./dist/sim.mjs";
import { ARRIVAL, doorOpening } from "./dist/spatial.mjs";
import { PoolAudio } from "./dist/audio.mjs";
const tick = (s, frames) => {
  for (let i = 0; i < frames; i++) s.tick(1 / 60);
};
for (const level of [1, 5, 10]) {
  const s = new PoolSimulation(level, 174);
  s.start({ countdown: true });
  tick(s, 180);
  assert.equal(s.status, "playing");
  assert.equal(s.people.length, 0);
  tick(s, 180);
  assert.equal(s.people.length, 0, "Three quiet seconds follow the countdown");
  while (!s.people.length) s.tick(1 / 60);
  assert.ok(s.time >= 3 && s.time <= 5);
  const p = s.people[0];
  assert.equal(p.status, "arriving");
  // (behind the MEN's door in the back wall: the club has no locker rooms since 30 October 2026)
  assert.deepEqual({ x: p.x, z: p.z }, ARRIVAL.at(-1, "inside"));
  assert.equal(p.wait, 0);
  assert.ok(s.doors[-1] > 0);
  assert.equal(s.events.filter((e) => e.type === "door-open").length, 1);
  s.select(p.id);
  assert.equal(s.selected, null, "Swimmer becomes selectable only after stepping onto deck");
  const start = { x: p.x, z: p.z };
  tick(s, 12);
  assert.deepEqual({ x: p.x, z: p.z }, start, "Door has time to swing before the walk begins");
  s.status = "paused";
  const remaining = s.doors[-1];
  tick(s, 120);
  assert.equal(s.doors[-1], remaining);
  s.status = "playing";
  let previous = { x: p.x, z: p.z };
  while (p.status === "arriving") {
    s.tick(1 / 60);
    assert.ok(Math.hypot(p.x - previous.x, p.z - previous.z) < 0.09, "Entrance walk is continuous");
    previous = { x: p.x, z: p.z };
    assert.equal(p.wait, 0, "No lost patience inside the doorway");
  }
  assert.equal(p.status, "queue");
  assert.equal(p.h, 100);
  // (5.5 s since the doors moved into the back wall, 30 October 2026: a few steps further than from the locker rooms)
  assert.ok(s.time <= 6, "First swimmer reaches the deck within six seconds");
  assert.equal(p.x, p.queueTarget.x);
  assert.equal(p.z, p.queueTarget.z);
  s.select(p.id);
  assert.equal(s.selected, p.id);
  tick(s, 80);
  assert.equal(s.doors[-1], 0, "Door closes after passage");
  while (s.people.length < 2) s.tick(1 / 60);
  assert.equal(s.people[1].side, 1);
  assert.ok(s.doors[1] > 0, "The other locker opens for the next arrival");
  const retry = new PoolSimulation(level, 174);
  retry.start({ countdown: true });
  assert.deepEqual(retry.doors, { "-1": 0, 1: 0 });
  assert.equal(retry.schedule[0].at, ARRIVAL.firstDelay);
}
// Both successful returns and lost customers use the same physical doorway.
for (const side of [-1, 1])
  for (const outcome of ["served", "lost"]) {
    const s = new PoolSimulation(1, 31);
    s.schedule = [];
    s.start();
    if (side === 1) s.spawn().status = "gone";
    const p = s.spawn({ type: "beginner" });
    if (outcome === "served") s.depart(p, true);
    else s.lose(p);
    let crossed = false;
    for (let frame = 0; frame < 360 && p.status !== "gone"; frame++) {
      const before = { x: p.x, z: p.z };
      s.tick(1 / 60);
      // (through the doorway in the back wall: across the door's line along z, at the door's x)
      if (before.z > ARRIVAL.doorZ && p.z <= ARRIVAL.doorZ && Math.abs(p.x - side * ARRIVAL.doorX) < 0.1) {
        crossed = true;
        assert.ok(doorOpening(s.doors[side]) > 0.99, "Return door opens before a swimmer crosses");
      }
    }
    assert.ok(crossed);
    assert.equal(p.status, "gone");
    assert.deepEqual({ x: p.x, z: p.z }, ARRIVAL.at(side, "inside"));
    assert.equal(
      s.events.filter((e) => e.type === "door-open").length,
      0,
      "Returning swimmers do not trigger the new-arrival chime",
    );
    tick(s, 150);
    assert.equal(s.doors[side], 0);
    // A door that is already closing reopens smoothly when another swimmer approaches.
    s.doors[side] = 0.2;
    const before = doorOpening(0.2);
    s.keepDoorOpen(side);
    assert.ok(Math.abs(before - doorOpening(s.doors[side])) < 0.00001);
  }
{
  const s = new PoolSimulation(1, 12);
  s.schedule = [];
  s.start();
  s.time = s.config.duration - 0.005;
  const p = s.spawn({ type: "beginner", entrance: true });
  s.tick(1 / 60);
  assert.equal(s.status, "ended");
  assert.equal(p.status, "gone", "A shift cannot leave an arrival stranded");
  assert.equal(s.stats.lost, 1);
  assert.equal(doorOpening(0), 0);
  assert.equal(doorOpening(ARRIVAL.doorDuration), 0);
  assert.equal(doorOpening(1), 1);
  assert.ok(doorOpening(2) > 0 && doorOpening(2) < 1);
  const a = new PoolAudio();
  a.ctx = { currentTime: 10 };
  const tones = [],
    noises = [];
  a.tone = (...v) => tones.push(v);
  a.noise = (...v) => noises.push(v);
  a.effect("door-open");
  assert.equal(tones.length, 3);
  assert.equal(noises.length, 1);
  assert.equal(tones[0][1], 10);
  a.enabled = false;
  a.effect("door-open");
  assert.equal(tones.length, 3);
}
console.log(
  "Arrival checks passed: delayed first arrival, audible door cue, anticipation hold, continuous walk, queue activation, paused doors, alternating doors, retries, closure, and end-of-shift cleanup.",
);
