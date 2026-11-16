// Phase 2, a run worth repeating (19 October 2026): the pools as a ladder opened across runs, one money (perks out of the Date
// Fund), difficulty by week with every level's star targets smoothed, the season finale at the Grand Gala Arena on Saturday of
// week 4 and the story's ending after it, then endless; and what lasts across runs: the dates album, the coach's gear opened by
// stars, the best stars at each pool, all in the coach's locker.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  LADDER,
  LADDER_START,
  FINALE_WEEK,
  FINALE_POOL,
  POOLS,
  POOL_IDS,
  WEEK_BANDS,
  SHIFTS_PER_WEEK,
  GEAR,
  GEAR_IDS,
  PERKS,
  ALL_DATES,
  INCIDENT_ORDER,
  openPools,
  weekPools,
  bandOf,
  tierFor,
  tierScale,
  heatOf,
  gearOpen,
  perkEffects,
  perkPrice,
  rerollPrice,
  chapterFor,
  chapterOfDate,
  newWeek,
  buildShift,
  finishShift,
  normalizeWeekSave,
  buyPerk,
  reroll,
  shopOffer,
  stream,
  textsPassed,
} from "./dist/week.mjs";
import { scene, CAST } from "./dist/marina.mjs";
import { panelHtml } from "./dist/cinematic.mjs";
import { ART } from "./dist/story.mjs";
import { PoolSimulation } from "./dist/sim.mjs";

const app = readFileSync("dist/app.mjs", "utf8"),
  ui = readFileSync("dist/week-ui.mjs", "utf8"),
  html = readFileSync("dist/index.html", "utf8"),
  css = readFileSync("dist/style.css", "utf8");
const result = (score, stars, extra = {}) => ({
  score,
  stars,
  served: 8,
  happy: 4,
  lost: 1,
  bestStreak: 3,
  collisions: 1,
  avgWait: 20,
  avgHappiness: 60,
  catastrophes: 0,
  ...extra,
});
// Plays a whole week with a given number of stars a shift (a shift on its pass mark with no star when 0).
function playWeek(save, starsEach = 3) {
  save.week ||= newWeek(save, 1000 + save.chapter * 17 + save.runs);
  let r = null;
  while (save.week) {
    const sh = buildShift(save.week, null, save.known, save.seen);
    // (`starsEach` under zero: no shift passed, so the week is lost whatever it started with)
    const score = starsEach > 0 ? sh.config.thresholds[starsEach - 1] : starsEach < 0 ? 0 : sh.pass;
    r = finishShift(save, sh, result(score, Math.max(0, starsEach), { lost: 0 }), {
      vips: 2,
      prevented: 1,
      flips: 3,
    });
  }
  return r;
}

// 1) The ladder: thirteen pools in the creator's order, the arena kept for the finale. Since 16 November 2026 every pool is open
// from the first run (the creator: "we have lots, so let's not be too repetitive"): the ladder is the order they are met in.
{
  assert.equal(LADDER.length, 13);
  assert.deepEqual(
    [...LADDER, FINALE_POOL].sort(),
    [...POOL_IDS].sort(),
    "every pool is on the ladder or the finale",
  );
  assert.equal(LADDER_START, LADDER.length, "every pool is open from the first run");
  assert.deepEqual(LADDER.slice(0, 3), ["club", "resort", "kids"], "the gentle ones come first");
  assert.ok(!LADDER.includes(FINALE_POOL));
  assert.deepEqual(openPools(3, 1), LADDER);
  assert.deepEqual(openPools(0, 1), LADDER);
  assert.equal(openPools(99, 2).length, 13);
  assert.ok(!openPools(12, FINALE_WEEK).includes(FINALE_POOL), "the arena is only the finale in week 4");
  assert.ok(openPools(12, FINALE_WEEK + 1).includes(FINALE_POOL), "and joins the draw after it (endless)");
  const fresh = normalizeWeekSave({});
  assert.equal(fresh.ladder, LADDER.length);
  assert.deepEqual(fresh.album, []);
  assert.deepEqual(fresh.recent, []);
  assert.equal(fresh.stars, 0);
  assert.equal(fresh.gear, null);
  assert.equal(fresh.finale, false);
}

// 2) The week's pools. Drawn from a list (without the pools played: a check, a week from before): never one two days running, a
// pool never played in the week for sure, six different pools once six are in the list, the finale on Saturday of week 4. In a
// run, a rotation: the six pools played longest ago, so a week never repeats a pool and a new run never starts where the last did.
{
  const THREE = ["club", "resort", "kids"];
  for (let seed = 1; seed <= 200; seed++) {
    const three = weekPools(1, seed, THREE, THREE);
    assert.equal(three.length, SHIFTS_PER_WEEK);
    assert.equal(three[0], "club");
    assert.ok(three.every((d) => THREE.includes(d)));
    assert.ok(
      three.every((d, i) => i === 0 || d !== three[i - 1]),
      "never two days running: " + three,
    );
    for (const id of THREE)
      assert.equal(three.filter((d) => d === id).length, 2, "each pool twice in a week of three");
    for (let n = 4; n <= 12; n++) {
      const open = LADDER.slice(0, n),
        newest = LADDER[n - 1],
        days = weekPools(2, seed * 31 + n, open, [newest]);
      assert.ok(days.includes(newest), "a pool never played comes at once (" + newest + ")");
      assert.ok(
        days.every((d) => open.includes(d)),
        "only the pools of the list",
      );
      assert.ok(days.every((d, i) => i === 0 || d !== days[i - 1]));
      if (n >= SHIFTS_PER_WEEK) assert.equal(new Set(days).size, SHIFTS_PER_WEEK, "six different pools");
    }
    const finale = weekPools(FINALE_WEEK, seed, openPools(12, FINALE_WEEK));
    assert.equal(finale[SHIFTS_PER_WEEK - 1], FINALE_POOL, "Saturday of week 4: the season finale");
    assert.equal(finale.filter((d) => d === FINALE_POOL).length, 1);
    for (const chapter of [1, 2, 3, 5, 6])
      assert.ok(
        !weekPools(chapter, seed, openPools(12, chapter)).slice(0, 5).includes(FINALE_POOL) ||
          chapter > FINALE_WEEK,
      );
  }
  // The rotation, in a run. A new player: the Community Pool on Monday (the guided shift), the ladder's first six in week 1, six
  // others in week 2, and by the end of week 3 every pool has been worked at.
  for (let seed = 1; seed <= 60; seed++) {
    const save = normalizeWeekSave({});
    const weeks = [];
    for (let n = 1; n <= 3; n++) {
      save.week = newWeek(save, seed * 101 + n);
      const days = [...save.week.pools];
      weeks.push(days);
      assert.equal(new Set(days).size, SHIFTS_PER_WEEK, "six different pools in a week: " + days);
      for (const pool of days) save.recent = [...save.recent.filter((x) => x !== pool), pool];
      save.seen = [...new Set([...save.seen, ...days])];
      save.chapter = n + 1;
      save.week = null;
    }
    assert.equal(weeks[0][0], "club", "a first run starts at the Community Pool");
    assert.deepEqual([...weeks[0]].sort(), [...LADDER.slice(0, 6)].sort(), "week 1: the gentle six");
    assert.ok(
      weeks[1].every((pool) => !weeks[0].includes(pool)),
      "week 2 shares no pool with week 1",
    );
    assert.equal(new Set(weeks.flat()).size, LADDER.length, "every pool worked at by the end of week 3");
    assert.ok(
      weeks[2].every((pool) => !weeks[1].includes(pool)),
      "nor week 3 with week 2",
    );
  }
  // Runs that are lost one after the other (the creator: "I don't like to see the community pool all over and over"): no run
  // starts where the one before did, and two runs running share no pool.
  {
    const save = normalizeWeekSave({ v: 2, tutorial: true, lesson2: true, known: INCIDENT_ORDER });
    const mondays = [],
      runs = [];
    for (let run = 0; run < 6; run++) {
      const r = playWeek(save, -1);
      assert.ok(r.over, "a lost week");
      mondays.push(r.chapter && save.recent[save.recent.length - SHIFTS_PER_WEEK]);
      runs.push(save.recent.slice(-SHIFTS_PER_WEEK));
    }
    for (let i = 1; i < runs.length; i++) {
      assert.notEqual(mondays[i], mondays[i - 1], "a new run starts at another pool");
      assert.ok(
        runs[i].every((pool) => !runs[i - 1].includes(pool)),
        "two runs running share no pool: " + runs[i - 1] + " | " + runs[i],
      );
    }
    assert.ok(new Set(mondays).size >= 5, "Mondays all over town: " + mondays);
    assert.equal(
      mondays.filter((m) => m === "club").length <= 1,
      true,
      "the Community Pool is one pool of thirteen",
    );
    assert.equal(
      save.recent.length,
      new Set(save.recent).size,
      "each pool once in the list, the last played last",
    );
  }
  // A week under way from before the rotation (three pools, each twice): the days still to come get other pools; the days
  // played stay as they were.
  {
    const old = normalizeWeekSave({
      v: 2,
      chapter: 1,
      ladder: 3,
      seen: ["club", "resort", "kids"],
      runs: 2,
      tutorial: true,
      week: {
        chapter: 1,
        seed: 5,
        pools: ["club", "kids", "resort", "kids", "club", "resort"],
        shift: 2,
        fund: 60,
        perks: [],
        history: [{}, {}],
        status: "playing",
      },
    });
    assert.deepEqual(old.week.pools.slice(0, 2), ["club", "kids"], "the days played are as they were");
    assert.equal(
      new Set(old.week.pools).size,
      SHIFTS_PER_WEEK,
      "the days to come: other pools (" + old.week.pools + ")",
    );
    assert.ok(old.week.pools.slice(2).every((pool) => !["club", "kids", "resort"].includes(pool)));
    assert.deepEqual(old.recent, ["club", "resort", "kids"], "an older save: the pools it has seen");
    const kept = normalizeWeekSave(JSON.parse(JSON.stringify(old)));
    assert.deepEqual(kept.week.pools, old.week.pools, "and it stays as redrawn");
  }
  // A new week keeps its draw in the save (the pools seen change during the week, the itinerary does not).
  const s = normalizeWeekSave({});
  s.week = newWeek(s, 77);
  const pools = [...s.week.pools];
  const again = normalizeWeekSave(JSON.parse(JSON.stringify({ ...s, seen: ["club", "resort", "kids"] })));
  assert.deepEqual(again.week.pools, pools, "the week's pools are kept as drawn");
  const junk = normalizeWeekSave({ ...JSON.parse(JSON.stringify(s)), week: { ...s.week, pools: ["x"] } });
  assert.ok(
    junk.week.pools.length === SHIFTS_PER_WEEK && junk.week.pools.every((p) => POOLS[p]),
    "junk is drawn again",
  );
}

// 3) Difficulty by week: each week a band of levels, Monday at its foot and Saturday at its top; the first shift of a run is
// level 1; past the last band, bigger crowds and higher targets; every level's star targets smoothed.
{
  assert.equal(tierFor(1, 0, stream(1)), 1, "the gentle minute");
  for (let chapter = 1; chapter <= 12; chapter++) {
    const [lo, hi] = bandOf(chapter);
    assert.ok(lo >= 2 && hi <= 20 && lo < hi);
    for (let day = chapter === 1 ? 1 : 0; day < SHIFTS_PER_WEEK; day++) {
      const tiers = new Set();
      for (let seed = 1; seed <= 120; seed++) tiers.add(tierFor(chapter, day, stream(seed)));
      for (const t of tiers)
        assert.ok(t >= lo && t <= hi, `week ${chapter} day ${day}: level ${t} in the band`);
      if (hi - lo >= 3) assert.ok(tiers.size >= 2, "a level either way at random");
    }
  }
  const mean = (chapter, day) => {
    let sum = 0;
    for (let seed = 1; seed <= 200; seed++) sum += tierFor(chapter, day, stream(seed));
    return sum / 200;
  };
  for (let chapter = 2; chapter <= WEEK_BANDS.length; chapter++) {
    assert.ok(mean(chapter, 5) > mean(chapter, 0) + 1.5, "Saturday is harder than Monday in week " + chapter);
    assert.ok(mean(chapter, 0) > mean(chapter - 1, 0), "each week's Monday harder than the last");
  }
  assert.ok(mean(4, 5) < 15, "no wall in week 4 (it climbed to level 20 by its Tuesday before)");
  assert.equal(heatOf(WEEK_BANDS.length), 0);
  assert.equal(heatOf(WEEK_BANDS.length + 2), 2);
  for (let t = 1; t <= 20; t++)
    assert.ok(tierScale(t) >= 0.5 && tierScale(t) <= 1.5, "level " + t + "'s scale");
  // A pool's first visit sits at the foot of the week's band (two levels easier, never below it).
  for (let seed = 1; seed <= 60; seed++) {
    const save = normalizeWeekSave({ v: 2, chapter: 3, known: INCIDENT_ORDER });
    const week = { ...newWeek(save, seed), shift: 4, pools: Array(6).fill("disco") };
    const seen = buildShift(week, null, INCIDENT_ORDER, ["disco"]),
      first = buildShift(week, null, INCIDENT_ORDER, []);
    assert.ok(first.firstVisit && first.tier >= bandOf(3)[0] && first.tier <= seen.tier);
    assert.equal(first.tier, Math.max(bandOf(3)[0], seen.tier - 2));
  }
}

// 4) The season finale: Saturday of week 4 at the Grand Gala Arena, at the top of the band, its card shown, no gig to pick.
{
  const save = normalizeWeekSave({ v: 2, chapter: FINALE_WEEK, known: INCIDENT_ORDER, ladder: 8 });
  save.week = { ...newWeek(save, 404), shift: SHIFTS_PER_WEEK - 1 };
  assert.equal(save.week.pools[SHIFTS_PER_WEEK - 1], FINALE_POOL);
  const sh = buildShift(save.week, null, save.known, save.seen);
  assert.ok(sh.finale && sh.config.finale && sh.pool === FINALE_POOL);
  assert.equal(sh.tier, bandOf(FINALE_WEEK)[1], "the top of week 4's band");
  assert.equal(sh.cards.length, 1, "no gig to pick");
  assert.equal(sh.config.label, "Season finale");
  assert.ok(sh.intro && sh.intro.rule.includes("finale"), "the arena's card");
  assert.ok(!sh.firstVisit, "never eased");
  const notFinale = buildShift({ ...save.week, shift: 2 }, null, save.known, save.seen);
  assert.ok(!notFinale.finale && notFinale.pool !== FINALE_POOL);
  // In the simulation the finale is the arena's shift.
  const sim = new PoolSimulation(sh.tier, 3, { config: sh.config });
  assert.equal(sim.venue.id || sim.config.venue, "arena");
}

// 5) One money: a perk is paid out of the Date Fund at a price that grows with the week's pay; nothing is bought on credit; the
// tip jar and the sponsors pay into the fund; Marina's texts come once, on the way up.
{
  const save = normalizeWeekSave({});
  save.week = newWeek(save, 9);
  const w = save.week;
  assert.equal(perkPrice("shoes", chapterFor(1)), PERKS.shoes.price);
  assert.ok(perkPrice("shoes", chapterFor(4)) > perkPrice("shoes", chapterFor(1)), "dearer in later weeks");
  assert.ok(!buyPerk(w, "shoes"), "nothing on credit");
  w.fund = 100;
  assert.ok(buyPerk(w, "shoes"));
  assert.equal(w.fund, 100 - PERKS.shoes.price, "paid out of the Date Fund");
  assert.equal(w.spent, PERKS.shoes.price);
  assert.ok(!buyPerk(w, "shoes"), "a perk once a week");
  const before = w.fund;
  assert.ok(reroll(w) && w.fund === before - rerollPrice(chapterFor(1)) && w.rolls === 1);
  w.fund = 0;
  assert.ok(!reroll(w));
  for (const [id, p] of Object.entries(PERKS)) {
    assert.ok(p.price >= 15 && p.price <= 50, id + ": about half a shift's pay");
    assert.ok(!("tips" in p), "no second money");
  }
  // The tip jar and the sponsors.
  const rich = normalizeWeekSave({});
  rich.week = newWeek(rich, 10);
  rich.week.perks = ["tipjar", "sponsor"];
  const sh = buildShift(rich.week, null, rich.known, rich.seen);
  const r = finishShift(rich, sh, result(sh.config.thresholds[1], 2), { vips: 3 });
  assert.equal(r.vipTips, 15, "three VIPs, $5 each");
  assert.equal(r.sponsor, 15);
  assert.equal(r.gained, r.pay + r.wishPay + r.sponsor + r.vipTips);
  const failed = finishShift(rich, buildShift(rich.week, null, rich.known, rich.seen), result(0, 0), {
    vips: 3,
  });
  assert.ok(failed.failed && failed.vipTips === 0 && failed.sponsor === 0, "a failed shift pays no tips");
  // Marina's texts: once each, on the way up, even when the shop takes the fund back down.
  assert.deepEqual(
    textsPassed(0, 160, 300).map((t) => t.at),
    [0.25, 0.5],
  );
  const t = normalizeWeekSave({});
  t.week = newWeek(t, 11);
  t.week.fund = 160;
  t.week.peak = 160;
  t.week.fund = 60; // (spent in the shop)
  const s1 = buildShift(t.week, null, t.known, t.seen);
  const r1 = finishShift(t, s1, result(s1.config.thresholds[2], 3), {});
  assert.equal(r1.peakBefore, 160);
  assert.ok(!textsPassed(r1.peakBefore, r1.fund, r1.goal).some((m) => m.at <= 0.5), "no text twice");
  // A whole week of random play and shopping: the fund never goes below zero, and only the shop takes from it.
  for (let seed = 1; seed <= 60; seed++) {
    const random = stream(seed);
    const s = normalizeWeekSave({ v: 2, chapter: 1 + (seed % 5), known: INCIDENT_ORDER, ladder: 12 });
    s.week = newWeek(s, seed);
    while (s.week) {
      const shf = buildShift(s.week, null, s.known, s.seen);
      const stars = Math.floor(random() * 4);
      const fundBefore = s.week.fund;
      const res = finishShift(s, shf, result(stars ? shf.config.thresholds[stars - 1] : shf.pass, stars), {});
      assert.equal(res.fund, fundBefore + res.gained, "a shift only adds");
      if (!s.week) break;
      for (const id of shopOffer(s.week, s.week.rolls, s.known)) {
        const f = s.week.fund,
          price = perkPrice(id, chapterFor(s.week.chapter));
        if (buyPerk(s.week, id)) assert.equal(s.week.fund, f - price);
        else assert.ok(f < price || s.week.perks.length >= 6, "only too dear, or a full build, is refused");
      }
      assert.ok(s.week.fund >= 0);
    }
  }
}

// 6) The coach's gear: opened by the stars of all runs, kept for good, one piece worn; it is in the shift's perks (so a replay
// plays it the same) and its week rules count (the medal's sponsor money, the cap's wishes).
{
  const marks = GEAR_IDS.map((id) => GEAR[id].stars);
  assert.deepEqual(
    marks,
    [...marks].sort((a, b) => a - b),
    "in the order they open",
  );
  assert.ok(GEAR_IDS.length >= 6 && marks[0] > 0);
  for (const id of GEAR_IDS) {
    const g = GEAR[id];
    assert.ok(g.icon && g.name && g.text && (g.sim || g.wishes || g.sponsor), id + " does something");
    // Smaller than the shop's perk of the same kind: a lasting cousin, not a replacement.
    for (const [k, v] of Object.entries(g.sim || {}))
      assert.ok(Math.abs(v - 1) <= 0.35, id + " " + k + " is a small effect");
  }
  assert.deepEqual(gearOpen(0), []);
  assert.deepEqual(gearOpen(GEAR.slides.stars), ["cap", "slides"]);
  assert.equal(gearOpen(1e6).length, GEAR_IDS.length);
  const fx = perkEffects(["shoes"], "slides");
  assert.ok(Math.abs(fx.sim.speed - 1.12 * 1.08) < 1e-9, "gear stacks with the shop's perks");
  assert.equal(perkEffects([], "medal").sponsor, 10);
  assert.equal(perkEffects([], "nonsense").sim.speed, 1);
  // Worn: in the shift (its perks and its `gear`), and the medal pays.
  const save = normalizeWeekSave({ stars: 500, gear: "medal" });
  assert.equal(save.gear, "medal");
  assert.equal(normalizeWeekSave({ stars: 3, gear: "medal" }).gear, null, "not worn before it is earned");
  save.week = newWeek(save, 3);
  const shifted = buildShift({ ...save.week, gear: "clipboard" }, null, save.known, save.seen);
  assert.equal(shifted.gear, "clipboard");
  assert.equal(shifted.perks.score, 1.05, "in the simulation's perks");
  const medal = buildShift({ ...save.week, gear: "medal" }, null, save.known, save.seen);
  const r = finishShift(save, medal, result(medal.config.thresholds[0], 1), {});
  assert.equal(r.sponsor, 10);
  // Stars count in every run and open gear on the way.
  const s = normalizeWeekSave({ stars: GEAR.cap.stars - 2 });
  s.week = newWeek(s, 4);
  const sh = buildShift(s.week, null, s.known, s.seen);
  const opened = finishShift(s, sh, result(sh.config.thresholds[2], 3), {});
  assert.deepEqual(opened.newGear, ["cap"]);
  assert.equal(s.stars, GEAR.cap.stars + 1);
}

// 7) A run worth repeating: a date goes in the album and opens the next pool for good; a game over keeps the pools, the album,
// the stars and the best stars; week 4's date is the story's ending the first time; the weeks go on after it.
{
  const save = normalizeWeekSave({});
  let r = playWeek(save, 3);
  assert.ok(r.won && r.newPool === null && r.newDate, "week 1: a date (every pool is open already)");
  assert.equal(save.ladder, LADDER.length);
  assert.deepEqual(save.album, ["icecream"]);
  assert.ok(
    save.best.club === 3 && save.best.resort === 3 && save.best.kids === 3,
    "the best stars at each pool",
  );
  assert.equal(save.seen.length, 6, "six pools worked at in a week");
  save.week = newWeek(save, 22);
  assert.ok(
    save.week.pools.every((pool) => !save.seen.includes(pool)),
    "the very next week: six pools not worked at yet (" + save.week.pools + ")",
  );
  r = playWeek(save, 3);
  r = playWeek(save, 3);
  save.week = newWeek(save, 33);
  assert.equal(save.week.pools[SHIFTS_PER_WEEK - 1], FINALE_POOL, "week 4 ends at the arena");
  r = playWeek(save, 3);
  assert.ok(r.won && r.ending && save.finale && r.chapter.id === FINALE_WEEK, "the story's ending");
  assert.equal(save.chapter, FINALE_WEEK + 1, "and the run goes on");
  assert.deepEqual(save.album, ["icecream", "movie", "dinner", "ocean"]);
  assert.equal(save.ladder, LADDER.length);
  assert.equal(save.seen.length, LADDER.length + 1, "four weeks in: every pool and the arena worked at");
  // Endless: the arena in the draw; a game over keeps what lasts.
  save.week = newWeek(save, 55);
  const before = { ladder: save.ladder, album: [...save.album], stars: save.stars, best: { ...save.best } };
  r = playWeek(save, -1);
  assert.ok(r.over && save.chapter === 1 && save.dates.length === 0, "game over: week 1 again");
  assert.equal(save.ladder, before.ladder, "the pools stay open");
  assert.deepEqual(save.album, before.album, "the album stays");
  assert.ok(save.stars >= before.stars && save.finale, "the stars and the ending stay");
  for (const [id, n] of Object.entries(before.best))
    assert.equal(save.best[id], n, "the best stars stay (" + id + ")");
  // A second time through week 4: the date, no ending again.
  const again = normalizeWeekSave({ ...JSON.parse(JSON.stringify(save)), chapter: FINALE_WEEK, week: null });
  again.week = newWeek(again, 66);
  r = playWeek(again, 3);
  assert.ok(r.won && !r.ending && again.finale);
  // (No pool is left to open: a date is its scene, the album and the next week.)
  const full = normalizeWeekSave({ ladder: 13 });
  r = playWeek(full, 3);
  assert.ok(r.won && r.newPool === null && full.ladder === 13);
}

// 8) The save from before Phase 2: every pool played stays open (and one more for each week reached), the dates reached go in the
// album; junk is thrown out.
{
  const old = normalizeWeekSave({
    v: 2,
    chapter: 2,
    bestWeek: 3,
    seen: ["club", "wave"],
    dates: ["icecream"],
  });
  assert.equal(old.ladder, LADDER.length, "every pool is open, whatever the save had");
  assert.deepEqual(old.recent, ["club", "wave"], "and the pools it played are the rotation's start");
  assert.deepEqual(old.album, ["icecream", "movie"], "the dates of the weeks reached");
  const reached = normalizeWeekSave({ v: 2, bestWeek: 3, seen: [] });
  assert.equal(reached.ladder, LADDER.length);
  const junk = normalizeWeekSave({
    v: 2,
    ladder: 999,
    album: ["icecream", "nope", "icecream", 5],
    stars: -3,
    gear: "laser",
    best: { club: 9, nowhere: 2, resort: "x" },
    finale: 1,
  });
  assert.equal(junk.ladder, LADDER.length);
  assert.deepEqual(junk.album, ["icecream"]);
  assert.equal(junk.stars, 0);
  assert.equal(junk.gear, null);
  assert.deepEqual(junk.best, { club: 3, resort: 0 });
  assert.equal(junk.finale, true);
  assert.equal(normalizeWeekSave({ ladder: 1 }).ladder, LADDER_START);
}

// 9) The album and the story's ending: every date with its still and a scene to watch again; the ending with the ocean, the
// credits (the cast) and the way on; the date's scene with a new pool shows it.
{
  assert.equal(ALL_DATES.length, 8);
  for (const d of ALL_DATES) {
    assert.ok(ART.date[d.id] && existsSync("dist/" + ART.date[d.id]), d.id + " has its still");
    const ch = chapterOfDate(d.id);
    assert.equal(ch.date.id, d.id);
    const panels = scene("date", ch).panels;
    assert.ok(panels.length >= 3 && panels.at(-1).hold === 0);
  }
  assert.equal(chapterOfDate("nope"), null);
  const ending = scene("ending").panels;
  assert.equal(scene("ending").id, "ending");
  const credits = ending.find((p) => p.credits);
  assert.ok(credits && credits.credits === CAST && CAST.length >= 8, "the credits roll the cast");
  assert.ok(CAST.some((c) => c.role === "Coach Waters") && CAST.some((c) => c.role === "Marina"));
  assert.match(ending.at(-1).text, /Thanks for playing/);
  assert.equal(ending.at(-1).hold, 0);
  const roll = panelHtml(credits);
  assert.ok(
    roll.includes("cine-credits") && roll.includes("Coach Waters") && roll.includes("Thanks for playing"),
  );
  assert.ok(!panelHtml({ credits: [{ role: "<b>", name: "x" }] }).includes("<b><"), "escaped");
  const week4 = chapterFor(FINALE_WEEK);
  const finale = scene("date", week4, { ending: true, newPool: { icon: "🌊", name: "Wave Pool" } }).panels;
  assert.ok(
    finale.some((p) => p.credits),
    "the first finale date rolls the credits",
  );
  assert.ok(
    finale.some((p) => /Wave Pool/.test(p.text)),
    "and shows the new pool",
  );
  assert.match(finale.at(-1).text, /Thanks for playing/);
  const later = scene("date", week4, { seasonDone: true }).panels;
  assert.ok(
    !later.some((p) => p.credits) && /season is over/.test(later.at(-1).text),
    "later runs: a short close",
  );
  const plain = scene("date", chapterFor(2), { newPool: { icon: "🪩", name: "Aqua Disco" } }).panels;
  assert.ok(plain.some((p) => p.text.includes("Aqua Disco") && p.layers.some((l) => l.e === "🪩")));
  assert.equal(scene("raincheck", chapterFor(1), "short").panels.length, 1, "the rain check as before");
}

// 10) On screen: the coach's locker (pools, gear, album) from the main screen; the shop with the fund, prices in dollars and what
// a perk leaves; the picker with the gear worn and the finale; the results with gear opened and the new pool.
{
  for (const id of [
    "wk-locker",
    "locker-dialog",
    "locker-pools",
    "locker-gear",
    "locker-album",
    "locker-close",
    "locker-stars",
    "shop-money",
    "shop-fill",
    "shop-pace",
    "wd-gear",
  ])
    assert.ok(html.includes(`id="${id}"`), id + " is on the page");
  assert.ok(!html.includes('id="shop-tips"') && !html.includes('id="wd-tips"'), "no tips left on screen");
  assert.ok(!/tips\b.*pocket money/i.test(html), "Help says one money");
  assert.match(html, /paid out of\s+the\s+Date Fund/);
  assert.match(ui, /\$\("wk-locker"\)\.onclick = openLocker/);
  assert.match(ui, /PICK ONE · IT STAYS FOR THE RUN/);
  assert.match(ui, /Start the finale 🏆/);
  assert.match(ui, /New gear in the locker/);
  assert.match(ui, /NEW POOL: /);
  assert.match(
    ui,
    /const pools = \[\.\.\.itinerary\(w\)\],[\s\S]{0,200}return \{ \.\.\.w, pools, gear: save\.gear, done: save\.done/,
  );
  assert.match(ui, /textsPassed\(result\.peakBefore, result\.fund, result\.goal\)/);
  assert.match(css, /\.locker-pools \{/);
  assert.match(css, /@keyframes cine-roll/);
  assert.match(app, /weekUi\.finish\(r, sim\.stats\)/);
}

console.log(
  "Progress checks passed: every pool open from the first run, the ladder the order they are met in, the arena the finale of week " +
    "4; the week's pools a rotation (the six played longest ago, never one twice in a week, no run starting where the last did, a " +
    "week under way redrawn), kept in the save; difficulty by week with " +
    "smoothed levels and the first visit at the band's foot; the season finale; one money (perks out of the Date Fund, tips into " +
    "it, Marina's texts once); the coach's gear by stars; what a run leaves (album, pools, stars, best stars) and what a game over " +
    "keeps; an older save carried over; the album's stills and scenes, the ending and its credits; and the screens wired.",
);
