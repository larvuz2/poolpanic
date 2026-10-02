// Loose Dog, Cannonball Carl and Power Outage: prevention and full recovery with real coach movement.
import assert from "node:assert/strict";
import { PoolSimulation, SHIFTS } from "./dist/sim.mjs";
import { cannonballMan, CANNONBALL_MEN } from "./dist/incidents/carl.mjs";
import { heldInWater } from "./dist/rescue.mjs";
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
// The cannonball man is Carl or the leopard man, one of them for a whole level.
{
  const carlLevels = SHIFTS.map((c, i) => [i + 1, c]).filter(([, c]) =>
    c.chaos?.some((e) => e.kinds.includes("carl")),
  );
  assert.equal(carlLevels[0][0], 6, "Carl's level is the first with a Cannonball incident");
  const men = carlLevels.map(([level, c]) => cannonballMan(c, level).id);
  assert.equal(men[0], "carl", "and it is Carl himself");
  assert.deepEqual([...new Set(men)].sort(), ["carl", "leopard"], "both of them have levels");
  for (const [level, c] of carlLevels)
    assert.equal(
      cannonballMan(c, level).id,
      level % 2 ? "leopard" : "carl",
      `level ${level}: the levels take turns`,
    );
  assert.equal(cannonballMan({ cannonball: "leopard" }, 6).id, "leopard", "a config can pick its man");
  assert.equal(cannonballMan({ cannonball: "nobody" }, 6).id, "carl", "a bad pick is the level's own");
  assert.deepEqual(Object.keys(CANNONBALL_MEN), ["carl", "leopard"]);
  // Every incident of a level is the same man, and he is named in what the player reads.
  for (const [level, who, name] of [
    [6, "carl", "Carl"],
    [9, "leopard", "Leopard Man"],
  ]) {
    const s = shift(21, level);
    s.triggerChaos("carl");
    const v = s.visitors[0];
    assert.equal(v.figure, who, `level ${level}: the visitor is ${who}`);
    assert.equal(v.name, name);
    assert.deepEqual([s.carl.figure, s.carl.name], [who, name]);
    assert.ok(
      s.events.some((e) => e.type === "toast" && e.text.includes(name + " is yelling")),
      "the warning names him",
    );
    assert.ok(
      s.events.some((e) => e.type === "incident" && e.name === name),
      "so does the sting",
    );
    assert.equal(CannonballCarlTag(s, v), name, "and the tag over his head");
  }
}
function CannonballCarlTag(s, v) {
  return s.systems.find((x) => x.key === "carl").tag(s, v).label;
}

// ---------------------------------------------------------------------------------------------------------
// While he is in the pool the crowd panics: the swimmers in the water stand still and lose nothing, the rest panic with
// them (the scene hops them), and as soon as he is out on the deck it is over.
{
  const s = shift(3, 9);
  assert.ok(!s.crowdPanic(), "the crowd is calm");
  // Two swimmers wait in the queue (nobody assigns them a lane, so they stay).
  const waiting = [s.spawn({ type: "beginner" }), s.spawn({ type: "advanced" })];
  for (const p of waiting) p.waitLimit = 1e6;
  assert.ok(
    waiting.every((p) => p.status === "queue"),
    "they are in the queue",
  );
  s.triggerChaos("carl");
  const man = s.visitors[0];
  for (let f = 0; f < 60 * 40 && man.status !== "floating"; f++) {
    tick(s);
    if (man.status !== "floating") assert.ok(!s.crowdPanic(), "calm until the splash (" + man.status + ")");
  }
  assert.equal(man.status, "floating", "he reaches the water");
  assert.ok(s.crowdPanic() && s.carl.inWater, "from the splash the crowd panics");
  const swimmers = s.people.filter((p) => p.status === "swim" || p.status === "switch");
  assert.ok(swimmers.length >= 2, "there are swimmers in the water (" + swimmers.length + ")");
  assert.ok(
    swimmers.every((p) => heldInWater(s, p)),
    "they are held",
  );
  const queue = waiting.filter((p) => p.status === "queue");
  assert.equal(queue.length, 2, "and people waiting on the deck");
  assert.ok(
    queue.every((p) => !heldInWater(s, p)),
    "who are not held",
  );
  const state = () =>
    JSON.stringify(swimmers.map((p) => [p.status, p.x, p.z, p.p, p.workTime, p.h, p.blocked]));
  const frozen = state();
  const waits = queue.map((p) => p.wait);
  let held = 0;
  for (let f = 0; f < 60 * 20; f++) {
    tick(s);
    if (!s.carl?.inWater) break;
    held++;
    assert.equal(state(), frozen, "the swimmers in the water do not move or lose anything (frame " + f + ")");
    assert.ok(s.crowdPanic());
  }
  assert.ok(held > 60 * 2, `for as long as he is in the water (${(held / 60).toFixed(1)} s)`);
  assert.ok(
    queue.every((p, i) => p.status !== "queue" || p.wait > waits[i] + 1),
    "while the deck's patience runs on",
  );
  assert.ok(!s.crowdPanic(), "once he is out the crowd is calm");
  assert.ok(
    ["climbing", "running"].includes(man.status) || man.status === "running",
    "he is out of the water (" + man.status + ")",
  );
  const calm = state();
  for (let f = 0; f < 60 * 3; f++) tick(s);
  assert.notEqual(state(), calm, "and the swimmers swim on");
  assert.ok(s.stats.cannonballs >= 1);
}
// The same when he is red-carded on the deck: nothing is held.
{
  const s = shift(11, 9);
  s.triggerChaos("carl");
  const man = s.visitors[0];
  for (let f = 0; f < 90 && man.status === "entering"; f++) tick(s);
  assert.ok(
    pursue(
      s,
      () => man,
      () => s.nearestInteraction()?.kind === "red-card",
      900,
    ),
    "the coach reaches him",
  );
  assert.ok(!s.crowdPanic());
  assert.ok(s.interact());
  assert.ok(!s.crowdPanic(), "a red card keeps the crowd calm");
  const p = s.people.find((q) => q.carl);
  assert.equal(p.name, "Leopard Man", "he joins the queue as himself");
  assert.equal(p.figure, "leopard", "the leopard man, so the scene draws him as one");
}
// What is held: the swimmers in the water, not a rescue's victims (they have their own), nor anyone on the deck.
{
  const s = { crowdPanic: () => true, rescue: null };
  for (const status of ["swim", "switch"]) assert.ok(heldInWater(s, { status }), status + " is held");
  assert.ok(
    heldInWater(s, { status: "exit", exitPhase: "water" }),
    "so is a swimmer on the way to the ladder",
  );
  for (const p of [
    { status: "exit", exitPhase: "climb" },
    { status: "exit", exitPhase: "deck" },
    { status: "queue" },
    { status: "enter" },
    { status: "fleeing" },
  ])
    assert.ok(!heldInWater(s, p), "not " + JSON.stringify(p));
  assert.ok(
    !heldInWater({ crowdPanic: () => false }, { status: "swim" }),
    "nothing is held while it is calm",
  );
  assert.ok(
    !heldInWater({ crowdPanic: () => true, rescue: { kind: "cramp" } }, { status: "swim" }),
    "a rescue holds its own",
  );
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
  "Chaos checks passed: dog mischief with fin conservation, treat lure and door exit; Carl red card into the queue, splash wave with deck goggles and slippery puddles, deck catch; Carl or the leopard man by level, and the crowd held and panicking while he is in the pool; outage quick reset, blackout bumps, flashlight-only breaker reset and return.",
);
