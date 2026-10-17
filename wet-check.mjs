// Wet spots and the mop (dist/incidents/wet.mjs, 16 October 2026, in every pool): one in five swimmers climbing out drips a wet spot
// where they got out; it never dries; a guest who walks over it slips, is cross and costs points; the coach slips in it too (down for a second; he can jump over it) and
// grabs the mop from its bucket, mops it with E and puts the mop back; it is a chore, never an incident; the bot does it too.
import assert from "node:assert/strict";
import { PoolSimulation, SHIFTS } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { WetSpots, WET_TUNING as T, addWetSpot, wetSpotAt } from "./dist/incidents/wet.mjs";
import { SYSTEMS } from "./dist/chaos.mjs";
import { STINGS, SAVES } from "./dist/moments.mjs";
import { INPUTS } from "./dist/replay.mjs";
import { CoachBot } from "./check-bot.mjs";
import { go, tick } from "./check-helpers.mjs";

const quiet = (level = 6, seed = 5, venue = "club") => {
  const s = new PoolSimulation(level, seed, { venue });
  s.schedule = [];
  s.chaosPlan = [];
  s.start();
  return s;
};

// 1) Every pool has the mop bucket on its deck, within reach and in nobody's way, and the wet spots are a chore: the last of the
// systems, never active, never counted towards the incidents a shift may run at once.
for (const [id, v] of Object.entries(VENUES)) {
  const m = v.fixtures.mop;
  assert.ok(m, id + " has a mop");
  assert.ok(
    v.obstacles.some((o) => o.kind === "mop-bucket" && o.x === m.x && o.z === m.z),
    id + ": the bucket is solid",
  );
  const around = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].filter(([dx, dz]) => v.isDeck(m.x + dx * 0.9, m.z + dz * 0.9, 3, 0.3));
  assert.ok(around.length >= 2, id + ": the coach can stand by the bucket");
  for (const p of [
    ...Object.values(v.stations),
    ...Object.entries(v.fixtures)
      .filter(([k]) => k !== "mop")
      .map(([, p]) => p),
  ])
    assert.ok(Math.hypot(p.x - m.x, p.z - m.z) > 1.8, id + ": the bucket is apart from the other gear");
}
assert.equal(SYSTEMS.at(-1), WetSpots);
assert.equal(WetSpots.isActive(), false);
assert.ok(STINGS.wet && SAVES.mopped, "a sting for the first wet spot, a stamp for each one mopped");
assert.ok(INPUTS.includes("mop"), "the mop button is an input a replay plays back");

// 2) One in five swimmers climbing out drips a spot, from a stream of its own (the shift's other draws do not move).
{
  const s = quiet();
  let dripped = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) {
    s.wetSpots = [];
    if (WetSpots.climbedOut(s, { id: i }, { x: -9, z: -10.1 })) dripped++;
  }
  assert.ok(Math.abs(dripped / n - T.chance) < 0.025, "about one in five (" + (dripped / n).toFixed(3) + ")");
  const a = quiet(6, 9),
    b = quiet(6, 9);
  const seq = (sim) =>
    Array.from({ length: 50 }, () => !!WetSpots.climbedOut(sim, {}, { x: 0, z: -10 }) && (sim.wetSpots = []));
  assert.deepEqual(seq(a), seq(b), "the same shift drips the same spots");
  const plain = quiet(6, 9),
    dripping = quiet(6, 9);
  seq(dripping);
  assert.equal(plain.random(), dripping.random(), "and the shift's own random numbers are untouched");
}

// 3) In a played shift the swimmers climbing out drip spots where they climbed out, the first is announced, and a spot stays (it never
// dries by itself).
{
  const bot = new CoachBot(6, 21),
    sim = bot.s,
    seen = [];
  const emit = sim.emit.bind(sim);
  sim.emit = (type, e = {}) => {
    if (type === "wet-spot" || (type === "incident" && e.kind === "wet")) seen.push({ type, ...e });
    return emit(type, e);
  };
  bot.run();
  const spots = seen.filter((e) => e.type === "wet-spot");
  assert.ok(spots.length >= 1, "swimmers dripped spots (" + spots.length + ")");
  for (const e of spots)
    assert.ok(
      Math.abs(Math.abs(e.z) - (sim.venue.pool.endWalkZ + 0.15)) < 0.01,
      "at the end where they climbed out",
    );
  assert.equal(seen.filter((e) => e.type === "incident").length, 1, "the first one is announced, once");
  const stays = quiet();
  const spot = addWetSpot(stays, 9, -10.2);
  for (let i = 0; i < 60 * 120; i++) tick(stays);
  assert.ok(stays.wetSpots.includes(spot), "two minutes later it is still there");
}

// 4) A guest who walks over a spot slips, loses more happiness than in a puddle, and it costs points.
{
  const s = quiet();
  const spot = addWetSpot(s, 9, -10.2);
  const p = s.spawn({ type: "intermediate" });
  Object.assign(p, { status: "enter", x: spot.x, z: spot.z, path: [{ x: 12, z: -10.2 }], h: 90, stunned: 0 });
  const score = s.score;
  s.events.length = 0;
  assert.ok(s.tickDeckTrip(p, 1 / 60), "they slip");
  assert.equal(p.h, 90 - T.mood);
  assert.equal(s.score, score - T.penalty);
  assert.ok(
    s.events.some((e) => e.type === "wet-slip") &&
      s.events.some((e) => e.type === "toast" && /wet spot/.test(e.text)),
  );
  assert.ok(s.events.some((e) => e.type === "points" && e.value === -T.penalty));
  assert.equal(s.stats.wetSlips, 1);
  assert.equal(wetSpotAt(s, spot.x, spot.z), spot);
}

// 4b) The coach slips too (the creator, 17 October 2026: "if the coach steps over them, the coach needs to slip… a second or a
// second and a half"): walking into a spot he goes down for WET_TUNING.coachSlip seconds and cannot move, gets up, and walks
// off it without falling again; jumping over one is safe.
{
  const s = quiet();
  const spot = addWetSpot(s, -9, -10.2);
  const c = s.coach;
  Object.assign(c, { x: spot.x - 2, z: spot.z, vx: 0, vz: 0 });
  s.events.length = 0;
  let f = 0;
  while (!c.slipTime && f++ < 300) {
    s.setMovement(1, 0);
    tick(s);
  }
  assert.ok(c.slipTime > 0, "he slips in it");
  assert.ok(
    s.events.some((e) => e.type === "coach-slip" && e.wet),
    "a wet slip",
  );
  assert.ok(T.coachSlip >= 1 && T.coachSlip <= 1.5, "down for a second or so");
  const at = { x: c.x, z: c.z },
    t0 = s.time;
  while (c.slipTime > 0) {
    s.setMovement(1, 0);
    tick(s);
  }
  assert.ok(Math.abs(s.time - t0 - T.coachSlip) < 0.05, "down for " + (s.time - t0).toFixed(2) + " s");
  assert.ok(Math.hypot(c.x - at.x, c.z - at.z) < 0.15, "he does not move while down");
  s.events.length = 0;
  for (let i = 0; i < 120; i++) {
    s.setMovement(1, 0);
    tick(s);
  }
  assert.ok(c.x > spot.x + spot.r, "back up, he walks off it");
  assert.ok(!s.events.some((e) => e.type === "coach-slip"), "without falling again");
  assert.equal(s.stats.coachWetSlips, 1);
  assert.equal(s.score, quiet().score, "it costs time, not points");
  // Jumping over it.
  const j = quiet();
  const wet = addWetSpot(j, -9, -10.2);
  Object.assign(j.coach, { x: wet.x - 3, z: wet.z, vx: 0, vz: 0 });
  for (let i = 0; i < 200 && j.coach.x < wet.x - wet.r - 0.7; i++) {
    j.setMovement(1, 0);
    tick(j);
  }
  j.jump();
  for (let i = 0; i < 60; i++) {
    j.setMovement(1, 0);
    tick(j);
  }
  assert.ok(j.coach.x > wet.x + wet.r, "over it");
  assert.equal(j.stats.coachWetSlips || 0, 0, "a jump clears it");
}

// 5) The mop: grab it from the bucket (E), walk onto the spot, mop it (E, a short while), put it back. The button (Q) does the same.
{
  const s = quiet();
  const spot = addWetSpot(s, -9.5, -10.3);
  const bucket = s.venue.fixtures.mop;
  assert.match(WetSpots.hint(s), /Grab the mop/);
  go(s, bucket.x - 0.95, bucket.z);
  assert.equal(s.nearestInteraction()?.kind, "mop");
  assert.ok(s.interact());
  assert.equal(s.coach.carry, "mop");
  assert.equal(s.mopState.state, "coach");
  go(s, spot.x + 0.3, spot.z);
  assert.equal(s.nearestInteraction()?.kind, "mop-spot");
  const score = s.score;
  s.events.length = 0;
  assert.ok(s.interact());
  assert.equal(s.coach.busy?.kind, "mop", "mopping takes a moment");
  tick(s, 60);
  assert.equal(s.wetSpots.length, 0, "the spot is gone");
  assert.equal(s.score, score + T.bonus);
  assert.ok(s.events.some((e) => e.type === "save" && e.kind === "mopped"));
  assert.match(WetSpots.hint(s), /Put the mop back/);
  go(s, bucket.x - 0.95, bucket.z);
  assert.ok(s.returnItem());
  assert.equal(s.coach.carry, null);
  assert.equal(s.mopState.state, "bucket");
  // The button: from anywhere it sends the coach to the bucket; at the bucket it grabs the mop.
  const t = quiet();
  addWetSpot(t, -9.5, -10.3);
  assert.equal(t.mop(), false);
  assert.ok(t.coach.goal, "it shows the way to the bucket");
  go(t, bucket.x - 0.95, bucket.z);
  assert.ok(t.mop());
  assert.equal(t.coach.carry, "mop");
}

// 6) Spots close together are one spot; there are never more than a handful at once.
{
  const s = quiet();
  const a = addWetSpot(s, -9, -10.2),
    b = addWetSpot(s, -8.6, -10.2);
  assert.equal(a, b);
  assert.ok(a.r > T.radius);
  for (let i = 0; i < 30; i++) addWetSpot(s, -12 + (i % 6) * 2.4, -10.4 - Math.floor(i / 6) * 1.2);
  assert.ok(s.wetSpots.length <= T.max);
}

// 7) The coach bot mops them in a played shift, in every pool.
for (const venue of ["club", "resort", "disco"]) {
  const bot = new CoachBot(9, 33, { config: { ...SHIFTS[8], venue } }).run();
  const s = bot.s;
  assert.ok((s.stats.mopped || 0) >= 1, venue + ": the bot mopped (" + (s.stats.mopped || 0) + ")");
  assert.ok(s.wetSpots.length <= 2, venue + ": and left the deck nearly dry");
}
console.log(
  "Wet checks passed: a mop bucket in every pool, one in five swimmers climbing out dripping a spot that never dries, a slip, a cross guest and lost points for a guest who walks over one, the coach down on his back for a second if he steps in one (a jump clears it), the mop grabbed, used and put back (E or Q), spots that merge, and the bot mopping in every pool.",
);
