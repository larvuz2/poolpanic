import assert from "node:assert/strict";
import { PoolSimulation, LANES } from "./dist/sim.mjs";
import { ARRIVAL } from "./dist/spatial.mjs";
import { onDeck } from "./dist/deck-physics.mjs";

let cases = 0;
for (const end of [-1, 1])
  for (const side of [-1, 1])
    for (const lane of [0, 1, 2])
      for (const type of ["beginner", "aqua"]) {
        const s = new PoolSimulation(3, 12);
        s.schedule = [];
        s.start();
        const p = s.spawn({ type, sick: false });
        Object.assign(p, {
          status: "swim",
          side,
          lane,
          x: LANES[lane],
          z: end * 3,
          p: end > 0 ? 10 : 24,
          hasFins: true,
          needsFins: false,
        });
        s.finsAvailable = 2;
        s.depart(p, true);
        assert.equal(p.exitEnd, end);
        assert.equal(p.exitPhase, "water");
        assert.equal(p.hasFins, true, "Equipment stays with the swimmer until they reach the deck");
        let climbed = false,
          walked = false,
          previous = { x: p.x, z: p.z };
        for (let f = 0; f < 1800 && p.status !== "gone"; f++) {
          s.tick(1 / 60);
          assert.ok(
            Math.hypot(p.x - previous.x, p.z - previous.z) < 0.16,
            "No teleport between water, climb, and walk",
          );
          previous = { x: p.x, z: p.z };
          if (p.exitPhase === "water") {
            assert.equal(onDeck(p), false);
            assert.ok(Math.abs(p.z) <= 8.251);
          }
          if (p.exitPhase === "climb") {
            climbed = true;
            assert.equal(onDeck(p), false);
            assert.equal(Math.sign(p.z), end);
          }
          if (p.exitPhase === "deck") {
            walked = true;
            assert.ok(Math.abs(p.x) >= 5.5 || Math.abs(p.z) >= 8.7, "Walking never crosses the pool surface");
            assert.equal(p.hasFins, false);
            assert.equal(s.clutter.length, 1);
            assert.ok(Math.abs(s.clutter[0].z - end * 9.95) < 0.001);
          }
          assert.equal(s.finsAvailable + (p.hasFins ? 1 : 0) + s.clutter.length, 3);
        }
        assert.ok(climbed && walked);
        assert.equal(p.status, "gone");
        assert.equal(p.x, side * ARRIVAL.insideX);
        assert.equal(p.z, ARRIVAL.doorZ);
        assert.equal(s.stats.served, 1, "A return does not award the workout twice");
        cases++;
      }

// Pause freezes the climb; early exits from the water use the same safe route.
{
  const s = new PoolSimulation(3, 3);
  s.schedule = [];
  s.start();
  const p = s.spawn({ type: "intermediate", sick: false });
  Object.assign(p, { status: "swim", lane: 1, x: 1.15, z: 7.2 });
  s.depart(p, false);
  for (let f = 0; f < 300 && p.exitPhase !== "climb"; f++) s.tick(1 / 60);
  assert.equal(p.exitPhase, "climb");
  s.tick(0.1);
  const snapshot = [p.x, p.z, p.exitProgress];
  s.status = "paused";
  s.tick(0.1);
  assert.deepEqual([p.x, p.z, p.exitProgress], snapshot);
  assert.equal(s.stats.served, 0);
}
console.log(
  "Exit checks passed:",
  cases,
  "routes across both pool ends, both lockers, all lanes, laps/aqua, continuous swim/climb/deck movement, physical fin drops, inventory, single scoring, and pause.",
);

// Opposing foot traffic cannot steer a returning swimmer across the pool edge.
{
  const s = new PoolSimulation(3, 5);
  s.schedule = [];
  s.start();
  const a = s.spawn(),
    b = s.spawn();
  Object.assign(a, {
    status: "exit",
    exitPhase: "deck",
    x: 6.3,
    z: 4,
    path: [{ x: 6.3, z: -10.7 }, ...s.returnRoute(1)],
    side: 1,
  });
  Object.assign(b, {
    status: "exit",
    exitPhase: "deck",
    x: 6.3,
    z: 0,
    path: [{ x: 6.3, z: 9.95 }, { x: -6.3, z: 9.95 }, { x: -6.3, z: -10.7 }, ...s.returnRoute(-1)],
    side: -1,
  });
  for (let f = 0; f < 1500; f++) {
    s.tick(1 / 60);
    for (const p of [a, b]) assert.ok(Math.abs(p.x) >= 5.5 || Math.abs(p.z) >= 8.7);
  }
  assert.equal(a.status, "gone");
  assert.equal(b.status, "gone");
}
console.log("Crowded return check passed: opposing walkers both reach lockers without stepping into water.");
