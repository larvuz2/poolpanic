// The campaign: acts of ten levels, chunks of three, a finale, and the pieces that keep them interesting. Checks the
// structure (every level lands in exactly one zone, level numbers never move), the progress and unlock rules that
// drive the map (with the playtest switch off), drills, bookings and the five mid-shift twists through the real
// simulation, VIP guests, the storm, that Splash Park has its new name and that Act 2 visits all three of its venues.
import assert from "node:assert/strict";
import { PoolSimulation, SHIFTS, swimmerLook } from "./dist/sim.mjs";
import { VENUES } from "./dist/spatial.mjs";
import {
  CAMPAIGN,
  ZONES,
  buildCampaign,
  ACT_LENGTH,
  DRILL_STARS,
  zoneOfLevel,
  zoneStatus,
  levelState,
  currentLevel,
} from "./dist/campaign.mjs";
import { drillStatus, totalStars } from "./dist/campaign.mjs";
import {
  normalizeRecords,
  recordResult,
  recordDrill,
  starsFor,
  starsForDrill,
  isUnlocked,
} from "./dist/progression.mjs";
import { DRILL_LIST, DRILLS, drillForChunk } from "./dist/drills.mjs";
import { BOOKINGS, BOOKINGS_FROM_LEVEL, offerBookings, applyBooking } from "./dist/bookings.mjs";
import { TWISTS, TWIST_TUNING } from "./dist/incidents/twist.mjs";
import { STINGS } from "./dist/moments.mjs";
import { tick } from "./check-helpers.mjs";

const real = { unlockAll: false }; // the star-gated map as a real player sees it

// 1) Structure: two acts, each three chunks of three levels plus a finale; level numbers stay where they were.
{
  assert.equal(CAMPAIGN.length, 2);
  for (const [a, act] of CAMPAIGN.entries()) {
    assert.deepEqual(
      act.zones.map((z) => [z.kind, z.nodes.length]),
      [
        ["chunk", 3],
        ["chunk", 3],
        ["chunk", 3],
        ["finale", 1],
      ],
      "An act is three chunks of three levels and a finale",
    );
    const levels = act.zones.flatMap((z) => z.nodes.map((n) => n.level));
    assert.deepEqual(
      levels,
      Array.from({ length: ACT_LENGTH }, (_, i) => a * ACT_LENGTH + i + 1),
      "Ten consecutive levels per act",
    );
    assert.equal(act.zones.at(-1).nodes[0].slot, "finale");
    assert.deepEqual(
      act.zones[0].nodes.map((n) => n.slot),
      ["learn", "twist", "rush"],
    );
  }
  for (let level = 1; level <= SHIFTS.length; level++)
    assert.equal(
      ZONES.filter((z) => z.nodes.some((n) => n.level === level)).length,
      1,
      `Level ${level} is in one zone`,
    );
  assert.equal(zoneOfLevel(4).name, "Mischief");
  assert.equal(zoneOfLevel(10).kind, "finale");
  assert.equal(zoneOfLevel(11).act, 2);
  // The whole season is built: no slot is left as "soon".
  assert.equal(SHIFTS.length, ACT_LENGTH * 2);
  assert.ok(ZONES.flatMap((z) => z.nodes).every((n) => n.built && n.name && n.venue));
  // A season that is only partly built still shows the rest of the shape as "soon" (levels 16-20 were once).
  const partial = buildCampaign(15),
    soon = partial.flatMap((a) => a.zones.flatMap((z) => z.nodes)).filter((n) => !n.built);
  assert.deepEqual(
    soon.map((n) => n.level),
    [16, 17, 18, 19, 20],
  );
  assert.ok(soon.every((n) => n.name === null && n.venue === null));
  assert.deepEqual(
    ZONES.map((z) => z.order),
    ZONES.map((_, i) => i),
    "Zones are in play order",
  );
  // Venues: the club for Act 1; Act 2 starts at Splash Park, moves to the Sunset Lagoon and ends in the Grand Gala Arena.
  for (const n of CAMPAIGN[0].zones.flatMap((z) => z.nodes)) assert.equal(n.venue, "club");
  const venueOf = (level) => zoneOfLevel(level).nodes.find((n) => n.level === level).venue;
  for (let level = 11; level <= 16; level++) assert.equal(venueOf(level), "resort", "Level " + level);
  for (let level = 17; level <= 19; level++) assert.equal(venueOf(level), "lagoon", "Level " + level);
  assert.equal(venueOf(20), "arena");
  assert.equal(zoneOfLevel(17).name, "Sunset");
  assert.equal(zoneOfLevel(20).name, "Grand gala");
}

// 2) Splash Park has its new name, and no player-facing text still says Riviera.
{
  assert.equal(VENUES.resort.name, "Splash Park");
  assert.ok(!SHIFTS.some((s) => /riviera/i.test(s.name)), "No shift is still called Riviera");
  assert.equal(SHIFTS[14].name, "Lantern night");
  assert.equal(CAMPAIGN[1].name, "Splash Park");
}

// 3) Records: old saves load, bests survive, drills start empty.
{
  const old = normalizeRecords({ bests: [200, 700], unlocked: 3 });
  assert.equal(old.bests[0], 200);
  assert.equal(old.unlocked, 3);
  assert.deepEqual(
    Object.keys(old.drills),
    DRILL_LIST.map((d) => d.id),
  );
  assert.ok(Object.values(old.drills).every((v) => v === 0));
  const junk = normalizeRecords({ bests: "x", unlocked: -5, drills: { fish: "many" } });
  assert.equal(junk.unlocked, 1);
  assert.equal(junk.drills.fish, 0);
  assert.deepEqual(normalizeRecords(null).bests.length, SHIFTS.length);
}

// 4) The star-gated map: where "you are here" is, what is open, when a chunk is complete and the next opens.
{
  const r = normalizeRecords();
  const state = (n) =>
    levelState(
      r,
      zoneOfLevel(n).nodes.find((x) => x.level === n),
      real,
    );
  assert.equal(currentLevel(r), 1);
  assert.equal(state(1), "current");
  assert.equal(state(2), "locked");
  assert.equal(state(16), "locked");
  const partialNode = buildCampaign(15)[1].zones[1].nodes[2];
  assert.equal(
    levelState(r, partialNode, real),
    "soon",
    "A level the season has not built is on the map as soon",
  );
  const first = ZONES[0];
  assert.deepEqual(
    { ...zoneStatus(r, first, real), stars: undefined },
    { total: 3, built: 3, cleared: 0, stars: undefined, complete: false, open: true, reached: true },
  );
  assert.equal(
    zoneStatus(r, ZONES[1], real).open,
    false,
    "The next chunk is closed until this one is cleared",
  );
  assert.equal(zoneStatus(r, ZONES[1], real).reached, false);
  // Clear levels 1 and 2 with one star each: still "2 of 3", the third is where you are.
  recordResult(r, 1, SHIFTS[0].thresholds[0]);
  recordResult(r, 2, SHIFTS[1].thresholds[0]);
  assert.equal(currentLevel(r), 3);
  assert.equal(state(1), "cleared");
  assert.equal(state(2), "cleared");
  assert.equal(state(3), "current");
  assert.equal(zoneStatus(r, first, real).cleared, 2);
  assert.equal(zoneStatus(r, first, real).complete, false);
  assert.equal(zoneStatus(r, ZONES[1], real).reached, false);
  // A miss (no star) clears nothing.
  recordResult(r, 3, SHIFTS[2].thresholds[0] - 1);
  assert.equal(state(3), "current");
  // Clearing the third completes the chunk and opens the next area.
  recordResult(r, 3, SHIFTS[2].thresholds[0]);
  assert.equal(zoneStatus(r, first, real).complete, true);
  assert.equal(zoneStatus(r, ZONES[1], real).reached, true);
  assert.equal(zoneStatus(r, ZONES[1], real).open, true);
  assert.equal(state(4), "current");
  assert.equal(zoneStatus(r, ZONES[2], real).reached, false, "…but not the one after");
  // "You are here" never runs past the last built level.
  const all = normalizeRecords();
  for (let n = 1; n <= SHIFTS.length; n++) recordResult(all, n, SHIFTS[n - 1].thresholds[0]);
  assert.equal(currentLevel(all), SHIFTS.length);
  // Moonlight is levels 14 to 16: every one built, so clearing them completes the chunk.
  const moon = ZONES[5];
  assert.equal(moon.name, "Moonlight");
  assert.deepEqual(zoneStatus(all, moon, real), {
    total: 3,
    built: 3,
    cleared: 3,
    stars: 3,
    complete: true,
    open: true,
    reached: true,
  });
  // A chunk with unbuilt slots can never complete (level 16 used to be "soon").
  const partialMoon = buildCampaign(15)[1].zones[1];
  assert.deepEqual(zoneStatus(all, partialMoon, real), {
    total: 3,
    built: 2,
    cleared: 2,
    stars: 2,
    complete: false,
    open: true,
    reached: true,
  });
  // The finale opens only after Sunset is cleared.
  const finale = ZONES.at(-1);
  assert.equal(finale.kind, "finale");
  assert.equal(zoneStatus(normalizeRecords(), finale, real).reached, false);
  assert.equal(zoneStatus(all, finale, real).reached, true);
  // With the playtest switch on, every built level is open but progress still shows.
  assert.equal(isUnlocked(normalizeRecords(), 20, true), true);
  assert.equal(isUnlocked(normalizeRecords(), 20, false), false);
  assert.equal(levelState(normalizeRecords(), zoneOfLevel(9).nodes[2], { unlockAll: true }), "open");
  assert.equal(totalStars(r) >= 3, true);
}

// 5) Drills: one per chunk with a built venue, open at enough stars in the cleared chunk (or in playtest mode).
{
  assert.deepEqual(
    DRILL_LIST.map((d) => d.chunk),
    [1, 2, 3, 4, 5, 6],
  );
  for (const d of DRILL_LIST) {
    assert.equal(drillForChunk(d.chunk), d);
    assert.ok(d.tier >= 1 && d.tier <= SHIFTS.length, d.id + " has a feature tier");
    const c = d.config;
    assert.ok(c.duration >= 60 && c.duration <= 90, d.id + " is a short shift");
    assert.ok(
      c.thresholds.length === 3 && c.thresholds[0] < c.thresholds[1] && c.thresholds[1] < c.thresholds[2],
    );
    assert.ok(VENUES[c.venue || "club"], d.id + " uses a venue that exists");
    const s = new PoolSimulation(d.tier, 7, { config: c, drill: d.id });
    assert.equal(s.config, c, "A drill plays its own config");
    assert.equal(s.drill, d.id);
    assert.equal(s.venue, VENUES[c.venue || "club"]);
    assert.equal(
      s.chaosPlan.length,
      (c.chaos || []).length + [].concat(c.twist || []).length,
      "The plan holds the drill's incidents and its twists",
    );
  }
  const r = normalizeRecords();
  const zone = ZONES[0];
  assert.equal(drillStatus(r, zone, real).unlocked, false);
  assert.equal(drillStatus(r, zone, { unlockAll: true }).unlocked, true, "Everything is open while testing");
  // Cleared with one star each: 3 stars, not enough.
  for (const n of [1, 2, 3]) recordResult(r, n, SHIFTS[n - 1].thresholds[0]);
  assert.equal(zoneStatus(r, zone, real).stars, 3);
  assert.equal(
    drillStatus(r, zone, real).unlocked,
    false,
    "A cleared chunk is not enough: it needs " + DRILL_STARS + " stars",
  );
  // Two more stars in the chunk open it.
  recordResult(r, 2, SHIFTS[1].thresholds[1]);
  recordResult(r, 3, SHIFTS[2].thresholds[1]);
  assert.equal(zoneStatus(r, zone, real).stars, 5);
  const open = drillStatus(r, zone, real);
  assert.deepEqual([open.unlocked, open.have, open.need], [true, 5, DRILL_STARS]);
  // Scores: stars and bests for drills.
  const d = DRILLS.fish;
  assert.equal(starsForDrill("fish", d.config.thresholds[0] - 1), 0);
  assert.equal(starsForDrill("fish", d.config.thresholds[1]), 2);
  assert.equal(recordDrill(r, "fish", 1500), true);
  assert.equal(recordDrill(r, "fish", 1200), false);
  assert.equal(r.drills.fish, 1500);
  assert.equal(drillStatus(r, ZONES[1], { unlockAll: true }).best, 1500);
  assert.equal(drillStatus(r, ZONES[3], real), null, "A finale has no drill");
  // The last chunk's drill is the storm drill on the lagoon at dusk.
  const storm = drillForChunk(6);
  assert.equal(storm.id, "storm");
  assert.equal(ZONES[6].drill, storm);
  assert.equal(storm.config.venue, "lagoon");
  assert.ok(storm.config.twist.some((t) => t.kind === "storm"));
  assert.equal(drillStatus(r, ZONES[7], real), null, "The grand gala has no drill");
}

// 6) Bookings: a risk dial from Act 2 on. Regular is always on offer; a bigger payout always means more trouble.
{
  const offer = (level) => offerBookings(level, 0, SHIFTS[level - 1]);
  assert.equal(BOOKINGS_FROM_LEVEL, 11);
  for (let level = 1; level < BOOKINGS_FROM_LEVEL; level++)
    assert.deepEqual(offer(level), [], "No bookings before Act 2");
  for (let level = BOOKINGS_FROM_LEVEL; level <= SHIFTS.length; level++) {
    const list = offer(level);
    assert.equal(list.length, 3, "Three bookings on offer");
    assert.equal(list[0].id, "regular");
    assert.equal(new Set(list.map((b) => b.id)).size, 3);
    assert.deepEqual(offer(level), list, "The same shift always offers the same bookings");
  }
  for (const b of Object.values(BOOKINGS)) {
    if (b.id === "regular") assert.equal(b.payout, 1);
    else
      assert.ok(b.payout > 1 && (b.chaos?.length || b.twist?.length), b.id + " pays more and brings trouble");
  }
  // Bookings never duplicate what the level already has: night levels, a sun that is setting by itself (the lagoon's
  // three levels) and the indoor arena never offer a night booking.
  for (const level of [14, 15, 16, 17, 18, 19, 20])
    assert.ok(!offer(level).some((b) => b.id === "night"), "No night booking at level " + level);
  assert.ok(
    [0, 1, 2, 3, 4, 5].some((seed) => offerBookings(12, seed, SHIFTS[11]).some((b) => b.id === "night")),
    "The night booking is still offered where it changes something",
  );
  // applyBooking folds into a copy and scales windows to the shift length.
  const base = SHIFTS[11],
    before = JSON.stringify(base),
    stag = applyBooking(base, BOOKINGS.stag);
  assert.equal(JSON.stringify(base), before, "The shift itself is never modified");
  assert.equal(stag.chaos.length, base.chaos.length + 1);
  const extra = stag.chaos.at(-1);
  assert.deepEqual(extra.kinds, ["carl"]);
  assert.ok(extra.window[0] >= 0.18 * base.duration - 0.1 && extra.window[1] <= 0.4 * base.duration + 0.1);
  assert.equal(stag.payout, 1.35);
  assert.equal(applyBooking(base, BOOKINGS.night).lighting, "night");
  // A shift whose light follows the sun keeps its own sky whatever is booked.
  assert.equal(applyBooking(SHIFTS[17], BOOKINGS.night).lighting, SHIFTS[17].lighting);
  assert.equal(applyBooking(base, BOOKINGS.tour).twist.at(-1).kind, "rush");
  assert.equal(applyBooking(base, BOOKINGS.regular).payout, undefined);
  // In the simulation: the booking's trouble is planned, and the payout scales only what served swimmers earn.
  const trouble = new PoolSimulation(12, 5, { booking: "stag" });
  assert.equal(trouble.booking, "stag");
  assert.ok(trouble.chaosPlan.some((e) => e.kind === "carl"));
  const serve = (booking) => {
    const s = new PoolSimulation(12, 5, booking ? { booking } : {});
    s.schedule = [];
    s.chaosPlan = [];
    s.start();
    const p = s.spawn({ type: "intermediate", sick: false });
    Object.assign(p, {
      status: "swim",
      lane: 1,
      workTime: 20,
      traveled: 40,
      wait: 4,
      h: 100,
      hadCollision: false,
      slowTime: 0,
    });
    s.depart(p, true);
    return s.score;
  };
  const plain = serve(null),
    paid = serve("stag");
  assert.ok(plain > 0);
  assert.ok(Math.abs(paid / plain - 1.35) < 0.04, `A 1.35 payout pays about 1.35× (${paid} vs ${plain})`);
}

// 7) Twists: every shift's twists are known kinds at sensible times, each has a sting, and none needs chaos slots.
{
  for (const [i, shift] of SHIFTS.entries())
    for (const t of [].concat(shift.twist || [])) {
      assert.ok(TWISTS[t.kind], `Level ${i + 1}: known twist ${t.kind}`);
      assert.ok(t.at >= 0.2 && t.at <= 0.75, `Level ${i + 1}: a twist comes mid-shift (${t.at})`);
      assert.ok(STINGS[t.kind], `The ${t.kind} twist has a sting`);
    }
  // A twist per chunk's middle level (plus the finale) from chunk 2 on, level 2 in the first chunk, and the last two
  // acts' late levels (16, 18, 19) and the grand gala, which has three.
  const withTwist = SHIFTS.map((s, i) => (s.twist ? i + 1 : 0)).filter(Boolean);
  assert.deepEqual(withTwist, [2, 5, 8, 10, 12, 14, 15, 16, 18, 19, 20]);
  assert.equal([].concat(SHIFTS[19].twist).length, 3, "The gala changes the rules three times");
  assert.ok(
    [].concat(SHIFTS[18].twist).some((t) => t.kind === "storm"),
    "Storm front has its storm",
  );
}
const bare = (level, twist, extra = {}) => {
  const s = new PoolSimulation(level, 11, { config: { ...SHIFTS[level - 1], chaos: [], twist, ...extra } });
  s.start();
  return s;
};
const emitted = (s, type, kind) => s.events.filter((e) => e.type === type && e.kind === kind);
{
  // Rush: extra swimmers arrive together, woven into the arrivals still to come, all before closing.
  const s = bare(2, [{ kind: "rush", at: 0.5, count: 3 }]);
  assert.equal(s.chaosPlan.length, 1, "A twist rides in the chaos plan");
  const total = s.schedule.length;
  tick(s, 60 * 29);
  assert.equal(s.schedule.length, total, "Nothing yet before the halfway mark");
  tick(s, 60 * 2);
  assert.equal(s.schedule.length, total + 3, "Three more swimmers are on their way");
  const sting = emitted(s, "incident", "rush")[0];
  assert.ok(sting && sting.count === 3 && Number.isFinite(sting.x), "The rush is announced with a position");
  assert.ok(
    s.schedule.every((e, i) => i === 0 || s.schedule[i - 1].at <= e.at),
    "Arrivals stay in time order",
  );
  tick(s, 60 * 40);
  assert.equal(s.nextArrival, s.schedule.length, "Everyone in the crowd arrived");
  assert.ok(s.chaosPlan.every((e) => e.done));
}
{
  // Closure: one lane goes out of service for the rest of the shift.
  const s = bare(8, [{ kind: "closure", at: 0.5, lane: 1 }]);
  assert.equal(s.laneClosed(), -1);
  tick(s, 60 * 68);
  assert.equal(s.laneClosed(), 1);
  const sting = emitted(s, "incident", "closure")[0];
  assert.equal(sting.lane, 2, "The sting names the lane the way the buttons do");
  assert.ok(Math.abs(sting.x - s.lanes[1]) < 1e-9);
  assert.equal(s.laneLocked(1), true);
  assert.equal(s.laneLocked(0), false);
  const p = s.spawn({ type: "intermediate", sick: false });
  s.select(p.id);
  s.events.length = 0;
  assert.equal(s.assign(1), false, "Nobody new goes into a closed lane");
  assert.ok(
    s.events.some((e) => e.type === "toast" && /closed/.test(e.text)),
    "…and the toast says why",
  );
  assert.equal(p.status, "queue");
  assert.equal(s.assign(0), true, "Other lanes still work");
  // Moving a swimmer into it is refused too, and returning swimmers are sent to a neighbour.
  const q = s.spawn({ type: "intermediate", sick: false });
  Object.assign(q, { status: "swim", lane: 0, p: 5, x: s.lanes[0], z: 0 });
  s.select(q.id);
  assert.equal(s.moveLane(q, 1), false);
  assert.equal(q.lane, 0);
  q.resumeLane = 1;
  assert.notEqual(s.returnLane(q), 1);
  assert.ok([0, 2].includes(s.returnLane(q)));
  // The resort's splash lane is never the one a closure takes.
  const park = bare(12, [{ kind: "closure", at: 0.1, lane: 4 }]);
  tick(park, 60 * 15);
  assert.notEqual(park.laneClosed(), park.venue.trampoline.lane);
  assert.equal(park.laneClosed(), 3);
  // Both locks work together: the splash lane and a closed lane are refused independently.
  assert.equal(park.laneLocked(3), true);
}
{
  // Swim team and aqua class: from the twist on, most arrivals are Pros (or aqua aerobics).
  const kinds = (twist) => {
    const counts = { beginner: 0, intermediate: 0, advanced: 0, aqua: 0 };
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = new PoolSimulation(9, seed, {
        config: { ...SHIFTS[8], chaos: [], twist, total: 40, duration: 150 },
      });
      s.start();
      tick(s, 60 * 76);
      const mark = s.people.length;
      tick(s, 60 * 60);
      for (const p of s.people.slice(mark)) counts[p.type]++;
    }
    return counts;
  };
  const team = kinds([{ kind: "team", at: 0.4 }]),
    aqua = kinds([{ kind: "class", at: 0.4 }]);
  const share = (c, k) => c[k] / Object.values(c).reduce((a, b) => a + b, 0);
  assert.ok(
    share(team, "advanced") > 0.6,
    "A swim team turns most arrivals into Pros (" + JSON.stringify(team) + ")",
  );
  assert.ok(
    share(aqua, "aqua") > 0.5,
    "An aqua class turns most arrivals into aqua aerobics (" + JSON.stringify(aqua) + ")",
  );
  assert.deepEqual(TWIST_TUNING.teamMix.length, 3);
  const s = bare(9, [{ kind: "team", at: 0.4 }]);
  assert.equal(s.mixOverride, null);
  tick(s, 60 * 62);
  assert.deepEqual(s.mixOverride, TWIST_TUNING.teamMix);
  assert.equal(emitted(s, "incident", "team").length, 1);
}
{
  // Twists wait out a rescue, a cleanup or a closed pool; they are skipped near closing; they ignore the incident cap.
  const s = bare(5, [{ kind: "closure", at: 0.5 }]);
  s.rescue = { kind: "cramp", stage: "stranded", victims: [] };
  tick(s, 60 * 65);
  assert.equal(s.laneClosed(), -1, "Not during a rescue");
  s.rescue = null;
  tick(s, 60);
  assert.equal(s.laneClosed(), 1, "…but as soon as it is over");
  const late = bare(5, [{ kind: "closure", at: 0.95 }]);
  tick(late, 60 * 117);
  assert.equal(late.laneClosed(), -1, "Too close to closing to matter");
  assert.ok(
    late.chaosPlan.every((e) => e.done),
    "…and dropped, not left waiting",
  );
  // With an incident already running at the cap (one at a time), a twist still starts.
  const busy = new PoolSimulation(5, 3, {
    config: { ...SHIFTS[4], chaos: [], twist: [{ kind: "closure", at: 0.4 }] },
  });
  busy.start();
  busy.triggerChaos("dog");
  tick(busy, 60 * 50);
  assert.ok(busy.dog, "The dog is still on the loose");
  assert.equal(busy.laneClosed(), 1, "A twist is not an incident: it does not wait for the cap");
  // Clearing the chaos plan (as the checks do) clears the twists too.
  const plain = new PoolSimulation(2, 1);
  plain.chaosPlan = [];
  plain.start();
  tick(plain, 60 * 45);
  assert.equal(plain.schedule.length, SHIFTS[1].total, "No plan, no twist");
}
{
  // Storm front: the sky takes a few seconds to turn, then rain leaves puddles on the deck (never under the coach).
  const s = bare(19, [{ kind: "storm", at: 0.4 }]);
  assert.equal(s.stormLevel(), 0, "Clear skies until the twist");
  const start = s.config.duration * 0.4;
  tick(s, Math.round((start - 1) * 60));
  assert.equal(s.stormLevel(), 0);
  tick(s, 60 * 2);
  const sting = emitted(s, "incident", "storm")[0];
  assert.ok(sting && Number.isFinite(sting.x), "The storm is announced");
  assert.ok(s.stormLevel() > 0 && s.stormLevel() < 1, "The sky is still turning");
  assert.equal(s.hazards.filter((h) => h.rain).length, 0, "No puddles before the rain arrives");
  tick(s, 60 * (TWIST_TUNING.stormRamp + 1));
  assert.equal(s.stormLevel(), 1, "The storm is at full strength after its ramp");
  tick(s, 60 * 30);
  const rain = s.hazards.filter((h) => h.rain);
  assert.ok(rain.length >= 1 && rain.length <= 6, `Rain puddles gather, capped at six (${rain.length})`);
  assert.ok(
    rain.every((h) => Math.hypot(h.x - s.coach.x, h.z - s.coach.z) >= 2 || h.life < 14),
    "Puddles never form on top of the coach",
  );
  assert.ok(
    rain.every((h) => h.x >= s.venue.deck.minX && h.x <= s.venue.deck.maxX),
    "Puddles stay on the deck",
  );
  // Fresh simulations start with clear skies, and a shift without the twist never rains.
  assert.equal(new PoolSimulation(19, 2).stormLevel(), 0);
  const dry = bare(19, []);
  tick(dry, 60 * 90);
  assert.equal(dry.hazards.filter((h) => h.rain).length, 0);
}
{
  // VIP guests: flagged arrivals who tip +150 (before the multiplier), lose patience sooner and cost −300 if they leave.
  const s = new PoolSimulation(17, 3);
  const guests = s.schedule.filter((e) => e.vip);
  assert.equal(guests.length, SHIFTS[16].vipAt.length, "Every planned VIP is on the schedule");
  assert.ok(guests.every((e) => ["beginner", "intermediate", "advanced"].includes(e.type) && !e.sick));
  assert.ok(
    new PoolSimulation(1, 3).schedule.every((e) => !e.vip),
    "The club never has VIPs",
  );
  const fresh = (vip) => {
    const t = new PoolSimulation(17, 5);
    t.schedule = [];
    t.chaosPlan = [];
    t.start();
    const p = t.spawn({ type: "intermediate", sick: false, vip });
    return { t, p };
  };
  const { t, p } = fresh(true),
    plain = fresh(false);
  assert.equal(p.vip, true);
  assert.equal(t.events.filter((e) => e.type === "vip").length, 1, "A VIP arrival is announced");
  assert.ok(
    t.events.some((e) => e.type === "toast" && /VIP/.test(e.text)),
    "…with a toast the first time",
  );
  assert.ok(Math.abs(p.waitLimit - plain.p.waitLimit * 0.75) < 1e-6, "VIPs will not wait as long");
  // swimmerLook: a golden crown over whatever they swim like.
  assert.equal(swimmerLook(p).icon, "👑");
  assert.match(swimmerLook(p).label, /VIP · Intermediate/);
  assert.equal(swimmerLook(plain.p).icon, "🏊", "Everyone else keeps their own look");
  // Serving one pays 150 more; the same swimmer, a plain guest, does not.
  const serve = (guest) => {
    const { t, p } = guest;
    Object.assign(p, { status: "swim", lane: 1, workTime: 20, traveled: 40, wait: 4, h: 100 });
    Object.assign(p, { hadCollision: false, slowTime: 0 });
    t.depart(p, true);
    return t.score;
  };
  const vipScore = serve({ t, p }),
    plainScore = serve(plain);
  assert.ok(
    Math.abs(vipScore - plainScore - 150 * t.scoreMultiplier()) < 2,
    `A served VIP is worth 150 extra (${vipScore} vs ${plainScore})`,
  );
  assert.equal(t.stats.vips, 1);
  // Losing one costs 300, others 100.
  const lost = fresh(true),
    lostPlain = fresh(false);
  lost.t.lose(lost.p);
  lostPlain.t.lose(lostPlain.p);
  assert.equal(lost.t.score, -300);
  assert.equal(lostPlain.t.score, -100);
}
{
  // Four venues: Splash Park, the Sunset Lagoon and the Grand Gala Arena share one floor plan, so every check that
  // reads positions, lanes or the deck works in all of them; the arena is indoors, the club too.
  const plan = (v) => JSON.stringify([v.pool, v.deck, v.lanes, v.arrival]);
  assert.deepEqual(Object.keys(VENUES).sort(), ["arena", "club", "lagoon", "resort"]);
  assert.equal(plan(VENUES.lagoon), plan(VENUES.resort));
  assert.equal(plan(VENUES.arena), plan(VENUES.resort));
  assert.equal(VENUES.lagoon.name, "Sunset Lagoon");
  assert.equal(VENUES.arena.name, "Grand Gala Arena");
  assert.deepEqual(
    Object.values(VENUES).map((v) => !!v.indoor),
    [true, false, false, true],
    "Club and arena are indoors",
  );
  for (const [i, shift] of SHIFTS.entries())
    assert.ok(VENUES[shift.venue || "club"], `Level ${i + 1} plays in a venue that exists`);
  // A sliding sky: `daylight` runs between two points on the day scale, forward in time, inside 0..1.
  for (const [i, shift] of SHIFTS.entries())
    if (shift.daylight) {
      const [from, to] = shift.daylight;
      assert.ok(from >= 0 && to <= 1 && from < to, `Level ${i + 1}: the sun moves forward`);
    }
  for (let level = 17; level < 20; level++)
    assert.ok(SHIFTS[level - 1].daylight, `Level ${level} at the lagoon has its own sun`);
  assert.ok(SHIFTS[16].daylight[1] <= SHIFTS[17].daylight[0] + 1e-9, "Golden hour ends where sunset starts");
  assert.ok(
    SHIFTS[17].daylight[1] <= SHIFTS[18].daylight[0] + 1e-9,
    "…and sunset ends where the storm starts",
  );
}
console.log(
  "Campaign checks passed: two ten-level acts of three-level chunks and a finale, level numbers stable, Splash Park renamed, star-gated progress and chunk completion, drills that open at five stars, bookings that trade payout for trouble, the rush, lane-closure, swim-team, aqua-class and storm twists, VIP guests, and the resort, lagoon and arena sharing one floor plan.",
);
