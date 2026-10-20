// Phase 3 (20 October 2026): depth and feel. The happy streak (every happy guest, save and tip feeds it; tiers to ×2.5; who puts it
// at risk; what broke it), coaching tips in the lane pools, the big moment in every shift (each pool its own), the river's two ways
// round and the rooftop's seating, and the highlight replay (a shift's best clip rebuilt from its record, exactly).
import assert from "node:assert/strict";
import { PoolSimulation, SHIFTS, STREAK_TIERS, streakTier } from "./dist/sim.mjs";
import { TIPS, tipsVenue, giveTip } from "./dist/tips.mjs";
import { BIG, BIG_KINDS, bigKind, bigTime, raceLane, startRace } from "./dist/big-moment.mjs";
import { ROUTES } from "./dist/river-ride.mjs";
import { SEATS, seatVerdict } from "./dist/rooftop.mjs";
import { laneVerdict } from "./dist/guidance.mjs";
import { STINGS, SAVES } from "./dist/moments.mjs";
import { HighlightPicker, ClipPlayer, clipOf } from "./dist/highlight.mjs";
import { Recorder, stateHash } from "./dist/replay.mjs";
import { VENUES } from "./dist/spatial.mjs";
import * as W from "./dist/week.mjs";
import { CoachBot } from "./check-bot.mjs";

const run = (s, seconds, each = null) => {
  for (let i = 0; i < seconds * 60 && s.status !== "ended"; i++) {
    each?.(s);
    s.tick(1 / 60);
  }
};
const quiet = (level, extra = {}, seed = 7) => {
  const s = new PoolSimulation(level, seed, {
    config: { ...SHIFTS[level - 1], chaos: [], twist: [], sickRate: 0, ...extra },
  });
  s.start();
  return s;
};

// 1) The streak: tiers and their multipliers, happy guests and saves feed it, anything gone wrong breaks it (and says what), and
// the crossest guest under STREAK_RISK puts it at risk.
{
  assert.deepEqual(
    STREAK_TIERS.map((t) => [t.at, t.mult]),
    [
      [0, 1],
      [3, 1.2],
      [5, 1.5],
      [8, 2],
      [12, 2.5],
    ],
  );
  assert.equal(streakTier(11).mult, 2);
  assert.equal(streakTier(12).name, "UNSTOPPABLE");
  const s = quiet(6);
  const ev = [];
  const push = s.events.push.bind(s.events);
  s.events.push = (e) => (ev.push(e), push(e));
  for (let i = 0; i < 5; i++) s.save("mopped", s.coach, 10);
  assert.equal(s.streak, 5, "every save adds one");
  assert.equal(s.multiplier(), 1.5);
  assert.deepEqual(
    ev.filter((e) => e.type === "streak-tier").map((e) => e.name),
    ["WARMING UP", "ON A ROLL"],
    "a tier reached is a moment",
  );
  const p = s.spawn({ entrance: false });
  p.h = 20;
  assert.equal(s.streakRisk(), p, "the crossest guest puts it at risk");
  s.lose(p);
  assert.equal(s.streak, 0);
  const broke = ev.find((e) => e.type === "streak-broken");
  assert.ok(
    broke && broke.was === 5 && broke.why === "lost" && broke.name === p.name,
    "and says who broke it",
  );
}

// 2) Coaching tips: only in the lap-lane pools; a lap swimmer asks once in a workout and keeps swimming until answered (or the ask
// lapses); E within reach answers it: points, mood, a faster swimmer, one more for the streak.
{
  assert.ok(
    tipsVenue(VENUES.club) &&
      tipsVenue(VENUES.aquatic) &&
      tipsVenue(VENUES.senior) &&
      tipsVenue(VENUES.resort),
  );
  for (const v of ["disco", "kids", "river", "wave", "roof", "onsen", "cruise"])
    assert.ok(!tipsVenue(VENUES[v]), "no tips at the " + v);
  const s = quiet(10, { finChance: 0 }, 11);
  const p = s.spawn({ entrance: false, type: "intermediate" });
  Object.assign(p, { crampAt: Infinity, sick: false });
  s.select(p.id);
  assert.ok(s.assign(1));
  p.tipAt = 4; // (they ask four metres in)
  for (let i = 0; i < 60 * 30 && !p.ask; i++) s.tick(1 / 60);
  assert.ok(p.ask, "a swimmer asks");
  const asked = p.traveled;
  run(s, 2);
  assert.ok(p.status === "swim" && p.traveled > asked, "and keeps swimming, waiting for the coach");
  // The coach to the end of the lane (put there), and E when they come by.
  Object.assign(s.coach, s.servicePoint(p));
  for (let i = 0; i < 60 * 6 && !s.swimmerInReach(p); i++) s.tick(1 / 60);
  assert.ok(p.ask && s.swimmerInReach(p), "the coach in reach while they still ask");
  const before = s.score,
    streak = s.streak,
    mood = p.h;
  const opt = s.nearestInteraction();
  assert.equal(opt?.kind, "tip", "E coaches them");
  opt.run();
  run(s, 1);
  assert.ok(!p.ask && p.coached && p.boost === TIPS.boost, "coached, and faster for the rest of the workout");
  assert.equal(s.score - before, TIPS.points);
  assert.equal(s.streak, streak + 1, "a tip feeds the streak");
  assert.ok(p.h >= Math.min(100, mood + TIPS.mood) - 2);
  assert.equal(giveTip(s, p), false, "only once");
  // An ask left alone lapses, and disappoints.
  const q = s.spawn({ entrance: false, type: "beginner" });
  Object.assign(q, { crampAt: Infinity, sick: false });
  s.select(q.id);
  s.assign(0);
  q.tipAt = 2;
  run(s, 40);
  assert.ok(q.tipDone && !q.ask && (s.stats.tipsMissed || 0) >= 1, "unanswered, the ask lapses");
  // The coach bot answers them.
  const bot = new CoachBot(10, 21).run();
  assert.ok((bot.s.stats.tips || 0) > 0, "the bot coaches swimmers (" + (bot.s.stats.tips || 0) + " tips)");
}

// 3) The big moment: every shift of the week from the first Tuesday has one, about two thirds of the way; each pool its own.
{
  const save = W.normalizeWeekSave({});
  save.week = W.newWeek(save, 99);
  const shifts = [0, 1, 2, 3, 4, 5].map((i) =>
    W.buildShift({ ...save.week, shift: i }, null, W.INCIDENT_ORDER),
  );
  assert.ok(!shifts[0].config.big, "not in the gentle first minute");
  for (const sh of shifts.slice(1)) {
    assert.ok(
      sh.config.big && sh.config.big.at >= 0.6 && sh.config.big.at <= 0.7,
      "a big moment, two thirds in",
    );
    const at = bigTime(sh.config.duration, sh.config.big.at);
    assert.ok(at >= BIG.earliest && at <= sh.config.duration - BIG.room + 1e-9);
  }
  const kinds = {
    club: "race",
    resort: "race",
    lagoon: "race",
    arena: "race",
    aquatic: "race",
    senior: "race",
    disco: "encore",
    kids: "party",
    river: "parade",
    wave: "monsters",
    roof: "headline",
    cruise: "rogue",
    onsen: "troop",
  };
  for (const [venue, kind] of Object.entries(kinds)) {
    assert.equal(bigKind(VENUES[venue]), kind, venue + ": " + kind);
    assert.ok(STINGS["big-" + kind], "its sting");
  }
  assert.ok(SAVES["big-great"] && SAVES["big-good"], "its stamps");
  // Each one runs to its end and is graded, with the bot playing (a few seeds each).
  for (const [venue, kind] of Object.entries(kinds)) {
    if (["resort", "lagoon", "arena", "aquatic", "senior"].includes(venue)) continue; // (the race: below)
    const config = { ...SHIFTS[11], venue, big: { at: 0.64 } };
    const bot = new CoachBot(12, 5, { config }).run();
    const B = bot.s.big;
    assert.equal(B.kind, kind);
    assert.ok(
      B.stage === "done" || B.stage === "skipped",
      venue + ": the " + kind + " ends (" + B.stage + ")",
    );
    if (B.stage === "done")
      assert.ok(["great", "good", "miss"].includes(B.result) && bot.s.stats.big.kind === kind);
  }
}

// 4) The race: the race lane is locked from the announcement (nobody new goes in; it says why), two racers walk to the blocks, the
// whistle needs a clear lane, and a race into a busy lane is a pile-up. The bot clears the lane and starts it: a great race.
{
  const s = quiet(10, { big: { at: 0.66 }, finChance: 0 }, 3);
  const B = s.big;
  assert.equal(B.kind, "race");
  const p = s.spawn({ entrance: false, type: "intermediate" });
  Object.assign(p, { crampAt: Infinity, sick: false, waitLimit: 999 });
  const lane = raceLane(s);
  s.select(p.id);
  s.assign(lane);
  run(s, 6);
  s.time = B.at - BIG.announce - 0.01;
  run(s, 0.1);
  assert.equal(B.stage, "announce");
  assert.ok(s.laneLocked(lane), "the race lane is locked");
  const q = s.spawn({ entrance: false, type: "beginner" });
  Object.assign(q, { waitLimit: 999, crampAt: Infinity, sick: false });
  s.select(q.id);
  assert.equal(s.assign(lane), false, "nobody new into the race lane");
  run(s, BIG.announce + 1);
  assert.equal(B.stage, "live");
  assert.ok(
    B.racers.every((id) => s.get(id).raceStage === "ready"),
    "the racers on the blocks",
  );
  if (p.status === "swim" && p.lane === lane)
    assert.equal(startRace(s, true), false, "no whistle into a busy lane");
  run(s, BIG.raceWait + 12);
  assert.equal(B.stage, "done");
  if (p.lane === lane) assert.equal(B.result, "miss", "a pile-up");
  for (const seed of [3, 4, 5]) {
    const bot = new CoachBot(12, seed, { config: { ...SHIFTS[11], venue: "club", big: { at: 0.64 } } }).run();
    assert.equal(
      bot.s.big.result,
      "great",
      "the bot clears the lane and blows the whistle (seed " + seed + ")",
    );
  }
}

// 5) The Lazy River's two ways round: thrill-seekers and chillers, the verdict at once, the rapids quicker and wild.
{
  const s = new PoolSimulation(10, 13, {
    config: { ...SHIFTS[9], venue: "river", chaos: [], twist: [], sickRate: 0 },
  });
  s.start();
  assert.equal(s.lanes.length, 2, "two ways round");
  const people = Array.from({ length: 30 }, () => s.spawn({ entrance: false }));
  const share = people.filter((p) => p.thrill).length / people.length;
  assert.ok(share > 0.2 && share < 0.7, "thrill-seekers and chillers (" + share.toFixed(2) + ")");
  const thrill = people.find((p) => p.thrill),
    chill = people.find((p) => !p.thrill);
  assert.ok(laneVerdict(s, thrill, ROUTES.rapids.lane).good && !laneVerdict(s, thrill, 0).good);
  assert.ok(laneVerdict(s, chill, 0).good && !laneVerdict(s, chill, ROUTES.rapids.lane).good);
  const bot = new CoachBot(12, 4, { config: { ...SHIFTS[11], venue: "river" } }).run();
  assert.ok((bot.s.stats.rapids || 0) > 0, "riders shot the rapids");
}

// 6) The Rooftop Pool's seating: guests wait by the lift for the coach, who seats them (1 water, 2 sunbed, 3 cabana); each has a wish,
// judged at once; a cabana is refused when none is free.
{
  const bot = new CoachBot(8, 5, {
    config: { ...SHIFTS[7], venue: "roof", chaos: [], twist: [], sickRate: 0, duration: 900 },
  });
  const s = bot.s;
  s.schedule = [];
  s.chaosPlan = [];
  s.roof.drops = [];
  s.roof.selfieIn = 1e9;
  s.start();
  const p = s.spawn({ entrance: true });
  for (let i = 0; i < 60 * 6 && p.status !== "queue"; i++) s.tick(1 / 60);
  assert.equal(p.status, "queue", "waiting by the lift");
  run(s, 3);
  assert.equal(p.status, "queue", "until the coach seats them");
  assert.ok(["pool", "bed", "cabana"].includes(p.wish));
  assert.equal(SEATS.length, 3);
  const want = { pool: 0, bed: 1, cabana: 2 }[p.wish];
  assert.ok(seatVerdict(s, p, want).good, "where they wished: good");
  for (const b of s.roof.beds) if (s.venue.chill.bed(s, b.id).cabana) b.guest = 999;
  assert.ok(seatVerdict(s, p, 2).none, "no cabana free");
  s.select(p.id);
  assert.equal(s.assign(2), false, "refused");
  for (const b of s.roof.beds) if (b.guest === 999) b.guest = null;
  s.select(p.id);
  assert.ok(s.assign(0), "seated in the water");
  run(s, 12);
  assert.equal(p.status, "swim");
  // The bot seats a whole shift.
  const full = new CoachBot(12, 6, { config: { ...SHIFTS[11], venue: "roof" } }).run();
  assert.ok(
    (full.s.stats.seated || 0) > 10 && full.s.stats.seatedWell > full.s.stats.seated * 0.6,
    "the bot seats them",
  );
}

// 7) The highlight replay: clips noted as the shift is played, the best picked, and the shift rebuilt from its record to it, exactly
// (every state hash the same as the shift's own at the same tick).
{
  assert.equal(clipOf({ type: "cannonball" }).weight, 9);
  assert.equal(clipOf({ type: "incident", kind: "crash" }).weight, 10);
  assert.equal(clipOf({ type: "points" }), null);
  const level = 10,
    seed = 4242,
    config = { ...SHIFTS[level - 1], big: { at: 0.64 } };
  const s = new PoolSimulation(level, seed, { config });
  const rec = new Recorder(s, { level, seed, guests: { big: { at: 0.64 } } }, { inputs: 24000 });
  const picker = new HighlightPicker();
  s.start({ countdown: true });
  const hashes = new Map();
  for (let k = 0; s.status !== "ended" && k < 60 * 400; k++) {
    if (s.status === "playing" && k % 20 === 0) {
      const q = s.people.find((p) => p.status === "queue");
      if (q) {
        s.select(q.id);
        s.assign(k % 3);
      }
      s.setMovement(Math.sin(k / 90), Math.cos(k / 130));
      if (k === 60 * 30) s.triggerChaos("carl");
    }
    s.tick(1 / 60);
    for (const e of s.events) picker.note(e, rec.ticks);
    s.events.length = 0;
    hashes.set(rec.ticks, stateHash(s));
  }
  const best = picker.best();
  assert.ok(best && best.weight >= 7, "a clip worth showing: " + best?.title);
  const player = new ClipPlayer(rec.record, best);
  let slices = 0;
  while (!player.seek()) slices++;
  assert.equal(player.tick, player.from, "rewound to " + player.from + " in " + (slices + 1) + " slices");
  assert.equal(stateHash(player.sim), hashes.get(player.tick), "the same shift at the start of the clip");
  let slow = 0;
  while (!player.done) {
    if (player.speed() < 1) slow++;
    player.step();
    player.sim.events.length = 0;
  }
  assert.ok(slow > 60, "slow motion round the moment");
  assert.equal(stateHash(player.sim), hashes.get(player.tick), "and at its end");
  assert.equal(player.drift, null);
  assert.ok(player.to - player.from <= 10 * 60 + 1, "about ten seconds");
}

console.log(
  "Phase 3 checks passed: the streak's tiers (to ×2.5), saves and tips feeding it, its breaks with who broke it and the guest who " +
    "puts it at risk; coaching tips in the lap-lane pools only, asked, answered with E for points, mood and speed, lapsing when " +
    "ignored, and the bot coaching; a big moment in every shift but the first, two thirds in, each pool its own (" +
    Object.keys(BIG_KINDS).join(", ") +
    "), each graded at its end; the race lane locked, the racers on the blocks, no whistle into a busy lane, a pile-up, and the " +
    "bot's clean races; the river's lazy loop and rapids for chillers and thrill-seekers; the rooftop's seating by the lift with " +
    "its wishes and full cabanas; and the highlight replay rebuilding a shift's best clip exactly.",
);
