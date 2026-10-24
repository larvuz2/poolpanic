// The massage (incidents/massage.mjs, 23 October 2026): a table in some venues only; the next swimmer out of the pool walks to it
// and lies down; their patience runs out unless a coach holds E at the table (8 s alone, 5 for two, 3 for three, many hands as
// on Karen); relaxed, they float off home with points; left too long, they storm off and points are taken.
import assert from "node:assert/strict";
import { PoolSimulation, SHIFTS } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import {
  Massage,
  MASSAGE_TUNING as T,
  TABLE,
  SPOTS,
  tablePoint,
  tableApproach,
  tableRoute,
} from "./dist/incidents/massage.mjs";
import { STINGS, SAVES } from "./dist/moments.mjs";
import { directShift, stream, INCIDENT_ORDER, INCIDENTS, VENUE_INCIDENTS } from "./dist/week.mjs";
import { COACHES } from "./dist/crew.mjs";
import { tick, assignAll, plan } from "./check-helpers.mjs";

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const events = (s, type) => s.events.filter((e) => e.type === type);
const LAGOON = SHIFTS.findIndex((l) => l.venue === "lagoon") + 1;
assert.ok(LAGOON > 0, "a level at the Sunset Lagoon");

// ---------------------------------------------------------------------------------------------------------
// Some venues, not all: the table stands where nothing else is, and the guests and coaches can get to it.
{
  const withTable = Object.values(VENUES)
    .filter((v) => v.fixtures?.massage)
    .map((v) => v.id)
    .sort();
  assert.deepEqual(
    withTable,
    ["aquatic", "arena", "dive", "lagoon", "senior"],
    "a table at five venues only",
  );
  // (The Jumping Pool's massage corner, two beds and no lanes, is dive-check's.)
  for (const id of withTable.filter((id) => id !== "dive")) {
    const v = VENUES[id],
      t = v.fixtures.massage;
    assert.ok(
      v.obstacles.some((o) => o.kind === "massage-table"),
      id + ": the table is in the way",
    );
    // Every coach's place at the table is open deck (a coach let go there can walk away), and so is the guests' way on.
    for (const s of SPOTS) {
      const at = tablePoint(t, s.along, s.side * TABLE.stand);
      assert.ok(v.isDeck(at.x, at.z, 9), `${id}: a coach can stand at the table (${s.side}, ${s.along})`);
    }
    const on = tableApproach(t);
    assert.ok(v.isDeck(on.x, on.z, 9), id + ": the guests' side of the table is deck");
    // Nothing else of the venue's on it: the stations, the fixtures, the rescue bench, the other furniture.
    const points = { ...v.stations, ...v.fixtures, bench: v.rescue.bench, rack: v.sanitation.rack };
    delete points.massage;
    for (const [k, p] of Object.entries(points))
      assert.ok(dist(p, t) > 1.6, `${id}: the table keeps clear of the ${k}`);
    for (const o of v.obstacles.filter((o) => o.kind !== "massage-table" && o.kind !== "pool")) {
      const gx = Math.abs(o.x - t.x) - o.hx - TABLE.width,
        gz = Math.abs(o.z - t.z) - o.hz - TABLE.half;
      assert.ok(Math.max(gx, gz) > 0.8, `${id}: the table keeps clear of the ${o.kind}`);
    }
    // The way there from where swimmers climb out, at both ends, keeps to the deck.
    for (const end of [-1, 1]) {
      const from = { x: v.lanes[0] + 1.15, z: end * v.pool.endWalkZ };
      let at = from;
      for (const step of tableRoute(v, from)) {
        for (let k = 1; k <= 20; k++) {
          const x = at.x + ((step.x - at.x) * k) / 20,
            z = at.z + ((step.z - at.z) * k) / 20;
          assert.ok(v.isDeck(x, z, 9, 0.05), `${id}: the walk to the table stays on the deck`);
        }
        at = step;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// The director: the massage comes only where there is a table, about one shift in three there, from the first shift (no surprise to
// wait for), and it is none of the five every pool has.
{
  assert.ok(!INCIDENT_ORDER.includes("massage") && !INCIDENTS.massage, "not one of the five every pool has");
  assert.equal(VENUE_INCIDENTS.massage.icon, "💆");
  for (const venue of ["club", "resort", "lagoon", "aquatic", "senior", "arena", "disco", "kids", "river"]) {
    let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = directShift({
        blueprint: { chaos: [{}, {}], duration: 180 },
        venue,
        random: stream(seed),
        known: INCIDENT_ORDER,
        index: 3,
      });
      if (r.incidents.includes("massage")) n++;
    }
    if (VENUES[venue].fixtures?.massage)
      assert.ok(n > 60 && n < 160, `${venue}: a massage in ${n} of 300 shifts`);
    else assert.equal(n, 0, venue + " has no table: no massage");
  }
  // From the very first shift a new player plays there (nothing known yet), and never as the shift's surprise.
  const first = directShift({
    blueprint: { chaos: [{}, {}, {}], duration: 180 },
    venue: "aquatic",
    random: stream(4),
    known: [],
    index: 1,
  });
  assert.notEqual(first.surprise, "massage");
}

// ---------------------------------------------------------------------------------------------------------
// Moments: the sting teaches the hold, the save stamps.
{
  assert.ok(STINGS.massage?.how && STINGS.massage.verb.includes("E"), "the sting teaches the hold");
  assert.equal(SAVES.massage.stamp, "BLISS!");
  assert.equal(COACHES.find((c) => c.id === "brooks").massageStep, 0.07, "Coach Brooks works from a step");
}

function shift(seed, crew, level = LAGOON) {
  const s = new PoolSimulation(level, seed, crew ? { crew } : {});
  s.chaosPlan = [];
  s.start();
  for (let f = 0; f < 60 * 20; f++) {
    assignAll(s);
    tick(s);
  }
  return s;
}
// Trigger it and play on until the guest is lying on the table.
function onTable(s) {
  assert.ok(s.triggerChaos("massage"), "the massage starts where there is a table");
  assert.equal(s.massage.stage, "waiting");
  for (let f = 0; f < 60 * 60 && s.massage?.stage !== "lying"; f++) {
    assignAll(s);
    tick(s);
  }
  assert.equal(s.massage?.stage, "lying", "a swimmer came out and lay down on the table");
  return s.get(s.massage.id);
}
// A coach (index i) walks to their side of the table with real input.
function toTable(s, i = 0, across = 1) {
  const t = s.venue.fixtures.massage,
    goal = tablePoint(t, 0.2, across * 0.95);
  for (let f = 0; f < 60 * 30; f++) {
    const c = s.coaches[i];
    if (dist(c, goal) < 0.3) break;
    const path = s.as(i, () => plan(s, goal));
    const next = path.find((p) => dist(p, c) > 0.2) || goal;
    const d = dist(next, c);
    s.inputAs(i, "setMovement", (next.x - c.x) / d, (next.z - c.z) / d);
    tick(s);
  }
  s.inputAs(i, "clearInput");
  tick(s, 4);
}

// ---------------------------------------------------------------------------------------------------------
// The whole of it, one coach: the walk, the climb, the patience, the hold, the drain, the bliss, home.
{
  const s = shift(3);
  const before = s.people.filter((p) => p.status === "swim").length;
  assert.ok(before > 0 && Massage.canStart(s));
  const p = onTable(s);
  const t = s.venue.fixtures.massage;
  assert.ok(p.type !== "child" && !p.wheelchair);
  assert.ok(
    events(s, "incident").some((e) => e.kind === "massage" && e.id === p.id),
    "the sting fires when the guest heads for the table",
  );
  assert.ok(dist(p, t) < 0.01, "lying on the middle of the table");
  assert.ok(Math.abs(p.angle - (t.angle || 0)) < 1e-6, "with the head at the head end");
  assert.equal(s.loudestAlert()?.kind, "massage", "the guest is the loud alert");
  assert.ok(s.incidentPanel()?.title.includes("MASSAGE"));
  // The patience runs while nobody is on it.
  const tag = s.personTag(p);
  assert.equal(tag.ring, 0);
  assert.ok(tag.patience > 0.9 && tag.patience <= 1);
  tick(s, 60);
  assert.ok(Math.abs(s.massage.patience - (T.patience - 1)) < 0.05, "a second of patience a second");
  toTable(s);
  const offer = s.nearestInteraction();
  assert.equal(offer?.kind, "massage", "in reach, E is a massage");
  assert.ok(offer.rank < -300, "it outranks routine service");
  s.setHold(true);
  assert.ok(s.interact());
  assert.ok(s.coach.massaging);
  const patience = s.massage.patience;
  tick(s, 60);
  assert.ok(Math.abs(s.massage.progress - 1 / 8) < 0.01, "an eighth of the wheel a second, alone (8 s)");
  assert.equal(s.massage.patience, patience, "the patience waits while a coach is on it");
  // The coach has stepped to a place of their own at the table and faces across it.
  const spot = SPOTS.map((k) => tablePoint(t, k.along, k.side * TABLE.stand));
  assert.ok(
    spot.some((q) => dist(q, s.coach) < 0.01),
    "at a place at the table",
  );
  assert.ok(s.venue.isDeck(s.coach.x, s.coach.z, s.level), "...on open deck");
  // Let go: the wheel drains and the patience runs again.
  s.setHold(false);
  tick(s);
  assert.equal(s.coach.massaging, false);
  const held = s.massage.progress;
  tick(s, 30);
  assert.ok(s.massage.progress < held, "the wheel drains once E is let go");
  assert.ok(s.massage.patience < patience, "...and the patience runs");
  // All the way.
  s.setHold(true);
  assert.ok(s.interact());
  const score = s.score;
  for (let f = 0; f < 60 * 10 && s.massage?.stage === "lying"; f++) tick(s);
  assert.equal(s.massage?.stage, "rise", "relaxed: getting off the table");
  const value = T.reward + (p.vip ? T.vipBonus : 0);
  assert.ok(
    events(s, "points").some((e) => e.value === value && dist(e, p) < 0.01),
    "the reward is paid where the guest lies",
  );
  assert.ok(s.score >= score + value - 200);
  assert.ok(events(s, "save").some((e) => e.kind === "massage"));
  assert.equal(s.stats.massages, 1);
  assert.equal(s.coach.massaging, false);
  s.setHold(false);
  for (let f = 0; f < 60 * 3 && s.massage; f++) tick(s);
  assert.equal(s.massage, null, "the table is free again");
  assert.equal(p.status, "exit", "the guest walks home");
  for (let f = 0; f < 60 * 30 && p.status !== "gone"; f++) tick(s);
  assert.equal(p.status, "gone", "...out of the door");
}

// ---------------------------------------------------------------------------------------------------------
// Left alone: the patience runs out, the guest storms off and it costs the shift (a VIP more), the streak breaks.
{
  const s = shift(5);
  const p = onTable(s);
  p.vip = true;
  s.massage.patience = 0.5;
  const score = s.score;
  for (let f = 0; f < 60 && s.massage?.stage === "lying"; f++) tick(s);
  assert.equal(s.massage.stage, "rise");
  assert.ok(events(s, "massage-angry").length, "the guest storms off");
  assert.ok(
    events(s, "points").some((e) => e.value === -T.vipPenalty && dist(e, p) < 0.01),
    "a VIP left waiting costs more",
  );
  assert.ok(s.score <= score - T.vipPenalty + 200);
  assert.ok(p.h <= 40);
  assert.equal(s.stats.massagesMissed, 1);
  for (let f = 0; f < 60 * 30 && p.status !== "gone"; f++) tick(s);
  assert.equal(p.status, "gone");
}

// ---------------------------------------------------------------------------------------------------------
// Many hands: two coaches 5 s, three 3 s; each at a place of their own; their faces on the wheel; a pop as each joins.
{
  assert.deepEqual(T.times, [8, 5, 3], "Karen's times, as the creator asked");
  for (const n of [2, 3]) {
    const s = shift(9, ["waters", "rivers", "brooks"].slice(0, n));
    const p = onTable(s);
    for (let i = 0; i < n; i++) toTable(s, i, i === 1 ? -1 : 1);
    for (let i = 0; i < n; i++) {
      s.inputAs(i, "setHold", true);
      assert.ok(
        s.as(i, () => s.interact()),
        `coach ${i} joins`,
      );
    }
    assert.equal(s.massage.helpers.length, n);
    assert.ok(events(s, "team-up").some((e) => e.kind === "massage" && e.helpers === n));
    assert.deepEqual(
      s.personTag(p).team,
      ["waters", "rivers", "brooks"].slice(0, n),
      "their faces on the wheel",
    );
    const p0 = s.massage.progress;
    tick(s, 30);
    const rate = (s.massage.progress - p0) / 0.5;
    assert.ok(Math.abs(rate - 1 / T.times[n - 1]) < 0.01, `${n} coaches: ${(1 / rate).toFixed(2)} s`);
    tick(s, 60);
    const places = s.coaches.slice(0, n).map((c) => `${c.x.toFixed(2)},${c.z.toFixed(2)}`);
    assert.equal(new Set(places).size, n, "each coach at a place of their own");
    for (let f = 0; f < 60 * 6 && s.massage?.stage === "lying"; f++) tick(s);
    assert.equal(s.massage?.stage, "rise");
    assert.ok(s.coaches.every((c) => !c.massaging));
  }
}

// ---------------------------------------------------------------------------------------------------------
// Where there is no table it never starts; children never ask; and it plays the same twice (seeded, inputs only).
{
  const s = new PoolSimulation(4, 2);
  s.chaosPlan = [];
  s.start();
  for (let f = 0; f < 60 * 20; f++) {
    assignAll(s);
    tick(s);
  }
  assert.equal(s.venue.fixtures.massage, undefined);
  assert.equal(Massage.canStart(s), false);
  assert.match(s.chaosBlocker(s.system("massage")), /not just now/);
  assert.equal(s.triggerChaos("massage"), false);
  const t = shift(3);
  t.triggerChaos("massage");
  const kid = t.people.find((p) => p.status === "swim") || t.spawn({ type: "child" });
  kid.type = "child";
  assert.equal(Massage.claim(t, kid), false, "a child never takes the table");
  const run = () => {
    const r = shift(21);
    r.triggerChaos("massage");
    for (let f = 0; f < 60 * 40; f++) {
      assignAll(r);
      tick(r);
    }
    return JSON.stringify([
      r.score,
      r.massage?.stage,
      r.massage?.patience,
      r.people.map((p) => [p.status, p.x]),
    ]);
  };
  assert.equal(run(), run(), "deterministic");
}

console.log(
  "Massage checks passed: a table at four venues (the Sunset Lagoon, the Aquatic Centre, Senior Aqua Fit, the Grand Gala Arena) and two beds at the Jumping Pool where nothing else is, the director drawing it only there (about a shift in three), the next swimmer out lying down on it, the patience running only while nobody is on it, hold E to fill the wheel (8 s, 5 for two, 3 for three, each coach at a place of their own, their faces on the wheel), the bliss and its points, the storm-off and its cost, no table no massage, no child, the same twice.",
);
