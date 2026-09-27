// Fish Kid: prevention on deck, the full dump → flee → net → chase → reopen → return → hang loop, and a
// catchability study with a naive chase bot across many seeds.
import assert from "node:assert/strict";
import { PoolSimulation } from "./dist/sim.mjs";
import { FISH_TUNING } from "./dist/incidents/fish.mjs";

const tick = (s, n = 1) => {
  for (let i = 0; i < n; i++) s.tick(1 / 60);
};
// Walk the coach along a deck route using real movement input.
function go(s, x, z, limit = 1200) {
  const route = s.venue.route(s.coach, { x, z }, { solid: true });
  for (const point of route) {
    let f = 0;
    while (Math.hypot(s.coach.x - point.x, s.coach.z - point.z) > 0.12 && f++ < limit) {
      const dx = point.x - s.coach.x,
        dz = point.z - s.coach.z,
        n = Math.hypot(dx, dz);
      s.setMovement(dx / n, dz / n);
      tick(s);
      if (s.coach.swimming || s.coach.waterTransition) break;
    }
  }
  s.clearInput();
}
// Pursue a moving target, re-planning the deck route every frame, until `done()` or the limit.
function pursue(s, target, done, limit = 900) {
  for (let f = 0; f < limit && !done(); f++) {
    const next = s.venue.route(s.coach, target(), { solid: true })[0],
      dx = next.x - s.coach.x,
      dz = next.z - s.coach.z,
      n = Math.hypot(dx, dz) || 1;
    s.setMovement(dx / n, dz / n);
    tick(s);
  }
  s.clearInput();
  return done();
}
function fixture(seed = 5) {
  const s = new PoolSimulation(5, seed);
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  const swimmers = [0, 1, 2].map((lane) => {
    const p = s.spawn({ type: "intermediate", sick: false });
    Object.assign(p, {
      status: "swim",
      lane,
      p: 4 + lane * 6,
      workTime: 5,
      traveled: 9,
      workTarget: 999,
      needsFins: false,
      crampAt: Infinity,
    });
    return p;
  });
  tick(s, 2);
  return { s, swimmers };
}

// 1) Prevention: meet the kid on the deck and press E.
{
  const { s } = fixture(11);
  assert.ok(s.triggerChaos("fish"));
  const kid = s.visitors.find((v) => v.kind === "kid");
  assert.ok(kid && kid.hasFish);
  assert.equal(s.closed, 0, "The pool stays open while the kid approaches");
  for (let i = 0; i < 120 && Math.abs(kid.x) > 7.3; i++) tick(s);
  assert.ok(
    pursue(
      s,
      () => kid,
      () => s.nearestInteraction()?.kind === "stop-kid",
    ),
    "The coach can catch up with the kid on the deck",
  );
  const before = s.score;
  assert.ok(s.interact());
  assert.equal(s.score, before + 100);
  assert.equal(s.fish.stage, "prevented");
  assert.equal(kid.status, "sulking");
  for (let i = 0; i < 1200 && s.fish; i++) tick(s);
  assert.equal(s.fish, null, "Incident clears once the kid leaves through a door");
  assert.equal(s.visitors.length, 0);
  assert.equal(s.stats.prevented, 1);
}

// 2) Failure and full recovery with real controls.
{
  const { s, swimmers } = fixture(23);
  s.triggerChaos("fish");
  const kid = s.visitors[0];
  for (let i = 0; i < 1800 && s.fish.stage === "approach"; i++) tick(s);
  assert.equal(s.fish.stage, "loose", "An unchallenged kid dumps the fish");
  assert.equal(kid.status, "crying");
  assert.equal(s.closed, 1);
  assert.ok(swimmers.every((p) => p.status === "fleeing"));
  const clock = s.time;
  const waiting = s.spawn({ type: "beginner", sick: false });
  s.select(waiting.id);
  assert.equal(s.assign(0), false, "No assignments while the fish is loose");
  tick(s, 180);
  assert.equal(s.time, clock, "The shift clock waits while the fish is loose");
  assert.ok(waiting.wait > 2.9, "Queue patience keeps draining");
  for (const p of swimmers) {
    assert.equal(p.fleePhase, "run", "Everybody leaps out and runs");
    assert.ok(s.venue.isDeck(p.x, p.z, s.level, 0.05), `Panic runner stays on deck: ${p.x},${p.z}`);
  }
  const ring = swimmers.map((p) => ({ x: p.x, z: p.z }));
  tick(s, 45);
  assert.ok(
    swimmers.some((p, i) => Math.hypot(p.x - ring[i].x, p.z - ring[i].z) > 0.3),
    "Panic runners keep moving in circles",
  );
  // Grab the net, walk to the edge and dive in automatically.
  const hook = s.venue.fixtures.fishNet;
  go(s, hook.x + Math.sin(hook.angle) * 0.9, hook.z + Math.cos(hook.angle) * 0.9);
  assert.equal(s.nearestInteraction()?.kind, "fishnet");
  assert.ok(s.interact());
  assert.equal(s.coach.carry, "fishnet");
  go(s, 6.2, -3.5);
  s.setMovement(-1, 0);
  for (let i = 0; i < 120 && !s.coach.waterTransition && !s.coach.swimming; i++) tick(s);
  assert.ok(s.coach.waterTransition || s.coach.swimming, "Carrying the net at the edge dives in");
  for (let i = 0; i < 60 && !s.coach.swimming; i++) tick(s);
  let frames = 0;
  while (s.fish.stage === "loose" && frames++ < 60 * 45) {
    const f = s.fish,
      dx = f.x - s.coach.x,
      dz = f.z - s.coach.z,
      n = Math.hypot(dx, dz) || 1;
    s.setMovement(dx / n, dz / n);
    tick(s);
  }
  s.clearInput();
  assert.equal(s.fish.stage, "netted", "The fish is catchable by a direct chase");
  assert.equal(s.coach.netLoaded, true);
  for (let i = 0; i < 180 && s.closed; i++) tick(s);
  assert.equal(s.closed, 0, "Catching the fish reopens the pool");
  assert.ok(swimmers.every((p) => ["enter", "swim"].includes(p.status)));
  assert.deepEqual(
    swimmers.map((p) => p.lane),
    [0, 1, 2],
    "Swimmers return to their own lanes",
  );
  // Climb out, hand the fish back, then hang up the net.
  s.setMovement(1, 0);
  for (let i = 0; i < 400 && (s.coach.swimming || s.coach.waterTransition); i++) tick(s);
  s.clearInput();
  assert.ok(!s.coach.swimming);
  go(s, kid.x + (kid.x > 0 ? 0.9 : -0.9), kid.z);
  assert.equal(s.nearestInteraction()?.kind, "return-fish");
  assert.ok(s.interact());
  assert.equal(kid.status, "happy");
  assert.equal(s.coach.carry, "fishnet");
  assert.equal(s.coach.netLoaded, false);
  go(s, hook.x + Math.sin(hook.angle) * 0.9, hook.z + Math.cos(hook.angle) * 0.9);
  assert.ok(s.interact());
  assert.equal(s.coach.carry, null);
  for (let i = 0; i < 1500 && s.fish; i++) tick(s);
  assert.equal(s.fish, null);
  for (let i = 0; i < 600 && swimmers.some((p) => p.status !== "swim"); i++) tick(s);
  assert.ok(
    swimmers.every((p) => p.status === "swim" && p.workTime >= 5),
    "Unfinished workouts resume",
  );
}

// 3) Catchability: naive direct chase from a random dive point, many seeds.
{
  const times = [];
  for (let seed = 1; seed <= 40; seed++) {
    const s = new PoolSimulation(5, seed * 97);
    s.schedule = [];
    s.chaosPlan = [];
    s.start();
    s.triggerChaos("fish");
    for (let i = 0; i < 2400 && s.fish.stage === "approach"; i++) tick(s);
    const f = s.fish;
    Object.assign(s.coach, {
      carry: "fishnet",
      swimming: true,
      y: -0.39,
      x: -Math.sign(f.x || 1) * 2.5,
      z: -Math.sign(f.z || 1) * 5,
    });
    let t = 0;
    while (s.fish.stage === "loose" && t < 60) {
      const dx = f.x - s.coach.x,
        dz = f.z - s.coach.z,
        n = Math.hypot(dx, dz) || 1;
      s.setMovement(dx / n, dz / n);
      tick(s);
      t += 1 / 60;
    }
    assert.equal(s.fish.stage, "netted", "Seed " + seed + " must end with a catch");
    times.push(t);
  }
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const worst = Math.max(...times);
  console.log(
    "Fish chase (naive bot): mean " +
      mean.toFixed(1) +
      "s, fastest " +
      Math.min(...times).toFixed(1) +
      "s, slowest " +
      worst.toFixed(1) +
      "s",
  );
  assert.ok(mean > 3 && mean < 18, "Challenging but reasonable on average");
  assert.ok(worst < 35, "Never an endless chase");
  assert.ok(FISH_TUNING.dart > 4.2, "Darts are faster than the swimming coach");
}
console.log(
  "Fish checks passed: deck interception, dump and evacuation, panic circles on deck, held clock with draining queue, net pickup, automatic dive, chase and catch, reopen to original lanes, return to the kid, net hung up.",
);
