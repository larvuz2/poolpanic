// The week (dist/week.mjs, dist/week-ui.mjs, dist/marina.mjs): Pool Panic's main loop since 16 October 2026. Six shifts, Monday to
// Saturday, to fill the Date Fund for a Sunday date with Marina; a shift not passed pays nothing but the week goes on; a Sunday short of
// the goal is game over (the run starts again at week 1); the levels are random from a difficulty that rises with every shift, the
// incidents drawn, not written; tips buy perks that never touch the Date Fund; a level passed opens in free play. This plays runs
// through the pure rules, plays the first weeks of a run with the coach bot, and checks the game is wired to it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WEEK_KEY,
  DAYS,
  DATE_DAY,
  SHIFTS_PER_WEEK,
  BASE_GOAL,
  FIRST_SHIFT,
  TOP_TIER,
  stepOf,
  tierFor,
  vipCount,
  INCIDENT_ORDER,
  INCIDENTS,
  TWIST_RULES,
  CHAPTERS,
  PERKS,
  WISHES,
  REROLL_PRICE,
  chapterFor,
  perkEffects,
  shopOffer,
  drawWishes,
  checkWishes,
  directShift,
  shiftCards,
  buildShift,
  shiftPay,
  passMark,
  newWeek,
  normalizeWeekSave,
  finishShift,
  outlook,
  buyPerk,
  reroll,
  stream,
  textsPassed,
  POOLS,
  POOL_IDS,
  poolsOf,
  weekPools,
  scoreScale,
} from "./dist/week.mjs";
import { scene, VIDEOS } from "./dist/marina.mjs";
import { panelHtml } from "./dist/cinematic.mjs";
import { SHIFTS, PoolSimulation } from "./dist/sim.mjs";
import { TWISTS } from "./dist/incidents/twist.mjs";
import { CoachBot } from "./check-bot.mjs";
import { makeSim } from "./tools/replay.mjs";

const freshSave = (over = {}) => normalizeWeekSave({ chapter: 1, ...over });
const summary = (score, stars, extra = {}) => ({
  score,
  stars,
  happy: 0,
  lost: 3,
  bestStreak: 0,
  collisions: 2,
  avgWait: 30,
  avgHappiness: 40,
  catastrophes: 0,
  ...extra,
});

// 1) The data: six days and a Sunday; the incident order names each incident once; every week's date and goal, dearer and better paid
// as the run goes on, the ocean trip the fourth; every perk, wish and twist rule is complete.
assert.equal(DAYS.length, 6);
assert.equal(SHIFTS_PER_WEEK, 6);
assert.equal(DAYS.at(-1), "Saturday");
assert.equal(DATE_DAY, "Sunday");
assert.ok(WEEK_KEY.startsWith("pool-panic."));
assert.deepEqual(
  [...INCIDENT_ORDER].sort(),
  Object.keys(INCIDENTS).sort(),
  "the order names every incident once",
);
for (let n = 1; n <= 12; n++) {
  const ch = chapterFor(n);
  assert.ok(ch.goal > 0 && ch.pay > 0 && ch.date.icon && ch.date.name, "week " + n);
  if (n > 1)
    assert.ok(ch.goal > chapterFor(n - 1).goal && ch.pay > chapterFor(n - 1).pay, "dearer, better paid");
}
assert.equal(chapterFor(1).goal, BASE_GOAL);
assert.equal(chapterFor(CHAPTERS.length).date.id, "ocean", "the fourth date is the ocean trip");
assert.ok(chapterFor(CHAPTERS.length + 1).heat === 1, "the weeks go on after it");
assert.equal(chapterFor(0).id, 1);
for (const [id, p] of Object.entries(PERKS)) {
  assert.ok(p.icon && p.name && p.text && p.price > 0, id + " is a full perk");
  assert.ok(p.sim || p.director || p.tips || p.wishes || p.sponsor || p.insurance, id + " does something");
}
for (const [id, w] of Object.entries(WISHES)) assert.ok(w.icon && w.text && w.say && w.met && w.pay > 0, id);
for (const kind of Object.keys(TWIST_RULES)) assert.ok(TWISTS[kind], kind + " is a twist the game has");

// 1b) The difficulty: the first shift of a run is a gentle minute on level 1 with no incident and no VIP; then a random level from a
// window that climbs with every shift (never back to level 1, reaching the gala by week 4), the same level for the same week; VIPs from
// the second shift, more as the run goes on; past the top, more swimmers and higher targets.
{
  const save = freshSave();
  save.week = newWeek(save, 42);
  const first = buildShift(save.week, null, save.known);
  assert.equal(first.step, 0);
  assert.equal(first.tier, 1);
  assert.equal(first.config.duration, FIRST_SHIFT.duration, "about a minute");
  assert.equal(first.plan.chaos.length, 0, "no incident");
  assert.equal((first.config.vipAt || []).length, 0, "no VIP in the first minute");
  assert.ok(first.pass <= 200, "easy to pass (" + first.pass + ")");
  const tiersAt = (step) => {
    const t = new Set();
    for (let seed = 1; seed <= 200; seed++) t.add(tierFor(step, stream(seed)));
    return t;
  };
  for (let step = 1; step < 40; step++) {
    const t = [...tiersAt(step)];
    assert.ok(
      t.every((x) => x >= 2 && x <= TOP_TIER),
      "never level 1 again, never past the top",
    );
    assert.ok(t.every((x) => x >= Math.min(TOP_TIER, 1 + step) - 2 && x <= Math.min(TOP_TIER, 1 + step) + 1));
    assert.ok(t.length >= 2 || step >= 30, "random, from a window (step " + step + ")");
  }
  assert.ok(tiersAt(19).has(TOP_TIER) && tiersAt(18).has(TOP_TIER), "the gala by the end of week 4");
  const mean = (step) => [...tiersAt(step)].reduce((a, b) => a + b, 0) / tiersAt(step).size;
  assert.ok(mean(6) > mean(1) && mean(12) > mean(6) && mean(18) > mean(12), "the levels climb");
  assert.equal(vipCount(0), 0);
  assert.equal(vipCount(1), 1);
  assert.ok(vipCount(12) > vipCount(1) && vipCount(99) === 5, "more VIPs as the run goes on, five at most");
  for (let step = 1; step < 30; step++) {
    const w = { ...newWeek(freshSave(), 900 + step), chapter: Math.floor(step / 6) + 1, shift: step % 6 };
    assert.equal(stepOf(w), step);
    const sh = buildShift(w, null, INCIDENT_ORDER);
    assert.ok((sh.config.vipAt || []).length >= vipCount(step), "VIPs in shift " + step);
    for (const f of sh.config.vipAt || []) assert.ok(f > 0.05 && f < 0.95);
    assert.deepEqual(
      buildShift(w, null, INCIDENT_ORDER).config,
      sh.config,
      "the same week builds the same shift",
    );
  }
  // (At Splash Park, whose star targets are the season's own at these levels.)
  const at = (chapter) => ({ ...newWeek(freshSave(), 7), chapter, shift: 5, pools: Array(6).fill("resort") });
  const top = buildShift(at(4), null, INCIDENT_ORDER),
    past = buildShift(at(9), null, INCIDENT_ORDER);
  assert.ok(past.config.total > SHIFTS[past.tier - 1].total, "past the top: a bigger crowd");
  assert.ok(past.config.thresholds[0] > SHIFTS[past.tier - 1].thresholds[0], "and higher targets");
  assert.ok(top.step === 23 && past.step === 53);
}

// 1c) The pools: a week sends the coach round them in a mix (every pool of the week at least once, never one two days running, the
// first Monday of a run at the Community Pool, the arena from week 3), the same order for the same week and a different one for
// another. A shift is its pool's: the venue, the look, the crowd; the Aquatic Centre is a competitive pool (few beginners, no aqua
// guest written in, more VIPs, smaller and faster crowds, no trampoline) where Marco "the Missile" always swims.
{
  assert.deepEqual(POOL_IDS, ["club", "resort", "lagoon", "aquatic", "arena"]);
  assert.deepEqual(poolsOf(1), ["club", "resort", "lagoon", "aquatic"]);
  assert.deepEqual(poolsOf(3), POOL_IDS);
  const orders = new Set();
  for (let chapter = 1; chapter <= 6; chapter++)
    for (let seed = 1; seed <= 150; seed++) {
      const days = weekPools(chapter, seed * 7919);
      assert.equal(days.length, SHIFTS_PER_WEEK);
      assert.deepEqual(new Set(days), new Set(poolsOf(chapter)), "every pool of the week, and only those");
      assert.ok(
        days.every((d, i) => i === 0 || d !== days[i - 1]),
        "never the same pool two days running: " + days,
      );
      if (chapter === 1) assert.equal(days[0], "club", "the first Monday is the Community Pool");
      assert.deepEqual(weekPools(chapter, seed * 7919), days, "the same week, the same order");
      orders.add(days.join());
    }
  assert.ok(orders.size > 300, "a different mix most weeks (" + orders.size + ")");
  // Every shift of a week plays in its day's pool.
  const save = freshSave();
  save.week = newWeek(save, 4242);
  for (let i = 0; i < SHIFTS_PER_WEEK; i++) {
    const sh = buildShift({ ...save.week, shift: i }, null, INCIDENT_ORDER);
    assert.equal(sh.pool, save.week.pools[i]);
    assert.equal(sh.config.venue, sh.pool === "club" ? "club" : sh.pool);
    assert.equal(sh.config.name, POOLS[sh.pool].name, "the shift is named after its pool");
  }
  // The Aquatic Centre at every difficulty.
  for (let step = 1; step < 30; step++) {
    const w = {
      ...newWeek(freshSave(), 300 + step),
      chapter: Math.floor(step / 6) + 1,
      shift: step % 6,
      pools: Array(6).fill("aquatic"),
    };
    const sh = buildShift(w, null, INCIDENT_ORDER),
      c = sh.config;
    assert.equal(c.venue, "aquatic");
    assert.equal(c.star.id, "marco", "Marco always swims here");
    assert.equal(c.aqua, false);
    assert.ok(c.mix[0] <= 0.1 && c.mix[2] - c.mix[0] >= 0.85, "mostly Intermediates and Pros");
    assert.ok(!c.daredevilAt, "no trampoline, no daredevils");
    assert.ok(!c.twist.some((t) => t.kind === "class" || t.kind === "storm"), "no aqua class, no storm");
    assert.ok((c.vipAt || []).length >= vipCount(step) + 1, "one more VIP than anywhere else");
    if (sh.step < TOP_TIER - 1)
      assert.ok(c.total < SHIFTS[sh.tier - 1].total || c.total <= 6, "a smaller crowd than the level's");
    const sim = new PoolSimulation(sh.tier, 5, { config: c }),
      types = sim.schedule.map((e) => e.type);
    assert.equal(sim.schedule.filter((e) => e.star === "marco").length, 1, "Marco once");
    assert.ok(!types.includes("aqua") && !types.includes("daredevil"));
    assert.equal(types[0], "intermediate", "the line opens with no beginner");
  }
  // Star targets: the season's own where a level was made for that floor plan, scaled elsewhere (the coach bot's measure).
  for (let tier = 1; tier <= TOP_TIER; tier++) {
    assert.equal(scoreScale(tier <= 10 ? "club" : "resort", tier), 1);
    for (const v of ["club", "resort", "lagoon", "arena", "aquatic"])
      assert.ok(scoreScale(v, tier) >= 0.6 && scoreScale(v, tier) <= 1.5, v + " " + tier);
  }
}

// 2) The director: gentle at first, only incidents the player has met plus at most the next one in the order (never two surprises
// in a row), spread over the shift and never in its last 20 s, twists only where the pool allows them, the same draw for the same
// week, and a different one for another.
{
  let surprises = 0;
  const tuesdays = new Set();
  for (let seed = 1; seed <= 120; seed++) {
    const save = freshSave();
    save.week = newWeek(save, seed * 2654435761);
    let lastSurprise = false;
    for (let i = 0; i < SHIFTS_PER_WEEK; i++) {
      const sh = buildShift(save.week, null, save.known);
      const kinds = sh.plan.chaos.map((c) => c.kinds[0]);
      if (i < 3)
        assert.equal(kinds.length, 0, "the first three shifts of the first week have no roaming incident");
      const next = INCIDENT_ORDER.find((k) => !save.known.includes(k));
      for (const k of kinds)
        assert.ok(save.known.includes(k) || k === next, `only met incidents, or the next (${k})`);
      if (sh.plan.surprise) {
        assert.equal(sh.plan.surprise, next);
        assert.ok(!lastSurprise, "never two surprises in a row");
        assert.ok(i >= 3, "no surprise in the first shifts");
        surprises++;
      }
      lastSurprise = !!sh.plan.surprise;
      for (const c of sh.plan.chaos) {
        assert.equal(c.kinds.length, 1);
        assert.ok(
          c.window[0] >= 10 && c.window[1] <= sh.config.duration - 20 && c.window[0] < c.window[1],
          "window",
        );
      }
      for (const t of sh.config.twist) {
        const rule = TWIST_RULES[t.kind];
        assert.ok(!rule.venues || rule.venues.includes(sh.config.venue), t.kind + " only where it belongs");
        assert.ok(t.at > 0.2 && t.at < 0.8);
      }
      assert.deepEqual(
        buildShift(save.week, null, save.known).plan,
        sh.plan,
        "the same week draws the same shift",
      );
      if (i === 5) tuesdays.add(JSON.stringify(sh.plan.chaos) + JSON.stringify(sh.config.twist));
      assert.equal(sh.pass, passMark(sh.config));
      assert.ok(sh.pass > 0 && sh.pass < sh.config.thresholds[0]);
      finishShift(save, sh, summary(sh.config.thresholds[1], 2), {});
    }
  }
  assert.ok(surprises > 60, "surprises come along (" + surprises + " in 120 first weeks)");
  assert.ok(tuesdays.size >= 4, "Saturday is not the same twice (" + tuesdays.size + " kinds of Saturday)");
  // Later chapters: every incident can come, and the count follows the blueprint with a little give.
  const counts = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const random = stream(seed);
    const bp = SHIFTS[19];
    const plan = directShift({ blueprint: bp, venue: bp.venue, random, known: INCIDENT_ORDER, index: 9 });
    counts.add(plan.chaos.length);
    assert.ok(plan.chaos.length >= bp.chaos.length - 1 && plan.chaos.length <= bp.chaos.length + 1);
    assert.equal(plan.surprise, null, "nothing left to surprise with");
  }
  assert.ok(counts.size >= 2, "the count of incidents varies");
  // A sign makes its incident rare.
  const tally = (weights) => {
    let dogs = 0;
    for (let seed = 1; seed <= 300; seed++)
      dogs += directShift({
        blueprint: SHIFTS[9],
        venue: "club",
        random: stream(seed),
        known: INCIDENT_ORDER,
        index: 9,
        weights,
      }).chaos.filter((c) => c.kinds[0] === "dog").length;
    return dogs;
  };
  assert.ok(tally({ dog: 0.25 }) < tally({}) * 0.5, "the No dogs sign keeps the dog away");
  // The storm only at the lagoon, the aqua class only at the club.
  for (let seed = 1; seed <= 200; seed++) {
    const lagoon = directShift({
      blueprint: SHIFTS[18],
      venue: "lagoon",
      random: stream(seed),
      known: INCIDENT_ORDER,
    });
    const club = directShift({
      blueprint: SHIFTS[9],
      venue: "club",
      random: stream(seed),
      known: INCIDENT_ORDER,
    });
    assert.ok(!club.twist.some((t) => t.kind === "storm"));
    assert.ok(!lagoon.twist.some((t) => t.kind === "class"));
  }
}

// 3) The cards: a regular day always, a booking only when its trouble is known, a mystery that brings one more.
{
  const random = stream(7);
  const early = shiftCards(0, random, []);
  assert.deepEqual(
    early.map((c) => c.id),
    ["regular"],
  );
  for (let seed = 1; seed <= 100; seed++) {
    const cards = shiftCards(6, stream(seed), ["dog"], SHIFTS[6]);
    assert.equal(cards[0].id, "regular");
    for (const c of cards.filter((c) => c.booking))
      assert.ok(["tour"].includes(c.booking), "only bookings it knows");
  }
  const save = freshSave({ chapter: 2, known: INCIDENT_ORDER });
  save.week = newWeek(save, 99);
  save.week.shift = 6;
  const base = buildShift(save.week, null, save.known);
  const mystery = base.cards.find((c) => c.mystery);
  if (mystery) {
    const m = buildShift(save.week, "mystery", save.known);
    assert.ok(m.plan.chaos.length >= base.plan.chaos.length, "a mystery gig brings no less trouble");
    assert.ok(m.card.payout > 1);
  }
  const booked = base.cards.find((c) => c.booking);
  if (booked) assert.equal(buildShift(save.week, booked.id, save.known).booking, booked.booking);
}

// 4) Money: a shift that passes pays into the Date Fund (more for stars, a card and Marina's wishes), tips buy perks and never touch
// the fund, a shift under the pass mark loses the week (unless insured, once), and Friday decides the date.
{
  const ch = chapterFor(1);
  assert.ok(
    shiftPay(3, ch) > shiftPay(2, ch) &&
      shiftPay(2, ch) > shiftPay(1, ch) &&
      shiftPay(1, ch) > shiftPay(0, ch),
  );
  assert.ok(shiftPay(0, ch) > 0, "a pass with no star still pays a little");
  assert.ok(shiftPay(2, ch, { payout: 1.4 }) > shiftPay(2, ch), "a booking pays more");
  assert.ok(shiftPay(3, chapterFor(4)) > shiftPay(3, ch), "later pools pay more");
  // A week of random play, buying whatever it can: the fund never goes down until the week ends.
  for (let seed = 1; seed <= 80; seed++) {
    const random = stream(seed);
    const save = freshSave({ chapter: 1 + (seed % 4), known: INCIDENT_ORDER });
    save.week = newWeek(save, seed);
    let fund = 0;
    while (save.week) {
      const sh = buildShift(save.week, null, save.known);
      const stars = Math.floor(random() * 4),
        score = stars ? sh.config.thresholds[stars - 1] : random() < 0.85 ? sh.pass : sh.pass - 1;
      const r = finishShift(save, sh, summary(score, stars), { prevented: 1 });
      assert.ok(r.fund >= fund, "the Date Fund only goes up");
      fund = r.fund;
      if (!save.week) break;
      const tipsBefore = save.week.tips;
      for (const id of shopOffer(save.week, save.week.rolls)) {
        const fundBefore = save.week.fund;
        if (buyPerk(save.week, id)) assert.equal(save.week.tips, tipsBefore - PERKS[id].price);
        assert.equal(save.week.fund, fundBefore, "buying never touches the Date Fund");
        break;
      }
      assert.ok(save.week.tips >= 0);
    }
  }
  // Pass and fail, the safety net, the last shift.
  const save = freshSave();
  save.week = newWeek(save, 5);
  let sh = buildShift(save.week, null, save.known);
  let r = finishShift(save, sh, summary(sh.pass, 0), {});
  assert.ok(
    r.passed && !r.failed && r.gained > 0 && save.week.shift === 1,
    "on the pass mark: passed, paid, on to the next",
  );
  assert.ok(r.tips > 0);
  assert.equal(save.unlocked, 1, "level 1 is open");
  sh = buildShift(save.week, null, save.known);
  r = finishShift(save, sh, summary(sh.pass - 1, 0), {});
  assert.ok(
    r.failed && !r.over && save.week && save.week.shift === 2 && r.gained === 0,
    "not passed: no pay, the week goes on",
  );
  assert.equal(save.unlocked, 1, "a level not passed does not open");
  save.week.tips = 100;
  assert.ok(buyPerk(save.week, "insurance"));
  assert.ok(!buyPerk(save.week, "insurance"), "a perk once a week");
  assert.ok(!buyPerk(save.week, "nonsense"));
  sh = buildShift(save.week, null, save.known);
  r = finishShift(save, sh, summary(sh.pass - 1, 0), {});
  assert.ok(
    r.failed && r.insured && r.pay > 0 && r.pay < shiftPay(1, chapterFor(1)),
    "the safety net pays half",
  );
  sh = buildShift(save.week, null, save.known);
  r = finishShift(save, sh, summary(sh.pass, 1), {});
  assert.equal(save.unlocked, Math.max(1, sh.tier), "a level passed opens in free play");
  // A full week of good shifts makes the date; the next week is on, harder, and the date is kept.
  const good = freshSave();
  good.week = newWeek(good, 6);
  for (let i = 0; i < SHIFTS_PER_WEEK; i++) {
    const s = buildShift(good.week, null, good.known);
    r = finishShift(good, s, summary(s.config.thresholds[1], 2), {});
    if (i < SHIFTS_PER_WEEK - 1) assert.ok(!r.last && good.week);
  }
  assert.ok(
    r.last && r.won && !r.over && good.chapter === 2 && good.dates.includes("icecream") && good.week === null,
  );
  assert.equal(good.bestWeek, 2);
  // A week with three shifts failed falls short on Saturday: game over, the run starts again at week 1, what was opened stays.
  const poor = freshSave({ chapter: 3, v: 2, dates: ["icecream", "movie"], unlocked: 9 });
  poor.week = newWeek(poor, 8);
  for (let i = 0; i < SHIFTS_PER_WEEK; i++) {
    const s = buildShift(poor.week, null, poor.known);
    r = finishShift(poor, s, summary(i % 2 ? s.pass - 1 : s.pass, 0), {});
  }
  assert.ok(r.last && r.over && !r.won && poor.week === null, "short on Saturday: game over");
  assert.ok(
    poor.chapter === 1 && poor.dates.length === 0 && poor.runs === 1 && poor.unlocked >= 9,
    "back to week 1",
  );
  // Two stars a shift make the date; one star a shift with no wish does not.
  for (let n = 1; n <= 8; n++) {
    const ch = chapterFor(n);
    assert.ok(
      shiftPay(2, ch) * SHIFTS_PER_WEEK + 6 * 15 * ch.pay >= ch.goal,
      "two stars and a wish a shift: week " + n,
    );
    assert.ok(shiftPay(1, ch) * SHIFTS_PER_WEEK < ch.goal, "one star a shift is not enough: week " + n);
  }
  // Perks add up; the charm, the tip jar and the sponsor do what they say.
  const fx = perkEffects(["shoes", "megaphone", "tummy", "tipjar", "charm", "sponsor", "nodogs"]);
  assert.equal(fx.sim.speed, 1.12);
  assert.equal(fx.sim.warning, 4);
  assert.ok(fx.tips === 1.5 && fx.wishes === 1.5 && fx.sponsor === 15 && fx.director.dog === 0.25);
  const rich = freshSave();
  rich.week = newWeek(rich, 9);
  rich.week.perks = ["sponsor", "charm"];
  sh = buildShift(rich.week, null, rich.known);
  const met = summary(sh.config.thresholds[2], 3, {
    happy: 99,
    lost: 0,
    bestStreak: 99,
    collisions: 0,
    avgWait: 1,
    avgHappiness: 100,
  });
  r = finishShift(rich, sh, met, { prevented: 5, vips: 9, flips: 9 });
  assert.equal(r.sponsor, 15);
  assert.ok(
    r.wishes.every((w) => w.met),
    "every wish met by a perfect shift",
  );
  assert.equal(
    r.wishPay,
    r.wishes.reduce((s, w) => s + Math.max(5, Math.round((w.pay * 1.5) / 5) * 5), 0),
  );
  // Rerolls cost tips and give a new hand.
  const shop = freshSave();
  shop.week = newWeek(shop, 11);
  shop.week.tips = REROLL_PRICE;
  const first = shopOffer(shop.week, shop.week.rolls);
  assert.equal(first.length, 3);
  assert.ok(reroll(shop.week) && shop.week.tips === 0 && !reroll(shop.week));
  assert.notDeepEqual(shopOffer(shop.week, shop.week.rolls), first, "a reroll is a new hand");
  // The pace and Marina's texts.
  const o = outlook({ ...newWeek(freshSave(), 1), fund: 0 });
  assert.ok(o.onTrack, "Monday morning is on track");
  assert.ok(outlook({ ...newWeek(freshSave(), 1), fund: 500 }).reached);
  assert.deepEqual(
    textsPassed(100, 300, 500).map((t) => t.at),
    [0.25, 0.5],
  );
}

// 5) Wishes fit their shift: no VIP wish without VIPs, no flips without daredevils, no "stop trouble" without trouble.
for (let seed = 1; seed <= 200; seed++) {
  const plain = drawWishes(
    { index: 5, tier: 6, total: 20, incidents: [], vips: 0, daredevils: 0 },
    stream(seed),
  );
  assert.equal(plain.length, 2);
  assert.notEqual(plain[0].id, plain[1].id);
  for (const w of plain) assert.ok(!["vips", "flips", "saves"].includes(w.id), "a wish that fits: " + w.id);
}
assert.deepEqual(
  checkWishes([{ id: "nobody", target: 0 }], { lost: 0 }).map((w) => w.met),
  [true],
);

// 6) The save: junk is thrown out, a finished week is not kept, a week in progress is; an old ten-shift save starts a fresh run.
{
  const s = normalizeWeekSave({
    v: 2,
    chapter: "x",
    known: ["dog", "unicorn"],
    dates: [7, "icecream"],
    invited: [1, -2, "a"],
    unlocked: 99,
    week: { status: "playing", seed: 5, shift: 99, fund: -4, tips: 3.7, perks: ["shoes", "shoes", "laser"] },
  });
  assert.equal(s.chapter, 1);
  assert.deepEqual(s.known, ["dog"]);
  assert.deepEqual(s.dates, ["icecream"]);
  assert.deepEqual(s.invited, [1]);
  assert.equal(s.unlocked, TOP_TIER);
  assert.equal(s.week.shift, SHIFTS_PER_WEEK - 1);
  assert.equal(s.week.fund, 0);
  assert.deepEqual(s.week.perks, ["shoes"]);
  assert.equal(normalizeWeekSave({ v: 2, week: { status: "won" } }).week, null);
  assert.equal(normalizeWeekSave(null).chapter, 1);
  const old = normalizeWeekSave({ chapter: 3, known: ["dog"], week: { status: "playing", shift: 7 } });
  assert.ok(
    old.chapter === 1 && old.week === null && old.known[0] === "dog",
    "an old save: a new run, what was met kept",
  );
}

// 7) The simulation takes the perks: none is the game as it was; each does what its card says.
{
  const plain = new PoolSimulation(5, 1234),
    same = new PoolSimulation(5, 1234, { perks: {} });
  for (let i = 0; i < 600; i++) {
    plain.tick(1 / 60);
    same.tick(1 / 60);
  }
  assert.equal(
    JSON.stringify(plain.people.map((p) => [p.x, p.z, p.status])),
    JSON.stringify(same.people.map((p) => [p.x, p.z, p.status])),
  );
  const run = (perks) => {
    const s = new PoolSimulation(5, 77, { perks });
    s.start();
    const z = s.coach.z;
    s.setMovement(0, 1);
    for (let i = 0; i < 30; i++) s.tick(1 / 60);
    return s.coach.z - z;
  };
  assert.ok(run({ speed: 1.12 }) > run({}) * 1.08, "running shoes: further along the deck in half a second");
  const patient = new PoolSimulation(5, 3, { perks: { patience: 1.25, warning: 4 } }),
    normal = new PoolSimulation(5, 3);
  patient.spawn({});
  normal.spawn({});
  assert.ok(
    Math.abs(patient.people[0].waitLimit - normal.people[0].waitLimit * 1.25) < 1e-9,
    "shady benches",
  );
  assert.equal(patient.people[0].sicknessTimer, 14, "tummy alarm");
  assert.equal(
    new PoolSimulation(5, 3, { perks: { score: 1.1 } }).scoreMultiplier(),
    normal.scoreMultiplier() * 1.1,
  );
  let cramps = [0, 0];
  for (const [i, perks] of [{}, { cramp: 0.5 }].entries()) {
    const s = new PoolSimulation(6, 11, { perks });
    for (let k = 0; k < 400; k++) s.spawn({});
    cramps[i] = s.people.filter((p) => p.crampAt !== Infinity).length;
  }
  assert.ok(
    cramps[1] < cramps[0] * 0.7,
    `the stretching poster halves the cramps (${cramps[1]} of ${cramps[0]})`,
  );
  const dash = new PoolSimulation(5, 1, { perks: { dash: 0.6 } });
  dash.start();
  dash.dash();
  assert.ok(Math.abs(dash.coach.dashCooldown - 0.82 * 0.6) < 1e-9, "turbo whistle");
}

// 8) The coach bot plays the first three weeks of a run (eighteen shifts, the levels climbing): every shift finishes with its incidents
// fired or skipped and none left open, the first is passed, almost all pass, and a good week can make the date.
const table = [];
{
  const save = freshSave();
  for (let n = 1; n <= 3; n++) {
    save.week = newWeek(save, 1000 + n * 77);
    const ch = chapterFor(n);
    let passed = 0,
      best = 0;
    const tiers = [];
    for (let i = 0; i < SHIFTS_PER_WEEK; i++) {
      const sh = buildShift(save.week, null, save.known);
      tiers.push(POOLS[sh.pool].icon + sh.tier);
      const bot = new CoachBot(sh.tier, 31 + i * 7, { config: sh.config }).run(),
        s = bot.s,
        r = s.summary();
      assert.equal(s.status, "ended", `week ${n} shift ${i + 1} finishes`);
      assert.ok(
        s.chaosPlan.every((e) => e.done),
        `week ${n} shift ${i + 1}: every incident fired or skipped`,
      );
      assert.ok(!s.fish && !s.rescue && !s.closed, `week ${n} shift ${i + 1}: nothing left open at closing`);
      if (n === 1 && i === 0) assert.ok(r.score >= sh.pass, "the first shift is passed");
      if (r.score >= sh.pass) passed++;
      best += shiftPay(3, ch) + sh.wishes.reduce((sum, w) => sum + w.pay, 0); // three stars and both wishes
      finishShift(save, sh, { ...r, score: Math.max(r.score, sh.pass) }, s.stats);
    }
    table.push(
      `week ${n}: levels ${tiers.join(",")}, ${passed}/6 passed by the bot, goal ${ch.goal}, best ${best}`,
    );
    assert.ok(passed >= 5, `week ${n}: a competent coach passes almost every shift (${passed}/6)`);
    assert.ok(best > ch.goal * 1.15, `week ${n}: a great week makes the date with room to spare`);
    if (!save.week && save.chapter === n) save.chapter = n + 1; // (the bot's run goes on whatever its fund)
    save.chapter = n + 1;
  }
}

// 9) A shift of the week replays: the record carries the config it was built from.
{
  const save = freshSave({ chapter: 2, known: INCIDENT_ORDER });
  save.week = newWeek(save, 4321);
  save.week.shift = 4;
  save.week.perks = ["shoes"];
  const sh = buildShift(save.week, "regular", save.known);
  const game = new PoolSimulation(sh.tier, 555, { config: sh.config, booking: sh.booking, perks: sh.perks });
  const again = makeSim({
    level: sh.tier,
    seed: 555,
    booking: "",
    week: { config: sh.config, perks: sh.perks },
  });
  assert.deepEqual(again.chaosPlan, game.chaosPlan, "the replay plays the same incidents");
  assert.equal(again.perks.speed, 1.12);
}

// 10) Marina's scenes: an invite, a date and a rain check for each chapter, a video when one is named, drawn panels when not.
{
  for (const ch of [1, 2, 3, 4, 5, 9].map(chapterFor)) {
    for (const kind of ["invite", "date", "raincheck"]) {
      const s = scene(kind, ch);
      assert.ok(s.panels.length >= 1 && s.panels.every((p) => p.text && Array.isArray(p.layers)), kind);
      assert.equal(s.panels.at(-1).hold, 0, "the last panel waits for the player");
    }
    assert.match(
      scene("invite", ch)
        .panels.map((p) => p.text)
        .join(" "),
      new RegExp("\\$" + ch.goal.toLocaleString("en-US")),
    );
  }
  assert.equal(Object.keys(VIDEOS).length, 0, "no videos yet: every scene is drawn");
  VIDEOS["date-icecream"] = "assets/video/marina/date-icecream.mp4";
  const withVideo = scene("date", chapterFor(1));
  assert.equal(withVideo.panels[0].video, "assets/video/marina/date-icecream.mp4");
  assert.equal(withVideo.panels[0].hold, 0, "a video moves on when it ends");
  delete VIDEOS["date-icecream"];
  const html = panelHtml({ bg: "dream", video: 'a"><img onerror=1>', layers: [{ e: "💖", x: 1, y: 1 }] });
  assert.ok(
    html.includes("<video") && html.includes("💖") && !html.includes("<img"),
    "a video panel keeps its drawn fallback, escaped",
  );
}

// 11) The game is wired to it.
{
  const app = readFileSync("dist/app.mjs", "utf8"),
    html = readFileSync("dist/index.html", "utf8"),
    lib = readFileSync("desktop/lib.cjs", "utf8"),
    sim = readFileSync("dist/sim.mjs", "utf8");
  assert.match(app, /import \{ installWeek \} from "\.\/week-ui\.mjs"/);
  assert.match(app, /startShift: \(shift\) => start\(null, shift\)/);
  assert.match(app, /new PoolSimulation\(week\.tier, runSeed, \{/);
  assert.match(app, /if \(sim\.config\.week && weekUi\) return finishWeek\(\);/);
  assert.match(app, /weekUi\?\.pending/);
  assert.match(app, /TO PASS THE SHIFT/);
  assert.match(
    app,
    /week: \{ config: weekShift\.config, perks: weekShift\.perks \}/,
    "the replay record carries the shift",
  );
  for (const id of [
    "week-card",
    "wk-go",
    "wk-free",
    "fp-back",
    "week-dialog",
    "wd-cards",
    "wd-wishes",
    "wd-pass",
    "shop-dialog",
    "shop-cards",
    "shop-reroll",
    "shop-next",
    "result-week",
    "rw-lines",
    "rw-fill",
  ])
    assert.ok(html.includes(`id="${id}"`), id + " is on the page");
  assert.ok(lib.includes(`"${WEEK_KEY}"`), "the week is a save the desktop app keeps");
  assert.match(sim, /this\.perks = \{ speed: 1, dash: 1, patience: 1, cramp: 1, warning: 0, score: 1/);
}

console.log(
  "Week checks passed: six days and a Sunday date, each week dearer and better paid; a gentle first minute, then random levels " +
    "from a difficulty that climbs every shift, more VIPs as the run goes on, bigger crowds past the top; the director gentle at " +
    "first, bringing in only met incidents and the next in the order, never the same Saturday twice, signs keeping their incident " +
    "away, twists only where the pool allows; cards, the mystery gig and bookings; a Date Fund that only goes up and that tips never " +
    "touch, a shift not passed paying nothing while the week goes on, the safety net, Saturday deciding the date or game over back " +
    "to week 1, levels passed opening in free play; wishes that fit their shift; a save that throws junk out; perks that change the " +
    "simulation; the bot through a run's first weeks (" +
    table.join("; ") +
    "); replays; Marina's scenes with and without video; and the game wired to it.",
);
