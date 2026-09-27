// Incidents colliding with each other: every combination here once froze the shift clock or scored twice.
// Goggles in hand when the fish goes in, handing the fish back before the pool reopens, a fish kid arriving
// during a rescue, a cramp while a daredevil is in the air, a second ring after a crash, healed swimmers
// rejoining the pool, and a breaker reset finishing just as the flicker runs out.
import assert from "node:assert/strict";
import { PoolSimulation } from "./dist/sim.mjs";
import { tick, go } from "./check-helpers.mjs";

function shift(level, seed, lanes = [0, 1, 2]) {
  const s = new PoolSimulation(level, seed);
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  const swimmers = lanes.map((lane) => {
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
      h: 95,
    });
    return p;
  });
  tick(s, 2);
  return { s, swimmers };
}
const nearestFirst = (s, list) =>
  list.sort(
    (a, b) => Math.hypot(a.x - s.coach.x, a.z - s.coach.z) - Math.hypot(b.x - s.coach.x, b.z - s.coach.z),
  );

// 1) Holding someone's goggles when the fish goes in: they can be handed in, freeing hands for the net.
{
  const { s, swimmers } = shift(5, 23);
  const owner = swimmers[0];
  owner.problem = "goggles";
  s.clutter.push({ id: ++s.uid, type: "goggles", owner: owner.id, x: s.coach.x + 0.5, z: s.coach.z });
  assert.ok(s.pickup(s.clutter.at(-1).id));
  s.triggerChaos("fish");
  for (let i = 0; i < 60 * 30 && s.fish.stage === "approach"; i++) tick(s);
  assert.equal(s.fish.stage, "loose");
  assert.equal(owner.status, "fleeing");
  const station = s.venue.stations.relief;
  go(s, station.x - 1.2, station.z);
  assert.ok(s.returnItem(), "Goggles for a swimmer who fled can be handed in");
  assert.equal(s.coach.carry, null);
  assert.equal(owner.problem, null, "…and the owner collects them from lost and found");
  const hook = s.venue.fixtures.fishNet;
  go(s, hook.x + Math.sin(hook.angle) * 0.9, hook.z + Math.cos(hook.angle) * 0.9);
  assert.ok(s.useFixture("fishNet"));
  assert.equal(s.coach.carry, "fishnet", "Free hands take the net");
}

// 2) Handing the fish back before the pool has reopened still reopens it.
{
  const { s, swimmers } = shift(5, 23);
  s.triggerChaos("fish");
  const kid = s.visitors[0];
  for (let i = 0; i < 60 * 30 && s.fish.stage === "approach"; i++) tick(s);
  tick(s, 60 * 3);
  Object.assign(s.coach, {
    carry: "fishnet",
    netLoaded: true,
    x: kid.x + (Math.sign(kid.x) || 1) * 0.9,
    z: kid.z,
  });
  s.fishNet.state = "coach";
  Object.assign(s.fish, { stage: "netted", settle: 0.5 });
  assert.equal(s.nearestInteraction()?.kind, "return-fish");
  assert.ok(s.interact());
  assert.equal(s.fish.stage, "done");
  tick(s, 60 * 20);
  assert.equal(s.closed, 0, "The pool reopens even though the fish went back early");
  assert.ok(
    swimmers.every((p) => p.status === "swim"),
    "Everyone is back in the water",
  );
}

// 3) A kid who reaches the edge during a rescue waits: the victim must never be sent fleeing.
{
  const { s, swimmers } = shift(5, 23);
  s.triggerChaos("fish");
  const kid = s.visitors[0];
  for (let i = 0; i < 60 * 30 && kid.status !== "dumping"; i++) tick(s);
  assert.equal(kid.status, "dumping");
  assert.ok(s.startCramp(swimmers[1]));
  tick(s, 60 * 3);
  assert.equal(s.fish.stage, "approach", "No fish goes in during a rescue");
  assert.equal(kid.status, "waiting");
  assert.equal(s.strandedVictims().length, 1, "The cramp victim is still waiting for a ring");
}

// 4) No new cramp while a daredevil is already in the air.
{
  const { s } = shift(12, 5, [1, 4]);
  const d = s.spawn({ type: "daredevil", sick: false });
  s.select(d.id);
  assert.ok(s.assignTrampoline());
  for (let i = 0; i < 60 * 40 && d.jumpStage !== "climbing"; i++) tick(s);
  assert.equal(d.jumpStage, "climbing");
  const other = s.people.find((p) => p.lane === 1);
  assert.equal(s.startCramp(other), false, "Cramps hold off until the daredevil has landed");
  for (let i = 0; i < 60 * 10 && d.status === "trampoline"; i++) tick(s);
  assert.ok(s.rescue?.kind === "crash" || s.stats.flips === 1, "The jump resolves on its own terms");
}

// 5) Crash rescue: the second ring can be picked up right beside the pool and still dives in automatically.
{
  const s = new PoolSimulation(11, 9);
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  const tr = s.venue.trampoline,
    landP = tr.landZ + 7.2;
  const victim = s.spawn({ type: "beginner", sick: false });
  Object.assign(victim, {
    status: "swim",
    lane: tr.lane,
    p: landP - 0.4,
    workTarget: 999,
    workTime: 4,
    traveled: 6,
    needsFins: false,
    crampAt: Infinity,
    h: 90,
  });
  s.updateLane(tr.lane, 0.001);
  const d = s.spawn({ type: "daredevil", sick: false });
  s.select(d.id);
  s.assignTrampoline();
  for (let f = 0; f < 60 * 45 && !s.rescue; f++) {
    if (victim.status === "swim") victim.p = landP;
    tick(s);
  }
  assert.equal(s.rescue?.kind, "crash");
  const ring = nearestFirst(
    s,
    s.lifeRings.filter((r) => r.state === "wall"),
  )[0];
  go(s, ring.mount.x + Math.sin(ring.mount.angle) * 1.1, ring.mount.z + Math.cos(ring.mount.angle) * 1.1);
  assert.ok(s.interact());
  go(s, s.venue.pool.solidX + 0.7, s.strandedVictims()[0].z);
  s.setMovement(-1, 0);
  for (let f = 0; f < 120 && !s.coach.swimming; f++) tick(s);
  assert.ok(s.coach.swimming);
  for (let f = 0; f < 900 && s.strandedVictims().length === 2; f++) {
    const t = nearestFirst(s, s.strandedVictims())[0];
    const dx = t.x - s.coach.x,
      dz = t.z - s.coach.z,
      m = Math.hypot(dx, dz) || 1;
    s.setMovement(dx / m, dz / m);
    tick(s);
  }
  assert.equal(s.strandedVictims().length, 1);
  s.setMovement(1, 0);
  for (let f = 0; f < 600 && (s.coach.swimming || s.coach.waterTransition); f++) tick(s);
  s.clearInput();
  tick(s, 60 * 4);
  const deckRing = s.lifeRings.find((r) => r.state === "deck");
  assert.ok(deckRing, "The first victim's ring lies on the deck beside the pool");
  go(s, 9.3, deckRing.z - 1.2);
  assert.ok(s.fetch("lifering", deckRing.id));
  const target = s.strandedVictims()[0];
  go(s, 9.1, target.z);
  s.setMovement(-1, 0);
  for (let f = 0; f < 60 * 3 && !s.coach.swimming && !s.coach.waterTransition; f++) tick(s);
  assert.ok(s.coach.swimming || s.coach.waterTransition, "A freshly picked-up ring dives in at the edge");
}

// 6) Healed crash victims swim again (in their own lane unless a daredevil holds it).
{
  const s = new PoolSimulation(11, 9);
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  const tr = s.venue.trampoline;
  const p = s.spawn({ type: "beginner", sick: false });
  Object.assign(p, {
    status: "injured",
    problem: "injured",
    resumeLane: tr.lane,
    exitPhase: "deck",
    exitEnd: 1,
    path: [],
    x: 7.55,
    z: 10.8,
    h: 60,
  });
  Object.assign(s.coach, { carry: "medkit", x: 6.7, z: 10.3 });
  s.medkit.state = "coach";
  assert.ok(s.tendInjured(p.id));
  tick(s, 80);
  assert.equal(p.bandaged, true);
  for (let f = 0; f < 60 * 30 && p.status !== "swim"; f++) tick(s);
  assert.equal(p.status, "swim", "The patched-up swimmer gets back into the water");
  assert.equal(p.lane, tr.lane);
}

// 7) A breaker reset that finishes as the flicker would have run out is a clean save.
{
  const s = new PoolSimulation(7, 3);
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  s.triggerChaos("outage");
  const fx = s.venue.fixtures,
    box = {
      x: fx.fuseBox.x + Math.sin(fx.fuseBox.angle) * 0.85,
      z: fx.fuseBox.z + Math.cos(fx.fuseBox.angle) * 0.85,
    };
  Object.assign(s.coach, { x: box.x - 0.3, z: box.z - 0.5 });
  s.outage.t = 0.3;
  const score = s.score;
  assert.equal(s.nearestInteraction()?.kind, "reset-breaker");
  s.interact();
  tick(s, 60);
  assert.equal(s.stats.blackouts || 0, 0, "No blackout once the reset has started");
  assert.equal(s.score - score, 100);
  assert.equal(s.stats.prevented, 1);
}
console.log(
  "Interplay checks passed: goggles handed in for the fish net, early fish return reopens, kid waits out rescues, no cramps mid-flip, second ring dives from the edge, healed victims swim again, breaker race is a clean save.",
);
