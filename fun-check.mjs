// The fun plan (docs/fun-plan.md, 14 November 2026): stakes in every shift, the shift as a song, perks that make a build, the
// day's doors and rules, surprise, and what lasts. The rules are week.mjs and the simulation's; week-ui.mjs shows them.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PoolSimulation, SHIFTS, swimmerLook } from "./dist/sim.mjs";
import { stateHash } from "./dist/replay.mjs";
import * as W from "./dist/week.mjs";
import { CoachBot } from "./check-bot.mjs";

const ALL = W.INCIDENT_ORDER;
const fresh = (over = {}) =>
  W.normalizeWeekSave({ v: 2, chapter: 1, tutorial: true, lesson2: true, ...over });
const run = (s, seconds, each = null) => {
  for (let i = 0; i < seconds * 60 && s.status !== "ended"; i++) {
    each?.(s);
    s.tick(1 / 60);
  }
};
const quiet = (level, extra = {}, options = {}, seed = 7) => {
  const s = new PoolSimulation(level, seed, {
    config: { ...SHIFTS[level - 1], chaos: [], twist: [], sickRate: 0, fun: { ...W.FUN }, ...extra },
    ...options,
  });
  s.start();
  return s;
};
// A week's shift finished with a result of our choosing.
const end = (save, shift, stars, stats = {}, more = {}) =>
  W.finishShift(
    save,
    shift,
    {
      stars,
      score:
        stars < 0
          ? 0
          : (shift.config.thresholds[Math.max(0, stars - 1)] || shift.pass) + (stars ? 0 : shift.pass),
      served: 5,
      bestStreak: 0,
      ...more,
    },
    stats,
  );

// 1) Pay: the third star is worth more than the others (and the first two are what they were).
{
  const ch = W.chapterFor(1);
  assert.deepEqual(
    [0, 1, 2, 3].map((n) => W.shiftPay(n, ch)),
    [15, 30, 45, 70],
  );
  assert.ok(
    W.shiftPay(3, ch) - W.shiftPay(2, ch) > W.shiftPay(2, ch) - W.shiftPay(1, ch),
    "three stars are worth chasing",
  );
}

// 2) The doors: the day's pool first; a door from later in the week swaps the two days when the shift is done, and the week
// never has the same pool two days running; every rule fits its pool; the mystery pays well.
{
  let swaps = 0,
    mysteries = 0;
  const rules = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const save = fresh({ chapter: 2, known: ALL, seen: Object.keys(W.POOLS), ladder: 4 + (seed % 9) });
    save.week = W.newWeek(save, seed);
    save.week.shift = seed % 6;
    const doors = W.dayDoors(save.week, save.known, save.seen);
    assert.ok(doors.length >= 1 && doors.length <= 3);
    assert.equal(new Set(doors.map((d) => d.id)).size, doors.length, "no two doors alike");
    for (const d of doors) {
      assert.ok(W.RULES[d.rule] && !W.RULES[d.rule].never, d.rule);
      assert.ok(d.rule === "regular" || W.ruleFits(d.rule, d.pool, save.known), d.rule + " fits " + d.pool);
      assert.ok(d.payout >= 0.8 && d.danger >= 1 && d.danger <= 3);
      rules.add(d.rule);
      if (d.mystery) {
        mysteries++;
        assert.ok(d.payout >= 1.3, "a mystery pays well");
      }
      if (!Number.isInteger(d.swap)) continue;
      swaps++;
      assert.ok(
        d.swap > save.week.shift && save.week.pools[d.swap] === d.pool,
        "a pool from later in the week",
      );
      const copy = fresh({ chapter: 2, known: ALL, seen: save.seen, ladder: save.ladder });
      copy.week = { ...save.week, pools: [...save.week.pools], history: [] };
      const before = [...copy.week.pools],
        shift = W.buildShift(copy.week, d.id, copy.known, copy.seen);
      assert.equal(shift.pool, d.pool, "the door's pool is the shift's");
      const at = copy.week.shift;
      end(copy, shift, 2);
      const after = copy.week ? copy.week.pools : before;
      if (copy.week) {
        assert.equal(after[at], d.pool, "the day became the door's pool");
        assert.equal(after[d.swap], before[at], "and its own pool went to that day");
        assert.deepEqual([...after].sort(), [...before].sort(), "the week's pools are the same six");
        for (const day of [at, d.swap])
          assert.ok(after[day] !== after[day - 1] && after[day] !== after[day + 1], "never two days running");
      }
    }
  }
  assert.ok(swaps > 80, "doors to later pools come often (" + swaps + ")");
  assert.ok(mysteries > 30, "and mysteries (" + mysteries + ")");
  assert.ok(rules.size >= 14, "most rules are drawn (" + rules.size + ")");
  // No choice: a first run's first two shifts, the finale, a lesson.
  const first = fresh();
  first.week = W.newWeek(first, 5);
  assert.equal(W.dayDoors(first.week).length, 1);
  first.week.shift = 1;
  assert.equal(W.dayDoors(first.week).length, 1);
  const finale = fresh({ chapter: 4, known: ALL });
  finale.week = W.newWeek(finale, 5);
  finale.week.shift = 5;
  assert.deepEqual(
    W.dayDoors(finale.week, ALL).map((d) => d.id),
    ["regular@arena"],
  );
  for (let shift = 0; shift < 5; shift++)
    assert.ok(
      W.dayDoors({ ...finale.week, shift }, ALL).every((d) => d.swap !== 5),
      "the finale's day is never swapped",
    );
  // What is not known or not earned is not offered.
  assert.ok(!W.ruleFits("powersaver", "club", ["dog"]) && W.ruleFits("powersaver", "club", ALL));
  assert.ok(!W.ruleFits("carlbday", "dive", ALL), "no Carl incident at the Jumping Pool");
  assert.ok(!W.ruleFits("fullmoon", "club", ALL, []) && W.ruleFits("fullmoon", "club", ALL, ["spicy"]));
  assert.ok(!W.ruleFits("overtime", "club", ALL), "the overtime is never drawn");
}

// 3) What a day rule makes of a shift.
{
  const week = (rule, pool = "club", more = {}) => ({
    chapter: 2,
    seed: 77,
    pools: Array(6).fill(pool),
    shift: 3,
    perks: [],
    history: [],
    known: ALL,
    ...more,
  });
  // (a rule's own door: built straight from the rule, as the door would)
  const build = (rule, pool = "club", more = {}) => {
    const w = week(rule, pool, more);
    for (let seed = 1; seed < 400; seed++) {
      w.seed = seed;
      const door = W.dayDoors(w, ALL).find((d) => d.rule === rule && d.pool === pool && !d.mystery);
      if (door) return { shift: W.buildShift(w, door.id, ALL), plain: W.buildShift(w, null, ALL), w };
    }
    assert.fail(rule + " is never drawn at " + pool);
  };
  let b = build("heatwave");
  assert.ok(
    b.shift.config.total > b.plain.config.total && b.shift.perks.patience < 1,
    "a heatwave: more guests, less patience",
  );
  assert.ok(b.shift.config.thresholds[1] > b.plain.config.thresholds[1], "more guests, higher targets");
  assert.ok(b.shift.config.thresholds[1] < b.plain.config.thresholds[1] * 1.15, "but only halfway");
  assert.equal(b.shift.rule, "heatwave");
  assert.equal(b.shift.config.rule, "heatwave");
  b = build("vipnight");
  assert.equal(b.shift.config.vipAt.length, Math.min(9, b.plain.config.vipAt.length + 3), "three more VIPs");
  b = build("quiet");
  assert.equal(b.shift.plan.chaos.length, 0, "a quiet day has no roaming incident");
  assert.ok(b.shift.card.payout < 1);
  b = build("powersaver");
  assert.ok(b.shift.plan.incidents.includes("outage"), "the lights will go out");
  b = build("dogshow");
  assert.equal(b.shift.plan.chaos.filter((c) => c.kinds[0] === "dog").length, 2, "two dogs");
  b = build("doubledate");
  assert.equal(b.shift.wishes.length, 3);
  b = build("rush");
  assert.equal(b.shift.config.twist.filter((t) => t.kind === "rush").length, 2, "two busloads");
  b = build("rain");
  assert.equal(b.shift.perks.drip, 5);
  b = build("heavylegs");
  assert.equal(b.shift.perks.speed, 0.85);
  b = build("golden", "club", { done: ["runs"] });
  assert.equal(b.shift.config.golden.length, 3);
  b = build("short", "club", { done: ["spicy"] });
  assert.ok(
    b.shift.config.duration < b.plain.config.duration && b.shift.config.total === b.plain.config.total,
  );
  b = build("fullmoon", "club", { done: ["spicy"] });
  assert.equal(b.shift.config.maxChaos, (b.plain.config.maxChaos || 1) + 1);
  assert.ok(b.shift.plan.chaos.length >= b.plain.plan.chaos.length);
  // Every shift of a week plays by the fun plan's rules; free play too; and a plain shift has no rule.
  assert.deepEqual(b.plain.config.fun, W.FUN);
  assert.equal(b.plain.config.rule, undefined);
  assert.deepEqual(W.freePlayShift("club", "medium", 5).config.fun, W.FUN);
  assert.equal(W.freePlayShift("club", "medium", 5).cards.length, 0);
}

// 4) The pick after a shift passed: three perks, one free with a catch, one to take; six slots; it lasts the run.
{
  const save = fresh({ chapter: 2, known: ALL });
  save.week = W.newWeek(save, 31);
  save.week.fund = 200;
  let shift = W.buildShift(save.week, null, ALL);
  assert.equal(W.pickOffer(save).length, 0, "no pick before a shift");
  let r = end(save, shift, 2);
  assert.ok(r.pick && save.week.pick, "a shift passed leaves a pick");
  let offer = W.pickOffer(save);
  assert.equal(offer.length, 3);
  assert.equal(offer.filter((o) => o.free).length, 1, "one of the three is free");
  assert.ok(W.PERKS[offer.find((o) => o.free).id].catch, "the free one has a catch");
  for (const o of offer.filter((x) => !x.free)) assert.equal(o.price, W.perkPrice(o.id, W.chapterFor(2)));
  const paid = offer.find((o) => !o.free),
    fund = save.week.fund;
  assert.ok(W.takePick(save, paid.id));
  assert.equal(save.week.fund, fund - paid.price, "paid out of the Date Fund");
  assert.deepEqual(save.build, [paid.id]);
  assert.ok(save.scrap.includes("perk:" + paid.id), "and noted in the scrapbook");
  assert.equal(W.pickOffer(save).length, 0, "one pick a shift");
  assert.ok(!W.takePick(save, offer[0].id));
  // A first run's first picks are plain: nothing with a catch, and the first is free.
  {
    const rookie = fresh({ known: [] });
    rookie.week = W.newWeek(rookie, 5);
    end(rookie, W.buildShift(rookie.week, null, []), 1);
    const first = W.pickOffer(rookie);
    assert.equal(first.length, 3);
    assert.ok(
      first.every((o) => !W.PERKS[o.id].catch),
      "no catch for a learner",
    );
    assert.deepEqual(
      first.map((o) => o.free),
      [true, false, false],
    );
    assert.ok(W.takePick(rookie, first[0].id) && rookie.week.fund >= 0);
  }
  // A new hand costs; a failed shift leaves no pick; the pick is passed up by moving on.
  shift = W.buildShift(save.week, null, ALL);
  r = end(save, shift, 2);
  const hand = W.pickOffer(save).map((o) => o.id),
    money = save.week.fund;
  assert.ok(W.rerollPick(save));
  assert.equal(save.week.fund, money - W.rerollPrice(W.chapterFor(2)));
  assert.notDeepEqual(
    W.pickOffer(save).map((o) => o.id),
    hand,
    "three others",
  );
  assert.ok(!W.pickOffer(save).some((o) => save.week.perks.includes(o.id)), "never one the coach has");
  W.skipPick(save);
  assert.equal(W.pickOffer(save).length, 0);
  shift = W.buildShift(save.week, null, ALL);
  r = end(save, shift, -1, {}, { score: 0 });
  assert.ok(r.failed && !r.pick && !save.week.pick, "a shift not passed: no pick");
  // Six slots: a seventh needs one to make room.
  save.week.perks = ["shoes", "whistle", "benches", "stretch", "tummy", "megaphone"];
  save.week.pick = { roll: 0 };
  save.week.fund = 500;
  const seventh = W.pickOffer(save)[0];
  assert.ok(!W.takePick(save, seventh.id), "the build is full");
  assert.ok(W.takePick(save, seventh.id, "whistle"));
  assert.equal(save.week.perks.length, W.BUILD_SLOTS);
  assert.ok(save.week.perks.includes(seventh.id) && !save.week.perks.includes("whistle"));
  // The build is the run's: next week starts with it; a lost run does not.
  const next = W.newWeek({ ...save, chapter: 3 }, 9);
  assert.deepEqual(next.perks, save.build);
  // Every perk's effects add up, and what the simulation reads is in the shift.
  const fx = W.perkEffects([
    "redcarpet",
    "karenmgr",
    "openhouse",
    "skates",
    "hero",
    "wishbone",
    "highroller",
  ]);
  assert.equal(fx.vips, 2);
  assert.deepEqual(fx.must, ["karen"]);
  assert.equal(fx.crowd, 1.25);
  assert.ok(fx.sim.ice === true && fx.sim.speed === 1.3 && fx.sim.vipScore === 2);
  assert.equal(fx.budget, 1);
  assert.deepEqual(fx.pays, { calmed: 15, prevented: 5 });
  assert.ok(fx.highRoller && fx.wishes === 3 && fx.wishMiss === 10);
  for (const [id, p] of Object.entries(W.PERKS)) {
    if (p.challenge) assert.ok(W.CHALLENGES[p.challenge], id + "'s challenge exists");
    if (p.needs) assert.ok(ALL.includes(p.needs));
    assert.ok(p.text.length <= 80, id + " says it shortly");
  }
  assert.ok(Object.values(W.PERKS).filter((p) => p.catch).length >= 8, "plenty of perks with a catch");
  assert.ok(!W.perkOpen("karenmgr", ["dog"]) && W.perkOpen("karenmgr", ALL));
  assert.ok(
    !W.perkOpen("piggy", ALL, []) && W.perkOpen("piggy", ALL, ["dates"]) && W.perkOpen("piggy", ALL, null),
  );
  // A build in a shift: Karen for sure, more guests, twice the VIPs.
  const plain = W.buildShift(
      { chapter: 2, seed: 5, pools: Array(6).fill("club"), shift: 3, perks: [], history: [] },
      null,
      ALL,
    ),
    built = W.buildShift(
      {
        chapter: 2,
        seed: 5,
        pools: Array(6).fill("club"),
        shift: 3,
        perks: ["karenmgr", "openhouse", "redcarpet"],
        history: [],
      },
      null,
      ALL,
    );
  assert.ok(built.plan.incidents.includes("karen"));
  assert.ok(built.config.total > plain.config.total);
  assert.equal(built.config.vipAt.length, Math.min(9, plain.config.vipAt.length * 2));
  assert.equal(built.perks.vipScore, 2);
}

// 5) What a build's perks pay, and the day's rule: tips for the trouble, the high roller, the inspector, a wish missed.
{
  const play = (perks, stars, stats = {}, more = {}, card = null) => {
    const save = fresh({ chapter: 1, known: ALL });
    save.week = W.newWeek(save, 12);
    save.week.shift = 2;
    save.week.perks = perks;
    const shift = { ...W.buildShift(save.week, null, ALL), ...(card && { card }) };
    return end(save, shift, stars, stats, more);
  };
  assert.equal(play(["karenmgr"], 2, { calmed: 2 }).tips, 30);
  assert.equal(play(["hero", "dogwalker"], 2, { prevented: 3, dogs: 1 }).tips, 25);
  assert.equal(play(["carlfan"], 2, { carded: 1 }).tips, 15);
  assert.equal(play(["highroller"], 3).pay, 140, "the high roller: three stars pay double");
  assert.equal(play(["highroller"], 2).pay, 45);
  assert.equal(play(["highroller"], 1).pay, 0, "and under two, nothing");
  const base = play([], 2).wishPay,
    wish = play(["wishbone"], 2);
  assert.ok(wish.wishPay !== base || base === 0, "double or nothing changes what the wishes pay");
  assert.equal(play([], 2, { golden: 1 }).golden, 15, "a golden guest pays a star's worth");
  const inspector = { rule: "inspector", payout: 1, danger: 2 };
  assert.equal(play([], 2, {}, {}, inspector).inspector, 25, "a clean pool for the inspector");
  assert.equal(play([], 2, {}, { catastrophes: 1 }, inspector).pay, 25, "a dirty one pays half");
  assert.equal(play([], 2, {}, { catastrophes: 1 }, inspector).inspector, 0);
  // How close the next star was.
  const r = play([], 1);
  assert.equal(r.nextStar.stars, 2);
  assert.ok(r.nextStar.short > 0);
  assert.equal(play([], 3).nextStar, null);
}

// 6) Saturday night: overtime on a near miss (once a run), the surplus carried, a deluxe date and Marina's gift.
{
  const saturday = (fundShare, over = {}) => {
    const save = fresh({ chapter: 2, known: ALL, ...over });
    save.week = W.newWeek(save, 44);
    save.week.shift = 5;
    save.week.fund = Math.round(W.chapterFor(2).goal * fundShare);
    return save;
  };
  // Close: one last shift.
  let save = saturday(0.85);
  let r = end(save, W.buildShift(save.week, null, ALL), -1, {}, { score: 0 });
  assert.ok(r.overtime && !r.over && !r.won, "short by less than a fifth: overtime");
  assert.ok(save.week && save.week.overtime && save.overtimeUsed && save.chapter === 2);
  const ot = W.buildShift(save.week, null, ALL);
  assert.ok(ot.overtime && ot.card.rule === "overtime" && ot.card.payout === 2, "it pays double");
  assert.equal(ot.tier, W.bandOf(2)[1], "at the top of the week's levels");
  assert.equal(ot.cards.length, 1);
  assert.notDeepEqual(
    ot.config.chaos,
    W.buildShift({ ...save.week, overtime: false }, null, ALL).config.chaos,
    "its own draw",
  );
  r = end(save, ot, 3);
  assert.ok(r.won && r.wasOvertime && !save.week && save.chapter === 3, "won in overtime: the date is on");
  assert.ok(save.scrap.includes("week:overtime"));
  // Lost in overtime: game over. And there is no second overtime in a run.
  save = saturday(0.85);
  end(save, W.buildShift(save.week, null, ALL), -1, {}, { score: 0 });
  r = end(save, W.buildShift(save.week, null, ALL), -1, {}, { score: 0 });
  assert.ok(
    r.over && !save.week && save.chapter === 1 && save.runs === 1 && !save.overtimeUsed,
    "then the run is over",
  );
  save = saturday(0.85, { overtimeUsed: true });
  r = end(save, W.buildShift(save.week, null, ALL), -1, {}, { score: 0 });
  assert.ok(r.over && !r.overtime, "once a run");
  save = saturday(0.5);
  r = end(save, W.buildShift(save.week, null, ALL), -1, {}, { score: 0 });
  assert.ok(r.over && !r.overtime, "too far off: game over");
  assert.deepEqual([save.build, save.carry, save.gift], [[], 0, false], "a lost run keeps no build");
  // Over the goal: half of it starts next week; far over, a deluxe date and a gift.
  save = saturday(1.2);
  save.week.perks = ["shoes"];
  r = end(save, W.buildShift(save.week, null, ALL), 1);
  assert.ok(r.won && !r.deluxeDate);
  const goal = W.chapterFor(2).goal;
  assert.equal(r.carry, Math.floor(((Math.min(r.fund, r.deluxe) - goal) * W.CARRY_SHARE) / 5) * 5);
  assert.ok(r.carry > 0 && save.carry === r.carry);
  let week = W.newWeek(save, 3);
  assert.equal(week.fund, r.carry, "next week starts with it");
  assert.equal(save.carry, 0);
  assert.deepEqual(week.perks, ["shoes"], "and with the build");
  assert.equal(week.pick, null);
  save = saturday(1.5);
  r = end(save, W.buildShift(save.week, null, ALL), 1);
  assert.ok(
    r.deluxeDate &&
      save.gift &&
      save.gold.includes(W.chapterFor(2).date.id) &&
      save.scrap.includes("date:deluxe"),
  );
  week = W.newWeek(save, 3);
  assert.ok(week.pick?.gift && !save.gift, "Marina's gift on Monday");
  save.week = week;
  const gift = W.pickOffer(save);
  assert.ok(gift.length === 3 && gift.every((o) => o.free && o.price === 0), "three for nothing");
  assert.ok(W.takePick(save, gift[0].id) && save.week.fund === week.fund);
  // The piggy bank carries it all.
  save = saturday(1.2);
  save.week.perks = ["piggy"];
  r = end(save, W.buildShift(save.week, null, ALL), 1);
  assert.equal(r.carry, Math.floor((Math.min(r.fund, r.deluxe) - goal) / 5) * 5);
  const o = W.outlook({ ...saturday(1.1).week });
  assert.ok(o.reached && o.deluxeNeed > 0 && o.deluxe === Math.round((goal * W.DELUXE) / 5) * 5);
}

// 7) A veteran's Monday: from the third run, no gentle minute, and a free pick before it.
{
  const rookie = fresh({ runs: 1 });
  rookie.week = W.newWeek(rookie, 8);
  const gentle = W.buildShift(rookie.week, null, []);
  assert.ok(!rookie.week.veteran && !rookie.week.pick);
  assert.equal(gentle.config.duration, W.FIRST_SHIFT.duration);
  assert.equal(gentle.config.big, undefined);
  const vet = fresh({ runs: W.VETERAN_RUNS, known: ALL });
  vet.week = W.newWeek(vet, 8);
  assert.ok(vet.week.veteran && vet.week.pick?.gift);
  const monday = W.buildShift(vet.week, null, ALL);
  assert.ok(
    monday.tier >= 4 && monday.config.duration > W.FIRST_SHIFT.duration,
    "a real shift, two levels up",
  );
  assert.ok(monday.config.big && monday.config.total > W.FIRST_SHIFT.total);
  assert.equal(monday.pool, "club");
  assert.ok(W.pickOffer(vet).every((o) => o.free));
  // (only a run's first week: week 2 of a veteran's run is like anyone's)
  const later = fresh({ runs: 5, chapter: 2 });
  later.week = W.newWeek(later, 8);
  assert.ok(!later.week.veteran && !later.week.pick);
  // A veteran save comes back as it was.
  const back = W.normalizeWeekSave(JSON.parse(JSON.stringify(vet)));
  assert.ok(back.week.veteran && back.week.pick.gift && back.runs === W.VETERAN_RUNS);
}

// 8) The challenges count over every run and add to the decks; the scrapbook keeps what was new.
{
  const save = fresh({ chapter: 2, known: ALL });
  save.week = W.newWeek(save, 61);
  save.week.shift = 2;
  const door = { rule: "heatwave", payout: 1.25, danger: 2, id: "heatwave@club", pool: "club" };
  let r = end(
    save,
    { ...W.buildShift(save.week, null, ALL), card: door },
    3,
    { vips: 24, mopped: 3, prevented: 2, calmed: 1 },
    {
      bestStreak: 12,
      finds: ["viral"],
    },
  );
  assert.deepEqual(
    [
      save.tally.vips,
      save.tally.mops,
      save.tally.threes,
      save.tally.streaks,
      save.tally.saves,
      save.tally.spicy,
      save.tally.clean,
    ],
    [24, 3, 1, 1, 2, 1, 1],
  );
  assert.deepEqual(r.challenges, []);
  assert.ok(r.finds.includes("rule:heatwave") && r.finds.includes("cross:viral"));
  assert.ok(!W.pickOffer(save).some((o) => o.id === "autograph"), "not in the deck yet");
  r = end(save, W.buildShift(save.week, null, ALL), 2, { vips: 1 });
  assert.deepEqual(r.challenges, ["vips"], "the 25th VIP: done");
  assert.ok(save.done.includes("vips"));
  assert.ok(W.challengeOpens("vips").some((o) => o.kind === "perk" && o.id === "autograph"));
  assert.equal(
    end(save, W.buildShift(save.week, null, ALL), 2, { vips: 9 }).challenges.length,
    0,
    "done once",
  );
  // A lost run still counts.
  const lost = fresh({ chapter: 1, known: ALL, tally: { runs: 1 } });
  lost.week = W.newWeek(lost, 3);
  lost.week.shift = 5;
  r = end(lost, W.buildShift(lost.week, null, ALL), 1);
  assert.ok(r.over && r.challenges.includes("runs") && lost.done.includes("runs"));
  assert.ok(W.ruleFits("golden", "club", ALL, lost.done));
  // Every challenge opens something; every locked perk and rule has its challenge; the scrapbook lists it all.
  for (const id of W.CHALLENGE_IDS) assert.ok(W.challengeOpens(id).length >= 1, id + " adds something");
  assert.equal(
    W.SCRAP_IDS.length,
    Object.keys(W.RULES).length - 1 + Object.keys(W.PERKS).length + Object.keys(W.CROSSOVERS).length + 3,
  );
  const junk = W.normalizeWeekSave({
    v: 2,
    scrap: ["rule:heatwave", "nope"],
    done: ["vips", "x"],
    tally: { vips: "7" },
    gold: ["movie", 3],
  });
  assert.deepEqual(
    [junk.scrap, junk.done, junk.tally.vips, junk.gold],
    [["rule:heatwave"], ["vips"], 7, ["movie"]],
  );
}

// 9) An endless week's conditions: only after the ending, before Monday; each pays a tenth more; two make a gold date.
{
  const save = fresh({ chapter: 5, known: ALL, finale: true });
  save.week = W.newWeek(save, 71);
  assert.ok(W.heatOpen(save));
  assert.ok(W.setHeat(save, ["tempers", "packed", "nonsense"]));
  assert.deepEqual(save.week.heat, ["tempers", "packed"]);
  const plain = W.buildShift({ ...save.week, heat: [] }, null, ALL),
    hot = W.buildShift(save.week, null, ALL);
  assert.ok(hot.config.total > plain.config.total && hot.perks.patience < plain.perks.patience);
  const r = end(save, hot, 2);
  assert.equal(
    r.pay,
    Math.max(5, Math.round((45 * W.chapterFor(5).pay * 1.2) / 5) * 5),
    "a tenth more for each",
  );
  assert.ok(!W.heatOpen(save) && !W.setHeat(save, []), "not once the week is under way");
  assert.ok(
    !W.heatOpen({ ...fresh({ chapter: 2 }), week: W.newWeek(fresh({ chapter: 2 }), 1) }),
    "nor before the ending",
  );
  save.week.shift = 5;
  save.week.fund = W.chapterFor(5).goal;
  assert.ok(end(save, W.buildShift(save.week, null, ALL), 1).deluxeDate, "two conditions: a gold date");
}

// 10) The last call: the last seconds score more (the number on screen too), in shifts with the fun plan's rules only.
{
  const s = quiet(5, { total: 4 });
  run(s, s.config.duration - W.FUN.lastCall - 2);
  assert.ok(!s.inLastCall());
  let at = s.score;
  s.score += 100;
  assert.equal(s.score, at + 100, "before it, points are points");
  s.events.length = 0;
  run(s, 3);
  assert.ok(s.inLastCall());
  assert.equal(s.events.filter((e) => e.type === "last-call").length, 1, "announced once");
  s.events.length = 0;
  at = s.score;
  s.score += 100;
  s.emit("points", { x: 0, z: 0, value: 100 });
  assert.equal(s.score, at + 150, "in it, half as much again");
  assert.equal(
    s.events.find((e) => e.type === "points").value,
    150,
    "and the number shown is the number earned",
  );
  s.score -= 50;
  assert.equal(s.score, at + 100, "what is lost is lost as it is");
  const old = new PoolSimulation(5, 7, { config: { ...SHIFTS[4], chaos: [], twist: [], total: 4 } });
  old.start();
  run(old, old.config.duration - 5);
  at = old.score;
  old.score += 100;
  assert.equal(old.score, at + 100);
  assert.ok(!old.inLastCall() && old.fun === null, "a shift from before the plan plays as it did");
  const long = quiet(5, { total: 4 }, { perks: { lastCall: 2 } });
  assert.equal(long.lastCallAt(), long.config.duration - 50, "last orders: twice as long");
  assert.equal(quiet(5, { tutorial: 1 }).lastCallAt(), Infinity, "never in a guided shift");
}

// 11) Making it up: a streak broken leaves a few seconds; the next points count double and the next good thing gives half back.
{
  const s = quiet(5, { total: 1, duration: 200 });
  run(s, 2);
  for (let i = 0; i < 8; i++) s.bumpStreak("happy");
  assert.equal(s.streak, 8);
  s.events.length = 0;
  s.breakStreak("angry");
  assert.ok(s.makeUp && s.events.some((e) => e.type === "make-up"));
  let at = s.score;
  s.score += 100;
  assert.equal(s.score, at + 200, "the next points count double");
  s.score += 100;
  assert.equal(s.score, at + 300, "once");
  s.bumpStreak("happy");
  assert.equal(s.streak, 4, "and half the streak is back");
  assert.ok(s.events.some((e) => e.type === "made-up"));
  assert.equal(s.makeUp, null);
  // Too late: nothing back.
  for (let i = 0; i < 4; i++) s.bumpStreak("happy");
  s.breakStreak("angry");
  run(s, W.FUN.makeUp + 1);
  s.streak = 0;
  s.bumpStreak("happy");
  assert.equal(s.streak, 1);
  // A short streak is no loss.
  s.bumpStreak("happy");
  s.breakStreak("meh");
  assert.equal(s.makeUp, null);
  // The perks: a showboat climbs twice as fast and makes nothing up; a cool head gets it all back; a second wind on any save.
  const show = quiet(5, { total: 1, duration: 200 }, { perks: { streakStep: 2, noMakeUp: true } });
  for (let i = 0; i < 3; i++) show.bumpStreak("happy");
  assert.equal(show.streak, 6);
  show.breakStreak("angry");
  assert.equal(show.makeUp, null);
  const cool = quiet(5, { total: 1, duration: 200 }, { perks: { makeUp: 2 } });
  run(cool, 1);
  for (let i = 0; i < 6; i++) cool.bumpStreak("happy");
  cool.breakStreak("angry");
  run(cool, W.FUN.makeUp + 4);
  cool.streak = 0;
  cool.bumpStreak("happy");
  assert.equal(cool.streak, 6, "the whole streak, and twice as long to do it");
  const wind = quiet(5, { total: 1, duration: 200 }, { perks: { secondWind: true } });
  run(wind, 1);
  for (let i = 0; i < 6; i++) wind.bumpStreak("happy");
  wind.breakStreak("angry");
  run(wind, 40);
  wind.streak = 0;
  wind.save("sent-home", wind.coach, 100);
  assert.equal(wind.streak, 6, "a save brings it back, whenever");
}

// 12) The golden guest: a tag of gold, and a happy goodbye that pays.
{
  const s = quiet(6, { golden: [0.5], vipAt: [], star: null });
  const gold = s.schedule.filter((e) => e.golden);
  assert.equal(gold.length, 1);
  assert.ok(!gold[0].vip && !gold[0].sick);
  run(s, 200, (sim) => {
    for (const p of sim.people)
      if (p.status === "queue" && sim.select(p.id)) for (const l of [0, 1, 2]) if (sim.assign(l)) break;
  });
  const p = s.people.find((x) => x.golden);
  assert.ok(p, "they came");
  assert.equal(swimmerLook(p).icon, "✨");
  assert.match(swimmerLook(p).label, /^Golden · /);
  // (a goodbye of our own, to be sure of the mood)
  const t = quiet(6, { golden: [0.5], vipAt: [], star: null });
  run(t, 2);
  const g = t.spawn({ type: "intermediate", golden: true });
  g.h = 100;
  g.lane = 0;
  t.events.length = 0;
  t.depart(g);
  assert.equal(t.stats.golden, 1);
  assert.ok(t.events.some((e) => e.type === "golden"));
  const sad = t.spawn({ type: "intermediate", golden: true });
  sad.h = 20;
  sad.lane = 0;
  t.depart(sad);
  assert.equal(t.stats.golden, 1, "only when they leave happy");
  // In a run: none in the first shifts, a few over many weeks.
  let seen = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const sh = W.buildShift(
      { chapter: 2, seed, pools: Array(6).fill("club"), shift: 2, perks: [], history: [] },
      null,
      ALL,
    );
    seen += (sh.config.golden || []).length;
  }
  assert.ok(seen > 8 && seen < 40, "about one shift in ten (" + seen + " in 200)");
  assert.equal(
    W.buildShift({ chapter: 1, seed: 3, pools: Array(6).fill("club"), shift: 1, perks: [], history: [] })
      .config.golden,
    undefined,
  );
}

// 13) The perks the simulation reads.
{
  const vip = quiet(6, {}, { perks: { vipScore: 2, vipPatience: 0.5 } });
  run(vip, 1);
  const a = vip.spawn({ type: "advanced", vip: true }),
    plain = quiet(6);
  run(plain, 1);
  const b = plain.spawn({ type: "advanced", vip: true });
  assert.ok(a.waitLimit < b.waitLimit * 0.75, "the red carpet: half the patience");
  for (const [sim, p] of [
    [vip, a],
    [plain, b],
  ]) {
    p.h = 100;
    p.lane = 0;
    sim.depart(p);
  }
  assert.ok(vip.score > plain.score * 1.8, "and double the points");
  const skates = quiet(6, {}, { perks: { ice: true, speed: 1.3 } });
  skates.coach.input.x = 1;
  const still = quiet(6);
  still.coach.input.x = 1;
  run(skates, 0.1);
  run(still, 0.1);
  assert.ok(
    Math.abs(skates.coach.vx) > 0 && Math.abs(skates.coach.vx) < Math.abs(still.coach.vx) * 0.5,
    "roller skates: slow off the mark, like ice",
  );
  assert.equal(skates.perks.speed, 1.3, "and faster at speed");
  const marco = quiet(6, {}, { perks: { autograph: 30 } });
  run(marco, 1);
  const m = marco.spawn({ type: "advanced", vip: true, star: "marco", name: "Marco" });
  m.h = 100;
  m.lane = 0;
  marco.depart(m);
  const before = marco.score;
  marco.score += 100;
  assert.equal(marco.score, before + 200, "Marco's autograph: double for a while");
  run(marco, 31);
  marco.score += 100;
  assert.equal(marco.score, before + 300);
}

// 14) The director's song: no new incident while the coach is full, a breath after trouble ends, and no long calm from level 6.
{
  const entry = (kind, at) => ({ kinds: [kind], window: [at, at] });
  // Full: three things pending hold the next incident back.
  const full = quiet(8, { chaos: [entry("karen", 6)], maxChaos: 4, total: 6 });
  full.pressure = () => 3;
  run(full, 12);
  assert.equal(full.karen, null, "held while three things want the coach");
  delete full.pressure;
  run(full, W.FUN.breath + 4);
  assert.ok(full.karen || full.met?.includes("karen"), "and started once there is room (after a breath)");
  const old = new PoolSimulation(8, 7, {
    config: { ...SHIFTS[7], chaos: [entry("karen", 6)], twist: [], maxChaos: 4, total: 6 },
  });
  old.start();
  old.pressure = () => 3;
  run(old, 8);
  assert.ok(old.karen, "a shift from before the plan has no such hold");
  // A breath: trouble that ends keeps the next one off for a while.
  const breath = quiet(8, { chaos: [entry("dog", 9)], maxChaos: 4, total: 6 });
  let n = 1;
  breath.pressure = () => n;
  run(breath, 5);
  n = 0;
  run(breath, 1);
  const until = breath.breathUntil;
  assert.ok(until > breath.arrivalTime + W.FUN.breath - 2, "trouble just ended");
  run(breath, 5);
  assert.equal(breath.dog, null, "not in the breath");
  run(breath, W.FUN.breath);
  assert.ok(breath.dog || breath.met?.includes("dog"), "after it");
  // A calm: the next incident of the plan is brought forward (level 6 and up only).
  const calm = quiet(8, { chaos: [entry("karen", 90)], maxChaos: 4, total: 2, duration: 150 });
  run(calm, 20 + W.FUN.calm + 6);
  assert.ok(calm.karen || calm.met?.includes("karen"), "the calm is filled: Karen comes early");
  const easy = quiet(4, { chaos: [entry("karen", 60)], maxChaos: 4, total: 2, duration: 100 });
  run(easy, 20 + W.FUN.calm + 6);
  assert.equal(easy.karen, null, "the first levels keep their calm");
}

// 15) Crossovers: the dog sees Karen off; an influencer films the cannonball.
{
  const s = quiet(10, { maxChaos: 4, total: 4 });
  run(s, 3);
  assert.ok(s.triggerChaos("karen") && s.triggerChaos("dog"));
  run(s, 60, (sim) => {
    const k = sim.karen && sim.visitor(sim.karen.id),
      d = sim.dog && sim.visitor(sim.dog.id);
    if (k && d && ["marching", "ranting"].includes(k.status) && !sim.finds.includes("chase")) {
      d.x = k.x + 0.5;
      d.z = k.z;
    }
  });
  assert.ok(s.finds.includes("chase"), "the dog saw Karen off");
  assert.equal(s.stats.calmed, 1);
  assert.deepEqual(s.summary().finds, ["chase"]);
  const viral = quiet(12, { venue: "disco", maxChaos: 4, total: 4 });
  run(viral, 3);
  assert.ok(viral.triggerChaos("influencer"), "an influencer at the disco");
  assert.ok(viral.triggerChaos("carl"));
  const before = viral.stats.cannonballs || 0;
  run(viral, 90, (sim) => (sim.finds.includes("viral") ? null : 0));
  if ((viral.stats.cannonballs || 0) > before && viral.influencer) assert.ok(viral.finds.includes("viral"));
  assert.equal(s.find("chase"), false, "once a shift");
}

// 16) A shift built by the plan plays the same twice (a door, a rule, a build: all in its config and perks), and a bot gets
// through a week of doors and picks.
{
  const week = {
    chapter: 2,
    seed: 404,
    pools: ["club", "resort", "kids", "lagoon", "club", "resort"],
    shift: 2,
    history: [],
  };
  const twice = () => {
    const sh = W.buildShift({ ...week, perks: ["showboat", "mopwheels", "openhouse"] }, null, ALL),
      bot = new CoachBot(sh.tier, 99, { config: sh.config, perks: sh.perks }).run();
    return [bot.s.score, stateHash(bot.s), bot.s.status];
  };
  const [a, b] = [twice(), twice()];
  assert.deepEqual(a, b, "the same shift, to the last bit");
  assert.equal(a[2], "ended");
  const save = fresh({
    chapter: 2,
    known: ALL,
    seen: ["club", "resort", "kids", "lagoon", "disco"],
    ladder: 6,
  });
  save.week = W.newWeek(save, 2024);
  const drawn = [...save.week.pools].sort();
  for (let i = 0; i < W.SHIFTS_PER_WEEK && save.week; i++) {
    const doors = W.dayDoors({ ...save.week, done: save.done }, save.known, save.seen),
      door = doors[doors.length > 1 ? 1 : 0],
      sh = W.buildShift({ ...save.week, done: save.done }, door.id, save.known, save.seen),
      bot = new CoachBot(sh.tier, 500 + i, { config: sh.config, perks: sh.perks }).run();
    assert.equal(bot.s.status, "ended", "shift " + (i + 1) + " ends (" + sh.pool + ", " + sh.rule + ")");
    const r = W.finishShift(save, sh, bot.s.summary(), bot.s.stats);
    if (!save.week) break;
    assert.deepEqual([...save.week.pools].sort(), drawn, "the week keeps its six pools");
    const offer = W.pickOffer(save);
    if (r.pick) assert.equal(offer.length, 3);
    const free = offer.find((o) => o.free);
    if (free) assert.ok(W.takePick(save, free.id, save.week.perks[0]));
    assert.ok(save.week.fund >= 0 && save.week.perks.length <= W.BUILD_SLOTS);
  }
}

// 17) On the page: the doors, the pick on the results, tomorrow's doors, the conditions, the challenges and the scrapbook.
{
  const html = readFileSync(new URL("./dist/index.html", import.meta.url), "utf8"),
    ui = readFileSync(new URL("./dist/week-ui.mjs", import.meta.url), "utf8"),
    app = readFileSync(new URL("./dist/app.mjs", import.meta.url), "utf8"),
    css = readFileSync(new URL("./dist/style.css", import.meta.url), "utf8");
  for (const id of [
    "rw-star",
    "rw-pick",
    "rw-pick-cards",
    "rw-reroll",
    "rw-build",
    "rw-doors",
    "wd-heat",
    "locker-challenges",
    "locker-scrap",
    "shop-note",
  ])
    assert.ok(html.includes(`id="${id}"`), id + " is on the page");
  for (const call of [
    "pickOffer(save)",
    "takePick(save",
    "rerollPick(save)",
    "skipPick(save)",
    "dayDoors(",
    "setHeat(",
  ])
    assert.ok(ui.includes(call), "the week's screens use " + call);
  assert.match(ui, /function cinematicDue\(pool\)/);
  assert.match(app, /weekUi\?\.cinematicDue\?\.\(week\.pool\) !== false/, "a pool's cinematic once a run");
  for (const type of ["last-call", "make-up", "made-up", "golden"])
    assert.ok(app.includes(`e.type === "${type}"`), "the game shows " + type);
  for (const rule of [
    ".booking-card.door",
    ".rw-pick",
    ".rw-doors",
    ".locker-scrap",
    "#clock.last-call",
    ".heat-chip",
  ])
    assert.ok(css.includes(rule), rule + " is styled");
  // (no key named on a door, a perk or a rule: the HUD says that something is there, not how to deal with it)
  for (const text of [
    ...Object.values(W.PERKS).map((p) => p.text),
    ...Object.values(W.RULES).map((r) => r.note),
  ])
    assert.ok(!/\b(press|hold) [A-Z]\b|\(E\)|\(Q\)/i.test(text), text);
}

console.log(
  "Fun plan checks passed: three stars worth chasing; the day's doors (the day's pool, a pool from later in the week that swaps " +
    "the two days, a mystery) and " +
    (Object.keys(W.RULES).length - 2) +
    " day rules that fit their pool; a pick of three perks after every shift passed (one free with a catch, six slots, " +
    Object.keys(W.PERKS).length +
    " perks, a build that lasts the run); what the build and the day's rule pay; overtime on a near miss, the surplus carried, a " +
    "deluxe date and Marina's gift; a veteran's Monday; " +
    W.CHALLENGE_IDS.length +
    " challenges that count over every run and add to the decks, and the scrapbook; an endless week's conditions; the last call, " +
    "making it up, the golden guest, the perks the simulation reads, the director's hold, breath and fill, two crossovers; a " +
    "built shift played the same twice and a bot through a week of doors and picks; and the page wired to it.",
);
