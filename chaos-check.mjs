// Loose Dog, Cannonball Carl and Power Outage: prevention and full recovery with real coach movement.
import assert from "node:assert/strict";
import { PoolSimulation } from "./dist/sim.mjs";
import { tick, go, pursue, assignAll } from "./check-helpers.mjs";

function shift(seed, level = 6) {
  const s = new PoolSimulation(level, seed);
  s.chaosPlan = [];
  s.start();
  for (let f = 0; f < 60 * 14; f++) {
    assignAll(s);
    tick(s);
  }
  return s;
}
const standAt = (s, p, angle) => ({ x: p.x + Math.sin(angle) * 0.85, z: p.z + Math.cos(angle) * 0.85 });

// ---------------------------------------------------------------------------------------------------------
// Loose Dog: mischief conserves fins; treats lure; a locker door ends it.
{
  const s = shift(7, 4);
  assert.ok(s.triggerChaos("dog"));
  const dog = s.visitors.find((v) => v.kind === "dog");
  const seen = new Set();
  for (let f = 0; f < 60 * 40; f++) {
    assignAll(s);
    tick(s);
    seen.add(dog.status);
    assert.equal(s.finCount(), 3, "Every fin pair stays accounted for while the dog runs off with them");
  }
  assert.ok(
    seen.has("sniff") && (seen.has("steal") || seen.has("bowl") || seen.has("swim")),
    "The dog makes mischief",
  );
  const jar = s.venue.fixtures.treats;
  go(s, jar.x + 1.2, jar.z);
  assert.equal(s.nearestInteraction()?.kind, "treats");
  assert.ok(s.interact());
  assert.equal(s.coach.carry, "treats");
  assert.ok(
    pursue(
      s,
      () => dog,
      () => s.dog.stage === "following",
      900,
    ),
    "Carrying treats near the dog makes it follow",
  );
  assert.equal(s.finCount(), 3);
  const door = s.venue.arrival;
  go(s, -door.outsideX, door.doorZ + 0.6);
  for (let f = 0; f < 240 && s.dog?.stage === "following"; f++) tick(s);
  assert.equal(s.dog.stage, "leaving", "Leading the dog to a locker door sends it home");
  assert.equal(s.coach.carry, null, "The treat is spent");
  for (let f = 0; f < 600 && s.dog; f++) tick(s);
  assert.equal(s.dog, null);
  assert.equal(s.visitors.length, 0);
  assert.equal(s.finCount(), 3);
}

// ---------------------------------------------------------------------------------------------------------
// Cannonball Carl: red card before the jump → a new customer.
{
  const s = shift(11);
  const queued = s.people.length;
  s.triggerChaos("carl");
  const carl = s.visitors[0];
  for (let f = 0; f < 90 && carl.status === "entering"; f++) tick(s);
  assert.ok(
    pursue(
      s,
      () => carl,
      () => s.nearestInteraction()?.kind === "red-card",
      900,
    ),
    "The coach can reach Carl before the edge",
  );
  const before = s.score;
  assert.ok(s.interact());
  assert.equal(s.score, before + 100);
  assert.equal(s.carl, null);
  assert.equal(s.visitors.length, 0);
  const p = s.people.find((q) => q.carl);
  assert.ok(
    p && p.name === "Carl" && p.type === "intermediate" && s.people.length > queued,
    "Carl joins the swimmers",
  );
  for (let f = 0; f < 600 && p.status === "arriving"; f++) tick(s);
  assert.equal(p.status, "queue", "Carl waits in the queue like everybody else");
}
// Cannonball Carl: the splash wave, goggles and puddles, then a red card on the deck.
{
  const s = shift(19);
  s.triggerChaos("carl");
  const carl = s.visitors[0];
  let hit = false;
  for (let f = 0; f < 60 * 25 && !s.stats.cannonballs; f++) {
    assignAll(s);
    tick(s);
    if (s.people.some((p) => p.status === "swim" && p.collisionTime > 1)) hit = true;
  }
  assert.equal(s.stats.cannonballs, 1, "Unchallenged, Carl cannonballs");
  assert.ok(s.hazards.filter((h) => h.kind === "puddle").length >= 2, "The splash soaks the deck");
  for (const g of s.clutter.filter((c) => c.type === "goggles")) {
    assert.ok(s.isDeck(g.x, g.z), "Lost goggles land on the deck");
    assert.equal(s.get(g.owner).problem, "goggles");
  }
  // A puddle trips the coach just like dropped fins.
  const puddle = s.hazards[0];
  Object.assign(s.coach, { x: puddle.x + 1.6, z: puddle.z, vx: 0, vz: 0, slipCooldown: 0 });
  go(s, puddle.x - 1.4, puddle.z);
  assert.ok(s.events.some((e) => e.type === "coach-slip") || s.coach.slipTime > 0, "Puddles are slippery");
  for (let f = 0; f < 60 * 6 && !["running", "climbing"].includes(carl.status); f++) tick(s);
  assert.ok(
    pursue(
      s,
      () => carl,
      () => s.nearestInteraction()?.kind === "red-card",
      1500,
    ),
    "Carl can be caught on the deck between cannonballs",
  );
  s.interact();
  assert.equal(carl.status, "carded");
  for (let f = 0; f < 900 && s.carl; f++) tick(s);
  assert.equal(s.carl, null, "A benched Carl walks out");
  for (let f = 0; f < 60 * 20; f++) tick(s);
  assert.equal(s.hazards.length, 0, "Puddles dry up");
}

// ---------------------------------------------------------------------------------------------------------
// Power outage: quick reset during the flicker prevents the blackout.
{
  const s = shift(5, 7);
  s.triggerChaos("outage");
  const fx = s.venue.fixtures.fuseBox;
  go(s, ...Object.values(standAt(s, fx, fx.angle)));
  assert.equal(s.outage.stage, "flicker");
  assert.equal(s.nearestInteraction()?.kind, "reset-breaker");
  assert.ok(s.interact());
  assert.ok(s.coach.busy, "Resetting takes a moment");
  const x = s.coach.x;
  s.setMovement(1, 0);
  tick(s, 10);
  assert.equal(s.coach.x, x, "The coach stays put while resetting");
  s.clearInput();
  tick(s, 60);
  assert.equal(s.outage.stage, "restored");
  assert.equal(s.stats.prevented, 1);
  tick(s, 120);
  assert.equal(s.outage, null);
}
// Power outage: blackout chaos, flashlight, breakers, flashlight back on its holder.
{
  const s = shift(8, 7);
  s.triggerChaos("outage");
  for (let f = 0; f < 60 * 8; f++) {
    assignAll(s);
    tick(s);
  }
  assert.equal(s.outage.stage, "dark");
  const collisions = s.stats.collisions;
  for (let f = 0; f < 60 * 20; f++) {
    assignAll(s);
    tick(s);
  }
  assert.ok(s.stats.collisions > collisions, "Swimmers bump into each other in the dark");
  const fx = s.venue.fixtures;
  go(s, ...Object.values(standAt(s, fx.fuseBox, fx.fuseBox.angle)));
  assert.equal(s.nearestInteraction()?.kind, "dark-fusebox", "Too dark without the flashlight");
  go(s, fx.flashlight.x - 0.9, fx.flashlight.z);
  assert.equal(s.nearestInteraction()?.kind, "flashlight");
  assert.ok(s.interact());
  assert.equal(s.coach.carry, "flashlight");
  go(s, ...Object.values(standAt(s, fx.fuseBox, fx.fuseBox.angle)));
  assert.equal(s.nearestInteraction()?.kind, "reset-breaker");
  s.interact();
  tick(s, 100);
  assert.equal(s.outage.stage, "restored");
  go(s, fx.flashlight.x - 0.9, fx.flashlight.z);
  assert.ok(s.interact());
  assert.equal(s.coach.carry, null);
  tick(s, 90);
  assert.equal(s.outage, null);
}
console.log(
  "Chaos checks passed: dog mischief with fin conservation, treat lure and door exit; Carl red card into the queue, splash wave with deck goggles and slippery puddles, deck catch; outage quick reset, blackout bumps, flashlight-only breaker reset and return.",
);
