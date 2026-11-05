// The influencer (incidents/influencer.mjs, 5 November 2026): at the Wave Pool, the Aqua Disco, the Lazy River and the Grand Gala
// Arena a guest stands in the middle of the deck filming themselves; guests and coaches who walk into them trip; a coach holds E
// beside them (Karen's wheel: 8 s alone, 5 for two, 3 for three) and they put the phone away and leave. Drawn at random there,
// never elsewhere.
import assert from "node:assert/strict";
import { PoolSimulation, SHIFTS } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import { INFLUENCER_TUNING as T, HANDLES } from "./dist/incidents/influencer.mjs";
import { KAREN_TUNING } from "./dist/incidents/karen.mjs";
import { STINGS, SAVES } from "./dist/moments.mjs";
import { INCIDENT_SOUNDS } from "./dist/sound-mix.mjs";
import { INCIDENT_KINDS } from "./dist/playtest.mjs";
import { directShift, stream, INCIDENT_ORDER, INCIDENTS, VENUE_INCIDENTS } from "./dist/week.mjs";
import { CoachBot } from "./check-bot.mjs";
import { tick } from "./check-helpers.mjs";

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const WHERE = ["arena", "disco", "river", "wave"];

// ---------------------------------------------------------------------------------------------------------
// Where: the four venues the creator named, each with spots on its deck, clear of the furniture and the doors.
{
  const withSpots = Object.values(VENUES)
    .filter((v) => v.selfieSpots?.length)
    .map((v) => v.id)
    .sort();
  assert.deepEqual(withSpots, WHERE, "the Wave Pool, the Aqua Disco, the Lazy River and the Gala");
  for (const id of WHERE) {
    const v = VENUES[id],
      doors = [-1, 1].map((side) => v.arrival.at(side, "door"));
    assert.ok(v.selfieSpots.length >= 3, `${id}: a few spots, so they can move to a better angle`);
    for (const s of v.selfieSpots) {
      assert.ok(v.isDeck(s.x, s.z, 8, 0.6), `${id}: (${s.x}, ${s.z}) is open deck`);
      assert.ok(
        doors.every((d) => dist(d, s) > 2),
        `${id}: (${s.x}, ${s.z}) clear of the doors`,
      );
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// The director: random, in the pool of incidents at those four venues (not every shift), never anywhere else, never a surprise.
{
  assert.ok(
    !INCIDENT_ORDER.includes("influencer") && !INCIDENTS.influencer,
    "not one of the five every pool has",
  );
  assert.equal(VENUE_INCIDENTS.influencer.icon, "🤳");
  for (const venue of Object.keys(VENUES)) {
    let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = directShift({
        blueprint: { chaos: [{}, {}], duration: 180 },
        venue,
        random: stream(seed),
        known: INCIDENT_ORDER,
        index: 3,
      });
      if (r.incidents.includes("influencer")) n++;
    }
    if (WHERE.includes(venue)) assert.ok(n > 50 && n < 160, `${venue}: the influencer in ${n} of 300 shifts`);
    else assert.equal(n, 0, venue + ": never");
  }
  const first = directShift({
    blueprint: { chaos: [{}, {}, {}], duration: 180 },
    venue: "wave",
    random: stream(4),
    known: [],
    index: 1,
  });
  assert.notEqual(first.surprise, "influencer");
}

// ---------------------------------------------------------------------------------------------------------
// Moments, sounds, the playtest log.
{
  assert.ok(STINGS.influencer?.how && STINGS.influencer.verb.includes("E"), "the sting teaches the hold");
  assert.equal(SAVES.influencer.stamp, "PHONE DOWN!");
  assert.ok(
    INCIDENT_SOUNDS.influencer.some(([key]) => key === "shutter"),
    "a shutter as they start",
  );
  assert.equal(INCIDENT_KINDS.influencer, "influencer");
  assert.deepEqual(T.times, KAREN_TUNING.calmTimes, "Karen's times, as the creator asked");
}

// A quiet shift at `venue`, the influencer triggered and walked to their first spot.
function posing(venue, seed = 7, crew = null, quiet = false) {
  const s = new PoolSimulation(8, seed, { venue, ...(crew ? { crew } : {}) });
  s.chaosPlan = [];
  s.start();
  tick(s, 60 * 6);
  if (quiet) {
    // (a quiet deck: nobody arriving, nobody climbing out, so nobody walks into them)
    s.schedule = [];
    for (const q of s.people) {
      q.workTarget = 1e9;
      q.crampAt = Infinity;
      if (!["queue", "swim"].includes(q.status)) Object.assign(q, { status: "queue", path: [] });
    }
  }
  for (const c of s.coaches) {
    c.x = s.venue.coachStart.x;
    c.z = s.venue.coachStart.z;
  }
  assert.ok(s.triggerChaos("influencer"), venue + ": it starts");
  const v = s.visitor(s.influencer.id);
  assert.ok(HANDLES.includes(v.name), "an influencer's handle");
  assert.ok(
    s.events.some((e) => e.type === "incident" && e.kind === "influencer"),
    "the sting",
  );
  for (let f = 0; f < 60 * 40 && v.status !== "posing"; f++) tick(s);
  assert.equal(v.status, "posing", venue + ": out of the door and on a spot");
  assert.ok(
    s.venue.selfieSpots.some((p) => dist(p, v) < 0.3),
    venue + ": on one of the spots",
  );
  s.influencer.moveT = 1e9; // (the checks below want them to stay put)
  return { s, v };
}
// Walk coach i up to `to` with real input (a straight line: the spots are open deck), stopping `stop` short.
function walkTo(s, i, to, stop) {
  for (let f = 0; f < 60 * 20; f++) {
    const c = s.coaches[i],
      d = dist(c, to);
    if (d <= stop) break;
    s.inputAs(i, "setMovement", (to.x - c.x) / d, (to.z - c.z) / d);
    tick(s);
  }
  s.inputAs(i, "clearInput");
  tick(s, 30);
}

// ---------------------------------------------------------------------------------------------------------
// At each venue: a guest walking through trips (once), a coach walking into them trips, one standing beside them does not; held E
// sends them off; points both ways.
for (const venue of WHERE) {
  const { s, v } = posing(venue);
  // A guest walking straight through them.
  const p = s.people.find((q) => q.status === "queue") || s.people[0];
  Object.assign(p, {
    status: "arriving",
    x: v.x,
    z: v.z - 2.2,
    path: [{ x: v.x, z: v.z + 2.2 }],
    arrivalHold: 0,
  });
  p.stunned = 0;
  const score = s.score,
    others = s.influencer.tripped.length;
  let tripped = false;
  for (let f = 0; f < 60 * 6; f++) {
    tick(s);
    if (p.slipTime > 0) tripped = true;
  }
  assert.ok(tripped, venue + ": the guest trips over them");
  assert.equal(s.influencer.tripped.filter((id) => id === p.id).length, 1, venue + ": once");
  assert.ok(s.events.some((e) => e.type === "influencer-trip" && e.id === p.id));
  assert.ok(
    s.score <= score - T.penalty * (s.influencer.tripped.length - others),
    venue + ": it costs points",
  );
  // (and back in the queue, out of the coach's way: a guest parked where the test leaves them would shove him)
  Object.assign(p, { status: "queue", path: [], ...s.venue.queuePosition(1, 7) });
  // A coach walking into them goes down; once up, standing by them, not again.
  const c = s.coaches[0];
  const side = [
    { x: 0, z: 2.6 },
    { x: 0, z: -2.6 },
    { x: 2.6, z: 0 },
    { x: -2.6, z: 0 },
  ]
    .map((o) => ({ x: v.x + o.x, z: v.z + o.z }))
    .find((q) => s.venue.isDeck(q.x, q.z, 8, 0.4));
  c.x = side.x;
  c.z = side.z;
  const before = s.stats.coachInfluencerTrips || 0;
  for (let f = 0; f < 60 * 6 && (s.stats.coachInfluencerTrips || 0) === before; f++) {
    const d = dist(c, v);
    s.inputAs(0, "setMovement", (v.x - c.x) / d, (v.z - c.z) / d);
    tick(s);
  }
  s.inputAs(0, "clearInput");
  assert.equal(s.stats.coachInfluencerTrips, before + 1, venue + ": the coach walks into them and goes down");
  assert.ok(
    c.slipTime > 0 && s.events.some((e) => e.type === "coach-slip" && e.influencer),
    "down, with its own message",
  );
  tick(s, 90);
  assert.equal(c.slipTime, 0);
  tick(s, 60);
  assert.equal(s.stats.coachInfluencerTrips, before + 1, venue + ": not again while he stands there");
  // Step back within reach and hold E: 8 s alone, then they put the phone away and leave.
  walkTo(s, 0, { x: v.x + (side.x - v.x) * 0.5, z: v.z + (side.z - v.z) * 0.5 }, 0.15);
  assert.ok(dist(c, v) <= T.reach, venue + ": in reach");
  assert.equal(s.nearestInteraction()?.kind, "influencer", venue + ": E is the influencer's");
  s.setHold(true);
  assert.ok(s.interact());
  tick(s);
  assert.equal(c.state, "Moving the influencer on");
  const p0 = s.influencer.progress;
  tick(s, 60);
  assert.ok(Math.abs(s.influencer.progress - p0 - 1 / T.times[0]) < 0.01, venue + ": 8 s alone");
  for (let f = 0; f < 60 * 9 && v.status !== "done"; f++) tick(s);
  s.setHold(false);
  assert.equal(v.status, "done", venue + ": moved on");
  assert.ok(
    s.events.some((e) => e.type === "points" && e.value === T.reward && dist(e, v) < 0.1),
    venue + ": +" + T.reward + " (someone tripped: no clean bonus)",
  );
  assert.ok(
    s.events.some((e) => e.type === "save" && e.kind === "influencer") || s.stats.influencersMoved === 1,
  );
  for (let f = 0; f < 60 * 40 && s.influencer; f++) tick(s);
  assert.equal(s.influencer, null, venue + ": gone through a door");
  assert.ok(!s.visitors.some((q) => q.kind === "influencer"));
  assert.ok(!c.calming, "the coach is free again");
}

// ---------------------------------------------------------------------------------------------------------
// Let go and the wheel drains; nobody tripped: the clean bonus; they stroll to a better angle when left alone.
{
  const { s, v } = posing("disco", 11, null, true);
  const c = s.coach;
  c.x = v.x + 1.2;
  c.z = v.z;
  tick(s, 2);
  s.setHold(true);
  s.interact();
  tick(s, 120);
  const mid = s.influencer.progress;
  assert.ok(mid > 0.2);
  s.setHold(false);
  tick(s, 30);
  assert.ok(s.influencer.progress < mid, "let go: the wheel drains");
  s.setHold(true);
  s.interact();
  const score = s.score;
  for (let f = 0; f < 60 * 9 && v.status !== "done"; f++) tick(s);
  s.setHold(false);
  assert.ok(
    s.events.some((e) => e.type === "points" && e.value === T.reward + T.cleanBonus),
    "nobody tripped: the clean bonus",
  );
  const again = posing("river", 3);
  again.s.influencer.moveT = 0.1;
  tick(again.s, 30);
  assert.equal(again.v.status, "strolling", "left alone, on to a better angle");
  const first = again.v.spot;
  for (let f = 0; f < 60 * 30 && again.v.status !== "posing"; f++) tick(again.s);
  assert.equal(again.v.status, "posing");
  assert.ok(dist(again.v, first) < 0.3);
}

// ---------------------------------------------------------------------------------------------------------
// Many hands: two coaches 5 s, three 3 s, with a pop as each joins.
for (const n of [2, 3]) {
  const crew = ["waters", "rivers", "brooks"].slice(0, n);
  const { s, v } = posing("arena", 5, crew);
  s.coaches.forEach((c, i) => {
    c.x = v.x + Math.cos(i * 2.1) * 1.3;
    c.z = v.z + Math.sin(i * 2.1) * 1.3;
  });
  tick(s, 2);
  for (let i = 0; i < n; i++) {
    s.inputAs(i, "setHold", true);
    assert.ok(
      s.as(i, () => s.interact()),
      `coach ${i} joins`,
    );
  }
  assert.equal(s.influencer.helpers.length, n);
  assert.ok(s.events.some((e) => e.type === "team-up" && e.kind === "influencer" && e.helpers === n));
  const p0 = s.influencer.progress;
  tick(s, 30);
  const rate = (s.influencer.progress - p0) / 0.5;
  assert.ok(Math.abs(rate - 1 / T.times[n - 1]) < 0.01, `${n} coaches: ${(1 / rate).toFixed(2)} s`);
}

// ---------------------------------------------------------------------------------------------------------
// The same seed plays the same (inputs only), and the bot plays whole shifts at the four venues with it in the plan.
{
  const run = () => {
    const { s } = posing("wave", 21);
    s.influencer.moveT = 3;
    tick(s, 60 * 30);
    return JSON.stringify([
      s.score,
      s.influencer?.tripped,
      s.visitors.map((q) => [q.x.toFixed(3), q.z.toFixed(3)]),
    ]);
  };
  assert.equal(run(), run(), "seeded: the same twice");
  for (const venue of WHERE) {
    const level = 8;
    const bot = new CoachBot(level, 31, {
      config: {
        ...SHIFTS[level - 1],
        venue,
        chaos: [{ kinds: ["influencer"], window: [30, 40] }],
        twist: [],
      },
    }).run();
    const s = bot.s;
    assert.equal(s.status, "ended", venue + ": the shift ends");
    assert.ok(s.met?.includes("influencer"), venue + ": the influencer came");
    assert.equal(s.stats.influencersMoved, 1, venue + ": the bot moved them on");
  }
}

// ---------------------------------------------------------------------------------------------------------
// On screen (headless): a guest's figure with the phone up while they pose, put away once they are done.
{
  const { createCanvas } = await import("@napi-rs/canvas");
  globalThis.document = { createElement: () => createCanvas(256, 128) };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const { PoolWorld } = await import("./dist/scene.mjs");
  const w = new PoolWorld({ clientWidth: 1440, clientHeight: 900 }, () => {}, {
    headless: true,
    venue: VENUES.wave,
  });
  const { s, v } = posing("wave", 13);
  w.sync(s, s.time, 1 / 60);
  w.sync(s, s.time, 1 / 60);
  const g = w.incidentView.visitors.get(v.id);
  assert.ok(g, "drawn");
  const phone = g.userData.held?.phone;
  assert.ok(phone?.visible, "the phone up");
  v.status = "done";
  w.sync(s, s.time, 1 / 60);
  assert.ok(!phone.visible, "put away");
}

console.log(
  "Influencer checks passed: at the Wave Pool, the Aqua Disco, the Lazy River and the Gala only, a few open spots on each deck; drawn at random there and never elsewhere, never a surprise; the sting, the save, the shutter; out of a door to a spot; a guest walking through trips once and it costs points; a coach walking into them goes down, not again while he stands there; held E moves them on (8 s alone, 5 for two, 3 for three), let go and it drains, a clean bonus when nobody tripped; a better angle when left alone; seeded; the bot handles it at all four venues; and on screen the phone up while they pose.",
);
